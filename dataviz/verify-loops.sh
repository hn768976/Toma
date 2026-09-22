#!/usr/bin/env bash
# Step 3 (loop closure) and step 4 (determinism) for every composition.
set -u
cd "$(dirname "$0")"
mkdir -p out/loop out/det
LOOPING=(BarChart-Cyan BarChart-Amber DarkDashboard-Teal DarkDashboard-Blue LightDashboard-Warm LightDashboard-Slate FinancialMontage-Blue)
ALL=(GrowthLine-Navy GrowthLine-Black "${LOOPING[@]}")

echo "== Step 3: loop closure (composition extended to 601 frames; frame 0 vs frame 600) =="
cp src/Root.tsx /tmp/Root.verify.bak
sed -i 's/export const LOOP = LOOP_FRAMES;/export const LOOP = LOOP_FRAMES + 1;/' src/Root.tsx
for c in "${LOOPING[@]}"; do
  npx remotion still "$c" "out/loop/${c}_f0.png"   --frame=0   --scale=0.5 >/dev/null 2>&1
  npx remotion still "$c" "out/loop/${c}_f600.png" --frame=600 --scale=0.5 >/dev/null 2>&1
  a=$(md5sum "out/loop/${c}_f0.png"|cut -d' ' -f1); b=$(md5sum "out/loop/${c}_f600.png"|cut -d' ' -f1)
  [ "$a" = "$b" ] && echo "PASS  $c" || echo "FAIL  $c"
done
cp /tmp/Root.verify.bak src/Root.tsx
echo "(look 1 is exempt: it draws and holds, it is not a loop)"

echo
echo "== Step 4: determinism (cold single frame vs multi-threaded sequence) =="
for c in "${ALL[@]}"; do
  case "$c" in GrowthLine-*) F=150;; *) F=300;; esac
  rm -rf "out/det/$c"; mkdir -p "out/det/$c"
  npx remotion render "$c" "out/det/$c" --sequence --frames=$((F-10))-$((F+10)) --scale=0.5 --image-format=png >/dev/null 2>&1
  npx remotion still "$c" "out/det/${c}_cold.png" --frame=$F --scale=0.5 >/dev/null 2>&1
  SEQ=$(ls "out/det/$c/" | grep -E "0*${F}\.png$" | head -1)
  a=$(md5sum "out/det/$c/$SEQ"|cut -d' ' -f1); b=$(md5sum "out/det/${c}_cold.png"|cut -d' ' -f1)
  if [ "$a" = "$b" ]; then echo "PASS  $c frame $F"; else
    n=$(python3 -c "
import subprocess
o=subprocess.run(['ffmpeg','-v','error','-i','out/det/$c/$SEQ','-i','out/det/${c}_cold.png','-filter_complex','blend=all_mode=difference,format=gray','-f','rawvideo','-pix_fmt','gray','-'],capture_output=True).stdout
print(f'{sum(1 for v in o if v)} px differ, max {max(o)}/255')")
    echo "FAIL  $c frame $F -- $n"; fi
done
