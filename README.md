# Meteor Shower over Nebula

A 4K (3840×2160, 60fps) seamlessly looping "meteor shower over nebula" animation
built with Remotion: white tapered meteor streaks falling down-right from a
common radiant across a twinkling starfield, over a dusty desaturated amber
nebula lit by a teal glow entering from the right edge.

- 1020 frames @ 60fps = 17.0s, loops seamlessly (every animated value is a pure
  function of `frame % 1020`).
- Deterministic: all randomness comes from Remotion's `random()` with stable
  string seeds — renders are reproducible.
- The nebula and starfield are baked once to offscreen canvases and blitted per
  frame; only meteors and star twinkle are computed per frame.

## Setup

```sh
npm install
```

## Preview

```sh
npm run dev
```

## Render

```sh
npx remotion render MeteorShower out/meteor-shower.mp4 \
  --codec=h264 --crf=12 --concurrency=8
```

Low CRF is intentional — the frame is almost entirely smooth dark gradient,
which bands severely at higher CRF values.
