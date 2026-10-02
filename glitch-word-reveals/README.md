# Glitch Word Reveals (Remotion, 2D)

Two word-reveal templates, 12 words each, **24 compositions**:

- **Attack Glitch** (Style A): a white, cyan-glowing word glitches in over a storm of
  code characters, streak bars, pixel blocks and pop-in skull icons.
- **Data Rain** (Style B): a cyan, data-textured word assembles left to right out of a
  calm, four-layer field of drifting hex characters.

Everything is flat 2D: React, SVG and CSS only. No `@remotion/three`, no WebGL.
Style B's depth is four flat character layers at different blur levels.

> **These clips do NOT loop.** Each is a 10-second (300-frame) one-shot: intro,
> reveal, hold. The last frame does not match the first.

| | |
|---|---|
| Frame size | 3840×2160 (16:9), every size a fraction of the frame |
| Frame rate | 30 fps |
| Length | 300 frames (10 s) |
| Audio | none |

## Quick start

```bash
npm install
npx remotion studio          # browse all 24 compositions
```

Node 18+ is required. Versions are pinned in `package.json` (Remotion 4.0.515).

## The data — and how to add a word

All 24 clips come from one table in `src/words.ts`. Each row is **style, word, seed**:

```ts
{ style: "DataRain", word: "GENERATIVE AI", seed: 2208 },
```

**To add a word, add one row. Nothing else changes.** Pick an unused seed: the seed
fixes where that word's glitches, skulls, streaks and letter swaps happen, so no two
clips glitch in the same places. Size, the 88% width rule, centring, timing and the
composition itself all come from the template.

Composition IDs are `Style-WORD-WITH-DASHES` (Remotion IDs can't contain `_` or
spaces), e.g. `AttackGlitch-AI-SURVEILLANCE`. Output files use underscores,
e.g. `AttackGlitch_AI_SURVEILLANCE.mp4`.

## Render commands

### 4K (3840×2160), one per word

Settings for every render come from `remotion.config.ts`: H.264, `yuv420p`, CRF 16,
30 fps, no audio, PNG intermediate frames. Add `--concurrency=N` to match your CPU.

```bash
# Style A — Attack Glitch
npx remotion render AttackGlitch-RANSOMWARE      out/AttackGlitch_RANSOMWARE.mp4
npx remotion render AttackGlitch-MALWARE         out/AttackGlitch_MALWARE.mp4
npx remotion render AttackGlitch-PHISHING        out/AttackGlitch_PHISHING.mp4
npx remotion render AttackGlitch-DATA-BREACH     out/AttackGlitch_DATA_BREACH.mp4
npx remotion render AttackGlitch-CYBER-ATTACK    out/AttackGlitch_CYBER_ATTACK.mp4
npx remotion render AttackGlitch-SYSTEM-HACKED   out/AttackGlitch_SYSTEM_HACKED.mp4
npx remotion render AttackGlitch-SPYWARE         out/AttackGlitch_SPYWARE.mp4
npx remotion render AttackGlitch-ROGUE-AI        out/AttackGlitch_ROGUE_AI.mp4
npx remotion render AttackGlitch-AI-SCAM         out/AttackGlitch_AI_SCAM.mp4
npx remotion render AttackGlitch-AI-HACKING      out/AttackGlitch_AI_HACKING.mp4
npx remotion render AttackGlitch-AI-THREAT       out/AttackGlitch_AI_THREAT.mp4
npx remotion render AttackGlitch-AI-SURVEILLANCE out/AttackGlitch_AI_SURVEILLANCE.mp4

# Style B — Data Rain
npx remotion render DataRain-CYBERSECURITY       out/DataRain_CYBERSECURITY.mp4
npx remotion render DataRain-CLOUD-COMPUTING     out/DataRain_CLOUD_COMPUTING.mp4
npx remotion render DataRain-QUANTUM-COMPUTING   out/DataRain_QUANTUM_COMPUTING.mp4
npx remotion render DataRain-DATA-PRIVACY        out/DataRain_DATA_PRIVACY.mp4
npx remotion render DataRain-ENCRYPTION          out/DataRain_ENCRYPTION.mp4
npx remotion render DataRain-BIG-DATA            out/DataRain_BIG_DATA.mp4
npx remotion render DataRain-DIGITAL-IDENTITY    out/DataRain_DIGITAL_IDENTITY.mp4
npx remotion render DataRain-GENERATIVE-AI       out/DataRain_GENERATIVE_AI.mp4
npx remotion render DataRain-AI-IN-HEALTHCARE    out/DataRain_AI_IN_HEALTHCARE.mp4
npx remotion render DataRain-AI-IN-FINANCE       out/DataRain_AI_IN_FINANCE.mp4
npx remotion render DataRain-AI-AGENTS           out/DataRain_AI_AGENTS.mp4
npx remotion render DataRain-AI-ETHICS           out/DataRain_AI_ETHICS.mp4
```

