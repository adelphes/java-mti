let TypeVariableType = null;
/**
 * @param {TypeVariable} typeVariable
 * @returns {import('./JavaType').TypeVariableType} 
 */
function newTypeVariableType(typeVariable) {
    if (!TypeVariableType) {
        TypeVariableType = require('./JavaType').TypeVariableType;
    }
    return new TypeVariableType(typeVariable);
}

class TypeVariable {

    /**
     * @param {import('./JavaType').CEIJavaType} owner
     * @param {string} name 
     */
    constructor(owner, name) {
        this._owner = owner;
        this.name = name;
        /** @type {TypeVariable.Bound[]} */
        this.bounds = [];
        this._tvtype = newTypeVariableType(this);
    }

    get label() {
        return this.name;
    }

    get signature() {
        return `T:${this.bounds.map(b => b.signature).join('')}`;
    }

    get type() {
        // this is obviously wrong for now - the bound should be an intersection type
        if (this.bounds[0]) {
            return this.bounds[0].type;
        }
        return this._owner.resolveType('Ljava/lang/Object;');
    }

    get typeSignature() {
        return 'Ljava/lang/Object;';
    }

    static Bound = class Bound {
        /**
         * @param {import('./JavaType').CEIJavaType} owner
         * @param {string} signature 
         * @param {boolean} intf
         */
        constructor(owner, signature, intf) {
            this._owner = owner;
            this.type_signature = signature;
            this.intf = intf;
        }
        
        get kind() {
            return this.intf ? 'interface' : 'class';
        }

        get signature() {
            return `${this.intf ? ':' : ''}${this.type_signature}`;
        }

        get type() {
            return this._owner.resolveType(this.type_signature);
        }
    }
}

class TypeArgument extends TypeVariable {
    /**
     * @param {TypeVariable} typevar 
     * @param {import('./JavaType').JavaType} type 
     */
    constructor(typevar, type) {
        super(typevar._owner, typevar.name);
        super.bounds = typevar.bounds.slice();
        this._type = type;
    }

    get label() {
        return this._type.label;
    }

    get type() {
        return this._type;
    }

    get typeSignature() {
        return this._type.typeSignature;
    }
}

exports.TypeVariable = TypeVariable;
exports.TypeArgument = TypeArgument;
