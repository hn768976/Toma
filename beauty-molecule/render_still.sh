#!/bin/sh
# usage: ./render_still.sh <CompositionId> <frame> <out.png>  (720p)
npx remotion still "$1" "$3" --frame="$2" --scale=0.3333333333333333 --gl=angle --log=error
