#!/bin/bash
# Renders all 8 previews at 720p and logs wall time per composition.
cd "$(dirname "$0")/.."
LOG=out/log/render_times.tsv
echo -e "composition\tframes\tseconds\tsec_per_frame" > $LOG
for pair in SerumCapsule-SilverBlue:SerumCapsule_SilverBlue:300 SerumCapsule-Gold:SerumCapsule_Gold:300 \
  CrystalBurst-IceBlue:CrystalBurst_IceBlue:600 CrystalBurst-AmethystRose:CrystalBurst_AmethystRose:600 \
  DigitSwirl-Teal:DigitSwirl_Teal:600 RibbedDunes-White:RibbedDunes_White:600 \
  RibbedDunes-Graphite:RibbedDunes_Graphite:600 CubeCluster-Blue:CubeCluster_Blue:600; do
  IFS=: read id name n <<< "$pair"
  rm -rf out/frames/$id
  s=$(date +%s.%N)
  scripts/render-preview.sh $id $name
  e=$(date +%s.%N)
  t=$(echo "$e - $s" | bc)
  echo -e "$id\t$n\t$t\t$(echo "scale=3; $t / $n" | bc)" >> $LOG
done
echo ALL_DONE >> $LOG
