
exports.loadAndroidLibrary = require('./android-library').loadAndroidLibrary;
exports.JavaType = require('./lib/JavaType').JavaType;
exports.PrimitiveType = require('./lib/JavaType').PrimitiveJavaType;
exports.ArrayType = require('./lib/ArrayType').ArrayJavaType;
exports.CEIType = require('./lib/JavaType').CEIJavaType;
exports.UnresolvedType = require('./lib/JavaType').UnresolvedType;
exports.WildcardType = require('./lib/JavaType').WildcardType;
exports.signatureToType = require('./lib/JavaType').signatureToType;
exports.Method = require('./lib/Method').Method;
exports.MethodBase = require('./lib/MethodBase').MethodBase;
exports.Field = require('./lib/Field').Field;
exports.Constructor = require('./lib/Constructor').Constructor;
exports.Parameter = require('./lib/Parameter').Parameter;
exports.TypeVariable = require('./lib/TypeVariable').TypeVariable;
exports.TypeArgument = require('./lib/TypeVariable').TypeArgument;

// const { loadAndroidLibrary } = require('./android-library');
// const { CEIJavaType } = require('./lib/JavaType');

// const loadstart = Date.now();
// loadAndroidLibrary('android-25').then(types => {
//     // @ts-ignore
//     const packages = new Set([...types.values()].filter(t => t instanceof CEIJavaType).map(t => t.packageName));
//     console.log(`Loaded ${types.size} types from ${packages.size} packages in ${Date.now() - loadstart}ms`);
//     // const strarr = exports.signatureToType('java/util/ArrayList<Ljava/lang/String;>', types);
//     // const strarr2 = exports.signatureToType('java/util/ArrayList<Ljava/lang/String;>', types);
//     // const strarr3 = exports.signatureToType('jova/util/ArrayList', types);
//     types.size;
// })
