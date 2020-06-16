const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const JarClassDecoder = require('./lib/jartypedecoder');
const FJP = require('./lib/fjp');
const { CEIJavaType, CompiledJavaType } = require('./lib/JavaType');

function newTypeMap() {
    /** @type {Map<string,CEIJavaType>} */
    const typemap = new Map();
    // we used to automatically include primitive types here, but
    // the map uses short signatures (java/util/List) which results in
    // conflicts for classes with no packages.
    // eg. I = int or class I {}
    return typemap;
}

/**
 * @param {string} api API level = e.g "android-25"
 * @param {string} [sdk_root] Android SDK folder - defaults to ANDROID_SDK env variable
 * @param {boolean} [forceCacheRefresh] true if the cache file should be refreshed
 * @return {Promise<Map<string, CEIJavaType>>}
 */
async function loadAndroidLibrary(api, sdk_root = process.env['ANDROID_SDK'], forceCacheRefresh = false) {

    const cache_filename = path.join(`/tmp`,`decoded-jar-${api}.json`);
    if (!forceCacheRefresh) {
        try {
            const decoded = JSON.parse(require('fs').readFileSync(cache_filename, 'utf8'));
            const typemap = newTypeMap();
            decoded.forEach(x => {
                const t = new CompiledJavaType(x, typemap);
                typemap.set(t.shortSignature, t);
            });
            return typemap;
        } catch (err) {
            err;
        }
    }

    const jar = path.join(sdk_root, 'platforms', api, 'android.jar');
    const source_base = path.join(sdk_root, 'sources', api);
    if (!fs.existsSync(jar)) {
        // not much we can do if the JAR is not present
        return newTypeMap();
    }

    let decoded = [];
    /** @type {Map<string, {} | Promise | null>} */
    const parsedTypeCache = new Map();

    return new Promise((resolve, reject) => {
        fs.createReadStream(jar)
            .pipe(unzipper.Parse())
            .on('entry', parse_jar_entry)
            .on('error', err => reject(new Error(`Unzip error: ${err.message}`)))
            .on('close', () => {
                try {
                    fs.writeFileSync(cache_filename, JSON.stringify(decoded));
                } catch {};
                const typemap = newTypeMap();
                decoded.forEach(x => {
                    const t = new CompiledJavaType(x, typemap);
                    typemap.set(t.shortSignature, t);
                });
                return typemap;
            })
    })

    /**
     * @param {unzipper.Entry} entry 
     */
    function parse_jar_entry(entry) {
        const fileName = entry.path;
        // const type = entry.type; // 'Directory' or 'File'
        // const size = entry.vars.uncompressedSize; // There is also compressedSize;
        const name_match = fileName.match(/(.+\/\w+(\$\w+)*)\.class$/);
        if (name_match) {
            Promise.all([
                entry.buffer(),
                getParsedType(source_base, name_match[1], parsedTypeCache),
            ]).then(([classbytes, parsed_type]) => {
                const decoded_type = JarClassDecoder.decode_class(classbytes, {});
                populateSourceInformation(decoded_type, parsed_type);
                decoded.push(decoded_type);
            });
        } else {
            entry.autodrain();
        }
    }
}

/**
 * @param {string} source_base Android SDK sources folder
 * @param {string} short_signature typename in a/b/c/Type$Enc format
 * @param {Map} cache
 */
async function getParsedType(source_base, short_signature, cache) {
    const [toptype, ...enctypes] = short_signature.split('$');
    let parsed = cache.get(toptype);
    if (!parsed) {
        const parsed = parseSourceFile(source_base, toptype)
            .then(parsed => {
                cache.set(toptype, parsed);
                return getParsedType(source_base, short_signature, cache);
            });
        cache.set(toptype, parsed);
        return parsed;
    }
    if (parsed instanceof Promise) {
        parsed = await parsed;
    }
    if (parsed instanceof Error) {
        return null;
    }
    // drill down to any required enclosed type
    let fqtn = toptype.replace(/\//g, '.');
    for (let enctype of enctypes) {
        fqtn += `.${enctype}`;
        parsed = parsed.decls.find(d => d.istype && d.fqtn === fqtn);
        if (!parsed) {
            // enclosed type not found
            break;
        }
    }
    return parsed;
}

/**
 * 
 * @param {string} source_base 
 * @param {string} type_signature 
 * @returns {Promise<{} | Error>}
 */
function parseSourceFile(source_base, type_signature) {
    return new Promise(r => {
        const filename = path.join(source_base, `${type_signature}.java`);
        fs.readFile(filename, 'utf8', (err,src) => {
            if (err) {
                return r(err);
            }
            let parsed;
            try {
                parsed = FJP.java_to_json(src);
            } catch(e) {
                return r(new Error(`Unparseable source: ${filename}`));
            }
            // locate the type that matches the type signature
            const fqtn = type_signature.replace(/\//g,'.');
            const parsed_type = parsed.topleveltypes.find(t => t.fqtn === fqtn);
            r(parsed_type || new Error(`Type '${fqtn}' not found in source file`));
        })
    });
}

function populateSourceInformation(decoded_type, parsed_type) {
    if (!parsed_type) {
        return;
    }
    // set type docs
    decoded_type.docs = parsed_type.description;

    for (let decl of parsed_type.decls) {
        let match = findSourceDeclaration(decoded_type, decl);
        if (match) {
            // set declaration docs
            match.docs = decl.description;
            if (decl.ismethod || decl.isconstructor) {
                // set parameter names
                match.pnames = decl.parameters.map(p => p.name);
            }
        }
    }
}

function findSourceDeclaration(decoded_type, decl) {
    let match;
    if (decl.isfield) {
        match = decoded_type.fields.find(f => f.name === decl.name);
    } else if (decl.ismethod) {
        match = decoded_type.methods.find(m => m.name === decl.name && decl.sigre.test(m.sig));
    } else if (decl.isconstructor) {
        match = decoded_type.methods.find(m => m.name === "<init>" && decl.sigre.test(m.sig));
    }
    return match;
}


module.exports = {
    loadAndroidLibrary,
}
