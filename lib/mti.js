
/**
 * @param {number} ref 
 * @param {MTIType} mti
 * @returns {string}
 */
function getPackageName(ref, mti) {
    if (typeof ref !== 'number') {
        return null;
    }
    if (ref < 16) {
        return KnownPackages[ref];
    }
    return mti.minified.y[ref - 16];
}

/**
 * @param {number} ref 
 * @param {MTIType} mti
 */
function getReferencedType(ref, mti) {
    if (typeof ref !== 'number') {
        return null;
    }
    if (ref < 16) {
        return KnownReferencedTypes[ref];
    }
    return mti.referenced.types[ref - 16];
}

function indent(s) {
    return '\n' + s.split('\n').map(s => `    ${s}`).join('\n');
}

/**
 * @typedef {MTIType|MTIArrayType|MTIPrimitiveType} Type
 * @typedef {'class'|'interface'|'enum'|'@interface'|'primitive'|'array'} MTITypeKind
 */

 /**
  * MinifiableInfo is the base class that stores the raw object
  * containing type information
  */
class MinifiableInfo {

    constructor(minified) {
        this.minified = minified;
    }

    /**
     * Format a commented form of docs with a newline at the end.
     */
    fmtdocs() {
        // the docs field is always d in the minified objects
        const d = this.minified.d;
        return d ? `/**\n * ${d.replace(/\n/g,'\n *')}\n */\n` : '';
    }
}

class MTITypeBase extends MinifiableInfo {
    /**
     * type docs
     * @type {string}
     */
    get docs() { return this.minified.d }
    
    /**
     * type modifiers
     * @type {number}
     */
    get modifiers() { return this.minified.m }

    /**
     * type name (in x$y format for enclosed types)
     * @type {string}
     */
    get name() { return this.minified.n }

    /**
     * package this type belongs to
     */
    get package() { return null }

    /**
     * @type {MTIConstructor[]}
     */
    get constructors() { return [] }

    /**
     * @type {MTIField[]}
     */
    get fields() { return [] }

    /**
     * @type {MTIMethod[]}
     */
    get methods() { return [] }

    /**
     * @type {ReferencedType[]}
     */
    get typevars() { return [] }

    /**
     * @param {string} name 
     */
    hasModifier(name) {
        return ((this.minified.m | 0) & getModifierBit(name)) !== 0;
    }

    toSource() {
        return this.name;
    }
}

class MTIArrayType extends MTITypeBase {
    /**
     * @param {Type} element_type 
     */
    constructor(element_type) {
        super({
            n: element_type.name + '[]',
            d: '',
            m: 0,   // should array types be implicitly final?
        });
        this.element_type = element_type;
    }

    get fullyDottedRawName() { return `${this.element_type.fullyDottedRawName}[]` }

    /** @type {MTITypeKind} */
    get typeKind() { return 'array' }
}

class MTIPrimitiveType extends MTITypeBase {

    static _cached = new Map();
    static fromName(name) {
        let value = MTIPrimitiveType._cached.get(name);
        if (!value) {
            value = new MTIPrimitiveType({
                n: name,
                d: '',
                m: 0,
            });
            MTIPrimitiveType._cached.set(name, value);
        }
        return value;
    }
    
    get fullyDottedRawName() { return this.name }

    /** @type {MTITypeKind} */
    get typeKind() { return 'primitive' }
}

/**
 * MTIType encodes a complete type (class, interface or enum)
 * ```
 * {
 *   d: string - type docs
 *   p: pkgref - the package this type belongs to
 *   n: string - type name (in x$y format for enclosed types)
 *   v: typeref[] - generic type variables
 *   e: typeref | typeref[] - super/extends type (single value for classes, array for interfaces)
 *   i: typeref[] - interface types
 *   f: mtifield[] - fields
 *   c: mtictrs[] - constructors
 *   g: mtimethod[] - methods
 *   y: string[] - referenced packages
 *   z: [] - referenced types
 * }
 * ```
 */
class MTIType extends MTITypeBase {

