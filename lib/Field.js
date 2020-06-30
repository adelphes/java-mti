const { Declaration } = require('./Declaration');
const { JavaType, CompiledJavaType } = require('./JavaType');

class Field extends Declaration {

    /**
     * true if this field represents an Enum identifier
     */
    get isEnumValue() {
        return false;
    }

    get label() {
        return `${this.getModifierLabel()}${this.type.label} ${this.name}`;
    }

    /**
     * The name of the field
     */
    get name() {
        return '';
    }

    /**
     * The field type
     * @returns {JavaType}
     */
    get type() {
        return null;
    }
}

class CompiledField extends Field {
    /**
     * 
     * @param {CompiledJavaType} owner 
     * @param {*} f 
     */
    constructor(owner, f) {
        super(f.mods.bits, f.docs);
        this._f = f;
        this._owner = owner;
    }

    get isEnumValue() {
        return (this._f.mods.bits & 0x4000) !== 0;
    }
    
    get isSynthetic() {
        return (this._f.mods.bits & 0x1000) !== 0;
    }

    get name() {
        return this._f.name;
    }

    get type() {
        return this._owner.resolveType(this._f.type);
    }
}

exports.Field = Field;
exports.CompiledField = CompiledField;
