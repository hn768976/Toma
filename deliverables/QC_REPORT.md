# QC report: two 4K Remotion compositions, four 1080p deliverables

## Deliverables

| # | File | Composition (4K source) | What changes in V2 |
|---|---|---|---|
| 1 | `Composition1_V1_Reference_1080p.mp4` | `NetworkPlexus-V1-Reference` | (V1: matches the reference) |
| 2 | `Composition1_V2_CraneOrbit_1080p.mp4` | `NetworkPlexus-V2-CraneOrbit` | **Camera movement:** a wide, descending crane-orbit around the whole network replaces the hub-to-hub fly-through. Palette unchanged. |
| 3 | `Composition2_V1_Reference_1080p.mp4` | `MarketCrash-V1-Reference` | (V1: matches the reference) |
| 4 | `Composition2_V2_ArcticPalette_1080p.mp4` | `MarketCrash-V2-Arctic` | **Colour palette:** a cold electric-blue / cyan grade replaces ember red / orange. Same shot and timing. |
| 5 | `Composition1_NetworkPlexus_4K_RemotionProject.zip`<br>`Composition2_MarketCrash_4K_RemotionProject.zip` | Both versions of each composition (3840×2160) | Each ZIP contains the full Remotion project: source, config, `package.json` + `package-lock.json`, README and assets |

**Why these V2 choices.** Reference A is defined by its camera, a continuous fly-through, so a different camera movement is the strongest alternative that still keeps the concept. Reference B is defined by its ember-red "crash" colour, so a different palette is the clearest alternative there.

**Technology.** Both are Remotion 4 projects created with `npx create-video --blank` and rendered with Three.js and custom WebGL2 shaders. The shaders handle instanced sprites, line ribbons, SDF billboards, per-element depth of field, and a dithered vignette pass. Composition 2 also uses Canvas 2D ticker textures set in the bundled Oswald font (SIL OFL).

## 1. Technical checks on the four MP4s (ffprobe / ffmpeg)

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 |
|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Pixel format | yuv420p, BT.709, limited range | same | same | same |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames decoded | 650 | 650 | 400 | 400 |
| Reference frames | 650 | 650 | 400 | 400 |
| Duration | 21.667 s | 21.667 s | 13.333 s | 13.333 s |
| Reference duration | 21.667 s | 21.667 s | 13.333 s | 13.333 s |
| Audio | none (the reference has none) | none | none | none |
| Full-decode errors | 0 | 0 | 0 | 0 |
| Black segments (`blackdetect`) | none | none | none | none |
| Frozen segments (`freezedetect`) | none | none | none | none |
| Max frame-to-frame luma jump | 1.06 | 1.01 | 0.77 | 0.80 |
| One-frame flicker spikes | 0 | 0 | 0 | 0 |
| Size / bitrate | 22.7 MB / 8.4 Mb/s | 23.4 MB / 8.6 Mb/s | 17.1 MB / 10.2 Mb/s | 17.0 MB / 10.2 Mb/s |

Result: **PASS**. Every file renders and decodes completely. Each is exactly 30 fps, and its frame count and duration equal its reference's exactly.

## 2. Project ZIPs: integrity and clean-room reproduction

Steps run on a fresh extract in an empty directory:

- `unzip -t` reports no errors for either archive.
- Contents: `src/` (all source), `public/fonts/` (Oswald + licence, Composition 2), `remotion.config.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, eslint/prettier config, and `README.md` with the documented commands. `node_modules` and renders are excluded.
- `npm ci` succeeded for both projects.
- `npm run typecheck` (`tsc`) passed for both.
- `npx remotion compositions` lists all four compositions at **3840×2160, 30 fps**, with 650 / 650 / 400 / 400 frames.
- `npm run render:v1:4k` / `render:v2:4k` produced **native 3840×2160** H.264 for all four compositions (30-frame test segments). I inspected the frames at 100%: text and lines are crisp.
- `npm run render:v1` / `render:v2` (1080p) were re-rendered from the clean extract and compared with the delivered files over frames 300–329. SSIM is 0.992–0.994 and PSNR 47–51 dB, so the output is visually identical. The scenes are deterministic; the small residual comes from H.264 re-encoding of a segment versus the full clip.

Result: **PASS**.

## 3. Visual QA (independent review agent, three rounds)

A separate agent compared each version with its reference using contact sheets at matching timestamps and per-frame metrics (sharpness, frame difference, luma and saturation). I fixed each round's findings and re-rendered everything.

Fixes made as a result of the review:

- A one-frame white flash when the camera flew through a HUD panel (C1 V1, f283). Primitives now fade out when very close to the camera.
- Banding in the vignette. It is now a dithered WebGL pass.
- Output was tagged full-range (`yuvj420p`). It is now standard BT.709 `yuv420p`.
- C1 V1:
  - Background is teal-navy with deeper blacks.
  - Hubs have three broken arcs, denser pink/lavender sparkle and more satellites.
  - Added ringless sparkle clusters, foreground beams and a background constellation.
  - Hubs are now framed off-centre.
  - Focus pulls are rate-limited, so they no longer pop.
  - The ending flies past the last hub into darkness, as in the reference.
- C2:
  - The abrupt whip pull-back is replaced by a gentle pull-back with a rack-defocus into bokeh.
  - The grade is brighter and more saturated.
  - Spark bursts and flares are larger.
  - The LED chart is steeper and kept out of the ticker close-up.

Final sign-off verdict: **OK to ship**. No flashes, pops, glitches, black stretches or visible banding were found in any of the four files.

| | Fidelity to reference (agent score) | Notes |
|---|---|---|
| C1 V1 | 6 / 10 | Elements, palette, depth of field, pacing, opening and ending all match. Remaining differences: hubs read as full rings with starburst rays rather than the reference's partial C-arcs, the image is softer overall, and a few moments still frame a hub near the centre. |
| C1 V2 | Clearly distinct (pass) | Wide descending orbit with the same element set and palette. The first ~2 s are sparse, by design, while the network switches on. |
| C2 V1 | 7.5 / 10 | Structure and timing match beat for beat: wide flares → spark burst → LED chart → candles and tickers → ticker close-up → defocus ending. The LED ribbon is softer and pinker than the reference's. |
| C2 V2 | Clearly distinct (pass) | Fully re-graded cold blue with no orange left. Same shot. |

Remaining low-severity notes:

- C2 ending (f386–399): the camera keeps drifting slightly instead of holding still.
- Defocused panels overlap sharp ones in a few C1 shots (C1 V1 f330–345, C1 V2 f390–405). All remain readable.

## 4. Reproduce

```bash
unzip Composition1_NetworkPlexus_4K_RemotionProject.zip && cd network-plexus
npm ci
npm run render:v1        # 1080p deliverable (4K composition, --scale=0.5)
npm run render:v1:4k     # native 4K master
# same for render:v2; Composition 2 lives in market-crash/
```

Rendering uses `--gl=swangle`, so it needs no GPU. A full 1080p version takes about 4–6 minutes on 4 CPU cores.
