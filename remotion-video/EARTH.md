# Orbital Earth — seven shots, 30 fps

A photoreal low-orbit Earth shot built as a real-time 3D scene: **three.js
WebGPU** (`WebGPURenderer` + TSL node materials) driven frame-by-frame by
**Remotion**, textured with NASA imagery.

Seven shots, each cut against one of the supplied reference clips and holding
that clip's length at 30 fps.

| # | Shot | Frames | Length | What it is |
| --- | --- | --- | --- | --- |
| 1 | **Orbit Drift** | 601 | 20.03 s | Reference layout. High-oblique limb cutting the frame diagonally, stars in the upper left, terminator falling away behind. ~1115 km, drifting east over the central Pacific. |
| 2 | **Low Horizon** | 601 | 20.03 s | ISS-cupola framing. Near-level horizon across the upper third, city lights under the camera, a sunrise building over the limb until the solar disc clears it in the last four seconds. ~400 km, crossing Europe at night. |
| 3 | **Dawn Reveal** | 300 | 10.00 s | The full disc approached out of the dark. Opens on the night side with nothing but city lights against deep blue space; the terminator sweeps across as the camera closes to a lit blue marble. |
| 4 | **Night Pass** | 301 | 10.03 s | Limb low in frame, continents picked out only by their cities, hard cyan edge against the black. |
| 5 | **Sunrise Crest** | 600 | 20.00 s | Sun coming up from directly behind the planet. The disc fills the bottom of frame and the rim burns with a scattered hotspot where the sun sits. |
| 6 | **Deep Space Meteor** | 600 | 20.00 s | The planet held at a distance in a nebula field, with a meteor crossing the upper frame partway through. |
| 7 | **Timelapse Streak** | 600 | 20.00 s | Fast timelapse. The planet spins under a fixed camera and a fixed sun until the deck smears into streaks, sun flaring off the top corner. |

Every shot is registered twice, at 1080p and at 4K — fourteen compositions in
all. Composition ids follow the shot name: `EarthOrbitDrift-1080p`,
`EarthOrbitDrift-4K`, `EarthDawnReveal-1080p`, and so on. `npx remotion
compositions` lists them.

