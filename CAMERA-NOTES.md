# CAMERA-NOTES.md

Build notes for `wire-city` — a 4K wireframe-city animation rendered with
Remotion + `@remotion/three`.

Written for someone starting a **new** 3D Remotion project from scratch. The
first half is the numbers you will want to copy. The second half is the list
of things that cost real time to find, most of which present as *a completely
black frame* and send you looking in the wrong place.

---

## 1. The lens

One shared lens for every version, declared once in `src/wire-city/camera-paths.ts`:

```tsx
export const LENS = {fov: 42, near: 0.1, far: 600} as const;
```

```tsx
<PerspectiveCamera makeDefault fov={42} near={0.1} far={600} />
```

| Value | Setting | Why |
|---|---|---|
| `fov` | 42 (vertical) | At 16:9 this is a **68.6° horizontal** fov — `2·atan(tan(21°)·16/9)`. Wide enough for an establishing shot, not so wide that the tower verticals visibly splay. |
| `near` | 0.1 | Only matters for the street-level paths, where geometry can pass within a metre of the lens. |
| `far` | 600 | Chosen with the world scale (below) so the ground lattice is fully faded out before the clip plane reaches it. |

**The single most useful framing fact:** with `fov = 42`, half the vertical fov
is 21°. So a camera pitched down by `p` degrees puts the horizon `p / 21` of
the way from the centre of frame to the **top** edge. Pitch 16.7° → horizon at
~90% of frame height. Pitch past 21° and the horizon leaves the frame entirely.

Because of that, the orbit path does not hard-code a look-at height. It picks a
pitch and derives the height:

```ts
const targetHeightForPitch = (cameraY: number, radius: number, pitchDownDeg: number) =>
  cameraY - radius * Math.tan(degToRad(pitchDownDeg));
```

That one helper is worth stealing. Framing a city is much easier to reason
about in degrees than in look-at heights, and it keeps the pitch stable while
the radius changes underneath it.

### World scale

| Quantity | Value |
|---|---|
| Lattice | 24 × 24 cells, 14 units per cell |
| Street period | every 4th cell left empty |
| City half-extent | 161 units |
| Density/height falloff radius | 150 units |
| `CITY_TOP` (tallest landmark) | 165 units |
| Ground lattice extent | 900 units (coarse), 430 (fine) |

`CITY_TOP` is a **declared constant, not a measurement** of the generated
layout. The camera paths import it. If they measured the layout instead, the
layout would have to exist before the camera could be evaluated — and the
layout generator needs the camera tracks (see §4), so you would have a cycle.

---

## 2. The three camera paths

All three live in `src/wire-city/camera-paths.ts` as **pure functions of the
Remotion frame** and are selected by name from the variant config:

```ts
export const CAMERA_PATHS: Record<string, CameraPathFn> = {orbit, descend, levelOrbit};
```

```ts
CAMERA_PATHS[VARIANTS[variant].cameraPath]({frame, durationInFrames})
```

Adding a version therefore never means writing new camera code — it means
naming a different mode in `variants.ts`.

There is **no state, no `useFrame` delta and no `THREE.Clock`** in that file.
Everything is `progress = frame / (durationInFrames - 1)` fed through
`interpolate()` and `Easing` from `remotion`.

### `orbit` — v1 "mint"

Circles the city at roughly the height of the tallest towers, covering about a
third of a full orbit while drifting slowly inward.

| | frame 0 | frame 449 |
|---|---|---|
| position | `(248.0, 192.7, -151.9)` | `(6.3, 171.0, 215.2)` |
| radius | 262 | 205 |
| height | `CITY_TOP × 1.16` = 191 | `CITY_TOP × 1.04` = 172 |
| pitch (down) | 16.5° | 17.5° |
| angle | −0.55 rad | −0.55 + 2π/3 rad |

Radius and height are eased (`Easing.bezier(0.42, 0, 0.58, 1)`); the angle is
linear so the orbit rate stays constant.

