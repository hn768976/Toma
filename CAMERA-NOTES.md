# CAMERA-NOTES — real 3D camera work in Remotion (@remotion/three)

Reference notes from the ContourCrowd build ("contour landscape with user
pins"). Written for starting the **next** 3D Remotion project from scratch,
not as a changelog of this one.

## The camera

```
<PerspectiveCamera>  fov 38 · near 0.5 · far 400
```

(near 0.5, not 0.1: the near plane governs depth precision at distance —
at 0.1 the far ropes z-fight the floor. Don't set near tighter than the
closest thing the camera will ever approach.)

Created via `ThreeCanvas`'s `camera={{fov, near, far, position}}` prop (no
drei needed), then **mutated every frame** by a rig component:

```tsx
const CameraRig = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    const pose = cameraPose(frame / durationInFrames); // pure math
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    camera.updateMatrixWorld();
  }, [frame, ...]);
  return null;
};
```

Key point: the pose is a **pure function of `useCurrentFrame()`** — no
`useFrame((state, delta) => …)`, no clocks, no `Date.now()`. `useFrame`'s
delta is wall-clock time and renders differently on every pass; a pure
`t = frame / duration` function renders identically everywhere, which also
lets any other component (billboards, distance fades) recompute the exact
camera pose from math instead of reading the camera object.

### The exact path (t = frame / 480)

```
x(t) = 2.0 · sin(t · 1.6 · 2π)              lateral drift, ±2 units
y(t) = 4.6 + 2.2 · t                        slow rise; horizon drops
z(t) = -6 + 118 · t                         constant forward dolly
yaw(t) = 0.75° · sin(t · 1.6 · 2π + π/3)    sub-degree sway, offset phase
pitch  = 6.6° down (constant)               horizon in the upper third

target = position + 60 · (sin yaw, -tan pitch, cos yaw)
```

- **Low camera is the shot.** Terrain undulates ±2.3 units; the lens flies
  4.6→6.8 units up, i.e. ~2.3–4.5 above the highest hills. That near-ground
  eye line is what makes contour lines converge hard toward the horizon. A
  high camera flattens everything into a map.
- Horizon height ≈ `50% − 50%·tan(pitch)/tan(fov/2)` from top. With fov 38
  and pitch 6.6° the horizon sits ~33% from the top of frame.
- Drift + yaw use the **same** cycle count with a phase offset — that's what
  reads as handheld; independent frequencies read as wobble.
- No easing anywhere in the camera. Constant speed sells the "surveillance
  drone" calm.

### Camera vs terrain — the first thing to check

If the first preview is black, check the camera height against the terrain
*before* touching materials. Here: terrain peaks at +2.3, camera starts at
4.6 → 2.3 units of clearance at frame 0. Keep a written invariant like that.

## Scene architecture

- `<ThreeCanvas>` from `@remotion/three`, **not** r3f's `<Canvas>` — it
  disables the internal render loop and advances with Remotion's clock.
  Props `dpr={1} flat` (flat = no tone mapping — neon colours stay neon).
- **No lights, no meshStandardMaterial.** Everything is `meshBasicMaterial`
  or `LineMaterial` with flat colour; the bloom pass supplies the glow.
  `meshStandardMaterial` without lights renders black — the classic trap.
- Contours: marching squares over a noise height grid → segment soup →
  `LineSegments2` + `LineSegmentsGeometry` + `LineMaterial`. Plain
  `THREE.Line` ignores `linewidth` on nearly every platform.
  - Width is SCREEN-SPACE (`worldUnits: false`), ~3px at 4K scaled by
    render height. World-unit thin lines collapse below one pixel at
    distance and the rasterizer chops them into dashes; constant pixel
    width keeps every rope a continuous string. The neon body comes from
    bloom, not width.
  - The contour field is anisotropic (x-frequency ×0.32): features stretch
    along x, so iso-lines run as long open ropes across the frame. Closed
    polylines (loops around extrema) are dropped entirely — the chaining
    step's `closed` flag makes that a one-line filter, and the sliding
    window's fade region guarantees loops only appear/disappear where
    they're already invisible.
  - Per-vertex colours handle the near-bright → far-haze ramp
    (`vertexColors: true`); fade lines *toward the haze colour*, not toward
    black, so they melt into the horizon glow.
  - The grid window **slides with the camera, quantized to whole cells**, so
    sampled world positions never shift — contours stay world-stable while
    the window follows the dolly. Window: x ∈ ±100, z ∈ [camZ−9, camZ+228],
    cell 1.5.
  - Rebuild = new `LineSegmentsGeometry` each frame + `dispose()` the old
    one. Re-calling `setPositions` on a live geometry strands the previous
    GPU buffers.
- Floor: the same height grid drawn as a dark red surface (indexed
  BufferGeometry, `meshBasicMaterial` + vertex colours) 0.07 units below
  the lines. Height tints it for relief; its distance fog starts ~35 units
  later than the lines' so the midfield stays near-black instead of washing
  into the haze. Allocated once, positions/colours rewritten per frame.
