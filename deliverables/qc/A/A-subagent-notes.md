## Sub-agent notes for `teal-waves` and what was changed

Every review below was done by a fresh sub-agent that saw only the image pairs or frame sets named, plus the instruction from the brief.

### Step 4A.5 look check (lighting, atmosphere, texture only)

**Round 1** (3 pairs: start f0, middle, peak)

| # | Finding | Action |
|---|---|---|
| 1 | Far field too pale, hazy and uniform; top band brighter and less saturated than the reference, dark troughs filled in | Removed the additive haze, cut far blur, toned down the top ramp stop |
| 2 | Missing midtone sheen in the focus band ("thin bright lines on black") | Fresnel power 9 → 6 with exposure re-balanced |
| 3 | Surface too smooth and silky; long clean ribbons; beaded lines on some crests | Added a fine "crinkle" domain warp, less-stretched filament layers; started the anti-aliasing work (see below) |
| 4 | Far blur heavier, focus-band edges harder than the reference | Far blur 0.03 → 0.02, wider blend between sharp and blurred picture |
| 5 | Highlight peaks flatter and whiter; glow wide and soft | Glow radius 0.035 → 0.018 and weaker |
| 6 | Foreground falloff differs between moments | Near-field light level re-tuned |
| 7–9 | Shadow tint slightly bluer; left/right balance mirrored in one frame; no vignette or grain difference | No change (content-dependent or matching) |

**Round 2**

| # | Finding | Action |
|---|---|---|
| 1 | Highlights now too broad and satin-like; reference lines are thin and wiry | Fresnel power back up (6 → 7.5 → 9), stronger filament layers |
| 2 | Troughs filled with grey-teal midtones | Higher black point contrast via exposure/fresnel balance, near level lowered |
| 3 | Highlights paler and greyer; reference cooler and more saturated | Palette ramp applied after the blur instead of before it (blurred light keeps saturation) |
| 4 | Top band a uniform milky haze | Added a far-distance light easing so the horizon band keeps colour and contrast |
| 5 | Focus band too deep, foreground blur too weak | Near blur 0.02 → 0.028, far blur 0.03 |
| 6 | Reference grainier | Fixed film grain raised from 0 to 0.014 (faded out in black) |
| 7 | Foreground too bright in one moment | Near level 0.16 → 0.12 |
| 9 | Beaded line along one crest | Analytic specular anti-aliasing in the shade pass |

**Round 3** (last allowed round)

| # | Finding | Action |
|---|---|---|
| 1 | Highlights broad satin sheens topping out at mid cyan | Thinner, brighter rim (fresnel 9–10.5, exposure up) |
| 2 | Top band a flat milky wash | Far level and far blur re-balanced; top ramp stop re-sampled |
| 3 | Micro-texture missing | Filament layers retuned (more, finer strands) |
| 4 | Reference grainier | Kept at 0.014: the measured flat-area grain of the reference is ~0, so more grain would overshoot the measurement |
| 5 | Attempt more saturated/aqua (opposite of round 2) | Ramp colours returned to the values sampled from the reference |
| 7 | Foreground blobs too lit in one moment | Near level lowered |
| 9 | Beaded stair-step lines on some ridge silhouettes | Root cause found later (see 8B round 1) |
| 10 | No distinct bloom | Glow tightened (radius 0.012) and strengthened |

### Step 8B visual match, Version 1

**Round 1** (frames 0 / 563 / 1125 of the first full render)

| # | Finding | Action |
|---|---|---|
| 1 | Fewer, wider satin ribbons instead of many thin wiry filaments | Filament layers rebuilt; fresnel power 9.5, exposure 11.5 |
| 2 | Waves broader, flatter, mostly horizontal; reference small, choppy, with diagonals | More chop (mid layers stronger), layer rotations ±12–27°, wave size 1.45 → 1.28 |
| 3 | Middle frame has a calm patch of long straight parallel lines | Reduced by the smaller wave size and less-stretched filaments; still present to a lesser degree |
| 4 | Foreground fades to empty black | Near-field light level 0.18 → 0.19–0.34 during tuning, final 0.19 with brighter exposure |
| 5 | Far band finer, busier, more uniform | Far blur and far level retuned |
| 6 | Reference highlights cooler/bluer | Upper ramp stops shifted slightly bluer |
| 8 | Reference has slight bloom | Glow strength 0.16 |
| 9 | Dotted strings in the focus band | **Root cause fixed:** bright crest texels were bleeding down magnified wave faces through bilinear filtering of the shading texture. Shading is now per grid cell and sampled without blending between rows; long footprints use a pre-averaged copy; the depth-of-field gather got a third fill pass |
| 10–11 | Blur transition more abrupt; relief flatter | Partly addressed by 2 and by blur retune |

**Round 2** (stills of the revised look, same frames)

| # | Finding | Action |
|---|---|---|
| 1 | Still reads as glossy satin; highlights 20–60 px wide vs 2–6 px | Fresnel power raised, exposure raised |
| 2 | Reference has 2–3× more crests in the focus band | Wave size 1.45 → 1.28 (1.05 was tried and rejected: ripples became small round bumps, 18–25 of 36 measures) |
| 3 | Calm, featureless area in the middle frame | Reduced, not eliminated |
| 4 | Top band hazier and more blurred | Far blur 0.032 → 0.028, far level 0.75 |
| 5 | Dotted strands and bundles of parallel strands | Filament stretch relaxed (0.2 → 0.3–0.4) so strands are no longer combed; residual faint dotting remains on a few out-of-focus strands |
| 7–8 | Foreground bokeh brighter; highlights paler in the mid field | Near level 0.19; middle ramp stops deepened |

**Round 3** — see the QC report (run on frames of the final video).