**The camera sits slightly ABOVE the tallest tower on purpose.** The first
version orbited at 0.8 × `CITY_TOP` and every landmark ran off the top of
frame for two thirds of the shot. If the camera is above the tallest thing in
the scene, tower tops fall *below* the horizon and are in frame whenever the
horizon is.

Handheld wobble is added on top of the ideal path:

```ts
const wobble = (frame: number, amp: number): [number, number, number] => [
  (Math.sin(frame * 0.031) * 0.62 + Math.sin(frame * 0.0173 + 1.3) * 0.38) * amp,
  (Math.sin(frame * 0.0227 + 0.7) * 0.55 + Math.sin(frame * 0.041 + 2.1) * 0.3) * amp,
  (Math.cos(frame * 0.0269 + 2.4) * 0.6 + Math.cos(frame * 0.0139 + 0.4) * 0.34) * amp,
];
```

Two sines per axis at deliberately incommensurable frequencies, so the drift
never visibly repeats — and it is still a pure function of the frame number,
which a noise function seeded off a clock would not be. Amplitude 2.2 units on
position, 0.9 on the look-at target.

### `descend` — v2 "emerald"

Starts high looking steeply down, descends to street level while the angle
flattens toward the horizon. Ease-in-out on the whole descent, no stops.

| | frame 0 | frame 449 |
|---|---|---|
| position | `(132.1, 300.5, 166.0)` | `(4.4, 6.3, 74.0)` |
| radius | 212 | 74 |
| height | 300 | 6.5 |
| pitch | 54.8° **down** | 6.2° **up** |

The look-at both rises (0 → 15) and moves to *behind* the orbit centre
(`angle + π`, radius 0 → 6), which is what flattens the angle past horizontal
at the end instead of stopping level.

### `levelOrbit` — v3 "blueprint"

Street level, constant height, about a quarter orbit, looking slightly up.

| | frame 0 | frame 449 |
|---|---|---|
| position | `(-137.3, 7.7, 139.3)` | `(-138.6, 6.7, -137.6)` |
| radius | 196 (constant) | 196 (constant) |
| height | 7 (constant) | 7 (constant) |
| pitch | 13.3° **up** | 13.6° **up** |

Radius 196 keeps the camera just outside the 161-unit city footprint, so the
near buildings are only ~35 units away at ground level. That is where the
parallax comes from — being *low*, not being *inside*.

---

## 3. Materials, and the black-frame trap

**There are no lights in this scene and none are wanted.** Every material is
emissive/basic and the bloom pass supplies the glow.

| Object | Material |
|---|---|
| Building edges | `LineMaterial` (`three/examples/jsm/lines/LineMaterial.js`) on `LineSegments2` |
| Building bodies | `MeshBasicMaterial` on an `InstancedMesh` |
| Ground dots | custom `ShaderMaterial` on `THREE.Points` |
| Horizon haze | custom `ShaderMaterial` on a `CylinderGeometry` |

> Adding a `meshStandardMaterial` to a scene with no lights is the single most
> common way to get a completely black render. If your first frame is black,
> check **camera position** and **material type** before anything else — but
> read §5 first, because under Remotion there are three *other* ways to get an
> identically black frame that have nothing to do with either.

### Why `Line2` / `LineSegments2` and not `THREE.Line`

`THREE.Line` ignores `linewidth` on virtually every platform — you get 1px and
no control. `LineSegments2` draws each segment as a camera-facing quad, so
`linewidth` is real.

Two details that matter:

- `LineSegmentsGeometry` **is** an `InstancedBufferGeometry` — one instance per
  segment. So all 177 buildings × 12 edges = 2,124 segments go into **one
  geometry and one draw call**. Do not create 177 `Line2` objects.
- `LineMaterial` converts `linewidth` (pixels) into an NDC offset using its
  `resolution` uniform, so `resolution` **must** track the real drawing buffer
  or every line is the wrong width. See §5.4 for where to set it.