- Rope dots: bright particles traveling **along** the iso-lines. A dot owns
  one height level; its seeded point is Newton-projected onto the level,
  then advanced per frame by stepping perpendicular to the height-field
  gradient and re-projecting. The path is re-integrated from frame 0 on
  every frame (O(frame), ~5 field evals/step — cheap), so parallel render
  workers with no shared state land on identical positions. Works because
  the field is static; with a breathing field, evaluate each step at that
  step's time.
- Pins: `THREE.InstancedMesh` ×2 (stems, rings) + one InstancedMesh per
  avatar variant (shared canvas texture each). `frustumCulled = false` on
  every instanced mesh — the default bounding sphere doesn't cover moved
  instances and whole meshes vanish at certain angles.
  - Billboarding: set each ring/disc instance quaternion to the **camera's
    own orientation** (screen-aligned), recomputed per frame from the pure
    pose math. Stems keep identity rotation.
  - HDR trick: instance colours above 1.0 (rings ×1.35, flashes ×2.4) push
    those pixels over the bloom threshold without touching exposure.
- Horizon glow: a 460×250 gradient plane riding at camZ+218 (beyond the
  175-unit line fade, inside far=400), `depthWrite: false`, renderOrder −1.

## Determinism rules that held

- Every animated value ← `useCurrentFrame()`. Scene mutations live in
  `useLayoutEffect` keyed on `[frame]` (children's effects run before
  `ThreeCanvas` advances, so the GL render always sees this frame's state).
- All randomness ← Remotion `random('stable-string-seed')`: pin XZ, scale
  jitter, rise stagger, pulse phase/period, flash schedule, avatar variant,
  and the simplex permutation table (`random(\`terrain-perm-${i}\`)`).
  `Math.random()` appears nowhere.
- The terrain is frozen (`breatheSpeed: 0`): the rope lines do not move —
  only the dots travel on them and the camera provides all parallax. The
  field is still 3D simplex sampled at `(x, z, t)`, so a v2 can re-enable
  breathing by setting one config number.
- Pin rise = Remotion `spring()` (damping 11, stiffness 130) with seeded
  start frames across 0–160; pure function of frame, so parallel render
  workers agree.
- No async assets → no `delayRender()` needed. Avatar textures are drawn
  synchronously to canvases in a `useMemo` (once per variant, shared by all
  pins via per-variant instancing). If you ever load real files, wrap them
  in `delayRender()`/`continueRender()`.

## Post-processing (@react-three/postprocessing)

```tsx
<EffectComposer multisampling={0}>
  <DepthOfField focusDistance={40/400} focalLength={0.07} bokehScale={13} height={720} />
  <Bloom intensity={1.4} luminanceThreshold={0.22} luminanceSmoothing={0.3} mipmapBlur />
  <Vignette offset={0.28} darkness={0.52} />
</EffectComposer>
```

- `focusDistance` / `focalLength` are **normalized to camera far** (far=400
  → focus plane at 40 world units). Because they're camera-relative, a fixed
  value keeps the focus band gliding along with the dolly for free.
- The recipe: focus in the near-middle distance, generous `bokehScale`, so
  foreground pins bloom into fat orange discs while the horizon goes soft.
  Err toward too much bokeh — it's what makes it read as footage.
- `height: 720` fixes the internal DOF buffer, so bokeh size is consistent
  between preview (`--scale=0.5`) and full 4K renders.
- `luminanceThreshold 0.22` keeps the dark background and floor out of the
  bloom; pins, dots and bright near contours glow. Instance/vertex colours
  above 1.0 are the lever for "neon": the tone mapping is off (`flat`), so
  HDR values survive to the bloom pass.
- Vignette as a post pass; film grain as a plain 2D `<AbsoluteFill>` over
  the canvas (SVG `feTurbulence`, seed cycled by frame — deterministic).
- Effect order matters: DOF first, then Bloom (so bokeh discs glow), then
  Vignette.

## Rendering / infra gotchas

- Headless Linux has no GPU: `Config.setChromiumOpenGlRenderer('swangle')`
  (SwiftShader ANGLE) or WebGL contexts fail. On a desktop GPU use
  `'angle'` — the shipped `remotion.config.ts` switches on platform.
- `multisampling={0}` on EffectComposer — MSAA on SwiftShader is slow and
  occasionally broken; DOF + bloom + the 4K→1080 downscale supply the AA.
- Software WebGL renders this scene at roughly 4–6 s/frame at 1080p; budget
  accordingly (480 frames ≈ 30–45 min at concurrency 4 on 4 cores).
- With several SwiftShader tabs compiling the postprocessing shaders at
  once, the *first* frame can exceed Remotion's default 30 s timeout
  ("Timeout exceeded rendering the component initially") — pass
  `--timeout=180000` on headless boxes. GPU machines don't hit this.
- ~20k line segments/frame rebuilt in JS is fine (<15 ms); the GPU fill of
  fat worldUnits lines is the actual cost. Reduce contour *levels* before
  pin count if render time hurts — the lines are the expensive part.
