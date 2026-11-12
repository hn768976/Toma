# Quality-Control Report: Quantum Data Chip and Barcode Data Network

All four videos and both project ZIPs passed every check below.

## Deliverables

| # | File | Content |
|---|---|---|
| 1 | `Version 1 - Quantum Data Chip (1080p).mp4` | Composition A, matched to reference A |
| 2 | `Version 2 - Quantum Data Chip - Ember Gold Palette (1080p).mp4` | Composition A, alternative **colour palette** |
| 3 | `Version 1 - Barcode Data Network (1080p).mp4` | Composition B, matched to reference B |
| 4 | `Version 2 - Barcode Data Network - Low-Angle Orbit Camera (1080p).mp4` | Composition B, alternative **camera angle and movement** |
| 5a | `Quantum Data Chip - 4K Remotion Project (V1+V2).zip` | 4K project: `QuantumDataChip-V1` and `QuantumDataChip-V2` |
| 5b | `Barcode Data Network - 4K Remotion Project (V1+V2).zip` | 4K project: `BarcodeDataNetwork-V1` and `BarcodeDataNetwork-V2` |

**How it was built:**
* Both projects were scaffolded with the Remotion CLI (`create-video`).
* The scenes use Three.js on WebGL 2 with custom GLSL shaders: instanced anti-aliased geometry, depth of field computed from the ground plane, bloom, and a grade pass with dither.
* The compositions are authored at 3840×2160. The final videos were rendered from those 4K compositions with `--scale=0.5`.

**Choosing the V2 alternatives:**
* **Quantum Data Chip V2: colour palette.** The reference's identity is a glowing blue chip on a fixed, almost static camera. A palette change (molten amber/gold data with cyan sparks) gives the clearest alternative while keeping the framing, motion and timing.
* **Barcode Data Network V2: camera.** The reference is monochrome print-style. Recolouring it would lose its look, so V2 changes the camera: a low, grazing dolly that orbits about 34°, banks about 9° and travels about 3× faster along the data.

## 1. Technical checks on the final MP4s

The checks were run with `tools/qc_video.py`, using ffprobe and ffmpeg (full decode, blackdetect, freezedetect, signalstats).

| Check | A V1 | A V2 | B V1 | B V2 |
|---|---|---|---|---|
| Container / codec | MP4 / H.264 High, yuv420p | same | same | same |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames / duration | 301 / 10.033 s | 301 / 10.033 s | 551 / 18.367 s | 551 / 18.367 s |
| Same as reference (frames / duration) | ✅ 301 / 10.033 s | ✅ | ✅ 551 / 18.367 s | ✅ |
| Full decode errors | 0 | 0 | 0 | 0 |
| Black frames (blackdetect) | none | none | none | none |
| Frozen segments (freezedetect) | none | none | none | none |
| Flicker spikes / max frame-to-frame luma jump | 0 / 0.61 | 0 / 0.66 | 0 / 1.64 | 0 / 1.73 |
| Luma range (Y) | 27.5–50.2 | 27.2–53.6 | 196.5–220.7 | 195.4–220.7 |
| Audio | none (the references have no audio) | none | none | none |
| Bitrate | 7.7 Mb/s | 7.9 Mb/s | 10.2 Mb/s | 10.1 Mb/s |

**Gradient banding:** H.264 initially caused banding in the dark gradients of A. A triangular-PDF dither plus CRF 12 with the `slow` preset fixed it. A 5× contrast-boosted inspection now shows clean gradients in both versions.

## 2. Project ZIP checks

* **Integrity:** `zip -T` passes for both archives.
* **Contents:** each archive holds the complete 4K compositions:
  * `src/` (compositions, scenes, the WebGL engine and shaders)
  * `package.json` with render scripts, and `package-lock.json`
  * `remotion.config.ts`, `tsconfig.json`, `eslint.config.mjs`
  * `README.md` with the commands
  * `public/`

  There are no external assets: everything is procedural and seeded, so renders are deterministic. `node_modules` and outputs are excluded.
* **Clean-room test:** each ZIP was extracted into an empty folder.
  * `npm ci` installed the dependencies, then typecheck and lint passed for both projects.
  * The extracted `src/` is byte-identical to the source used for the deliverables.
* **4K render from the extracted projects:**
  * `npx remotion still <id> … ` produced 3840×2160 stills for all four compositions.
  * `npx remotion render QuantumDataChip-V1 … --frames=150-164` produced a valid 3840×2160, 30 fps H.264 file.
  * Downscaled 4K stills match the delivered 1080p frames: PSNR 33 dB for A and 38 dB for B. This confirms the 1080p videos come from the same 4K compositions.

## 3. Reference-match verification (independent review agent)

A separate review agent compared each render with its reference. It used frames side by side at matching timestamps, zoomed crops, luma and chroma curves over time, and phase-correlation motion measurements. I iterated on its findings over several rounds.

| Composition | First review | Final review | Main fixes from the review loop |
|---|---|---|---|
| A V1 | 4/10 | **8/10** | Long-lens, low, rolled camera so the bands run at about 30° and the ticks read horizontal; full-frame band coverage; chip scale and glow; build timing (chip glow from 0.4 s, centre band from about 2.5 s, full by about 5.5 s); exposure and hue matched (Y 50.3 vs 50.3, U/V within about 1) |
| B V1 | 6/10 | **8/10** | Row density; bold foreground blocks; fan bundles in place of random plexus lines; row angle; 2 s build-in timed like the reference; drift speed; brightness matched (Y about 198) |
| A V2 | — | **Pass** | Clearly distinct warm palette; same concept, timing and motion; no clipping, banding or artifacts |
| B V2 | — | **Pass** | Clearly distinct camera (steep to grazing orbit, 2–3.5× screen motion); concept and quality kept; no aliasing, shimmer, popping or flicker |

**Known remaining differences** (stylistic, not structural):
* **A:** the band micro-texture is slightly blockier than the reference's crisp comb ticks.
* **B:** the network fans are a little sparser and steeper than the reference's in places.
