/* 
 * nwjs builder script
 */
import nwbuilder from 'nw-builder';

async function init(){

  //var NwBuilder = require('nw-builder');
  var nw = await nwbuilder({
      srcDir: './build/**', // use the glob format
      platform: "win",
      arch: "x64",
      cacheDir: './cache',
      outDir: './builds/',
      icon:  './build/images/FreeWallet.icns',
      // macCredits: './build/html/credits.html'
      // winIco: '',
  });

  // Output logs to the console
  //nw.on('log',  console.log); //This event no longer exists

  console.log('all done!');  
}

init()
