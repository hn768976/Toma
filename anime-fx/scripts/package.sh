#!/usr/bin/env bash
# Zip the project source (no node_modules, .git, refs/ or render output).
set -e
cd "$(dirname "$0")/.."
name=anime-fx-graffiti-stylewalk-inkfigure-project
rm -f "out/$name.zip"
tmp=$(mktemp -d)
mkdir "$tmp/$name"
cp -r src scripts package.json package-lock.json tsconfig.json remotion.config.ts README.md .gitignore "$tmp/$name/"
(cd "$tmp" && zip -qr "$name.zip" "$name")
mv "$tmp/$name.zip" out/
rm -r "$tmp"
unzip -l "out/$name.zip" | tail -1
