# CAMERA-NOTES

Build notes for the two "crypto code flythrough" compositions.
Both variants share one component (`src/CodeFlythrough.tsx`) and one config
object (`src/variants.ts`); everything that differs between them is a value in
`VARIANTS`, not a branch in the render code.

| | `CryptoFlyTeal` | `CryptoFlyBlue` |
|---|---|---|
| stream axis | `horizontal` | `vertical` |
| flow direction | `1` (right to left) | `-1` (straight down) |
| camera mode | `forward` | `static` |
| coin count | 16 | 0 |
| plane count | 90 | 140 |
| plane scale range | 0.80 – 1.50 | 0.45 – 2.55 (~3x wider) |
| camera pitch | 0.02 rad | 0.075 rad (looks slightly up) |
| dolly rate | 0.16 units/frame | 0 |

Both are 3840x2160, 270 frames at 30fps (9.0s), seamless.

---

## Camera

    <PerspectiveCamera makeDefault fov={60} near={0.1} far={300} />

`src/scene/camera.ts` exposes `cameraState(t, config)`, a pure function of the
loop phase. `CameraRig` (in `src/scene/Scene.tsx`) reads `useThree()` and
copies that state onto the camera in a layout effect. Nothing in the project
calls `useFrame` with its delta and nothing reads a clock — every animated
value descends from `useCurrentFrame()`.

### Loop phase

    t = (frame % 270) / 270

Everything is expressed in `t`. On frame 270 the modulo makes `t` exactly `0`,
so every computed value is bit-identical to frame 0. This matters: writing the
wobble as `sin(2*PI*frame/270)` would give `sin(2*PI) = -2.4e-16` instead of a
true zero, which is the kind of thing that leaves a one-bit difference at the
loop point.

### Handheld wobble

Sines whose periods divide 270 frames — 1, 2, 3 and 5 cycles per loop:

    x     0.34*sin(1t) + 0.13*sin(3t + 1.1)
    y     0.26*cos(2t) + 0.09*sin(5t + 0.4)
    z     0.22*sin(2t + 0.7)
    pitch pitch0 + 0.005*sin(3t + 0.25)
    yaw   0.006*cos(1t)
    roll  0.008*sin(2t + 0.9)

Amplitudes are scaled by 1.0 for the `forward` camera and 0.75 for the
`static` one, so v2 sits noticeably stiller.

Because the field is laid out in the camera's *nominal* frame (see below) and
the camera then wobbles away from it, the wobble produces real parallax: a
0.34 unit sideways move is 2% of the half-width at 8 units of depth and 0.1%
at 130.

### Forward travel, and why the camera does not translate

A monotonic forward dolly cannot close a 270 frame loop, and a sinusoidal one
reads as a push-pull rather than travel. So `cameraMode: "forward"` is
implemented in the field instead: within each traversal an element's distance
from the lens shrinks at `dollyRate` units per frame (`placeElement` in
`src/field.ts`). Nothing in the scene is anchored to world space — there is no
ground, no horizon, no fixed geometry — so a field closing on a still camera
and a camera advancing into a still field are the same image.

The cue that sells it is the cross-axis drift: an element's *world* cross
coordinate is fixed for the length of a traversal, so as it approaches, its
screen position drifts outward from centre while it grows. `cameraMode:
"static"` sets `dollyRate: 0`, and that drift disappears entirely.

### Pitch

The camera carries the variant's pitch, and the field group carries the same
rotation (`cam.fieldQuaternion`), so the field stays framed rather than
sliding out of shot. The pitch orients the whole rig; it is not a crop.

---

## The stream axis

Each axis has a canonical positive travel vector, and `flowDirection` flips it:

    horizontal -> (-1, 0, 0)   * flowDirection
    vertical   -> ( 0, 1, 0)   * flowDirection

so `horizontal` + `1` streams right to left and `vertical` + `-1` falls
straight down. This is the only place the two are distinguished; the blur
direction, the pre-smeared textures and the per-copy stretch all read the same
vector.

