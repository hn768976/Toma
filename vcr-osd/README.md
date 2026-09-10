# Retro VCR On-Screen Display

A template for VCR transport-control overlay plates: chunky bitmap `PLAY`,
`REWIND`, `FAST FORWARD`… with their transport glyph, over VHS tracking
distortion on black. One component, one data file, one clip per command.

- **3840×2160, 30fps, 600 frames (20s), seamless loop.**
- Previews are rendered at 1080p (`--scale=0.5`); the compositions themselves
  are 4K.

## How to use the clips — screen blend

These are **overlay plates**, not finished shots. The background is a true
`0,0,0` everywhere the tape artifacts do not reach, so:

> Drop the clip on a layer above your footage and set the blend mode to
> **Screen** (or Add / Linear Dodge). Black drops out, and only the OSD text,
> its phosphor smear and the tape noise survive.

There is no alpha channel and none is needed — Screen over black is exact.
Because the plate is pure white-on-black you can also tint it on the layer
(a slightly blue CRT, a warm amber deck) without touching the project.

Deliberately absent: no vignette, no global grain layer, no bloom beyond the
phosphor smear on the letters themselves. Grain exists only as part of the tape
noise, so your footage keeps its own contrast.

## Rendering

```bash
npm install

npm run dev                       # Remotion Studio
node scripts/render-all.mjs       # every command at 1080p + a still each
node scripts/render-all.mjs --scale=1            # 4K masters
node scripts/render-all.mjs --only=VCR-Play      # just one
```

A single 4K master, by hand:

```bash
npx remotion render VCR-Rewind out/VCR_Rewind.mp4 --scale=1 --crf=13
```

and the matching 4K still:

```bash
npx remotion still VCR-Rewind out/VCR_Rewind.png --scale=1 --frame=6
```

Composition ids use a hyphen (`VCR-FastForward`) because Remotion does not
allow underscores in ids; the delivered files use an underscore
(`VCR_FastForward.mp4`), which is the `file` field in `src/commands.ts`.

### Encoder settings

`remotion.config.ts` pins H.264, `yuv420p`, **CRF 13** and a PNG intermediate.
Per-frame noise is expensive to compress and is the first thing a low bitrate
destroys — it turns the sparse grain into blocky grey mud and lifts the black
off zero. Stay in the CRF 12–14 range. There is **no audio track**; verify with
`npx remotion ffprobe out/VCR_Rewind.mp4`.

### Resolution and noise

Noise is generated at **output resolution**, one speck per output pixel, not
scaled up from a fixed grid. The 4K render is therefore finer-grained than the
1080p preview — that is correct and is how tape noise behaves on a larger
scan. Everything else — cell size, tracking displacement, the head-switching
band — is a fraction of frame height, so it reads identically at both sizes.

## What ships

| | |
| --- | --- |
| `stills/VCR_*.png` | One 1080p still per command, at the frame named by `stillFrame`. |
| `vcr-osd-project.zip` | This project, ready to `npm install`. |
| `out/VCR_*.mp4` | Written by the render script: 1920×1080, 30fps, 20s, no audio. Not committed — the files are ~110 MB each. |

## Adding a command

Edit `src/commands.ts` and add an entry. Nothing else changes — a new
composition appears in the Studio, and `scripts/render-all.mjs` picks it up.

```ts
{
  id: "VCR-SlowMotion",     // a-z, A-Z, 0-9 and "-" only
  file: "VCR_SlowMotion",   // basename of the mp4 and png
  label: "SLOW MOTION",     // A-Z, 0-9, space . - / : +
  glyph: "play",            // a key from src/glyphs.ts, or "none"
  seed: 909,                // anything unique: decorrelates the glitching
  stillFrame: 250,          // frame used for the exported still
},
```

Long labels shrink to fit: the cell size is clamped so the block never exceeds
70% of frame width, which is why `FAST FORWARD` sets smaller type than `PLAY`.

To add a **new glyph**, add a pixel grid to `SHAPES` in `src/glyphs.ts` — seven
rows of `#` and `.`, any width. To add a **new character**, add a 5×7 grid to
`GLYPHS` in `src/pixel-font.ts`.

## How it is built

| File | Role |
| --- | --- |
| `src/commands.ts` | The command table. The only file you need for a new clip. |
| `src/pixel-font.ts` | 5×7 bitmap font, defined as literal pixel grids. |
| `src/glyphs.ts` | Transport glyphs on the same 7-row grid. |
| `src/plate.ts` | Rasterises glyph + word once, adds the phosphor smear. |
| `src/distortion.ts` | The tape model: tracking bands, tears, vertical hold, blink. |
| `src/noise.ts` | Seeded hashing and the wrap-around event timing. |
| `src/VCROSD.tsx` | Per-frame composite into one `ImageData`. |

**Bitmap letterforms.** Characters are hand-defined pixel grids drawn as exact
filled rectangles whose cell size is a whole number of *device* pixels. A real
font rendered small and scaled up gives soft, half-lit edges; this does not.
The canvas is `image-rendering: pixelated` so the browser never resamples it.

**The loop.** Every artifact is a pure function of `frame % durationInFrames` —
no `Math.random()` at render time and no state between frames. Events that
would run past frame 599 wrap around and finish at the head of the loop, so
frame 600 is byte-identical to frame 0. The label blink is on a 100-frame
interval, which divides 600 exactly.

**Distortion.** Horizontal tracking bands displace rows by a few pixels and
fade in and out over a few frames; tears split the word and throw everything
below the split sideways for two or three frames; the vertical hold breathes
and occasionally slips and settles; red and blue are sampled a pixel or two
either side of the core, strongest inside a tracking event; a jittering band of
torn noise sits at the foot of every frame. All of it is localised — between
artifacts the black stays at zero.