Per-building brightness is done with `geometry.setColors()` (6 floats per
segment, rgb at each end), mixing `buildingLine → buildingGlow` by normalised
height. Opacity is **baked into those colours** rather than set on the
material, so the material can stay opaque and use `alphaToCoverage: true`,
which anti-aliases sub-pixel-thin lines against the MSAA buffer. A transparent
LineMaterial cannot.

### Hidden-line removal

Wireframes alone do not occlude each other — you would see straight through
the city. The `InstancedMesh` of unit boxes, coloured `palette.buildingFill`
(a hair above the background so the bodies read as empty), is what makes near
buildings hide far ones. It carries:

```ts
polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4,
fog: false,
```

`polygonOffset` pushes the fill away from the camera so an edge never
z-fights with its own face. `fog: false` is deliberate — letting scene fog
lift the fills toward the haze colour turns distant buildings into solid
blocks. The **edges** opt into fog (`material.fog = true`) so distant
wireframes fade into the haze; `LineMaterial` supports fog, which is easy to
miss.

### Colour management

`new THREE.Color('#4FFFD4')` converts sRGB → linear working space, because
`THREE.ColorManagement` is on by default. Every raw rgb triple handed to a
shader uniform or a vertex-colour buffer must come from a `THREE.Color` —
never from parsing the hex by hand — or the whole scene comes out too bright.
The canvas is `flat` (`NoToneMapping`) so the emissive colours reach bloom
unsquashed.

---

## 4. Ground, haze, and getting a real horizon

The ground is **two co-planar dot lattices**, not a textured plane:

| | spacing | extent | dot size (world) |
|---|---|---|---|
| fine | 3.5 | ±430 | 0.95 |
| coarse | 14 (the street pitch) | ±900 | 1.15 |

The fine lattice is offset half a cell so it never lands on top of the coarse
one and z-fights.

**"Denser near the camera" is done in the shader, not the geometry.** Each
fine point carries a seeded random value and is discarded once its
distance-derived coverage drops below it:

```glsl
float coverage = 1.0 - smoothstep(uThinStart, uThinEnd, depth);
vCull = aRand - coverage;   // fragment: if (vCull > 0.0) discard;
```

That thins the lattice stochastically instead of cutting it off at a visible
ring, and because the test is on camera-space depth the dense region travels
with the camera.

Point size follows three's own attenuation formula so a dot is a fixed *world*
size and a `--scale=0.5` preview is an honest preview of the 4K render:

```glsl
float sizePx = uSize * uHalfHeight / depth;   // uHalfHeight = drawingBufferHeight / 2
vSizePx = max(sizePx, 1.0);
gl_PointSize = vSizePx;
vDim = clamp(sizePx, 0.3, 1.0);               // sub-pixel dots dim instead of vanishing
```

### The two-stage distance fade

```glsl
vec3 hazed = mix(uHaze, c, vFade * vDim);         // colour settles into the haze
gl_FragColor = vec4(mix(uBackground, hazed, vCut), 1.0);  // haze settles into background
```

| | haze from → to | background from → to |
|---|---|---|
| fine | 330 → 470 | 500 → 588 |
| coarse | 380 → 520 | 535 → 594 |

The **second** stage is the one that buys a convincing horizon. The lattice
extends to 900 — past the 600 far clip, as it should — but if it is still
visible when the clip plane cuts it you get a hard circular edge across the
frame. Fading fully to background by ~594 means the clip happens where there
is nothing left to clip.

### Haze: centre the cylinder on the camera, all three axes

The horizon glow is an open-ended `CylinderGeometry(400, 400, 1200, 64, 1, true)`
rendered `BackSide`, `depthWrite: false`, `renderOrder: 10`, alpha
`exp(-|localY| / 26) × 0.8`.

It is positioned at the camera's **full** position:

```ts
mesh.position.set(camera.position[0], camera.position[1], camera.position[2]);
```

