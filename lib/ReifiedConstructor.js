const { JavaType, NullType, TypeVariableType } = require("./JavaType");
const { ArrayJavaType } = require("./ArrayType");
const { Constructor } = require("./Constructor");
const { Parameter } = require("./Parameter");
const { TypeVariable } = require("./TypeVariable");

class ReifiedConstructor extends Constructor {
    /**
     * @param {Constructor} parameterized_ctr
     * @param {Parameter[]} params
     * @param {TypeVariable[]} typevars
     */
    constructor(parameterized_ctr, params, typevars) {
        super(parameterized_ctr.owner, parameterized_ctr.modifiers, parameterized_ctr.docs);
        this._params = params;
        this._typeVariables = typevars;
    }

    get parameters() {
        return this._params;
    }

    get typeVariables() {
        return this._typeVariables;
    }

    /**
     * @param {Constructor} ctr
     * @param {import('./JavaType').JavaType[]} arg_types
     */
    static build(ctr, arg_types) {
        /** @type {Map<string, JavaType>} */
        const reifiedMap = new Map();

        // convert parameter types
        const params = ctr.parameters.map((p, idx) => {
            return new Parameter(p.name, reifyType(p.type, arg_types[idx]), p.varargs);
        });

        // some variables may not be reified. This happens when:
        // - null is passed as an argument which cannot be resolved to a specific type
        // - there are too few arguments passed
        const remaining_typevars = ctr.typeVariables.filter(tv => !reifiedMap.has(tv.name));

        return new ReifiedConstructor(ctr, params, remaining_typevars);

        /**
         * @param {JavaType} type
         * @param {JavaType} arg_type
         */
        function reifyType(type, arg_type) {
            if (type instanceof ArrayJavaType) {
                // type-variable arrays must be matched with array-type arguments (or null)
                if (arg_type instanceof ArrayJavaType) {
                    return new ArrayJavaType(reifyType(type.base, arg_type.base), type.arrdims);
                }
                if (arg_type instanceof NullType) {
                    return new ArrayJavaType(reifyType(type.base, arg_type), type.arrdims);
                }
                return type;
            }
            if (!(type instanceof TypeVariableType)) {
                return type;
            }
            const reified_type = reifiedMap.get(type.name);
            if (reified_type) {
                return reified_type;
            }
            if (arg_type instanceof NullType) {
                // if the argument is null, we cannot reify it because it is compatible with all type 
                // variables (they must be reference types)
                return type;
            }
            if (!arg_type) {
                // too few arguments
                return type;
            }
            reifiedMap.set(type.name, arg_type);
            return arg_type;
        }
    }
}

exports.ReifiedConstructor = ReifiedConstructor;
