# AI Hologram Platform — deliverables

| File | What it is |
|---|---|
| `V1_AIHologramDarkBlue.mp4` | 1920×1080, H.264 `yuv420p`, 30 fps, 20 s, silent |
| `V2_AIHologramDarkCyan.mp4` | same, dark cyan palette |
| `V1_AIHologramDarkBlue.png` | 1920×1080 still, frame 450 (scene complete) |
| `V2_AIHologramDarkCyan.png` | same, dark cyan palette |
| `ai-hologram-project.zip` | the full Remotion project, ready to render at 4K |

The mp4s are the **1080p preview pass** (`--scale=0.5`). Both compositions are
defined at 3840×2160, so the 4K masters render from the same project with
`--scale=1`; see the README inside the zip for the exact commands, the Chromium
GL flag and measured per-frame render times.

The zip excludes `node_modules`, `.git` and render output. `npm install && npx
remotion studio` from a clean copy is verified working.
