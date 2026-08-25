# Secure Lock — 4K cybersecurity padlock animations

Two 16-second, seamlessly looping 4K compositions built with Remotion:

| Composition ID     | Variant | Palette                     | Glyph        |
| ------------------ | ------- | --------------------------- | ------------ |
| `SecureLockNavy`   | `navy`  | deep navy + warm sand       | classic padlock |
| `SecureLockGreen`  | `green` | phosphor CRT green + amber  | heraldic shield |

Both are 3840×2160 @ 60fps, 960 frames.

## Render

```bash
npm install
npx remotion render SecureLockNavy  out/secure-lock-navy.mp4  --codec=h264 --crf=12 --concurrency=8
npx remotion render SecureLockGreen out/secure-lock-green.mp4 --codec=h264 --crf=12 --concurrency=8
```

Or `npm run render:navy` / `npm run render:green`. `npm start` opens Remotion Studio.

## How it is built

Everything is drawn to `<canvas>` elements through refs, once per React render.
There is no `requestAnimationFrame`, no `Date.now()`, no CSS animation and no
component state — every pixel is a pure function of `useCurrentFrame()`, so
`npx remotion render` is deterministic and repeatable. All randomness comes from
Remotion's `random()` with stable string seeds.

Three stacked canvases:

1. **`BackgroundLayer`** — radial backdrop, the faint 90px grid, the drifting
   data field (numerals and square outlines expanding outward from centre), the
   broken-arc HUD ring, and the energy flare.
2. **`LockGlyph`** — the lock, on its own `screen`-blended canvas so its bloom
   lifts the arcs behind it. Drawn three times (warm fringe, cool fringe, white)
   composited with `lighter` for the persistent chromatic aberration.
3. **`FinishLayer`** — vignette, scanlines, grain.

### Swapping palettes and glyphs

`THEME` is the only place a hex literal appears in `src/SecureLock.tsx`; every
draw call reads its colours from there. `LockGlyph` owns both silhouettes and
nothing about their shape is defined outside it. Adding a third variant means
adding a `THEME` entry, a `GRADE` entry, a `stampGlyph` branch and a
`LOCK_HEIGHT` entry — no other file changes.

### Loop closure

The composition wraps its own frame (`useCurrentFrame() % 960`), so frame 0 and
frame 960 are bit-identical. That alone would be worthless if the motion were
discontinuous, so each mechanism is designed to close on its own:

- **Arc bands** each have N-fold symmetry and turn through a whole number of
  their own symmetry periods per loop. Directions alternate band to band.
- **Arc crosshatch** uses three line families 60° apart rather than a square
  grid — a square grid is only invariant under 90° steps and would leave the
  texture rotated at the loop point. Every segment in a band is identical, so a
  whole-period rotation maps the band onto itself.
- **Tick ring**: every 5th tick is long, giving it a 12-fold (not 60-fold)
  symmetry; it rotates two of those periods per loop.
- **Field elements** advance on an integer number of radial trips and fade to
  zero at both ends of each trip, so respawn is invisible.
- **Lock pulse** is a sine of period 240 — exactly four cycles.
- **Flare** is windowed to frames 660–780 and its envelope is zero at both ends.
- **Grain** cycles 8 pre-seeded tiles, and 960 % 8 === 0.

Verified by rendering frames 957→959 and 0 and comparing: the 959→0 step is
statistically indistinguishable from an ordinary frame step, and frames 0 and
960 hash identically.

### Fonts

The monospace face is self-hosted from `public/fonts/` and registered behind
`delayRender()` / `continueRender()`, so numerals never draw before the font is
ready and a render never depends on reaching a CDN. The family name still comes
from `@remotion/google-fonts`.
