#!/usr/bin/env bash

# dieses Modul im Ziel-Projekt unterhalb src/shared/ext verlinken

TARG=src/shared/ext
LIBNAME=`pwd`
LIBNAME=`basename $LIBNAME`

if [ -z "$1" ]; then
  echo Fehler: Bitte Namen des Zielprojekts angeben.
  exit
fi
if [ ! -d ../$1 ]; then
  echo Fehler: Das Verzeichnis ../$1 existiert nicht.
   exit
fi

if [ ! -d ../$1/$TARG ]; then
  mkdir -p ../$1/$TARG
fi

ln -s ../../../../$LIBNAME/src/ ../$1/$TARG/$LIBNAME




