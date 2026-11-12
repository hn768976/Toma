# Quality-Control Report — Compositions 1 & 2

## Deliverables

| # | File | Description |
|---|---|---|
| 1 | `Composition1_V1_NetworkPlexus_1080p.mp4` | Comp 1, Version 1: match to the reference (data-network fly-through) |
| 2 | `Composition1_V2_NetworkPlexus_AltPalette_1080p.mp4` | Comp 1, Version 2: **alternative colour palette** (violet-black / teal / magenta) |
| 3 | `Composition2_V1_MarketCrash_1080p.mp4` | Comp 2, Version 1: match to the reference (red stock-market crash) |
| 4 | `Composition2_V2_MarketCrash_AltCamera_1080p.mp4` | Comp 2, Version 2: **alternative camera** (elevated, steady crane/tracking shot) |
| 5a | `Composition1_NetworkPlexus_4K_RemotionProject.zip` | Remotion project, compositions `NetworkPlexus-V1` / `-V2` at 3840×2160 |
| 5b | `Composition2_MarketCrash_4K_RemotionProject.zip` | Remotion project, compositions `MarketCrash-V1` / `-V2` at 3840×2160 |

**Pipeline:** Remotion 4.0.539 (projects created with `npx create-video --three`), Three.js / WebGL 2 with custom GLSL shaders, and Canvas 2D for the ticker-table textures. Each composition renders at 4K and is downscaled to 1080p (Lanczos) with H.264 / yuv420p, CRF 16.

**Choice of alternative per composition**
- **Comp 1: palette.** The reference's identity is its moving fly-through, so V2 keeps that motion and changes the colour scheme.
- **Comp 2: camera.** Red is the meaning of a "crash" graphic, so changing the palette would change the message. V2 changes the camera instead.

## 1. Automated technical checks (all four videos)

Tool: `qc/qc_video.py`, using ffprobe with `-count_frames`, a full ffmpeg decode, and frame-by-frame analysis.

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 |
|---|---|---|---|---|
| H.264 (High profile) in MP4 | ✅ | ✅ | ✅ | ✅ |
| 1920×1080, yuv420p | ✅ | ✅ | ✅ | ✅ |
| Exactly 30 fps, constant (r = avg = 30/1) | ✅ | ✅ | ✅ | ✅ |
| Frame count = reference | ✅ 650 = 650 | ✅ 650 = 650 | ✅ 400 = 400 | ✅ 400 = 400 |
| Duration = reference | ✅ 21.6667 s | ✅ 21.6667 s | ✅ 13.3333 s | ✅ 13.3333 s |
| Audio (references have none, outputs have none) | ✅ | ✅ | ✅ | ✅ |
| Full decode, zero errors | ✅ | ✅ | ✅ | ✅ |
| No black frames | ✅ | ✅ | ✅ | ✅ |
| No frozen or duplicated frames | ✅ | ✅ | ✅ | ✅ |
| No corrupted or torn frames | ✅ | ✅ | ✅ | ✅ |
| No flicker spikes | ⚠️ one flag, reviewed OK* | ⚠️ one flag, reviewed OK* | ✅ | ✅ |
| Mean RGB (reference) | 12.5/22.8/30.6 (15.8/24.4/32.7) | 23.4/12.4/34.0 (alt palette) | 61.3/15.4/3.6 (68.5/12.2/2.6) | 60.3/13.7/3.1 |
| Bitrate / size | 7.0 Mb/s, 19.0 MB | 7.3 Mb/s, 19.8 MB | 10.3 Mb/s, 17.2 MB | 10.7 Mb/s, 17.8 MB |

\* **Frame 338 in Comp 1.** A large out-of-focus data panel sweeps past the camera and leaves the bottom of the frame, so average brightness steps up for one frame. The independent reviewer looked at it frame by frame and judged it natural, continuous fly-through motion: nothing pops and there is no flash.

The 4K masters were also checked: all four are H.264, 3840×2160, 30/1, with 650 or 400 frames.

## 2. Project ZIPs (integrity, completeness, reproducibility)

| Check | Comp 1 ZIP | Comp 2 ZIP |
|---|---|---|
| CRC integrity (`unzip -t` and Python `testzip`) | ✅ | ✅ |
| Source, config, lockfile, tsconfig and README present | ✅ | ✅ |
| Required assets | ✅ fully procedural, no external assets | ✅ Barlow Condensed fonts plus OFL licence |
| No `node_modules` or build output | ✅ | ✅ |
| Compositions report 3840×2160 @ 30 fps | ✅ V1/V2, 650 frames | ✅ V1/V2, 400 frames |

