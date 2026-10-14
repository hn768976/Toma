# Crypto Wallet Blocks — Remotion + three.js (WebGL2)

Four compositions from one shared 3D wallet kit. All are 3840×2160, 30 fps.

| Composition (Remotion id) | Output name | Story | Frames |
|---|---|---|---|
| `WalletBlocks-Blue` | `WalletBlocks_Blue` | Glass blocks fly in from the upper right in linked chains and dock one by one along the left and top edges. The balances tick up, then the docked edge pulses. | 300 (10 s) |
| `WalletSecure-Blue` | `WalletSecure_Blue` | A linked cloud of blocks swirls and docks. Three circuit panels slide out, a glass padlock drops in and its shackle clicks shut, then the scene holds. | 300 (10 s) |
| `WalletSecure-Gold` | `WalletSecure_Gold` | Same as Secure Blue, in the gold / amber colourway. | 300 (10 s) |
| `WalletSecure-HoldLoop` | `WalletSecure_HoldLoop` | The finished secure wallet as a seamless loop. Two light pulses run along the slab, the panels shimmer, the balances tick, loose blocks orbit, and the camera makes a closed ±10° orbit. | 600 (20 s) |

Remotion ids may only contain letters, digits and `-`, so the ids use `-` and the file names use `_`.

## Quick start

```bash
npm install
npx remotion studio          # the Studio preview is capped at a 0.5 device-pixel ratio so software GL stays responsive
```

## Rendering

The Chromium GL flag is `--gl=angle`. It is already set in `remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`), so you don't need to pass it. The config also sets H.264, `yuv420p`, CRF 16, PNG intermediate frames and a long `delayRender` timeout.

**4K masters (3840×2160):**

```bash
npx remotion render WalletBlocks-Blue      out/WalletBlocks_Blue.mp4      --gl=angle
npx remotion render WalletSecure-Blue      out/WalletSecure_Blue.mp4      --gl=angle
npx remotion render WalletSecure-Gold      out/WalletSecure_Gold.mp4      --gl=angle
npx remotion render WalletSecure-HoldLoop  out/WalletSecure_HoldLoop.mp4  --gl=angle
```

**720p previews** (exactly 1280×720; 3840 × 1/3 rounds cleanly):

```bash
npx remotion render WalletSecure-Blue out/WalletSecure_Blue.mp4 --scale=0.3333333333333333 --gl=angle
```

**6K stills (6000×3375 = 1.5625 × 3840×2160):**

```bash
npx remotion still WalletSecure-Blue out/WalletSecure_Blue_6K.png --frame=270 --scale=1.5625 --gl=angle
```

Good still frames are 270 for the three stories and 150 for the loop.

## Changing the wallet text or adding a colourway

Everything per version lives in **one data row** in `src/versions.ts`.

- **Wallet text:** edit `SCREEN.title` and the balance rows (`start`, plus `step` per docked block).
- **New colourway:** copy a row, give it a new `id` such as `WalletSecure_Green`, and point `palette` at a new palette object. The palette fields are `background`, `glow`, `floorSpot`, `rim`, `blockEdge`, `blockTint`, `accent`, `lock` and `screenText`. `Root.tsx` registers a composition for every row automatically.

## How it is built

- **Engine:** `@remotion/three` (`ThreeCanvas`) on WebGL2. The scene is built imperatively in `src/kit/world.ts`. In the React layer, `src/WalletScene.tsx` calls `world.update(frame)` and renders synchronously inside a layout effect, before `@remotion/three` releases the frame.
- **Post chain:** `postprocessing`, with half-float targets and 4× MSAA:
  1. render
  2. sanitize (NaN/Inf guard and highlight clamp)
  3. depth of field (focus on the wallet)
  4. mip-map bloom
  5. a final pass: tone curve (linear below 0.7, with a soft hue-preserving shoulder), then a ±1/255 TPDF dither and 1.5% grain

  The grain and dither come from an integer hash of (pixel, frame mod loop length). The grain fades to zero below about 3% luminance.
- **Resolution independence:** bokeh size and line widths scale with drawing-buffer height ÷ 720, and bloom gains one mip level per doubling of resolution. A 720p preview and a 4K master therefore frame and glow the same.
- **Determinism:** there is no `Math.random()`, `Date.now()`, `useFrame` clock, physics or carried state.
  - Every block path, docking order and timing is generated once at module load from seeded `mulberry32` streams, in `src/kit/timeline.ts`.
  - Each pose is then a pure function of (block, frame). R3F's `useFrame` is registered only at priority 1, to stop R3F drawing its own default scene; it reads no clock.
  - There is no TAA and no accumulative shadows.
  - Fonts load before the first frame through `delayRender` / `continueRender`.