**Text never rotates.** Planes billboard by taking the camera's own
orientation (expressed inside the field group as
`fieldQuaternion⁻¹ * cameraQuaternion`), which leaves every block upright and
horizontal in both variants. Only the travel direction turns 90°.

---

## Depth bands and the loop

Elements do not drift freely; each belongs to a depth band keyed by its **lap
count** — the number of whole screen traversals it makes in 270 frames
(`BANDS` in `src/field.ts`):

| laps | distance | tier | shutter x | notes |
|---|---|---|---|---|
| 2 | 84 – 132 | dim | 0.45 | far haze |
| 3 | 62 – 96 | dim | 0.45 | |
| 5 | 42 – 70 | main | 0.45 | focal band, crisp |
| 8 | 27 – 48 | main | 1.00 | partly legible |
| 13 | 15 – 30 | bright | 1.45 | |
| 21 | 8 – 18 | bright | 1.60 | |
| 30 | 4.5 – 10 | bright | 1.85 | long streaks |

A whole-number lap count is what makes the loop close: at `t = 1` an element
has completed exactly `laps` traversals and is back at its start. Tying the
lap count to depth is also where the parallax comes from — a near element
crosses the frame in 9 frames, a far one takes 135.

Elements re-seed their distance within the band, their cross-axis position and
(for coins) nothing else at every traversal boundary, which is exactly the
moment they are off frame. A per-element `phase` staggers elements that share
a lap count; since the lap count is a whole number, adding a constant phase to
`t` leaves both the lap index and the progress unchanged between `t = 0` and
`t = 1`, so the loop still closes.

---

## Motion blur

The defining effect, and it is built three ways at once because none of them
is enough alone.

**1. Multi-pass copies.** Each element is drawn `passes` times along its own
travel vector, trailing backwards, at decreasing brightness. Pass count is
depth-driven: 10 for the nearest band down to 2 for the farthest
(`passesFor`). Streak length is `speedPerFrame * shutterFrames *
band.shutter`, with `shutterFrames = 6` for both variants.

**2. Per-copy stretch.** Copies spaced along a long streak read as separate
ghosts, not as a smear. Each copy is stretched along the travel axis by
roughly the gap to the next one (`1 + spacing/width * 1.15`, capped at 3.4)
so the copies butt up against each other. Its brightness is divided by the
same factor — stretching spreads the same light over more area, and skipping
that division blows the near field out.

**3. Pre-smeared textures.** Every code block is rasterised twice: sharp, and
box-smeared along the stream axis with 11 taps. Smear length is per tier —
6% / 13% / 28% of the texture's travel dimension for dim / main / bright.
Trail copies always sample the smeared variant; the *head* copy does too for
the near tier, which is what finally makes near text unreadable rather than
merely doubled.

Near elements also get a flatter brightness falloff across their copies
(exponent `1.4 - 0.1 * passes`, floored at 0.4) so no single copy stays sharp
enough to read against its own streak.

Resulting streak length as a multiple of the element's own width: about 6x at
the nearest band, 1.5x at mid distance, 0.3x at the far plane.

**The blur direction always follows the stream axis** — horizontal in v1,
vertical in v2. Nothing is ever blurred diagonally.

---

## Depth of field and bloom

    <EffectComposer multisampling={0} depthBuffer stencilBuffer={false}>
      <DepthOfField focusDistance={..} focalLength={..} bokehScale={3.6}
                    resolutionScale={1} />
      <Bloom intensity={1.1 / 1.2} luminanceThreshold={0.16 / 0.15}
             luminanceSmoothing={0.35} mipmapBlur radius={0.82} />
      <Vignette offset={0.24} darkness={0.85} />
    </EffectComposer>

Focus is authored in world units (`focusWorldDistance: 56`,
`focusWorldRange: 26`) and converted to the normalised range the effect wants:

    focusDistance = (56 - near) / (far - near)
    focalLength   = 26 / (far - near)

