# Calendar Page Flip — 4K Remotion project

A white calendar card on a near-white background. The page peels from the
top-left corner, curls into a cone and sweeps away to reveal the next month,
January through December, then loops back to January seamlessly.

Four versions ship from one codebase — the year and the week-start convention
are the only differences:

| Composition ID              | Year | Week starts |
| --------------------------- | ---- | ----------- |
| `V1-Calendar2026-SunStart`  | 2026 | Sunday (US) |
| `V2-Calendar2026-MonStart`  | 2026 | Monday (ISO)|
| `V3-Calendar2027-SunStart`  | 2027 | Sunday (US) |
| `V4-Calendar2027-MonStart`  | 2027 | Monday (ISO)|

Each is **3840x2160, 30 fps, 360 frames (12s)**, and loops: frame 360 is
identical to frame 0.

## Getting started

Requires Node 18 or newer.

```bash
npm install
npx remotion studio
```

## Rendering at 4K

The compositions are defined at 3840x2160, so a full-resolution render is just
`--scale=1`:

```bash
npx remotion render V1-Calendar2026-SunStart out/V1_Calendar2026_SunStart.mp4 --scale=1 --crf=16
npx remotion render V2-Calendar2026-MonStart out/V2_Calendar2026_MonStart.mp4 --scale=1 --crf=16
npx remotion render V3-Calendar2027-SunStart out/V3_Calendar2027_SunStart.mp4 --scale=1 --crf=16
npx remotion render V4-Calendar2027-MonStart out/V4_Calendar2027_MonStart.mp4 --scale=1 --crf=16
```

Add `--muted` to drop the silent audio track, and `--pixel-format=yuv420p` for
maximum player compatibility.

### Stills

```bash
npx remotion still V1-Calendar2026-SunStart out/V1_Calendar2026_SunStart.png --frame=5 --scale=1
```

Frame 5 sits in the January hold, before the first peel begins.

### 1080p previews

`./render-all.sh` renders every version at `--scale=0.5` (1920x1080) plus its
still. Use it to check changes quickly; 4K takes considerably longer.

## How it works

The curl is a 2D effect, not a 3D scene — that keeps the typography crisply
rasterised instead of resampled off a bent mesh.

- `src/calendar.ts` — the date matrix, generated from real dates. Nothing is
  hand-typed, and the week start is a parameter.
- `src/monthPage.ts` — draws one month onto an offscreen canvas at full output
  resolution, once, memoised on its spec. Both faces of the curl sample that
  raster, so text is sampled at 4K rather than magnified from preview size.
- `src/curl.ts` — the conic curl geometry. The sheet wraps a cylinder whose
  axis is the fold line and whose radius varies along it, which is what makes a
  cone rather than a tube. All three branches (the printed side rising, the
  reverse over the top of the roll, and the flat flap past the half turn)
  invert in closed form, so the warp is a cheap per-pixel lookup.
- `src/renderCard.ts` — composites the revealed page, the remaining page, the
  cast shadow and the curl, per pixel, with bilinear sampling and an
  antialiased silhouette.
- `src/timing.ts` — every value is derived from the frame number alone. There
  is no state and no refs carrying values between frames, so any frame can be
  rendered in isolation and the render is deterministic.

Inter is bundled in `public/fonts` rather than fetched from a CDN, so renders
are reproducible offline.

## Adjusting

- **Other years** — add an entry to `VERSIONS` in `src/Root.tsx`. The calendar
  data is generated, so any year works.
- **Colours and type** — `src/theme.ts`. Lengths are fractions of the card
  width, so they hold at any output resolution.
- **Curl feel** — `MAX_RADIUS`, `CONE_MIN` and `OVERSHOOT` in `src/curl.ts`.
- **Pacing** — `HOLD_FRAMES` and the flip curve in `src/timing.ts`.