- **No interpenetration:** paths are chosen by a seeded search that checks every frame with an exact oriented-box separating-axis test, block against block and block against the wallet body. `npm run check` re-verifies all frames of all stories.
- **Fonts:** Inter (SIL OFL 1.1) in `public/fonts/` with `OFL.txt`. The screen shows only generic text and code-drawn icons: no logos, coin symbols or brands.

## Measured render times (this build machine)

These were measured on a 4-core **CPU-only cloud container**. WebGL runs through ANGLE on **SwiftShader** (software rasterisation), so a machine with a real GPU behind ANGLE will be many times faster. Times are wall-clock for the whole `npx remotion render` run, so browser start-up and encoding are included.

**720p previews** (`--scale=0.3333333333333333`, concurrency 1; more concurrency did not help on this CPU):

| Composition | Frames | Wall time | **Per frame** |
|---|---|---|---|
| WalletBlocks-Blue | 300 | 516 s | **1.72 s** |
| WalletSecure-Blue | 300 | 570 s | **1.90 s** |
| WalletSecure-Gold | 300 | 563 s | **1.88 s** |
| WalletSecure-HoldLoop | 600 | 1171 s | **1.95 s** |

**One real 4K frame** (WalletSecure-Blue, frame 270, at the hold, 3840×2160):

| Measurement | Time |
|---|---|
| `remotion still --scale=1`, one cold frame including about 6 s of browser start-up | 29.5 s |
| `remotion render --frames=268-270 --scale=1`, three frames plus encode | 62.9 s, about **16–18 s per frame** |

At 720p a cold still takes 7.9 s with the same overhead, so 4K costs about 8.5× a 720p frame. That is in line with 9× the pixels.

**4K estimates on this CPU-only machine**, at about 17 s per frame:

| Composition | Frames | Estimate |
|---|---|---|
| Each 10 s story | 300 | about 85 min |
| HoldLoop | 600 | about 170 min |
| All four | 1500 | about 7 h |

With a hardware GPU expect a small fraction of that. GPU timings were not measured here.

## Banding check

`scripts/banding-check.py <file.mp4> <frame>` reads a frame **from the encoded mp4** (not the preview). It samples four lines:

- through the left glow;
- across the upper background;
- across the floor light pool;
- down the right side.

Each line is box-smoothed over 9 px, because the dither and grain are per-pixel noise by design. The script then reports the largest jump between neighbouring smoothed samples. Banding shows up as plateaus joined by jumps. Objects crossing a background line, such as the orbiting loose blocks in the loop, are masked out so that only the gradient is measured.

| Composition | Frame(s) | Worst smoothed jump (code values) | Result |
|---|---|---|---|
| WalletBlocks-Blue | 270 | 1.11 | pass |
| WalletSecure-Blue | 270 | 1.11 | pass |
| WalletSecure-Gold | 270 | 1.10 | pass |
| WalletSecure-HoldLoop | 0, 150, 300, 450 | 1.22, 1.17, 1.14, 1.11 | pass |

A frame contrast-stretched about 6× also shows smooth gradients with grain texture, and no contour steps.

## Completion checklist

- [x] 4 compositions at 3840×2160, 30 fps: three stories of 300 frames and a loop of 600. One data row per version.
- [x] three.js on WebGL2 via `@remotion/three`, with `--gl=angle`. No WebGPU and no PixiJS.
- [x] Inter (OFL) with its licence. Only generic text ("Wallet", balances) and code-drawn icons; no logos, coin symbols or brands.
- [x] Determinism: no `Math.random()` at render time, and every pose is a pure function of the frame.
  - The middle frame of each composition, rendered cold on its own, is **byte-identical** to the same frame inside a 4-thread multi-frame render.
  - Checked on WalletBlocks-Blue (f150), Secure-Blue (f150), Secure-Gold (f150) and HoldLoop (f300).
- [x] Loop: with the composition temporarily set to 601 frames, frames 0 and 600 are **byte-identical** PNGs.
- [x] 720p previews pass ffprobe: 1280×720, h264, yuv420p, 30/1, no audio stream, and exactly 10.0 s / 10.0 s / 10.0 s / 20.0 s.
- [x] The banding check on the encoded mp4s passes (table above).
- [x] No block ever passes through another block or the wallet: `npm run check` covers every frame of every story.
- [x] `npm install && npx remotion studio` works from a clean copy, and the TypeScript typecheck is clean.

## Scripts

- `npm run check`: frame-by-frame collision check, block against block and block against the wallet.
- `python3 scripts/banding-check.py out/X.mp4 270`: the banding check on an encoded file.
- `scripts/contact-sheet.sh out/X.mp4 sheet.png 0 60 120 ...`: a contact sheet from an encoded file.

