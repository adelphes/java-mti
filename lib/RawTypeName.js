

class RawTypeName {
    /**
     * @param {string} short_signature signature without the leading L and trailing ;
     */
    constructor(short_signature) {
        this.short_signature = short_signature;
        this.typeSignature = `L${short_signature};`;
        this._nameparts = short_signature.match(/^(?:(.+?)[/$])?((\w+)(\$(\w+))*)$/);
    }
    get packageName() {
        return (this._nameparts[1] || '').replace(/\//g, '.');
    }
    /**
     * Single identifier name
     */
    get simpleTypeName() {
        // enclosed type name or top-level type name
        return this._nameparts[5] || this._nameparts[3];
    }
    /**
     * Dotted name excluding any package part
     */
    get dottedTypeName() {
        return this._nameparts[2].replace(/\$/g, '.');
    }
    /**
     * Dotted name, including package
     */
    get fullyDottedRawName() {
        // enclosed type name or top-level type name
        return this.short_signature.replace(/[$/]/g, '.');
    }
}

exports.RawTypeName = RawTypeName;
