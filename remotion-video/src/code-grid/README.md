# CodeGrid

A 15-second, 30 fps motion graphic: an endless field of blocks etched with
glowing source code, flown over by a low camera with heavy depth of field.
Built as a three.js scene rendered through **WebGPU** (`WebGPURenderer` +
TSL node materials), driven frame-by-frame by Remotion.

## Compositions

| id                | size        | grade |
| ----------------- | ----------- | ----- |
| `CodeGridBlue`    | 1920 × 1080 | blue  |
| `CodeGridTeal`    | 1920 × 1080 | teal  |
| `CodeGridBlue4K`  | 3840 × 2160 | blue  |
| `CodeGridTeal4K`  | 3840 × 2160 | teal  |

All four are 450 frames at 30 fps — 15.000 s exactly.

```bash
npm run render:blue        # 1080p, H.264
npm run render:teal
npm run render:blue-4k     # 3840 × 2160
npm run render:teal-4k
npm run dev                # Remotion Studio
```

`resolutionScale` (1 at 1080p, 2 at 4K) is a prop, and it must match the
composition's dimensions. It scales the code texture, the on-block text
size and the blur radii, so 4K is the same picture with more pixels rather
than a differently-proportioned one — not a different-looking render.

## How it fits together

| file             | role |
| ---------------- | ---- |
| `constants.ts`   | Every tunable: timing, grid, camera, fog, DOF, bloom, text metrics. |
| `colorways.ts`   | The two grades, as linear-light RGB. |
| `random.ts`      | Seeded PRNG helpers. |
| `code-source.ts` | Procedural C / libcurl-flavoured source listing. |
| `code-sheet.ts`  | Draws that listing onto the canvas texture the blocks sample. |
| `field.ts`       | Builds the block field from a periodic tile. |
| `camera-path.ts` | Camera pose as a pure function of loop position. |
| `scene.ts`       | three.js scene, TSL material, post chain, frame driving. |
| `CodeGrid.tsx`   | Remotion component: one scene per tab, one render per frame. |

## Four things worth knowing before changing it

### 1. The loop is seamless, and that constrains the motion

The camera travels exactly `LOOP_CELLS` (20) grid cells over the 450
frames, and the field is generated as a tile that is 20 cells deep and then
repeated, with the z axis wrapping during generation. So the view at frame
450 is the view at frame 0. Every other moving part — sway, bob, yaw, roll,
focus breathing, the block bob and height pulse, the brightness ripple —
completes a **whole number of cycles per loop**.

Verified by rendering frames 0, 1, 448 and 449: the last-to-first step
(mean |Δ| 7.75 per channel) is the same size as an ordinary frame-to-frame
step (7.67–7.79), while frames half a loop apart differ by 10.75.

If you add motion, give it an integer cycle count or the loop will jump.

**`LOOP_CELLS` is also the camera's speed control**, and the two cannot be
separated. The run time is fixed, so forward speed is `LOOP_CELLS / 15 s`;
lowering it slows the flight but shortens the tile, and the field then
repeats closer to the viewer. At 20 the duplicated rows sit past 20 cells
out under ~90% fog while their originals are in the defocused foreground,
so the repeat is not findable. Going much below this needs `FOG_DENSITY`
raised to match, which costs depth in the mid-field.

The sway, yaw, roll and bob cycle counts are already at 1 — the slowest a
loop allows — so their **amplitudes** are the only remaining handle on how
busy the move feels.

### 2. Emissive is capped, and it has to be

`EMISSIVE_CEILING` clamps a block's colour before the post chain. Without
it a hot glyph on a bright block reaches ~16, which is harmless while it
stays a thin sharp stroke and very much not once it drifts into the
defocused foreground: the depth-of-field blur averages a whole region of
those values together and bloom turns the result into a white blob
floating through the shot. The cap still clips glyph cores to white and
still trips the bloom threshold, so sharp text is unchanged — it only
removes the energy the blur had to spread.

Raise `glyphGain` or the brightness bands in `field.ts` and you may need
to revisit it.

### 3. Nothing animates itself

`scene.update(frame)` sets the entire scene from a frame number. There is
no clock, no `requestAnimationFrame`, no state carried between frames.
Remotion renders frames out of order and across parallel tabs, so anything
that accumulated would tear. For the same reason the field, the code sheet
and every per-block value come from a seeded PRNG (`RANDOM_SEED`), never
`Math.random()`.

### 4. It renders to a texture, not to a canvas

The frame is drawn into an offscreen `RenderTarget`, read back, and blitted
onto a 2D canvas. Headless Chrome on a GPU-less machine cannot allocate a
WebGPU swap chain — `getCurrentTexture()` fails with *"Unable to create
shared image"* — so presenting to a WebGPU canvas is not an option on a
render farm. Reading back also means the pixels are provably in the DOM
when Remotion screenshots the page.

## WebGPU in headless Chrome

`remotion.config.ts` points Remotion at `scripts/chrome-webgpu.sh` instead
of Chrome directly. Remotion has no option for extra Chrome flags, but it
will run any executable you name, so the script forwards Remotion's own
arguments and adds what WebGPU needs on a machine with no GPU:

- `--use-vulkan=swiftshader` — Dawn needs a Vulkan driver. Remotion's
  `gl: "vulkan"` renderer asks for `--use-vulkan=native`, which finds no
  device and leaves `requestAdapter()` resolving to **null** — three.js
  would then quietly fall back to WebGL2 and you would never be told.
- `--enable-unsafe-swiftshader` — software adapters are gated behind it.
- `--headless=new` — old headless was removed in Chrome 132+.

On a machine with a real GPU the script is harmless; delete it and set
`Config.setChromiumOpenGlRenderer("vulkan")` alone if you prefer.

`scene.ts` exposes `isWebGPU` so a host can assert the backend rather than
assume it.

## Pinned dependency

`three` is pinned below 0.185. From r185 the WebGPU backend always sets
`swizzle` on `GPUTextureViewDescriptor`, and Chrome rejects it as the wrong
type, which fails every `createView()` call. Re-test before upgrading.

## Look reference

Graded to the supplied reference clip: near-black navy, white-hot glyph
cores over a blue (or teal) glow, thin hot edges on every block, grazing
sheen, exponential fog to black, and a two-level cascaded gaussian
depth-of-field — cheaper than a bokeh kernel on a software rasteriser, and
smoother.
