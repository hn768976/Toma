# Particle Cloth · Circuit Padlock · Heart Podium · Puzzle Surface · Warp Streaks

One Remotion project with five looks and eight compositions. Every composition is a **20 s seamless loop** (600 frames at 30 fps), defined at **3840×2160**.

| Composition id | Output file | Look | Engine |
|---|---|---|---|
| `ParticleCloth-IceBlue` | `ParticleCloth_IceBlue` | 1A Particle Cloth, ice blue | PixiJS 8 (WebGL2), 204,800 points projected in a vertex shader |
| `ParticleCloth-Gold` | `ParticleCloth_Gold` | 1B Particle Cloth, gold | PixiJS 8 |
| `CircuitPadlock-Cyan` | `CircuitPadlock_Cyan` | 2 Circuit Padlock | three.js via `@remotion/three` |
| `HeartPodium-PinkValentine` | `HeartPodium_PinkValentine` | 3A Heart Podium, pink | three.js |
| `HeartPodium-WhiteGold` | `HeartPodium_WhiteGold` | 3B Heart Podium, white and gold | three.js |
| `PuzzleSurface-White` | `PuzzleSurface_White` | 4A Puzzle Surface, white | three.js |
| `PuzzleSurface-Graphite` | `PuzzleSurface_Graphite` | 4B Puzzle Surface, graphite | three.js |
| `WarpStreaks-Blue` | `WarpStreaks_Blue` | 5 Warp Streaks | three.js |

## Setup

```bash
npm install
npx remotion studio          # preview
```

Pinned versions: `remotion` / `@remotion/cli` / `@remotion/three` 4.0.515, `pixi.js` 8.20.1, `three` 0.185.1, `@react-three/fiber` 9.7.0, `react` 19.2.3.

### Chromium GL flag

All looks need WebGL2. In headless Chromium use ANGLE:

```
--gl=angle
```

`remotion.config.ts` already sets `Config.setChromiumOpenGlRenderer("angle")`, so the flag is only needed when you call the renderer some other way. On a machine with a GPU, ANGLE uses that GPU. Without one it falls back to SwiftShader, which is a CPU implementation and much slower.

## 4K render commands (one per composition)

```bash
npx remotion render ParticleCloth-IceBlue     out/ParticleCloth_IceBlue.mp4     --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render ParticleCloth-Gold        out/ParticleCloth_Gold.mp4        --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render CircuitPadlock-Cyan       out/CircuitPadlock_Cyan.mp4       --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render HeartPodium-PinkValentine out/HeartPodium_PinkValentine.mp4 --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render HeartPodium-WhiteGold     out/HeartPodium_WhiteGold.mp4     --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render PuzzleSurface-White       out/PuzzleSurface_White.mp4       --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render PuzzleSurface-Graphite    out/PuzzleSurface_Graphite.mp4    --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
npx remotion render WarpStreaks-Blue          out/WarpStreaks_Blue.mp4          --codec=h264 --crf=16 --pixel-format=yuv420p --gl=angle
```

On a GPU machine you can raise `--concurrency`. Each tab holds its own WebGL context.

## 6K stills (6000×3375)

`--scale=1.5625` gives 3840×2160 × 1.5625 = 6000×3375. For example:

```bash
npx remotion still HeartPodium-PinkValentine out/HeartPodium_PinkValentine_6K.png --frame=300 --scale=1.5625 --gl=angle
```

Change the id and file name for the other compositions. Every size in the shaders scales with the drawing-buffer height, so 6K output matches the 4K look.

## 720p previews

```bash
npx remotion render <id> <dir> --sequence --image-format=png --scale=0.3333333333333333 --gl=angle
ffmpeg -framerate 30 -i <dir>/element-%03d.png -c:v libx264 -crf 16 -pix_fmt yuv420p -an <File>.mp4
```

`--scale=0.3333333333333333` gives exactly 1280×720 (ffprobe-checked). The previews were rendered as a PNG sequence and then encoded, so frame 300 of the full render could be compared byte for byte with a cold single-frame render. `npx remotion render <id> out.mp4 --scale=0.3333333333333333 --crf=16` produces the same frames.

## How to add a colourway

Every version is one data row in `src/versions.ts`. Copy a row, give it a new `id` (letters, digits and `-` only) and a new `fileName`, and change the colours:

```ts
{ id: "ParticleCloth-Rose", fileName: "ParticleCloth_Rose", look: "particleCloth", props: { light: "#FFE8EE", deep: "#E07898" } },
```

`src/Root.tsx` registers every row as a 3840×2160, 600-frame composition.

## Determinism and loops

- All motion is a function of `loopFrame = frame % 600`. Every periodic term completes a whole number of cycles in 600 frames: time on a circle `θ = 2π·loopFrame/600` for the 4D noise, integer wrap counts for streaks, dashes and pulses, and integer bob and turn cycles. The camera moves on closed paths. The puzzle camera slides exactly one piece width per loop; to make that seamless, each puzzle row repeats one cut shape along the slide axis.
- `mulberry32` is seeded at module level. Circuit layouts, puzzle shapes, streaks, dashes and particle seeds are generated once at import time.
- Nothing reads `Math.random()`, `Date.now()`, the R3F clock or React state for visuals. In three.js scenes, R3F's `useFrame(…, 1)` is used only as the "draw now" hook that `@remotion/three` triggers once per frame, and it reads the Remotion frame from a ref. PixiJS has no ticker: the stage is rendered by hand once per Remotion frame.
- There is no TAA and no `AccumulativeShadows`. The post pipeline (`src/lib/post.ts`) runs half-float MSAA scene → fixed-kernel SSAO → half-res scatter-as-gather depth of field with a fixed Vogel disk → mip-chain bloom → final grade. Every step is per-frame and stateless.
- Textures are canvas-generated and uploaded (`renderer.initTexture`) while the world is built, behind a `delayRender` handle that is released once the world exists. PixiJS's async `init()` is also held by `delayRender`.
- Grain (1.5%) and the ±1/255 triangular dither are a fixed hash of pixel position and `frame % 600` (`src/lib/grain.glsl.ts`). For Particle Cloth and Warp Streaks the grain fades to zero below about 3% luminance and the dither is skipped on exact black, so the black stays at 0.

`--props='{"loopCheck":true}'` makes any composition 601 frames long, so frame 600 can be rendered and compared with frame 0.

<!-- MEASUREMENTS -->
