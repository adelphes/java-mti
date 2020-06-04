const { Declaration } = require('./Declaration');
const { TypeVariable, TypeArgument } = require('./TypeVariable');

/**
 * JavaType represents a complete Java type declaration
 */
class JavaType extends Declaration {

    /**
     * @param {'class'|'enum'|'interface'|'@interface'|'primitive'|'array'|'typevar'} typeKind 
     * @param {number|string[]} mods 
     * @param {string} docs 
     */
    constructor(typeKind, mods, docs) {
        super(mods, docs);
        this.typeKind = typeKind;
    }

    /**
     * The single-ident name of this type. e.g "Sorter"
     */
    simpleTypeName = '';

    /**
     * For enclosed types, the dotted name from the top-level type. e,g "List.Sorter"
     * - For other types, this value is the same as simpleTypeName
     */
    get dottedTypeName () { return this.simpleTypeName }

    /**
     * The fully qualified type name in dotted form. e.g. "java.util.List.Sorter<String>"
     */
    get fullyDottedTypeName () { return this.simpleTypeName }

    /**
     * The fully qualified type name in dotted form. e.g. "java.util.List.Sorter"
     * - For primtive types, this value is the same as simpleTypeName
     */
    get fullyDottedRawName () { return this.simpleTypeName }

    /**
     * The displayable version of the type name
     */
    get label() { return this.simpleTypeName; }

    /**
     * The fields declared in the type
     * @type {import('./Field').Field[]}
     * */
    fields = [];

    /**
     * The methods declared in the type
     * @type {import('./Method').Method[]}
     * */
    methods = [];

    /**
     * The constructors declared in the type
     * @type {import('./Constructor').Constructor[]}
     * */
    constructors = [];

    asClass() {
        return this.resolveType(`Ljava/lang/Class<${this.typeSignature}>;`)
    }

    /**
     * @param {string} name 
     */
    findDeclsByName(name) {
        /** @type {import('./Field').Field[]} */
        let fields = [];
        /** @type {import('./Method').Method[]} */
        let methods = [];
        let types = {
            /** @type {JavaType[]} */
            list: [this],
            /** @type {JavaType[]} */
            done: [],
        };
        const method_sigs = new Set();
        while (types.list.length) {
            const type = types.list.shift();
            if (types.done.includes(type)) {
                continue;
            }
            types.done.push(type);
            fields.splice(fields.length, 0, ...type.fields.filter(f => f.name === name));
            methods.splice(methods.length, 0, ...type.methods.filter(m => {
                if (m.name !== name || method_sigs.has(m.methodSignature)) {
                    return;
                }
                method_sigs.add(m.methodSignature);
                return true;
            }));
            if (type instanceof CEIJavaType) {
                types.list.splice(types.list.length, 0, ...type.supers);
            }
        }
        return {
            fields,
            methods,
        }
    }

    /**
     * @param {string} signature
     * @return {JavaType}
     */
    resolveType(signature) {
        return null;
    }

    get rawTypeSignature() {
        return '';
    }

    get typeSignature() {
        return '';
    }
}

class PrimitveJavaType extends JavaType {
    /**
     * @param {string} sig 
     * @param {string} name 
     */
    constructor(sig, name) {
        super("primitive", 0, `primitive ${name}`);
        this._signature = sig;
        super.simpleTypeName = name;
    }
    
    get rawTypeSignature() {
        return this._signature;
    }

    get typeSignature() {
        return this._signature;
    }

    static isPrimitiveTypeName(name) {
        return /^(int|long|short|byte|float|double|char|boolean|void)$/.test(name);
    }

    static fromName(name) {
        switch(name) {
            case 'int': return PrimitveJavaType.map.I;
            case 'long': return PrimitveJavaType.map.J;
            case 'short': return PrimitveJavaType.map.S;
            case 'byte': return PrimitveJavaType.map.B;
            case 'float': return PrimitveJavaType.map.F;
            case 'double': return PrimitveJavaType.map.D;
            case 'char': return PrimitveJavaType.map.C;
            case 'boolean': return PrimitveJavaType.map.Z;
            case 'void': return PrimitveJavaType.map.V;
        }
        return null;
    }

