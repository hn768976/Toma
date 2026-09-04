# AI Code Editor UI — Remotion

Three versions of a mock dark/light IDE motion graphic: a file explorer, code
typing itself in with syntax highlighting, a terminal panel filling with lint
warnings, and an AI assistance panel with a morphing blob and a short chat.

All compositions are **3840×2160, 30 fps, 600 frames (20 s)** and are built to
be rendered at 4K. They are not loops — the screen builds continuously and holds
complete from frame 430 to the end.

| Composition ID | Version | Theme | Language |
| --- | --- | --- | --- |
| `V1-AIEditorDarkPython` | V1 | Dark | Python |
| `V2-AIEditorDarkTypeScript` | V2 | Dark | TypeScript / React |
| `V3-AIEditorLightPython` | V3 | Light | Python |

## Getting started

```bash
npm install
npx remotion studio
```

Node 18+ is required. Fonts (Inter, JetBrains Mono) are embedded in
`public/fonts`, so nothing is fetched from a CDN at render time and the preview
and the render are pixel-identical.

## Render at 4K (3840×2160)

```bash
npx remotion render V1-AIEditorDarkPython     out/V1_AIEditorDarkPython.mp4     --scale=1 --crf=16
npx remotion render V2-AIEditorDarkTypeScript out/V2_AIEditorDarkTypeScript.mp4 --scale=1 --crf=16
npx remotion render V3-AIEditorLightPython    out/V3_AIEditorLightPython.mp4    --scale=1 --crf=16
```

`remotion.config.ts` already pins the codec to H.264 and the pixel format to
`yuv420p`. Add `--muted` if you want a video-only file with no silent audio
track (that is how the 1080p previews in this delivery were made).

### 1080p preview

```bash
npx remotion render V1-AIEditorDarkPython out/V1_AIEditorDarkPython.mp4 \
  --scale=0.5 --codec=h264 --pixel-format=yuv420p --crf=18 --muted
```

### Stills

```bash
npx remotion still V1-AIEditorDarkPython out/V1_AIEditorDarkPython.png --frame=500 --scale=1
```

`render-all.sh` renders all three 1080p previews plus one still each.

## How the scaling works

Every measurement in `src/` is authored in **1080p pixels**. `AiEditor.tsx`
reads `useVideoConfig().width` and applies a single
`transform: scale(width / 1920)` to the whole screen. That is why `--scale=0.5`
and `--scale=1` produce the same layout at two resolutions, with no font or
panel size drifting between preview and final render.

Code size is set so ~46 lines fit the editor viewport; each file is about a
dozen lines taller than that, which is what the frame 380–430 scroll reveals.

## Beat sheet (frames @ 30 fps)

| Frames | Beat |
| --- | --- |
| 0–30 | Explorer tree fades in top to bottom, staggered |
| 20–330 | Code types in line by line, blinking caret at the insertion point |
| 55–600 | Blob morphs continuously (one full cycle every 150 frames) |
| 120–160 | First chat message (fade + 8px rise) |
| 170–260 | Assistant reply types on, then its code block fades in |
| 300–340 | Follow-up message |
| 332–420 | Terminal warnings appear one at a time; `Problems (n)` counts up |
| 380–430 | Editor eases down to reveal the tail of the file |
| 430–600 | Hold — only the caret blink and the blob keep moving |

Timings live in `T` in `src/layout.ts`; the whole sequence can be retimed there.

## Project layout

```
src/
  Root.tsx            three <Composition> definitions
  AiEditor.tsx        screen assembly, 1080p→4K scale, Prism memoisation
  layout.ts           design units and the beat sheet
  theme.ts            dark and light palettes incl. syntax colours
  highlight.ts        Prism tokenising, done once per source string
  fonts.ts            embedded font loading via delayRender
  content/            per-version code, file tree, terminal and chat copy
  components/         TitleBar, Explorer, Editor, Terminal, Assistant, Blob
public/fonts/         Inter + JetBrains Mono (variable woff2)
```

### Notes on the implementation

- The UI is real DOM and CSS Grid — nothing is rasterised to canvas.
- Syntax highlighting runs through Prism **once per source string**, cached at
  module scope. Frames only change how many pre-tokenised lines are revealed.
- The blob is an SVG path from a seeded sum of integer harmonics keyed on the
  frame — no `Math.random()`. Amplitudes sum to 0.27, so the radius stays
  positive and the curve is star-convex and can never self-intersect. It is
  exactly periodic over 150 frames.
- All timing goes through `useCurrentFrame()` + `interpolate` with explicit
  `extrapolateLeft`/`extrapolateRight: "clamp"`.
- No logos, no real product names, no mouse pointer, no OS window chrome.
