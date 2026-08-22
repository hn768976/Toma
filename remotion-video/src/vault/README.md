# "the vault" — a Kurzgesagt-style leptin explainer

29 seconds, 870 frames, 30fps, 1920×1080.

Two ways to watch it:

| | |
|---|---|
| **Remotion Studio** | `npm run dev`, pick the `KurzgesagtVault` composition |
| **Standalone HTML** | `npm run build:standalone` → open `dist/kurzgesagt-vault.html` |
| **Video file** | `npx remotion render KurzgesagtVault out/vault.mp4` |

The standalone build is a **single self-contained HTML file** — the React
bundle, the Remotion Player, and the display font (base64 woff2) are all
inlined, so it makes no network requests and needs no server. The 1920×1080
frame is a fixed canvas (deliberately not responsive, so nothing reflows
mid-recording), and the replay/pause buttons sit *below* it, outside the frame,
so a recording cropped to the frame never catches a control.

## How it is built

Two animation systems run side by side and never read each other's state.

### The camera — `camera.ts`

Every element lives inside one oversized **3840×2160 scene container**; the
1920×1080 frame is a viewport onto it. The camera is a `{x, y, scale}` triple
applied as a single transform on that container.

A new move starts **at least every 60 frames** for the whole runtime, and each
move eases over ~66 frames, so consecutive moves overlap and the picture is
never completely still. Moves are stored as *deltas* and summed — that is what
makes the overlap work: a pull-out still easing out simply adds to a lateral
drift that has just begun, instead of fighting it for one value.

Everything uses `cubic-bezier(0.4, 0, 0.2, 1)`. No linear, no bounce.

Moves stay inside ±15% scale and ±150px, with two deliberate exceptions the cue
sheet calls out as the extremes of the film: the hard push to **1.25** on the
gauge at f750 (tightest shot) and the wide pull to **0.95** at f810 (widest).

### The elements — `anim.ts`, `SceneItem.tsx`

Each prop is a `<SceneItem>`, which owns exactly three things: its absolute
position in scene space, its reveal, and its idle float.

* **Enter** — scale 0.85 → 1.0 with a fade, 12 frames, ease-out.
* **Exit** — scale 1.0 → 0.9 with a fade, 9 frames.
* **Idle float** — a sine on translateY, ±6px, 3–4s period, phase-offset per
  element by a `seed` so nothing bobs in lockstep.

Nothing slides in from off-screen and there are no `<Sequence>` boundaries
anywhere — the whole video is one continuous scene, and the camera carries you
between beats. Visuals land 6 frames before the words explain them (`lead()`).

The only bounce in the entire video is the crown landing at cue 11.

### Always running

The ambient dots (`AmbientDots.tsx`, 36 of them at 15–25% opacity) and the
guard's clock hand never stop, in any cue, at any point.

## Palette

Colours mean things, and they are not used for anything else:

| | | |
|---|---|---|
| `#FFC93C` | yellow | fat / the vault's contents **only** |
| `#FF6B6B` | coral | alarm — the guard's cap and his interventions |
| `#4ECDC4` | teal | the hormone, the clock, the gauge |
| `#F7F3E9` | cream | structures, characters, type |
| `#0B1A2F` | navy | background (shifts 8% cooler at cue 8 and stays) |

Flat vector throughout: hard-edged shapes, no outlines, no drop shadows, no
gradients except the wide soft glows behind emissive objects. Where a cream
limb would vanish against a cream body, it is drawn over a slightly fatter navy
shape — a flat-vector cut, not a stroke.

## Files

```
constants.ts     timing, palette, scene positions, cue frames
camera.ts        the move list and the camera solver
anim.ts          reveal / float / easing helpers
SceneItem.tsx    position + reveal + float wrapper
AmbientDots.tsx  the drifting cream dots
Glow.tsx         the soft radial glow behind emissive objects
Svg.tsx          origin-centred SVG wrapper used by every prop
font.ts          registers the embedded display face
props/           vault, guard, clock, gauge, sandwich, crown, …
KurzgesagtVault.tsx   all 16 cues assembled
```

To change the typeface, drop a new woff2 into `public/fonts/` and re-run
`node scripts/embed-font.mjs`.
