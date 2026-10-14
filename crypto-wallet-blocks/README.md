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

<!-- RESULTS -->
