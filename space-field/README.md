# Space particle field

Six 4K looping space animations, built as one Remotion project. They come in
two families:

**Warp bursts** — 168 frames, 5.6s at 30fps. Particles streak radially outward
from a core, accelerating as they go.

| Composition | What it is |
| --- | --- |
| `WarpBlue` | Off-centre core with a warm amber ring in a cold blue field. ~5000 particles, moderate nebulosity. |
| `WarpViolet` | Centred white core with a violet halo and no warm ring — colder, more synthetic. ~9000 smaller particles, longer streaks, light dust, and sector bursts every 30-55 frames. |
| `WarpAmber` | The blue version inverted: a cool teal ring in a warm field, on the opposite side of the frame. ~2500 larger particles, shorter streaks, heavy dust. |

**Starfields** — 390 frames, 13.0s at 30fps. Particles hold as points while the
field drifts on a closed path.

| Composition | What it is |
| --- | --- |
| `FieldBlue` | ~14000 stars over a diagonal band of nebulosity. Star density follows the band. |
| `FieldTeal` | ~7000 stars in open space: no band, uniform density, isolated clouds and real voids. |
| `FieldMono` | ~22000 stars on pure black, no dust, no colour, with ~25 large stars carrying four-point diffraction spikes. |

All six loop seamlessly and carry no text, logo, watermark or audio.

## Running it

```sh
npm install
npm run dev                       # Remotion studio
npx remotion render WarpBlue out/warp-blue.mp4 --codec=h264 --crf=12 --concurrency=8
```

Add `--scale=0.5` for a 1080p preview instead of full 4K. `--concurrency` must
not exceed the machine's core count.

## How it works

One particle system serves both families. `mode` on a variant is `"streak"` or
`"point"`; that decides whether a particle flies radially from a core or holds
station in a drifting field. Everything else that separates the six versions —
palette, density, size and brightness distributions, core, dust weight,
timing — is a value in `src/variants.ts`, which is also the only file in the
project containing a colour.

Every layer is a pure function of the frame number. There is no `Date.now()`,
no `requestAnimationFrame`, no CSS animation and no component state, and all
randomness comes from Remotion's `random()` with fixed string seeds. Each layer
draws to its own 2D canvas once per React render — no 3D, no WebGL.

| File | What it holds |
| --- | --- |
| `src/variants.ts` | All six configurations. The only place a hex colour appears. |
| `src/particles.ts` | The shared particle system, dust blobs, and the timed burst and flare events. Generated once and reused every frame. |
| `src/components/` | One component per layer: `BackgroundWash`, `DustClouds`, `ParticleLayer`, `CoreFlare`, `FilmFinish`. |

The dust layer is computed at 1/8 resolution, blurred there and upscaled — it
is all soft gradient, so nothing visible is lost and the blur costs a fraction
of what it would at full size. Particles are always drawn at full resolution.
Bloom works the same way, at a quarter of each axis.

## Verifying the loop

```sh
scripts/verify-loop.sh WarpBlue 168
```

Renders the first frame and the frame exactly one loop later and compares them
byte for byte. All six pass.

## Packaging

```sh
node scripts/package.mjs dist
```

Writes six standalone zips, one per version, each containing only that
version's configuration and its own README.
