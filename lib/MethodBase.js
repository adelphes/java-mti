const { Declaration }= require('./Declaration');
const { JavaType, CEIJavaType} = require('./JavaType');
const { Parameter } = require('./Parameter');
const { TypeVariable } = require('./TypeVariable');

class MethodBase extends Declaration {

    /**
     * @param {CEIJavaType} owner 
     * @param {string[]|number} mods 
     * @param {string} docs 
     */
    constructor(owner, mods, docs) {
        super(mods, docs);
        this.owner = owner;
    }

    /**
     * Returns `true` if this method has an associated implementation.
     */
    get hasImplementation() {
        return !this.modifiers.includes('abstract');
    }

    /**
     * Returns `true` if this method is a variable arity method
     * 
     * e.g `void varity(int... args) {}`
     */
    get isVariableArity() {
        const params = this.parameters;
        return (params.length > 0) && params[params.length - 1].varargs;
    }

    get parameterCount() {
        return this.parameters.length;
    }

    /**
     * @returns {Parameter[]}
     */
    get parameters() {
        return [];
    }

    get methodSignature() {
        const typevars = this.typeVariables;
        const typevarsig = typevars[0] ? `<${typevars.map(tv => tv.signature).join('')}>` : '';
        return `${typevarsig}(${this.parameters.map(p => p.type.typeSignature).join('')})${this.returnType.typeSignature}`;
    }

    /**
     * @returns {JavaType}
     */
    get returnType() {
        return null;
    }

    /** 
     * @returns {TypeVariable[]}
     */
    get typeVariables() {
        return [];
    }
}

exports.MethodBase = MethodBase;
