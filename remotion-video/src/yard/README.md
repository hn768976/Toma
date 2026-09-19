# Container yard — six shots

Six 3D shipping-container shots built with Remotion + three.js, each recreating
one of the supplied reference clips at its original duration, at 30fps.

| Composition | Duration | Reference | Shot |
|---|---|---|---|
| `Yard01DockWall` | 20.0s / 600f | `istockphoto-1162584442` | Low lateral dolly along a wall of container doors, open sky |
| `Yard02GoldenTruck` | 10.0s / 300f | `istockphoto-1345063988` | Tight golden-hour truck past weathered stacks, frame filled |
| `Yard03GridWall` | 10.0s / 300f | `istockphoto-1345063252` | Near-orthographic grid of doors, slow diagonal drift |
| `Yard04AerialRows` | 10.0s / 300f | `istockphoto-1345063383` | High-angle push over yard blocks and aisles |
| `Yard05TwinStacks` | 10.0s / 300f | `istockphoto-2217367108` | Wide two-block composition, open sky, slow crane |
| `Yard06CornerDusk` | 13.3s / 399f | `istockphoto-2260573766` | Very tight dusk push around a stack corner |

Each is registered twice: at `1920x1080` under the name above, and at
`3840x2160` under the same name with a `4K` suffix. Both use one component and
one scene definition — the camera works in metres and the lens in degrees, so
nothing is tied to pixels and the 4K composition frames identically. Only the
shadow map is raised (2048 → 4096), since its resolution is the one thing that
would otherwise soften at the larger size.

Per the brief, no shot uses a cloud layer. Where sky is in frame (shots 1, 5
and 6) it is a clean vertical gradient.

## Rendering

```bash
# All six at 1080p, H.264/MP4 (what ships in out/deliverables)
./scripts/render-all.sh

# A single 4K shot
npx remotion render Yard01DockWall4K out/Yard01DockWall_4K.mp4 \
  --codec=h264 --crf=17 --gl=angle --concurrency=4 --timeout=900000

# A send-friendly copy of a master (smaller, and range-corrected)
./scripts/make-delivery-copy.sh out/deliverables/Yard01DockWall_1080p.mp4 18
```

`render-all.sh` writes CRF 17 masters. `make-delivery-copy.sh` exists for two
reasons: the 20s shot lands around 40MB at that quality, which is over some
transfer limits, and Remotion encodes from full-range frames and tags the
result `yuvj420p`. The reference plates -- and what an NLE expects -- are
limited-range `yuv420p`/`bt709`, and a player that ignores the tag shows
crushed blacks, so the script converts the range properly rather than
relabelling it.

`--gl=angle` matters: the default headless GL backend does not expose the
WebGL2 features the node materials compile down to.

## Renderer tiers

`renderer.ts` builds a renderer through a three-tier fallback:

1. **WebGPU** — three's `WebGPURenderer` on its native backend (WGSL).
2. **WebGL2** — the same `WebGPURenderer` forced onto its WebGL backend. Node
   materials compile to GLSL, so shading is identical and nothing in the scene
   changes.
3. **WebGL1** — classic `WebGLRenderer` with plain materials. The shot still
   renders, with flat livery instead of procedural weathering. A safety net,
   not expected to be reached on any current browser.

Tier 1 is verified with a smoke test that exercises instancing, instanced
attributes, a sampled texture, a node material and a shadow-casting light,
rather than trusting `init()` — an adapter can return a device that only drops
once real work is submitted.

**The shipped compositions set `preferWebGPU: false`.** WebGPU *is* present in
this container, via Dawn on top of SwiftShader, but that stack drops the device
as soon as a real scene is submitted, and Dawn reports the loss asynchronously,
below the level a page can trap — so the attempt takes the whole render down
instead of falling through to tier 2. On a machine with a real GPU, set
`preferWebGPU: true` and the same compositions run on WebGPU with identical
output. Set `diagnostics: true` on any composition to see which tier was
chosen, the fallback trace, the LOD split and the triangle count.

