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

/**
 * Represents a parameterised type variable declared for a class/interface
 * ```
 * class ArrayList<E>
 * ```
 * or a method
 * ```
 * <E> E get(int i) {}
 * ```
 */
class TypeVariable {

    /**
     * @param {import('./JavaType').CEIJavaType} owner
     * @param {string} name 
     * @param {TypeVariable.Bound[]} [bounds] 
     */
    constructor(owner, name, bounds = []) {
        this._owner = owner;
        this.name = name;
        this.bounds = bounds;
        this._tvtype = newTypeVariableType(this);
    }

    get label() {
        return this.name;
    }

    get signature() {
        return `T:${this.bounds.map(b => b.signature).join('')}`;
    }

    /** @type {import('./JavaType').JavaType} */
    get type() {
        return this._tvtype;
    }

    get boundedType() {
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

/**
 * Represents a concrete type assigned to a type variable.
 * ```
 * List<String>
 * ```
 * has a `String` TypeArgument
 */
class TypeArgument extends TypeVariable {
    /**
     * @param {import('./JavaType').CEIJavaType} owner 
     * @param {TypeVariable} typevar 
     * @param {import('./JavaType').JavaType} type 
     */
    constructor(owner, typevar, type) {
        super(owner, typevar.name, typevar.bounds.map(b => new TypeVariable.Bound(owner, b.type_signature, b.intf)));
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

/**
 * A subclass of TypeVariable whose type is allowed to be inferred.
 * 
 * Used with the diamond operator:
 * ```
 * ArrayList<String> x = new ArrayList<>();
 * ```
 * In the above assignment, the rhs has an ArrayList type with
 * inferred type arguments.
 */
class InferredTypeArgument extends TypeVariable {
    constructor(owner, typevar) {
        super(owner, typevar.name, typevar.bounds.map(b => new TypeVariable.Bound(owner, b.type_signature, b.intf)));
    }
}

exports.TypeVariable = TypeVariable;
exports.TypeArgument = TypeArgument;
exports.InferredTypeArgument = InferredTypeArgument;
