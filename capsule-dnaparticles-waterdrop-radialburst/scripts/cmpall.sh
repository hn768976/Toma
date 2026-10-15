#!/usr/bin/env bash
# Step 7 helper: side-by-side (mine | reference) for looks 1, 3, 4, 6 and 7,
# taken from the 720p previews and the reference clips in refs/.
cd "$(dirname "$0")/.."
mkdir -p out/cmp
pair() { # name preview_time ref_id ref_time
  ffmpeg -v error -y -ss "$2" -i "out/previews/$1.mp4" -frames:v 1 "out/cmp/$1_mine.png"
  ffmpeg -v error -y -ss "$4" -i "refs/$3.mp4" -frames:v 1 "out/cmp/$1_ref.png"
  scripts/cmp.sh "out/cmp/$1_mine.png" "out/cmp/$1_ref.png" "out/cmp/$1_pair.png"
}
pair CapsuleRelease_White 10 3504986287 10
pair DNAParticles_Violet 10 1015826728 6
pair DNAForm_Teal 11 1015826725 13.5
pair WaterDrop_Blue 4 3437787813 4
pair RadialBurst_Navy 4 3765695515 4
ffmpeg -v error -y $(for n in CapsuleRelease_White DNAParticles_Violet DNAForm_Teal WaterDrop_Blue RadialBurst_Navy; do printf -- "-i out/cmp/%s_pair.png " $n; done) -filter_complex vstack=5 out/cmp/all.png
echo out/cmp/all.png
