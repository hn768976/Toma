# Remotion video

Remotion project holding the motion-graphics work in this repo. Everything
renders from source — there are no baked video assets in `src/`.

## Compositions

| ID                    | Size      | Length             | What it is                              |
| --------------------- | --------- | ------------------ | --------------------------------------- |
| `V1-WaveMagentaCyan`  | 3840x2160 | 20s / 600f @ 30fps | Particle wave field, magenta -> cyan    |
| `V2-WaveBlueWhite`    | 3840x2160 | 20s / 600f @ 30fps | Particle wave field, deep blue -> white |
| `V3-WaveAmberMagenta` | 3840x2160 | 20s / 600f @ 30fps | Particle wave field, amber -> magenta   |
| `ParticleRingHalo`    | 1920x1080 | 8s / 200f @ 25fps  | Abstract particle-ring halo             |
| `ParticleRingHalo4K`  | 3840x2160 | 8s / 200f @ 25fps  | The same, at 4K                         |
| `BluetoothExplainer`  | 1920x1080 | 30s @ 30fps        | Hand-drawn Bluetooth explainer          |

## Getting started

```console
npm install
npx remotion studio
```

## Particle wave field

A dot-matrix surface undulating across the lower half of frame: hue is a
function of horizontal position only, so the colour ramp stays pinned to the
frame while the wave rolls left to right through it. The upper 40% of frame
stays empty for titles.

The three versions share identical choreography and differ only in the hue
ramp — see `src/particle-wave/palette.ts`. Source lives in
`src/particle-wave/`:

| File                    | Role                                                 |
| ----------------------- | ---------------------------------------------------- |
| `constants.ts`          | Every tunable: grid, projection, octaves, brightness |
| `noise.ts`              | 4D simplex noise                                     |
| `field.ts`              | Builds the grid and bakes the projection into it     |
| `draw.ts`               | The per-frame canvas painter                         |
| `palette.ts`            | The three hue ramps and the colour lookup tables     |
| `ParticleWaveField.tsx` | The Remotion component                               |

Two things are worth knowing before editing it:

**It is 2D, not 3D.** The camera never moves, so depth is baked into the grid
itself: row index maps to vertical position (spacing shrinking toward the
horizon), dot size, brightness, and how far the row is displaced. A three.js
scene would buy nothing here and would cost a fight with point-sprite sizing
and additive blending at 4K.

**The loop is exact, not cross-faded.** The horizontal axis of the noise field
is sampled around a circle, and time rotates that circle; each octave travels a
whole number of circles over the 600 frames, so frame 600 lands back on frame 0
to within a rounding error (measured: 3/100 of a pixel). Nothing in the render
carries state between frames — all per-dot values come from a seeded mulberry32
PRNG keyed on the dot index, never `Math.random()`, because Remotion renders
frames out of order across workers.

### Rendering at 4K

The wave compositions are defined at 3840x2160. Render them at full size with:

```console
npx remotion render V1-WaveMagentaCyan out/V1_WaveMagentaCyan.mp4 --scale=1 --crf=16
npx remotion render V2-WaveBlueWhite out/V2_WaveBlueWhite.mp4 --scale=1 --crf=16
npx remotion render V3-WaveAmberMagenta out/V3_WaveAmberMagenta.mp4 --scale=1 --crf=16
```

Add `--image-format=png --muted` to match how the 1080p previews in
`deliverables/` were produced: PNG intermediates keep the dark background
gradient free of JPEG artefacts, and the clips carry no audio.

For a 1080p preview from the same composition, add `--scale=0.5` instead of
`--scale=1`. Stills come out of the same compositions:

```console
npx remotion still V1-WaveMagentaCyan out/V1_WaveMagentaCyan.png --scale=1
```

### Tuning

If a machine can't keep up, lower `rows` before `cols` — horizontal density is
what makes the crests read. Both are props on the composition, so they can be
changed in the studio's props panel without touching the source.

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
