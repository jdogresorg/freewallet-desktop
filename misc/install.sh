#!/bin/sh
# FreeWallet - Linux installer script
# Handles installing FreeWallet and integrating with window manager
###########################################################
basedir=/usr/share
echo "### Creating installation directories..."
mkdir -vp $basedir/FreeWallet-Classic
mkdir -vp $basedir/icons/FreeWallet-Classic
mkdir -vp $basedir/applications
echo "### Installing FreeWallet Classic..."
cp -a * $basedir/FreeWallet-Classic/
cp FreeWallet.png $basedir/icons/FreeWallet-Classic/
echo "### Integrating FreeWallet with linux desktop..."
cp FreeWallet-Classic.desktop $basedir/applications
echo "### Setting file permissions..."
chmod 644 $basedir/icons/FreeWallet-Classic/FreeWallet.png 
chmod 644 $basedir/applications/FreeWallet-Classic.desktop
chmod 755 $basedir/FreeWallet-Classic/*
echo "### Updating desktop database..."
/usr/bin/update-desktop-database
echo "### Installation Complete!"