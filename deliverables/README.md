# Line Mesh Cloth — deliverables

| File | What it is |
| --- | --- |
| `V1_LineMeshBlue.mp4` | Deep blue, 1920×1080, H.264 `yuv420p`, 30 fps, 12 s, seamless loop |
| `V2_LineMeshCopper.mp4` | Copper/bronze, same spec |
| `V1_LineMeshBlue.png` | 1080p still, frame 96 |
| `V2_LineMeshCopper.png` | 1080p still, frame 210 |
| `line-mesh-project.zip` | The whole Remotion project, ready to render at 4K elsewhere |

Both videos are 1080p previews (`--scale=0.5`) of compositions defined at
3840×2160. The zip's `README.md` has the exact 4K render command for each
composition, the required Chromium GL flag, and the measured per-frame render
time. It excludes `node_modules`, `.git` and render output;
`npm install && npx remotion studio` works from a clean extraction.