## How a shot is built

- **`shots.ts`** — the six shot definitions: yard layout, camera path over
  normalised progress, and lighting rig. Distances, lens angles and stack
  heights were read off the reference frames.
- **`layout.ts`** — seeded block generator. A terminal stores containers in
  blocks (rows across, bays along, tiers up) with aisles between; every
  reference is some view of that grid. Stack height varies per column, which is
  what gives the stepped skyline.
- **`scene.ts`** — culling, LOD assignment and instanced mesh construction.
- **`material.ts`** — the container surface as a TSL node graph.
- **`geometry.ts`** / **`scripts/build-lods.mjs`** — the LOD chain.
- **`environment.ts`** — sky dome, ground and lighting.
- **`textures.ts`** — procedural weathering, corrugation and carrier marks.

Everything is seeded. Remotion renders frames across several browser instances
and each rebuilds the scene from scratch, so an unseeded layout would change
between frames and the shot would boil.

## Notes on the supplied mesh

`public/models/container.glb` is the supplied asset: 194,261 triangles, with
positions, normals and UVs, and **no materials or textures**. It is a good 20ft
container — real modelled corrugation (~25mm deep, 160mm pitch) and a door end
with locking bars and cams. Its bounding box is 0.789 × 0.807 × 1.903, so a
single uniform factor (`MESH_SCALE`) maps it onto a real 6.058m ISO container,
landing width and height within ~3% of spec.

`scripts/build-lods.mjs` bakes it into an LOD chain offline (committed, so a
render never pays for it). The render target here is a software rasteriser,
measured at roughly 140ms per million triangles at 1080p, and a yard shot needs
hundreds of containers on screen — the source mesh is ~50x denser than a
container silhouette ever needs.

The near levels use meshoptimizer's quality edge-collapse, which preserves the
corrugation ridges. That path stalls around 6k triangles because the mesh is
non-manifold and runs out of legal collapses. The aggressive sloppy simplifier
goes further but destroys the boxy silhouette — which is the single most
recognisable thing about a container — so the two far levels are procedural
boxes instead, with corrugation carried by banded shading.

| Level | Triangles | Source | Used when a container covers |
|---|---|---|---|
| LOD0 | 24,000 | mesh, quality decimation | > 20% of frame height |
| LOD1 | 6,800 | mesh, quality decimation | > 7% |
| LOD2 | ~150 | procedural box + corner castings | > 2.2% |
| LOD3 | 12 | procedural box | below that |

LOD is chosen by **screen coverage, not distance**. The shots run from a
12-degree lens 56m back to a 36-degree lens 12m back; at those settings a
container 56m away fills more of the frame than one 26m away, and a distance
rule hands the long-lens shot flat boxes. It is assigned once per shot from
each container's largest coverage over the whole camera path, so nothing pops
as the camera closes in and the per-frame cost is nil.

## Surface

Surface detail is projected triplanar from object space rather than read from
the mesh UVs — the supplied unwrap is an atlas from its generator, fine for one
baked texture but useless for placing rust along the bottom rail or a carrier
mark at door height. It also means the procedural LOD boxes and the decimated
mesh share one material and weather identically.

Per-instance variation rides on instanced attributes: `aSeed` offsets the noise
so no two containers wear the same way, `aWeather` scales how hard they have
been used, `aColor` is the livery, `aStencil` picks a carrier.

Carrier marks are invented names, not real shipping lines.

### One trap worth knowing about

The material reads `positionGeometry` / `normalGeometry`, **not**
`positionLocal` / `normalLocal`. three's `InstanceNode` overwrites
`positionLocal` with the instance-transformed position, so on an `InstancedMesh`
it is effectively world space. Using it stretches one noise field across an
entire stack — which reads as camouflage rather than per-container wear — and
puts the carrier-mark band at a fixed height above the ground instead of on
every container.