    static map = {
        I: new PrimitveJavaType('I','int'),
        J: new PrimitveJavaType('J','long'),
        S: new PrimitveJavaType('S','short'),
        B: new PrimitveJavaType('B','byte'),
        F: new PrimitveJavaType('F','float'),
        D: new PrimitveJavaType('D','double'),
        C: new PrimitveJavaType('C','char'),
        Z: new PrimitveJavaType('Z','boolean'),
        V: new PrimitveJavaType('V','void'),
    }
}

class ArrayJavaType extends JavaType {
    /**
     * 
     * @param {JavaType} base 
     * @param {number} arrdims 
     */
    constructor(base, arrdims) {
        super("array", 0, '');
        this.base = base;
        this.arrdims = arrdims;
        this._arrprefix = '['.repeat(arrdims);
        this._arrsuffix = '[]'.repeat(arrdims);
        super.simpleTypeName = `${base.simpleTypeName}${this._arrsuffix}`;
    }

    get dottedTypeName() {
        return `${this.base.dottedTypeName}${this._arrsuffix}`;
    }

    get fullyDottedRawName() {
        return `${this.base.fullyDottedRawName}${this._arrsuffix}`;
    }

    get fullyDottedTypeName() {
        return `${this.base.fullyDottedTypeName}${this._arrsuffix}`;
    }

    get elementType() {
        return this.arrdims === 1 ? this.base : new ArrayJavaType(this.base, this.arrdims - 1);
    }

    get rawTypeSignature() {
        return `${this._arrprefix}${this.base.rawTypeSignature}`;
    }

    get typeSignature() {
        return `${this._arrprefix}${this.base.typeSignature}`;
    }
}


class CEIJavaType extends JavaType {

    /**
     * The package this type belongs to. eg. "java.util"
     */
    packageName = '';

    /**
     * The type variables declared or type arguments used for this type
     * @type {TypeVariable[] | TypeArgument[]}
     */
    typevars = [];

    /**
     * 
     * @param {string} rawShortSignature 
     * @param {'class'|'enum'|'interface'|'@interface'} typeKind 
     * @param {number|string[]} mods 
     * @param {string} docs 
     * @param {TypeArgument[]} [typeargs] 
     */
    constructor(rawShortSignature, typeKind, mods, docs, typeargs) {
        super(typeKind, mods, docs);
        this._rawTypeName = new RawTypeName(rawShortSignature);
        super.simpleTypeName = this._rawTypeName.simpleTypeName;
        this.packageName = this._rawTypeName.packageName;
        this.typevars = typeargs || [];
        this.shortSignature = rawShortSignature + this._typeArguments('typeSignature');
    }

    get dottedTypeName() {
        return this._rawTypeName.dottedTypeName;
    }

    get fullyDottedRawName() {
        return this._rawTypeName.fullyDottedRawName;
    }

    get fullyDottedTypeName() {
        return this._rawTypeName.fullyDottedRawName + this._typeArguments('fullyDottedTypeName');
    }

    get label() {
        return this._rawTypeName.simpleTypeName + this._typeArguments('label');
    }

    /**
     * @param {JavaType[]} types 
     * @returns {CEIJavaType}
     */
    specialise(types) {
        return this;
    }

    /** @type {JavaType[]} */
    get supers() {
        return [];
    }

    get rawTypeSignature() {
        return this._rawTypeName.typeSignature;
    }

    /**
     * @param {'typeSignature'|'fullyDottedTypeName'|'label'} format 
     */
    _typeArguments(format) {
        if (!(this.typevars[0] instanceof TypeArgument)) {
            return '';
        }
        const separator = format === 'typeSignature' ? '' : ',';
        // @ts-ignore
        const typeargs = this.typevars.map(t => t instanceof TypeArgument ? t.type[format] : '').join(separator);
        return `<${typeargs}>`;

    }

    get typeSignature() {
        return this._rawTypeName.typeSignature.replace(/(?=;$)/, this._typeArguments('typeSignature'));
    }
}

/**
 * @typedef {import('./jartypedecoder')} JarClassDecoder
 */
const { parseTypeDeclarationSignature } = require('./type-parser');
const { CompiledConstructor } = require("./Constructor");
const { CompiledField } = require("./Field");
const { CompiledMethod } = require("./Method");
const { RawTypeName } = require('./RawTypeName');

/**
 * @param {number} n 
 * @returns {'class'|'enum'|'interface'|'@interface'}
 */
function typeFromMod(n) {
    return (n & 0x0200) ? 'interface'
     : (n & 0x2000) ? '@interface'
     : (n & 0x4000) ? 'enum'
    : 'class';
}

