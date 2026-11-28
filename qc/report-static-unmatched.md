
## 8. What could not be matched, and why

Both references are photographic-quality footage: A is live action (or a render indistinguishable
from it), B is a detailed offline 3D render. Both videos here are built from code alone, with no
image, model or scan assets, as the brief requires. That sets the ceiling, and every reviewer's
closing verdict ("clean CG next to a photographic original") comes back to it.

**Look measures.** The ±10% target was met on roughly two thirds of the measures across the five
sampled moments, not on all of them (section 2). The ones that stay outside:

- *Glow radii* (both references). The measure follows the falloff around the brightest point of the
  frame. In A that point is a specular patch whose shape depends on real roller wear; in B it is a
  small glint on the glass. The position and size of the bright area match, the falloff does not.
- *Contrast by thirds* (both). A's top third holds a real warehouse with more tonal variety than a
  procedural backdrop; B's top and middle thirds hold eroded cliffs and detailed buildings with
  deeper local contrast than the procedural terrain and panel textures reach.
- *p1 in A* sits at 11 where the reference is 7.5-9: the reference's darkest pixels are the black
  straps and the shadow under the carton lip; lowering the black level further crushed p5, which
  matches.
- *p99 in B* is 80 where the reference is 72: the reference never clips; here the lamp cores and
  the glass glint are the top percentile.

**Things in the references that are not reproduced:**

- A: the hero parcel is a soft, slightly squashed mailer with a thick folded lip, worn corners and
  straps that pinch it. Here it is a bevelled box with a raised lid, a rim and a cardboard texture.
- A: the reference's belt shows real, irregular specular streaks. Here the streaks are procedural
  noise; rib contrast inside the glare is about a third of the reference's.
- A: the warehouse background is a blur of real racking with colour variety. Here it is rows of
  procedural posts, beams, goods and one lamp, drifting at the reference's speed.
- B: fine model detail - window rows, hatches, ladders, the ribbed underside of the hub, the
  serrated (broken-edge) glass piece at the right, leafy trees with trunks. The buildings here are
  procedural solids with panel-seam and window-band textures, the trees are layered cones.
- B: the reference is lit almost without cast shadows (heavy dust diffusion plus ambient occlusion).
  Here a soft-edged sun shadow remains; there is no ambient-occlusion pass.
- B: the reference's cliff wall fills the whole background with rock facets. Here the terrain is a
  height field with baked relief: the same colours and haze, less structure.
- B: the reference's lower viewpoint could not be matched exactly together with the on-screen size
  of the near and far tanks; the fitted camera (section 1) favours the tank sizes and sits a little
  higher, so the far perimeter wall is about 40 px higher in frame at 720p.

**Version 2 "same quality" question.** Both Version 2 reviewers answered *yes* to "is the change
clearly visible" in every round and *no* to "is everything else the same concept and quality" -
each time saying the concept is the same and listing the photographic-detail gaps above, which
Version 2 shares with Version 1. The items that were specific to Version 2 were fixed (section 5).

## 9. Notes on this render machine

- Rendered in a cloud container without a GPU: Chrome's ANGLE backend falls back to software
  (SwiftShader). `--gl=angle` works; frames are identical to what a GPU would produce up to driver
  rounding, only slower.
- Remotion could not download its own headless browser here (the download host is not on this
  machine's network allow-list), so every command in this report was run with one extra flag,
  `--browser-executable=<path to the pre-installed chrome-headless-shell>`. The README commands
  are otherwise used unchanged, and do not need that flag on a normal machine.
- Renders were run with `--concurrency=1`; two software-GL tabs at once exceeded the frame timeout
  on this machine.
- No MCP servers, no AI image or video generators, and no stock footage or images were used. The
  two reference clips are not in the repository or in the ZIPs.