**The deliverables were produced from the ZIPs themselves.** For each project, the ZIP was extracted into an empty directory, then:
1. `npm ci` ran.
2. `npm run lint` (ESLint plus `tsc`) passed.
3. `npx remotion compositions` listed both compositions.
4. `npm run render:vN:4k` and `npm run downscale:vN` produced the files.

The delivered MP4s are byte-identical (same MD5) to those clean-build outputs.

Comp 2 V2 was re-rendered after a camera change that touched only the V2 code path. V1 stills rendered from the old and the final ZIP are **pixel-identical** at frames 0, 120, 250 and 345, which confirms the delivered V1 matches the final project.

## 3. Independent visual verification (separate review agents)

Each version was compared against its reference using contact sheets, side-by-side pairs, full-resolution spot checks and per-frame statistics.

| Version | First review | Issues found → fixed | Final verdict |
|---|---|---|---|
| C1 V1 | 6/10 | Dark wedge in HUD-ring gaps → arcs redrawn as a distance field. Hard step on a blurred link → travelling-pulse discontinuity removed. Composition → off-centre framing with lateral drift, bigger glowing panels, more sparkle, lighter vignette. | ✅ **Approved, 7/10** |
| C1 V2 | 7/10 | Same fixes as V1. Palette clearly distinct, no clipping. | ✅ **Approved, 8/10** |
| C2 V1 | 6/10 | Faceted blurred line → seamless line joints. Grade → hotter orange with stronger bloom. Middle section darkened. LED charts made bold. Hero ticker shot reframed so the symbol column shows. Red clipping → filmic highlight roll-off (clipped pixels 10.7% → 0%). | ✅ **Approved, 8/10** |
| C2 V2 | 6.5/10 | Empty opening, edge-on LED chart and dull dark stretch → camera re-aimed at V1's subjects with a moderated elevated offset. | ✅ **Approved, 7.5/10** |

**Known stylistic differences from the references (not defects)**
- Comp 1 usually has one sharp hub in view where the reference often has two or three, and it is slightly less hazy.
- Comp 2 uses a starburst where the reference has radiating sparks, and its middle section is a little brighter than the reference's.

## 4. Visual-artefact review

- Black frames, flicker, tearing, frozen frames: none, by automated per-frame analysis plus reviewer sampling.
- Hard-edged blur or glow clipping: three found during review and all fixed (ring wedge, faceted lines, pulse step).
- Banding: the HDR half-float pipeline, about 1.5 LSB of dither and x264 `aq-mode=3` keep it invisible at normal viewing. Faint contours appear only under 5× amplification of the darkest gradients.
- Text: the ticker text in Comp 2 is crisp and readable in the hero shot.
- Timing and transitions: continuous single-shot camera moves (the references have no cuts), with beats timed to match the references.

## 5. How to re-render (see each project's README)

```bash
unzip Composition1_NetworkPlexus_4K_RemotionProject.zip && cd comp1-network-plexus
npm ci
npm run deliver        # 4K masters + 1080p H.264 deliveries in ./out
```

No GPU is required; rendering uses SwiftShader-ANGLE (`--gl=swangle`). On a 4-core CPU it takes about 2.3–6 s per 4K frame. On offline machines, set `REMOTION_BROWSER_EXECUTABLE` to a local Chrome Headless Shell.

## Checksums (MD5)

```
7f9ef6848f79b6fa7067a70cc17c455b  Composition1_V1_NetworkPlexus_1080p.mp4
553ea5d4f4841f971d4489c16c6c3eef  Composition1_V2_NetworkPlexus_AltPalette_1080p.mp4
2065e36c3dfe8ff81da902842d4501af  Composition2_V1_MarketCrash_1080p.mp4
b615fbfadd991b415eaa8bd1fddc2b46  Composition2_V2_MarketCrash_AltCamera_1080p.mp4
5d9280f768d2458d16a14e5256602f0f  Composition1_NetworkPlexus_4K_RemotionProject.zip
7bbbf8c2655e712f60f71cc71c83c036  Composition2_MarketCrash_4K_RemotionProject.zip
```
