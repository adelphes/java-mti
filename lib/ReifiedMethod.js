const { JavaType, CEIJavaType, NullType, TypeVariableType } = require("./JavaType");
const { ArrayJavaType } = require("./ArrayType");
const { Method } = require("./Method");
const { Parameter } = require("./Parameter");
const { TypeVariable } = require("./TypeVariable");

class ReifiedMethod extends Method {
    /**
     * @param {Method} ptized_method
     * @param {Parameter[]} params
     * @param {JavaType} return_type
     * @param {TypeVariable[]} typevars
     */
    constructor(ptized_method, params, return_type, typevars) {
        super(ptized_method.owner, ptized_method.name, ptized_method.modifiers, ptized_method.docs);
        this._params = params;
        this._returnType = return_type;
        this._typeVariables = typevars;
    }
    get parameters() {
        return this._params;
    }
    get returnType() {
        return this._returnType;
    }
    get typeVariables() {
        return this._typeVariables;
    }
    /**
     * @param {Method} method
     * @param {import('./JavaType').JavaType[]} arg_types
     */
    static build(method, arg_types) {
        /** @type {Map<string, JavaType>} */
        const reifiedMap = new Map();

        // convert parameter types
        const params = method.parameters.map((p, idx) => {
            return new Parameter(p.name, reifyType(p.type, arg_types[idx]), p.varargs);
        });

        // the reified return type comes directly from the map
        const return_type = reifyTypeFromMap(method.returnType);

        // some variables may not be reified. This happens when:
        // - null is passed as an argument which cannot be resolved to a specific type
        // - there are too few arguments passed
        const remaining_typevars = method.typeVariables.filter(tv => !reifiedMap.has(tv.name));

        return new ReifiedMethod(method, params, return_type, remaining_typevars);

        function reifyTypeFromMap(type) {
            if (type instanceof ArrayJavaType) {
                if (type.base instanceof TypeVariableType) {
                    const reifed_type = reifiedMap.get(type.base.name);
                    if (reifed_type) {
                        return new ArrayJavaType(reifed_type, type.arrdims);
                    }
                }
            }
            if (type instanceof TypeVariableType) {
                const reifed_type = reifiedMap.get(type.name);
                if (reifed_type) {
                    return reifed_type;
                }
            }
            return type;
        }

        /**
         * @param {JavaType} type
         * @param {JavaType} arg_type
         */
        function reifyType(type, arg_type) {
            if (type instanceof ArrayJavaType) {
                if (type.base instanceof TypeVariableType) {
                    if (reifiedMap.has(type.base.name)) {
                        return new ArrayJavaType(reifiedMap.get(type.base.name), type.arrdims);
                    }
                }
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
                if (type instanceof CEIJavaType && arg_type instanceof CEIJavaType && type.typeVariables.length) {
                    const reified_type_args = [];
                    let i = 0;
                    for (let tv of type.typeVariables) {
                        const arg_tv = arg_type.typeVariables[i++];
                        if (!arg_tv) {
                            reified_type_args.push(tv.type);
                            continue;
                        }
                        const reified_type_arg = reifyType(tv.type, arg_tv.type);
                        reified_type_args.push(reified_type_arg);
                    }
                    return type.specialise(reified_type_args);
                }
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

exports.ReifiedMethod = ReifiedMethod;
