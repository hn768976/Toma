# Colon cutaway — deliverables

| Path | Contents |
|---|---|
| `previews-1080p/` | `Colon_ConstipationRelief.mp4` (15 s), `Colon_HealthyFlora.mp4` (20 s seamless loop), `Colon_InflammationRelief.mp4` (15 s) — 1920×1080, H.264, yuv420p, 30 fps, CRF 16, no audio |
| `stills-1080p/` | one 1080p PNG per composition (lossless frames from the preview render) |
| `stills-6000x3375/` | two 6000×3375 PNGs per composition (blocked/clear, two loop frames, inflamed/healed) |
| `meshy-turntables/` | turntables of every Meshy candidate (3 colon rounds, clump) + the supplied model |
| `model-check/` | cutaway checks from 12 angles + centreline debug still |
| `checks/` | verify-loop outputs: `summary.txt` (ffprobe, loop, determinism, banding), `check_inside.json`, banding plots, 5-frame and every-10th-frame sheets, `render_times.txt` |
| `colon-cutaway-project.zip` | the Remotion project (source, config, pinned `package.json`, models, centreline, README) — `npm install && npx remotion studio` |
