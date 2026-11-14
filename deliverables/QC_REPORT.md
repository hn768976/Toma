# QC Report

## Deliverables
| File | Res | FPS | Codec | Frames | Duration | Ref | Δ |
|---|---|---|---|---|---|---|---|
| Comp1_VitalsMonitor_V1_1080p.mp4 | 1920x1080 | 30 | H.264 High, yuv420p | 602 | 20.067 s | 20.053 s | +13 ms |
| Comp1_VitalsMonitor_V2_1080p.mp4 | 1920x1080 | 30 | H.264 High, yuv420p | 602 | 20.067 s | 20.053 s | +13 ms |
| Comp2_LocationTrack_V1_1080p.mp4 | 1920x1080 | 30 | H.264 High, yuv420p | 301 | 10.033 s | 10.043 s | −10 ms |
| Comp2_LocationTrack_V2_1080p.mp4 | 1920x1080 | 30 | H.264 High, yuv420p | 301 | 10.033 s | 10.043 s | −10 ms |

Each duration is the nearest whole frame count at 30 fps; the references run at 29.97 fps, so an exact match isn't possible.

## Technical checks (all PASS)
- Full decode (ffmpeg, error level): no errors in any file.
- Black frames (blackdetect): none.
- Frozen frames (freezedetect): none.
- Flicker (frame-to-frame luma jumps > 6/255): none. Average luma stays within ±2 (Comp 1) and ±5 (Comp 2) units.
- Audio: 0 streams, matching the references, which have no audio.
- Distinguishability (PSNR of V1 vs V2): 25.6 dB for Comp 1 and 23.3 dB for Comp 2, so the versions are clearly different.
  - Comp 1 V2: a different camera move. It opens frontal on the numbers, then orbits and cranes to the opposite side while racking focus.
  - Comp 2 V2: a thermal amber palette with magenta lock-on and cyan targets, replacing V1's steel blue.
- The reference watermark was intentionally not reproduced.

## Project ZIPs (4K, 3840x2160 @ 30 fps)
- `vitals-monitor_4K_project.zip` and `location-track_4K_project.zip`:
  - `unzip -t` reports no errors.
  - Each was extracted to a clean folder, then `npm ci`, `tsc --noEmit` and `remotion compositions` all succeeded and listed both compositions at 3840x2160, 30 fps.
  - For location-track, a test render from the extracted project matched the delivered master at 36.8 dB PSNR (the remaining difference comes from grain under H.264 compression).
- Render commands are in each project's README (`npm run render:v1` / `render:v2`). The README also documents the 1080p ffmpeg downscale.

## Reference verification (review agent)
- Comp 1, first review 6/10. Fixed: sharp focal band, crisper traces, grid and tick visibility, readout countdown timing, camera push.
- Comp 2, reviews 6/10 then 7.5/10. Fixed:
  - a white flash at the cut, replaced with a crossfade
  - framing and zoom, hexagon intro and lock-on pulse
  - colour grade and close-up exposure
  - aliasing (mip LOD)
  - text typing timings
- The final Comp 1 changes were not re-reviewed by the agent.
