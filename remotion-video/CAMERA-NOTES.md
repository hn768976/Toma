# CAMERA-NOTES — `GeoHudTilted` (v3)

Everything a recording or re-shoot of the tilted version needs: the plane, the
camera, the texture pipeline, the post chain, and the traps.

All values live in `src/geo-hud/GeoHudTilted.tsx` as exported constants — change
them there, not inline.

---

## 1. What this composition actually is

`GeoHudTilted` renders **no new dashboard content**. Each frame it calls the
same `DashboardRenderer` that `GeoHudBlue` uses, with the same frame number,
into an offscreen canvas, and maps that canvas onto a plane. The dashboard is
therefore identical to v1 frame-for-frame; only the camera, the depth, and the
screen treatment differ.

If you find yourself editing panel code to change v3, you are in the wrong file.

---

## 2. The plane

| Property | Value |
| --- | --- |
| Size (world units) | `PLANE_W = 16` × `PLANE_H = 9` (matches the 3840×2160 texture aspect) |
| Rotation about vertical axis (Y) | `PLANE_ROT_Y = -22°` |
| Rotation about horizontal axis (X) | `PLANE_ROT_X = +8°` |
| Rotation order | three.js default `XYZ`, applied on the wrapping `<group>` |
| Corner radius | `CORNER_RADIUS = 0.3` world units |
| Position | origin `[0, 0, 0]` |
| Material | `meshBasicMaterial` with `toneMapped={false}` |
| Lights | **none** — see §6 |

The plane recedes to the left: the −22° yaw pushes its left edge away from the
camera and pulls its right edge toward it.

### Rounded corners

The geometry is not a `PlaneGeometry`. It is a `THREE.Shape` with four `absarc`
corners fed to `ShapeGeometry`. **`ShapeGeometry` derives UVs from raw vertex
positions**, which for a shape centred on the origin gives UVs in roughly
`-8..8` — the texture tiles and smears. `roundedPlane()` recomputes every UV as
`(position − boundingBox.min) / boundingBox.size` after construction. If you
change the plane size and the texture goes wrong, this is why.

---

## 3. The camera

| Property | Value |
| --- | --- |
| Type | the default perspective camera, configured per frame in `<CameraRig>` |
| FOV | `FOV = 38` (vertical) |
| Near / far | `NEAR = 0.1` / `FAR = 100` |
| Distance at frame 0 | `CAM_DIST = 11.8` |
| Push-in at the midpoint | `CAM_PUSH = 1.5` (so 10.3 at frame 450) |
| Lateral sweep | `CAM_SWEEP_X = 2.2` |
| Vertical drift | `CAM_SWEEP_Y = 0.45` |

`cameraAt(frame)` is a pure function of the frame number and is exported so it
can be unit-checked:

```
t     = (frame mod 900) / 900
tau   = 2 pi t
x     = sin(tau) * 2.2        + 0.05 sin(4 tau) + 0.03 sin(6 tau)
y     = sin(2 tau) * 0.45 + 0.3 + 0.04 sin(5 tau) + 0.025 cos(3 tau)
z     = 11.8 - 1.5 * (1 - cos(tau)) / 2
look  = [x * 0.45, y * 0.3, 0]
```

- **Closed path.** Every term is a whole number of sine cycles over 900 frames,
  and the push-in uses `(1 − cos)/2` rather than a ramp, so frame 900 is
  identical to frame 0 in position, aim and phase. A linear traverse would not
  close and the loop would jump.
- **Ease.** `sin` supplies the ease-in and ease-out at the ends of the traverse;
  no easing function is applied on top.
- **Truck, not orbit.** The look-at point trails the camera at 45% of its
  lateral offset. Aiming at a fixed origin would read as an orbit around the
  centre of the plane instead of a move across its surface.
- **Handheld wobble.** Periods 225, 150, 180 and 300 frames — every one a
  divisor of 900, so the wobble closes with everything else.

