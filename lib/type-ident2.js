const { RawTypeName } = require('./RawTypeName');
const { PrimitiveJavaType } = require('./JavaType');

/**
 * There are 5 classes of type identifiers: 
 *   - Primitive types - int
 *   - CEI types (classes, enums, interfaces and @interfaces) - Object
 *   - Generic CEI types (CEI types with type variables) - Comparable<String>
 *   - Array types - int[], Object[]
 *   - Type variable types - T, K, V
 */
class TypeIdent {

    get fullyDottedRawName() {
        return '';
    }

    get label() {
        return '';
    }

    static isPrimitiveTypeName(name) {
        return /^(int|long|short|byte|float|double|char|boolean|void)$/.test(name);
    }

    /**
     * @param {Map<string,import('./JavaType').JavaType>} map 
     * @returns {import('./JavaType').JavaType}
     */
    findImplementation(map) {
        return null;
    }
}

const primitiveNameMap = {
    'int': 'I',
    'long': 'J',
    'short': 'S',
    'byte': 'B',
    'float': 'F',
    'double': 'D',
    'char': 'C',
    'boolean': 'Z',
    'void': 'V',
};

class PrimitiveType extends TypeIdent {

    static map = {
        I: new PrimitiveType('I', 'int'),
        J: new PrimitiveType('J', 'long'),
        S: new PrimitiveType('S', 'short'),
        B: new PrimitiveType('B', 'byte'),
        F: new PrimitiveType('F', 'float'),
        D: new PrimitiveType('D', 'double'),
        C: new PrimitiveType('C', 'char'),
        Z: new PrimitiveType('Z', 'boolean'),
        V: new PrimitiveType('V', 'void'),
    }

    /**
     * @param {string} sig 
     * @returns {PrimitiveType}
     */
    static fromSignature(sig) {
        return PrimitiveType.map[sig];
    }

    /**
     * @param {string} name 
     */
    static fromName(name) {
        return PrimitiveType.fromSignature(primitiveNameMap[name]);
    }

    constructor(sig, name) {
        super();
        this.sig = sig;
        this.name = name;
    }

    get label() {
        return this.name;
    }

    get fullyDottedRawName() {
        return this.name;
    }

    get signature() {
        return this.sig;
    }

    findImplementation() {
        return PrimitiveJavaType.map[this.sig];
    }
}

class CEIType extends TypeIdent {
    /**
     * @param {string} short_signature 
     */
    constructor(short_signature) {
        super();
        this._name = new RawTypeName(short_signature);
    }

    get fullyDottedRawName() {
        return this._name.fullyDottedRawName;
    }

    get label() {
        return this._name.dottedTypeName;
    }

    get signature() {
        return `L${this._name.short_signature};`
    }

    /**
     * @param {Map<string,import('./JavaType').JavaType>} map 
     * @returns {import('./JavaType').JavaType}
     */
    findImplementation(map) {
        return map.get(this._name.short_signature);
    }
}

class GenericCEIType extends CEIType {
    /**
     * 
     * @param {string} name 
     * @param {(CEIType|GenericCEIType|ArrayType)[]} typeargs 
     */
    constructor(name, typeargs) {
        super(name);
        this.typeargs = typeargs;
    }

    get label() {
        return `${this._name.dottedTypeName}<${this.typeargs.map(ta => ta.label)}>`;
    }

    get signature() {
        return `L${this._name.short_signature}<${this.typeargs.map(ta => ta.signature)}>;`
    }
}

class ArrayType extends TypeIdent {
    /**
     * 
     * @param {PrimitiveType|CEIType|TypeVariableType} baseType 
     * @param {number} arrdims 
     */
    constructor(baseType, arrdims) {
        super();
        this.baseType = baseType;
        this.arrdims = arrdims;
    }
    
    get fullyDottedRawName() {
        return`${this.baseType.fullyDottedRawName}${'[]'.repeat(this.arrdims)}`
    }

    get label() {
        return`${this.baseType.label}${'[]'.repeat(this.arrdims)}`
    }

    get signature() {
        return`${'['.repeat(this.arrdims)}${this.baseType.signature}`
    }
}

class TypeVariableType extends TypeIdent {
    /**
     * @param {string} name 
     */
    constructor(name) {
        super();
        this.name = name;
    }

    get fullyDottedRawName() {
        return this.name;
    }

    get label() {
        return this.name;
    }

    get signature() {
        return`T${this.name};`
    }
}


module.exports = {
    ArrayType,
    CEIType,
    GenericCEIType,
    PrimitiveType,
    TypeIdent,
    TypeVariableType,
}
