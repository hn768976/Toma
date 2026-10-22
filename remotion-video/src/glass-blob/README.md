# Glass Blob

A wobbling glass/soap-bubble blob with a bright Fresnel rim. It is drawn by a
WebGL2 fragment shader that raymarches a noise-displaced sphere.

- 40 s at 30 fps (1200 frames). The 20 s loop plays first over the first
  backdrop, then hard-cuts at frame 600 to the same loop over a chroma-key
  backdrop.
- The loop is seamless: the noise travels around a circle, and the blob spins
  exactly once per loop.

| Composition | Size | Palette |
| --- | --- | --- |
| `GlassBlob4K` | 3840×2160 | Reference: black, then green screen #30FF09 |
| `GlassBlob` | 1920×1080 | Same as above |
| `GlassBlobIridescent4K` | 3840×2160 | Iridescent rim: midnight, then blue screen #0047BB |
| `GlassBlobIridescent` | 1920×1080 | Same as above |

## Render

```console
npm i
npx remotion render GlassBlob4K out/GlassBlob-4K.mp4 --gl=angle --codec=h264
npx remotion render GlassBlob out/GlassBlob-1080p.mp4 --gl=angle --codec=h264
```

On a machine without a GPU, use `--gl=swangle`. Colours live in
`palettes.ts`, and the shape and shading constants live in `shader.ts`.
