# Security Breach Alert

Two 4K/30fps Remotion compositions of a technical desktop screen whose login
dialog resolves to opposite outcomes.

| Composition id   | Outcome                                    | Deliverable                |
| ---------------- | ------------------------------------------ | -------------------------- |
| `SecurityBreach` | Red warning triangle, `SECURITY BREACH`    | `V1_SecurityBreach.mp4`    |
| `AccessGranted`  | Green check, `ACCESS GRANTED`              | `V2_AccessGranted.mp4`     |

Both are 3840x2160, 30fps, 450 frames (15s), and carry no audio track. They
are sequences with an outcome, not loops.

## Setup

```sh
npm install
npm run dev        # Remotion Studio
```

## Rendering

**4K masters** — the delivery command:

```sh
npx remotion render SecurityBreach out/V1_SecurityBreach.mp4 --scale=1 --crf=16
npx remotion render AccessGranted  out/V2_AccessGranted.mp4  --scale=1 --crf=16
```

`npm run render:v1` / `npm run render:v2` are the same two commands.

**1080p previews** — the compositions stay defined at 4K and are rendered
down with `--scale`:

```sh
npx remotion render SecurityBreach out/V1_SecurityBreach.mp4 --scale=0.5 --crf=18
npx remotion render AccessGranted  out/V2_AccessGranted.mp4  --scale=0.5 --crf=18
```

**Stills**:

```sh
npx remotion still SecurityBreach out/V1_SecurityBreach_f300.png --frame=300 --scale=0.5
npx remotion still AccessGranted  out/V2_AccessGranted_f300.png  --frame=300 --scale=0.5
```

`remotion.config.ts` pins H.264 / `yuv420p` and renders intermediate frames as
PNG rather than JPEG — the teal field is a wide, shallow ramp, and JPEG chroma
subsampling puts blotches into it before the encoder ever sees a frame.

## Beat sheet

All timings live in `BEATS` in `src/theme.ts`; nothing in the clip reads a
frame number that is not declared there.

| Frames  | What happens                                                        |
| ------- | ------------------------------------------------------------------- |
| 0–40    | Background running. Dialog fades and scales in.                     |
| 30–120  | Username types into field one at an uneven, seeded rhythm.           |
| 110–210 | Password fills field two with masking characters.                    |
| 210–211 | Both fields blow out to white, text inverted.                        |
| 212–213 | Dialog body clears.                                                  |
| 214     | The alert glyph and caps slam in — scale overshoot plus a shake.     |
| 250–330 | Background picks up the accent: borders flash, code lines flip, the alarm wash crosses the frame (twice for the breach, once for the grant). |
| 330–450 | Hold, accents continuing.                                            |

The cut at frame 210 is the moment the clip exists for. It is a hard
three-stage switch — flash, clear, slam — with no dissolve anywhere in it.

## How it is built

- **One component, one prop.** `SecurityAlert` takes `outcome: "breach" |
  "granted"`. `accentFor()` in `src/theme.ts` resolves that into a colour, a
  label, a glyph choice and how hard the background reacts; nothing else in
  the tree branches on the outcome.
- **No state, no timers.** Every value is a pure function of
  `useCurrentFrame()`, with explicit `extrapolateLeft`/`extrapolateRight`
  clamping on each `interpolate`. Remotion renders frames out of order across
  threads, so anything that accumulated would tear.
- **Seeded content.** `src/random.ts` is a mulberry32 PRNG keyed by string, so
  a panel's code fragments, flash phase and scroll offset are derived from its
  id rather than from call order.
- **Real DOM.** The background is a 24x16 CSS Grid with irregular panel spans;
  the dialog is flex. The warning triangle is a rounded-polygon path generated
  in `src/dialog/AlertGraphic.tsx`, not a stock icon.
- **Typing slices strings.** `src/dialog/typing.ts` builds a per-character
  frame schedule once and the field renders `text.slice(0, n)` — there are no
  per-character components.
- **Background content is texture.** Hex groups, bracket tokens and neutral
  engineering nouns only. Nothing in the frame resolves into a real system:
  no addresses, host names, file paths or runnable command syntax. No brand
  names, no real product UI, no watermark.
- **Fonts are embedded.** `public/fonts` holds the two variable faces
  (Roboto Mono for the technical type, Archivo for the alert caps), registered
  through a `delayRender()` handle so no frame is captured before they are
  ready and no render touches the network.
- **Bloom is rationed.** Drop-shadows are on the alert glyph and the brightest
  headline data only. The code panels stay crisp — bloom them and the whole
  frame fogs.

## Project layout

```
src/
  theme.ts             palette, geometry, beat sheet
  alert.ts             pure timing signals for the accent takeover
  random.ts            seeded PRNG
  color.ts             hex mix / alpha helpers
  fonts.ts             embedded face registration
  SecurityAlert.tsx    the clip
  Root.tsx             both compositions
  background/
    Background.tsx     the 24x16 grid
    Panel.tsx          border, fill and bracket chrome
    CodePanel.tsx      scrolling monospace blocks
    DataPanels.tsx     headers, readouts, serials, meters, spine
    Overlays.tsx       field, CRT glow, scanlines, grain, alarm wash
    content.ts         seeded panel content
  dialog/
    Dialog.tsx         the login window and its stages
    Chrome.tsx         title bar and footer buttons
    Field.tsx          one input field
    AlertGraphic.tsx   the triangle / check and its caps
    metrics.ts         dialog geometry
    typing.ts          per-character typing schedule
```
