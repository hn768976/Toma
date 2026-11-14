# QC Report — Skin Hydration Cells / Circuit Board Macro

## Deliverables

| # | File | Composition (4K source) |
|---|------|-------------------------|
| 1 | `Version 1 - Skin Hydration Cells (Reference Match) - 1080p.mp4` | `SkinHydration-V1-Reference-4K` |
| 2 | `Version 2 - Skin Hydration Cells (Camera Move) - 1080p.mp4` | `SkinHydration-V2-CameraMove-4K` |
| 3 | `Version 1 - Circuit Board Macro (Reference Match) - 1080p.mp4` | `CircuitBoard-V1-Reference-4K` |
| 4 | `Version 2 - Circuit Board Macro (Color Palette) - 1080p.mp4` | `CircuitBoard-V2-ColorPalette-4K` |
| 5 | `Project Source - Skin Hydration Cells + Circuit Board Macro (4K Remotion Compositions).zip` | both Remotion projects |

Version 2 choices: the hydration clip uses a different camera (level horizon,
crane-down, frontal dolly-in); the circuit-board clip uses a different colour
palette (navy/teal board, gold traces and pins, warm key light).

## Technical checks (all passed)

| File | Codec | Pixel format | Size | FPS | Frames | Duration | Reference | Audio | Decode errors |
|------|-------|--------------|------|-----|--------|----------|-----------|-------|---------------|
| V1 Skin Hydration | H.264 High | yuv420p, BT.709 | 1920x1080 | 30/1 | 226 | 7.5333 s | 226 fr @ 30 fps = 7.5333 s | none | 0 |
| V2 Skin Hydration | H.264 High | yuv420p, BT.709 | 1920x1080 | 30/1 | 226 | 7.5333 s | same | none | 0 |
| V1 Circuit Board | H.264 High | yuv420p, BT.709 | 1920x1080 | 30/1 | 300 | 10.000 s | 250 fr @ 25 fps = 10.000 s | none | 0 |
| V2 Circuit Board | H.264 High | yuv420p, BT.709 | 1920x1080 | 30/1 | 300 | 10.000 s | same | none | 0 |

- Every file was fully decoded with zero errors; constant frame rate, no
  irregular timestamps.
- No black frames, no frozen/duplicate frames, no flicker: the largest
  frame-to-frame mean-luma change is 2.7 of 255 (hydration V1, during the
  hydration wave) and below 0.7 in the other three.
- The references contain no audio, so the outputs have no audio track.
- The stock watermark in the references is not reproduced.

## Project ZIP checks (all passed)

- `unzip -t`: no errors; 41 files (source, configs, lockfiles, READMEs; no
  `node_modules`, no render output). Everything is procedural, so there are no
  external assets to go missing.
- Extracted to an empty folder, then for each project: `npm ci`, `tsc`,
  `eslint`, `npm run render:v1` and `render:v2` (short frame ranges, 1080p
  H.264 at 30 fps) and a native 3840x2160 still — all succeeded.
- Both projects define their two compositions at 3840x2160, 30 fps, with the
  exact reference frame counts. The 1080p files are rendered from those 4K
  compositions with `--scale=0.5`.
- Note for this build machine only: Remotion could not download its own Chrome
  (no network access to its host), so renders here used
  `--browser-executable` with a local headless Chrome. This is documented in
  each README; on a normal machine the documented commands need no extra flag.
- Full-length 4K video renders were not run (software rendering here is slow);
  4K was verified with still frames.

## Independent visual verification

A separate reviewer agent compared each video with its reference from the
pixels only, in three passes. Its findings from the first two passes were
fixed and the videos re-rendered each time: the hydration camera now keeps
descending through the cell layers as in the reference, each layer hydrates
locally and on the reference's schedule, cells are glossier, the drop is
absorbed at the surface, bubbles are clearly visible, the circuit chip package,
pins, camera pitch, lid material and lighting were corrected, and colour
tagging was changed to limited-range BT.709.

Final-pass scores from the reviewer:

| Video | Score | Summary |
|-------|-------|---------|
| V1 Skin Hydration (Reference Match) | 6.5 / 10 | Framing, background, event timing and layer passes track the reference; drop impact and cell look differ |
| V2 Skin Hydration (Camera Move) | 7 / 10 as a variant | Clearly different camera, same concept and event order, smoothest motion |
| V1 Circuit Board (Reference Match) | 7 / 10 | Camera path matches within about 2 % of frame width; tonality darker than the reference |
| V2 Circuit Board (Color Palette) | 8 / 10 as a variant | Identical camera and timing to V1, unmistakably different palette |

## Known remaining differences (not fixed)

These are procedural recreations, not frame-accurate copies. The reviewer's
remaining points, most noticeable first:

1. **Hydration V1, 0.5–1.2 s:** the drop flattens and fades at the surface
   but does not show the reference's splash dome and white mist; its tail is
   longer and more tilted than the reference's plump drop.
2. **Circuit V1, whole clip:** about 30 % darker than the reference, with
   near-black component sides; the lid is dark metal rather than the
   reference's bright glossy plate, and the blown-out highlight at upper left
   in the first 4 s is missing.
3. **Hydration V1, about 1.9–2.9 s:** the second layer turns from peach to
   pearl in about 6 frames and cells swell quickly as the wave passes the
   camera; the reference does this as a slower wash.
4. **Hydration V1 cells:** smooth peach ellipsoids, without the reference's
   gold nuclei and ridged discs.
5. **Hydration V2:** the drop is small in frame; the layer seen from below
   looks flat, and a soft beige band shows under it at about 3.0–3.6 s.
6. **Both circuit videos:** chip surface pattern (concentric traces instead of
   dot matrices), simpler surrounding components, and a foreground capacitor
   whose body stays sharper than its top.
7. **Circuit file size:** about 40 MB each for 10 s because of film grain at
   CRF 16.

Not verified: real-time playback on a display (checks were done on decoded
frames and statistics), and colour on a calibrated monitor.
