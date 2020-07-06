const path = require('path');
const { loadJavaLibraryCacheFile } = require('../android-library');

const test_cache_file = path.join(__dirname, 'test-cache.zip');

async function run() {
    await loadJavaLibraryCacheFile(test_cache_file, null);
    await loadJavaLibraryCacheFile(test_cache_file, ['androidx.cardview:cardview']);
    await loadJavaLibraryCacheFile(test_cache_file, ['androidx.annotation:annotation']);
}

run();