    /**
     * @param {*} mti 
     */
    constructor(mti) {
        super(mti);
        this.referenced = {
            types: [],
            packages: mti.y,
        }
        for (let reftype of mti.z) {
            this.referenced.types.push(new ReferencedType(this, reftype))
        }
        this.parsed = {
            package: getPackageName(mti.p, this),
            
            /** @type {ReferencedType[]} */
            typevars: mti.v.map(v => getReferencedType(v, this)),

            /** @type {ReferencedType|ReferencedType[]} */
            extends: Array.isArray(mti.e)
                ? mti.e.map(e => getReferencedType(e, this))
                : getReferencedType(mti.e, this),

            /** @type {ReferencedType[]} */
            implements: mti.i.map(i => getReferencedType(i, this)),

            /** @type {MTIField[]} */
            fields: mti.f.map(f => new MTIField(this, f)),

            /** @type {MTIConstructor[]} */
            constructors: mti.c.map(c => new MTIConstructor(this, c)),

            /**
             * MTI method are grouped by name - we split them here 
             * @type {MTIMethod[]}
             */
            methods: mti.g.reduce((arr, m) => [...arr, ...MTIMethod.split(this, m)], []),
        }
    }

    /**
     * @param {string} package_name
     * @param {string} docs
     * @param {string[]} modifiers 
     * @param {'class'|'enum'|'interface'|'@interface'} typeKind 
     * @param {string} qualified_name 
     */
    static newType(package_name, docs, modifiers, typeKind, qualified_name) {
        const mti = {
            d: docs,
            p: null,
            m: getTypeMods(modifiers, typeKind),
            n: qualified_name.replace(/\./g,'$'),
            v: [],
            e: null,
            i: [],
            f: [],
            c: [],
            g: [],
            y: [],
            z: [],
        }

        let pkg_ref = KnownPackages.indexOf(package_name);
        if (pkg_ref < 0) {
            mti.p = 16 - 1 + mti.y.push(package_name);
        } else {
            mti.p = pkg_ref;
        }

        switch (true) {
            case /interface/.test(typeKind):
                mti.e = [];
                break;
            case typeKind === 'enum':
                // enum X extends Enum<X> {}
                mti.z.push({
                    n: mti.n,
                    p: mti.p,
                })
                mti.e = 16  - 1 + mti.z.push({
                    n: KnownTypeNames.indexOf('Enum'),
                    g: [16],
                });
                break;
            default:
                mti.e = KnownTypeNames.indexOf("Object");
                break;
        }

        return new MTIType(mti);
    }
  
    /**
     * Unpack all the classes from the given JSON
     * @param {string} filename 
     */
    static unpackJSON(filename) {
        const pkg_type_map = JSON.parse(require('fs').readFileSync(filename, 'utf8'));
        delete pkg_type_map.NOTICES;
        const types = [];
        for (let pkg in pkg_type_map) {
            for (let type in pkg_type_map[pkg]) {
                const mti = new MTIType(pkg_type_map[pkg][type]);
                types.push(mti);
            }
        }
        return {
            packages: Object.keys(pkg_type_map).sort(),
            types: types.sort((a,b) => a.minified.n.localeCompare(b.minified.n)),
        }
    }

    get dottedRawName() { return this.minified.n.replace(/[$]/g, '.') };

    get fullyDottedRawName() {
        const pkg = this.package;
        return pkg ? `${pkg}.${this.dottedRawName}` : this.dottedRawName;
    };

    get dottedName() {
        const t = this.typevars.map(t => t.name).join(',');
        return t ? `${this.dottedRawName}<${t}>` : this.dottedRawName;
    };

    /**
     * type name with no qualifiers
     * @type {string}
     */
    get simpleRawName() { return this.minified.n.match(/[^$]+$/)[0] }

    /**
     * package this type belongs to
     */
    get package() { return this.parsed.package }

    /** @type {MTITypeKind} */
    get typeKind() {
        const m = this.minified.m;
        return (m & TypeModifiers.enum)
            ? 'enum' : (m & TypeModifiers.interface)
            ? 'interface' : (m & TypeModifiers['@interface'])
            ? '@interface' : 'class';
    }

