## 6. Independent reviews and what was fixed

Every review was done by a fresh sub-agent that saw only the image pairs or frame sets named in the brief, with the brief's instruction text.

### Look checks on the three look-dev stills (step 4A-5)

**ai-chip-reveal**

| Round | Main notes | Fixed |
|---|---|---|
| 1 | Attempt too sharp, no depth of field; pure blacks with no haze; glowing lines hard, uniform "emissive strips" with tight halos; capacitors flat white discs; orange too saturated and yellow; wide shot board too bright with clipped white blocks; no grain | Depth of field added, stronger at the angled start; two-layer bloom (tight core, wide halo) with configurable sizes; brightness variation along each line; dome-topped metal cans; palette shifted to deeper amber; white parts and key light held back in the wide shot; film grain pass |
| 2 | Capacitors and socket frame matte black with only a rim crescent, no reflections; traces still too bright and uniform; "AI" white-hot; slot bars too bright; white blocks dominate the wide shot; background flatter | Found and fixed a real defect: the lathe profiles of the cans and pin rings were inside-out, so they shaded black. Trace and letter intensity lowered; separate non-reflective material for the slot bars; backdrop pool retuned; wide-shot exposure and white level lowered |
| 3 | Reference has orange light bouncing onto black plastic and pooling between the slots; pin grid too bright and yellow so the "AI" does not dominate; needs slightly lifted warm shadows; whites harder-edged than the reference | Coloured spill lights raised and extra pool lights added over the lower board; pins darkened to copper on a brown chip face; extruded metal letters; bloom core widened. (Remaining: the reference's milky haze in the close-up is stronger than ours.) |

**chip-ignite**

| Round | Main notes | Fixed |
|---|---|---|
| 1 | Attempt warmer overall (cream traces, saturated copper) where the reference is neutral-cool silver; light flat and frontal instead of a hard key from the upper right; tiles too contrasty; glow at the centre pink with a hard edge; gold accents too orange; hard black void instead of a soft vignette | Light, environment and board texture made neutral; key moved and hardened; tile texture softened; chip glow recoloured deep orange-red; gold and bronze muted; vignette recentred and softened; flare rebuilt with a small core and wide halo |
| 2 | Tiles too dim and flat (reference bright silver with raking gradient); board too dark with no mid-tones; fringing only at the corners; glow too saturated at the peak, veil missing; LEDs too small and orange | Tiles brightened and made more reflective; board mid-tones lifted; fringe widened; glow and halo made paler and wider; LEDs enlarged; grain raised |
| 3 | Board whites clip to blocky white; blacks on the housing milky; attempt now softer than the reference with too much fringe; bloom too large and cream; LEDs over-bloomed | Board highlight level lowered; glossier, deeper blacks on the package; depth of field and fringe reduced; bloom tightened and made more orange; LEDs reduced. (Remaining: the reference's fine "glitter" speculars are finer than our texture.) |

### Visual match of the videos (step 8B)

**01-V1-ai-chip-reveal**

| Round | Main notes | Fixed |
|---|---|---|
| 1 | The reference board is still assembling at 5.0 s (parts floating off the left edge and above) and keeps changing until the end, the attempt is a finished static rectangle; socket should be grey metal; pins flat orange; heavy grainy bokeh discs in the opening; board reads flat and top-down | Added the assembly beat: 15 groups of parts lift off during the spin and settle on their own schedules; board tilt in the wide shot; grey metal socket frame; extruded letters; lower-half layout changed to long parallel slots with a heat sink; cans clustered. Also found and fixed that shadow maps went stale after the first frame |
| 2 | Wide shot evenly lit with every trace the same orange, reference has only some traces glowing; assembly finishes too early; board too tilted; pin field should be dense rings with a small trace area; opening too tight and too blurred; chip too large and legible in the wide shot | Per-line brightness selection in the wide shot (a few bright, most dim); assembly windows moved later and offsets enlarged; tilt reduced; pin ring widened; opening reframed with less blur; letters dimmed and the chip face lit as one copper square in the wide shot |
| 3 | Reference dims towards the end, attempt stays bright; board a little large at 5.0 s; socket frame should read as metal; pins large and saturated; whites pure and bright | End fade-down of traces and pool lights; camera further back from 3.7 s; frame lightened then balanced against the look measures; pins smaller and darker; white level lowered |
| final check | Size, position, timing and empty space "closely matched" (board 36% of frame width at 5.0 s and 29% at 9.8 s in both). Still different: socket frame reads matte black rather than brushed silver; deeper blacks, higher contrast and cleaner edges than the hazy reference; traces thicker, brighter and more saturated, covering more of the board; pin field a more uniform orange; board silhouette tidier at 5.0 s; "AI" legible in the wide shot; an orange bokeh orb right of the chip at 0.3 s that the reference lacks. Verdict: "reads as the same piece of motion design in composition and timing, but as a cleaner, more saturated, less photoreal rendition" | no further changes (three rounds used) |

**03-V1-chip-ignite**

| Round | Main notes | Fixed |
|---|---|---|
| 1 | Camera move far weaker than the reference (which goes from low oblique to near top-down, the chip filling the frame height); final frame lacks energy (reference tiles nearly blown out, long gold traces across the board); large empty matte panels; package a thin flat slab without the gold fin rows; flat centre emblem; tiles dim with coarse patterns; board made of large blocky rectangles | Camera path rebuilt (elevation 38 to 72 degrees, push in at mid-film); glow, tile light and flare now keep building to the end; shrouds smaller, darker and ridged; package made taller in three steps with rows of upright gold fins and solid corner brackets; raised seat rings; finer tile and board textures with glitter specks |
| 2 | Board now too white and busy; final frame flooded with long saturated orange lines to the frame edges (reference: sparse, short, paler gold); flare already a hard white square at 6.8 s with no build-up; chip smaller in frame at the end; red indicator bars missing | Board brightness and pour count reduced; board lines halved, shortened and recoloured pale gold; flare core now grows from 30% to full over the second half; end framing closer; two red bars added next to five LEDs; three more tiles given cut corners |
| 3 | Timing and the indicator lights match and "nothing from the reference is missing outright". Lit state too neutral (reference turns amber, tiles tinted peach); flare a hard-edged white-pink square with almost no halo (reference: soft bloom with a wide orange halo, 13% of frame width growing to 20%); chip too large in frame at 6.8 s and 13.3 s (72-74% of width against 59%) and still oblique at 6.8 s; tiles too bright before ignition; less fringing; flat centre emblem; coarser board detail. Verdict: "clearly reads as the same piece of motion design, but as a cooler, tighter, harder-edged version lacking the reference's warm bloom" | Flare rebuilt with a larger soft core, a mid glow and a wide amber halo that hides the chip face; glow, board-line and ignition-light colours moved back towards orange and the ignition light raised so the tiles pick up a peach tint; camera further back at mid-film and at the end and steeper at 6.8 s; tiles dimmed before ignition; fringe increased. Checked on stills against the reference (this was the third and last round, so no further review). Not changed: centre emblem and board detail scale |

**Version 2 checks**

| Video | Is the change clearly visible? | Everything else the same concept and quality? | Notes |
|---|---|---|---|
| 02-V2-ai-chip-reveal (palette) | __A2_VISIBLE__ | __A2_SAME__ | __A2_NOTES__ |
| 04-V2-chip-ignite (camera movement) | __B2_VISIBLE__ | __B2_SAME__ | __B2_NOTES__ |
