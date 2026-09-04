# Forex Ticker Wall — deliverables

| File                        | What it is                                     |
| --------------------------- | ---------------------------------------------- |
| `V1_ForexWallDark.mp4`      | 1920×1080, H.264 yuv420p, 30 fps, 16.00 s, 480 frames, seamless loop, no audio |
| `V2_ForexWallLight.mp4`     | same, light broadcast board                    |
| `V1_ForexWallDark.png`      | 1080p still, frame 96                          |
| `V2_ForexWallLight.png`     | 1080p still, frame 96                          |
| `forex-wall-project.zip`    | the full Remotion project, 4K-render-ready     |

Both compositions are defined at 3840 × 2160; the mp4s above are the 1080p
previews (`--scale=0.5`). The 4K masters are rendered separately from the zip:

```bash
unzip forex-wall-project.zip && cd forex-wall && npm install
npx remotion render V1-ForexWallDark  out/V1_ForexWallDark.mp4  --scale=1 --crf=16 --muted
npx remotion render V2-ForexWallLight out/V2_ForexWallLight.mp4 --scale=1 --crf=16 --muted
```

The project source also lives in `../forex-wall/` in this repository; the zip
is that directory without `node_modules`, `.git` or any render output.

Every rate, change and percentage is invented. Nothing is dated, and no
broker, exchange, venue or logo appears anywhere.