### 1080p preview

Same command plus `--scale=0.5`. Or render the four previews in one go:

```bash
npm run previews        # node scripts/render-previews.mjs
```

### Stills

6000×3375 PNG at frame 200 (the clean hold) — `--scale=1.5625` because 3840 × 1.5625 = 6000:

```bash
npx remotion still DataRain-GENERATIVE-AI out/DataRain_GENERATIVE_AI_6000.png --frame=200 --scale=1.5625 --image-format=png
```

All 24 at once (bundles once, then runs the same `remotion still` command per word):

```bash
node scripts/render-stills.mjs --hires   # 6000x3375, frame 200
node scripts/render-stills.mjs           # 1080p, frames 60 and 200
```

Frames 190–210 are kept free of word glitches in both styles' schedules, so frame 200
is always the clean, readable word. No need to hunt for a different frame.

## Render time

Measured in this project's build environment: a 4-core cloud VM, Chrome headless,
`--concurrency=4`, times include H.264 encoding.

| | Per frame | Per 10 s clip |
|---|---|---|
| 1080p preview (`--scale=0.5`), measured on all 4 previews | **295–316 ms** | ~90 s |
| 4K (3840×2160), measured on a 60-frame sample of each style | **~1.2–1.3 s** | **~6.5 min** (estimate) |

4K costs about 4.2× the 1080p time (4× the pixels). On the same 4 cores, all 24 clips
at 4K would take about 2.6 hours. Render time scales roughly with core count, so a
16-core machine should do one clip in about 1.5–2 minutes.

Tip: render through the CLI as shown. Remotion's Node `openBrowser()` defaults to
Chrome's `--single-process` mode on Linux, which was 2.5× slower here.


## Sequence

**Style A — Attack Glitch** (Bebas Neue, cap height 10% of frame height)

| Frames | |
|---|---|
| 0–30 | Background only: heavy streaks, pixel blocks, field jolts. No word. |
| 30–75 | Word glitches in: letters appear out of order, flicker, get swapped for random characters, horizontal slices shift sideways, strong RGB split. Resolves by 75. |
| 75–300 | Word holds, clean. About once a second a 2–4 frame burst: slice shift, stronger RGB split, or one letter swapped. Background and skulls keep going. |

**Style B — Data Rain** (Archivo Black, cap height 9% of frame height)

| Frames | |
|---|---|
| 0–20 | Background only. |
| 20–80 | Letters assemble left to right. Each letter is cut into 15 blocks that arrive scattered and snap into place in steps; stray glitch blocks fly around it; about half the letters flash red as they land. |
| 80–300 | Word holds. A thin glitch slice passes through every 1–1.5 s; the character texture inside the letters shimmers. The camera pulls back 8% (eased), so the 9% cap height is at frame 80 and the word is 8% smaller by frame 300. |

## Sizing rule

Cap height is measured from the real font (canvas `measureText` on "H") inside
`calculateMetadata`, after the fonts have loaded, then:

- Style A: cap height = 10% of frame height. Style B: 9%.
- If the word at that size is wider than 88% of the frame width, the whole word
  (size and letter spacing) is scaled down until it is exactly 88%.
- One line, centred both ways.

Only **QUANTUM COMPUTING** is scaled down (to 92.0% of full size). Every other word,
including AI SURVEILLANCE, fits at full size.

## Determinism

Remotion renders frames out of order on several threads, so every pixel is a function
of the frame number only:

- All randomness comes from a seeded `mulberry32` that runs at module load
  (`src/attack/schedule.ts`, `src/attack/field.ts`, `src/rain/schedule.ts`): glitch
  schedule, skull events, streaks, pixel blocks, letter reveals, character layers,
  bokeh paths. Per-cell character flicker uses `hash01(cell, frame bucket)`, a pure
  integer hash.
- No `Math.random()`, no `Date.now()`, no `requestAnimationFrame`, no React state or
  effects, no CSS `@keyframes`, no CSS transitions. All motion is inline style
  computed from `useCurrentFrame()`.
- Fonts load through `FontFace` wrapped in `delayRender` / `continueRender`
  (`src/lib/fonts.ts`); word measurement awaits the same promise.

## Banding check

Style B is a large dark navy gradient behind a glowing word, the classic case for
H.264 banding. Two defences:

1. **Grain at ±1.8%** (`src/lib/Grain.tsx`): SVG `feTurbulence` seeded by the frame
   number, so it's a fixed function of pixel position and frame. It's drawn last,
   **after** the glow.
2. **PNG intermediate frames** into the encoder, not JPEG.

