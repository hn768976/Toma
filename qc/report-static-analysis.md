## 1. Reference analysis (step 2)

### Reference A — `conveyor-parcels`

| | |
|---|---|
| Duration | 10.4167 s (250 frames at 24 fps) → **313 frames at 30 fps** = 10.4333 s. Difference 0.0167 s (half a frame). |
| 2D or 3D | **3D.** A low, long lens with real perspective on the rollers, strong depth of field, and light moving over surfaces in depth. |
| Loops? | Not strictly: its last frame differs from its first by about twice the normal frame-to-frame difference (8.5 vs 3.6 grey levels). It is periodic, though: exactly one light zone passes per clip. The composition is built as a seamless loop, which is a superset. The one visible consequence is that the background returns to its start instead of drifting on. |
| What it shows | A flat strapped carton, sharp, in the foreground; a wide strapped carton and a taller labelled carton behind it, increasingly blurred. The cartons hold still in frame (the camera travels with them) and vibrate by a pixel or two, while the ribbed conveyor streams towards the lens at 6.1 ribs per second and a blurred warehouse aisle slides past. |
| Timing | 0–2.7 s: the hero carton is in shade; the middle and back cartons catch the light. 2.7–3.2 s: a hard light edge sweeps onto the hero carton's top. 3.2–8.3 s: top face blazing, glare on the belt to the right. 8.3–8.8 s: the light leaves. 8.8–10.4 s: as the start. |
| Colours (sampled) | carton front `#403226` (lit `#524030`), lit top `#e8dfc6`, straps `#081219`, belt `#5f5248`, glare `#f7f7f3`, background `#54433d`, posts `#2a2320`, warm bokeh `#7a5e4d` |
| Light | One hard, warm-white backlight from behind and slightly right, passing overhead in zones; it lights top surfaces and throws glare off the rollers on the right of frame. Faces turned to the lens sit in soft warm bounce. |
| Atmosphere | No visible fog; the depth fade comes from defocus. Blacks are lifted (p1 ≈ 8, nothing below 5%). |
| Texture | Soft overall (low-resolution source), fine grain mostly removed by compression (0.2–0.3 code values), cardboard mottle, broken specular lines on the rollers. |
| Technology | three.js via `@remotion/three` + React Three Fiber; procedural geometry and canvas textures; PMREM environment; one shadow-mapped key light with moving gobo slabs for the light zones; custom WebGL 2 post passes on half-float targets. |
| Version 2 | **Colour palette.** The shot is defined by locked framing and travelling light, so a palette change reads instantly without touching the concept. |

Camera fit: a least-squares fit to the hero carton's corners, the rib spacing at seven heights and
the belt-edge vanishing point gave a 12.1° vertical field of view, 2.57 rib pitches above the belt,
tilted down 2.7°.

### Reference B — `mars-dome`

| | |
|---|---|
| Duration | 10.3833 s video stream (623 frames at 60 fps) → **311 frames at 30 fps** = 10.3667 s. Difference 0.0167 s. |
| 2D or 3D | **3D.** Parallax between the foreground pole, the dome ribs, the buildings and the cliffs. |
| Loops? | **Yes.** Tracked features return to within 0.1 px of where they started. The composition loops. |
| What it shows | A glass dome over a circular plaza: central tower with a saucer hub, off-white arch ribs, stay cables to outer masts, ring-tank and capsule habitats, a low block, trees, planted beds, about 25–30 path lamps, hazy red cliffs and rock outcrops behind. |
| Timing | Only the camera moves: a slow hand-held style drift. Near objects shift ±8 px at 768 wide, the tower ±3.8 px, the cliffs ±2 px; right by 2.5 s, through centre at 4.1 s, left by 6.3 s, home by 10.4 s. Fitted with three harmonics per axis (residual 0.2 px). |
| Colours (sampled) | lit cliff `#c87d55`, haze `#a65432`, outcrops `#703f1e`, plaza `#85746a`, tower `#604e45`, hub `#b7a595`, arch `#9d8971`, beds `#543f2c`, lamps `#f2efed` |
| Light | Soft, warm, dust-diffused daylight; shadows shallow. |
| Atmosphere | Strong orange depth haze; no true blacks (p1 = 18) and no clipping (p99 = 72); a miniature-style focus falloff blurs the bottom edge, the foreground pole and the cliffs. |
| Texture | Panel seams and grime on the structures, tiled paving, eroded rock; light grain (0.5 code values). |
| Audio | The file has an audio track, but it is digital silence (−91 dB). No audio was produced. |
| Technology | As A, plus a custom glass shader for the dome, a baked-relief terrain mesh, and a screen-space miniature focus term. |
| Version 2 | **Camera movement.** Mars's colour is the subject, so palette is the wrong lever; a larger move shows off the parallax the scene already has. |

Camera fit: comparing the on-screen size of the near and far ring tanks showed the lens is much
closer and wider than it first appears: about 50 m from the tower, 24 m up, 40° vertical field of
view, tilted down 16.5°.

**Why hand-written post passes instead of the pmndrs `postprocessing` library:** every size (blur
radius, bloom reach, grain cell) is defined as a fraction of frame height, so 1080p and 4K renders
look the same, and nothing depends on a clock.