    /**
     * generic type variables
     */
    get typevars() { return this.parsed.typevars }

    /**
     * class or interface extends.
     * Note that classes have a single extend type, but interfaces have an array.
     */
    get extends() { return this.parsed.extends }

    /**
     * class implements
     */
    get implements() { return this.parsed.implements }

    /**
     * @type {MTIConstructor[]}
     */
    get constructors() { return this.parsed.constructors }

    /**
     * @type {MTIField[]}
     */
    get fields() { return this.parsed.fields }

    /**
     * @type {MTIMethod[]}
     */
    get methods() { return this.parsed.methods }

    toSource() {
        let constructors = [], typevars = '', ex = '', imp = '';

        // only add constructors if there's more than just the default constructor
        if (!((this.constructors.length === 1) && (this.constructors[0].parameters.length === 0))) {
            constructors = this.constructors;
        }

        if (this.typevars.length) {
            typevars = `<${this.typevars.map(tv => tv.name).join(',')}>`;
        }

        if (this.extends) {
            // only add extends if it's not derived from java.lang.Object
            if (this.extends !== KnownReferencedTypes[3]) {
                const x = Array.isArray(this.extends) ? this.extends : [this.extends];
                if (x.length) {
                    ex = `extends ${x.map(type => type.dottedName).join(', ')} `;
                }
            }
        }

        if (this.implements.length) {
            imp = `implements ${this.implements.map(type => type.dottedName).join(', ')} `;
        }

        return [
            `${this.fmtdocs()}${typemods(this.modifiers)} ${this.simpleRawName}${typevars} ${ex}${imp}{`,
            ...this.fields.map(f => indent(f.toSource())),
            ...constructors.map(c => indent(c.toSource())),
            ...this.methods.map(m => indent(m.toSource())),
            `}`
        ].join('\n');
    }

    /**
     * @param {MTIType} mti
     * @param {number} typeref 
     */
    setExtends(mti, typeref) {
        if (Array.isArray(this.minified.e)) {
            this.minified.e.push(typeref);
            // @ts-ignore
            this.parsed.extends.push(getReferencedType(typeref, mti));
        } else {
            this.minified.e = typeref;
            this.parsed.extends = getReferencedType(typeref, mti);
        }
    }

    /**
     * @param {MTIType} mti 
     * @param {string} docs 
     * @param {string[]} modifiers 
     * @param {number} typeref 
     * @param {string} name 
     */
    addField(mti, docs, modifiers, typeref, name) {
        const o = {
            d: docs,
            m: getAccessMods(modifiers),
            n: name,
            t: typeref,
        }
        this.minified.f.push(o);
        this.parsed.fields.push(new MTIField(mti, o));
    }

    /**
     * @param {MTIType} mti 
     * @param {string} docs 
     * @param {string[]} modifiers 
     */
    addConstructor(mti, docs, modifiers) {
        const o = {
            d: docs,
            m: getAccessMods(modifiers),
            p: [],
        }
        this.minified.c.push(o);
        const c = new MTIConstructor(mti, o);
        this.parsed.constructors.push(c);
        return c;
    }

    /**
     * @param {string} docs 
     * @param {string[]} modifiers 
     * @param {number} typeref 
     * @param {string} name 
     */
    addMethod(docs, modifiers, typeref, name) {
        let g = this.minified.g.find(m => m.name === name);
        if (!g) {
            g = {
                n:name,
                s: [],
            }
            this.minified.g.push(g);
        }
        const o = {
            d: docs,
            m: getAccessMods(modifiers),
            t: typeref,
            p: [],
        };
        g.s.push(o);
        const method = new MTIMethod(this, name, o);
        this.parsed.methods.push(method);
        return method;
    }
}

/**
 * MTIField encodes a single type field.
 * ```
 * {
 *   d: string - docs
 *   m: number - access modifiers
 *   n: string - field name
 *   t: typeref - field type
 * }
 * ```
 */
