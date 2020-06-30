/**
 * @typedef {import('./JavaType').CEIJavaType} CEIJavaType
 * @typedef {import('./JavaType').CompiledJavaType} CompiledJavaType
 */
const { MethodBase } = require("./MethodBase");
const { parseTypeVariables, splitTypeSignatureList } = require('./type-parser');
const { Parameter } = require('./Parameter');
const { TypeArgument } = require('./TypeVariable');

class Method extends MethodBase {

    /**
     * @param {CEIJavaType} owner
     * @param {string} name 
     * @param {number|string[]} mods 
     * @param {string} docs 
     */
    constructor(owner, name, mods, docs) {
        super(owner, mods, docs);
        this.name = name;
    }

    get label() {
        const label_modifiers = this.modifiers.filter(m => !/abstract|transient|native/.test(m));
        if (label_modifiers.length) {
            label_modifiers.push('');
        }
        return `${label_modifiers.join(' ')}${this.returnType.label} ${this.name}(${this.parameters.map(p => p.label).join(', ')})`;
    }

    get shortlabel() {
        return `${this.name}(${this.parameters.map(p => p.label).join(', ')}): ${this.returnType.simpleTypeName}`;
    }
}

class CompiledMethod extends Method {
    /**
     * 
     * @param {CompiledJavaType} owner 
     * @param {*} m 
     */
    constructor(owner, m) {
        super(owner, m.name, m.mods.bits, m.docs);

        this._m = m;
        const sig_attr = m.attributes.find(a => a.name === 'Signature');
        this._signature = sig_attr /* && /T\w+;/.test(sig_attr.Signature) */ ? sig_attr.Signature : m.sig;
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

    get isSynthetic() {
        return (this._m.mods.bits & 0x1000) !== 0;
    }

    get methodSignature() {
        if (this._typevars.length || this.owner.typeVariables.length) {
            const tvars = [...this._typevars, ...this.owner.typeVariables];
            const sig = this._signature.replace(/[BSIJFDCZV]|L.+?[<;]|T(\w+);/g, (_, tv_name) => {
                if (tv_name) {
                    const match = tvars.find(tv => tv.name === tv_name);
                    if (match instanceof TypeArgument) {
                        if (match.type instanceof require('./JavaType').WildcardType) {
                            return match.type.bound ? match.type.bound.type.typeSignature : 'Ljava/lang/Object;';
                        }
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

exports.Method = Method;
exports.CompiledMethod = CompiledMethod;
