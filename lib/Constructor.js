const { MethodBase, CompiledMethodBase } = require("./MethodBase");

class Constructor extends MethodBase {

    get label() {
        const modlabel = this.getModifierLabel().replace(/transient /,'');
        return `${modlabel}${this.returnType.label}(${this.parameters.map(p => p.label).join(', ')})`;
    }

}

class CompiledConstructor extends CompiledMethodBase {

    /**
     * 
     * @param {import('./JavaType').CompiledJavaType} owner 
     * @param {*} c 
     */
    constructor(owner, c) {
        super(owner, c);
    }

    get label() {
        const modlabel = this.getModifierLabel().replace(/transient /,'');
        // the returnType for constructors is 'void', so we need to manually specify the owner type name
        return `${modlabel}${this.owner.simpleTypeName}(${this.parameters.map(p => p.label).join(', ')})`;
    }
}

exports.Constructor = Constructor;
exports.CompiledConstructor = CompiledConstructor;
