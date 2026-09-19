# Cyber Attack / System Hacked

A 20-second broken-signal motion graphic: a wall of crash-log text under
two alternating alert lock-ups, taken apart by slice displacement,
chromatic fringing and flat data tears.

|              |                                                        |
| ------------ | ------------------------------------------------------ |
| Duration     | 600 frames @ 30fps (20.000s exactly)                   |
| Compositions | `CyberAttack` (1920×1080), `CyberAttack4K` (3840×2160) |
| Audio        | none — this is a picture-only element                  |

## Rendering

```bash
npx remotion render CyberAttack   out/CyberAttack_1080p.mp4 --codec=h264 --muted
npx remotion render CyberAttack4K out/CyberAttack_4K.mp4    --codec=h264 --muted
```

Add `--crf 22` for a lighter file; the default (18) is a master-grade
encode and this content is deliberately noisy, so it does not compress
down far.

## How it fits together

The frame is composed twice per frame. `base.ts` draws the undamaged
picture into an offscreen canvas; `glitch.ts` then tears that picture
apart onto the visible one. Keeping the two apart is what lets slices
read from clean source instead of feeding back on themselves.

```
director.ts    the edit — intensity, colour mood and title cues over time
  ↓
base.ts        clean frame: code wall → bloom → centre alert → HUD → title
  ↓
glitch.ts      displace → channel split → tears → grade → texture → blowout
```

| File           | Responsibility                                                        |
| -------------- | --------------------------------------------------------------------- |
| `constants.ts` | Format, palette, and the 1920×1080 design grid everything scales from |
| `director.ts`  | Every time-based decision. Re-time the piece from here alone          |
| `layers.ts`    | The three parallax code layers, rasterised once into scrolling strips |
| `code-text.ts` | Generates the crash-log and source lines the wall is built from       |
| `title.ts`     | The two lock-ups and the chamfered alert plate                        |
| `base.ts`      | Composes the clean frame                                              |
| `glitch.ts`    | The damage chain                                                      |
| `random.ts`    | Hash-based randomness — no `Math.random()` anywhere                   |

## Two things worth knowing before you change it

**The glitch runs at 10Hz, not 30Hz.** Every damage decision is keyed to
`Math.floor(frame / GLITCH_HOLD)` with `GLITCH_HOLD = 3`. Holding each
state for three frames is what makes the piece read as a stuck signal; re-
rolling every frame turns it into fizz. If you raise the frame rate, raise
`GLITCH_HOLD` with it to keep the cadence.

**Nothing is resolution-baked.** All lengths are authored against 1920×1080
and multiplied by `scaleFor(width)`, so `CyberAttack4K` is the same edit at
twice the linear size rather than a second build to keep in sync. The
randomness is hash-based and keyed only on frame and index, so the two
compositions tear in exactly the same places.

## Re-timing or re-skinning

- **Rhythm** — the `INTENSITY` keyframes in `director.ts`, in seconds.
- **Colour** — `MOOD_KEYS` in `director.ts` sequences the named moods;
  the moods themselves are in `MOODS`.
- **Titles** — `TITLE_CUES` in `director.ts` for when, `LOCKUPS` in
  `title.ts` for the wording, face, tracking and plate padding.
- **Overall violence** — the `intensityScale` prop, without touching the
  edit. `0` gives the clean frame, `1` is the master, `2` is unusable on
  purpose.
- **Grunge density** — the `grunge` prop. It scales how _many_ glitch
  events happen, not how large they are, so lowering it thins the damage
  out without softening the moves that survive. Two things are
  deliberately floored rather than scaled away: chromatic fringing keeps
  60% of its magnitude at `grunge: 0`, and grain keeps 40% of its
  strength — both are what make the piece read as a screen rather than as
  flat vector art.
- **Wording** — the `titleMode` prop. `alternate` runs the schedule as
  written; naming a lock-up forces every cue onto it, leaving the cue
  timings alone.

## Fonts

Self-hosted under `public/fonts` so a render never waits on a network
fetch: Roboto Mono (code wall), Silkscreen (SYSTEM HACKED), Comfortaa
(Cyber Attack). `fonts.ts` holds a `delayRender()` handle until the faces
are measurable, then drops the strips that were rasterised with the
fallback and redraws — without that, frame 0 bakes in the wrong font.
