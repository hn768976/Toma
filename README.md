# Neuron Network — Remotion

Three 4K "neuron network" animations built with Remotion. 2D canvas rendering,
fully deterministic (seeded), 375 frames @ 30 fps (12.5 s), seamless loops,
no audio.

| Composition | Variant | Layout | Connection mode | Motion mode |
| --- | --- | --- | --- | --- |
| `NeuronBlue` | blue | 3 nodes, right-weighted, left third open | isolated | drift |
| `NeuronGreen` | green | 5 nodes, networked, left quarter open | synaptic (junctions + pulses) | drift |
| `NeuronIndigo` | indigo | single centred hero node | isolated | retract (growthDirection −1) |

All variant data (palette, node layout, filament parameters, connection mode,
motion mode) lives in the single `VARIANTS` object in `src/variants.ts`.

## Setup

```
npm install
```

## Preview

```
npm start
```

## Render

1080p previews:

```
npx remotion render NeuronBlue   out/neuron-blue-preview.mp4   --codec=h264 --crf=18 --scale=0.5
npx remotion render NeuronGreen  out/neuron-green-preview.mp4  --codec=h264 --crf=18 --scale=0.5
npx remotion render NeuronIndigo out/neuron-indigo-preview.mp4 --codec=h264 --crf=18 --scale=0.5
```

Full 4K:

```
npx remotion render NeuronBlue   out/neuron-blue.mp4   --codec=h264 --crf=12 --concurrency=8
npx remotion render NeuronGreen  out/neuron-green.mp4  --codec=h264 --crf=12 --concurrency=8
npx remotion render NeuronIndigo out/neuron-indigo.mp4 --codec=h264 --crf=12 --concurrency=8
```

## Standalone packages

`node scripts/make-standalone.js` builds `neuron-blue.zip`, `neuron-green.zip`
and `neuron-indigo.zip` — each a self-contained single-variant Remotion
project (excludes `node_modules/`, `out/`, `.git/`).
