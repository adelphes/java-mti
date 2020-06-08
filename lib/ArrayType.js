const { JavaType, PrimitiveJavaType } = require('./JavaType');
const { Field } = require('./Field');

class ArrayLengthField extends Field {
    constructor() {
        super(['public'], '');
    }

    /**
     * The name of the field
     */
    get name() {
        return 'length';
    }

    /**
     * The field type
     * @returns {JavaType}
     */
    get type() {
        return PrimitiveJavaType.map.I;
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
        /**
         * The base type of the array.
         */
        this.base = base;
        /**
         * Number of array dimensions.
         * Eg. int[][] has arrdims = 2
         */
        this.arrdims = arrdims;
        this._arrprefix = '['.repeat(arrdims);
        this._arrsuffix = '[]'.repeat(arrdims);
        super.simpleTypeName = `${base.simpleTypeName}${this._arrsuffix}`;
        super.fields = [ new ArrayLengthField() ];
    }

    get dottedTypeName() {
        return `${this.base.dottedTypeName}${this._arrsuffix}`;
    }

    /**
     * The type representing each element of the array type
     */
    get elementType() {
        return this.arrdims === 1 ? this.base : new ArrayJavaType(this.base, this.arrdims - 1);
    }

    get fullyDottedRawName() {
        return `${this.base.fullyDottedRawName}${this._arrsuffix}`;
    }

    get fullyDottedTypeName() {
        return `${this.base.fullyDottedTypeName}${this._arrsuffix}`;
    }

    get label() {
        return `${this.base.label}${this._arrsuffix}`;
    }

    get rawTypeSignature() {
        return `${this._arrprefix}${this.base.rawTypeSignature}`;
    }

    get typeSignature() {
        return `${this._arrprefix}${this.base.typeSignature}`;
    }
}

exports.ArrayJavaType = ArrayJavaType;