On a cylinder centred on the eye, ray elevation is a pure function of local
height, so an alpha peaking at local `y = 0` peaks exactly along the horizon
line — whatever the camera height and pitch. Centring it at world `y = 0`
instead (the obvious first guess, and what I did first) pins the band to the
ground plane, and it slides down the frame into a random-looking bright stripe
the moment the camera gains any height.

Scene fog (`<fog args={[haze, 210, 620]} />`) does the rest.

### Keeping the camera out of the buildings

`generateCity()` takes sampled ground tracks for **all** camera paths and drops
any building whose footprint comes within 6.5 units of a sample the camera
passes below:

```ts
generateCity(CITY_SEED, sampleAllGroundTracks(durationInFrames))
```

Costs 6 buildings out of 183 and guarantees no path is ever inside geometry,
including at frame 0. Because it samples *all* paths regardless of which
version is rendering, every version gets the **same city** — which is the
whole point of shipping three treatments of one layout. (This is why the
single-version zips still ship all three path functions: drop one and the
layout changes.)

---

## 5. Post-processing

```tsx
<EffectComposer camera={camera} multisampling={8}>
  {bloom ? <Bloom … /> : <></>}
  <RadialVignette color={…} strength={…} offset={…} />
</EffectComposer>
```

Mint bloom settings:

| | |
|---|---|
| `intensity` | 1.55 |
| `luminanceThreshold` | 0.24 |
| `luminanceSmoothing` | 0.32 |
| `mipmapBlur` | `true` |
| `radius` | 0.82 |

`luminanceThreshold` is the setting to get right. The background is `#010D0A`,
whose linear luminance is ~0.004 — far below 0.24, so it contributes nothing.
The building lines (`#4FFFD4`, linear luminance ~0.85) are well above it. The
ground dots sit deliberately *below* the threshold so the grid stays crisp and
only the wireframe glows.

The vignette is a real `postprocessing` `Effect` (see
`src/wire-city/vignette-effect.ts`), not a 2D overlay, so it runs inside the
composer in linear space before the output transform. It mixes toward a
**palette colour**, which is what lets a light-background version lighten its
corners instead of darkening them — a branch on data, not a special case in
the shader.

Both passes are time-independent, so neither threatens determinism.

The only 2D layer in the piece is the film grain: an SVG `feTurbulence` at 4%
with `mixBlendMode: 'overlay'`, whose `seed` is the Remotion frame — different
every frame, identical on every render. It is generated at half resolution and
CSS-scaled ×2, because `feTurbulence` at 3840×2160 is genuinely slow and at 4%
opacity nobody can tell.

---

## 6. Gotchas — the Remotion-specific ones

These are the ones that cost time. **All four produce a black or empty frame**,
and none of them are the "no lights / wrong material" problem you will assume
you have.

### 6.1 `<PerspectiveCamera makeDefault>` + a separate rig does not work

The drei-shaped pattern — one component registering the camera, another
reading `useThree(s => s.camera)` and positioning it — is wrong under Remotion.

`set({camera})` updates the r3f store synchronously, but the React re-render
that hands the new camera to subscribers is deferred. Remotion's loop ticks
**exactly once per frame** (`advance()` in a passive effect), so the rig
positions the *previous* default camera and the frame is captured from
`(0, 0, 5)` — a close-up of whatever is at the origin, or plain background.

Fix: keep the camera object and its transform in the same place.
`useSceneCamera()` creates it; `CameraRig` installs it *and* writes the
frame-derived transform onto that exact object; anything else that needs the
camera (the `EffectComposer`) is handed the object explicitly rather than
fishing it out of the store.

### 6.2 `<EffectComposer>` draws nothing on the first commit

`@react-three/postprocessing` builds its composer inside a **passive effect**
and stores it with `setComposerState`, so it is `null` for the whole first
React commit. Its `useFrame` subscription is nevertheless registered at
`renderPriority: 1` immediately — and a non-zero render priority switches
**off** react-three-fiber's own automatic `gl.render()`.

In a normal r3f app nobody notices: the loop ticks again 16 ms later. Under
Remotion the loop ticks once, so frame 0 is captured with *nothing drawn at
all*.

