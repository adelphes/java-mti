class Declaration {

    /**
     * @param {number|string[]} mods 
     * @param {string} [docs] 
     */
    constructor(mods, docs) {
        this.modifiers = Array.isArray(mods) ? mods : access(mods);
        this.docs = docs || '';
    }

    getModifierLabel() {
        return this.modifiers.map(m => `${m} `).join('');
    }
}

const access_keywords = 'public private protected static final synchronized volatile transient native interface abstract strict'.split(' ');

/**
 * @param {number} modifier_bits 
 */
function access(modifier_bits) {
    // convert the modifier bits into keywords
    const decls = access_keywords.filter((_,i) => modifier_bits & (1 << i));
    return decls;
}

exports.Declaration = Declaration;