const { MethodBase } = require("./MethodBase");
const { parseTypeVariables, splitTypeSignatureList } = require('./type-parser');
const { Parameter } = require('./Parameter');
const { TypeArgument } = require('./TypeVariable');

class Constructor extends MethodBase {

    get label() {
        const modlabel = this.getModifierLabel().replace(/transient /,'');
        return `${modlabel}${this.owner.simpleTypeName}(${this.parameters.map(p => p.label).join(', ')})`;
    }

    get returnType() {
        return require('./JavaType').PrimitiveJavaType.map.V;
    }
}

class CompiledConstructor extends Constructor {

    /**
     * 
     * @param {import('./JavaType').CompiledJavaType} owner 
     * @param {*} c 
     */
    constructor(owner, c) {
        super(owner, c.mods.bits, c.docs);
        this._c = c;
        const sig_attr = c.attributes.find(a => a.name === 'Signature');
        this._signature = sig_attr && /T\w+;/.test(sig_attr.Signature) ? sig_attr.Signature : c.sig;
        const sigmatch = this._signature.match(/^(<.+>)?\((.*?)\)(.+)/);
        this._typevars = sigmatch[1] ? parseTypeVariables(sigmatch[1], owner) : [];
        this._paramtypes = splitTypeSignatureList(sigmatch[2]);
        /** @type {string[]} */
        this._pnames = c.pnames || [];
        this._codeAttribute = c.attributes.find(a => a.name === 'Code');
    }

    get hasImplementation() {
        return !!this._codeAttribute;
    }

    get isSynthetic() {
        return (this._c.mods.bits & 0x1000) !== 0;
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

    get typeVariables() {
        return this._typevars;
    }
}

exports.Constructor = Constructor;
exports.CompiledConstructor = CompiledConstructor;
