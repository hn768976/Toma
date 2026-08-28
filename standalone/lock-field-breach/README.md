# Lock Field — Breach

A 4K "security icon field" motion background built with Remotion.

- **Composition id:** `LockFieldBreach`
- **Resolution:** 4K — 3840×2160 (the composition itself is 4K; render at
  `--scale=0.5` for a 1080p preview)
- **Duration:** 450 frames @ 30 fps = 15.0 s, seamless loop
  (frame 0 and frame 450 are pixel-identical)

## Render (4K)

```
npx remotion render LockFieldBreach out/lockfield-breach.mp4 --codec=h264 --crf=12 --concurrency=8
```

## Setup

```
npm install
npm run dev     # Remotion Studio
npm run render  # the 4K render command above
```
