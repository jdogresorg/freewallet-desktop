FreeWallet - Desktop Wallet
---
FreeWallet is a free wallet which supports Bitcoin and Counterparty.

Installation Instructions
---
```
Windows : Download FreeWallet.exe, run it, complete the installer.
Mac/OSX : Download FreeWallet.dmg, mount, and drag FreeWallet app to 'Applications' folder
Linux   : Download FreeWallet.tgz, extract it, run FreeWallet/install.sh
```

Build Notes
---
The majority of the building is done via nw-builder :

```shell
npm install nw-builder
```

Edit `build.sh` and change your Mac Developer Identity

Run `build.sh` to handle generating builds on Mac/OSX

Download and copy ffmpeg libraries to latest nwjs cache/* directories

https://github.com/nwjs-ffmpeg-prebuilt/nwjs-ffmpeg-prebuilt/releases

Generate checksum.txt file 
---
```
sha256sum FreeWallet.linux32.tgz > checksums.txt
sha256sum FreeWallet.linux64.tgz >> checksums.txt
sha256sum FreeWallet.osx64.dmg   >> checksums.txt
sha256sum FreeWallet.win32.exe   >> checksums.txt
sha256sum FreeWallet.win64.exe   >> checksums.txt
```

