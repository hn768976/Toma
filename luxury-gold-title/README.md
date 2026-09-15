# Luxury Gold Title Border — Remotion

Two 16:9 motion backgrounds rebuilt from a reference stock clip: a black VIP
backdrop with a thin luminous rectangle that fades out toward the top-right and
bottom-left corners.

Everything is procedural — no video, image or font assets — so the same code
renders at any resolution.

## Specs

|                 |                                      |
| --------------- | ------------------------------------ |
| Frame rate      | 30 fps                               |
| Duration        | 301 frames = 10.033 s (matches ref.) |
| Resolutions     | 3840×2160 (4K UHD) and 1920×1080     |
| Codec           | H.264 / MP4, yuv420p, CRF 16         |

## Compositions

| ID                 | Size      | Look                                                            |
| ------------------ | --------- | --------------------------------------------------------------- |
| `GoldBorder-4K`    | 3840×2160 | Version 1 — gold frame, shimmer drifting clockwise (like the ref) |
| `GoldBorder-1080p` | 1920×1080 | Same, Full HD                                                     |
| `CyanBorder-4K`    | 3840×2160 | Version 2 — dark cyan frame with a light line running the border  |
| `CyanBorder-1080p` | 1920×1080 | Same, Full HD                                                     |

## Usage

```bash
npm install
npm run dev                       # Remotion Studio, live preview

# Render 4K
npx remotion render GoldBorder-4K    out/gold-border-4k.mp4     --codec=h264
npx remotion render CyanBorder-4K    out/cyan-line-border-4k.mp4 --codec=h264

# Render 1080p
npx remotion render GoldBorder-1080p out/gold-border-1080p.mp4      --codec=h264
npx remotion render CyanBorder-1080p out/cyan-line-border-1080p.mp4 --codec=h264
```

Add `--browser-executable=/path/to/chrome` if Remotion cannot download its own
Chromium (offline / restricted network).

For a transparent-background master, render with
`--codec=prores --prores-profile=4444` after removing the opaque
`backgroundColor` on the composition's root `AbsoluteFill`.

## How it is built

```
src/
  theme.ts                    layout fractions + palettes (single source of truth)
  Root.tsx                    the four <Composition>s
  components/
    Backdrop.tsx              black ground, centre glow, grain, vignette
    BorderDefs.tsx            metal gradient, blur filters, corner-fade mask
    ShimmerFrame.tsx          version 1 — dashed light bands creeping clockwise
    RunnerFrame.tsx           version 2 — comet head + decaying tail on the rail
    DriftLines.tsx            version 2 — streaks drifting inside the rectangle
  compositions/
    GoldBorder.tsx
    CyanBorder.tsx
```

### Resolution independence

`theme.ts` stores every dimension as a fraction of the composition **width**:

| Constant      | Value    | Meaning                                    |
| ------------- | -------- | ------------------------------------------ |
| `INSET`       | `0.0857` | uniform inset of the rectangle             |
| `STROKE`      | `0.0033` | line weight                                |
| `CORNER_FADE` | `0.185`  | radius of the TR / BL dissolve             |

These were measured off the 898×506 reference (border at x 77…817, y 76…426,
~3 px stroke, ~130 px corner fade), so 4K and 1080p are pixel-for-pixel scaled
versions of each other.

The border is a single `<path>` declared with `pathLength={1000}`, which lets
`strokeDasharray` / `strokeDashoffset` drive the travelling light in virtual
units that are identical at every resolution.

## Tuning

- **Colours** — the `GOLD` / `CYAN` palettes in `src/theme.ts`.
- **Frame size and position** — `INSET`, `STROKE`, `CORNER_FADE` in `src/theme.ts`.
- **Shimmer pattern and speed** — the `BANDS` table in `ShimmerFrame.tsx`.
- **Runner speed / tail** — `LAPS`, `TAIL_LENGTH`, `TAIL_SEGMENTS` in `RunnerFrame.tsx`.
- **Background streaks** — the `LINES` table in `DriftLines.tsx`.

Both variants are safe to place text over: the rectangle interior is kept clear.
