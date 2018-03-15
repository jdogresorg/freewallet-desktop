#!/bin/sh
# FreeWallet - Linux installer script
# Handles installing FreeWallet and integrating with window manager
###########################################################
basedir=/usr/share
echo "### Creating installation directories..."
mkdir -vp $basedir/FreeWallet
mkdir -vp $basedir/icons/FreeWallet
mkdir -vp $basedir/applications
echo "### Installing FreeWallet..."
cp -a * $basedir/FreeWallet/
cp FreeWallet.png $basedir/icons/FreeWallet/
echo "### Integrating FreeWallet with linux desktop..."
cp FreeWallet.desktop $basedir/applications
echo "### Setting file permissions..."
chmod 644 $basedir/icons/FreeWallet/FreeWallet.png 
chmod 644 $basedir/applications/FreeWallet.desktop
chmod 755 $basedir/FreeWallet/*
echo "### Updating desktop database..."
/usr/bin/update-desktop-database
echo "### Installation Complete!"