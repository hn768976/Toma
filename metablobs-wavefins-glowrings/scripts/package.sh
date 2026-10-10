#!/usr/bin/env bash
# Builds metablobs-wavefins-glowrings-project.zip from a clean copy of the project
# (no node_modules, .git, refs/ or render output).
set -euo pipefail
cd "$(dirname "$0")/.."
name=metablobs-wavefins-glowrings-project
tmp=$(mktemp -d)
mkdir -p "$tmp/$name"
cp -r package.json package-lock.json remotion.config.ts tsconfig.json README.md .gitignore src scripts "$tmp/$name/"
mkdir -p out
rm -f "out/$name.zip"
(cd "$tmp" && zip -qr "$OLDPWD/out/$name.zip" "$name")
rm -rf "$tmp"
unzip -l "out/$name.zip" | tail -1
