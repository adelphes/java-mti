const { TypeVariable } = require('./TypeVariable');

/**
 * Parses an extended-form type declaration signature
 * - this signature comes from an additional Signature attribute in the compiled type.
 * It is present for types that contain type variables or for types that use type arguments
 * in extends or implements clauses.
 * @param {import('./JavaType').JavaType} owner
 * @param {string} type_declaration_signature 
 */
function parseTypeDeclarationSignature(owner, type_declaration_signature) {
    /** @type {TypeVariable[]} */
    let typevars = [];
    if (type_declaration_signature.startsWith('<')) {
        // type variables are present - this is a special colon-delimited list
        //  - each type variable name are delimited by a colon:
        //      <T1:Ljava/lang/Object;T2:Ljava/lang/String;>
        // - but interface types have an additional leading-colon:
        //      <T::Ljava/lang/Comparable;:Ljava/lang/Serializable>
        let offset;
        // @ts-ignore
        [typevars, offset] = parseTypeVariableSignatureList(type_declaration_signature, owner);
        // strip the type vars section to leavce the superclasses list
        type_declaration_signature = type_declaration_signature.slice(offset);
    }
    // the remainder of the list (or the entire entry if there are no type variables)
    // are the list of types for extends and implements
    const superclasses = splitTypeSignatureList(type_declaration_signature);
    return {
        typevars,
        superclasses,
    }
}

/**
 * @param {string} type_variables_signature 
 * @param {import('./JavaType').CEIJavaType} owner
 */
function parseTypeVariables(type_variables_signature, owner) {
    const [typevars] = parseTypeVariableSignatureList(type_variables_signature, owner);
    return typevars;
}

/**
 * @param {RegExpExecArray} m 
 * @param {RegExp} re
 */
function baseType(m, re) {
    if (m[3]) {
        // primitive type
        return m[3];
    }
    if (m[4]) {
        // reference type
        if (m[4].endsWith('<')) {
            const genmarkers = /<|>(\.\w+)*[;<]/g;
            genmarkers.lastIndex = re.lastIndex;
            let balance = 1, input = m.input;
            for (let m; m = genmarkers.exec(input);) {
                if (m[0] === '<') {
                    balance++;
                } else {
                    if (m[0].endsWith('<'))
                        balance++;
                    if (--balance === 0) {
                        break;
                    }
                }
            }
            re.lastIndex = genmarkers.lastIndex;
            return input.slice(m.index, re.lastIndex);
        }
        return m[4];
    }
    if (m[5]) {
        // typeargs type
        return m[5];
    }
    if (m[6]) {
        // wildcard type
        return m[6];
    }
    throw new Error('bad type signature');
}

/**
 * @param {RegExpExecArray} m 
 * @param {RegExp} re
 */
function extractType(m, re) {
    let type = baseType(m, re);
    if (m[1]) {
        // array type
        type = `${m[1]}${type}`;
    }
    return type;
}

/**
 * @param {string} sig 
 * @param {import('./JavaType').CEIJavaType} owner
 * @returns {[TypeVariable[], number]}
 */
function parseTypeVariableSignatureList(sig, owner) {
    /** @type {TypeVariable[]} */
    const types = [];
    const re = /(?:\w+:)?:?(\[*)(([IJSBCFDZV])|(L.+?[<;])|(T\w+;)|(>))/g;
    for (let m; m = re.exec(sig); )  {
        if (m[6]) {
            // end of type variables
            return [types.reverse(), re.lastIndex];
        }
        if (/^\w+:/.test(m[0])) {
            // start of next type var
            types.unshift(new TypeVariable(owner, m[0].match(/\w+/)[0]))
        }
        const type = extractType(m, re);
        types[0].bounds.push(new TypeVariable.Bound(owner, type, /^(\w+:)?:/.test(m[0])));
    }
    throw new Error('unterminated type variables signature')
}

/**
 * @param {string} sig 
 */
function splitTypeSignatureList(sig) {
    /** @type {string[]} */
    const types = [];
    //const re = /(?:(\w+):)?(:?)(\[*)(([IJSBCFDZV])|(L.+?[<;])|(T\w+;))/g;
    const re = /(\[*)(([IJSBCFDZV])|(L.+?[<;])|(T\w+;)|([*]))/g;

    for (let m; m = re.exec(sig); ) {
        const type = extractType(m, re);
        if (!type) {
            throw new Error(`Unparseable signature list: ${sig}`);
        }
        types.push(type);
    }
    return types;
}

exports.parseTypeDeclarationSignature = parseTypeDeclarationSignature;
exports.parseTypeVariables = parseTypeVariables;
exports.splitTypeSignatureList = splitTypeSignatureList;