Delivered renders are 1920x1080 H.264 / MP4. The 4K compositions
(3840x2160) are registered and render from the same code with no changes —
see [Rendering](#rendering).

## Running it

```bash
npm install
npm run dev          # Remotion Studio: scrub, tweak, watch it recompile
```

In the studio, the fourteen Earth compositions appear alongside the older
pieces in this repo. `GpuProbe` is a one-frame diagnostic that prints which graphics
backend the browser actually gave you — worth rendering first on a new
machine (see [WebGPU in a headless browser](#webgpu-in-a-headless-browser)).

## Rendering

```bash
npm run render:all        # all seven, 1080p
npm run render:all4k      # all seven, 4K
```

Or one at a time — `render:1` through `render:7`, and `render:1-4k` through
`render:7-4k`, numbered as in the table above.

Each is a plain `remotion render`, so anything the CLI takes works:

```bash
npx remotion render EarthOrbitDrift-4K out/a_4k.mp4 \
  --codec=h264 --crf=15 --color-space=bt709 --concurrency=4
```

**On a GPU machine, drop `--gl=swangle`.** The npm scripts leave it off. It
is only needed where there is no real GPU, and it is what the delivered
renders used.

### How long it takes

The delivered 1080p renders were made on a 4-core sandbox with **no GPU** —
every pixel went through SwiftShader, Chrome's software rasteriser, at about
6 to 10 s/frame at concurrency 4. Across all seven shots that is 3,603 frames
and the better part of a day. On real hardware this is a real-time scene;
expect minutes, not hours, and expect 4K to cost about 4x whatever 1080p
costs on the same box.

Shot 7 is the expensive one: the longitudinal smear takes twelve taps of
three different maps per pixel.

Two knobs if you need to trade quality for time, both composition props:

- `samples` — MSAA on the scene pass. `4` is the default, `1` disables it.
- `superSample` — renders at N x delivery resolution and filters down. `1`
  is the default; `2` is very expensive and rarely worth it over MSAA.

## What the scene is made of

`src/earth/` is the whole thing.

```
config.ts              All seven shots as data: altitude, orbit, framing, sun, grade
camera.ts              Orbital rig — where the camera is and where it points
scene.ts               Builds the scene, drives it per frame, reads pixels back
EarthCanvas.tsx        The Remotion <-> three.js bridge
OrbitalEarth.tsx       Composition component + its zod schema
tsl/earthMaterial.ts   Planet surface
tsl/cloudMaterial.ts   Cloud deck
tsl/atmosphereMaterial.ts  Air
tsl/starfieldMaterial.ts   Sky
tsl/meteorMaterial.ts  The meteor streak
tsl/flareMaterial.ts   Lens flare on the sun
tsl/smear.ts           Longitudinal smear for the timelapse pass
tsl/grade.ts           Vignette and grain
tsl/uniforms.ts        Everything the shaders animate
tsl/common.ts          Shared helpers
```

Every material is a `MeshBasicNodeMaterial` with hand-written TSL rather than
a lit standard material. At this range the things that sell the shot are all
things a PBR material does not do: a terminator soft enough to wrap several
degrees past the geometric one, city lights coming up behind it, cloud
shadows cast from a separate shell onto the surface, and haze that thickens
towards the limb.

Some specifics worth knowing if you go in to change something:

- **The Earth never moves.** All the meshes sit at identity and the camera
  rig orbits around them, which is what lets the shaders treat object space
  and world space as the same thing. `startLongitude` / `startLatitude` in
  `config.ts` swing the whole rig — camera and sun together — to open the
  shot over a different part of the planet.
- **Pitch is derived, not dialled in.** A shot aims either at the limb or at
  the planet. Aiming at the limb pitches down past it by however far it sits
  below the local horizontal — `90 - asin(1/r)`, pure geometry at that radius
  — so `framing` says where the limb should sit relative to the centre of
  frame and the camera angle follows. Change the altitude and the
  composition holds. Aiming at the planet goes straight down the nadir
  instead, which is where the camera basis needs care: `forward` is then
  anti-parallel to the zenith and `lookAt` has no defined roll, so the travel
  direction takes over as the up reference before that degenerates.
- **The planet can spin as well as be orbited.** Spin is a longitude offset
  on every texture lookup, which is exactly what spinning a planet does — the
  surface moves, the terminator does not — and it keeps every mesh at
  identity. It is what lets the timelapse pass hold the sun still in frame
  while the ground races underneath.
- **The glow is two layers.** The physical atmosphere shell is about 60 km
  thick — a hairline at this range, and on its own it does not read as the
  glow real orbital footage has. A second, much wider shell draws that
  spread: it shades by how close each sightline passes to the planet's
  centre, so the glow hugs the silhouette evenly all the way round, and it
  keeps depth testing on so the planet occludes it and it never bleeds over
  the disc. `halo.radius` sets how far it reaches, and it has to be scaled to
  altitude — version B flies at a third of A's height, so the same extent
  would cover three times as much frame.
- **The atmosphere is one draw.** A back-facing shell with depth testing off;
  the shader solves each ray against the top of the air and against the
  planet and shades the surviving segment. One pass gives both the arc
  standing off the limb and the haze lying over the disc, with the right
  amount of air in each. Wavelength-dependent extinction along that chord is
  what stacks a warm band under the blue one at sunrise.
- **Clouds are an optical depth, not an alpha.** The deck thickens where the
  view grazes it, so the limb reads as a layer of air with weather in it.
- **Procedural detail fades at grazing angles.** Near the limb a pixel covers
  kilometres of ground, so the micro relief and albedo grain are faded out
  by facing angle — otherwise they alias into a herringbone across the
  ocean.
- **Detail that is spun past gets smeared, not strobed.** At the timelapse
  spin rate a single texture sample jumps a visible distance between frames,
  so the maps are sampled several times along the direction of travel — the
  same integration a real shutter does. The tap count is fixed when the
  material is built, so the other six shots compile down to a plain fetch and
  pay nothing for it.
- **The flare is geometry, not a post pass.** three ships an anamorphic post
  node, but it tints hard towards violet and its reach grows fast enough that
  at any useful strength it lays a coloured wash over the whole frame. The
  flare here is drawn on a quad parented to the camera: exact control of its
  colour, length and falloff, and it can be hidden on the frames where the
  sun is behind the planet, which a post pass has no way to know.
- **Stars are analytic**, not a point cloud: the sky is diced into a lattice
  in direction space and hashed. They stay the same angular size at 1080p and
  4K, and they do not scintillate between frames the way resampled points do.

## Textures

`public/textures/` — all NASA, all public domain.

| File | Source |
| --- | --- |
| `earth_daymap_4k.jpg` | Blue Marble Next Generation, topography + bathymetry |
| `earth_bump_4k.jpg` | Elevation / bathymetry, used for surface relief |
| `earth_water_4k.png` | Land/water mask, drives the ocean glint |
| `earth_clouds_4k.png` | Blue Marble cloud composite (cover in the alpha channel) |
| `earth_night.jpg` | Black Marble / Earth at Night, city lights |

These are 4096x2048 mirrors of NASA products — that was what was reachable
from the network the shot was built on, since `eoimages.gsfc.nasa.gov` was
blocked by egress policy. They hold up at 4K because the scene layers its own
detail on top, but NASA publishes Blue Marble at 21600x10800 and the close
passes do get sharper with it:

```bash
node scripts/fetch-nasa-textures.mjs           # native-resolution set
node scripts/fetch-nasa-textures.mjs --tiles   # plus the 21600x21600 tiles
```

Then point `TEXTURE_URLS` in `src/earth/EarthCanvas.tsx` at the new files.
Nothing else changes. Two gotchas the script also prints: NASA's cloud map
ships without an alpha channel and the scene reads cover from alpha, and
WebGPU only guarantees 8192px textures, so anything larger wants downsizing
first.

## WebGPU in a headless browser

The scene renders on the WebGPU backend — verified, not assumed: `GpuProbe`
reports the adapter and which backend `WebGPURenderer` actually chose. In the
sandbox these renders came from, that was WebGPU on SwiftShader over Vulkan.

One thing to know if you port this anywhere headless: **nothing is ever
presented to a canvas.** Headless Chrome there could not back a WebGPU swap
chain at 1920x1080 — `context.getCurrentTexture()` fails with
`Could not find SharedImageBackingFactory ... WebgpuSwapChainTexture` and
takes the device with it. So `scene.ts` renders into an offscreen
`RenderTarget`, reads the pixels back, and paints them into a 2D canvas that
Remotion screenshots. It costs one readback per frame, it sidesteps the
problem entirely, and it makes the output bit-for-bit reproducible. On a
machine with a real GPU it works the same way and the cost is negligible next
to the rasterisation.

`three`'s `WebGPURenderer` falls back to WebGL2 on its own if WebGPU is
unavailable; the TSL materials compile to either. `EarthScene.backend`
reports which one you got.

## Adjusting the shots

`src/earth/config.ts` holds both shots as plain data, and every field is
commented. The ones you will reach for first:

| Field | What it does |
| --- | --- |
| `altitude` | Camera height in Earth radii, ramped across the shot. Lower = flatter horizon, more surface detail. |
| `orbit` | Angular travel. 21 degrees over 20 s is a stylised drift; real LEO is about 1.3 degrees. |
| `limbOffset` | Degrees the limb sits above the centre of frame. |
| `roll` | Camera roll. Negative lifts the horizon towards the top right, as in version A. |
| `startLongitude` / `startLatitude` | Where on Earth the shot opens. |
| `sunOrbit` / `sunElevation` | Where the sun is, in the same frame as `orbit`. This sets the whole mood — how much terminator you see and when. |
| `halo` | The glow standing off the limb: `radius` how far it reaches, `strength` how bright, `falloff` how fast it fades. Scale `radius` with altitude. |
| `surfaceHaze` | In-scattered air laid over the disc itself. Raise it for a more luminous globe, lower it before it goes milky. |
| `exposure`, `bloom`, `atmosphere` | The grade. |

Durations live in the same file: `DURATION_IN_FRAMES` and `FPS`.
