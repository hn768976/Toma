# AI Chat Hero

A 4K "AI chat bubble" hero animation built with [Remotion](https://remotion.dev):
a glowing AI badge inside a speech bubble, surrounded by overlapping message
cards and floating code, on a tilted plane with a slow camera push.

## The composition

| | |
|---|---|
| Composition id | `AiChatHero` |
| Resolution | **3840 × 2160 (4K UHD)** |
| Duration | **360 frames — 12.0 seconds** |
| Frame rate | **30 fps** |
| Props | `{ variant: "blue" }` |

One shot with a slow push, not a loop — frames 0 and 360 differ by design.

### The `variant` prop

`variant` selects a palette from the exported `THEMES` object in
`src/theme.ts`. Only `"blue"` exists today; adding a palette is a new entry in
that object plus a new member of the `Variant` union, and nothing else. No hex
literal appears anywhere outside `src/theme.ts`.

Override it per render:

```bash
npx remotion render AiChatHero out/ai-chat-hero.mp4 --props='{"variant":"blue"}'
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
```

1080p preview from the same 4K composition:

```bash
npx remotion render AiChatHero out/ai-chat-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

`--concurrency` is capped at the machine's core count; lower it if Remotion
rejects the value. It is deliberately not baked into `remotion.config.ts`.

## Layout

```
src/
  index.ts              registerRoot
  Root.tsx              the <Composition> registration
  AiChatHero.tsx        the composition: buffers, draw order, one paint per render
  config.ts             every tunable number — push rate, card count, code opacity,
                        badge glow, tilt angle, blur ceiling
  theme.ts              THEMES + the Variant union. The only file with hex literals
  fonts.ts              font loading, gated with delayRender()/continueRender()
  components/
    Card.tsx            a surrounding message card
    HeroBubble.tsx      the speech bubble, waveform cluster and text preview
    Badge.tsx           the AI badge and its halo
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
    motifs.ts           the cyan bar cluster
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

## Content

The floating code is fictional. Function names, comments and DOM calls are
invented — there is no real library source and no copyright header anywhere in
it. No logos, no watermark, no audio.
