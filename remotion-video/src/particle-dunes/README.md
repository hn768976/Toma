# Particle Dunes

A rolling dune field built from ~2 million individually shaded particles, seen
close and low with heavy depth of field. 15 seconds, 30 fps, seamlessly looping.
Two palettes:

| Composition id       | Look                                            |
| -------------------- | ----------------------------------------------- |
| `ParticleDunesCyan`  | Cyan/teal on near-black (`#020a0e`)             |
| `ParticleDunesSand`  | Amber and gold on near-black brown (`#0a0602`)  |

Both compositions are defined at **3840x2160, 30 fps, 450 frames**.

## Running it

```bash
npm install
npx remotion studio
```

## Rendering at 4K

```bash
npx remotion render ParticleDunesCyan out/V1_ParticleDunesCyan.mp4 --scale=1 --crf=16
npx remotion render ParticleDunesSand out/V2_ParticleDunesSand.mp4 --scale=1 --crf=16
```

Stills:

```bash
npx remotion still ParticleDunesCyan out/V1_ParticleDunesCyan.png --frame=210 --scale=1
npx remotion still ParticleDunesSand out/V2_ParticleDunesSand.png --frame=210 --scale=1
```

For a 1080p preview instead, use `--scale=0.5`. The drawing buffer follows the
render scale, so a 1080p preview genuinely costs 1080p rather than rendering 4K
and downsampling.

`remotion.config.ts` already sets the things this clip is fussy about, so the
commands above stay short:

- **PNG frames, not JPEG.** The visible grain is the whole point here, and
  JPEG's default quality softens exactly that high-frequency detail.
- **`yuv420p`**, limited range. Capturing to JPEG instead tags the stream
  `yuvj420p` (full range), which shifts levels on some players.
- **Muted.** Nothing here makes a sound, and without this ffmpeg still writes a
  silent AAC track.

Driving Remotion from another project's config, or from the Node APIs, means
passing these yourself: `--image-format=png --pixel-format=yuv420p --muted`.

### Chromium needs a GL backend

This is a WebGL clip, so headless Chromium has to be given one. The project
already sets it in `remotion.config.ts`:

```ts
Config.setChromiumOpenGlRenderer("angle");
```

If you drive Remotion through the Node APIs (where the config file does not
apply), pass `chromiumOptions: { gl: "angle" }`. On the CLI it can also be
forced per-invocation with `--gl=angle`. Without it the render comes out black.

### Measured render time

Timed on a **4-core CPU with no GPU**, so ANGLE fell back to SwiftShader and
every pixel was rasterised in software. A machine with a real GPU will be far
faster; these are close to a worst case.

| Output                | Wall clock (450 frames) | Per frame |
| --------------------- | ----------------------- | --------- |
| 1080p (`--scale=0.5`) | 1252 s (~21 min)        | 2.78 s    |

Measured at `--concurrency=4`, so that is four frames in flight at once, not
2.78 s of single-threaded work.

Fill rate dominates, not the particle count: the vertex shader evaluates 4D
simplex noise five times per grain and that is comparatively cheap, while the
wide defocus discs in the foreground are what costs. Expect 4K (`--scale=1`) to
cost roughly 4x the 1080p figure on the same machine.

If you need it faster, lower `PARTICLE_COUNT` in `src/particle-dunes/constants.ts`
before touching the depth of field -- the DOF is doing most of the visual work.

## How it works

`src/particle-dunes/`

| File               | Role                                                          |
| ------------------ | ------------------------------------------------------------- |
| `field.ts`         | The dune height field, and the single source of truth for it   |
| `simplex4d.glsl.ts`, `simplex4d.ts` | 4D simplex noise, GPU and CPU copies      |
| `sampling.ts`      | One-time particle scatter, and the occluder lattice            |
| `shaders.ts`       | Particle, occluder-shell and background GLSL                   |
| `ParticleDunes.tsx`| The composition: scene graph, uniforms, bloom, grain           |
| `constants.ts`     | Every tunable, with the reasoning attached                     |

### Making it loop

Everything is a pure function of `useCurrentFrame()` -- no `useFrame` clock and
no accumulated delta, because Remotion renders frames out of order across
worker threads.

The loop closes because the height field is genuinely *periodic in world space*,
not merely slow. A 2D position is mapped onto a torus in 4D and fed to 4D
simplex noise, so walking one `FIELD_PERIOD` in x or z walks all the way around
a circle and the field tiles exactly -- no seam, no blend region. Time is then
advection: translating a layer by a whole number of periods over the loop
returns it exactly to where it started, and several layers sliding at different
integer rates sum to a field that visibly evolves yet is exactly periodic. That
costs two noise dimensions less than putting time on its own circle, which
matters when the whole thing has to rasterise in software.

The same tiling is what lets the camera move. It travels exactly one
`FIELD_PERIOD` forward over the 450 frames -- the shortest travel that still
closes the loop, and therefore the slowest drift this field allows. Particles
that fall off the near edge are pushed back one period onto identical terrain.
Both wrap seams are cross-faded so nothing pops.

Verified empirically, not just by construction: frame 450 rendered against frame
0 differs by a mean of 1.2/255, which is the film grain and nothing else.

### Depth of field

Each grain gets its own circle of confusion straight from the thin-lens
relation, sized in the vertex shader, so blur varies *continuously* with depth.
The brief suggested compositing 5-7 blurred depth buckets instead; per-particle
CoC is the finer-grained version of the same idea, with no banding between
layers, and under additive blending a separate compositing step would be a
no-op anyway, since addition does not care about draw order.

Spreading a grain over a wider disc does not brighten it -- total light per
grain is held constant. That one factor also supplies the inverse-square
distance falloff and corrects for the 1px floor the rasteriser imposes, so image
brightness stays even from the front of the field to the back.

### Why there is a solid shell under the grain

Particle density is uniform in *world* space, which is physically right but
means the near field covers almost no world area: only a few hundred grains land
across the bottom of frame, and once the DOF opens them into wide discs they
read as floating confetti rather than a dune.

So the dunes also carry a shaded shell -- the same surface, the same light, the
same colour ramp, at `BASE_STRENGTH` of the particle layer. It gives the grain
something to sit on. It doubles as the depth buffer, which is what makes near
crests genuinely occlude the dunes behind them instead of letting the far field
add straight through them.

## Deviations from the brief

Two, both deliberate:

1. **Particle count is 2,000,000, not the suggested 150k-400k.** At 400k the
   field reads as scattered dots rather than the dense velvet of the reference,
   and roughly 60% of any count is off-screen anyway (the strip has to be wide
   enough for the far plane, so most of it falls outside the frustum up close).
   Raising the count was the single change that moved the image closest to the
   reference, and it is nearly free here because cost is fill-bound. It is the
   first thing to turn down if render time is a problem.

2. **Depth of field is per-particle rather than 5-7 composited depth buckets**,
   for the reasons in the section above.

Grain size is about 2.5-3.3px at 4K through the in-focus band, so the top of
the brief's 1-3px range rather than the middle of it; grains fall below 1px
well before the far field fades out. Defocus discs are of course far wider by
design.
