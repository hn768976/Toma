# Encoded-preview analysis

## PulseRings_White
- ffprobe: PASS - h264 1280x720 30/1 yuv420p 20.000s audio_streams=0 frames=600
- render/verify: render_mp4_seconds 23.540598649; frame300_bytes IDENTICAL; loop_0_vs_600_bytes IDENTICAL
- frames [0, 120, 240, 360, 480]: mean abs diff between neighbours = 9.40, 10.23, 6.87, 10.27
- black check (mp4 frame 150): corners max=0, outside-ring area max=0 (frames 0/37/74 max=0) -> PASS

## CyberNetwork_Blue
- ffprobe: PASS - h264 1280x720 30/1 yuv420p 20.000s audio_streams=0 frames=600
- render/verify: render_mp4_seconds 173.052834735; frame300_bytes IDENTICAL; loop_0_vs_600_bytes IDENTICAL
- frames [0, 120, 240, 360, 480]: mean abs diff between neighbours = 9.27, 9.63, 7.55, 7.58
- banding [sky gradient, right edge column]: range=76.6 levels, max step (9px-smoothed)=2.31, longest flat run=29px

## ParticleSphere_Blue
- ffprobe: PASS - h264 1280x720 30/1 yuv420p 20.000s audio_streams=0 frames=600
- render/verify: render_mp4_seconds 144.880541730; frame300_bytes IDENTICAL; loop_0_vs_600_bytes IDENTICAL
- frames [0, 120, 240, 360, 480]: mean abs diff between neighbours = 3.53, 4.10, 4.37, 4.09
- banding [glow falloff, centre row to right edge]: range=87.6 levels, max step (9px-smoothed)=8.13, longest flat run=16px
- banding [glow falloff, centre column upward]: range=39.1 levels, max step (9px-smoothed)=1.12, longest flat run=15px

## ParticleSphere_Gold
- ffprobe: PASS - h264 1280x720 30/1 yuv420p 20.000s audio_streams=0 frames=600
- render/verify: render_mp4_seconds 149.569125769; frame300_bytes IDENTICAL; loop_0_vs_600_bytes IDENTICAL
- frames [0, 120, 240, 360, 480]: mean abs diff between neighbours = 4.13, 4.73, 5.05, 4.69
- banding [glow falloff, centre row to right edge]: range=121.2 levels, max step (9px-smoothed)=10.09, longest flat run=17px
- banding [glow falloff, centre column upward]: range=113.8 levels, max step (9px-smoothed)=1.66, longest flat run=9px

## ParticleWaves_Blue
- ffprobe: PASS - h264 1280x720 30/1 yuv420p 20.000s audio_streams=0 frames=600
- render/verify: render_mp4_seconds 177.603070540; frame300_bytes IDENTICAL; loop_0_vs_600_bytes IDENTICAL
- frames [0, 120, 240, 360, 480]: mean abs diff between neighbours = 11.17, 11.09, 9.94, 9.90
- banding [upper-left light, top rows]: range=101.3 levels, max step (9px-smoothed)=0.75, longest flat run=57px
- banding [sky gradient under the light]: range=36.5 levels, max step (9px-smoothed)=0.54, longest flat run=11px

## ParticleWaves_VioletPink
- ffprobe: PASS - h264 1280x720 30/1 yuv420p 20.000s audio_streams=0 frames=600
- render/verify: render_mp4_seconds 172.942028466; frame300_bytes IDENTICAL; loop_0_vs_600_bytes IDENTICAL
- frames [0, 120, 240, 360, 480]: mean abs diff between neighbours = 11.27, 11.19, 10.00, 9.91
- banding [upper-left light, top rows]: range=110.8 levels, max step (9px-smoothed)=0.78, longest flat run=73px
- banding [sky gradient under the light]: range=40.0 levels, max step (9px-smoothed)=0.56, longest flat run=15px

## DataCity_TealOrange
- ffprobe: PASS - h264 1280x720 30/1 yuv420p 20.000s audio_streams=0 frames=600
- render/verify: render_mp4_seconds 136.690558556; frame300_bytes IDENTICAL; loop_0_vs_600_bytes IDENTICAL
- frames [0, 120, 240, 360, 480]: mean abs diff between neighbours = 9.41, 9.27, 9.31, 8.09
- banding [sky gradient above the towers]: range=3.9 levels, max step (9px-smoothed)=0.18, longest flat run=15px
- banding [sky gradient, right]: range=35.8 levels, max step (9px-smoothed)=0.91, longest flat run=26px

## DataCity_GoldViolet
- ffprobe: PASS - h264 1280x720 30/1 yuv420p 20.000s audio_streams=0 frames=600
- render/verify: render_mp4_seconds 134.012731133; frame300_bytes IDENTICAL; loop_0_vs_600_bytes IDENTICAL
- frames [0, 120, 240, 360, 480]: mean abs diff between neighbours = 9.40, 9.28, 9.28, 8.14
- banding [sky gradient above the towers]: range=1.9 levels, max step (9px-smoothed)=0.22, longest flat run=34px
- banding [sky gradient, right]: range=25.8 levels, max step (9px-smoothed)=0.94, longest flat run=22px
