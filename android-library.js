const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const JarClassDecoder = require('./lib/jartypedecoder');
const FJP = require('./lib/fjp');
const { CEIJavaType, CompiledJavaType } = require('./lib/JavaType');

/**
 * @typedef AndroidLibraryOpts
 * @property {string} api API level = e.g "android-25"
 * @property {string} [sdk_root] Android SDK folder - defaults to ANDROID_SDK env variable
 */

 /**
  * @param {string} cache_filename full path and name of the cache file (either JSON or zipped JSON)
  * @param {string[]} [zip_file_filter] set of names to match against files extracted from the zipped JSON
  * @param {Map<string,CEIJavaType>} [typemap] map to add the decoded types to
  * @return {Promise<Map<string,CEIJavaType>>}
  */
async function loadJavaLibraryCacheFile(cache_filename, zip_file_filter, typemap = new Map()) {

    function readManifest() {
        return new Promise((resolve, reject) => {
            fs.createReadStream(cache_filename)
                .pipe(unzipper.ParseOne(/^manifest\.json$/))
                .on('entry', entry => {
                    entry.buffer().then(buf => resolve(JSON.parse(buf.toString())))
                })
                .on('error', err => reject(err))
        });
    }


    const file_datas = await new Promise(async (resolve, reject) => {
        if (/\.zip$/i.test(cache_filename)) {

            /** @type {string[]} */
            let libs_with_dependencies = null;
            // if there's a filter, work out the set of libraries and their (recursive) dependencies
            if (zip_file_filter) {
                const manifest = await readManifest();
                libs_with_dependencies = [];
                function addlib(lib) {
                    if (libs_with_dependencies.includes(lib)) return;
                    libs_with_dependencies.push(lib);
                    if (!Array.isArray(manifest[lib])) return;
                    for (let dep of manifest[lib]) {
                        addlib(dep);
                    }
                }
                zip_file_filter.forEach(lib => addlib(lib));
            }

            /** @type {Promise<Buffer>[]} */
            const entries = [];
            fs.createReadStream(cache_filename)
                .pipe(unzipper.Parse())
                .on('entry', 
                    /** @param {unzipper.Entry} entry */
                entry => {
                    const ignore_entry = 
                        entry.type !== 'File'
                        || !entry.path.startsWith('cache/')
                        || !entry.path.endsWith('.json')
                        || (Array.isArray(libs_with_dependencies) && !libs_with_dependencies.find(filter => entry.path.includes(filter)))
                    if (ignore_entry) {
                        entry.autodrain();
                        return;
                    }
                    entries.push(entry.buffer());
                })
                .on('error', err => reject(new Error(`Unzip error: ${err.message}`)))
                .on('close', () => {
                    // each entry is a promise that resolves to a buffer
                    Promise.all(entries).then(resolve);
                });
        } else {
            fs.readFile(cache_filename, (err, data) => err ? reject(err) : resolve([data]));
        }
    });

    file_datas.forEach(file_data => {
        const decoded = JSON.parse(file_data.toString());

        if (!Array.isArray(decoded)) {
            throw new Error(`Cache data is not a JSON array`);
        }

        decoded.forEach(x => {
            const t = new CompiledJavaType(x, typemap);
            typemap.set(t.shortSignature, t);
        });
    });

    return typemap;
}

/**
  * @param {string} cache_filename full path and name of the cache file
  * @param {AndroidLibraryOpts} opts
  * @return {Promise<Map<string,CEIJavaType>>}
  */
 function createAndroidLibraryCacheFile(cache_filename, opts) {

    const {
        api,
        sdk_root = process.env['ANDROID_SDK'],
    } = opts;

    const jar = path.join(sdk_root, 'platforms', api, 'android.jar');
    const source_base = path.join(sdk_root, 'sources', api);

    return createJavaLibraryCacheFile(jar, source_base, cache_filename);
}

 /**
  * @param {string} jar_filepath
  * @param {string} source_base
  * @param {string} cache_filename full path and name of the cache file
  * @return {Promise<Map<string,CEIJavaType>>}
  */
 function createJavaLibraryCacheFile(jar_filepath, source_base, cache_filename) {

    let decoded = [];
    /** @type {Map<string, {} | Promise | null>} */
    const parsedTypeCache = new Map();

    let stream;
    if (/\.aar/i.test(jar_filepath)) {
        // extract classes.jar from the AAR archive
        stream = fs.createReadStream(jar_filepath)
            .pipe(unzipper.ParseOne(/classes.jar/))
    } else {
        stream = fs.createReadStream(jar_filepath);
    }

    const parsed_entries = [];
    return stream.pipe(unzipper.Parse())
            .on('entry', entry => parsed_entries.push(parse_jar_entry(entry)))
            .on('error', err => { throw new Error(`Unzip error: ${err.message}`) })
            .on('close', () => { })
            .promise()
            .then(async () => {
                // wait for all the entries to finish parsing
                await Promise.all(parsed_entries)
                fs.writeFileSync(cache_filename, JSON.stringify(decoded));
                const typemap = new Map();
                decoded.forEach(x => {
                    const t = new CompiledJavaType(x, typemap);
                    typemap.set(t.shortSignature, t);
                });
                return typemap;
            })

    /**
     * @param {unzipper.Entry} entry 
     */
    async function parse_jar_entry(entry) {
        const fileName = entry.path;
        // const type = entry.type; // 'Directory' or 'File'
        // const size = entry.vars.uncompressedSize; // There is also compressedSize;
        const name_match = fileName.match(/(.+\/[a-zA-Z_]\w*(\$[a-zA-Z_]\w*)*)\.class$/);
        if (name_match) {
            await Promise.all([
                entry.buffer(),
                getParsedType(source_base, name_match[1], parsedTypeCache),
            ]).then(([classbytes, parsed_type]) => {
                const decoded_type = JarClassDecoder.decode_class(classbytes, {});
                populateSourceInformation(decoded_type, parsed_type);
                decoded.push(decoded_type);
            });
        } else {
            await entry.autodrain();
        }
    }
}

/**
 * @param {string} source_base Android SDK sources folder
 * @param {string} short_signature typename in a/b/c/Type$Enc format
 * @param {Map} cache
 */
async function getParsedType(source_base, short_signature, cache) {
    // don't try and parse local and anonymous types
    if (/\$\d+[^$]*$/.test(short_signature)) {
        return null;
    }
    const [toptype, ...enctypes] = short_signature.split('$');
    let parsed = cache.get(toptype);
    if (!parsed) {
        const promise = parseSourceFile(source_base, toptype)
            .then(parsed => {
                cache.set(toptype, parsed);
                return getParsedType(source_base, short_signature, cache);
            });
        cache.set(toptype, promise);
        return promise;
    }
    if (parsed instanceof Promise) {
        await parsed;
        return getParsedType(source_base, short_signature, cache);
    }
    if (parsed instanceof Error) {
        return null;
    }
    // drill down to any required enclosed type
    let fqtn = toptype.replace(/\//g, '.');
    for (let enctype of enctypes) {
        fqtn += `.${enctype}`;
        const inner_type = parsed.decls.find(d => d.istype && d.fqtn === fqtn);
        if (!inner_type) {
            // enclosed type not found
            return null;
        }
        parsed = inner_type;
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
                parsed = FJP.java_to_json(src, filename);
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

exports.createAndroidLibraryCacheFile = createAndroidLibraryCacheFile;
exports.createJavaLibraryCacheFile = createJavaLibraryCacheFile;
exports.loadJavaLibraryCacheFile = loadJavaLibraryCacheFile;
