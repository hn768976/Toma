# AI · Generating — loader motion graphic

Two 8-second (240 frame @ 30fps) compositions built from one shared set of
parts, plus 4K variants of each.

| Composition ID          | Size        | Look                                            |
| ----------------------- | ----------- | ----------------------------------------------- |
| `AiGeneratingDark`      | 1920 × 1080 | Reference-style: 3D-tilted code plane, dark      |
| `AiGeneratingDark4K`    | 3840 × 2160 | Same, at 4K                                      |
| `AiGeneratingLight`     | 1920 × 1080 | Light editorial layout: flat two-column, card    |
| `AiGeneratingLight4K`   | 3840 × 2160 | Same, at 4K                                      |

## Resolution independence

Nothing is hard-coded to 1080p. Every geometric value in these files is
authored at 1x (1920 × 1080) and multiplied by

```ts
const s = scaleFor(useVideoConfig().width); // 1 at 1080p, 2 at 4K
```

so the 4K compositions are the identical frame at twice the pixels — no
separate layout, no re-tuning. `CodeMatrix` additionally derives its row and
token counts from the field size, so text density stays constant too.

## Determinism

The code field and the dust motes look random but are pure functions of
`(index, frame)` via `mulberry32`. Remotion renders frames out of order
across workers, so anything seeded from `Math.random()` or `Date.now()`
would flicker between neighbouring frames.

## Shared timing

`progress.ts` owns the loading curve for both variants: a quick start, a
steady middle, a short stall around 68%, then a run to 100% that lands at
frame 224 and holds. Change it there and both versions stay in sync.

## Rendering

```console
# 1080p deliverables (H.264 / MP4)
npx remotion render AiGeneratingDark  out/ai-generating-dark-1080p.mp4  --codec=h264 --image-format=png --crf=17
npx remotion render AiGeneratingLight out/ai-generating-light-1080p.mp4 --codec=h264 --image-format=png --crf=17

# 4K masters
npx remotion render AiGeneratingDark4K  out/ai-generating-dark-4k.mp4  --codec=h264 --image-format=png --crf=16
npx remotion render AiGeneratingLight4K out/ai-generating-light-4k.mp4 --codec=h264 --image-format=png --crf=16
```

## Editable props

Both compositions expose a zod schema, so the copy can be changed from the
Remotion Studio sidebar without touching code:

- Dark: `badgeLabel`, `headline`, `statusLine`
- Light: `eyebrow`, `headline`, `subline`, `steps` (exactly 3)

## Fonts

`Montserrat` (headlines) and `Roboto Mono` (code/UI) are self-hosted in
`public/fonts` and registered behind `delayRender()` in `fonts.ts`, so a
render never captures a frame mid-fallback and never depends on the network.
