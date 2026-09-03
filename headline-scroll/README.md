# headline-scroll

A 4K "AI headline scroll" in Remotion, in two versions driven by one codebase:
a block of invented article-page fragments scrolls past at constant speed, with
one recurring keyword held in sharp focus while the rest of each headline drops
into graded blur.

| Composition | Look | Axis | Keyword | Cards |
|---|---|---|---|---|
| `HeadlinesLight` | clean white web pages on pale grey | vertical, upward | "intelligence" | 7 |
| `HeadlinesPaper` | warm newsprint, mottled and slightly tilted | horizontal, leftward | "AI" | 5 |

Both are 3840 × 2160, 348 frames at 30 fps (11.6 s), and loop seamlessly —
frame 348 is pixel-identical to frame 0 at full 4K.

## All content is fictional

Every headline, wordmark, site mark, section label, byline, date and word of
body text is invented for this piece. Site marks are plain squares; wordmarks
are generic common nouns; bylines name roles, not people; dates carry no year;
body text is deterministic nonsense from syllable fragments. **No real
publication, masthead, logo, journalist, article or visual identity is
depicted, reproduced or imitated.**

## Running it

```bash
npm install
npm run dev                                   # Remotion Studio

# 1080p previews
npx remotion render HeadlinesLight out/headlines-light-preview.mp4 --codec=h264 --crf=18 --scale=0.5
npx remotion render HeadlinesPaper out/headlines-paper-preview.mp4 --codec=h264 --crf=18 --scale=0.5

# full 4K
npx remotion render HeadlinesLight out/headlines-light.mp4 --codec=h264 --crf=12 --concurrency=8
npx remotion render HeadlinesPaper out/headlines-paper.mp4 --codec=h264 --crf=12 --concurrency=8
```

`--concurrency` must not exceed your CPU core count. `--scale` only changes the
output size: the canvas backing store is always 3840 × 2160, so a scaled render
is a true 4K frame downsampled.

## Determinism

Everything is painted into one `<canvas>` through a ref, once per React render.
No `requestAnimationFrame`, no CSS animation, no `Date.now()`, no animated
state — every frame is a pure function of `useCurrentFrame()`, and all
randomness goes through Remotion's `random()` with stable string seeds. The
only React state tracks font loading, gated by `delayRender()`.

Cards are laid out and painted **once**, each to its own offscreen canvas, with
the keyword focus blur, tilt, drop shadow and directional motion blur all baked
in at build time. The per-frame cost is a handful of `drawImage` calls plus
grain and vignette.

## Shared library

`src/vendor/` is vendored from the shared component library, kept in this repo
at [`../remotion-lib`](../remotion-lib) (working location
`~/projects/remotion-lib`). Edit the library, then:

```bash
node scripts/sync-lib.mjs            # refresh src/vendor
node scripts/sync-lib.mjs --check    # report drift
```

Vendoring rather than linking is deliberate: each deliverable zip has to unzip
and render on its own.

## Deliverables

```bash
node scripts/make-zips.mjs           # dist/headlines-light.zip, dist/headlines-paper.zip
```

Each zip is a standalone project registering a single composition, with the
library already vendored and its own README.