`postprocessing` compares against a linear orthographic depth even for a
perspective camera, so the conversion is a straight linear remap. The band it
picks out (30 – 82 units) is the `laps: 5` band, which is also the band with
the shortest shutter and the brightness peak — so the crisp elements, the
legible elements and the brightest elements are the same elements.

Vignette is a post pass, not a 2D overlay. Grain is the only 2D layer: an SVG
`feTurbulence` field at 4% alpha over the canvas, cycling six seeds
(270 % 6 == 0, so it lands back on seed 0 at the loop point).

---

## Materials

`meshBasicMaterial` everywhere, `toneMapped={false}`, additive blending,
`transparent: true`. There are no lights in the scene and none are wanted —
every surface is emissive. Additive blending also makes the draw order
irrelevant, which matters because instanced meshes cannot be depth-sorted
per instance.

---

## Gotchas hit during the build

**Everything moved in lockstep.** The first working version computed traversal
progress as `frac(t * laps)`, which is identical for every element sharing a
lap count. The field swept across in solid columns. Fixed by seeding a
per-element phase and folding it in as `frac((t + phase) * laps)` — which
still closes the loop, because the lap count is a whole number.

**Depth of field had nothing to read.** With additive planes and
`depthWrite: false`, the depth buffer is empty and the DoF pass blurs the
whole frame uniformly. Turning `depthWrite` on with an `alphaTest` filled it
per *glyph*, which was worse — the CoC changed between a letter and the gap
next to it, and the bokeh came out in hard rectangular blocks.

The fix is a dedicated depth prepass: one instanced draw per texture group
with `colorWrite={false}`, drawing the element quads (inset to 0.88 x 0.86,
matching the faded core of the texture) into depth only. The colour passes
then run with `depthTest={false}` and `depthWrite={false}` and accumulate
freely. Coins and accent marks also need `depthTest={false}`, or the prepass
quads occlude them.

**The near field then blurred everything.** With every element in the prepass,
the large near quads own most of the frame's depth, so DoF blurred the whole
image at the near circle of confusion. Elements closer than 30 units are
excluded from the prepass — their blur is already coming from the streaks.

**Hard rectangular tiles.** Blocks read as pasted-on rectangles until the
textures got an alpha fade at the edges (9% horizontally, 11% vertically,
`destination-out` gradients).

**Additive stacking saturates to white.** Teal at 0.8 alpha, three planes
deep, clips green and blue and comes out white. Per-element energy had to come
down (`ENERGY = 1.05` spread across all copies) and the dim tier down to 0.4
alpha before the palette survived.

**Rendering timed out at 30s.** Four workers each generating 36 canvas
textures and warming up WebGL blows past Remotion's default `delayRender`
timeout. `Config.setDelayRenderTimeoutInMilliseconds(180000)` in
`remotion.config.ts`; dropping the (expensive) `shadowBlur` glow from the
smeared texture variants roughly halved the cost.

**Drawing buffer size.** Remotion's `--scale` works by changing Chrome's
device scale factor, so `dpr={window.devicePixelRatio}` on `<ThreeCanvas>`
makes WebGL render exactly the pixels that reach the file. Without it a
`--scale=0.5` preview renders a full 4K buffer and throws three quarters of it
away.

**Fonts.** The code textures use
`"DejaVu Sans Mono", "Liberation Mono", "Courier New", monospace`. Texture
generation waits on `document.fonts.ready` inside a
`delayRender()`/`continueRender()` pair. The exact face depends on what the
rendering machine has installed; the layout auto-fits to the widest line, so a
substitution changes the letterforms but not the composition.

**If the first preview comes out black**, check in this order: camera position
(the rig sets it in a layout effect — if `cameraState` is not being called the
camera sits at the origin looking at nothing), material type
(`meshStandardMaterial` with no lights renders black), and plane orientation
(the billboard quaternion has to be expressed *inside* the field group, not in
world space).
