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
        let type_label = this.type.label;
        if (this.varargs && type_label.endsWith('[]')) {
            // strip final array bounds from varargs type ident
            type_label = type_label.slice(0, -2);
        }
        return `${type_label}${this.varargs ? '...' : ''} ${this.name}`;
    }

    get type() {
        return this._type;
    }
}

exports.Parameter = Parameter;
