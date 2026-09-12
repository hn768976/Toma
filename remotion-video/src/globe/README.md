# Global Financial Data — scene notes

A 25.000s / 30fps seamless loop rebuilt from a stock-footage reference: a
dotted hologram globe turning inside a 3D field of stock-index tickers, with
perspective data streams and a volumetric flare.

## Compositions

| id | size | look |
| --- | --- | --- |
| `FinanceGlobe4K` | 3840×2160 | **master** — v1, reference-style |
| `FinanceGlobe1080` | 1920×1080 | v1 delivery |
| `FinanceGlobeCyan4K` | 3840×2160 | **master** — v2, mirrored + cyan |
| `FinanceGlobeCyan1080` | 1920×1080 | v2 delivery |

All four are 750 frames @ 30fps.

## Key light

The flare sits in a frame corner — upper **left** for v1, upper **right** for
v2 — with a thin anamorphic streak laid along the frame diagonal, pointing
away from that corner and into the picture. It is deliberately restrained — a
fine line plus a very soft ambient wash, with no bright core at the corner —
so it grades the frame instead of competing with the globe. `flarePosition()` and `flareAngle()` in
`draw.ts` are the single source of truth; the ambient background wash is
centred on the same point, so the lighting can never drift out of agreement.

## Resolution independence

The whole scene is authored in a 3840×2160 "master unit" space and multiplied
by `k = width / MASTER_WIDTH` at draw time. The 1080p compositions are
therefore the same framing as the 4K masters, not a re-layout — render either
and the composition is identical.

## Seamless loop

Every animated term completes a whole number of cycles across the 750 frames:

- globe spin — exactly one revolution per loop;
- camera drift, sway, flare pulse — `sin(2π·p)` and `sin(4π·p)`;
- ticker depth — each tag travels exactly the depth of the field slab, fading
  out at the near plane and back in at the far plane so the wrap is invisible;
- data-stream dashes — whole-number scroll speeds;
- film grain — offset returns to zero at `p = 1`.

Verified by PSNR: frame 749 → frame 0 measures 19.296 dB against 19.308 dB for
an ordinary frame 0 → 1 step, i.e. the seam is an ordinary frame of motion.

## Structure

- `constants.ts` — master space, camera focal length, globe and field geometry.
- `rng.ts` — seeded mulberry32, so renders are deterministic.
- `sphere.ts` — lat/lon mesh, latitude rings, and continent dots.
- `land-points.json` — generated; see `scripts/gen-land-points.mjs`.
- `tickers.ts` — the ticker field and the perspective data streams.
- `theme.ts` — the two palettes, and the `mirror` flag.
- `draw.ts` — the canvas renderer: projection, depth of field, flare, grade.
- `GlobeScene.tsx` — Remotion wiring and per-frame paint.

## Regenerating the continent data

`src/globe/land-points.json` is baked from Natural Earth 110m land polygons
(`world-atlas`) by equal-area lat/lon sampling:

```sh
node scripts/gen-land-points.mjs
```

Lower `LAT_STEP` in that script for a denser dot map.

## Rendering

```sh
npm run globe:v1:4k
npm run globe:v2:4k
```

Fonts are self-hosted in `public/fonts`, so rendering needs no network access.
