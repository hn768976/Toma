# Gold Dot Vortex

Two seamlessly looping 4K dot-field motion graphics: fine dots arranged in
concentric arcs forming a slowly rotating disc on black, with a dark open
centre and a scattering of brighter sparkles.

| Composition id     | Look                          |
| ------------------ | ----------------------------- |
| `V1-DotVortexGold` | Gold / amber (reference match) |
| `V2-DotVortexCyan` | Cyan / white (cooler, cleaner) |

Both are defined at **3840x2160, 30fps, 300 frames (10s)**.

> Composition **ids** use a hyphen because Remotion does not allow `_` in an
> id. The delivered files are named `V1_DotVortexGold.*` / `V2_DotVortexCyan.*`.

## Setup

```console
npm install
npx remotion studio
```

## Render

**4K master** (3840x2160) — one command per composition:

```console
npx remotion render V1-DotVortexGold out/V1_DotVortexGold.mp4 --scale=1 --crf=16
npx remotion render V2-DotVortexCyan out/V2_DotVortexCyan.mp4 --scale=1 --crf=16
```

**1080p preview** (1920x1080). `--scale=0.5` renders the same 4K composition
and lets the browser downsample it, so the fine dots are supersampled rather
than dropped:

```console
npx remotion render V1-DotVortexGold out/V1_DotVortexGold.mp4 --scale=0.5 --crf=16
npx remotion render V2-DotVortexCyan out/V2_DotVortexCyan.mp4 --scale=0.5 --crf=16
```

**Stills** (`--frame` defaults to 0; drop `--scale` for a 4K still):

```console
npx remotion still V1-DotVortexGold out/V1_DotVortexGold.png --scale=0.5
npx remotion still V2-DotVortexCyan out/V2_DotVortexCyan.png --scale=0.5
```

Codec, pixel format (`yuv420p`), CRF and PNG frame capture are set in
`remotion.config.ts`, so the commands above need no extra flags.

## How it works

`src/vortex/` is plain 2D canvas — no 3D, no camera. There are ~50k dots in
~100 concentric rings; per frame only rotation, brightness and scale change.

- **`constants.ts`** — every tunable. Geometry is expressed as a fraction of
  frame height and dot sizes in px-at-2160p, so the 4K master and the 1080p
  preview are the same picture.
- **`layout.ts`** — ring/dot geometry, generated once at module level. Also
  carries the loop-closure argument (below).
- **`fields.ts` / `noise.ts`** — the frame-fixed polar noise fields that drive
  brightness clustering, sparkle selection, twinkle phase and jitter.
- **`draw.ts`** — the per-frame draw: a pure function of `(frame, size, palette)`.
- **`sprites.ts`** — cached sparkle sprite and grain tiles.

### Why the loop closes

Each ring holds `count` dots at even angular spacing `2*PI/count`, and over one
loop the ring turns by `2*PI*steps/count` — a whole number of its own dot
spacings. So at the last frame every dot sits exactly where another dot of the
same ring sat at frame 0.

For the frame to actually *match*, those dots also have to look the same, so no
per-dot attribute is baked onto the dot: brightness, sparkle, twinkle phase and
angular jitter are all sampled from frame-fixed world fields at the dot's
current position, and size/radius/fade are constant along a ring (hence
rotation-invariant). The final frame is the first frame with the dots
relabelled.

Because the condition is per-ring rather than global, each ring can turn at its
own rate: inner rings outrun outer ones (differential rotation, winding the
spiral arms) and the loop still closes. The breathing, sweep, pulse and twinkle
terms all complete a whole number of cycles per loop.

Measured on the encoded 1080p file: last frame -> first frame is 33.4 dB PSNR
against 34.1 dB for an ordinary one-frame step, i.e. the wrap is
indistinguishable from any other frame boundary.

### Tuning notes

- **Dot size** is capped at 1-4px at 2160p (`DOT_SIZE_MIN` / `DOT_SIZE_MAX`).
  That is finer than the stock reference, which sits nearer 7px at 4K; raise
  `DOT_SIZE_MAX` for a chunkier field.
- **The centre hole** is `HOLE_RADIUS`, a *radius* of 0.15 of frame height
  (so ~30% of frame height across). The reference's hole is wider — around
  0.3 — if you want to match it, that is the one value to change.
- **Anti-moire jitter** is kept under 4% of the local spacing: a per-ring
  radial offset (rotation-invariant) plus a high-frequency angular offset read
  from a world field.
- **Bloom is on the sparkles only.** A general bloom pass fuses the dots into a
  haze, and the discrete dots are the product.
