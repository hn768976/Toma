# Cinematic Lens Flare Overlay

A procedural lens flare plate for Remotion. Two colour versions, both
**3840×2160, 30 fps, 450 frames (15 s)**, on pure black.

| Composition id      | Look                                          |
| ------------------- | --------------------------------------------- |
| `V1-LensFlareWarm`  | warm white → pale amber → deep brown-red      |
| `V2-LensFlareCool`  | cool blue-white → pale blue → deep navy       |

## This is an overlay plate, not a background

It is built to be laid **over** other footage with a **screen** or **add**
blend, not shown on its own.

The background is `#000000` — genuinely, not approximately. Every element in
the shader passes through a smooth floor gate that drives the far field to an
exact zero, so untouched regions encode as `0,0,0` and the plate adds nothing
where there is no flare. There is **no vignette** anywhere in the piece: a
vignette in an overlay darkens the edges of the shot underneath it.

mp4 carries no alpha and does not need to. Warm light on pure black keys
perfectly with a screen blend — drop the clip on a track above your footage
and set the blend mode to Screen (or Add / Linear Dodge for a hotter result).
No mattes, no keying, no rotoscoping.

The grain and the gradient dither are both gated by local brightness, so they
exist only where there is light. Grain over black survives a screen blend as
visible noise on someone else's footage; here there is none to survive.

## Rendering at 4K

The compositions are defined at 3840×2160. Render at full size with:

```bash
npm install
npx remotion render V1-LensFlareWarm out/V1_LensFlareWarm.mp4 --scale=1 --crf=14
npx remotion render V2-LensFlareCool out/V2_LensFlareCool.mp4 --scale=1 --crf=14
```

`--scale=0.5` gives a 1920×1080 preview from the same compositions. Every
size in the shader is expressed as a fraction of frame height, and the canvas
is sized from `devicePixelRatio` (which carries `--scale`), so a preview and a
4K render are the same image at two resolutions rather than two similar ones.

Keep CRF at 14 or below. At higher CRF the encoder starts lifting the black
and banding the wide falloffs, which is exactly what an overlay cannot afford.

To open the studio:

```bash
npx remotion studio
```

## How it is put together

Everything is one WebGL fragment shader, composited additively in linear light
and encoded to sRGB as the final step. There are no image assets.

- **Bloom** — three inverse-square-ish lobes at different scales (tight
  near-white core, main body, broad haze). The source is always outside the
  frame, above the top edge, so what reaches the frame is a spill rather than
  a visible disc.
- **Anamorphic streak** — a soft horizontal band through the implied source,
  plus the wider faint halo that always accompanies one.
- **Diagonal rays** — four soft rays fanning down-right, each a narrow
  gaussian core inside a much wider halo so they read as light rather than as
  drawn lines.
- **Ghosts** — six soft blobs, round and hexagonal, spaced along the axis
  running from the source through frame centre and out the far corner.
- **Iris ring** — one thin partial elliptical arc, present only while the
  flare is in the brighter half of its swell. It is the only element in the
  piece with a defined edge.
- **Chromatic fringing** — the ghosts and the ring are sampled at slightly
  different radii and positions per channel (~2.5 px at 4K), which puts a
  pink/green fringe on their edges. It is meant to be felt rather than seen.

The whole thing moves as one optical system: as the implied source travels
across the top of frame, the ghosts slide along the axis, the streak and ray
fan roll with it, and the ring shifts. Intensity swells once, peaking around
frame 180, and subsides. The plate fades from and to true black at the clip
edges, so it can be cut against anything.

Nothing in the render depends on state or on `Math.random()` — every value is
a pure function of `useCurrentFrame()`, and the ghost layout comes from a
seeded PRNG at module scope. Remotion renders frames out of order across
threads, and this renders identically however the work is split.

### If your renderer has no GPU

`remotion.config.ts` selects the `swangle` OpenGL renderer (SwiftShader via
ANGLE), which is software GL and behaves the same on machines with and
without a GPU. On a machine with a working GPU you can switch it to `angle`
for a faster render.

## Files

```
src/shader.ts     the flare, as GLSL
src/motion.ts     per-frame source position, swell, roll -- pure functions
src/ghosts.ts     seeded ghost layout, fixed at module scope
src/palettes.ts   the two colour versions, sRGB -> linear
src/LensFlare.tsx canvas + WebGL plumbing
src/Root.tsx      composition definitions
```
