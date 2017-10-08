/* 
 * nwjs builder script
 */
var NwBuilder = require('nw-builder');
var nw = new NwBuilder({
    files: './build/**', // use the glob format
    platforms: ['osx64', 'win32', 'win64', 'linux32', 'linux64'],
    cacheDir: './cache',
    buildDir: './builds/',
    macIcns:  './build/images/FreeWallet.icns',
    // macCredits: './build/html/credits.html'
    // winIco: '',
});

// Output logs to the console
nw.on('log',  console.log);

// Build returns a promise
nw.build().then(function () {
   console.log('all done!');
}).catch(function (error) {
    console.error(error);
});