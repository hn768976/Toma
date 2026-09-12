# Editor timeline (macro screen shot)

A close-up of a video editor's timeline on a monitor, shot at an angle
with a very shallow lens. 1565 frames at 30fps (52.17s).

Two variants of the same setup are registered, each at two resolutions:

| Composition ID       | Size      | Variant |
| -------------------- | --------- | ------- |
| `EditorTimelineA1080` | 1920x1080 | A       |
| `EditorTimelineA4K`   | 3840x2160 | A       |
| `EditorTimelineB1080` | 1920x1080 | B       |
| `EditorTimelineB4K`   | 3840x2160 | B       |

Variant **A** is the reference framing: two video tracks over a deep
music bed, camera on the left, and a left-to-right razor pass followed
by trims, a marquee, a ripple delete and a playback sweep.

Variant **B** re-stacks the panel (music bed on top, three video layers
beneath it), moves the lens to the other side of the monitor so the
timeline recedes to the left instead of the right, and runs a different
session: long ruler scrubs, a cross-layer drag, quick alternating
nudges, and a right-to-left razor pass.

## Rendering

```console
npm i

# delivered 1080p masters
npx remotion render EditorTimelineA1080 out/editor-timeline-A-1080p.mp4 --codec=h264 --crf=17
npx remotion render EditorTimelineB1080 out/editor-timeline-B-1080p.mp4 --codec=h264 --crf=17

# 4K masters (same projection, 2x raster - expect roughly 4x the time)
npx remotion render EditorTimelineA4K out/editor-timeline-A-4k.mp4 --codec=h264 --crf=16
npx remotion render EditorTimelineB4K out/editor-timeline-B-4k.mp4 --codec=h264 --crf=16
```

Rendering is CPU-bound on the defocus stack, so it scales with cores
rather than with `--concurrency` past the core count.

## How it is built

| File               | Role |
| ------------------ | ---- |
| `constants.ts`     | Timing, palette, and the two coordinate systems (UI space vs frame space) |
| `camera.ts`        | Camera rig and the depth-of-field band stack |
| `model.ts`         | Clip/edit types, the edit fold, cursor sampling, waveform and filler generation |
| `Screen.tsx`       | The flat editor interface, in UI space. No 3D, no lens |
| `Cursor.tsx`       | Pointer glyphs (pointer / razor / hand / trim) |
| `script-a.ts`      | Variant A: tracks, starting clips, edit events, pointer path |
| `script-b.ts`      | Variant B: same, re-staged |
| `EditorTimeline.tsx` | Puts the screen on a 3D plane, stacks the defocus layers, adds bokeh and vignette |

Three things are worth knowing before changing it:

**The camera is pinned by one point.** `camera.ts` places UI-space
`(focusX, focusY)` at frame-space `(frameX, frameY)` and rotates about
it. Horizontal edit lines converge on
`(originX + perspective * tan(yaw), originY)`, so `originY` below the
frame is what fans the track rows downward; `perspective * tan(yaw)`
sets how far off to the side they collapse.

**Depth of field is a layer stack, not a post effect.** Each entry in
`DOF_A` / `DOF_B` is a full copy of the stage blurred by one amount and
masked to a band across the receding axis. CSS applies `filter` before
`mask`, so a layer is blurred whole and only then cropped; bands overlap
by their fade widths so the blur ramps instead of stepping. Adding
layers costs a full extra render of the stage per frame.

**The edit is a fold, not keyframed state.** `evaluateTimeline()` starts
from the script's clip set and replays every event whose start frame has
passed. That keeps the session causally consistent - a clip razored at
0:06 stays razored - and keeps every frame a pure function of its frame
number, which Remotion needs to render frames out of order across
workers. Clip ids follow the cuts: razoring `s2` gives `s2a` and `s2b`,
razoring `s2b` gives `s2ba` and `s2bb`, and later events name those.

**Resolution.** Every length is a 1x (1080p) value multiplied by
`resolutionScale`, including the camera's `perspective` and the defocus
blur radii. The 4K compositions are therefore a true uniform 2x of the
same projection - vector and text content re-rasterised at 2x, not an
upscale. A new composition must pass a `resolutionScale` that matches
the width and height it is registered with.
