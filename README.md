# AI Chat Hero

A 4K "AI chat bubble" hero animation built with [Remotion](https://remotion.dev):
a glowing AI badge inside a speech bubble, surrounded by overlapping message
cards and floating code, on a tilted plane with a slow camera push.

## The compositions

Two variants, both rendering from the same `AiChatHero` component. Everything
that separates them arrives as data.

| | `AiChatHero` | `AiChatHeroDark` |
|---|---|---|
| Resolution | **3840 × 2160 (4K UHD)** | **3840 × 2160 (4K UHD)** |
| Duration | **360 frames — 12.0 seconds** | **360 frames — 12.0 seconds** |
| Frame rate | **30 fps** | **30 fps** |
| Props | `{ variant: "blue", badge: "AI" }` | `{ variant: "dark", badge: "BOT" }` |
| Field | White cards on deep blue | Dark cards, light rationed to 3 |
| Accent | Red | Amber |
| Beside the badge | Audio waveform bars | Typing-indicator dots |

One shot with a slow push, not a loop — frames 0 and 360 differ by design.

The two share their entire scene layout: card count, sizes, positions, overlap,
drift, depth buckets, code blocks and camera are identical. Only the fills, the
badge glyph and the motif differ.

### The props

`variant` selects a palette from the exported `THEMES` object in `src/theme.ts`;
`badge` is the glyph drawn on the badge. Adding a third variant is a new entry
in `THEMES` plus a new member of the `Variant` union — no drawing code changes.
No hex literal appears anywhere outside `src/theme.ts`.

Colours there are named by *role*, not appearance, because the roles invert
between variants: the dominant card fill is white in `blue` and near-black in
`dark`, so a field called `cardWhite` would be a lie in half the themes.

Override per render:

```bash
npx remotion render AiChatHero out/custom.mp4 --props='{"variant":"dark","badge":"AI"}'
```

## Running it

```bash
npm install
npx remotion studio
```

### Render

Full 4K:

```bash
npx remotion render AiChatHero out/ai-chat-hero.mp4 \
  --codec=h264 --crf=12 --concurrency=8

npx remotion render AiChatHeroDark out/ai-chat-dark.mp4 \
  --codec=h264 --crf=12 --concurrency=8
```

1080p previews from the same 4K compositions:

```bash
npx remotion render AiChatHero out/ai-chat-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8

npx remotion render AiChatHeroDark out/ai-chat-dark-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

`--concurrency` is capped at the machine's core count; lower it if Remotion
rejects the value. It is deliberately not baked into `remotion.config.ts`.

## Layout

```
src/
  index.ts              registerRoot
  Root.tsx              both <Composition> registrations
  AiChatHero.tsx        the shared composition: buffers, draw order, one paint
                        per render
  config.ts             every tunable number — push rate, card count, code opacity,
                        badge glow, tilt angle, blur ceiling
  theme.ts              THEMES + the Variant union. The only file with hex literals
  fonts.ts              font loading, gated with delayRender()/continueRender()
  components/
    Card.tsx            a surrounding message card
    HeroBubble.tsx      the speech bubble, its motif cluster and text preview
    Badge.tsx           the badge, its glyph and its halo
    CodeBlock.tsx       a block of floating code
    Finish.tsx          background, bloom, vignette, grain
  scene/
    layout.ts           where everything sits, generated once from seeds
    heroGeometry.ts     hero measurements, derived from config
    codeSource.ts       the fictional JavaScript generator
  lib/
    matrix.ts           2D affine matrices
    plane.ts            the tilted plane, the camera push, depth and focus
    canvas.ts           rounded rects, speech tails, buffers
    motifs.ts           the cyan bar cluster and the typing dots
    rng.ts              seeded random helpers
public/
  fonts/                the woff2 faces, served locally
```

## How it renders

Everything is drawn to a single `<canvas>` with a 3840 × 2160 backing store, once
per React render from a `useLayoutEffect`. There is no `requestAnimationFrame`,
no CSS animation and no component state: every frame is a pure function of
`useCurrentFrame()`, and all stochastic values come from Remotion's `random()`
with stable string seeds, so `npx remotion render` is deterministic.

Cards and code blocks are each baked once to a small offscreen canvas and blitted
with a transform every frame. Depth of field uses three full-frame buffers —
sharp, mid and far — each blurred exactly once with `ctx.filter` and composited
far → mid → sharp; nothing is blurred per element.

Draw order: background → far buffer → mid buffer → floating code → sharp buffer
→ hero bubble → badge glow → badge → bloom → vignette → grain.

## Fonts

Poppins (heavy geometric sans, the "AI" glyph) and JetBrains Mono (the floating
code). `@remotion/google-fonts` supplies the font identity — family names and the
exact face URLs — and the woff2 files themselves are vendored into `public/fonts`
and served from there, so a render never depends on the network and can never
race a font that has not finished loading. Canvas text is drawn rather than laid
out by the browser, so a late font silently falls back to a system face and the
frame is wrong with no error; `src/fonts.ts` holds the renderer back behind a
`delayRender()` handle until both faces are in `document.fonts`.

## The dark variant

`AiChatHeroDark` is an inversion, not a recolour. Two decisions are worth
knowing before changing it:

- **The accent is amber, not red.** Against white cards `#C41E28` reads as a
  subtle counterweight; against dark cards it becomes the loudest thing in frame
  and fights the badge. Amber sits closer in value to the dark field and stays
  subordinate. Same count, same mid-distance placement.
- **Light is rationed.** Where `blue` fills most cards white, `dark` gives the
  light fill to exactly three — chosen small, mid-distance, and spread apart, so
  they read as three accents rather than one bright mass. `Theme.highlightCount`
  controls this; raising it undoes the inversion.

Every fill in `dark` also carries a rim lifted toward the highlight tone. Dark
cards on a dark field have far less inherent separation than white cards did,
and without the rim the overlapping stack collapses into one soft mass — the
failure mode for this variant. `rimWidthFactor`, `rimWidthFloor` and the `rim`
of each fill are the knobs if it ever needs more contrast.

The badge is the fixed point: identical gradient, rim, halo and pulse in both
variants, defined once in `theme.ts` rather than per theme. A glyph of three or
more characters loses cap height and tightens tracking, then is shrunk further
if it still overruns — the badge square never changes size. Two-character glyphs
skip that fit entirely, so `AI` is unaffected by it.

## Content

The floating code is fictional. Function names, comments and DOM calls are
invented — there is no real library source and no copyright header anywhere in
it. No logos, no watermark, no audio.
