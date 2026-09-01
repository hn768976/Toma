# CAMERA-NOTES — `AnalyticsTilted` (v2)

Everything needed to reproduce, re-time or re-shoot the tilted version.
Composition id `AnalyticsTilted`, 3840×2160, 300 frames @ 30fps, **not a loop**.

---

## 1. The plane

| Property | Value | Where |
|---|---|---|
| Geometry | `PlaneGeometry(16, 9)` | `src/three/scene.ts` |
| Aspect | `DESIGN_ASPECT` = 3840 / 2160 = 16∶9 — matches the dashboard buffer exactly, so the texture is never stretched | `src/dashboard/layout.ts` |
| Rotation Y | **−26°** — the panel recedes to the **right** | `PLANE_ROTATION` |
| Rotation X | **+6°** — leans back slightly | `PLANE_ROTATION` |
| Rotation Z | 0 | |
| Position | origin; the plane's centre is the world origin, which makes the ray/plane maths for the focus distance a one-liner | |
| Corner radius | 4.5 % of plane height, via an `alphaMap` (see §5) | `DashboardPlane.tsx` |

The plane's world-space normal is precomputed once as `PLANE_NORMAL` and reused
by the depth-of-field maths.

## 2. Camera

| Property | Value |
|---|---|
| Type | perspective, `makeDefault` via `ThreeCanvas`'s `camera` prop, then fully driven by `CameraRig` |
| FOV | **34** (vertical) |
| Near / Far | **0.1 / 100** |

Path — all of it a pure function of the frame number, in
`src/three/cameraPath.ts`:

| Channel | Frame 0 → 300 | Easing |
|---|---|---|
| `position.x` | −2.05 → +2.60 (left to right across the panel) | `Easing.inOut(Easing.cubic)` |
| `position.y` | +1.25 → −1.05 (drifts down, chart → counter row) | `Easing.inOut(Easing.cubic)` |
| `position.z` | 12.0 → 10.2 (a slight push in) | `Easing.inOut(Easing.quad)` |
| aim point | `(x·0.82, y·0.55, 0)` | follows the camera, so the move reads as a translation across the panel rather than an orbit around it |

Handheld wobble is a sum of incommensurate sines on x, y, z and on the aim
point (periods around 0.011–0.047 rad/frame, amplitudes 0.035–0.085 world
units). Because the periods share no common factor, the wobble never resolves
into a visible rhythm inside 300 frames, and because the shot does not loop the
path does not have to close.

**Framing note.** The plane is deliberately larger than the frustum: at these
distances the camera sees roughly half the panel's width, which is what lets
different regions arrive over the shot — the line chart early, the counter row
and the donut late. At the extremes the panel's edge and one rounded corner
come into frame against the near-black surround, which is what sells it as a
physical display. If you re-time the move, keep `position.x` inside about
±2.8 or the frame opens onto too much empty surround.

## 3. Texture pipeline

This version authors **no new dashboard content**. The pipeline is:

```
useDashboardBuffer(VARIANTS.tilted)      // src/dashboard/useDashboardBuffer.ts
  └─ renderDashboard({canvas, frame, …}) // paints the WHOLE dashboard, 1920×1080
       └─ returns the same offscreen <canvas> v1 blits to the screen
  → new THREE.CanvasTexture(canvas)      // built once, in a useMemo
  → texture.needsUpdate = true           // every frame, in a layout effect
  → <meshBasicMaterial map={texture} />  // no lights anywhere in the scene
```

* `renderDashboard` is a pure function of `(frame, variant, font)` and writes
  only into the canvas it is handed. It is the single seam between the two
  versions — v1 blits its output, v2 uploads it.
* The texture buffer is **1920×1080** for this variant (`VARIANTS.tilted.buffer`)
  while v1 uses the full 3840×2160. At this tilt, with the depth-of-field pass
  softening the near and far edges, the difference is invisible, and it roughly
  quarters the per-frame texture cost. Switch it back in `src/variants.ts` if
  you ever need a flatter, closer camera.
* `colorSpace = SRGBColorSpace` on the texture and `flat` (no tone mapping) on
  the canvas. Without both, the baked palette shifts — tone mapping in
  particular washes the magenta out.
* **No lights, and `MeshBasicMaterial`.** The dashboard is already lit by its
  own design. A `MeshStandardMaterial` in a scene with no lights is the single
  most common way one of these renders completely black.

## 4. Keeping the texture in sync with the frame number

