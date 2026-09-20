# Abstract glass motion pieces (V1 / V2)

Two looping 3D motion backgrounds built as Remotion compositions driven by
three.js. Both are authored at 4K and delivered at 1080p; the 4K compositions
are wired up and render-ready.

| Composition | Size | Duration | FPS | Look |
| --- | --- | --- | --- | --- |
| `GlassPanesRing-V1-1080p` | 1920x1080 | 10s / 300f | 30 | Frosted panes on white |
| `GlassPanesRing-V1-4K` | 3840x2160 | 10s / 300f | 30 | as above |
| `GlassCardsRing-V2-1080p` | 1920x1080 | 16s / 480f | 30 | Glossy cards on black |
| `GlassCardsRing-V2-4K` | 3840x2160 | 16s / 480f | 30 | as above |

## Layout

Both pieces place their panels **around a ring**: evenly spaced about a
vertical axis, each panel's face tangent to the circle and then turned by a
pivot about its own vertical axis. `ring.ts` owns this.

The spacing is derived, not hand-placed. `radiusForGap` sizes the ring from
the panel count, the panel's footprint *at its widest pivot*, and the clear
arc you want between neighbours — so the gaps stay equal at every frame of
the animation and neighbours can never interpenetrate, whatever the ring is
doing. Changing `paneCount` / `cardCount` or the gap from the schema re-solves
the radius rather than breaking the spacing.

## Camera

Dead front and dead level, in both pieces: on the +Z axis at the ring's own
height, looking straight down -Z with no yaw, pitch or roll. Composition is
shifted by moving the ring (`ringOffsetX`), never by tilting the camera, so
verticals stay vertical and the horizon never rolls.

## Rendering

```bash
npm install
npm run render:v1        # 1080p H.264
npm run render:v2
npm run render:v1-4k     # 3840x2160 H.264
npm run render:v2-4k
npm run dev              # Remotion Studio, with live prop controls
```

`--gl=swangle` selects SwiftShader+ANGLE, which is what makes these render on a
machine with no GPU. On a box with a real GPU, `--gl=angle` is considerably
faster and produces the same image.

## Graphics backend

`renderer.ts` picks, in order:

1. **WebGPU** — three's `WebGPURenderer` on its WebGPU backend. This is the
   path taken in Remotion Studio and the `<Player>`.
2. **WebGL2** — the same `WebGPURenderer` with `forceWebGL: true`. Same node
   materials, same scene graph, different backend. This is the path a CLI
   render takes: Remotion's headless Chromium advertises `navigator.gpu` but
   cannot allocate a canvas swap chain for it, so `ThreeStage` asks for the
   WebGL2 backend whenever `getRemotionEnvironment().isRendering` is true.
3. **Legacy WebGL** — a plain `WebGLRenderer` with classic (non-node)
   materials, if `WebGPURenderer` cannot initialise at all.

`materials.ts` keeps one set of material parameters working across all three
by restricting itself to the properties `MeshPhysicalMaterial` and
`MeshPhysicalNodeMaterial` share.

## Anti-aliasing

`ThreeStage` renders into a drawing buffer `supersample` times larger than the
composition and lets the browser filter it down. The factor is forced to a
**whole number**. At a fractional ratio the downsample kernel covers a
different number of source pixels for each destination pixel, so an edge
creeping across the frame is reconstructed slightly differently every frame
and the silhouettes crawl; at 2x every destination pixel is an exact 2x2
average and that disappears. MSAA does not survive SwiftShader here, so this
is what carries the edge quality.

Two material-side rules go with it, and matter as much as the sample count:

- Environment softboxes are kept broad and heavily blurred. A small, hot
  source puts a two-pixel specular dot on a rounded rim that jumps several
  pixels between frames and reads as sparkle; a wide one turns the same
  highlight into a streak that travels smoothly.
- Roughness stays at or above ~0.12 on the glossy piece. Below that the
  specular lobe is narrower than a pixel on these curved rims.

## Looping

Every animated quantity is a function of `progress = frame / durationInFrames`
built from `sin`/`cos` of `2*PI*progress` (or an integer multiple), so the
frame after the last one is identical to frame 0.

Two subtleties the ring adds:

- The pivot wave is written against each panel's **angle**, not its index
  (`pivotWave`). Keyed to index, a spinning ring would end the loop with every
  panel carrying the pivot of the panel that used to be several places away,
  and the final pose would not match frame 0 however tidy the spin.
- Colour ramps are **cyclic** (last stop equals first) and sampled at
  `i / count`, so there is no colour seam at the wrap-around. `rampRepeats`
  cycles the ramp several times around the ring: only a handful of panels are
  ever in shot, so a ramp stretched once around a 40-panel ring would advance
  a few percent across the whole frame and read as flat.
- V2's `spinTurns` is 0.5, not 1. A half turn maps every card onto a
  neighbour carrying the same colour (16 cards, ramp repeated twice), so it
  loops perfectly at half the speed a whole turn would need.

Verified empirically rather than assumed: the difference between the last
frame and frame 0 matches the difference between any adjacent pair to within
0.3% on both pieces.

## Tuning

Both compositions expose a zod schema, so every parameter is editable live in
Remotion Studio (`npm run dev`) and overridable per render with
`--props='{"...":...}'`.

Shared: panel count, gap, `baseAngleDegrees` (resting pivot off tangent),
`swingDegrees`, `waveCycles` / `waveSpeed` (the pivot wave, both integers to
stay seamless), `rampRepeats` / `rampOffset`, `cameraZ`, `ringOffsetX`,
`exposure`. V1 adds `ringSwingDegrees`; V2 adds `spinTurns`.

Colour ramps live at the top of each scene file (`CARD_RAMP`, `PANE_RAMP`) and
are sampled in linear space; swapping those arrays re-grades a piece without
touching anything else. Keep them cyclic.

## File map

- `ThreeStage.tsx` — hosts an imperative three.js scene in a Remotion
  composition: renderer lifecycle, per-frame `delayRender` handles,
  supersampling, resize.
- `renderer.ts` — backend selection and tone mapping.
- `materials.ts` — node/classic material factory.
- `environment.ts` — procedurally painted equirectangular studio lighting.
- `geometry.ts` — rounded slab / pane geometry and the cylindrical bend.
- `ring.ts` — circular layout, derived radius, pivot wave.
- `ramp.ts` — linear-space colour ramp sampling.
- `GlassCardsRing.tsx` — V2 scene.
- `GlassPanesRing.tsx` — V1 scene.
