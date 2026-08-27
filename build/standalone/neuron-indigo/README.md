# NeuronIndigo

A 4K "neuron network" animation built with Remotion (indigo variant).

- Composition id: `NeuronIndigo`
- Resolution: 4K UHD - 3840x2160
- Duration: 375 frames @ 30 fps (12.5 s), seamless loop
- 2D canvas rendering, fully deterministic (seeded), no audio

## Setup

```
npm install
```

## Preview

```
npm start
```

## Render (4K)

```
npx remotion render NeuronIndigo out/neuron-indigo.mp4 --codec=h264 --crf=12 --concurrency=8
```
