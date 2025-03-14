/* 
 * nwjs builder script
 */
import nwbuilder from 'nw-builder';
import fs from 'fs';
import archiver from 'archiver';

const OUT_DIR = './builds/FreeWallet/'

async function zip(dir, zipFileName) {
    return new Promise((resolve, reject) => {
        let archiverZip = archiver('zip', { zlib: { level: 9 }});
        let fileStream = fs.createWriteStream(zipFileName);
  
        archiverZip.directory(dir, false).on('error', err => reject(err)).pipe(fileStream);

        fileStream.on('close', () => resolve());
        archiverZip.finalize();
    });
}

async function init(){

  /*************************
   *
   *WINDOWS x64
   *
   *************************/
  let osOutDir = "win64" 
  var nw = await nwbuilder({
      srcDir: './build/**', // use the glob format
      platform: "win",
      arch: "x64",
      cacheDir: './cache',
      outDir: OUT_DIR+osOutDir+"/",
      icon:  './build/images/FreeWallet.icns',
      // macCredits: './build/html/credits.html' //no longer exists
      // winIco: '', //no longer exists
  });

  //Zipping the package.nm file
  fs.renameSync(OUT_DIR+osOutDir+"/package.nw",OUT_DIR+osOutDir+"/package.bck.nw")
  await zip(OUT_DIR+osOutDir+"/package.bck.nw/build/", OUT_DIR+osOutDir+"/package.nw")
  fs.rmSync(OUT_DIR+osOutDir+"/package.bck.nw",{recursive:true})
  
  
  /*************************
   *
   *WINDOWS x32
   *
   *************************/
  osOutDir = "win32"  
  var nw = await nwbuilder({
      srcDir: './build/**', // use the glob format
      platform: "win",
      arch: "ia32",
      cacheDir: './cache',
      outDir: OUT_DIR+osOutDir+"/",
      icon:  './build/images/FreeWallet.icns',
      // macCredits: './build/html/credits.html' //no longer exists
      // winIco: '', //no longer exists
  });

  //Zipping the package.nm file
  fs.renameSync(OUT_DIR+osOutDir+"/package.nw",OUT_DIR+osOutDir+"/package.bck.nw")
  await zip(OUT_DIR+osOutDir+"/package.bck.nw/build/", OUT_DIR+osOutDir+"/package.nw")
  fs.rmSync(OUT_DIR+osOutDir+"/package.bck.nw",{recursive:true})
  
  /*************************
   *
   *LINUX x64
   *
   *************************/
  osOutDir = "linux64"  
  var nw = await nwbuilder({
      srcDir: './build/**', // use the glob format
      platform: "linux",
      arch: "x64",
      cacheDir: './cache',
      outDir: OUT_DIR+osOutDir+"/",
      icon:  './build/images/FreeWallet.icns',
      // macCredits: './build/html/credits.html' //no longer exists
      // winIco: '', //no longer exists
  });

  /*************************
   *
   *LINUX x32
   *
   *************************/
  osOutDir = "linux32"  
  var nw = await nwbuilder({
      srcDir: './build/**', // use the glob format
      platform: "linux",
      arch: "ia32",
      cacheDir: './cache',
      outDir: OUT_DIR+osOutDir+"/",
      icon:  './build/images/FreeWallet.icns',
      // macCredits: './build/html/credits.html' //no longer exists
      // winIco: '', //no longer exists
  });
  
  /*************************
   *
   *OSX x64
   *
   *************************/
  osOutDir = "osx64"  
  var nw = await nwbuilder({
      srcDir: './build/**', // use the glob format
      platform: "osx",
      arch: "x64",
      cacheDir: './cache',
      outDir: OUT_DIR+osOutDir+"/",
      icon:  './build/images/FreeWallet.icns',
      app: {
        LSApplicationCategoryType: "Finance",
        NSHumanReadableCopyright: "© 2025 Dankest. All Rights Reserved.",
        NSLocalNetworkUsageDescription: "FreeWallet uses local network to get balances of bitcoins and assets from a counterparty server and to broadcast transactions to a bitcoin node"
      }
      // macCredits: './build/html/credits.html' //no longer exists
      // winIco: '', //no longer exists
  });
  
}

init()