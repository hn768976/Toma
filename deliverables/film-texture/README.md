# Analogue Film Texture Overlays — deliverables

**These are MULTIPLY overlays, not screen.** Dark artifacts on a pure white
field: set the clip's blend mode to **Multiply** over your footage. The white
field leaves the image untouched; only the dust and scratches darken it.

| File | Look |
| --- | --- |
| `V1_FilmTextureHeavy.mp4` | Heavy 16mm — dense dust, 2–4 scratches, gate border + weave, 3% flicker |
| `V2_FilmTextureSubtle.mp4` | Subtle 35mm — sparse dust, occasional hair, 0–1 scratches, 2% flicker |
| `V3_FilmScratchesOnly.mp4` | 4–8 vertical scratches, no dust, no specks |

1920×1080, H.264 `yuv420p`, 30fps, 20s, seamless loop, no audio track.
One 1080p PNG still per version alongside.

`film-texture-project.zip` is the full Remotion project, ready to render at 4K
(compositions are defined at 3840×2160). Unzip, `npm install`, then e.g.

```bash
npx remotion render V1-FilmTextureHeavy out/V1_FilmTextureHeavy.mp4 --scale=1 --crf=13
```

See the README inside the zip for the full render commands, the multiply note
and the resolution-dependent detail caveat.
