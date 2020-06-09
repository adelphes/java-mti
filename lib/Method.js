const { MethodBase, CompiledMethodBase } = require("./MethodBase");
const { CEIJavaType, CompiledJavaType } = require('./JavaType');

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
        const modlabel = this.getModifierLabel().replace(/transient /,'');
        return `${modlabel}${this.returnType.label} ${this.name}(${this.parameters.map(p => p.label).join(', ')})`;
    }
}

class CompiledMethod extends CompiledMethodBase {
    /**
     * @param {CompiledJavaType} owner
     * @param {{sig: string, name: string, mods: {bits: number}}} m
     */
    constructor(owner, m) {
        super(owner, m);
        this._m = m;
    }

    get label() {
        const modlabel = this.getModifierLabel().replace(/transient /,'');
        return `${modlabel}${this.returnType.label} ${this.name}(${this.parameters.map(p => p.label).join(', ')})`;
    }

    get name() {
        return this._m.name;
    }
}

exports.Method = Method;
exports.CompiledMethod = CompiledMethod;
