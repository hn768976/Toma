#!/bin/bash
# Zips the project for delivery: source, data, public assets, scripts, configs and README.
# Leaves out node_modules, .git, refs/ and render output (out/).
cd "$(dirname "$0")/.."
name=people-network-stories-project
rm -f "out/$name.zip"
mkdir -p out
tmp=$(mktemp -d)
mkdir "$tmp/$name"
cp -r src data public scripts package.json package-lock.json tsconfig.json remotion.config.ts README.md .gitignore "$tmp/$name/"
(cd "$tmp" && zip -qr "$OLDPWD/out/$name.zip" "$name")
rm -rf "$tmp"
unzip -l "out/$name.zip" | tail -1
