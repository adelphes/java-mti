const { Declaration }= require('./Declaration');
const { JavaType, CEIJavaType, CompiledJavaType } = require('./JavaType');
const { parseTypeVariables, splitTypeSignatureList } = require('./type-parser');
const { Parameter } = require('./Parameter');
const { TypeArgument, TypeVariable } = require('./TypeVariable');

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

class CompiledMethodBase extends MethodBase {
    /**
     * 
     * @param {CompiledJavaType} owner 
     * @param {*} m 
     */
    constructor(owner, m) {
        super(owner, m.mods.bits, m.docs);

        const sig_attr = m.attributes.find(a => a.name === 'Signature');
        this._signature = sig_attr && /T\w+;/.test(sig_attr.Signature) ? sig_attr.Signature : m.sig;
        const sigmatch = this._signature.match(/^(<.+>)?\((.*?)\)(.+)/);
        this._typevars = sigmatch[1] ? parseTypeVariables(sigmatch[1], owner) : [];
        this._paramtypes = splitTypeSignatureList(sigmatch[2]);
        this._returnTypeSignature = sigmatch[3];
        /** @type {string[]} */
        this._pnames = m.pnames || [];
        // (default interface methods are only detectable via the presence of a Code attribute)
        this._hasCodeAttribute = m.attributes.find(a => a.name === 'Code');
    }

    get hasImplementation() {
        return this._hasCodeAttribute;
    }

    get methodSignature() {
        if (this._typevars.length || this.owner.typeVariables.length) {
            const tvars = [...this._typevars, ...this.owner.typeVariables];
            const sig = this._signature.replace(/[BSIJFDCZV]|L.+?[<;]|T(\w+);/g, (_, tv_name) => {
                if (tv_name) {
                    const match = tvars.find(tv => tv.name === tv_name);
                    if (match instanceof TypeArgument) {
                        return match.type.typeSignature;
                    }
                }
                return _;
            })
            return sig;
        }
        return this._signature;
    }

    get parameters() {
        return this._paramtypes.map((typesig, i, arr) =>
            new Parameter(
                this._pnames[i] || `arg${i}`,
                this.owner.resolveType(typesig, this._typevars),
                (i === arr.length - 1) && this.modifiers.includes('transient')
            )
        );
    }

    get returnType() {
        return this.owner.resolveType(this._returnTypeSignature, this._typevars);
    }

    get typeVariables() {
        return this._typevars;
    }
}

exports.MethodBase = MethodBase;
exports.CompiledMethodBase = CompiledMethodBase;
