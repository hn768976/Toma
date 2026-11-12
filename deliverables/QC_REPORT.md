# Quality-Control Report: Digital Earth Data Network & DNA Sequencing Grid

Date: 2026-11-12

## Deliverables

| # | File | Composition (4K source) | Version |
|---|---|---|---|
| 1 | `Version-1_Digital-Earth-Data-Network_1080p.mp4` | `EarthNetwork-V1-Match` | V1: matches the reference |
| 2 | `Version-2_Digital-Earth-Data-Network_Orbital-Camera_1080p.mp4` | `EarthNetwork-V2-OrbitalCamera` | V2: alternative **camera movement** |
| 3 | `Version-1_DNA-Sequencing-Grid_1080p.mp4` | `DnaSequence-V1-Match` | V1: matches the reference |
| 4 | `Version-2_DNA-Sequencing-Grid_Fluorescent-Palette_1080p.mp4` | `DnaSequence-V2-FluorescentPalette` | V2: alternative **colour palette** |
| 5a | `Digital-Earth-Data-Network_Remotion-Project_4K.zip` | Remotion project with both Earth compositions | |
| 5b | `DNA-Sequencing-Grid_Remotion-Project_4K.zip` | Remotion project with both DNA compositions | |

**Technology:**
- **Earth:** Three.js (WebGL 2) with custom GLSL shaders, plus a projected HTML data-label overlay.
- **DNA:** a raw WebGL 2 two-pass shader pipeline: an analytic depth-of-field gel plane, then chromatic aberration and bloom.

Both projects were created with the Remotion CLI (`create-video`). All compositions are 3840×2160 at 30 fps. The 1080p deliverables are those compositions rendered with `--scale=0.5`.

## 1. Technical checks (automated: ffprobe, ffmpeg and frame analysis)

| Check | Earth V1 | Earth V2 | DNA V1 | DNA V2 |
|---|---|---|---|---|
| Renders successfully | ✅ | ✅ | ✅ | ✅ |
| Codec | H.264 High | H.264 High | H.264 High | H.264 High |
| Pixel format / colour | yuv420p, BT.709 limited | same | same | same |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames: output / reference | 892 / 892 ✅ | 892 / 892 ✅ | 751 / 751 ✅ | 751 / 751 ✅ |
| Duration: output / reference | 29.733 s / 29.733 s ✅ | 29.733 s / 29.733 s ✅ | 25.033 s / 25.033 s ✅ | 25.033 s / 25.033 s ✅ |
| Full decode errors | none | none | none | none |
| Frozen / duplicate frames | 0 | 0 | 0 | 0 |
| Glitch / corrupted-frame spikes | 0 | 0 | 0 | 0 |
| Max frame-to-frame brightness jump (flicker) | 0.77 | 0.30 | 0.19 | 0.19 |
| Unintended black frames | none (see note) | none | none | none |
| Audio | none (references have none) | none | none | none |
| Bitrate | 19.9 Mb/s | 18.5 Mb/s | 4.9 Mb/s | 4.8 Mb/s |

*Note:* Earth V1 opens near-black (0–1.4 s: deep space with sparse network lines and streaming read-outs) by design, mirroring the reference's own dark opening, which the same detector flags for 0–0.8 s.

**Spikes** are frame-to-frame changes far above the local neighbourhood. **Flicker** is measured as the luminance jump of a frame against its neighbours, on a 0–255 scale.

## 2. Project ZIP checks

- **Integrity:** `unzip -t` passes for both archives. Each has its sha256 recorded (see below).
- **Contents:**
  - full `src/` for the compositions and shaders;
  - `public/textures` for the Earth project (the DNA project needs no assets);
  - `package.json` with render scripts, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, eslint and prettier configs;
  - `README.md` with commands, technology notes and credits.
  - `node_modules` and outputs are excluded.
- **Extraction test**, done in a clean directory:
  - `npm ci` succeeds;
  - `npm run lint` (eslint + tsc) passes;
  - `npx remotion compositions` lists all four compositions at 3840×2160, 30 fps, with 892 and 751 frames.
- **Render test from the extracted projects:**
  - Each composition rendered 10 frames to 1080p H.264 yuv420p.
  - A native 3840×2160 still was rendered from each project.
  - The ZIP renders match the delivered videos at PSNR 43.3–48.5 dB. That gap is re-encode level only, so the renders are deterministic and identical in content.

## 3. Visual checks against the references

An independent reviewer agent ran five passes on the frames. It compared timing, framing, palette, motion and defects side by side and numerically. I fixed its findings between passes.

| Video | First pass | Final | Remaining minor differences |
|---|---|---|---|
| Earth V1 | 6/10 | **8/10** | Late globe rotation is about 2x calmer than the reference. The plexus is slightly denser. Small pale city-light patches show on the day side at about 3 s. The pull-back settles about 1–2 s early. |
| Earth V2 | 7/10 | **8/10** | Clearly distinct from V1 and keeps the concept. Shares V1's network density. |
| DNA V1 | 6/10 | **8.5/10** | The focus band is slightly broader than the reference's. Near blocks are a little wide. Bars are slightly brighter. Drift is 1.42% of width per second against 1.44% in the reference. |
| DNA V2 | n/a | n/a (same scene as DNA V1) | Same layout, camera and motion as V1. Only the palette differs. |

No artifacts, popping, stutter, banding (the Earth glows are dithered) or missing assets were found in any final file.

**Second versions: how they differ**
- **Earth V2 changes the camera movement.** It is a continuous ~120° orbital fly-around: it opens low over North America's night-side city lights, sweeps across the terminator and up over the northern hemisphere, and ends on a sunlit, high three-quarter view with the globe right of centre. The reference and V1 use a straight pull-back from deep space. The network, data read-outs and look are the same.
- **DNA V2 changes the colour palette.** It uses four-dye fluorescent sequencer colours: emerald and azure dominant, amber and magenta calls, on teal-black. The layout, lens, depth of field and motion are identical to V1. A palette change suits this piece better than a new camera, because the reference is a slow observational truck and the bars are colour-coded data.

## 4. Integrity (sha256)

```
1e027af3fd172bf84bcb9b432fef61ac8c807ae1bd4f2d3e7ed4776eb7192af4  Version-1_Digital-Earth-Data-Network_1080p.mp4
b78c9b538eade331bf9d4baf8a4e034d3d86420adb8c1c583c20d6bc4c174ff8  Version-2_Digital-Earth-Data-Network_Orbital-Camera_1080p.mp4
842fa1366ea8c3e1f95290ac9bb98d2e635f678a2d957e06ff3782df7cfd25cf  Version-1_DNA-Sequencing-Grid_1080p.mp4
3e57fb91c81990ebc82608a99c03c4f2ab171426ac90de0013aa6d41d5f8b161  Version-2_DNA-Sequencing-Grid_Fluorescent-Palette_1080p.mp4
d3d634f88ff9babb451dd6219575ab8af6ef358fb715e4cdf94c82bcc9e19113  Digital-Earth-Data-Network_Remotion-Project_4K.zip
90539d1aa158f939e9830d52327f8c803f5a25e11f453d373d04179d0ddd546c  DNA-Sequencing-Grid_Remotion-Project_4K.zip
```

## Render commands (from each extracted project)

```bash
npm install
npm run render:v1      # 4K composition -> 1080p H.264 (--scale=0.5), out/
npm run render:v2
npm run render:v1:4k   # optional full 3840x2160 master
```

Rendering uses SwiftShader (no GPU needed). On a GPU machine, add `--gl=angle` for faster renders.
