# Global Data Network

An abstract "big data" motion graphic: an oblique HUD table carrying a halftone
world map, a live link graph between 39 city nodes, and a field of ~180
dashboard widgets, with a slow continuous camera drift across it.

Built to match a 20-second, 30fps reference clip — same length, same frame
rate, same 16:9 framing, in three colourways.

## Compositions

| Composition ID         | Size        | fps | Frames | Notes                     |
| ---------------------- | ----------- | --- | ------ | ------------------------- |
| `DataNetwork4KBlue`    | 3840 × 2160 | 30  | 600    | 4K master, blue colourway |
| `DataNetwork4KGreen`   | 3840 × 2160 | 30  | 600    | 4K master, green          |
| `DataNetwork1080Blue`  | 1920 × 1080 | 30  | 600    | Delivery, blue            |
| `DataNetwork1080Green` | 1920 × 1080 | 30  | 600    | Delivery, green           |
| `DataNetwork4KCyan`    | 3840 × 2160 | 30  | 600    | 4K master, dark cyan      |
| `DataNetwork1080Cyan`  | 1920 × 1080 | 30  | 600    | Delivery, dark cyan       |

All four are the same picture: the scene is authored in a fixed 1920 × 1080
design space and scaled by `width / 1920`, so the 4K compositions are true
resolution masters rather than upscales, and the two resolutions match frame
for frame.

## Rendering

```console
npm i

npm run render:1080         # 1920x1080 blue       (h264, crf 18)
npm run render:1080:green   # 1920x1080 green
npm run render:1080:cyan    # 1920x1080 dark cyan
npm run render:4k           # 3840x2160 blue       (h264, crf 16)
npm run render:4k:green     # 3840x2160 green
npm run render:4k:cyan      # 3840x2160 dark cyan
```

Or drive the CLI directly, e.g.:

```console
npx remotion render DataNetwork4KBlue out/master-blue.mp4 \
  --codec=h264 --crf=16 --jpeg-quality=100 --color-space=bt709
```

`npm run dev` opens the Remotion Studio if you want to scrub or retime.

`--muted` matters: without it Remotion writes a silent AAC track whose padding
stretches the container to 20.054s. Muted, the file is exactly 600 frames /
20.000s with a single video stream, matching the reference.

**Render cost.** The bloom pass (the stage is drawn twice, once blurred and
screen-blended) is the expensive part: roughly 3.5s per frame at 1080p and
four to five times that at 4K on a modest CPU, so budget ~35 minutes for a
1080p pass and a couple of hours for a 4K one. Rendering is CPU-bound and
parallel — `--concurrency` is worth raising on a bigger machine. To trade the
glow for speed, drop the `opacity` of the bloom `AbsoluteFill` in
`DataNetworkBoard.tsx` to 0, or delete that block.

## Where things live

```
src/
  index.ts              Remotion entry point
  Root.tsx              composition registrations
  data-network/
    constants.ts        timing, board geometry, camera rig
    theme.ts            the blue, green and dark cyan palettes
    rng.ts              seeded PRNG — the board is identical on every render
    network.ts          city coordinates, link graph, bezier helpers
    layout.ts           where every HUD widget sits, and the readable captions
    hud-modules.tsx     the 14 widget types (bars, donuts, gauges, streams…)
    DataNetworkBoard.tsx  camera rig, map layers, bloom and atmosphere
    preload.ts          blocks frame 1 until fonts and bitmaps are decoded
public/
  world-dots.png        7040 × 2528 halftone landmass mask
  grain.png             256 × 256 noise tile
scripts/
  generate-world-dots.mjs   rebuilds world-dots.png from Natural Earth data
  generate-grain.mjs        rebuilds grain.png
```

## Retiming and re-skinning

- **Length / fps** — `DURATION_IN_FRAMES` and `FPS` in `constants.ts`.
- **Camera** — the `CAMERA` block in `constants.ts`. `distance*` is a real
  dolly (the board sits that far behind the lens), `pan`/`dolly` slide along
  the table surface, `tilt`/`roll` orient it.
- **Colour** — `theme.ts`. Adding another colourway is a new entry in `THEMES`,
  its name in the `dataNetworkSchema` enum, plus a `Composition` in
  `src/Root.tsx`; nothing else changes. The blue carries the reference's
  full-spectrum HUD accents; the green and dark cyan are single-family
  re-skins, so all three cut together.
- **Widget mix** — the `weight` values in `layout.ts` control how often each
  widget type appears; `COLS`/`ROWS` control density.

## Regenerating the assets

The two bitmaps in `public/` are committed, so a plain `npm i` is enough to
render. They only need rebuilding if you change the map projection or the
grain:

```console
npm run generate:map
npm run generate:grain
```

The map is sampled from Natural Earth land polygons (via the `world-atlas`
package) on an equirectangular grid cropped to 73°N – 56°S, which is the
framing broadcast data graphics normally use.

## Fonts

JetBrains Mono (SIL Open Font License 1.1) is bundled in `public/fonts/` and
loaded through `delayRender()`, so renders never depend on a network fetch or
on fonts installed locally.
