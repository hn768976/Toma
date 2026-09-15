# Molecular Dreams — nine versions

Nine WebGL/three.js motion pieces built on one supplied asset
(`public/models/molecule.glb`), each staged after one supplied reference clip.
Rendered with the Remotion CLI at 30fps, H.264/MP4.

## The model is not modified

The GLB is a single mesh — `low_poly_unwrapped`, 56,368 vertices / 97,396
triangles, with `POSITION`, `NORMAL` and `TEXCOORD_0` and **no materials at
all**. Every version draws that exact BufferGeometry. The only transform baked
into it (`useMoleculeGeometry.ts`) is the node's own +90° X rotation from the
GLB, a recentre and a uniform scale to unit radius so camera framing is
comparable across versions. Vertex count in equals vertex count out; nothing is
welded, decimated, re-topologised or re-unwrapped.

What changes per version is *material and staging only*: glass parameters,
lighting, background, instance placement, camera path and post.

### Why the look is material-driven rather than texture-driven

The supplied UVs are an automatic Meshy unwrap — thousands of small disjoint
islands with no coherent layout — so a painted texture atlas would smear across
shell boundaries. It also is not what the references need: every one of them is
clear/tinted glass, whose appearance comes from transmission, IOR, interior
absorption and thin-film interference, not from surface albedo. So each version
drives `MeshPhysicalMaterial` (`transmission`, `thickness`,
`attenuationColor` / `attenuationDistance`, `clearcoat`, `iridescence`) against
a synthesised studio environment.

## Versions

| Composition | Reference | Length | Look |
|---|---|---|---|
| `V1-AzureMacroDrift`    | r1 istock-2249574756 | 10.00s | Bright cyan macro, near-still drift |
| `V2-StudioTumble`       | r2 istock-2191991819 | 13.27s | Near-white studio, single molecule tumbling |
| `V3-BlueFieldHero`      | r3 istock-1490397749 | 10.03s | Mid-blue, hero plus scattered field |
| `V4-NoirNavyMaroon`     | r4 istock-1339758850 | 10.03s | Dark navy/maroon, hard rim light, motes |
| `V5-CyanCluster`        | r5 shutterstock H₂   |  8.37s | Saturated cyan, dense cluster, clear shell |
| `V6-EncapsulatedBubble` | r6 istock-2233676303 |  8.03s | Pale grey-white, molecule inside a bubble |
| `V7-PeriwinkleSoft`     | r7 istock-2203603290 | 10.04s | Periwinkle, heavy soft focus throughout |
| `V8-DeepTealBokeh`      | r8 istock-1483102766 | 20.35s | Deep teal, light pool low, dense bokeh |
| `V9-CyanMacroBond`      | r9 istock-2249372774 | 10.00s | Extreme macro on one bond, iridescent fringe |

Each is registered twice in `src/Root.tsx`: at `1920x1080`, and again as
`<id>-4K` at `3840x2160`. Both read the same preset — nothing in the scene is
authored in pixels, so the 4K entry is the identical shot at twice the
resolution. Only screen-space effects (bokeh radius) are scaled by
`resolutionScale`.

## Rendering

```console
npm run render:1080     # all nine -> out/1080p
npm run render:4k       # all nine at 3840x2160 -> out/4k
```

Both accept `--only=V3,V7`, `--gl=`, `--concurrency=` and `--crf=`. The 4K pass
costs roughly 4x the 1080p pass; the work is almost entirely per-pixel.

On a machine with a real GPU, drop `--gl=swangle` (software rasterisation, the
default here because the render box is headless) for a large speedup.

## Files

| File | Role |
|---|---|
| `presets.ts` | The nine looks. Palette, IBL, glass, layout, camera, post. |
| `types.ts` | Shape of a preset. |
| `useMoleculeGeometry.ts` | Loads the GLB once per page; unmodified geometry. |
| `environment.ts` | Synthesised equirectangular studio IBL (no HDRI fetch). |
| `Backdrop.tsx` | In-scene gradient sphere — transmission needs something to refract. |
| `Molecules.tsx` | Hero plus instanced field, all sharing one geometry. |
| `Dust.tsx` | Suspended micro-bubble sprites. |
| `Effects.tsx` | DOF / bloom / vignette / tone mapping, built imperatively. |
| `FilmGrain.tsx` | Per-frame grain as a DOM layer. |
| `MolecularScene.tsx` | Scene assembly and camera rig. |
| `MolecularVersion.tsx` | Remotion entry point for a version. |

## Two things worth knowing before editing

**Everything is a pure function of time.** The camera rig, instance motion, dust
drift and grain seed are all derived from `frame`, never integrated frame to
frame. That is what lets Remotion distribute frames across workers and still
produce a continuous result — and it is why `useFrame` deltas must not be used
for animation here.

**The post chain is built in `useMemo`, deliberately.**
`<EffectComposer>` from `@react-three/postprocessing` constructs its composer
inside a `useEffect` and keeps it in state, so its `useFrame` callback returns
early until a second commit lands. `@remotion/three` calls `advance()` exactly
once per frame, and because the composer holds render priority, r3f skips its
own draw too — so the first frame rendered on *every* worker came out blank.
Constructing the composer during render fixes it. If you swap the post stack
back to the declarative component, that bug returns and it is easy to miss,
because it only affects one frame per worker.
