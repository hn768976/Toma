# Catalog

Vendor what you need into your project's `src/lib/` (see README).
All modules are deterministic, parameterised and palette-agnostic.

| Module | Exports | What it is for |
| --- | --- | --- |
| `color.ts` | `withAlpha`, `mixHex` | `#rrggbb` + alpha as a canvas `rgba()` string; linear mix of two hex colours. The two colour operations every canvas piece needs and nothing more. |
| `seeded.ts` | `rnd`, `rndRange`, `rndInt`, `rndPick`, `rndBool`, `bucketOf` | Deterministic randomness over Remotion's `random()` with stable string seeds. `bucketOf(frame, size, period)` holds a value steady for a few frames while keeping the cadence periodic over a loop — use it for rerolling readouts and timed flashes. |
| `dofBuffers.ts` | `useDofBuffers`, `makeCanvas`, `DofBand`, `DOF_BANDS` | Allocates the three offscreen surfaces for a banded depth-of-field composite, once. The soft bands are allocated at reduced resolution since they are about to be blurred anyway. |
| `TiltedPlane.tsx` | `TiltedPlane`, `Plane`, `TiltedPlaneConfig`, `basePlaneMatrix`, `bandsForScreenY`, `clearPlaneSurfaces` | Places arbitrary canvas content on a receding plane via one affine transform, and composites it through a three-band depth of field keyed on **screen height** (a tilted plane's recession direction is diagonal, so "higher in frame" is the only reliable depth cue). Hands children a `plane.paint(box, draw)` that clips content into whichever bands it overlaps. Composites in its own layout effect, i.e. after all children's — so ordering needs no explicit sequencing, and anything that must sit in FRONT of the plane goes in a later sibling. |
| `PanelChrome.tsx` | `usePanelChrome`, `renderPanelChrome`, `blitChrome`, `PanelChromeSpec` | The interface-panel treatment: fill, border, header bar, corner brackets, an edge tick rule and a seeded run of irregular dashes. Rasterised once per panel to its own canvas and blitted, because re-stroking forty panels' chrome per frame is the most expensive and least necessary thing a dense interface can do. |
| `marks.ts` | `drawCrosshair`, `drawCornerBracket`, `irregularDashes`, `tickRing` | Loose interface furniture. `irregularDashes` is seeded rather than uniform on purpose: a uniform dash pattern reads as a border, an irregular one reads as data. Draws in the context's current transform, so a plane-space context puts them on the plane. |
| `postFx.ts` | `bloomPass`, `vignettePass`, `scanlinePass`, `grainPass`, `makeScanlineTile`, `makeGrainTiles` | Screen-space finishing passes, applied in declaration order. `bloomPass` reads a separate accumulator canvas holding only what should glow — thresholding a finished frame instead makes everything pale-bloom. `makeGrainTiles` pre-bakes noise; generating 8M pixels of it per frame is not affordable at 4K. |

## Conventions

- **Determinism.** No `Date.now()`, `Math.random()`, `requestAnimationFrame`,
  CSS animation or component state. Every value is a pure function of the
  frame and its seeds.
- **Loop closure.** When a piece loops, pick reroll/flash bucket sizes and
  grain tile counts that divide the loop length exactly, and express periodic
  motion as `sin`/`cos` of the loop phase. `bucketOf` takes the period for
  this reason.
- **Colour in, never out.** A component that hardcodes a hex cannot be reused
  by the next project. Pass the palette down.
- **Rasterise once, blit thereafter.** Anything static for the life of a shot
  belongs in a `useMemo`'d offscreen canvas.

## Consumers

- `Toma/remotion-video` — `JetHudBlue` / `JetHudAmber` (jet on a tilted HUD).
  Uses every module above. The aircraft geometry and renderers are
  subject-specific and deliberately stay in that project.
