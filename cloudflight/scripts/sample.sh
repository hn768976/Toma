#!/bin/bash
# scripts/sample.sh <compId> <scale> <name> <cols> <start> <end> <nth>
# Renders every nth frame in one browser session -> out/iter/<name>.png
set -e
id=$1; sc=$2; name=$3; cols=$4; st=$5; en=$6; nth=$7
[ -z "$NOBUNDLE" ] && npx remotion bundle src/index.ts --out-dir build >/dev/null 2>&1
d=out/iter/$name; rm -rf $d; mkdir -p $d
node scripts/frames.mjs $id $sc $d $st $en $nth "${PROPS:-{\}}" 2>&1 | grep -o '{"id.*' || true
python3 scripts/sheet.py out/iter/$name.png $cols ${W:-480} $(ls $d/*.png | python3 -c "import sys,re; print(\" \".join(sorted(sys.stdin.read().split(), key=lambda p:int(re.findall(r\"f(\\d+)\\.png\",p)[0]))))")
echo out/iter/$name.png