### Why not `<PerspectiveCamera makeDefault />`

That component comes from `@react-three/drei`, which is not a dependency here.
`<CameraRig>` sets `fov`, `near`, `far`, `aspect`, position and `lookAt` on the
default camera from `useThree()` inside a **layout effect keyed on
`useCurrentFrame()`** — which is the part that actually matters. `useFrame` with
a delta is never used anywhere in this composition; a delta-driven camera would
make the render non-deterministic and would not survive `--concurrency` (frames
are rendered out of order across workers).

---

## 4. The texture pipeline

```
useCurrentFrame()
  -> DashboardPlane layout effect
       ctx.setTransform(TEXTURE_SCALE, 0, 0, TEXTURE_SCALE, 0, 0)
       renderer.render(ctx, frame)       // same renderer as GeoHudBlue
       texture.needsUpdate = true
       sheen.uniforms.uShift.value = (frame mod 900) / 900
       invalidate()
  -> @remotion/three advances the r3f loop
  -> EffectComposer renders the frame
```

- **Texture size**: `TEXTURE_SCALE = 0.5`, i.e. 1920×1080. The dashboard still
  *draws* in 3840×2160 logical coordinates — the context carries a 0.5 scale, so
  no layout code changes. At this tilt and blur level the difference from a full
  3840×2160 texture is invisible and it roughly quarters the per-frame texture
  cost, which is the single most expensive thing the composition does. Set it to
  `1` for a full-resolution texture.
- **Colour space**: `texture.colorSpace = THREE.SRGBColorSpace`. Without it the
  dashboard renders visibly washed out.
- **Filtering**: `LinearFilter`, `generateMipmaps = false`. Regenerating mipmaps
  for a 1920×1080 texture every frame costs more than the aliasing it prevents,
  and the DOF pass softens the far edge anyway.
- **`needsUpdate` every frame.** A `CanvasTexture` does not observe its canvas.
  Miss this and frame 0's dashboard is frozen onto the plane for 30 seconds
  while the camera moves — the failure looks like a camera bug, not a texture
  bug.

### Keeping the canvas in sync with the frame number — the real trap

The draw happens in a **layout effect in a child of `<ThreeCanvas>`**. That is
deliberate. `@remotion/three` advances the r3f loop from a `useEffect` in
`ManualFrameRenderer`, which is a *passive* effect: React runs **all** layout
effects before **any** passive effect, so the canvas is guaranteed to hold the
current frame before the scene is drawn. Move the draw into a `useEffect` and it
becomes a race — the texture lags one frame behind the camera, which at this
tilt looks like nothing at all until you compare a still against `GeoHudBlue`
and the numbers disagree.

The comparison is the test worth keeping: render the same frame from
`GeoHudBlue` and from `GeoHudTilted` and check that the readouts match.

---

## 5. Post-processing

```jsx
<EffectComposer multisampling={0}>
  <DepthOfField target={[0, 0, 0]} focalLength={0.055} bokehScale={3.4} />
  <Bloom intensity={0.32} luminanceThreshold={0.62} luminanceSmoothing={0.25} mipmapBlur />
  <ComposerReadySync />
</EffectComposer>
```

- **Focus**: `target={[0, 0, 0]}` — the plane's centre, i.e. its mid-distance.
  `DepthOfFieldEffect` recomputes the focus distance from that world point every
  frame, so the focus tracks the push-in for free. Because the plane is tilted,
  its near edge and its far edge are both off the focal plane and both soften —
  which is the entire reason this version is 3D and not a 2D affine skew. A skew
  cannot produce depth-varying blur.
- **`focalLength = 0.055`** is normalised, not millimetres. Lower is shallower.
- **Bloom is deliberately light.** The dashboard texture already has its own
  bloom baked in by the 2D finishing pass. `luminanceThreshold` at 0.62 keeps
  the pass off everything but the accent pink and the brightest text; raising
  `intensity` much past 0.4 blows the highlights out.
