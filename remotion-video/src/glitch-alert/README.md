# Cyber Alert — glitch warning screen

A 15.07s / 30fps recreation of a "system warning" stock loop: a red alert
triangle and a heavy headline over an animated blue pixel-mosaic field,
interrupted by scheduled signal glitches.

Two headlines x two resolutions, all from one component:

| Composition ID        | Size      | Headline        |
| --------------------- | --------- | --------------- |
| `PhishingAttack1080p` | 1920x1080 | PHISHING ATTACK |
| `PhishingAttack4K`    | 3840x2160 | PHISHING ATTACK |
| `SystemHacked1080p`   | 1920x1080 | SYSTEM HACKED   |
| `SystemHacked4K`      | 3840x2160 | SYSTEM HACKED   |

`headline` is an input prop, so any other wording can be rendered without
touching the code:

```bash
npx remotion render PhishingAttack4K out/custom-4k.mp4 \
  --codec=h264 --image-format=png --crf=17 --muted \
  --props='{"headline":"ACCESS DENIED"}'
```

## Rendering

```bash
npm run render:phishing:1080p   # and :4k
npm run render:hacked:1080p     # and :4k
npm run render:all              # all four
```

Two flags in those scripts matter and should be kept:

- `--image-format=png` — the repo default is JPEG, which leaves visible
  ringing all over the dense mosaic. PNG intermediates cost render time
  but keep the field clean.
- `--muted` — the piece has no sound, and without this the muxer writes a
  silent AAC track that some NLEs will still try to conform.

## How it is put together

Everything is painted with Canvas2D; there is no DOM/SVG in the frame.
The layer order per frame is:

1. **Background layer** (`drawMosaic` -> `drawBloomGlow` ->
   `drawCodeFragments` -> `drawDigits`) — the blue static field, the soft
   light sweeps drifting through it, and the flavour text.
2. **Foreground layer** (`drawHeadlineText`, `drawTriangle`) — kept on its
   own canvas so the glitch pass can tear and colour-split the alert
   independently of the field.
3. **Glitch composite** (`render-frame.ts`) — slice tearing, chromatic
   split, signal drop.
4. **Finishing** — scanlines, roll bar, vignette.

### Resolution independence

Every geometric value in `constants.ts` is authored at 1920x1080 and
multiplied by `scale = width / 1920` at draw time. The 4K compositions are
therefore the *same picture* at 2x, not a separately tuned variant — the
mosaic has the same number of blocks at both sizes, each one twice as
large, rather than 4K showing four times as many finer blocks.

### Determinism

Remotion renders frames out of order across parallel workers, so nothing
here may read `Math.random()` or the clock. All variation comes from
`hash2`/`hash3` in `random.ts`, seeded from the frame number and an index.
Anything that is not a pure function of its inputs shows up as strobing
between frames.

### Glitch timing

`GLITCH_EVENTS` in `constants.ts` is a hand-placed list of `{at, dur,
intensity, kind}` in seconds, matched to where the reference clip breaks
up. `kind` selects the behaviour:

- `heavy` — full-frame slice tearing, RGB split, headline shred
- `drop` — signal loss: the alert blinks out while the field carries on
- `soft` — wobble and chromatic fringing only

Re-timing the piece means editing that list; nothing else needs to change.

## Gotchas worth knowing before editing

- **Do not gate font loading on `document.fonts.check()`.** It returns
  `true` for a family the document has never heard of, because the
  fallback it would resolve to is itself loaded. `fonts.ts` tracks a real
  flag set when the `FontFace` promises settle; `GlitchAlert` holds a
  `delayRender()` until the canvas has painted with the fonts actually in
  place. Without that the headline silently renders in a system face.
- **Google Fonts' `css2` endpoint returns several `@font-face` blocks**,
  one per unicode subset. The ASCII glyphs live in the block commented
  `/* latin */`, which is the *last* one — taking the first URL gets you
  `latin-ext` (or `cyrillic-ext`), which has no capital letters at all and
  fails over to a fallback face without any error.
- **Background bands are torn horizontally only.** Displacing them
  vertically, or rolling the whole field, opens black seams, since
  nothing is drawn behind the field to fill the gap.
