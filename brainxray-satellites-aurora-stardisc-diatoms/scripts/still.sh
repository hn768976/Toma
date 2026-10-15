#!/usr/bin/env bash
# usage: scripts/still.sh <CompId> <frame> <out.png>  (720p, uses prebuilt out/bundle)
npx remotion still out/bundle "$1" "$3" --frame="$2" --scale=0.3333333333333333 --log=error
