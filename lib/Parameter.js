const { JavaType } = require('./JavaType');

class Parameter {

    /**
     * @param {string} name 
     * @param {JavaType} type 
     * @param {boolean} varargs 
     */
    constructor(name, type, varargs) {
        this.name = name;
        this._type = type;
        this.varargs = varargs;
    }

    get label() {
        return `${this.type.label}${this.varargs ? '...' : ''} ${this.name}`;
    }

    get type() {
        return this._type;
    }
}

exports.Parameter = Parameter;
