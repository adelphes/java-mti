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
     * @param {JavaType} element_type 
     * @param {number} arrdims 
     */
    constructor(element_type, arrdims) {
        super("array", 0, '');
        /**
         * The base type of the array.
         */
        this.base = element_type;
        /**
         * Number of array dimensions.
         * Eg. int[][] has arrdims = 2
         */
        this.arrdims = arrdims;

        if (element_type instanceof ArrayJavaType) {
            // automatically normalise if the element type is also an array
            this.base = element_type.base;
            this.arrdims += element_type.arrdims;
        }

        this._arrprefix = '['.repeat(this.arrdims);
        this._arrsuffix = '[]'.repeat(this.arrdims);
        super.simpleTypeName = `${this.base.simpleTypeName}${this._arrsuffix}`;
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
