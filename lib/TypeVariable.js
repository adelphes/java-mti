
class TypeVariable {

    /**
     * @param {string} name 
     */
    constructor(name) {
        this.name = name;
        /** @type {TypeVariable.Bound[]} */
        this.bounds = [];
    }

    get label() {
        return this.name;
    }

    get signature() {
        return `T:${this.bounds.map(b => b.signature).join('')}`;
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

        type() {
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
        super(typevar.name);
        super.bounds = typevar.bounds.slice();
        this.type = type;
    }

    get label() {
        return this.type.label;
    }

    get typeSignature() {
        return this.type.typeSignature;
    }
}

exports.TypeVariable = TypeVariable;
exports.TypeArgument = TypeArgument;