Fix — `src/wire-city/CanvasWarmup.tsx`: force a few extra React commits with an
`advance()` after each, holding a `delayRender()` handle until they are done.

```tsx
const [handle] = useState(() => delayRender('Warming up …'));
const [commits, setCommits] = useState(0);
useEffect(() => {
  if (commits < 3) {
    advance(performance.now());
    setCommits((c) => c + 1);
    return;
  }
  continueRender(handle);
}, [commits, advance, handle]);
```

`advance()` takes a wall-clock timestamp which r3f turns into `useFrame`'s
`delta`. Nothing in this project reads that delta, so determinism is
unaffected — but if you add a pass that *does* animate on delta, this is where
it would leak in.

### 6.3 Resolution-dependent uniforms cannot be set during React render

`LineMaterial.resolution` and the ground-dot `uHalfHeight` both need the
drawing-buffer size. Reading it during render and poking it into a uniform
does **not** work: `<ThreeCanvas>` sets the canvas size in a layout effect, so
the first commit sees a stale (often zero) size, and the once-per-frame
`advance()` can fire before the corrected value is committed. Symptoms are
lines of the wrong width and ground dots at one-third brightness and one pixel
wide — i.e. invisible.

Fix: read it in `onBeforeRender`, which three calls immediately before the
draw, when the renderer is guaranteed to know its real size.

```ts
line.onBeforeRender = (renderer) => {
  const size = renderer.getDrawingBufferSize(_v2);
  material.resolution.set(size.x, size.y);
  material.linewidth = Math.max(0.55, config.lineWidth * (size.y / 2160));
};
```

Scaling `linewidth` by `bufferHeight / 2160` is what makes pixel-authored line
widths mean the same thing at 4K and in a `--scale=0.5` preview.

### 6.4 `gl_PointCoord` is unreliable at `gl_PointSize` 1

The obvious way to round off a square GL point:

```glsl
vec2 d = gl_PointCoord - 0.5;
if (dot(d, d) > 0.25) discard;
```

At `gl_PointSize` 1 some drivers — SwiftShader among them — hand the fragment
a **corner** coordinate rather than the centre, so `dot(d, d) == 0.5 > 0.25`
and the entire far dot field is discarded. Guard it:

```glsl
if (vSizePx > 2.5 && dot(d, d) > 0.25) discard;
```

### 6.5 Things that are easy to get wrong but are not black frames

- **`InstancedMesh` frustum culling.** Bounds come from the *source* geometry
  (here a 1×1×1 box at the origin), so the whole city gets culled the moment
  the origin leaves the frustum. Set `frustumCulled = false` on the instanced
  mesh, the merged line object and the ground lattices.
- **Do not seed the layout with `Math.random()`.** Remotion renders frames
  across several browser tabs; each would generate a different city and the
  video would flicker between layouts. Use `random()` from `remotion` inside a
  `useMemo`.
- **`--concurrency` is capped at your core count.** Remotion hard-errors with
  *"Maximum for --concurrency is 4"* rather than clamping.
- **Software WebGL needs two flags.** No GPU means `--gl=swangle`
  (ANGLE over SwiftShader). Chromium ≥ 141 additionally refuses the software
  fallback unless launched with `--enable-unsafe-swiftshader`, which Remotion
  does not add for `swangle`; wrap the browser binary and point
  `--browser-executable` at the wrapper.
- **Raise the `delayRender` timeout.** Compiling this many shaders and warming
  the composer comfortably exceeds the 30 s default on software WebGL.
  `Config.setDelayRenderTimeoutInMilliseconds(300000)`.

---

## 7. Verifying determinism

Render the same frame twice and compare bytes:

```bash
npx remotion still WireCityMint out/a.png --frame=200 --scale=0.25
npx remotion still WireCityMint out/b.png --frame=200 --scale=0.25
sha256sum out/a.png out/b.png   # must match
```

They do. If they ever stop matching, the cause is almost always a `useFrame`
delta or a `Math.random()` that crept in.
