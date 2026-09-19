# Cyber Alert — Remotion project

Source project for the two glitch warning-screen videos, including the
**4K (3840x2160) compositions**.

```bash
npm install          # Remotion downloads its own headless Chrome here
npm run dev          # opens Remotion Studio to preview/scrub
```

## Rendering

```bash
npm run render:phishing:4k     # 3840x2160  PHISHING ATTACK
npm run render:hacked:4k       # 3840x2160  SYSTEM HACKED
npm run render:phishing:1080p  # 1920x1080  PHISHING ATTACK
npm run render:hacked:1080p    # 1920x1080  SYSTEM HACKED
npm run render:all             # all four, into out/
```

All four are H.264 / MP4, 30fps, 452 frames (15.07s), no audio track.

Keep the `--image-format=png` and `--muted` flags in those scripts:
the repo's default JPEG intermediates ring badly across the dense pixel
mosaic, and without `--muted` the muxer writes a silent AAC track.

Any other headline can be rendered without touching code:

```bash
npx remotion render PhishingAttack4K out/custom-4k.mp4 \
  --codec=h264 --image-format=png --crf=17 --muted \
  --props='{"headline":"ACCESS DENIED"}'
```

## Where things live

The piece is entirely under **`src/glitch-alert/`** — see
[`src/glitch-alert/README.md`](src/glitch-alert/README.md) for how the
layers, the glitch schedule and the resolution scaling work, plus the
font-loading gotchas worth knowing before editing.

`src/components/`, `src/scenes/` and `src/particle-ring/` are earlier,
unrelated pieces that already lived in this project. They are registered
in `src/Root.tsx` alongside the alert compositions and are kept so the
project builds as-is; nothing in `src/glitch-alert/` depends on them.
