# QC Report: Hydrogen Molecules & Light Tunnel

Both compositions are authored at **3840×2160 / 30 fps** in Remotion 4.0. Final videos are rendered from those 4K compositions at `--scale=0.5`, giving 1920×1080.

## Deliverables

| # | File | Size | SHA-256 |
|---|------|------|---------|
| 1 | `Version-1-Hydrogen-Molecules-Match-1080p.mp4` | 6.5 MB | `2b85a7c584fc4854bdc8190924390500710dd3a713a194a2426c42ceaa34d8f9` |
| 2 | `Version-2-Hydrogen-Molecules-Orbit-Camera-1080p.mp4` | 8.1 MB | `5d42f8ac4656e9a752a206ab3bed73b332924f6365dd39502f5ec2d5d7a01b9c` |
| 3 | `Version-1-Light-Tunnel-Match-1080p.mp4` | 54.9 MB | `d69df15c186e6e3ad78acf64ba3fcb523a0cc341c9d4e15a0ac6799f350bf0ce` |
| 4 | `Version-2-Light-Tunnel-Solar-Gold-1080p.mp4` | 55.9 MB | `ff276ba8bb2c3be248d5f57ad96f0ebe977dfe4896e9d5172ef271cb8e564122` |
| 5a | `Hydrogen-Molecules-4K-Remotion-Project.zip` | 320 KB | `32553ebba24c4b4f0308aba25e8638e86dcb6deb5537d261e82164cc72cb5c8f` |
| 5b | `Light-Tunnel-4K-Remotion-Project.zip` | 55 KB | `aa91ef7b533d639e47bf1cd5691deffcd5fc0210d5fb4aa99324a6038357b7c9` |

Verify integrity with `sha256sum -c SHA256SUMS.txt` (run in this folder).

## 1. Technical checks on the videos (ffprobe + full ffmpeg decode)

| Check | H₂ V1 | H₂ V2 | Tunnel V1 | Tunnel V2 |
|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Pixel format / range | yuv420p, BT.709 TV | same | same | same |
| Frame rate (r / avg) | 30/1 | 30/1 | 30/1 | 30/1 |
| Frames | 421 | 421 | 864 | 864 |
| Duration vs reference | 14.033 s vs 14.04 s (−6.7 ms)² | same² | 28.800 s vs 28.80 s (0 ms) | 28.800 s (0 ms) |
| Decode errors (full decode) | none | none | none | none |
| Black frames (blackdetect) | none | none | none | none |
| Frozen frames (freezedetect) | none | none | none | none |
| Flicker (max frame-to-frame luma jump) | 2.28 | 3.19 | 0.85 | 0.93 |
| Audio streams | 0 | 0 | 0 | 0 |
| **Result** | **PASS** | **PASS** | **PASS** | **PASS** |

² The hydrogen reference is 14.04 s, which is 421.2 frames at 30 fps. A 30 fps file can only be a whole number of frames, so 421 frames (14.033 s) is the closest possible length. The difference is 6.7 ms, less than a quarter of a frame.

**Flicker:** no frame-to-frame luma spikes above threshold. The largest jumps in the hydrogen videos come from the intended white-out fade at the start.

**Audio:** the hydrogen reference contains only a silent placeholder track (−91 dB), and the tunnel reference has no audio. The outputs therefore have no audio track.

## 2. Matching against the references (independent reviewer agents)

A separate reviewer agent was assigned to each composition. Each compared reference and render side by side at multiple timestamps, checked frame statistics, and looked for artifacts. Reported issues were fixed and the videos re-reviewed until no blocking issues remained.

| Composition | Rounds | Final score | Main fixes made along the way |
|---|---|---|---|
| Hydrogen V1 (match) | 4 | 8/10 (artifacts 9/10) | Hero bond length and neck seam; white-out opening; settled-phase drift; density of the cloud |
| Hydrogen V2 (orbit camera) | 4 | 8/10 | Reduced clutter; hero placed on the left third |
| Tunnel V1 (match) | 3 | 7.5/10 | Fixed the angular seam; deeper blacks (darkest 10% average luma 27.6 → 20.8, reference 16.8); hotter highlights (brightest 10% average 117 → 138, reference 133); stronger glow blobs; breathing iris; no ray strobing |
| Tunnel V2 (solar gold) | 1 | 8/10 | Gold palette rebalanced from too bright to a level matching V1 |

The final tunnel review found **no blocking issues**: no seams, flicker, strobing or visible banding. The remaining notes are stylistic. V1 is slightly cleaner than the reference, with thinner rings and fewer sparkle hotspots.

## 3. V2 versions are clearly distinguishable

- **Hydrogen V2: different camera angle and movement.** V1 matches the reference's straight-on fly-in and settle. V2 is a low orbital crane move that sweeps about 75° around the hero molecule. It frames the hero on the left third and opens with a softer white fade. The palette stays the same, so the molecule's identity is preserved.
- **Tunnel V2: different colour palette.** V1 is electric blue on near-black. V2 is solar gold: amber, orange and red-orange glow with white-yellow hot cores, a mean hue of 146° against 297° for V1. Geometry and motion are identical, so the only change is the colour treatment.

## 4. Project ZIPs: completeness and clean-room test

**Contents of each ZIP:**
- Full Remotion project: `src/`, `public/`, `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json` and `README.md`.
- Hydrogen only: the Inter Bold font plus its OFL licence.
- `node_modules/`, `out/` and build output are excluded; they are recreated by `npm ci` and rendering.

**Integrity:** `unzip -t` reports no errors for either archive. The extracted `src/` is byte-identical to the repository sources.

**Clean-room test:** each ZIP was extracted into an empty directory and run with only the documented commands.

| Step | Hydrogen | Light Tunnel |
|---|---|---|
| `npm ci` | OK (338 packages) | OK (338 packages) |
| `tsc` type-check | OK | OK |
| `npx remotion compositions` | 2 comps, 3840×2160, 30 fps, 421 frames | 2 comps, 3840×2160, 30 fps, 864 frames |
| `npm run render:v1:4k` | OK, 3840×2160 H.264 30 fps | OK |
| `npm run render:v2:4k` | OK, 3840×2160 | OK |
| `npm run render:v1/v2:1080p` | OK, 1920×1080 | OK |
| `npm run still:4k` | OK, sharp 3840×2160 PNG | OK |

The render steps used a frame subset to save time. The full 1080p renders are the delivered videos above.

**Sandbox note:** the test sandbox has no internet access to Remotion's Chrome download. There, renders need `REMOTION_BROWSER=/path/to/chrome-headless-shell`, as documented in the README. On a normal machine Remotion downloads its browser automatically.

## 5. Technology

- **Hydrogen Molecules:** Canvas 2D with a 2.5D renderer.
  - Seeded 3D molecule field with a perspective camera.
  - Per-molecule depth-of-field blur.
  - Pre-rendered glossy "H₂" atom sprites at 14 mip levels for crisp 4K.
  - Zoom-blur and white-out post effects.
- **Light Tunnel:** a single WebGL 2 (GLSL ES 3.00) fragment shader.
  - Seam-free periodic noise.
  - Flying hero rings, rays, glow blobs and a breathing iris.
  - Filmic tonemap.
  - 2-tap supersampling at 1080p.
- **Rendering:** GL backend is `swangle` (works on GPU-less machines). Output is H.264, CRF 16, BT.709.
