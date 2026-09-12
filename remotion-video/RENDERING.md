# Neural sphere — deliverables and rendering

A 3D neural-network core built with three.js / WebGL inside Remotion.
20 seconds, 30fps, 600 frames, 16:9 — matching the reference clip's timing
exactly.

Two colour treatments:

- **Blue** — matches the reference: white-hot core, electric-blue filaments,
  cyan and magenta specks.
- **Dark cyan** — the identical scene and choreography shifted into deep
  teal, with an aqua accent in place of the magenta.

## Compositions

| ID                   | Resolution         | Colour        |
| -------------------- | ------------------ | ------------- |
| `NeuralSphereBlue`   | 1920 x 1080        | electric blue |
| `NeuralSphereBlue4K` | 3840 x 2160 (UHD)  | electric blue |
| `NeuralSphereCyan`   | 1920 x 1080        | dark cyan     |
| `NeuralSphereCyan4K` | 3840 x 2160 (UHD)  | dark cyan     |

All four are 600 frames at 30fps. The 1080p and 4K entries render the *same*
scene; only `resolutionScale` differs, and it scales the pixel-space
quantities (filament ribbon width, node point size) so line weight and dot
size read identically at either output size.

## Setup

```console
npm install
```

Node 18+ required. Remotion downloads its own headless Chrome on first render.

## Rendering 4K

```console
npx remotion render NeuralSphereBlue4K out/neural-sphere-blue-4k.mp4 \
  --codec=h264 --image-format=png --crf=15 --pixel-format=yuv420p

npx remotion render NeuralSphereCyan4K out/neural-sphere-dark-cyan-4k.mp4 \
  --codec=h264 --image-format=png --crf=15 --pixel-format=yuv420p
```

Swap the composition ID for `NeuralSphereBlue` / `NeuralSphereCyan` to render
the 1080p versions.

Two flags worth keeping:

- `--image-format=png` — the default JPEG intermediate leaves visible blocking
  in the dark background gradient. PNG frames are slower but clean.
- `--crf=15` — the scene is a lot of fine single-pixel detail on near-black.
  Higher CRF values smear the filaments and band the background.

For H.265 instead, use `--codec=h265`. For a ProRes master for an editor,
`--codec=prores --prores-profile=4444`.

### Rendering time

4K is roughly 4x the 1080p cost. Raise `--concurrency` to use more cores:

```console
npx remotion render NeuralSphereBlue4K out/blue-4k.mp4 \
  --codec=h264 --image-format=png --crf=15 --concurrency=8
```

## Preview and tweaking

```console
npm run dev
```

opens Remotion Studio. Every composition exposes typed props in the right-hand
panel, so the look can be retuned without touching code:

| Prop              | Does                                                     |
| ----------------- | -------------------------------------------------------- |
| `variant`         | `blue` or `darkCyan`                                      |
| `glow`            | master brightness for every additive element              |
| `wobble`          | how much the filament tips drift over time                |
| `seed`            | regrows a completely different filament tangle            |
| `nodeSizeScale`   | size of the dots travelling along the filaments           |
| `resolutionScale` | 1 at 1080p, 2 at 4K — leave as the composition sets it    |

Changing `seed` is the quickest way to get a different take on the same look.

## Notes

- There is no audio track; the reference has none either.
- The clip is not a seamless loop — it follows the reference, which drifts and
  slowly pushes in across its 20 seconds rather than returning to its start.
  Getting a frame-exact loop is a small change (periodic camera motion and
  integer node-travel cycles) if it is wanted.

Scene internals are documented in `src/neural-sphere/README.md`.
