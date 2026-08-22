# "the alarm" — a MinutePhysics-style explainer

58 seconds, 1740 frames, 30fps, 1920×1080. Ballpoint pen on white paper.

| | |
|---|---|
| **Remotion Studio** | `npm run dev`, pick `MinutePhysicsExplainer` |
| **Standalone HTML** | `npm run build:standalone` → open `dist/minutephysics-alarm.html` |
| **Video file** | `npx remotion render MinutePhysicsExplainer out/alarm.mp4` |

## How it is built

### One long sheet — `constants.ts`, `camera.ts`

Everything lives on a single 7680×1080 strip of paper. Marks are laid out left
to right in the order they are drawn, and the camera scrolls sideways past
them; the 1920×1080 frame is a window onto the strip.

A camera move begins every 120 frames, runs 90 and holds 30, on
`cubic-bezier(0.45, 0, 0.55, 1)`. Between moves the camera is completely still.
Panning right is the default — eight of the ten moves. There is exactly one
push-in (scene 3, to 1.15) and the pull-out that undoes it (scene 5, to fit
alarms/phone calls/a guard in one frame).

The camera travels 2400px in total against a 1920px window, so the sheet's
useful width is about 4300px and consecutive scenes share the frame: as scene 4
is drawn, scene 3 is still sliding off the left. That is the point — the camera
moves *past* marks, it never clears them. The single exception is the erase at
f1479.

### Marks — `geometry.ts`, `sheet.ts`

Every mark is a polyline, not an SVG path string, so lengths, bounds and the
ballpoint wobble are all computed the same way and are fully deterministic.
`wobble()` displaces points along a slow sine sum, which reads as a fast,
confident pen rather than a shaky one. Line weight is 2.4px everywhere.

Strokes draw on with `stroke-dashoffset` over 0.3–0.5s. Each `<path>` carries
`pathLength={1}`, so the dash maths stays exact even though the quadratic
smoothing changes the true arc length. Text writes on behind a clip rect that
opens left to right, with `textLength` pinned to the same width estimate that
drives the clip so the two stay in step. Fills wipe the same way. **Nothing
anywhere fades.**

`Sheet` appends marks through a moving cursor, so only one thing is ever being
drawn at a time and the order in the source is the order on the page. That is
what produces the lecture-notes rhythm — something new every couple of seconds,
in sequence. `shift(dx, dy)` moves a whole scene without touching its
coordinates.

### Colour

Almost absent. Black line on white by default. Colour appears in seven places
across the video and nowhere else:

| | |
|---|---|
| mustard `#E8B923` | scene 1 crown · scene 3 fat · scene 4 battery |
| red `#D62828` | scene 3 skull · scene 4 tallest bar · scene 5 two alarm bells · scene 6 bell |

**On the count:** the brief's summary lists six places and omits scene 5's
bells, but scene 5's own cue says "two **red** alarm bells" and the "red used 4
times" count only reconciles if they are red (skull, bar, scene-5 bells,
scene-6 bell). The cue won, so colour lands in seven places rather than six.
The stricter rule — never more than two hues on screen at once — holds
throughout.

The scene-4 callback crown is drawn in **black**, not mustard, so scene 4 keeps
to mustard-plus-red.

### Corrections and the one erase

Corrections are crossings-out — food, fields, sky, colin, glycogen, protein,
sugar, hope, the mammoth, the column, the diet books. Nothing is ever deleted
except at f1479, when `Sheet.eraseEverything()` stamps an `until` frame on
every mark drawn so far and the lone bell is redrawn on clean white.

That bell shakes for the rest of the video: its marks carry `shake`, which
offsets them on a four-frame cycle, and `BellVibration` redraws its arcs on the
same cycle. Neither stops before the final frame.

### On the hand

The brief made a sketched hand holding a pen its defining feature; it was cut
on request. The draw-on rhythm it drove is still here — every element still
appears stroke by stroke, in order, at pen speed.

## Files

```
constants.ts        timing, palette, the sheet, the single erase frame
geometry.ts         polylines, wobble, and the shape builders
sheet.ts            the mark model and the sequencing cursor
content.ts          all six scenes, in drawing order
Ink.tsx             renders one mark at one frame
BellVibration.tsx   the scene-6 shake
camera.ts           the move list and the camera solver
```
