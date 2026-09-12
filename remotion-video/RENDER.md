# Trading Floor — render guide

This project contains four compositions of the same piece: 1080p and 4K,
dark and light. All four are 30 fps, 509 frames (16.967 s).

| Composition ID              | Size      | Theme |
| --------------------------- | --------- | ----- |
| `TradingFloor-Dark-1080p`   | 1920×1080 | dark  |
| `TradingFloor-Light-1080p`  | 1920×1080 | light |
| `TradingFloor-Dark-4K`      | 3840×2160 | dark  |
| `TradingFloor-Light-4K`     | 3840×2160 | light |

## Setup

```console
npm install
```

Node 18+ is required. Remotion downloads a headless Chrome on first run;
`remotion.config.ts` will reuse a Playwright Chromium at
`/opt/pw-browsers/...` if one happens to be present, and otherwise falls
back to Remotion's managed browser.

## Preview

```console
npm run dev
```

The studio opens with all four compositions listed. `theme`,
`tapeRowsPerSecond`, `salesRowsPerSecond` and `screenTexture` are editable
live in the right-hand props panel.

## Render the 4K masters

```console
npx remotion render TradingFloor-Dark-4K  out/trading-floor-dark-4k.mp4  --codec=h264 --crf=15 --muted
npx remotion render TradingFloor-Light-4K out/trading-floor-light-4k.mp4 --codec=h264 --crf=15 --muted
```

## Render the 1080p deliverables

```console
npx remotion render TradingFloor-Dark-1080p  out/trading-floor-dark-1080p.mp4  --codec=h264 --crf=17 --muted
npx remotion render TradingFloor-Light-1080p out/trading-floor-light-1080p.mp4 --codec=h264 --crf=17 --muted
```

## Notes

- **`--muted` matters.** The piece has no audio. Without the flag Remotion
  muxes a silent AAC track whose duration rounds up past the video's, so
  the container reads 17.02 s instead of 16.967 s.
- **ProRes for an edit round-trip:** `--codec=prores --prores-profile=hq`.
- **Image sequence:** `--sequence` writes numbered PNGs instead of a video.
- **Memory.** A 4K render holds 4× the pixels per frame. On a machine with
  limited RAM, add `--concurrency=2` (or `=1`).
- **Determinism.** Every frame is a pure function of the frame number, so
  re-rendering — on any machine, at any concurrency — produces identical
  output. Safe to split across workers.

Source walkthrough: `src/trading-floor/README.md`.
