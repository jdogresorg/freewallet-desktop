/* 
 * nwjs builder script
 */
import nwbuilder from 'nw-builder';

async function init(){

  var nw = await nwbuilder({
      srcDir: './build/**', // use the glob format
      platform: "win",
      arch: "x64",
      cacheDir: './cache',
      outDir: './builds/',
      icon:  './build/images/FreeWallet.icns',
      // macCredits: './build/html/credits.html' //no longer exists
      // winIco: '', //no longer exists
  });

  // Output logs to the console
  //nw.on('log',  console.log); //This event no longer exists

  console.log('all done!');  
}

init()
