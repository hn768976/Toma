# Grid Corridor

Three versions of a 4K "data grid corridor" animation, built on one shared
Remotion composition and driven entirely by the `VARIANTS` table in
`src/variants.ts`.

| Composition id | Variant | Structure | Camera | Diagrams | Type layer |
| --- | --- | --- | --- | --- | --- |
| `GridCorridorTeal` | `teal` | corridor | roll, `rollDirection: 1` | molecules | code blocks |
| `GridCorridorAmber` | `amber` | corridor, mirrored planes | roll, `rollDirection: -1` | circuit schematics | code + equations |
| `GridCorridorGreen` | `green` | wall | static, `rollDirection: 0` | molecules, larger and fewer | scrolling text wall |

All three are 3840x2160, 360 frames at 30fps (12.0s), and loop seamlessly:
frame 0 and frame 360 are pixel-identical.

## How it works

- Everything is drawn to one `<canvas>` with a 3840x2160 backing store. There
  is no 3D, no WebGL and no DOM animation.
- Every value is a pure function of `useCurrentFrame()`, so renders are
  deterministic. All randomness comes from Remotion's `random()` with stable
  string seeds.
- The corridor is faked: three or four planes each get their own
  `ctx.setTransform()` rotation and shear, clipped to triangles between the
  frame corners and a shared vanishing anchor. The seams between them are the
  corners of the space.
- Depth of field uses three offscreen buffers (near / mid / far), each blurred
  once at composite time. Elements are spread across buffers by weight so they
  cross-dissolve through the focal band instead of popping.
- Code blocks, equation fragments, diagram glyphs and the text wall are each
  rendered once to a small offscreen canvas and blitted.

## Render

```
npx remotion studio

# 1080p previews
npx remotion render GridCorridorTeal  out/corridor-teal-preview.mp4  --codec=h264 --crf=18 --scale=0.5
npx remotion render GridCorridorAmber out/corridor-amber-preview.mp4 --codec=h264 --crf=18 --scale=0.5
npx remotion render GridCorridorGreen out/corridor-green-preview.mp4 --codec=h264 --crf=18 --scale=0.5

# Full 4K
npx remotion render GridCorridorTeal out/corridor-teal.mp4 --codec=h264 --crf=12 --concurrency=8
```

## Packaging

`node tools/package-variants.mjs` writes one self-contained, independently
runnable project per variant into `dist-zips/` and zips each:

```
grid-corridor-teal.zip
grid-corridor-amber.zip
grid-corridor-green.zip
```

Each zip registers only its own composition and has that variant's data
inlined in `src/variants.ts` rather than importing a shared three-key object.
`node_modules/`, `out/` and `.git/` are never staged, so they cannot end up in
a zip.

## The monospace face

The face is loaded through `@remotion/google-fonts`, gated with
`delayRender()` / `continueRender()`. Because a render host that cannot reach
`fonts.gstatic.com` would otherwise fail the render outright, the CDN is
probed first and a vendored copy of the same face
(`public/fonts/RobotoMono-latin.woff2`, SIL OFL 1.1) is used when it is
unreachable. The family name is identical either way, so text metrics do not
change.
