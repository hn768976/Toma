# Reference-matching harness

The tooling used to derive `src/studio` from the reference clips, kept so the
numbers in `variants.ts` stay checkable rather than magic. Pure Node, no
dependencies — `png.mjs` is a minimal PNG decoder and `pngw.mjs` an encoder,
so nothing needs installing.

## Workflow

```bash
# 1. Pull frames out of the references (Remotion ships its own ffmpeg)
npx remotion ffmpeg -i reference.mp4 -r 1 -f image2 frames/A_%02d.png

# 2. Render the matching still from the project
npx remotion bundle --out-dir=bundle
npx remotion still bundle PodiumCylinder1080 out/cyl.png --frame=210 --scale=0.4
#    --scale=0.4 gives 768x432, the references' own size

# 3. Compare
node compare.mjs C frames/C_07.png out/cyl.png
```

`compare.mjs` prints reference vs render for podium silhouette (% of frame),
top/bottom edges, the wall/floor transition, luminance at fixed wall and floor
probes, the two visible prop faces, and the backdrop's luminance spread.

## The scripts

| Script | What it does |
|---|---|
| `metrics.mjs` | The probe definitions. One function, run identically on references and renders. |
| `compare.mjs` | Side-by-side metric table with deltas and out-of-tolerance flags. |
| `map.mjs` | Coarse ASCII luminance map of the backdrop — how the gobo's angle and spacing were read off. |
| `solve.mjs` | Least-squares fit of the cool rig's ambient/key/direction/fill to its six probes. |
| `solve_warm.mjs` | The same for the warm rig, also fitting backdrop falloff and lateral gradient. |
| `gobo_angle.mjs` | Solves the in-plane rotation that projects to the measured band tilt, and the period for the measured spacing. |
| `gobo_stats.mjs` | Evaluates the gobo mask over the visible backdrop with the shader's own math, to set `poolMean` and check contrast. |
| `find_pool.mjs` | Brightness-weighted centroid of the reference backdrop's top decile, mapped into the gobo plane. |
| `stack.mjs` | Stacks reference above render for eyeballing. |

## Why solvers rather than tweaking by eye

Several targets are mutually constrained: the key direction that makes a
prop's lit face correct also sets the floor and backdrop levels. Hand-tuning
converged to a rig where the slab's shadowed face was 24 levels too bright and
no rotation could fix it. Fitting all six probes at once found the key was far
more lateral than assumed, and landed every probe within ~1 level.

The residuals the harness still reports are mostly probe placement, not scene
error — `podTop` samples a band just under a detected edge, which on a filleted
top lands partly on the fillet, so it reads high for the cylinder and low for
the thin disc.
