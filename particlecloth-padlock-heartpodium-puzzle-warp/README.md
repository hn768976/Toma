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

## Measured render times

All times were measured in a sandbox with **no GPU**: 4 CPU cores, with headless Chromium using ANGLE on top of SwiftShader, which is software WebGL2. On a machine with a real GPU, expect these to be many times faster. Treat them as an upper bound.

**720p previews** (full 600-frame PNG-sequence render, `--concurrency=2`, wall time ÷ 600):

| Composition | s / frame @ 720p |
|---|---|
| ParticleCloth-IceBlue | 0.63 |
| ParticleCloth-Gold | 0.72 |
| CircuitPadlock-Cyan | 1.75 |
| HeartPodium-PinkValentine | 1.76 |
| HeartPodium-WhiteGold | 1.90 (60-frame sample; the full run overlapped other work and read 3.2) |
| PuzzleSurface-White | 2.11 |
| PuzzleSurface-Graphite | 2.15 |
| WarpStreaks-Blue | 0.58 |

**Two real 4K frames** (3840×2160, `--scale=1`, frames 300–305, `--concurrency=1`). "Marginal" excludes browser start-up and world build:

| Composition | 1 frame incl. start-up | marginal s / frame |
|---|---|---|
| ParticleCloth-IceBlue (1A) | 7.7 s | **3.4 s** |
| HeartPodium-PinkValentine (3A) | 30.4 s | **11.5 s** |

**4K estimates** for 600 frames on this same CPU-only box. The 4K÷720p ratio measured on 1A (×5.2, particle-bound) is applied to Looks 1 and 5; the ratio measured on 3A (×6.5, fill-bound) is applied to Looks 2–4.

| Composition | est. s / frame @ 4K | est. full 4K render |
|---|---|---|
| ParticleCloth-IceBlue / Gold | 3.4 / 3.7 | ~34 / ~37 min |
| CircuitPadlock-Cyan | ~11.4 | ~1 h 55 min |
| HeartPodium-PinkValentine / WhiteGold | ~11.5 / ~12.4 | ~1 h 55 min / ~2 h 05 min |
| PuzzleSurface-White / Graphite | ~13.7 / ~14.0 | ~2 h 15 min / ~2 h 20 min |
| WarpStreaks-Blue | ~3.0 | ~30 min |

## Banding check

These readings come from frame 300 of each **encoded** 720p mp4 (decoded back to PNG), not from the preview. Luminance profiles were averaged over 16-px-wide strips and sampled every 8 px. No profile showed a flat run followed by a step of ≥1.5 levels.

- **Particle Cloth (1A/1B):** 99.95% of the empty background pixels (~198k) decode as exactly 0. The rest are ≤3/255 H.264 ringing next to beads. The grain is gated below ~3% luminance and the dither is skipped on black. The band's lower edge falls off 178 → 0 without plateaus.
- **Warp Streaks:** the dark areas average 0.5/255 and never exceed 3/255 away from streaks (the faint filaments and bokeh). Glow falloffs are smooth.
- **Circuit Padlock:** the dark teal board and the top haze vary continuously, with no flat-then-jump steps.
- **Heart Podium (3A/3B):** the backdrop wall rises smoothly from 139 to 163 (3A) and from 194 to 224 (3B) over 380 rows. The largest row-to-row change is 2.5 levels, which is grain noise and not a step.
- **Puzzle Surface (4A/4B):** the top haze changes 0.3 levels per 8 px, with a largest step of 1.4 and no plateaus.

How the banding is suppressed: half-float render targets for every three.js look (MSAA scene buffer and all post buffers) and for the PixiJS accumulation buffer, a ±1/255 triangular dither in the final pass, and 1.5% grain from a fixed hash of (pixel, frame % 600).

## Completion checklist

- [x] 8 compositions at 3840×2160, 30 fps, 600 frames, one data row per version (`src/versions.ts`)
- [x] Look 1 in PixiJS 8 on WebGL2 (204,800 points, projected in the vertex shader); Looks 2–5 in three.js through `@remotion/three` on WebGL2
- [x] 720p previews: 1280×720, h264, yuv420p, 30/1, 20.0 s, no audio (ffprobe, all 8)
- [x] Loop: in the 601-frame variant (`loopCheck`), frame 600 is pixel-identical to frame 0 (all 8). The 599→0 difference matches a normal frame step.
- [x] Determinism: frame 300 rendered cold on its own is **byte-identical** to frame 300 of the full multi-threaded render (all 8)
- [x] Banding checked on the encoded mp4 (above)
- [x] No `Math.random()`, `Date.now()`, TAA or `AccumulativeShadows`. Seeded `mulberry32` at module level.
- [x] No text, logos or brands. Gift boxes are plain with ribbons.
- [x] `npm install && npx remotion studio` works from a clean copy (checked)

## Notes and deliberate deviations

- **Particle size and blending (Look 1).** The prompt asked for 1–1.5 px additive points. In the reference, though, the sheet is made of distinct round beads. At 204,800 points, additive 1–1.5 px dots merge into haze. The beads are therefore about 4–6 px at 720p (scaled with resolution, so 12–18 px at 4K). They are shaded like small spheres and drawn with **MAX** blending, which is order-independent and so still deterministic. Brightness still rises where points bunch up, using a projected-cell-area density term. To restore the literal spec, set the size back in `ParticleCloth.tsx` and change `blendMode` to `"add"`.
- **Puzzle scale.** The reference shows about 4–5 pieces across the frame. The prompt asked for about 20×14 in view. The comparison agents pulled in both directions, so the result sits in between: about 6 across at the focus band and about 14 visible rows into the haze.
- **Puzzle loop.** The camera slides exactly one piece width per loop. For frame 600 to equal frame 0, the cut pattern must repeat every column, so each row has its own seeded tab/blank shape repeated along the row (one instanced mesh per row shape). Per-piece tint variation is per row for the same reason.
- **Puzzle lifting pieces.** The three lifting pieces are separate meshes with a frame-driven contact-shadow decal; they don't cast into the shadow map. Moving casters in three's shadow pass carried state from the previously rendered frame, which broke the byte-for-byte check.
- **Heart Podium key light** comes from the upper left, as specified. The reference is lit from the right.
- **Warp Streaks background** is pure black, as specified. The reference has a faint navy haze.
