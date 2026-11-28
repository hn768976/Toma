# city-growth

A 15-second motion graphic of a stylised white-and-blue city growing outward from a single street
on a pale cyan island: streets draw on, Voronoi ground tiles spread, buildings appear as
construction-line ghosts and rise, elevated roads sweep around the centre.

Built with Remotion 4, three.js (WebGL 2) and React Three Fiber. Everything is procedural and
generated from one seed; there are no textures, models, fonts or other assets to load.

| Composition      | Size      | Fps | Frames | What it is                                       |
| ---------------- | --------- | --- | ------ | ------------------------------------------------ |
| `V1-city-growth` | 3840x2160 | 30  | 450    | Version 1: follows the reference camera          |
| `V2-city-growth` | 3840x2160 | 30  | 450    | Version 2: same design, a different camera move  |
| `LookDev`        | 3840x2160 | 30  | 3      | The three look-development stills (start, peak, settled) |

## Install

```
npm ci
```

Node 20.19+, 22.13+ or 24+. The lockfile pins every package to an exact version.

## Render

4K masters (the compositions are native 3840x2160):

```
npx remotion render V1-city-growth out/V1-city-growth-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-city-growth out/V2-city-growth-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
```

One 4K frame (quick test):

```
npx remotion still V1-city-growth out/V1-frame.png --frame=225 --scale=1 --gl=angle
npx remotion still V2-city-growth out/V2-frame.png --frame=225 --scale=1 --gl=angle
```

1080p (how the delivered MP4s were made):

```
npx remotion render V1-city-growth out/03-V1-city-growth.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-city-growth out/04-V2-city-growth.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
```

Preview: `npm run dev`.

`remotion.config.ts` sets PNG intermediate frames and the ANGLE GL renderer. It also uses a
headless shell at `/opt/pw-browsers/chromium_headless_shell` if that file exists (a sandboxed build
machine); on any other machine the path does not exist and Remotion downloads and uses its own
browser as usual.

## Version 2: what changes and why

**Only the camera movement.** The city, its growth timing, the light and the grade are identical;
`CAMERAS.v2` in `src/config.ts` is the single difference.

- Version 1 follows the reference: a three-quarter view that starts over the first street,
  drifts sideways while it tilts down and pulls back, eases to a stop at 11.5 s and holds.
- Version 2 starts as a straight-down plan view (the streets spread like a map), then cranes
  down and orbits the opposite way into a low view across the skyline, and is still moving on
  the last frame.

The camera was chosen because the reference is defined by its restrained cyan palette (a new
palette would fight the look that was matched) and its framing changes little, so the move is the
element that can change most visibly while the design stays the same.

## Where to change things

| What                                   | File            |
| -------------------------------------- | --------------- |
| Colours (surface albedos)              | `src/config.ts` -> `CONFIG.colors` |
| Counts and sizes (island radius, street spacing and widths, tower chance and heights, parks, pillars) | `src/config.ts` -> `CONFIG` |
| Timings (street front, tile front, building front, ghost lead, rise time, elevated roads) | `src/config.ts` -> `roadFront`, `tileFront`, `buildFront`, `ghostLead`, `riseTime`, `highwayStart`, `highwaySpeed` |
| Camera moves (both versions) and lens  | `src/config.ts` -> `CAMERAS`, `CAMERA_FOV` |
| Duration, fps, size                    | `src/config.ts` -> `DURATION_IN_FRAMES`, `FPS`, `WIDTH`, `HEIGHT` |
| A different city                       | `src/config.ts` -> `CONFIG.seed` |
| Exposure, tone mapping, lift/gain, sun and sky light, shadows, fog, bloom, glass glow, tile size, grain, vignette, softness | `src/look.ts` |

Surface colours are deliberately near neutral: the cyan cast of the picture comes from the
light and the grade in `src/look.ts`.

## How it works

- `src/city/layout.ts` builds the city once at module scope (seeded `mulberry32`): coast, bent
  street grid, street distances from the centre, blocks, buildings, elevated roads, pillars.
- `src/city/scene.ts` turns that into a three.js scene: one instanced mesh for every box
  (buildings, podiums, roof details, pillars), one for the construction-line ghosts, and
  shader-driven draw-on for the streets, tiles and elevated roads. `update(t)` sets a handful of
  uniforms and the camera for time `t`; nothing keeps its own clock.
- `src/render/post.ts` renders the scene into a half-float 4x MSAA target, builds a small bloom
  pyramid, and the final full-screen pass applies softness, chromatic aberration, bloom, the
  tinted vignette, ACES tone mapping, sRGB, lift/gain, grain and a 1/255 dither.
- `src/CityGrowth.tsx` does all of that in a `useLayoutEffect` keyed on `useCurrentFrame()`.
  There is no `useFrame`, `requestAnimationFrame`, `Math.random()` or `Date.now()`, so any frame
  rendered on its own is identical to the same frame in a full render.

## Scripts

- `scripts/measure-look.py` (Python 3, numpy + Pillow) measures exposure, colour, glow, haze,
  grain, detail and vignette of a frame, or compares two frames.
- `scripts/lookdev.sh <dir with reference frames f45.png f112.png f337.png>` renders the three
  LookDev stills and writes `lookdev/compare-<moment>.png` and `lookdev/measure-<moment>.json`.

## Render time

Measured on a 4-core cloud machine with no GPU (software GL / SwiftShader), `--concurrency=2`:

| Output | Per frame | Whole video (450 frames) |
| ------ | --------- | ------------------------ |
| 1080p (`--scale=0.5`), machine otherwise lightly loaded (40-frame test) | about 1.7 s | about 13 min |
| 1080p (`--scale=0.5`), the delivered files, rendered while three other renders shared the 4 cores | 3.4 - 3.7 s | 25 min 08 s (V2) and 27 min 37 s (V1) |
| 4K (`--scale=1`), estimated: 4x the pixels of the lightly loaded 1080p figure | about 7 s | about 50 min |
| 4K (`--scale=1`), measured on single frames under the same heavy load (one tab) | 18.7 s | (about 2 h 20 min if the load stayed that high) |

A machine with a real GPU will be many times faster.
