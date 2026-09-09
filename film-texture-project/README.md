# Analogue Film Texture Overlays

Three seamless-looping film texture plates — dust, hairs, scratches, gate and
exposure flicker — built in Remotion. 3840×2160, 30fps, 600 frames (20s).

---

## ⚠️ These are MULTIPLY overlays, not screen

Almost every overlay plate on the market is **bright elements on black**, meant
to be **screen** blended. **These are the opposite**: **dark artifacts on a pure
white field**, meant to be **multiply** blended.

Drop the clip over your footage and set the blend mode to **Multiply**:

| App | Where |
| --- | --- |
| Premiere Pro | Effect Controls → Opacity → Blend Mode → **Multiply** |
| After Effects | Timeline → Mode column → **Multiply** |
| DaVinci Resolve | Composite Mode → **Multiply** |
| Final Cut Pro | Video inspector → Blend Mode → **Multiply** |

The white field multiplies to 1.0, so it leaves your image **completely
untouched**; only the dust and scratches darken it. Setting these to Screen
will wash the shot out to white — it is the wrong mode for these plates.

Because of that, the plates deliberately contain **no vignette** and **no global
grain layer**. Either would darken the whole frame under multiply. The dust *is*
the texture.

## The three versions

| File | Look | Dust | Hairs | Scratches | Gate | Flicker |
| --- | --- | --- | --- | --- | --- | --- |
| `V1_FilmTextureHeavy` | Heavy 16mm | 40–80 at once | 1–2 at once | 2–4 at once | yes, + weave | 3% |
| `V2_FilmTextureSubtle` | Subtle 35mm | 5–15 at once | rare | 0–1 at once | no | 2% |
| `V3_FilmScratchesOnly` | Scratches only | none | none | 4–8 at once | no | 2.5% |

**V2 is the one most editors reach for.** V3 is a clean plate for adding wear
without dirt.

## Rendering at 4K

Compositions are defined at 3840×2160. `npm install` first, then:

```bash
npx remotion render V1-FilmTextureHeavy  out/V1_FilmTextureHeavy.mp4  --scale=1 --crf=13
npx remotion render V2-FilmTextureSubtle out/V2_FilmTextureSubtle.mp4 --scale=1 --crf=13
npx remotion render V3-FilmScratchesOnly out/V3_FilmScratchesOnly.mp4 --scale=1 --crf=13
```

Stills:

```bash
npx remotion still V1-FilmTextureHeavy out/V1_FilmTextureHeavy.png --frame=96 --scale=1
```

Preview and tweak interactively with `npx remotion studio`.

### Keep the CRF low

Dust re-randomises every frame, which is expensive for inter-frame compression.
At a high CRF the encoder smears crisp specks into grey mush, and grey mush
multiplied over footage greys the whole shot down. **CRF 12–14.** After
encoding, check that clean areas are still `255,255,255` — anything less is a
grey wash over the buyer's image.

(The white field itself dips 2–3% below white on some frames: that is the
exposure flicker, and it is intentional. 62% / 70% / 64% of frames — V1 / V2 /
V3 — sit at exactly 255,255,255, so check the purity of a full-exposure frame.)

Measured on the 1080p previews in this pack, over the middle half of the frame:
99.2% of pixels are pure `255,255,255` before encoding and 98.8% after, at
CRF 13. The 0.4% difference is faint ringing immediately around specks, and the
darkest dust pixel is unchanged at 36 — the specks stay specks rather than
spreading into grey.

### Resolution-dependent detail

Artifacts are generated at the **output** resolution, not rendered small and
scaled up — `--scale` reaches the page as the device pixel ratio, and the canvas
backing store is sized from it. So **the 4K render carries finer detail than the
1080p preview**, which is correct: at 4K a speck can be 2px of a 3840px frame,
which is finer than a 1080p frame can represent. The 1080p preview floors specks
at one whole pixel so they stay hard-edged rather than dissolving into grey.

Scratch and hair widths, chromatic fringing and the gate weave are specified in
**device pixels** and do *not* scale: a 2px scratch is 2px at both resolutions,
because these are physical-scale artifacts of the film, not of the framing.

## How it loops

Every artifact is a pure function of `(elementId, frame mod durationInFrames)`.
There is no `Math.random()` at render time and no state between frames —
Remotion renders frames out of order across threads, so a stateful artifact list
would flicker inconsistently.

- **Dust** (1–3 frame life) and **hairs** (3–8 frames) are re-derived each frame
  by looking backwards over the recent spawn frames, with the look-back index
  wrapped modulo the duration.
- **Scratches** and **hairs** live in *lanes*. Each lane's timeline is an exact
  integer partition of the 600-frame loop, rotated by a per-lane offset. Because
  the partition tiles the loop exactly and each artifact fades to zero at both
  ends of its span, lifespans close over the seam with no cross-fade — and the
  lane count is a hard ceiling on how many are ever on screen at once.
- **Flicker** and the **gate weave** are value noise over the frame axis whose
  control points wrap around.

Frame 600 is byte-identical to frame 0. Verified by rendering both.

## Project layout

```
src/
  Root.tsx          three compositions, one per version
  FilmTexture.tsx   canvas host; paints in useLayoutEffect keyed on the frame
  config.ts         per-version densities and intensities
  rand.ts           deterministic hashing and loop-safe value noise
  draw/
    spans.ts        the lane/span model that bounds concurrency
    dust.ts         ragged 2-12px polygons, 1-3 frame life
    hairs.ts        curved strokes with drift, 3-8 frame life
    scratches.ts    vertical lines with jitter, tilt and long fades
    gate.ts         soft irregular top/bottom mask (V1 only)
    fringe.ts       red/cyan separation at the extreme edges
    flicker.ts      exposure flicker and the horizontal weave
```

No audio track, no text, no watermark.
