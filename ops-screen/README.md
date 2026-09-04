# Ops Screen — multi-window terminal UI

Two Remotion compositions of a dense operations screen: overlapping windows
of file listings and logs, a level readout, and a dark code panel typing in
the centre. Plain HTML and CSS throughout — real DOM, real monospace text,
CSS Grid for the window layout. Nothing is rasterised, so it stays sharp at
any output size.

| Composition ID       | Version                                  |
| -------------------- | ---------------------------------------- |
| `V1-OpsScreenGreen`  | Green/teal — the reference match          |
| `V2-OpsScreenBlue`   | Blue/steel — the same layout, cool palette |

Both are defined at **3840 x 2160, 30 fps, 600 frames (20s)**. Not a loop:
it builds and holds.

## Run it

```bash
npm install
npx remotion studio
```

## Render at 4K

```bash
npx remotion render V1-OpsScreenGreen out/V1_OpsScreenGreen.mp4 --scale=1 --crf=16
npx remotion render V2-OpsScreenBlue  out/V2_OpsScreenBlue.mp4  --scale=1 --crf=16
```

`remotion.config.ts` already sets H.264 / `yuv420p` / CRF 16, so the flags
above only restate the ones worth being explicit about.

### 1080p preview

```bash
npx remotion render V1-OpsScreenGreen out/V1_OpsScreenGreen.mp4 --scale=0.5 --crf=16
npx remotion render V2-OpsScreenBlue  out/V2_OpsScreenBlue.mp4  --scale=0.5 --crf=16
```

### Stills

```bash
npx remotion still V1-OpsScreenGreen out/V1_OpsScreenGreen_frame500.png --frame=500 --scale=0.5
npx remotion still V2-OpsScreenBlue  out/V2_OpsScreenBlue_frame500.png  --frame=500 --scale=0.5
```

## Build sequence

| Frames  | Beat                                                              |
| ------- | ----------------------------------------------------------------- |
| 0–40    | Background and margin strip; windows fade in, staggered ~8 frames  |
| 30–150  | File listings populate row by row, staggered across the tables     |
| 60–600  | Log stream runs, a new line every 20–40 frames                     |
| 120–420 | Code panel types in, line by line, with a blinking cursor          |
| 200–600 | Bar readouts drift, each on its own period and phase               |
| 420–600 | Hold — only the cursor, the log stream and the bars keep moving    |

## How it is put together

- `src/OpsScreen.tsx` — the composition. One 24 x 24 CSS Grid holds every
  window; they claim overlapping cells and `z-index` orders them, with the
  code panel on top.
- `src/theme.ts` — the two palettes. The warning glyph stays warm amber in
  both; a warning that matches the palette stops reading as a warning.
- `src/rng.ts` / `src/content.ts` — a seeded mulberry32 PRNG, run once at
  module level, generates every listing row, log line and bar cycle. Same
  output in the studio and on a render farm.
- `src/code.ts` — the code panel's source, tokenised **once** at module
  level. Frames only slice the token list by character count; nothing is
  re-highlighted per frame.
- `src/components/` — window chrome, margin strip, tables, log, bars, code
  panel, and the screen texture (grid, scanlines ~5%, grain ~2%, glow,
  vignette).

All timing comes from `useCurrentFrame()` with `interpolate` and explicit
`extrapolateLeft` / `extrapolateRight: 'clamp'` — no component state, no
timers. Every size is a fraction of frame height via `useVideoConfig()`, so
the 1080p preview is an exact scale model of the 4K render.

The font (JetBrains Mono, latin subset) is embedded in `public/fonts/` and
loaded behind a `delayRender()` — a render never depends on a network fetch.

### Deliberate omissions

- **No barrel warp.** A light edge warp was tried and dropped: at 1080p it
  softened the code panel, and legibility there matters more than the
  effect. The brief allows skipping it for exactly that reason.
- **Contrast is intentional.** Everything except the code panel is low
  contrast. The listings are meant to read as texture; the code is the only
  thing meant to be read.

### Content

Every filename, size, timestamp, status word and line of code is invented.
There are no real paths, hostnames, addresses, account names, brand names or
product marks anywhere on the screen.
