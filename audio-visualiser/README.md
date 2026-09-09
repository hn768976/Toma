# Audio Visualiser Pack

Three audio visualiser compositions built on one shared spectrum engine.
Remotion, **3840×2160**, **30 fps**, no audio track in any output.

| Composition id | Length | Loops? | Look |
|---|---|---|---|
| `V1-CircularNeon` | 300f (10s) | yes, seamless | Neon ring of bars, magenta → cyan, heavy bloom |
| `V2-WaveformGrid` | 300f (10s) | yes, seamless | Hot-pink waveform on a 3D perspective grid plane |
| `V3-MinimalWhite` | 450f (15s) | **no** | White-on-black podcast asset with a progress bar |

V3 is deliberately not a loop: its progress bar runs from empty to full, which
cannot loop without a visible jump.

## Getting started

```sh
npm install
npx remotion studio
```

## Rendering at 4K

The compositions are defined at 3840×2160. Every size in the project is a
fraction of the frame height (via `useVideoConfig()`), so `--scale` changes
nothing but the pixel count.

```sh
npx remotion render V1-CircularNeon out/V1_VisualiserCircularNeon.mp4 --scale=1 --crf=16
npx remotion render V2-WaveformGrid out/V2_VisualiserWaveformGrid.mp4 --scale=1 --crf=16
npx remotion render V3-MinimalWhite out/V3_VisualiserMinimalWhite.mp4 --scale=1 --crf=16
```

For a 1080p preview, add `--scale=0.5`.

`remotion.config.ts` already pins H.264, `yuv420p`, CRF 16, PNG frames and
`muted` (Remotion adds a silent AAC track otherwise — `enforceAudioTrack:false`
alone does not stop it), so the commands above need no extra flags.

### Chromium GL flag for V2

V2 is a real WebGL scene. Headless Chromium needs an ANGLE-backed GL context or
the three.js canvas renders black. This is set in `remotion.config.ts`:

```ts
Config.setChromiumOpenGlRenderer('angle');
```

If you render through the Node APIs instead of the CLI, pass the equivalent
`chromiumOptions: {gl: 'angle'}`. On the CLI it is `--gl=angle`.

### Measured render times

Wall-clock per frame, end to end (bundle + render + encode), measured on a
4-core Linux container with software GL:

| Composition | 1080p (`--scale=0.5`) | Total |
|---|---|---|
| V1-CircularNeon | 0.58 s/frame | 174 s for 300 frames |
| V2-WaveformGrid | **0.74 s/frame** | 223 s for 300 frames |
| V3-MinimalWhite | 0.14 s/frame | 64 s for 450 frames |

V2 is the expensive one — that figure is the one to budget from. At 4K expect
roughly 4× the per-frame cost on the same hardware, and rather less than that
with a real GPU, since V2 is fill-rate bound rather than CPU bound.

### Compositing V3

V3 is pure white on pure `#000000`, verified in the encoded file: 99.2% of
pixels decode to exactly 0 and the whites reach 255. mp4 carries no alpha, so
key it with a **screen** (or add) blend over your footage — on a true-black
background that is mathematically exact, and no matte is needed.

This is why V3 gets ~1% grain applied with an `overlay` blend rather than the
`screen` blend used in V1 and V2: overlay leaves black at exactly 0, where a
screen-blended grain would lift it and soften the key.

## How it works

### One spectrum, three views

`src/spectrum/spectrum.ts` is the whole instrument. There is no audio file: a
synthetic spectrum is deterministic, loops cleanly, and avoids any music
licensing question. Two properties do the work:

- **Low bands move slowly with large amplitude; high bands flicker fast with
  small amplitude.** Without that contrast every bar behaves alike and the
  result reads as noise rather than as audio.
- **Every oscillator completes an integer number of cycles over `PERIOD` (300
  frames)**, so the signal is exactly periodic — `|s(0) − s(300)|` is under
  1e-14 — and the 300-frame loops close.

A global beat pulse every 30 frames (120 BPM) briefly lifts all bands. 30
divides both 300 and 450, so the beat is continuous in every composition.

`getEqualizedSpectrum()` divides the spectral tilt back out. V1 wants the tilt —
it is what gives the ring dense fine bars at the bottom and big slow ones at the
top. V3 does not: with the tilt left in, the loud bands sit permanently at one
point on the ring and the spikes never move.

### Determinism

Everything is a pure function of `useCurrentFrame()`. No state, no
`Math.random()` at render time — Remotion renders frames out of order across
threads. Band phases, spike placement and waveform transients all come from a
seeded mulberry32 PRNG (`src/spectrum/random.ts`), and the film grain uses
`feTurbulence`, which is deterministic in its seed.

### Loop closure

- **V1** — the bar ring turns exactly 1 revolution and the dotted ring exactly
  −1 over 300 frames; the spectrum and the beat are both periodic in 300.
- **V2** — the waveform track is 2400 samples at 0.045 world units, and the
  camera scrolls exactly that 108-unit period over 300 frames. The camera float
  completes exactly one cycle.

### Layout

```
src/
  spectrum/     the shared engine: random.ts (mulberry32), spectrum.ts
  shared/       colour ramp, ring layout, film grain — used by more than one view
  v1/           circular neon: SVG, drawn four times to build the bloom stack
  v2/           waveform grid: @remotion/three, one InstancedMesh per pass
  v3/           minimal white: flat SVG, no filters at all
```

V2 draws its ~1000 waveform samples as a single `InstancedMesh` per pass (core,
halo, surface spill) rather than one object per line — at that count the draw
calls alone would dominate the frame.