The thing worth writing down, because it is not obvious and it fails silently:

* `@remotion/three`'s `ThreeCanvas` renders the GL frame from a
  **passive effect** (`ManualFrameRenderer` calls `state.advance()` in a
  `useEffect` keyed on the frame), and that component sits *before* your
  children in the tree. React runs **all** layout effects before **any** passive
  effect, so:
  * camera updates and `texture.needsUpdate = true` go in **`useLayoutEffect`**
    (or in render). Both are done that way here.
  * putting either in a plain `useEffect` uploads/aims **one frame late** — and
    the result still looks plausible, which is what makes it nasty to spot.
* The dashboard buffer itself is repainted **during render**, not in an effect,
  in `useDashboardBuffer`. The paint is a pure function of the frame, so running
  it more than once for a frame produces an identical buffer; this removes any
  dependence on effect ordering between "the canvas is painted" and "the texture
  is uploaded".
* The camera is driven from `useCurrentFrame()` in a component reading
  `useThree()` — never `useFrame((state, delta) => …)`. Delta-based motion
  desynchronises the moment a render is distributed across workers, because each
  worker starts its own clock.
* `ThreeCanvas` (not react-three-fiber's `Canvas`) is required: it sets
  `frameloop="never"` while rendering and holds a `delayRender()` handle until
  R3F has drawn the frame.

## 5. Screen treatment (absent from v1)

* **Reflection sheen** — an additive `ShaderMaterial` quad 0.012 units in front
  of the plane. A wide Gaussian band (σ ≈ 0.19 in uv, peak alpha 0.075) plus a
  tighter streak (σ ≈ 0.045, peak alpha 0.045), raked at `0.85·u + 0.55·v`, with
  its offset drifting from −0.35 to +1.55 across the shot. Masked by the same
  rounded-rectangle SDF as the plane so it never spills past the corners.
* **Rounded corners** — a 1024×576 canvas alpha mask (rounded rect, radius 4.5 %
  of height) used as the material's `alphaMap`, with `transparent: true`.
* **Chromatic fringe** — the `MeshBasicMaterial` stays a plain unlit basic
  material; `onBeforeCompile` swaps its `map_fragment` chunk for a three-tap
  sample whose per-channel UV offset grows with the square of the distance from
  the plane's centre (`uChromatic = 0.0065`). That puts ~0 fringe in the middle
  and ≈4 px at the plane's edges at 4K, which is where a lens puts it. Doing it
  in the material rather than as a screen-space pass means the fringe follows
  the *plane's* edges as it moves, not the frame's.

## 6. Post-processing

```tsx
<EffectComposer multisampling={4}>
  <DepthOfField focusDistance={cameraState.focusDistance} focalLength={0.012}
                bokehScale={4.2} height={720} />
  <Bloom intensity={0.22} luminanceThreshold={0.72}
         luminanceSmoothing={0.32} mipmapBlur />
</EffectComposer>
```

* `focusDistance` is **computed per frame** from the same camera path, as the
  distance along the view ray to where it meets the tilted plane, divided by the
  camera's far plane (postprocessing expects a normalised depth). The plane
  passes through the origin, so this is `|−n·o / n·d|`.
* `focalLength = 0.012` is a deliberately tight in-focus band. The plane spans
  roughly 0.07 in normalised depth, so both the near edge and the far edge fall
  out of focus while the mid-distance stays sharp. **This depth-varying blur is
  the entire reason to do this in 3D** — a 2D skew or affine transform cannot
  produce it.
* `height={720}` runs the DOF pass at reduced resolution. At this bokeh scale it
  is indistinguishable and it is a large share of the frame cost.
* Bloom is **light on purpose**. The dashboard texture already has a two-radius
  bloom baked in by the 2D finishing pass; anything heavier here blows the
  counter numerals out to white blobs.

## 7. Performance

This renders the full dashboard **and** a 3D pass with DOF every frame, so it is
substantially slower than v1 — on a machine without GPU acceleration expect
several seconds per frame. Levers, cheapest first:

1. `DepthOfField height` — already at 720.
2. `VARIANTS.tilted.buffer` — already 1920×1080 rather than 4K.
3. `multisampling` on the composer — drop to 0 if you are downscaling anyway.
4. Concurrency: each worker holds its own GL context, and on a software
   rasteriser they contend hard. On a small box, `--concurrency=2` finishes
   sooner than `--concurrency=8` and does not time out; raise
   `--timeout` if you see "waiting for the page to render the React component".
