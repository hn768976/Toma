# Analytics Dashboard — tilted (v2)

The v1 dashboard mapped onto a plane in `@remotion/three`, with a camera moving
across it. This version authors **no new dashboard content**: it re-renders the
v1 dashboard into an offscreen canvas each frame and uploads that canvas as a
`THREE.CanvasTexture`.

The full dashboard component is included here, because this version depends on
it. All content is invented — the metric labels, the series, the ticker
instruments and their values are fictional and do not reproduce any real
product's interface, naming, layout or branding, and the ticker carries no real
commodity names or real prices.

## Compositions

| | |
|---|---|
| Composition id | **`AnalyticsTilted`** |
| Resolution | **4K — 3840 × 2160** |
| Duration | **300 frames** |
| FPS | **30** (300 / 30 = **10.0 s**) |
| Loops? | **No.** One shot — the values climb and hold, and the camera path does not close. Frames 0 and 300 differ by design. |

`AnalyticsFlat` — the frontal 2D version whose buffer this one textures — is
also registered, at the same 3840 × 2160 / 300 / 30fps, so you can render either
from this package.

## Extra dependencies

Beyond a standard Remotion project:

```bash
npm i @remotion/three three @react-three/fiber @react-three/postprocessing postprocessing
```

`three` is pinned to **0.172.x**: `postprocessing@6.36` declares a peer range of
`>= 0.157 < 0.173`, so three 0.176 fails to resolve.

## Render at 4K

```bash
npm install
npx remotion render AnalyticsTilted out/analytics-tilted.mp4 --codec=h264 --crf=12 --concurrency=8
```

Lower `--concurrency` to the number of CPU cores you actually have; Remotion
refuses a value above it.

**This version is substantially slower than v1** — it paints the full dashboard
*and* runs a 3D pass with depth of field every frame. Without GPU acceleration
expect several seconds per frame, and note that each worker holds its own GL
context: on a small machine `--concurrency=2` finishes sooner than a higher
value and avoids "waiting for the page to render the React component" timeouts.
Raise `--timeout` if you hit them.

Preview at 1080p:

```bash
npx remotion render AnalyticsTilted out/analytics-tilted-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=4
```

## What makes it 3D rather than a skew

`CAMERA-NOTES.md` in this package has the full recording notes: plane dimensions
and rotation, camera fov and path, the texture pipeline, the DOF and bloom
settings, and what it takes to keep a canvas texture in sync with the frame
number. In short:

* **Plane** — `PlaneGeometry(16, 9)` at the dashboard's exact aspect, rotated
  −26° about its vertical axis and +6° about its horizontal, so it recedes right.
* **Camera** — perspective, fov 34, near 0.1, far 100; drifts left to right
  across the plane over 300 frames with an ease in and out, pushes in slightly,
  and carries a handheld wobble built from incommensurate sines.
* **Texture** — `useDashboardBuffer` → `THREE.CanvasTexture` →
  `needsUpdate = true` every frame → `meshBasicMaterial`. **No lights**: the
  dashboard is lit by its own design, and a `meshStandardMaterial` in an unlit
  scene is the classic way one of these renders black.
* **Determinism** — `<ThreeCanvas>` from `@remotion/three` (not r3f's
  `<Canvas>`), and the camera is driven from `useCurrentFrame()` in a component
  reading `useThree()`, never from `useFrame`'s delta.
* **Depth of field** focused on the plane's mid-distance, recomputed per frame
  from the same camera path, with a tight in-focus band so the near *and* far
  edges of the tilted plane both soften. A 2D skew cannot produce depth-varying
  blur — that is the whole reason this version exists.
* **Bloom is light.** The dashboard texture already has bloom baked in.
* **Screen treatment absent from v1** — a drifting low-opacity reflection sheen,
  slightly rounded plane corners, and a ~4 px chromatic fringe that grows toward
  the plane's edges.

### The one thing worth knowing

`@remotion/three` renders the GL frame from a **passive effect**, and that
component sits before your children in the tree. React runs all layout effects
before any passive effect, so camera updates and `texture.needsUpdate = true`
must go in `useLayoutEffect` (or in render). In a plain `useEffect` they land one
frame late — and the result still looks plausible, which is what makes it hard
to spot.

## Source map

```
src/
  variants.ts                  palette + render mode (the only hex literals)
  AnalyticsFlat.tsx            v1 entry — blits the dashboard buffer
  Root.tsx                     composition registration (both variants)
  three/
    AnalyticsTilted.tsx        v2 entry — ThreeCanvas, plane, post-processing
    DashboardPlane.tsx         CanvasTexture, rounded corners, sheen, fringe
    CameraRig.tsx              drives the camera from useCurrentFrame()
    cameraPath.ts              the camera move, as a pure function of the frame
    scene.ts                   plane size / rotation, camera fov / near / far
  dashboard/                   the full dashboard (identical to the flat package)
    layout.ts  data.ts  timeline.ts  fonts.ts
    renderDashboard.ts  useDashboardBuffer.ts
    paint/  ScreenChrome.ts  LineChartPanel.ts  CounterBlock.ts
            DonutPanel.ts    SidePanel.ts       TickerStrip.ts
            finish.ts        utils.ts
```

### A note on the panel "components"

The brief named the panels as React components. They are separate modules with
exactly those names, but each exports a canvas **painter** rather than JSX: the
hard requirement that the entire dashboard rasterise into its own offscreen
canvas — so this version could reuse the identical output as a texture — rules
out DOM rendering, and an explicit ordered painter list keeps the composite
identical whether it is driving a screen or a texture, with no dependence on
React commit or effect ordering.
