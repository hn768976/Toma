#!/usr/bin/env bash
# Three saleable stills per composition at 6000x3375, plus one 1080p PNG each.
# The chosen frames are recorded here and in README.md.
set -u
cd "$(dirname "$0")"
mkdir -p out/stills out/stills-1080

# id|name|frameA,frameB,frameC|1080p frame
ROWS=(
"GrowthLine-Navy|GrowthLine_Navy|210,255,299|255"
"GrowthLine-Black|GrowthLine_Black|200,250,299|250"
"BarChart-Cyan|BarChart_Cyan|60,240,460|240"
"BarChart-Amber|BarChart_Amber|120,330,520|330"
"DarkDashboard-Teal|DarkDashboard_Teal|90,300,510|300"
"DarkDashboard-Blue|DarkDashboard_Blue|150,360,540|360"
"LightDashboard-Warm|LightDashboard_Warm|60,172,320|172"
"LightDashboard-Slate|LightDashboard_Slate|30,428,540|428"
"FinancialMontage-Blue|FinancialMontage_Blue|90,300,480|300"
)

for row in "${ROWS[@]}"; do
  IFS='|' read -r id name frames hero <<< "$row"
  IFS=',' read -ra FS <<< "$frames"
  for f in "${FS[@]}"; do
    # 6000x3375 = the 3840x2160 composition at --scale=1.5625
    npx remotion still "$id" "out/stills/${name}_f${f}.png" \
      --frame="$f" --scale=1.5625 --image-format=png >/dev/null 2>&1 \
      && echo "still 6000x3375  ${name}_f${f}.png"
  done
  npx remotion still "$id" "out/stills-1080/${name}.png" \
    --frame="$hero" --scale=0.5 --image-format=png >/dev/null 2>&1 \
    && echo "still 1920x1080  ${name}.png (frame $hero)"
done
