# Analytics Dashboard — 4K, two variants

A 4K "analytics dashboard" animation in Remotion, in two versions that share one
dashboard implementation.

| Composition | What it is | Size | Duration |
|---|---|---|---|
| `AnalyticsFlat` | v1 — the dashboard, frontal, 2D | 3840 × 2160 | 300 frames @ 30fps = 10.0 s |
| `AnalyticsTilted` | v2 — v1's buffer as a texture on a tilted plane, camera moving across it | 3840 × 2160 | 300 frames @ 30fps = 10.0 s |

Neither loops: frame 0 and frame 300 differ by design.

All content is invented. The metric labels, series, ticker instruments and their
values are fictional and reproduce no real product's interface, naming, layout
or branding; the ticker carries no real commodity names or real prices.

## The seam between the two versions

`src/dashboard/renderDashboard.ts` paints the **complete** dashboard into a
caller-supplied offscreen canvas of known dimensions, purely as a function of
the frame number.

* v1 (`src/AnalyticsFlat.tsx`) blits that buffer to the composition canvas.
* v2 (`src/three/AnalyticsTilted.tsx`) hands the same buffer to a
  `THREE.CanvasTexture` on a tilted plane.

That is the whole difference. v2 authors no dashboard content.

## Working on it

```bash
npm install
npm run dev            # Remotion Studio
npm run lint           # tsc --noEmit

# 1080p previews
npx remotion render AnalyticsFlat   out/analytics-flat-preview.mp4   --codec=h264 --crf=18 --scale=0.5 --concurrency=8
npx remotion render AnalyticsTilted out/analytics-tilted-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=4

# 4K
npx remotion render AnalyticsFlat   out/analytics-flat.mp4   --codec=h264 --crf=12 --concurrency=8
npx remotion render AnalyticsTilted out/analytics-tilted.mp4 --codec=h264 --crf=12 --concurrency=8
```

Remotion refuses a `--concurrency` above your core count; lower it to match.
`AnalyticsTilted` is much slower than `AnalyticsFlat` — see `CAMERA-NOTES.md` §7.

## Delivery packages

```bash
npm run package        # writes dist/analytics-flat.zip and dist/analytics-tilted.zip
```

`analytics-flat.zip` is the 2D dashboard alone, with the three.js dependencies
and `src/three` stripped. `analytics-tilted.zip` carries the 3D version plus the
full dashboard it depends on, and `CAMERA-NOTES.md`. Both exclude
`node_modules/`, `out/` and `.git/`.

## Documentation

* `CAMERA-NOTES.md` — v2 recording notes: plane, camera path, texture pipeline,
  DOF and bloom, and the frame-sync gotcha.
* `scripts/README.flat.md`, `scripts/README.tilted.md` — the READMEs shipped
  inside the two zips; they carry the per-package detail.
