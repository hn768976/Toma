# QC report: Moonlit Sea and Archive Corridor

**Project:** `moon-archive-4k-project.zip`. This is one Remotion 4.0.538 project containing all four 3840×2160 compositions.
**Deliverables:** four 1080p H.264 MP4s. Each was rendered as a 4K master and then scaled down to 1080p with Lanczos.

| # | Deliverable | Composition (4K) | Technology | Alternative chosen |
|---|---|---|---|---|
| 1 | `MoonlitSea-V1-Reference-1080p.mp4` | `MoonlitSea-V1-Reference` | WebGL 2 fragment shader | — (matches the reference) |
| 2 | `MoonlitSea-V2-TealAmber-1080p.mp4` | `MoonlitSea-V2-TealAmber` | WebGL 2 fragment shader | **Colour palette.** The reference camera is locked off, so a palette change suits it best: teal sky, amber clouds, golden moon. |
| 3 | `ArchiveCorridor-V1-Reference-1080p.mp4` | `ArchiveCorridor-V1-Reference` | Three.js (instanced geometry) | — (matches the reference) |
| 4 | `ArchiveCorridor-V2-DollyZoomRoll-1080p.mp4` | `ArchiveCorridor-V2-DollyZoomRoll` | Three.js | **Camera movement.** The reference is a pure forward dolly, so V2 uses a "vertigo" dolly-zoom (28° → ~73° lens) with a slow 20° roll. |

## 1. Technical checks (ffprobe, plus a full decode of every frame)

| Check | Reference A / B | V1 moon | V2 moon | V1 corridor | V2 corridor |
|---|---|---|---|---|---|
| Codec / profile | h264 | h264 High | h264 High | h264 High | h264 High |
| Resolution | 768×432 | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 | 30/1 · 30/1 | 30/1 · 30/1 | 30/1 · 30/1 | 30/1 · 30/1 |
| Frames / video duration | 300 / 10.000 s | 300 / 10.000 s | 300 / 10.000 s | 300 / 10.000 s | 300 / 10.000 s |
| Pixel format | yuv420p | yuv420p | yuv420p | yuv420p | yuv420p |
| Decode errors | — | none | none | none | none |
| Black segments (blackdetect) | — | 0 | 0 | 0 | 0 |
| Max frame-to-frame luma jump (0–255) | — | 0.21 | 0.27 | 0.38 | 0.41 |
| Frozen frames | — | 0 | 0 | 0 | 0 |
| Audio | silent AAC track | none | none | none | none |

- **Duration:** both references are exactly 300 frames and 10.000 s of video. Their 10.005 s container length comes only from the silent AAC audio track. All four outputs are 300 frames and 10.000 s.
- **Audio:** the reference audio measures −91 dB throughout, i.e. digital silence. The outputs are therefore delivered without an audio track, so there are no audio issues to check.
- **Flicker and popping:** the luma jumps are all below 0.5 levels, and the largest frame-to-frame motion is at most 2.4× the median. That rules out flicker, popping and cuts.
- **Shimmer near the corridor's vanishing point:** this was measured as pixels whose second temporal difference exceeds 40. The reference scores 0.0003, V1 0.0001 and V2 0.0000, so both versions are at or below the reference.
- **Mean colour (RGB):**
  - Moon V1 averages 178/123/197 against the reference's 179/117/187.
  - Corridor V1 averages 147/148/146 against the reference's 148/148/147.
- **Distinct alternatives:** the mean absolute difference between V1 and V2 is 50.4 for the moon and 25.3 for the corridor. Both alternatives are clearly different.

## 2. Matching measurements (corridor V1 against the reference)
- **Forward dolly:** the shot repeats every 42 frames, which was measured from the reference. The motion is identical in V1, with no seam at each repeat.
- **Floor width at the bottom row:** 146–621 px in the render against 128–638 px in the reference, after the fix. Vanishing point and ceiling framing are within about 2% of the reference.
- **Brightness:** the gentle exposure lift over the shot (roughly +10%) is reproduced.

## 3. Independent agent review (three rounds)
A separate review agent compared each render with its reference frame by frame and with measurements.
- **Round 1 findings, all fixed:**
  - Moon: too magenta, strong halo, hard reflection bars, flat sea.
  - Corridor: labels too bright, ceiling too dark, no glow at the far end, floor too narrow.
  - Corridor V2: lens too wide at the end of the shot.
- **Round 2 findings, all fixed:**
  - Moon: opaque reflection, motion too slow.
  - Corridor: shimmer near the vanishing point, no haze on the far walls.
- **Round 3 (final) verdicts:**

| Video | Verdict | Score |
|---|---|---|
| Moon V1 | PASS WITH NOTES | 7/10 |
| Moon V2 | PASS WITH NOTES | 7/10 |
| Corridor V1 | PASS WITH NOTES | 8/10 |
| Corridor V2 | PASS WITH NOTES | 8/10 |

- **Remaining notes (stylistic, not defects):**
  - The moon reflection is slightly larger and more lavender than the reference, with little crater texture.
  - The sea ripples move faster than the reference.
  - The corridor's haze reads as a soft glow around the far end rather than a gradual fade with depth, which partly washes out the white doorway at the end.
- The round-3 reviewer also confirmed that the 4K masters match the 1080p deliverables (PSNR 44.6–52.6 dB).

## 4. Project ZIP checks
- `unzip -t`: no errors. The archive holds 21 files: source, `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, ESLint and Prettier configs, `README.md` and `scripts/render-all.sh`.
- `node_modules` and the render output are excluded by design.
- **No missing assets:** everything is generated in code, so the project needs no image, font or audio files.
- **Source match:** a `diff -r` of the extracted ZIP against the source tree found it identical.
- **Fresh-unzip build:** `npm ci` succeeded (358 packages), and `npm run lint` (ESLint plus TypeScript) passed.
- **Compositions:** `npx remotion compositions` lists all four at 3840×2160, 30 fps, 300 frames.
- **Full render from the unzipped copy:** `npm run render:all -- MoonlitSea-V1-Reference` produced a 3840×2160 master with 300 frames and a 1080p deliverable. That deliverable is **bit-identical to the delivered file** (PSNR = ∞).
- **Sample renders from the unzipped copy:** 4K renders of frames 140–169 of the other three compositions succeeded. They match the delivered 4K masters at 52.6, 41.4 and 37.4 dB.
  - The small differences in the two corridor samples come from GPU anti-aliasing varying between runs.

## 5. Checksums (MD5)
```
99fbd80765c943bda9f015de7dd5e264  MoonlitSea-V1-Reference-1080p.mp4
0c06c4e0282ee1d601a8327be6476116  MoonlitSea-V2-TealAmber-1080p.mp4
a8a1fa41ffe4c31ef38d17479343ef42  ArchiveCorridor-V1-Reference-1080p.mp4
a154fa0619cdf23082884c21c24ebbf0  ArchiveCorridor-V2-DollyZoomRoll-1080p.mp4
88c6d82ea2ad6a68d0d4900e99c5a5a8  moon-archive-4k-project.zip
```

## Notes
- The references' iStock watermark was intentionally not reproduced.
- Rendering speed on a 4-core machine with no GPU, at 4K: about 2.3 s per frame for the moon scene and 4.5 s per frame for the corridor.