class MTIField extends MinifiableInfo {

    /**
     * @param {MTIType} owner 
     * @param {*} mti 
     */
    constructor(owner, mti)  {
        super(mti);
        this.parsed = {
            type: getReferencedType(mti.t, owner),
        };
    }

    /**
     * @type {number}
     */
    get modifiers() { return this.minified.m }

    /**
     * @type {string}
     */
    get docs() { return this.minified.d }

    /**
     * @type {string}
     */
    get name() { return this.minified.n }

    /**
     * @type {ReferencedType}
     */
    get type() { return this.parsed.type }

    toSource() {
        return `${this.fmtdocs()}${access(this.modifiers)}${this.type.dottedName} ${this.name} = ${this.type.defaultValue};`
    }
}

class MTIMethodBase extends MinifiableInfo {}

/**
 * MTIContructor encodes a single type constructor.
 * ```
 * {
 *   d: string - docs
 *   m: number - access modifiers
 *   p: mtiparam[] - constructor parameters
 * }
 * ```
 */
class MTIConstructor extends MTIMethodBase {

    /**
     * @param {MTIType} owner
     * @param {*} mti 
     */
    constructor(owner, mti)  {
        super(mti);
        this.parsed = {
            typename: owner.minified.it[0].n,
            /** @type {MTIParameter[]} */
            parameters: mti.p.map(p => new MTIParameter(owner, p)),
        }
    }

    /**
     * @type {number}
     */
    get modifiers() { return this.minified.m }

    get docs() { return this.minified.d }

    /**
     * @type {MTIParameter[]}
     */
    get parameters() { return this.parsed.parameters }

    toSource() {
        const typename = this.parsed.typename.split('$').pop();
        return `${this.fmtdocs()}${access(this.modifiers)}${typename}(${this.parameters.map(p => p.toSource()).join(', ')}) {}`
    }

    /**
     * @param {MTIType} mti 
     * @param {string[]} modifiers 
     * @param {number} typeref 
     * @param {string} name 
     */
    addParameter(mti, modifiers, typeref, name) {
        const o = {
            m: getAccessMods(modifiers),
            t: typeref,
            n: name,
        }
        this.minified.p.push(o);
        this.parsed.parameters.push(new MTIParameter(mti, o));
    }
}

/**
 * MTIMethod encodes a single type method.
 * 
 * In minified form, methods are encoded as overloads - each entry
 * has a single name with one or more method signatures.
 * ```
 * {
 *   d: string - docs
 *   n: string - method name
 *   s: [{
 *         m: number - access modifiers
 *         t: typeref - return type
 *         p: mtiparam[] - method parameters
 *      },
 *      ...
 *   ]
 *  
 * }
 * ```
 */
 class MTIMethod extends MTIMethodBase {

    /**
     * @param {MTIType} type
     * @param {string} name
     * @param {*} mti 
     */
    constructor(type, name, mti)  {
        super(mti);
        this.interfaceMethod = type.modifiers & 0x200;
        this.parsed = {
            name,
            /** @type {MTIParameter[]} */
            parameters: mti.p.map(p => new MTIParameter(mti, p)),
            /** @type {ReferencedType} */
            return_type: getReferencedType(mti.t, mti),
        }
    }

    /**
     * @param {MTIType} type
     * @param {*} mti 
     */
    static split(type, mti) {
        return mti.s.map(s => new MTIMethod(type, mti.n, s));
    }

    /**
     * @type {string}
     */
    get docs() { return this.minified.d }

    /**
     * @type {number}
     */
    get modifiers() { return this.minified.m }

    /**
     * @type {ReferencedType}
     */
    get return_type() { return this.parsed.return_type }

    /**
     * @type {string}
     */
    get name() { return this.parsed.name }

    /**
     * @type {MTIParameter[]}
     */
    get parameters() { return this.parsed.parameters }

    toDeclSource() {
        return `${this.return_type.dottedName} ${this.name}(${this.parameters.map(p => p.toSource()).join(', ')})`;
    }    

    toSource() {
        let m = this.modifiers, body = ' {}';
        if (m & 0x400) {
            body = ';'; // abstract method - no body
        } else if (this.return_type.name !== 'void') {
            body = ` { return ${this.return_type.defaultValue}; }`;
        }
        if (this.interfaceMethod) {
            m &= ~0x400;    // exclude abstract modifier as it's redundant
        }
        return `${this.fmtdocs()}${access(m)}${this.return_type.dottedName} ${this.name}(${this.parameters.map(p => p.toSource()).join(', ')})${body}`
    }

    /**
     * @param {MTIType} mti 
     * @param {string[]} modifiers 
     * @param {number} typeref 
     * @param {string} name 
     */
    addParameter(mti, modifiers, typeref, name) {
        const o = {
            m: getAccessMods(modifiers),
            t: typeref,
            n: name,
        }
        this.minified.p.push(o);
        this.parsed.parameters.push(new MTIParameter(mti, o));
    }
}

