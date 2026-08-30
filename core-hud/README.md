# 4K AI core HUD interface

Three matched 4K HUD animations built in Remotion, on 2D canvas only — no 3D,
no Three.js, no SVG.

| Composition | Variant | Description |
| --- | --- | --- |
| `CoreHudNodes` | `nodes` | Node-graph centre, full panel density |
| `CoreHudRings` | `rings` | Mirrored layout, concentric ring assembly centre |
| `CoreHudSparse` | `sparse` | Six elements instead of eleven, scaled up, mostly black |

All three are 3840 × 2160, 600 frames at 30fps (20.0s), and loop seamlessly:
frame 600 is pixel-identical to frame 0.

```bash
npm install
npm run dev                    # studio
npx remotion render CoreHudNodes out/nodes.mp4 --codec=h264 --crf=12 --concurrency=8
```

## Layout is data

`src/variants.ts` holds `BASE_LAYOUT` — an array of `{ component, x, y, scale }`
entries in fractions of the frame — and `VARIANTS`, keyed by variant name, which
carries each version's centre element, mirror flag, element scale multiplier,
panel density and the ids of the panels it keeps.

`buildLayout(variant)` filters, overrides and mirrors that array;
`src/CoreHud.tsx` walks the result, asks each component to measure itself, and
places it. The three versions differ only in that data: v2 mirrors it and swaps
the centre entry, v3 culls it and scales it up. Neither required a change to a
component. No layout coordinate is hard-coded outside `src/variants.ts`.

Mirroring flips coordinates, never the canvas — anchoring is a property of each
component, so a mirrored top-left panel reflects its own box instead of running
off the frame, and all text still reads forwards.

## Determinism

Every element draws to its own canvas at true 4K backing resolution, once per
React render. Motion is a pure function of `useCurrentFrame()`: no
`requestAnimationFrame`, no CSS animation, no component state, no `Date.now()`.
All randomness is Remotion's `random()` with stable string seeds. Renders are
reproducible frame for frame.

Static chrome and fixed per-component detail are rendered once to offscreen
canvases via `useMemo` and blitted on whole pixels; only rotating bands,
drifting nodes and rerolling values are redrawn each frame.

## Packaging

`node scripts/package.mjs` builds three self-contained, independently runnable
projects under `build/` and zips them to `dist-zips/`. Each registers only its
own composition and carries that variant's layout inlined as resolved data,
with the components it does not use removed. The script transpiles and calls the
real `buildLayout()` rather than restating the data, so a packaged project
cannot drift from this one.
