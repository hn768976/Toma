# Dev Stack Network

Two looping motion-graphics clips built with [Remotion](https://remotion.dev):
a network of technology labels and icon nodes joined by dashed connectors,
sitting on a plane tilted into perspective over a defocused field.

| Composition ID | Look | Connector routing |
| --- | --- | --- |
| `V1-StackNetworkWarm` | Dark brown-amber field, filled capsule nodes | Smooth curved bezier sweeps |
| `V2-StackNetworkViolet` | Deep violet field, bare bracketed labels, hero in a rotating dashed circle | Orthogonal right-angle runs with chevrons |

Both are **3840 x 2160, 30 fps, 600 frames (20.000s)** and **loop seamlessly** --
frame 600 is the same picture as frame 0, so the clips can be cut back to back
with no visible seam.

## Rendering

```bash
npm install
npx remotion studio          # interactive preview
```

### 4K masters

```bash
npx remotion render V1-StackNetworkWarm    out/V1_StackNetworkWarm.mp4    --scale=1 --crf=16
npx remotion render V2-StackNetworkViolet  out/V2_StackNetworkViolet.mp4  --scale=1 --crf=16
```

### 1080p previews

```bash
npx remotion render V1-StackNetworkWarm    out/V1_StackNetworkWarm_1080p.mp4    --scale=0.5 --crf=18
npx remotion render V2-StackNetworkViolet  out/V2_StackNetworkViolet_1080p.mp4  --scale=0.5 --crf=18
```

`npm run render:v1` / `render:v2` and `preview:v1` / `preview:v2` are the same
commands. Stills:

```bash
npx remotion still V1-StackNetworkWarm out/V1_still.png --frame=90 --scale=0.5
```

Codec, pixel format (`yuv420p`) and the muted audio track come from
`remotion.config.ts`, so `--scale` and `--crf` are the only flags that need
passing.

## How it is put together

```
src/
  Root.tsx            Composition registrations (3840x2160, 30fps, 600 frames)
  StackNetwork.tsx    The clip: background, tilted board, grain, vignette
  variants.ts         Variant name -> { theme, scene }
  lib/
    constants.ts      Frame and board sizes, depth-of-field tiers
    loop.ts           Loop-safe motion helpers
    path.ts           Connector geometry + arc-length sampling
    random.ts         Seeded PRNG (mulberry32)
    scale.ts          Board units -> whatever size the composition is
    scene.ts          Scene model and resolver
    theme.ts          Palettes, background washes, bokeh, board tilt
  scenes/
    warm.ts           V1 node list and curved routing
    violet.ts         V2 node list and orthogonal routing
  components/         Background, Connector, Node, Glyph, CodeMark, Grain, Vignette
public/fonts/         Rajdhani, self-hosted
```

`<StackNetwork>` is one component; the theme, the node list and the routing
style are all data. Adding a third version means adding a theme and a scene,
not a new component.

### Things worth knowing before you change it

**Everything must loop.** Every animated value is a function of
`frame / durationInFrames` multiplied by a whole number of cycles. Dash offsets
advance an integer number of dash *periods*; travelling dots complete integer
*trips*; the hero's dashed circle turns exactly once; node and bokeh drift run
1-2 whole cycles. Introduce a non-integer multiplier anywhere and the clip
develops a seam. There is a quick check for this: temporarily change
`progress` in `StackNetwork.tsx` to `frame / 600`, bump the compositions to 601
frames, and compare stills at frame 0 and frame 600 -- they should be identical
bar a couple of antialiasing LSBs.

**No randomness or state at render time.** Remotion renders frames out of order
across several threads, so `Math.random()` or `useState` during a frame gives
different pictures on different workers. Layout randomness comes from the
seeded PRNG in `lib/random.ts`, called at module scope only.

**Connector geometry is measured in TypeScript, not the DOM.** The travelling
dots need a point at a given distance along a path; `getPointAtLength()` would
need a laid-out element and an effect. `lib/path.ts` flattens each path to a
polyline with a cumulative arc-length table instead, once, at module load.

**Sizes are board units, not pixels.** The board is a fixed
5600 x 3400 coordinate system and one `scale()` in its transform fits it to
whatever `useVideoConfig()` reports. Blur radii are board units too, so the
depth of field scales with everything else -- a 1080p preview is an exact
half-size copy of the 4K master, not a differently-blurred one.

**The font is self-hosted on purpose.** Capsule widths in V1 are computed from
character counts, so a substituted fallback face would pull the layout apart.
`src/load-fonts.ts` holds the first frame with `delayRender()` until the faces
are ready and never touches the network at render time.

**The grain is not decoration.** At ~1.5% it dithers the large, very soft
background gradients, which otherwise band once H.264 quantises them. Judge it
on the encoded file, never on the Studio preview.

## Assets and licensing

- Every icon glyph and the `</>` hero mark is drawn as SVG paths in
  `src/components/Glyph.tsx` and `src/components/CodeMark.tsx`. No icon library
  is used, so there is no third-party attribution to carry.
- Labels are generic technology acronyms and open standards. No company logos,
  framework wordmarks or product marks appear anywhere.
- No watermark.
- `public/fonts/Rajdhani-*.woff2` is Rajdhani by Indian Type Foundry, licensed
  under the SIL Open Font License 1.1 --
  https://fonts.google.com/specimen/Rajdhani/license
