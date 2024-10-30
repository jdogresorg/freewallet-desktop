FreeWallet Classic - Desktop Wallet
---
FreeWallet Classic is a free wallet which supports Bitcoin and Counterparty Classic.

Installation Instructions
---
```
Windows : Download FreeWallet-Classic.exe, run it, complete the installer.
Mac/OSX : Download FreeWallet-Classic.dmg, mount, and drag FreeWallet-Classic app to 'Applications' folder
Linux   : Download FreeWallet-Classic.tgz, extract it, run FreeWallet-Classic/install.sh
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
sha256sum FreeWallet-Classic.linux32.tgz > checksums.txt
sha256sum FreeWallet-Classic.linux64.tgz >> checksums.txt
sha256sum FreeWallet-Classic.osx64.dmg   >> checksums.txt
sha256sum FreeWallet-Classic.win32.exe   >> checksums.txt
sha256sum FreeWallet-Classic.win64.exe   >> checksums.txt
```

