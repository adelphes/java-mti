
exports.loadAndroidLibrary = require('./android-library').loadAndroidLibrary;
exports.JavaType = require('./lib/JavaType').JavaType;
exports.PrimitiveType = require('./lib/JavaType').PrimitiveJavaType;
exports.ArrayType = require('./lib/JavaType').ArrayJavaType;
exports.CEIType = require('./lib/JavaType').CEIJavaType;
exports.UnresolvedType = require('./lib/JavaType').UnresolvedType;
exports.Method = require('./lib/Method').Method;
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
//     types.size;
// })
