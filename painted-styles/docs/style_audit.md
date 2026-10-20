# Phase 1 — Style audit (lake at dusk, seed 1)

Skill commit `24418f3f61963ea6c4964537dad732c4ad7467c6`. Contact sheet: `StyleAudit.png`; full frames: `audit/<key>.png` (1920×1080).
Times are single-threaded numpy on this 4-core container (it runs the repo's own examples ~5× slower than the README claims).

| # | Style | 1080p | **4K** | Look | Problems |
|---|---|---|---|---|---|
| 1 | Ink wash | 20 s | **96 s** | ★★★★ Calm, genuinely brushy sumi-e; great mist and reflections | Pines are stiff "Christmas-tree" icons; ripple dashes mechanical; dusk only as a faint vermilion tint |
| 2 | Watercolour | 76 s | **470 s** | ★★★★★ Most painterly: soft violet-peach dusk, hazy ranges, believable reflections, lovely mist | Pines flat and samey; birds blobby; muddies if over-glazed; slowest of the good ones |
| 3 | Ukiyo-e | 76 s | **653 s** | ★★½ Reads as a woodblock lake | Looks more vector than print, wood grain barely visible, flat reflection bars, square ticks on key lines; registration left bare-paper edge strips (worked around); slowest at 4K |
| 4 | Stained glass | 13 s | **78 s** | ★★★★ Rich jewel colour bands, believable leading, sun glitter path | Big Voronoi pieces make the mountains busy; reeds vanish; strong built-in vignette; full-bleed needed a private-attribute override |
| 5 | Roman mosaic | 37 s | **137 s** | ★★★ Convincing tesserae flowing around ridges | Left pines merge into the dark near hill; blocky reflections; crude dark band at the bottom; needed a custom dusk stone palette |
| 6 | Art Deco | 30 s | **123 s** | ★★★★½ Striking 1930s-poster lake: sunburst, faceted ranges, rippled mirror | Shadow facets slab-like; sun hidden behind range; reeds faint; airbrush grain is per-pixel (finer at 4K) |
| 7 | Delft tiles | 13 s | **52 s** | ★★★½ Clean, charming cobalt tile picture | Monochrome (no dusk palette possible); reflections lost in ripple dashes; small birds; tile grid limits use as a background |
| 8 | Shadow puppetry | 38 s | **174 s** | ★★½ Charming amber lamp-lit screen | Blues go muddy (light-transmission physics), water mottled teal; mist can only darken; carved-hole strips busy; niche |
| 9 | X-ray | 5 s | **19 s** | ★★ Convincing film look | Flat, low-detail; additive (no occlusion); pines read as white spikes; boat/birds barely visible; novelty only |
| 10 | VHS home video | 50 s | **285 s** | ★★★ Very believable camcorder frame | Too degraded for general stock; reeds invisible; dark wedge at left edge from the "hand-held" tilt |
| 11 | Ballpoint doodle | 33 s | **108 s** | ★★½ Real biro + pencil on copy paper | Dense diagonal hatching busy; violet sky; mist weak; stray blue zig-zag blotches on slopes |
| 12 | Pastel UI | 1 s | **5 s** | ★★★ Clean pastel dusk, soft blooms | **A product-UI style, not a painting style**: without UI chrome it's generic flat vector; double-alpha edges on pine reflections, hard seam on near range |
| 13 | Storybook animation | 5 s | **18 s** | ★★½ Cheerful kids'-book page | **A character-animation style**; sky banded into 4 hard stripes (no gradient primitive), cartoon sun reads afternoon not dusk, hard-edged mist |
| 14 | Linocut *(pick)* | 23 s | **105 s** | ★★★★ Bold, graphic, convincingly printed; two-block orange afterglow | Far range reads snowy; heavy black sky with grainy "low baren pressure" blotches; right pines tiny |
| 15 | Impasto oil *(pick)* | 25 s | **136 s** | ★★½ Pleasant amateur-painting look | Busy sky strokes, stiff cartoon pines, bar-like reflections, almost no mist; needed a toned ground to hide white specks |
| 16 | Cross-stitch *(pick)* | 93 s | **383 s** | ★★ Reads as real Aida cloth | Muddy, low contrast (cloth greys every colour); pines barely separate; very slow; cell must be whole pixels |
| 17 | Flat vector *(pick)* | 3 s | **13 s** | ★★★★ Clean, stock-ready flat landscape | Not "hand-made"; generic triangle peaks; mist bars look like UI bars; faint seam on near range; banded sky |
| 18 | Retro synthwave *(pick)* | 39 s | **205 s** | ★★★½ Striking neon wireframe dusk | Sun reflection reads as a second sun (known lib issue); sun stripes hidden; scratchy reeds |
| 19 | Paper collage *(pick)* | 102 s | **450 s** | ★★★ Charming torn-paper dusk | White rims make mist/pines read as snow; ripples look like pills/ice; opaque pieces so mist can't be translucent; slow |
| 20 | Warm pencil storybook *(pick)* | 56 s | **326 s** | ★★★ Richest pencil texture | Upper sky reads daytime blue; streaky low-contrast mountains; orange rim streaks along the near ridge |

The 7 picks cover printmaking (linocut), painting (impasto oil), textile (cross-stitch), graphic (flat vector), retro (synthwave), craft (paper collage) and drawing (warm pencil).

## Top 5 (my recommendation)
1. **Watercolour**: the most convincingly hand-made, and the easiest to sell (calm, neutral, wide appeal).
2. **Art Deco**: the most striking, and nothing else on the sheet looks like it. Strong poster/travel stock.
3. **Stained glass**: distinctive and colour-rich, and fast. A good fit for the light-sweep motion.
4. **Ink wash**: a calm, premium, minimalist look with a lot of empty space for text overlays. Fast.
5. **Linocut**: the most authentic print texture, and clearly different from the other four.

Runners-up: **flat vector** (sells well but doesn't look hand-made) and **retro synthwave** (striking, but a narrower market).

## Speed test (decides Phase 2)
| Style | 1920×1080 | 3840×2160 | 6000×3375 |
|---|---|---|---|
| Flat vector | 3.4 s | 12.7 s | 79 s |
| Ink wash | 20.3 s | 95.9 s | 385 s |
| Watercolour | 75.5 s | 470 s | 1895 s |

Paint time grows faster than the pixel count. Only flat vector stays under the 2-minute limit at 6000×3375, so Phase 2 stills would be painted at **3840×2160**. The layered motion approach is required: no style could be painted per frame.