How it was checked: frame 200 was decoded **from the encoded mp4**
(`DataRain_GENERATIVE_AI.mp4` and `DataRain_QUANTUM_COMPUTING.mp4`), and the pixel
values were read from the centre of the frame straight up to the top edge (trimmed
mean of an 80-px-wide strip, so the background glyphs don't dominate).
As a control, the same frame was rendered **without grain** and pushed through the
same x264 CRF 16 `yuv420p` encode.

| | Longest flat run (outer 38% of the ray) | Result |
|---|---|---|
| DataRain_GENERATIVE_AI.mp4, frame 200 | 4 px | smooth ramp |
| DataRain_QUANTUM_COMPUTING.mp4, frame 200 | 3 px | smooth ramp |
| Control: no grain, same encode | 13 px plateaus with 1-level jumps | **banded** |

So the test does detect banding, and the shipped grain removes it. A second,
ring-based test (elliptical rings matching the gradient) agrees. Re-run with:

```bash
python3 scripts/verify.py banding out/previews/DataRain_GENERATIVE_AI.mp4 out/f200.png
python3 scripts/banding_ray.py out/f200.png out/banding_plot.png
```

## Completion checklist

All checks were run on the final files. "1st try" means it passed the first time it ran.

| # | Check | Result | 1st try? |
|---|---|---|---|
| 1 | Previews: 1920×1080, 30/1, 10.000 s, h264, yuv420p, 300 frames, **no audio stream** | PASS (all 4) | No: CLI renders had a silent AAC track and 10.048 s. Fixed with `Config.setMuted(true)` |
| 2 | All 24 words: exact spelling, one line, centred, nothing cut off, ≤ 88% width, same cap height per style | PASS (24/24) | Yes |
| 3 | Frame 0 empty; reveal glitches (A) / assembles left to right (B); readable in ≥ 4/5 sampled hold frames | PASS (A 97% and 100%, B 100% and 100%) | Yes |
| 4 | Frame 150 cold-start still == frame 150 of a full 4-thread render, byte for byte (also frames 37 and 263) | PASS (both styles) | No: Style B differed (see below) |
| 5 | Every 15th frame: no missing text, wrong font or wrong size | PASS | Yes |
| 6 | Banding on frame 200 of the encoded Style B mp4 | PASS (smooth; control bands) | Yes |
| 7 | A: pink-red + cyan skulls, never on the word; streak bars; red/blue fringes. B: 4 depth layers, blur grows toward camera; textured letters; camera pulls back (word 7.5% smaller at 285 than at 105) | PASS | Yes |
| – | No CSS `@keyframes`/transitions, no `Math.random`, no `Date.now`, no state/effects in `src/` | PASS (grep) | Yes |
| – | `npm install && npx remotion studio` from a clean copy of the zip | PASS | Yes |

**The determinism fix.** Style B's word layer originally used a CSS
`transform: scale()` for the camera pull-back. Chrome can rasterise a CSS-scaled layer
at a scale cached from an earlier frame, so the same frame came out slightly
different (anti-aliasing on letter edges) depending on what that thread had rendered
before. The pull-back is now an SVG `transform` inside the word's SVG, and the
background layers compute their positions and sizes directly. No CSS scale is left.

Re-run the checks:

```bash
python3 scripts/verify.py probe out/previews/*.mp4
python3 scripts/verify.py fit out/stills-1080p
python3 scripts/verify.py readable out/previews/AttackGlitch_RANSOMWARE.mp4 A
bash scripts/check-determinism.sh DataRain-GENERATIVE-AI 37 150 263
```

(`verify.py` needs Python 3 with numpy and Pillow, plus ffmpeg.)


## Fonts and assets

All three fonts ship in `public/fonts/` with their licence files. All are licensed
under the **SIL Open Font License 1.1**:

| Font | Used for | Copyright | Licence file |
|---|---|---|---|
| Bebas Neue | Style A word | © 2010 Dharma Type | `public/fonts/OFL-BebasNeue.txt` |
| Archivo Black | Style B word | © 2017 The Archivo Black Project Authors | `public/fonts/OFL-ArchivoBlack.txt` |
| JetBrains Mono | background characters, code lines, letter texture | © 2020 The JetBrains Mono Project Authors | `public/fonts/OFL-JetBrainsMono.txt` |

The **skull-and-crossbones icon was drawn for this project** as an SVG path
(`src/attack/Skull.tsx`). No icon library is used. The background "code" lines are
made up for this project. There is no text on screen other than the word and the
background characters: no logos, no brand names.

## Project layout

```
src/words.ts              the 24 data rows (style, word, seed)
src/Root.tsx              one <Composition> per row
src/lib/layout.ts         measuring + the 88% rule (calculateMetadata)
src/lib/fonts.ts          font loading inside delayRender
src/lib/GlowFilter.tsx    stacked 1:4:12 glow
src/lib/Grain.tsx         feTurbulence grain, seeded by frame
src/attack/*              Style A template, schedule, background, skull
src/rain/*                Style B template, schedule
scripts/render-*.mjs      batch renders (previews, stills) via the CLI
scripts/check-determinism.sh   cold still vs full render, byte compare
scripts/verify.py         pixel checks used for the verify loop
scripts/banding_ray.py    centre-to-edge banding read-out + plot
```