/**
 * MTIParameter encodes a single method or constructor paramter
 * ```
 * {
 *   m?: number - access modifiers (only 'final' is allowed)
 *   t: typeref - parameter type
 *   n: string - parameter name
 * }
 * ```
 */
class MTIParameter extends MinifiableInfo {

    /**
     * @param {MTIType} owner 
     * @param {*} mti 
     */
    constructor(owner, mti) {
        super(mti);
        this.parsed = {
            type: getReferencedType(mti.t, owner)
        }
    }

    /**
     * @type {number}
     */
    get modifiers() { return this.minified.m | 0 }

    /**
     * @type {string}
     */
    get name() { return this.minified.n }

    /**
     * @type {ReferencedType}
     */
    get type() { return this.parsed.type }

    toSource() {
        return `${access(this.modifiers)}${this.type.dottedName} ${this.name}`
    }
}



/**
 * A ReferencedType encodes a type used by a class, interface or enum.
 * ```
 * {
 *      n: string | typeref - name or raw typeref (for arrays and generic types)
 *      p?: pkgref - package the type is declared in (undefined for primitives)
 *      g?: typeref[] - type arguments
 *      a?: number - array dimensions
 * }
 * ```
 * 
 * A typeref value < 16 is a lookup into the KnownTypes array.
 * 
 * All other types have a typeref >= 16 and an associated package reference.
 * 
 * The packageref is a lookup into the MTIs pt array which lists package names.
 */
class ReferencedType extends MinifiableInfo {

    /**
     * @param {MTIType} type
     * @param {*} mti 
     * @param {string|false} [pkg_or_prim] predefined package name, an empty string for default packages or false for primitives
     * @param {*} [default_value] 
     */
    constructor(type, mti, pkg_or_prim, default_value = null) {
        super(mti);
        let baseType;
        if (typeof mti.n === 'number') {
            baseType = getReferencedType(mti.n, type);
        }
        this._parsed = {
            package: pkg_or_prim 
                || ((pkg_or_prim === false) 
                    ? undefined 
                    : baseType ? baseType.package
                    : getPackageName(mti.p, type)
                    ),

            /** @type {ReferencedType} */
            baseType,

            /** @type {ReferencedType[]} */
            typeArgs: mti.g && mti.g.map(t => getReferencedType(t, type)),

            /** @type {string} */
            arr: '[]'.repeat(mti.a | 0),
        }
        this.defaultValue = default_value;
    }

    get isPrimitive() { return this._parsed.package === undefined }

    get package() { return this._parsed.package }

    get name() {
        // note: names in enclosed types are in x$y format
        const n = this._parsed.baseType ? this._parsed.baseType.name : this.minified.n;
        const type_args = this._parsed.typeArgs
            ? `<${this._parsed.typeArgs.map(tp => tp.name).join(',')}>`
            : ''
        return `${n}${type_args}${this._parsed.arr}`;
    }

    get typeArgs() { return this._parsed.typeArgs }

    get dottedName() {
        return this.name.replace(/[$]/g, '.');
    }
}

