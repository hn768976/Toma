# How the Internet Sends a Message

A ~56-second animated explainer, CGP Grey style, built with [Remotion](https://remotion.dev).
Fixed 1920×1080, 30fps, three scenes, hard cuts.

Unlike a plain HTML page, Remotion renders to an actual video file — so the
output is an MP4 you can cut a voiceover against, not something you have to
screen-record.

## Run it

```bash
npm install
npm run dev      # Remotion Studio: scrub, loop, replay any scene
npm run render   # -> out/internet-message.mp4
```

If your machine already has a Chromium build and you don't want Remotion to
download its own headless shell, point at it:

```bash
REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run render
```

Remotion needs the **headless shell**, not a full `chrome` binary — modern
Chrome removed old headless mode and will fail to launch.

## Compositions

| id | what it is |
|---|---|
| `InternetMessage` | the deliverable |
| `InternetMessageVOGuide` | same film with the VO script burned into the frame, for timing takes (`npm run render:vo`) |

## Global spec

**Colors** (`src/lib/theme.ts`) — background `#FFFFFF`, fill grey `#D8D8D8`,
outline/text `#1A1A1A`, accent `#FF6B35`. The accent is used for packets and
for nothing else: it arrives the moment the rectangle becomes three packets and
leaves the moment they stop being packets.

**Type** — one weight (600), all caps, letter-spacing `0.05em`, max three words
on screen.

**Motion vocabulary** (`src/lib/motion.ts`) — only these four:

1. `fade` — opacity 0→1, 300ms
2. `slide` — transform, 400ms ease-in-out
3. `snap` — transform, 100ms linear, no easing
4. `draw` — line reveal, linear

No bounce, no spin, no elastic. Every animated value in every scene goes
through one of those four helpers.

**Hard cuts** — each scene is a `<Sequence>` owning a contiguous,
non-overlapping frame range (`src/lib/timeline.ts`), so there is no frame on
which two scenes are both mounted. Crossfades are structurally impossible.

## Scenes

### 1 — The Cut (0:00–0:16)

Nothing is literally cut. Three divs render flush from frame zero so they look
like one rectangle, then they move apart — no masking anywhere.

| time | action |
|---|---|
| 0:00 | rectangle fades in, `YOUR MESSAGE` |
| 0:03 | two dotted lines draw top→bottom, staggered 200ms |
| 0:05 | splits into three, 8px gaps (`snap`) |
| 0:07 | gaps widen to 40px, labels swap to `PACKET 1/2/3`, fill turns accent |
| 0:12 | packets scale to 0.7 and drift left |

### 2 — The Route (0:16–0:38)

The map (`src/components/WorldMap.tsx`) is inline SVG in a 1000×500
equirectangular space, so both coastlines and router positions come from real
lon/lat through the same projection:

```
x = (lon + 180) / 360 * 1000     y = (90 - lat) / 180 * 500
```

Twelve router dots (`src/components/routers.ts`). Hop coordinates are
precomputed as an array per packet and driven by a loop, not hand-written
keyframes — and the trails are the *same* arrays fed to a polyline, so a trail
can never disagree with the packet drawing it.

| time | action |
|---|---|
| 0:16 | map fades in, `ROUTERS` bottom-left |
| 0:20 | packets enter from off-frame left, hop dot to dot |
| 0:25 | packet 1 reaches Virginia |
| 0:26 | **packet 3 touches Iceland** |
| 0:28 | `?` beside packet 3, holds 1s |
| 0:32 | all three converge on Singapore |
| 0:34 | map drops to 40% |

⚠️ **Sync-critical:** the word "Iceland" must land on frame 780 (0:26), when
packet 3 touches that dot. The visual is authored first; time the voiceover to
it, not the reverse. The frame is asserted in `src/lib/narration.ts` and shown
in accent in the VO guide composition.

Hops are 300ms. Ocean crossings longer than 120 map units get 400ms — the
`slide` duration — because 300ms across the Atlantic reads as a teleport.

### 3 — The Reassembly (0:38–0:56)

The merge isn't a real merge: the gaps and dividers go to zero while the three
packets slide flush. The slot geometry is chosen so that three closed slots
reproduce Scene 1's rectangle exactly — 1152×260, centred — so the last shot
lands on the same pixels the film opened on.

| time | action |
|---|---|
| 0:38 | hard cut; destination box + empty numbered slots fade in |
| 0:41 | packet 3 arrives, then 1, then 2 — into the wrong slots |
| 0:44 | `REORDERING…` |
| 0:46 | progress bar fills in 300ms |
| 0:47 | packets snap into correct slots, 100ms apart |
| 0:50 | dividers fade, packets merge, accent drains back to grey, label reverts |
| 0:52 | counter counts to `0.24S` |
| 0:52–0:56 | **completely static** |

Nothing moves under the last line. The stillness is what makes it land.

## Narration

The script and its frame cues live in `src/lib/narration.ts`. Record against
`npm run render:vo`, which burns each line into the frame at its cue.

## Layout

```
src/
  index.ts              registerRoot
  Root.tsx              compositions
  Explainer.tsx         scene sequencing (hard cuts)
  lib/
    theme.ts            colors, type
    timeline.ts         fps, canvas, scene boundaries
    motion.ts           the four motion primitives
    narration.ts        VO script + frame cues
  components/
    WorldMap.tsx        projected coastlines
    routers.ts          the twelve dots
    NarrationOverlay.tsx
  scenes/
    Scene1Cut.tsx
    Scene2Route.tsx
    Scene3Reassembly.tsx
```
