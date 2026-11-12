# Quality-control report: Iridescent Foil and Silver Satin

## Deliverables

| # | File | Composition (4K source) | Description |
|---|---|---|---|
| 1 | `IridescentFoil-V1-Reference-1080p.mp4` | `IridescentFoil-V1-Reference` | Composition 1, V1: matches reference 1 |
| 2 | `IridescentFoil-V2-GoldSapphire-1080p.mp4` | `IridescentFoil-V2-GoldSapphire` | Composition 1, V2: alternative **colour palette** (molten gold / sapphire) |
| 3 | `SilverSatin-V1-Reference-1080p.mp4` | `SilverSatin-V1-Reference` | Composition 2, V1: matches reference 2 |
| 4 | `SilverSatin-V2-LowAngleDolly-1080p.mp4` | `SilverSatin-V2-LowAngleDolly` | Composition 2, V2: alternative **camera angle and movement** (low-angle perspective dolly and orbit) |
| 5 | `iridescent-foil-remotion-4k-project.zip` | both foil compositions, 3840×2160 | Remotion project |
| 5 | `silver-satin-remotion-4k-project.zip` | both satin compositions, 3840×2160 | Remotion project |

**Technology:** Remotion 4.0.539 projects scaffolded with the Remotion CLI (`create-video --blank`). Each composition is a single **WebGL 2 fragment shader**: a procedural, animated heightfield with custom lighting. It renders full-frame at 3840×2160 and is deterministic per frame. No external assets are needed. Both references are abstract liquid-fabric surfaces with no geometry or sprites, so a fragment shader was the right fit. Three.js or PixiJS would have added a layer without adding capability.

**Output pipeline:** the 1080p deliverables are the 4K compositions rendered with `--scale=0.5`. The shader runs at full 4K and is downsampled, which gives 2×2 supersampled anti-aliasing.

**Choice of alternative per composition:**
- **Foil, palette change.** The reference's identity is its iridescent colour play, while its framing and motion already carry the piece. Recolouring it to gold and sapphire keeps the material, motion and glitter and gives a clearly different look.
- **Satin, camera change.** The reference is near-monochrome silver, so a palette swap would weaken it. A low-angle perspective camera that dollies forward with an orbit and slight roll shows the depth of the folds, keeping the material and palette unchanged.

## 1. Technical checks (ffprobe / ffmpeg, all four outputs)

| Check | Foil V1 | Foil V2 | Satin V1 | Satin V2 |
|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Container | MP4 | MP4 | MP4 | MP4 |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1, 30/1 | 30/1, 30/1 | 30/1, 30/1 | 30/1, 30/1 |
| Frames decoded / expected | 202 / 202 | 202 / 202 | 401 / 401 | 401 / 401 |
| Duration | 6.733 s | 6.733 s | 13.367 s | 13.367 s |
| Pixel format / colour | yuv420p, BT.709 limited | yuv420p, BT.709 limited | yuv420p, BT.709 limited | yuv420p, BT.709 limited |
| H.264 level | 4.1 | 4.1 | 4.0 | 4.1 |
| Avg / peak 1-s bitrate | 33.4 / 40.7 Mbit/s | 33.2 / 41.8 Mbit/s | 5.9 / 6.7 Mbit/s | 5.5 / 6.2 Mbit/s |
| Size | 28.1 MB | 27.9 MB | 9.8 MB | 9.1 MB |
| Full decode with `-xerror` | no errors | no errors | no errors | no errors |
| Black frames (`blackdetect`) | 0 | 0 | 0 | 0 |
| Frozen frames (`freezedetect`) | 0 | 0 | 0 | 0 |
| Flicker (alternating luma jumps above 3) | 0 | 0 | 0 | 0 |
| Max frame-to-frame mean-luma change | 1.60 | 1.41 | 0.79 | 0.65 |
| Audio | none (references have none) | none | none | none |

**Duration note:** the references are 29.97 fps clips of 202 frames (6.740 s) and 401 frames (13.380 s). At exactly 30 fps those lengths are not whole frame counts, so an exact match isn't possible. The compositions keep the **identical frame count**, which is the nearest whole-frame duration: 6.733 s (−6.7 ms) and 13.367 s (−13.3 ms). Both differences are under half a frame.

## 2. Project ZIPs: contents and clean-room test

Each ZIP contains the complete project:
- `src/`: Root with the 4K composition registrations, components, WebGL 2 shader, shader-canvas component and GLSL noise helpers
- `package.json` with render scripts, and `package-lock.json`
- `remotion.config.ts` (codec, quality, colour, bitrate cap, GL renderer, timeouts)
- `tsconfig.json`, ESLint and Prettier configs, `.gitignore`
- `README.md` with documented commands

`node_modules` and render output are excluded; the lockfile reproduces exact versions. No other assets are required.

Clean-room test of each ZIP, run in a fresh empty directory:

