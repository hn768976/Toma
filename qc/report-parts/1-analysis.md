## 1. Reference analysis (step 2)

### Reference A - `ai-chip-reveal`

| | |
|---|---|
| Source | `0bb38d88-istockphoto-2094174172-640_adpp_is.mp4`, 768x432, H.264, 24 fps, 241 frames, no audio |
| Duration | **10.041667 s** -> round(10.041667 x 30) = **301 frames** at 30 fps = 10.0333 s (0.0083 s shorter, a quarter of a frame; 24 fps is not a multiple of 30) |
| 2D or 3D | **3D.** The camera orbits a socket with real parallax between the pin field, the socket frame, capacitors and slot bars, the lens has shallow depth of field, and the board then spins a full turn in perspective. None of that survives a 2D treatment. |
| Loops? | **No.** It starts on a close-up and ends on a wide shot. |
| Technology | three.js through `@remotion/three` (React Three Fiber canvas), WebGL 2 via ANGLE. Instanced meshes for the roughly 1,500 parts, a seeded canvas texture for the board, shader ribbons for the glowing traces, pmndrs `postprocessing` for depth of field and bloom, and a custom final pass (ACES tone mapping, grade, grain, dither). The whip uses real motion blur from 6 sub-frame renders. |
| Version 2 | **Colour palette** (amber -> electric cyan). The camera whip and spin are the identity of this piece, so they stay; the amber glow is a single hue family against black and silver, so swapping it reads instantly and changes nothing else. |

**What it shows**

- 0.0-2.1 s: close-up of a pin-grid processor in a socket, glowing "AI" letters with fine circuit lines fanning out. The camera starts about 35-40 degrees off-axis and settles square-on. Chrome capacitors and over-exposed white blocks sit on the left, black slot bars on the right, thick amber traces run under everything.
- 2.1-3.4 s: whip pull-back. The frame blows out to white for about 5 frames (peak near 2.45 s), the board spins a full turn, and its back catches the light once (a second, smaller brightness peak near 2.9 s).
- 3.4-10.0 s: the whole motherboard floats, small, in a dark grey void with a soft pool of light under it. Parts are still drifting into place (an exploded view that closes), the board keeps turning a few degrees and shrinks slowly, and the glow dims towards the end.

**Colours (sampled)**: blacks `#050203`-`#0b0708`; white blocks `#f0f1f4`; amber glow `#b86a1f` with hot parts `#f0a835`, deep amber `#6c3a18`; wide shot backdrop from `#030303` (corner) to `#1a1a1a` (pool under the board); silver parts `#9b999b`-`#cdc9c4`.

**Light, atmosphere, texture**: soft, cool-white studio light from the upper left gives broad gradient reflections on chrome and brushed metal; the only coloured light is the amber of the traces and letters, which spills onto nearby black plastic. Glows are tight (falling to half within about 5% of the frame height in the wide shot) with a faint wide halo. The close-up is soft with shallow focus (foreground capacitors and the right-hand bars are blurred); the wide shot is clean and sharp with a smooth dark gradient and no visible grain (measured 0.01-0.06 levels), while the close-up carries light noise (about 1 level). No fog, dust or rays. Corners in the wide shot are about a fifth of the centre brightness.

### Reference B - `chip-ignite`

| | |
|---|---|
| Source | `162cc20b-istockphoto-2052605052-640_adpp_is.mp4`, 768x432, H.264, 25 fps, 340 frames |
| Duration | **13.600 s** -> 13.6 x 30 = **408 frames** exactly (difference 0) |
| Audio | The file has an AAC track, but it is digital silence (mean and peak -91 dB) and no audio was provided, so the videos have **no audio stream**. |
| 2D or 3D | **3D.** A continuous camera move (orbit, crane up, slight push) over a board covered in parts of different heights, with a chip descending in depth, shadows, and lens blur front and back. |
| Loops? | **No.** It starts unlit and ends fully lit. |
| Technology | three.js through `@remotion/three`, WebGL 2 via ANGLE. A 4096 px seeded canvas texture (three detail scales) for the board, a second for the etched tiles, about 9,000 instanced parts, reveal-masked shader ribbons for the spreading light, an additive flare card, pmndrs `postprocessing` for depth of field and bloom, and the custom final pass (radial colour fringe, vignette, ACES, grade, grain, dither). |
| Version 2 | **Camera movement.** The reference move is slow and gentle over a scene that is detailed in every direction, so a new path (start high and nearly square-on, spiral about 70 degrees around the package while descending and pushing in) shows the same design freshly. A palette change would have weakened the warm-on-neutral contrast that the ignition depends on. |

**What it shows**

- 0.0-5.7 s: a large square package with a 3x3 grid of etched silver tiles sits on a dense black-and-silver board. A small chip descends into the empty centre cell, turning slightly, and seats at about 5.7 s. Four small amber indicator lights (and two red bars) come on at the lower right from about 3.2 s.
- 6.0-6.9 s: the chip glows orange-red, then bursts into a white-hot flare.
- 6.7-13.6 s: amber light runs out along circuit lines on the tiles (about 1.7 s), then on across the board in long straight lines; the flare and the lit tiles keep growing brighter. The camera rises from a low three-quarter view to nearly top-down while orbiting about 15 degrees.

**Colours (sampled)**: black `#010101`; board silver `#a0a29f`-`#c1c0bd`; tiles around `#848484`; amber `#a4784b` to `#dda266`; bronze pins `#664a2c`; about 1% blue-cyan (`#356887`) from chromatic fringing at edges.

**Light, atmosphere, texture**: one hard, slightly cool key from the upper right and behind makes the fine copper pattern sparkle and throws short shadows; large areas (shrouds, package) stay pure black, so the image is very high in contrast (about 40% of pixels below 5%, yet p95 near 0.7). Depth of field blurs the foreground strip and the far background; frame edges show cyan/orange fringing. After ignition the warm glow is local to the package with a small white core and a wide soft amber halo. Texture is extremely dense (Laplacian variance 2,300-3,700, five times reference A) with light noise.