- **`multisampling={0}`**: the texture is already antialiased and DOF softens the
  plane's edges, so MSAA only costs render time.

### `<ComposerReadySync />` — do not delete this

`<EffectComposer>` creates its composer inside an effect and publishes it with
`setState`, and it renders its children only once that state exists. Meanwhile
`@remotion/three` advances the render loop from its own effect **in the same
commit**. At that moment the composer's `useFrame` callback still sees a null
composer and skips the draw — and because the composer holds render priority,
r3f does not draw either. **The frame comes out solid black, with no error.**

`ComposerReadySync` is mounted *inside* the composer, so it mounts in the commit
where the composer first exists, and advances the loop once more. Later frames
are driven by `@remotion/three` as normal, so the cost is one extra draw per
render, not per frame.

Symptom to recognise: a black `GeoHudTilted` frame while `GeoHudBlue` is fine
and no error is printed anywhere.

---

## 6. Screen treatment

Two things v1 and v2 do not have:

- **Reflection sheen.** A second mesh sharing the rounded geometry, 0.004 world
  units in front, with a small `ShaderMaterial`: a wide band along
  `0.74·u + 0.26·v`, additive, `SHEEN_OPACITY = 0.075`, `depthWrite: false`. Its
  `uShift` uniform runs 0→1 across the 900 frames, so the band drifts across the
  panel and closes with the loop. It is a shader, not a light — see below.
- **Rounded corners** on the plane itself, so the piece reads as a physical
  display with an edge rather than a floating layer. The camera framing lets an
  edge into shot during parts of the sweep; that is intended.

**No lights anywhere in this scene.** The dashboard is already lit by its own
design; a light would grey it and flatten the accent colours. Both materials are
unlit (`meshBasicMaterial` and a raw `ShaderMaterial`), both with
`toneMapped: false`.

---

## 7. Rendering

```bash
# 1080p preview
npx remotion render GeoHudTilted out/geohud-tilted-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=4

# full 4K
npx remotion render GeoHudTilted out/geohud-tilted.mp4 \
  --codec=h264 --crf=12 --concurrency=8
```

- **This is by far the slowest composition in the project.** It draws the whole
  dashboard every frame *and* runs a 3D pass with depth of field. Budget
  accordingly; drop `TEXTURE_SCALE` if you need it faster.
- **WebGL renderer.** `remotion.config.ts` pins
  `Config.setChromiumOpenGlRenderer("swangle")` — software ANGLE, which works on
  a machine with no GPU and renders identically everywhere. On a box with a
  working GPU, `"angle"` is considerably faster. Without an explicit renderer,
  headless Chrome may produce a black frame.
- **`concurrency` and memory.** Each worker holds a 3840×2160 WebGL context, a
  4K static dashboard layer and a 1920×1080 texture canvas. On a 4-core machine,
  `--concurrency=4` timed out mid-render here; `--concurrency=2` was stable.
  Lower it before assuming a render is broken.
- **`npx remotion still` does not work for this composition** — it captures the
  page before the composer's frame reaches the compositor and writes a black
  PNG. Use `npx remotion render <id> <dir> --sequence --image-format=png
  --frames=N` for single frames. `remotion render` is unaffected.

---

## 8. Loop check

```bash
npx remotion render GeoHudTiltedLoopCheck out/loopseq --sequence \
  --image-format=png --frames=0   --concurrency=1
npx remotion render GeoHudTiltedLoopCheck out/loopseq --sequence \
  --image-format=png --frames=900 --concurrency=1
sha256sum out/loopseq/element-0.png out/loopseq/element-900.png
```

`GeoHudTiltedLoopCheck` is the same component at 901 frames, registered for
exactly this purpose. The two hashes must match — they do at full 4K. The same
check exists for the 2D dashboard as `GeoHudLoopCheck`.