class UnresolvedType extends CEIJavaType {
    constructor(name) {
        super(name, 'class', 0, '');
        this.simpleTypeName = name;
    }
}

/**
 * Java Type declaration loaded from a decoded class file
 */
class CompiledJavaType extends CEIJavaType {
    /**
     * @param {JarClassDecoder} decoded
     * @param {Map<string,JavaType>} typemap
     * @param {TypeArgument[]} [typeargs]
     */
    constructor(decoded, typemap, typeargs) {
        super(decoded.thisclass, typeFromMod(decoded.mods.bits), decoded.mods.bits, decoded.docs, typeargs);
        this._decoded = decoded;
        this._typemap = typemap;

        const sigattr = decoded.attributes.find(a => a.name === 'Signature');
        if (sigattr) {
            // the type has type variables or it extends from a type with type arguments
            const { typevars, superclasses } = parseTypeDeclarationSignature(this, sigattr.Signature);
            super.typevars = typeargs || typevars;
            this._supers = superclasses;
        }
        else {
            // the generic type signature specifies the supers as full type-signatures (Ljava/lang/Object;)
            // but the superclass field is a short signature (java/lang/Object), so we normalise it here.
            // Note that we can't normalise the generic versions because we need to distinguish L..; from T..;
            /** @type {string[]} */
            this._supers = decoded.superclass ? [`L${decoded.superclass};`] : [];
        }
        const methods = [], constructors = [];
        for (let m of decoded.methods) {
            if (m.name === '<init>') {
                constructors.push(new CompiledConstructor(this, m));
            } else {
                methods.push(new CompiledMethod(this, m));
            }
        }
        super.methods = methods;
        super.constructors = constructors;
        super.fields = decoded.fields.map(f => new CompiledField(this, f));
    }

    get supers() {
        return this._supers.map(s => this.resolveType(s));
    }

    /**
     * @param {string} signature 
     * @param {TypeVariable[]} [typevars] type variables passed from type-parameterised methods
     */
    _specialiseTypeSignature(signature, typevars) {
        return signature.replace(/T(\w+);/g, (_, name) => {
            const tv = 
                (typevars && typevars.find(tv => tv.name == name))
                || this.typevars.find(tv => tv.name === name);
            if (!tv) {
                // we should search outer enclosing types here
                return 'Ljava/lang/Object;';
            }
            return tv.typeSignature;
        });
    }

    /**
     * @param {JavaType[]} types 
     */
    specialise(types) {
        // map each typevar to a type, filling in any missing types with Object
        // @ts-ignore
        const typeargs = this.typevars.map((tv, idx) => new TypeArgument(tv, types[idx] || this._typemap.get('java/lang/Object')));
        const specialised_type = new CompiledJavaType(this._decoded, this._typemap, typeargs);
        return specialised_type;
    }

    /**
     * @param {string} signature 
     * @param {TypeVariable[]} [typevars]
     */
    resolveType(signature, typevars) {
        let type = PrimitveJavaType.map[signature];
        if (type) {
            return type;
        }
        signature = this._specialiseTypeSignature(signature, typevars);
        // some resolves use short signatures, others have L/T qualifiers
        signature = /^L(.+);$/.test(signature) ? signature.slice(1,-1) : signature;
        type = this._typemap.get(signature);
        if (!type) {
            const arrtype = signature.match(/^(\[+)(.+)/);
            if (arrtype) {
                // tbd - should we cache array types in the type map?
                return new ArrayJavaType(this.resolveType(arrtype[2]), arrtype[1].length);
            }
            // todo - inner generic types
            const generictype = signature.match(/^(.+?)<(.+)>$/);
            if (generictype) {
                const rawtype = this.resolveType(generictype[1]);
                if (rawtype) {
                    const specialisedTypes = require('./type-parser').splitTypeSignatureList(generictype[2]).map(sig => this.resolveType(sig));
                    return rawtype.specialise(specialisedTypes);
                }
            }
            type = new UnresolvedType(signature);
        }
        return type;
    }
}

exports.JavaType = JavaType;
exports.PrimitiveJavaType = PrimitveJavaType;
exports.ArrayJavaType = ArrayJavaType;
exports.CEIJavaType = CEIJavaType;
exports.CompiledJavaType = CompiledJavaType;
exports.UnresolvedType = UnresolvedType;
