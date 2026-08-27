# Agentic AI HUD — Remotion

Three 4K HUD animations built from one Remotion project and one shared
component tree. Each is a one-shot build-and-hold: the assembly constructs
itself, the centre label arrives, and the piece settles into an idle state
that holds to the end.

They are deliberately not one asset in three colours. v1 is scanned, v2
broadcasts a warning, v3 listens — and v3 replaces the concentric circles
with concentric speech bubbles outright.

## Compositions

| Composition id      | Variant  | Resolution  | Duration            | FPS |
| ------------------- | -------- | ----------- | ------------------- | --- |
| `AgenticDialViolet` | `violet` | 3840 × 2160 | 490 frames / 16.33s | 30  |
| `AgenticDialBreach` | `breach` | 3840 × 2160 | 490 frames / 16.33s | 30  |
| `AgenticDialChat`   | `chat`   | 3840 × 2160 | 490 frames / 16.33s | 30  |

All three take a single `variant` prop and share one `AgenticHud` component.

### v1 — "violet"

Deep plum ground, twelve dense concentric bands counter-rotating band to band
at widely varying speeds, and a cyan beam that arrives from the lower left,
strikes the dial's edge and holds. A second, thinner beam enters from the
upper right later. Busy and technical by intent. The dark core disc is sized
to hold the centre label outright, with the eleven bands packed around it.

### v2 — "breach"

Same band array and same `rings` geometry, recoloured to a red alert. The
linear beams are gone: shockwave rings leave the centre on a seeded, irregular
35–60 frame interval, each preceded by a two-frame flash, three to four alive
at once. Five bands stutter — holding 10–25 frames, then snapping 15–40° over
two frames — while the rest keep turning smoothly. Glitch bursts every 50–90
frames shift horizontal slices sideways and split the label's colour channels.
The assembly is compressed and snaps in rather than easing.

### v3 — "chat"

Mint on near-white, and the largest departure in the set: `BandLayer` swaps its
shape primitive from a circle to a rounded speech bubble with a tail on the
lower left, and the band count drops from twelve to six with ~40% lighter
strokes. The six bands sit at even 0.14 steps, every outline is closed, and
the dash pattern runs an even 48/48. "Chatbot" is set in dark green; only the
three typing dots stay mint. Bubbles cannot spin without reading as broken, so the bands pulse
±2% instead, staggered into a slow outward ripple. A soft mint wedge sweeps
about the assembly, completing exactly two turns across the 490 frames. Three
typing dots animate beneath the label. No bloom — on a light ground additive
glow is always wrong, so the emissive elements get a tight overexposure lift
instead, and the vignette lightens the corners rather than darkening them.

## Rendering

Preview renders (1080p, half scale):

```
npx remotion render AgenticDialViolet out/agentic-violet-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
npx remotion render AgenticDialBreach out/agentic-breach-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
npx remotion render AgenticDialChat   out/agentic-chat-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

Full 4K renders:

```
npx remotion render AgenticDialViolet out/agentic-violet.mp4 --codec=h264 --crf=12
npx remotion render AgenticDialBreach out/agentic-breach.mp4 --codec=h264 --crf=12
npx remotion render AgenticDialChat   out/agentic-chat.mp4   --codec=h264 --crf=14
```

Interactive preview: `npx remotion studio`.

`--concurrency` may not exceed the machine's CPU core count; lower it if
Remotion rejects the value.

## Included stills

`stills/` holds verification frames for each composition, rendered at
1920 × 1080 (`--scale=0.5`). No video files are bundled — render them with the
commands above.

- `violet-f140.png`, `violet-f240.png`, `violet-f400.png`
- `breach-f140.png`, `breach-f218.png` (glitch frame), `breach-f240.png`,
  `breach-f400.png`
- `chat-f140.png`, `chat-f300.png`, `chat-f420.png`

Render any frame yourself with, for example:

```
npx remotion still AgenticDialViolet out/violet-f240.png --frame=240 --scale=0.5
```

## Project layout

```
src/
  index.ts                  registerRoot
  Root.tsx                  the three <Composition> entries
  variants.ts               the single exported VARIANTS object
  AgenticHud.tsx            owns the visible canvas and composites the layers
  components/
    Backdrop.tsx            large faint arcs behind the assembly
    BandLayer.tsx           renders whatever band array it is given
    CentreLabel.tsx         two lines, glow pulse, typing dots, channel split
    BeamLayer.tsx           linearScan | radialPulse | sweep
    ParticleWash.tsx        fine drifting particles
  lib/
    geometry.ts             circle and speech-bubble shape primitives
    motion.ts               assembly, rotation, stutter, schedules, drift
    postfx.ts               glow, glitch slices, vignette, grain
    util.ts                 easing, seeded randomness, colour helpers
```

### How the band system works

The concentric bands are data, not code. `variants.ts` holds an array of band
definitions — radius, type, thickness, dash pattern, rotation speed and
direction — and `BandLayer` renders whatever array it is handed.

`lib/geometry.ts` reduces every shape to the same thing: a closed,
arc-length-parameterised polyline defined at unit size. Dash patterns, stroke
weights, broken-arc ranges, tick and bar placement and edge dots are all
expressed against that parameterisation, so they behave identically whichever
primitive produced the polyline. Going from v1's circles to v3's speech
bubbles is a swap of that one function plus a different array — no new
rendering code.

Rotation, likewise, is a behavioural branch keyed on the config: `smooth`,
`erratic` (v2's stutter) and `pulse` (v3's breathing, which exists because
bubbles must not spin), not a rotation speed set to zero.

## Implementation notes

- Remotion v4, TypeScript + React. No 3D, no Three.js.
- All drawing goes to `<canvas>` elements via refs. Every layer paints its own
  offscreen buffer in a layout effect; `AgenticHud` composites them afterwards,
  since React runs child effects before the parent's.
- Every value derives from `useCurrentFrame()`. No `Date.now()`, no
  `requestAnimationFrame`, no CSS animations, no component state.
- All randomness comes from Remotion's `random()` with stable string seeds.
  No `Math.random()` anywhere.
- No watermark and no audio track (`Config.setMuted`, `setEnforceAudioTrack`).
- `remotion.config.ts` points Remotion at the machine's Chromium headless
  shell. Remove that block, or set `REMOTION_BROWSER_EXECUTABLE`, on a machine
  where Remotion can download its own build.

Two pixel values are scaled 2× from the brief because it specifies them in
1080p terms while these compositions render at 4K: the typing dots rise 20px
rather than 10, and the label halo is sized from the cap height. The camera
drift is left at a literal ±10px, which reads as the intended barely-there
movement at this resolution.
