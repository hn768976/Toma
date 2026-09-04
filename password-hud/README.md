# Password Security HUD

A HUD panel on an angled surface — shield glyph, masked password field, dark
technical background — rendered with [Remotion](https://remotion.dev).

Two compositions, deliberately **opposite outcomes**, built from one component
with an `outcome` prop:

| Composition ID       | Outcome | What happens |
| -------------------- | ------- | ------------ |
| `V1-PasswordGranted` | Granted | The shield cross-fades **red → green**, the border and asterisks follow, a pulse radiates out and confirmation ticks appear at the panel corners. |
| `V2-PasswordDenied`  | Denied  | The shield **flashes brighter red twice**, the field border flashes, the asterisks shake, and the field clears in a single frame. |

Both are **3840×2160, 30 fps, 360 frames (12s)** and are a sequence with an
outcome — not a loop.

## Requirements

- Node.js 18 or newer
- The first render downloads a Chrome Headless Shell automatically

## Install

```bash
npm install
npx remotion studio
```

## Render at 4K

```bash
npx remotion render V1-PasswordGranted out/V1_PasswordGranted.mp4 --scale=1 --crf=16
npx remotion render V2-PasswordDenied  out/V2_PasswordDenied.mp4  --scale=1 --crf=16
```

## Render 1080p previews

The compositions stay 3840×2160; `--scale=0.5` renders them at 1920×1080. Every
size and blur radius in the project is a fraction of the frame, so the preview
and the 4K render are the same picture at two resolutions.

```bash
npx remotion render V1-PasswordGranted out/V1_PasswordGranted.mp4 --scale=0.5 --crf=16
npx remotion render V2-PasswordDenied  out/V2_PasswordDenied.mp4  --scale=0.5 --crf=16
```

## Stills

```bash
npx remotion still V1-PasswordGranted out/V1_PasswordGranted.png --frame=300 --scale=0.5
npx remotion still V2-PasswordDenied  out/V2_PasswordDenied.png  --frame=260 --scale=0.5
```

Drop `--scale` (or pass `--scale=1`) for 4K stills.

## Sequence

| Frames  | V1 (Granted) | V2 (Denied) |
| ------- | ------------ | ----------- |
| 0–40    | Panel fades up, shield red, background already drifting | Same |
| 30–90   | `PASSWORD` types on, character by character | Same |
| 90–240  | Asterisks fill the field at an uneven human rhythm | Same |
| 240–280 | Shield red → green over ~15 frames with a brightness overshoot; soft pulse | Shield flashes brighter red twice; border flashes; asterisks shake |
| 280–330 | Background accents pick up green; corner confirmation ticks | Background accents pick up red; field clears in one frame |
| 330–360 | Hold | Hold on the empty field, shield still red |

Every beat lives in `src/lib/timeline.ts`.

## How it is built

- **Real DOM under one `perspective` container.** The panel and background are
  flat planes at a fixed angle (`rotateX(10deg) rotateZ(-6deg)`); nothing is
  rasterised, so the type stays vector at 4K.
- **Depth of field** comes from four `translateZ` slices with increasing blur,
  plus one masked `backdrop-filter` pass that softens the frame edges. Each
  slice is scale-compensated so depth changes focus, not size.
- **All state is derived from `useCurrentFrame()`** through `interpolate` with
  explicit `extrapolateLeft`/`extrapolateRight: 'clamp'`. No timers, no
  accumulation — Remotion renders frames out of order across threads.
- **Seeded PRNG** (`src/lib/random.ts`) lays out the background texture and the
  keystroke rhythm, so every render is identical.
- **The red → green cross-fade is interpolated in HSL**, not RGB. In RGB the
  halfway point of red and green is olive; in HSL it runs red → orange → amber →
  green and stays saturated. The brightness overshoot raises lightness only, so
  the colour never washes out to white.
- **Grain is a pre-generated tileable plate** (`src/lib/noise.ts`), not a
  per-frame SVG filter. At 2% it also dithers the dark gradient, which is what
  keeps it from banding once encoded.

## Project structure

```
src/
  index.ts                 registerRoot
  Root.tsx                 the two compositions
  PasswordHud.tsx          the scene: perspective container + plane
  components/
    Background.tsx         seeded technical texture, depth-of-field slices
    Panel.tsx              the HUD card
    Shield.tsx             shield + keyhole, one even-odd SVG path
    PasswordField.tsx      PASSWORD label, field, asterisks, caret
    HudDetail.tsx          corner brackets, ticks, scan line, pulses
    Overlays.tsx           vignette, scanlines, grain
  lib/
    timeline.ts            every frame range and the derived scene state
    design.ts              colours and geometry in 3840-wide design units
    color.ts               RGB/HSL conversion and mixing
    random.ts              mulberry32
    useScale.ts            design units -> frame fraction
    fonts.ts / fonts.data.ts   embedded webfonts
    noise.ts               generated grain plate
```

## Content

The background is texture, not content: the glyph pool is meaningless, and there
is no readable code, no hostnames and no file paths. The only text in frame is
the word `PASSWORD` and the asterisks. No logos, no watermark, no credentials of
any kind.

## Fonts

Both families are embedded as base64 in `src/lib/fonts.data.ts` (sources in
`src/fonts/`), so a render never touches the network:

- **Rajdhani** — © Indian Type Foundry, SIL Open Font License 1.1 (`src/fonts/OFL-Rajdhani.txt`)
- **Share Tech Mono** — © Carrois Type Design, SIL Open Font License 1.1 (`src/fonts/OFL-ShareTechMono.txt`)

## Note on `remotion.config.ts`

The config reuses a Playwright Chromium if it finds one at a fixed path — a
convenience for sandboxed environments that block Remotion's own browser
download. On a normal machine that path does not exist and Remotion uses its own
managed browser. Delete the block if you would rather it never looked.
