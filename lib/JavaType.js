const { Declaration } = require('./Declaration');
const { TypeVariable, TypeArgument, InferredTypeArgument } = require('./TypeVariable');

/**
 * JavaType represents a complete Java type declaration
 */
class JavaType extends Declaration {

    /**
     * @param {'class'|'enum'|'interface'|'@interface'|'primitive'|'array'|'typevar'|'wildcard'} typeKind 
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
     * For generic types, returns the raw type with no type arguments.
     * @returns {JavaType}
     */
    getRawType() {
        return this;
    }

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

    get rawTypeSignature() {
        return this.typeSignature;
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

class CEIJavaType extends JavaType {

    /**
     * The package this type belongs to. eg. "java.util"
     */
    packageName = '';

    /**
     * The type variables declared or type arguments used for this type
     * @type {TypeVariable[] | TypeArgument[]}
     */
    typeVariables = [];

    /**
     * 
     * @param {string} rawShortSignature 
     * @param {'class'|'enum'|'interface'|'@interface'} typeKind 
     * @param {number|string[]} mods 
     * @param {string} docs 
     */
    constructor(rawShortSignature, typeKind, mods, docs) {
        super(typeKind, mods, docs);
        this._rawTypeName = new RawTypeName(rawShortSignature);
        super.simpleTypeName = this._rawTypeName.simpleTypeName;
        this.packageName = this._rawTypeName.packageName;
        this.typeVariables = [];
        this._rawShortSignature = rawShortSignature;
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
     * @param {string} signature 
     * @param {TypeVariable[]} [typevars]
     * @returns {JavaType}
     */
    resolveType(signature, typevars = []) {
        throw new Error('CEIJavaType.resolveType()');
    }

    /**
     * @param {JavaType[]} types 
     * @returns {CEIJavaType}
     */
    specialise(types) {
        throw new Error('CEIJavaType.specialise()');
    }

    /**
     * Returns a duplicate type with inferred type args
     * @returns {CEIJavaType}
     */
    makeInferredTypeArgs() {
        throw new Error('CEIJavaType.makeInferredTypeArgs()');
    }

    /** @type {JavaType[]} */
    get supers() {
        return [];
    }

    get shortSignature() {
        return this._rawShortSignature + this._typeArguments('typeSignature');
    }

    get rawTypeSignature() {
        return this._rawTypeName.typeSignature;
    }

    /**
     * @param {'typeSignature'|'fullyDottedTypeName'|'label'} format 
     */
    _typeArguments(format) {
        if (this.typeVariables.length === 0) {
            return '';
        }
        if (this.typeVariables[0] instanceof InferredTypeArgument) {
            return '<>';
        }
        if (!(this.typeVariables[0] instanceof TypeArgument)) {
            return '';
        }
        const separator = format === 'typeSignature' ? '' : ',';
        // @ts-ignore
        const typeargs = this.typeVariables.map(t => t instanceof TypeArgument ? t.type[format] : '').join(separator);
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

class UnresolvedType extends JavaType {
    /**
     * 
     * @param {string} [name] 
     * @param {string} [signature] 
     */
    constructor(name, signature) {
        super('class', 0, '');
        if (name) {
            this.simpleTypeName = name;
            this._typeSignature = `L${name.replace(/\./g, '/')};`
        } else {
            this.simpleTypeName = signature.replace(/^L(.);$/, (_,n) => n).replace(/[/$]/g, '.');
            this._typeSignature = signature;
        }
    }

    get rawTypeSignature() {
        return this._typeSignature;
    }

    get typeSignature() {
        return this._typeSignature;
    }
}

/**
 * Java Type declaration loaded from a decoded class file
 */
class CompiledJavaType extends CEIJavaType {
    /**
     * @param {JarClassDecoder} decoded
     * @param {Map<string,JavaType>} typemap
     */
    constructor(decoded, typemap) {
        super(decoded.thisclass, typeFromMod(decoded.mods.bits), decoded.mods.bits, decoded.docs);
        this._decoded = decoded;
        this._typemap = typemap;

        const sigattr = decoded.attributes.find(a => a.name === 'Signature');
        if (sigattr) {
            // the type has type variables or it extends from a type with type arguments
            const { typevars, superclasses } = parseTypeDeclarationSignature(this, sigattr.Signature);
            super.typeVariables = typevars;
            this._supers = superclasses;
        }
        else {
            // the generic type signature specifies the supers as full type-signatures (Ljava/lang/Object;)
            // but the superclass field is a short signature (java/lang/Object), so we normalise it here.
            // Note that we can't normalise the generic versions because we need to distinguish L..; from T..;
            /** @type {string[]} */
            this._supers = decoded.superclass ? [`L${decoded.superclass};`] : [];
            this._supers = this._supers.concat(decoded.interfaces.map(intf => `L${intf};`))
        }
        const methods = [], constructors = [];
        for (let m of decoded.methods) {
            switch (m.name) {
                case '<init>':
                    constructors.push(new CompiledConstructor(this, m));
                    break;
                case '<clinit>':
                    // ignore static class initialisers
                    break;
                default:
                    methods.push(new CompiledMethod(this, m));
                    break;
            }
        }
        super.methods = methods;
        super.constructors = constructors;
        super.fields = decoded.fields.map(f => new CompiledField(this, f));
    }

    /**
     * For generic types, returns the raw type with no type arguments.
     * @returns {JavaType}
     */
    getRawType() {
        if (this.typeSignature === this.rawTypeSignature) {
            return this;
        }
        return signatureToType(this.rawTypeSignature, this._typemap);
    }

    get supers() {
        return this._supers.map(s => this.resolveType(s));
    }

    makeInferredTypeArgs() {
        const specialised_type = new CompiledJavaType(this._decoded, this._typemap);
        // map each typevar to an inferred type argument
        // @ts-ignore
        specialised_type.typeVariables = this.typeVariables.map(tv => new InferredTypeArgument(specialised_type, tv));
        return specialised_type;
    }

    /**
     * @param {JavaType[]} types 
     */
    specialise(types) {
        const specialised_type = new CompiledJavaType(this._decoded, this._typemap);
        // map each typevar to a type, filling in any missing types with Object
        // @ts-ignore
        specialised_type.typeVariables = this.typeVariables.map((tv, idx) => new TypeArgument(specialised_type, tv, types[idx] || this._typemap.get('java/lang/Object')));
        return specialised_type;
    }

    /**
     * @param {string} signature 
     * @param {TypeVariable[]} [typevars]
     */
    resolveType(signature, typevars = []) {
        const type = signatureToType(signature, this._typemap, [...typevars, ...this.typeVariables]);
        if (type instanceof WildcardType) {
            return type.bound ? type.bound.type : this._typemap.get('java/lang/Object');
        }
        return type;
    }
}

/**
 * A type represented by a declared type variable
 * 
 * e.g In the declaration:
 * ```
 *   <T> T method(T arg) {}
 * ```
 * the return type and parameter type are both TypeVariableType
 */
class TypeVariableType extends JavaType {

    /**
     * @param {TypeVariable} typevariable 
     */
    constructor(typevariable) {
        super("typevar", [], '');
        super.simpleTypeName = typevariable.name;
        this.typeVariable = typevariable;
    }

    get name() {
        return this.typeVariable.name;
    }

    /**
     * The concrete type assigned to the underlying type variable
     */
    reifiedType() {
        return this.typeVariable.type;
    }

    get typeSignature() {
        return `T${this.simpleTypeName};`;
    }
}

class WildcardType extends JavaType {
    /**
     * 
     * @param {{type: JavaType, kind: 'extends'|'super'}} bound
     */
    constructor(bound) {
        super("wildcard", [], '');
        this.bound = bound;
        super.simpleTypeName = bound ? `? ${bound.kind} ${bound.type.simpleTypeName}` : '?';
    }

    get rawTypeSignature() {
        return this.bound
            ? `${this.bound.kind === 'extends' ? '+' : '-'}${this.bound.type.rawTypeSignature}`
            : '*';
    }

    get typeSignature() {
        return this.bound
            ? `${this.bound.kind === 'extends' ? '+' : '-'}${this.bound.type.typeSignature}`
            : '*';
    }
}

/**
 * The type of the `null` literal
 */
class NullType extends JavaType {
    constructor() {
        super('class', [], '');
        super.simpleTypeName = 'null';
    }
    get typeSignature() {
        return 'null';
    }
}

/**
 * 
 * @param {string} signature 
 * @param {Map<string,JavaType>} typemap 
 * @param {TypeVariable[]} [typevars]
 * @returns {JavaType}
 */
function signatureToType(signature, typemap, typevars = []) {

    // is it a primitive type?
    let type = PrimitveJavaType.map[signature];
    if (type) {
        return type;
    }

    if (signature === '*') {
        return new WildcardType(null);
    }

    if (/^T\w+;$/.test(signature)) {
        const type_var_ident = signature.slice(1,-1);
        const matched_type_var = typevars.find(tv => tv.name === type_var_ident);
        if (matched_type_var) {
            return matched_type_var.type;
        }
        return new UnresolvedType(type_var_ident);
    }

    // some resolves use short signatures, others have L...; separators
    signature = /^L(.+);$/.test(signature) ? signature.slice(1,-1) : signature;

    const arrtype = signature.match(/^(\[+)(.+)/);
    if (arrtype) {
        const base = signatureToType(arrtype[2], typemap, typevars);
        return new (require('./ArrayType').ArrayJavaType)(base, arrtype[1].length);
    }

    // todo - inner generic types
    const generictype = signature.match(/^(.+?)<(.+)>$/);
    if (generictype) {
        const rawtype = signatureToType(generictype[1], typemap, typevars);
        if (rawtype instanceof CEIJavaType) {
            const type_args = require('./type-parser')
                .splitTypeSignatureList(generictype[2])
                .map(sig => signatureToType(sig, typemap, typevars));
            const specialised = rawtype.specialise(type_args);
            const existing = typemap.get(specialised.shortSignature);
            if (existing) {
                return existing;
            }
            typemap.set(specialised.shortSignature, specialised);
            return specialised;
        }
        return rawtype;
    }

    // is it a class type that's already loaded
    type = typemap.get(signature);
    if (type) {
        return type;
    }

    return new UnresolvedType(null, signature);
}

exports.JavaType = JavaType;
exports.PrimitiveJavaType = PrimitveJavaType;
exports.CEIJavaType = CEIJavaType;
exports.CompiledJavaType = CompiledJavaType;
exports.UnresolvedType = UnresolvedType;
exports.TypeVariableType = TypeVariableType;
exports.WildcardType = WildcardType;
exports.NullType = NullType;
exports.signatureToType = signatureToType;