| Step | Iridescent Foil | Silver Satin |
|---|---|---|
| `unzip -t` integrity | OK | OK |
| Extract | OK | OK |
| `npm ci` | OK | OK |
| `tsc --noEmit` | OK | OK |
| `remotion compositions`: both at 3840×2160, 30 fps, correct frames | OK (202) | OK (401) |
| 4K still of each composition | OK, 3840×2160 | OK, 3840×2160 |
| Documented `npm run render:v1:4k` (frames 0–29) | OK: H.264, 3840×2160, 30 fps, yuv420p | OK: H.264, 3840×2160, 30 fps, yuv420p |
| Documented `npm run render:v1` / `render:v2` (1080p) | produced deliverables 1–4 | produced deliverables 1–4 |

GPU-less note: in this environment, Remotion's own Chrome download is blocked and there is no GPU. Renders used `--gl=swangle` (SwiftShader) and the preinstalled Chrome Headless Shell via the `REMOTION_BROWSER` hook in `remotion.config.ts`. Both are documented in each README. Render speed was about 2 s per frame.

## 3. Independent visual verification (separate review agent)

An independent agent compared each render with its reference: frame-matched contact sheets, full-resolution crops, consecutive-frame strips, and luma and chroma statistics. It ran several rounds, and each round's findings were fixed and re-rendered:

| Round | Issue found | Fix |
|---|---|---|
| 1 | Foil glitter on a visible lattice | Two fully jittered, rotated layers |
| 1 | Foil folds too small and too busy | Larger, smoother forms; high-frequency octave removed |
| 1 | Foil too slow, flat brightness arc | Faster motion; dip-and-recover brightness arc |
| 1 | Satin missing pleats, no change over time, too slow | Coherent pleats; horizontal → diagonal → camera-in arc; about 1.9× faster |
| 2 | Satin hard crease seams (pleat-mask `max()` kink) | Smooth mask union; confirmed gone |
| 2 | Foil highlights too soft, glitter faint, weak left hotspot | Thin rim lines, brighter shadow glitter, saturated cyan-white band |
| 3 | Foil glitter "boiling" frame to frame | Glitter locked to the material's flow coordinates |
| 4 | Foil mid-clip brightness dip masked by the left band | Band fades by about frame 110 |
| 3 | Bitrate above the H.264 level limit | VBV cap |

Final verdict from the last round:

| Output | Fidelity to reference | Artefacts | Notes |
|---|---|---|---|
| Foil V1 | **7/10** (up from 4) | none | Palette, streak angle (45–55°), form scale, glitter behaviour and brightness arc match. The dip lands at frames ~111–116 against the reference's 111. |
| Foil V2 (Gold/Sapphire) | n/a: alternative | none | Clearly distinct palette with identical geometry, motion and quality |
| Satin V1 | **6.5/10** (up from 4) | none | Neutral steel colour matches the reference closely; speed about 0.85× the reference; the horizontal → diagonal → large-fold arc is present |
| Satin V2 (Low-angle dolly) | n/a: alternative | none | Clearly different camera with clean far field (no shimmer); material and palette preserved |

**Remaining differences from the references:**

| Output | Difference |
|---|---|
| Foil V1 | The streak bundle is softer than the reference's very crisp fine lines |
| Foil V1 | The left white/cyan hotspot fades out around frame 110, while the reference keeps it to about frame 140 |
| Foil V1 | Glitter is mostly magenta/lavender rather than green |
| Foil V1 | Frames 110–150 run 6–10 luma darker |
| Satin V1 | Fine pleats and rim highlights are softer than the reference's crisp specular lines |
| Satin V1 | The last ~1.5 s clips more highlight (about 16–22% against 10%) |
| Satin V1 | Corners are not quite as brown-black as the reference |
| All | None of these are artefacts |

The references are stock footage of physically simulated, path-traced cloth. These shaders approximate them procedurally in real time, so a pixel-exact match is not achievable. The iStock watermark in the references was not reproduced.

## 4. Integrity (SHA-256)

```
5afb2d9e7c101e45f95b3ebfbd2a925ffab55c51dcc9dcf7532249e237cd9043  IridescentFoil-V1-Reference-1080p.mp4
4b00164fb7d15603ccd055ca532ffb859c0811f00ad04853fe385086575c4a94  IridescentFoil-V2-GoldSapphire-1080p.mp4
b16af0e4e22a335efa41d91343418194c84683ac807172a4b5debaa71fc8669f  SilverSatin-V1-Reference-1080p.mp4
ec4c44a82c55038207e9671420e075faf621515d742e7e106d2cb66a2d950a38  SilverSatin-V2-LowAngleDolly-1080p.mp4
8608c6824f5fc2d2fe99b93d44f39007a5e5a7c8479f702fc91d41e4b46f844e  iridescent-foil-remotion-4k-project.zip
abd6cbcfc00c5aa3cba409b8fac931ef9f692048c154d5ceb885046343566f4d  silver-satin-remotion-4k-project.zip
```
