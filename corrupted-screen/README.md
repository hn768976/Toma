# Corrupted Screen / Glitch Warning

An angled screen full of corrupted data blocks, RGB channel split, scanlines and
slice tearing, with a monospace warning message reading across the middle.

Three versions, all 3840x2160, 30fps, 600 frames (20s), seamless loop:

| Composition id            | What it is                                                    |
| ------------------------- | ------------------------------------------------------------- |
| `V1-CorruptedScreenRed`   | Red corruption with the warning message.                       |
| `V2-CorruptedScreenGreen` | Green phosphor corruption with the message, retro terminal.    |
| `V3-CorruptedScreenPlate` | Red, message layer removed entirely - a plate to key text into.|

`V3` does not render the message component at all, so no ghost of the text
survives into the bloom or blur passes.

## Install and preview

```console
npm install
npx remotion studio
```

## Render at 4K

The compositions are defined at 3840x2160, so a full scale render is 4K. Sizes
are all fractions of the frame and canvas backing stores are sized by the device
pixel ratio, so a preview and a 4K render are the same picture at two scales.

```console
npx remotion render V1-CorruptedScreenRed out/V1_CorruptedScreenRed.mp4 --scale=1 --crf=16 --muted
npx remotion render V2-CorruptedScreenGreen out/V2_CorruptedScreenGreen.mp4 --scale=1 --crf=16 --muted
npx remotion render V3-CorruptedScreenPlate out/V3_CorruptedScreenPlate.mp4 --scale=1 --crf=16 --muted
```

`--muted` drops the silent audio track Remotion adds by default; leave it off if
your pipeline wants one. Output is H.264, `yuv420p`, 30fps.

Two things to know before starting a 4K render:

- **It is a big file.** Full frame grain is close to incompressible, so crf 16
  at 4K runs into the hundreds of megabytes per version. The 1080p previews were
  made at `--crf=21`, which lands around 32 Mbps and keeps the grain intact;
  raising the crf is the first lever if the master is too large.
- **It is memory hungry.** A 4K frame allocates two plane sized canvases, about
  170MB together, per open tab. If the render runs out of memory, cap the
  parallelism with `--concurrency=2`.

Stills, mid burst (frame 333 sits inside the longest burst):

```console
npx remotion still V1-CorruptedScreenRed out/V1_CorruptedScreenRed.png --frame=333 --scale=1
```

For 1080p versions of any of the above, add `--scale=0.5`.

## How it is put together

Everything derives from `useCurrentFrame()`. There is no `Math.random()`
anywhere: every random looking value comes from a seeded hash of
`(elementId, frame % durationInFrames)` in `src/lib/rand.ts`, so renders are
identical across threads and the pattern repeats exactly at the loop point.

- `src/CorruptedScreen.tsx` - the screen plane and its 3D transform, and the
  per frame glitch state that every layer reads from.
- `src/lib/timing.ts` - the beat of the clip. A low simmer punctuated by six
  bursts of a few frames each. Bursts sit well inside the loop.
- `src/lib/tear.ts` - per band slice offsets and the channel split distance.
  Both the canvas and the DOM message read the same numbers, which is what makes
  the text tear in lockstep with the plate behind it.
- `src/layers/CorruptionCanvas.tsx` - base debris, data blocks, bloom, slice
  tearing, then the channel split. The split works by drawing the finished
  composite into two canvases and keeping one channel of each (a solid colour
  multiplied over an opaque canvas) before screening them back together a few
  pixels apart.
- `src/layers/Message.tsx` - the warning text, cut into the same horizontal
  bands, with its two colour passes pre-masked so they screen back to the
  message colour exactly.
- `src/layers/Scanlines.tsx`, `Optics.tsx`, `Grain.tsx` - scanlines and roll
  bar on the glass, flares and vignette on the lens, grain over everything.

### Changing things

- Colours: `RED_THEME` / `GREEN_THEME` in `src/lib/theme.ts`. The `splitA` and
  `splitB` masks have to partition RGB exactly (red/cyan, green/magenta), or a
  zero offset will no longer reproduce the original frame.
- Message wording: `LINES` in `src/layers/Message.tsx`.
- Screen angle and overfill: `src/lib/plane.ts`. The plane has to overfill the
  frame enough that no edge of it enters shot after the rotation; if you raise
  the angle or lower `PERSPECTIVE_RATIO`, raise `OVERFILL` too.
- Burst placement: `BURSTS` in `src/lib/timing.ts`. Keep every burst inside
  `[0, 600)` and keep hold windows as divisors of 600, or the loop will break.
