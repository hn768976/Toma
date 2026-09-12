# AI Agent Builder — dark-mode UI motion graphic

A 15-second dark-mode interface animation: a natural-language prompt is typed
into an agent builder, parsed into intents, compiled into a six-step workflow,
and then executed step by step.

Two cuts share one script and one timeline:

| Cut          | Palette                                           | Layout                                                                                |
| ------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Signal**   | near-black blue-grey, sky-cyan accent (`#4FC3F7`) | three columns — composer rail, vertical workflow canvas, inspector                    |
| **Meridian** | teal-tinted ink, dark cyan accent (`#0FB5AE`)     | left icon rail, full-width composer band, horizontal pipeline, docked telemetry strip |

## Compositions

| ID                            | Resolution | Duration             |
| ----------------------------- | ---------- | -------------------- |
| `AgentBuilder-Signal-1080p`   | 1920×1080  | 450f @ 30fps (15.0s) |
| `AgentBuilder-Signal-4K`      | 3840×2160  | 450f @ 30fps (15.0s) |
| `AgentBuilder-Meridian-1080p` | 1920×1080  | 450f @ 30fps (15.0s) |
| `AgentBuilder-Meridian-4K`    | 3840×2160  | 450f @ 30fps (15.0s) |

## Rendering

```console
npm i

# 1080p
npx remotion render AgentBuilder-Signal-1080p out/signal-1080p.mp4 \
  --codec=h264 --crf=18 --pixel-format=yuv420p --color-space=bt709

# 4K (same flags, 4K composition id)
npx remotion render AgentBuilder-Signal-4K out/signal-4k.mp4 \
  --codec=h264 --crf=18 --pixel-format=yuv420p --color-space=bt709

npx remotion render AgentBuilder-Meridian-4K out/meridian-4k.mp4 \
  --codec=h264 --crf=18 --pixel-format=yuv420p --color-space=bt709
```

A 4K render is roughly 4× the work of 1080p. If a machine is short on RAM,
add `--concurrency=2`.

## How 4K works

Everything is authored against a fixed 1920×1080 design grid. `Stage` scales
that grid with a single CSS transform to whatever the composition's real
resolution is, so the 4K compositions re-rasterise the same DOM at full device
resolution — text and hairline rules stay genuinely sharp rather than being
upscaled. There are no duplicated layouts and no hand-tuned font sizes per
resolution.

## Structure

```
constants.ts    design grid, fps, duration
theme.ts        the two palettes
content.ts      prompt text, workflow steps, intents, log lines
timeline.ts     every beat in the 450 frames, shared by both cuts
Stage.tsx       1080p→4K scaler
primitives.tsx  panels, mono labels, grid backdrop, caret
parts/          chrome, composer, canvas, node card, inspector, telemetry
```

Re-timing the piece means editing `timeline.ts` only; both cuts follow it.
Re-skinning means editing `theme.ts` only.