const access_keywords = 'public private protected static final synchronized volatile transient native interface abstract strict'.split(' ');

/**
 * @param {number} modifier_bits 
 */
function access(modifier_bits) {
    // convert the modifier bits into keywords
    const decls = access_keywords.filter((_,i) => modifier_bits & (1 << i));
    if (decls.length) {
        decls.push(''); // make sure we end with a space
    }
    return decls.join(' ');
}

/**
 * @param {string} modifier 
 */
function getModifierBit(modifier) {
    const i = access_keywords.indexOf(modifier);
    return i < 0 ? 0 : (1 << i);
}

/**
 * @param {string[]} modifiers 
 * @param {boolean} [varargs] 
 */
function getAccessMods(modifiers, varargs = false) {
    let m = 0;
    modifiers.forEach(modifier => m |= getModifierBit(modifier));
    if (varargs) {
        m |= getModifierBit('transient');
    }
    return m;
}

const TypeModifiers = {
    public:       0b0000_0000_0000_0001,    // 0x1
    final:        0b0000_0000_0001_0000,    // 0x10
    interface:    0b0000_0010_0000_0000,    // 0x200
    abstract:     0b0000_0100_0000_0000,    // 0x400
    '@interface': 0b0010_0000_0000_0000,    // 0x2000
    enum:         0b0100_0000_0000_0000,    // 0x4000
}

/**
 * @param {number} modifier_bits 
 */
function typemods(modifier_bits) {
    const modifiers = [];
    let type = 'class';
    if (modifier_bits & TypeModifiers.interface) {
        type = 'interface';
        modifier_bits &= ~TypeModifiers.abstract;    // ignore abstract keyword for interfaces
    } else if (modifier_bits & TypeModifiers['@interface']) {
        type = '@interface';
    } else if (modifier_bits & TypeModifiers.enum) {
        type = 'enum';
        modifier_bits &= ~TypeModifiers.final;    // ignore final keyword for enums
    }
    if (modifier_bits & TypeModifiers.public) modifiers.push('public');
    if (modifier_bits & TypeModifiers.final) modifiers.push('final');
    if (modifier_bits & TypeModifiers.abstract) modifiers.push('abstract');
    modifiers.push(type);
    return modifiers.join(' ');
}

/**
 * @param {string[]} modifiers 
 * @param {MTITypeKind} typeKind 
 */
function getTypeMods(modifiers, typeKind) {
    let m = 0;
    if (modifiers.includes('public')) m |= TypeModifiers.public;
    if (modifiers.includes('final')) m |= TypeModifiers.final;
    if (modifiers.includes('abstract')) m |= TypeModifiers.abstract;
    switch (typeKind) {
        case "interface": 
            m |= TypeModifiers.interface | TypeModifiers.abstract;
            break;
        case "@interface": 
            m |= TypeModifiers['@interface'] | TypeModifiers.abstract;
            break;
        case "enum": 
            m |= TypeModifiers.enum | TypeModifiers.final;
            break;
    }
    return m;
}

/**
 * List of known/common packages.
 * These are used/encoded as pkgrefs between 0 and 15.
 */
const KnownPackages = ["java.lang","java.io","java.util",""];

/**
 * Literals corresponding to the KnownTypes.
 * These are used for method return values and field expressions when constructing source.
 */
const KnownTypeValues = ['','0','""','null','false',"'\\0'",'0','0l','0','0.0f','0.0d','null','null'];

/**
 * List of known/common types.
 * These are used/encoded as typerefs between 0 and 15.
 */
const KnownTypeNames = [
    "void","int","String","Object","boolean","char","byte","long","short","float","double","Class","Enum"
];
const KnownReferencedTypes = KnownTypeNames
    .map((n,i) => {
        const pkg_or_prim = /^[SOCE]/.test(n) ? KnownPackages[0] : false;
        return new ReferencedType(null, {n}, pkg_or_prim, KnownTypeValues[i]);
    });

module.exports = {
    MTIType,
    MTIArrayType,
    MTIPrimitiveType,
}
