#!/bin/bash
#
# Script to handle creating builds for win/mac/linux
#####################################################

# Mac Developer Identity
# You can find your identity by doing : security find-identity
identity="8C21C6C320C3FFA6ECFA042E29B4C9461C0497CD"

# Path to nwjs executable
nwjs=/Applications/nwjs.app/Contents/MacOS/nwjs

###
### DO NOT EDIT ANYTHING BELOW THIS LINE
###

# Verify we are building on a mac
if [ "$OSTYPE" != "darwin" ] ; then
    echo "Build script is meant to be run on MacOS!"
    exit
fi

# Extract path to freewallet-desktop source code
base_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Extract app name and version from package.json
app_name=`cat package.json | grep -m1 "name" | awk '{print $2}' | tr -d '",'`
version=`cat package.json | grep -m1 "version" | awk '{print $2}' | tr -d '",'` 

# Copy files to build directory
while true; do
    read -p "Copy files to build directory?" yn
    case $yn in
        [Yy]* ) yn="Y"
                echo "### Copying files to build directory..."
                mkdir $base_dir/build 2> /dev/null
                rm -rf $base_dir/build/*
                cp -a css html images js index.html package.json build/
                break;;
        [Nn]* ) break;;
        * ) echo "Please answer yes or no.";;
    esac
done

# Install node modules
while true; do
    read -p "Install Node Modules?" yn
    case $yn in
        [Yy]* ) yn="Y"
                echo "### Installing node modules..."
                cd $base_dir/build
                npm install
                break;;
        [Nn]* ) break;;
        * ) echo "Please answer yes or no.";;
    esac
done

# Run test build
while true; do
    read -p "Run test build for debugging?" yn
    case $yn in
        [Yy]* ) yn="Y"
                echo "### Running nwjs..."
                $nwjs $base_dir/build
                break;;
        [Nn]* ) break;;
        * ) echo "Please answer yes or no.";;
    esac
done


# Run nwjs builder
while true; do
    read -p "Run nwjs builder?" yn
    case $yn in
        [Yy]* ) yn="Y"
                cd $base_dir
                rm -rf $base_dir/builds/*
                echo "### Running nwjs builder..."
                node $base_dir/build.js
                break;;
        [Nn]* ) break;;
        * ) echo "Please answer yes or no.";;
    esac
done


# Update app to handle custom URIs
while true; do
    read -p "Update app to handle custom urls?" yn
    case $yn in
        [Yy]* ) yn="Y"
                plist=$base_dir/builds/$app_name/osx64/$app_name.app/Contents/Info.plist
                echo "### Editing Plist file at $plist..."
                /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:3:CFBundleURLName string Bitcoin" $plist
                /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:3:CFBundleURLSchemes array" $plist
                /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:3:CFBundleURLSchemes:0 string bitcoin" $plist
                /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:4:CFBundleURLName string Counterparty" $plist
                /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:4:CFBundleURLSchemes array" $plist
                /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:4:CFBundleURLSchemes:0 string counterparty" $plist
                /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:5:CFBundleURLName string FreeWallet" $plist
                /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:5:CFBundleURLSchemes array" $plist
                /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:5:CFBundleURLSchemes:0 string freewallet" $plist
                break;;
        [Nn]* ) break;;
        * ) echo "Please answer yes or no.";;
    esac
done

# Sign the mac app
while true; do
    read -p "Sign the mac build with your developer key?" yn
    case $yn in
        [Yy]* ) yn="Y"
                cd $base_dir
                app="$base_dir/builds/$app_name/osx64/$app_name.app"
                echo "### Signing Mac builds..."
                codesign --force --verify --verbose --sign "$identity" "$app"
                echo "### Verifying signature..."
                codesign -vvv -d "$app"
                # Do security assesment to verify the app is signed by known developer
                sudo spctl -a -vvvv "$app"
                break;;
        [Nn]* ) break;;
        * ) echo "Please answer yes or no.";;
    esac
done

# Create DMG Installer for mac
while true; do
    read -p "Create a DMG installer?" yn
    case $yn in
        [Yy]* ) yn="Y"
                # Define some vars used in the build process
                vol_name="$app_name $version"   # volume name will be "SuperCoolApp 1.0.0"
                dmg_bg="mac-installer-bg.png"   # Background for the DMG installer
                dmg_tmp="$app_name-temp.dmg"    # Temporary DMG file
                dmg_out="$app_name.dmg"         # Finalized DMG file
                staging="./mac-installer"       # We copy all our stuff into this directory

                # Check the background image DPI and convert it if it isn't 72x72
                # This avoids distortion problems on Mac OS X 10.7+
                _bg_h=`sips -g dpiHeight $base_dir/misc/$dmg_bg | grep -Eo '[0-9]+\.[0-9]+'`
                _bg_w=`sips -g dpiWidth  $base_dir/misc/$dmg_bg | grep -Eo '[0-9]+\.[0-9]+'`
                if [ $(echo " $_bg_h != 72.0 " | bc) -eq 1 -o $(echo " $_bg_w != 72.0 " | bc) -eq 1 ]; then
                    echo "### Converting dmg background is 72 DPI..."
                    _bg_tmp="$dmg_bg%.*"_dpifix."$dmg_bg##*."
                    sips -s dpiWidth 72 -s dpiHeight 72 $dmg_bg --out $_bg_tmp
                    dmg_bg="$_bg_tmp"
                fi

                # clear out any old data (just to be safe)
                rm -rf $staging $dmg_tmp $dmg_out

                # copy over the stuff we want in the final disk image to our staging dir
                echo "### Copying data to staging directory..."
                mkdir -p $staging
                cp -a $base_dir/builds/$app_name/osx64/$app_name.app $staging

                # figure out how big our DMG needs to be (assumes our contents are at least 1M!)
                size=`du -sh "$staging" | sed 's/\([0-9]*\)M\(.*\)/\1/'`
                size=`echo "$size + 10.0" | bc | awk '{print int($1+0.5)}'`
                if [ $? -ne 0 ]; then
                   echo "Error: Cannot compute size of staging dir"
                   exit
                fi

                # create the temp DMG file
                echo "### Creating temporary DMG file..."
                hdiutil create -srcfolder "$staging" -volname "$vol_name" -fs HFS+ -fsargs "-c c=64,a=16,e=16" -format UDRW -size ${size}M "$dmg_tmp"
     
                # mount it and save the device
                echo "### Mounting temporary DMG file : $dmg_tmp ..."
                device=$(hdiutil attach -readwrite -noverify "$dmg_tmp" | egrep '^/dev/' | sed 1q | awk '{print $1}')
     
                # sleep to let the device actually mount
                sleep 2

                # add a link to the Applications dir
                echo "### Creating link to /Applications ..."
                pushd /Volumes/"$vol_name"
                ln -s /Applications
                popd

                # add a background image
                mkdir /Volumes/"$vol_name"/.background
                cp $base_dir/misc/$dmg_bg /Volumes/"$vol_name"/.background/

                # tell the Finder to resize window, set background, change icon size, place the icons in the right position, etc.
                echo '
                   tell application "Finder"
                     tell disk "'${vol_name}'"
                           open
                           set current view of container window to icon view
                           set toolbar visible of container window to false
                           set statusbar visible of container window to false
                           set the bounds of container window to {400, 100, 920, 440}
                           set viewOptions to the icon view options of container window
                           set arrangement of viewOptions to not arranged
                           set icon size of viewOptions to 72
                           set background picture of viewOptions to file ".background:'${dmg_bg}'"
                           set position of item "'${app_name}'.app" of container window to {160, 205}
                           set position of item "Applications" of container window to {360, 205}
                           close
                           open
                           update without registering applications
                           delay 2
                     end tell
                   end tell
                ' | osascript
                sync

                # unmount it
                hdiutil detach $device
                 
                # now make the final image a compressed disk image
                echo "### Creating compressed image..."
                hdiutil convert $dmg_tmp -format UDZO -imagekey zlib-level=9 -o $dmg_out
                 
                # Move file to its final destination
                echo "### Moving dmg to final destination..."
                mv $dmg_out $base_dir/builds/$app_name/osx64/

                echo "### Cleaning up..."
                rm -rf $staging $dmg_tmp

                break;;
        [Nn]* ) break;;
        * ) echo "Please answer yes or no.";;
    esac
done


# Create Linux installer?
while true; do
    read -p "Create linux installer?" yn
    case $yn in
        [Yy]* ) yn="Y"
                platform=( 32 64 )
                for bits in "${platform[@]}"; do
                    echo "### Creating $bits-bit installer"
                    cd $base_dir/builds/$app_name/linux$bits/
                    mkdir /tmp/$app_name 2> /dev/null
                    rm -rf /tmp/$app_name/*
                    rm -rf /tmp/$app_name.x$bits.tgz
                    rm -rf $app_name.x$bits.tgz
                    echo "### Copying files to build directory"
                    cp -a * /tmp/$app_name/
                    echo "### Copying additional files to install directory..."
                    cd $base_dir/misc/
                    cp FreeWallet.png install.sh FreeWallet-Classic.desktop /tmp/$app_name/
                    cd /tmp
                    tar -cvzf $app_name.x$bits.tgz $app_name
                    cp $app_name.x$bits.tgz $base_dir/builds/$app_name/linux$bits/
                done
                break;;
        [Nn]* ) break;;
        * ) echo "Please answer yes or no.";;
    esac
done
