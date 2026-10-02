# Tech Loops — verification report

Project: `tech-loops-five/` (also zipped here as `tech-loops-five-project.zip`).
All checks were run with `tech-loops-five/scripts/verify.py` and
`tech-loops-five/scripts/render.mjs` on the final previews in `previews/`.

## Deliverables

| Folder | Contents |
|---|---|
| `previews/` + `previews-split/` | 10 × 1920×1080, H.264, yuv420p, 30 fps, CRF 16, 20.0 s, no audio |
| `stills-1080p/` | one 1080p PNG per composition (frame 300; look 4: frame 450) |
| `stills-6000/` | two 6000×3375 PNGs per composition (frames 90 & 390; look 4: 280 mid-typing & 560 near the end) |
| `tech-loops-five-project.zip` | the Remotion project, without node_modules / .git / render output |
| `verification/` | contact sheets (5 evenly spaced frames from each mp4), banding report, timings |

The two AI Core Tunnel previews are 131 MB and 117 MB (thousands of 1-px
streaks plus the dither cost bits at CRF 16), above GitHub's 100 MB
per-file limit. Git LFS uploads are blocked by this environment's network
policy, so they are committed in < 100 MB parts under `previews-split/`
with SHA-256 checksums. Re-join with
`cat AICoreTunnel_Cyan.mp4.part-* > AICoreTunnel_Cyan.mp4` (see
`previews-split/README.md`). Everything else is plain files.

## Results

| Step | Check | Result |
|---|---|---|
| 1 | ffprobe: 1920×1080, 30/1, 20.000 s (600 frames), h264, yuv420p, no audio | **10/10 pass** |
| 2 | 601-frame variant: frame 0 vs frame 600, pixel for pixel | **8/8 looping compositions identical** (identical PNG bytes) |
| 3 | frame 300 rendered cold vs frame 300 of the full multi-threaded render | **10/10 byte-for-byte identical** |
| 4 | banding, read from the encoded mp4 (2A, 2B, 5A, 5B) | **4/4 pass**: smooth falloff, no plateaus, longest run of equal raw values in the gradient 4–6 px |
| 5 | visual content (contact sheets in `verification/`) | **10/10 pass** |

### Step 5 notes
- **Binary Word**: "BINARY CODE" / "DATA STREAM" readable at 1080p, built from digits (dense half-row streaks), background flickers, scan band visible in sampled frames.
- **Soft Spinner**: eight blurred teardrop petals; sheets use frames 0/120/240/360/480 (rotation advances 144° per sample, 9° off the 8-fold symmetry; at quarter-loop spacing the frames would look identical because 2 turns × ¼ = a multiple of 45°); the brightness chase moves between samples.
- **Security Dashboard**: tilted board, a different panel area centred in each sample, rings/charts/gauges/logs moving, centre text crisp, edges soft. Only reserved IPs (192.0.2.x, 198.51.100.x, 203.0.113.x), no brands or names.
- **Model Training**: code further along in each sample, logs scrolling, loss falling (LLM) / val accuracy rising (fine-tune), orb colours drifting, ends with "Epoch 3/3 complete".
- **AI Core Tunnel**: "AI" readable and glowing in every sample (also at the pulse peak), streaks/panels/tokens rushing outward, tokens at several depths (near ones defocused).

## What failed first time and what I changed

1. **Determinism (Step 3) failed at first for Soft Spinner and Security Dashboard** (±1–6 code values on a few hundred pixels). Cold renders agreed with each other, but a frame rendered after ≥3 earlier frames in the same Chromium tab rasterised slightly differently (the spinner's SVG blur, then the dashboard's animated hotspot ring): Chrome reuses compositing layers and raster tiles between frames. Fix: `key={frame}` on the root of looks 2, 3 and 4, so every frame is painted from fresh DOM and layers, the same as a cold render. Output pixels are otherwise unchanged (the cold hashes before and after the fix match). Re-rendered those six previews, and Step 3 then passed (attempt 2).
2. **Render script fix (not a check failure):** my first Node render script shared one browser instance without `forceDeviceScaleFactor`, so frames were drawn at 4K and downsampled. That was slow and canvases saw `devicePixelRatio = 1`. Each render now opens its own correctly scaled browser. The loop check was re-run with the fixed script.
3. **AI Core Tunnel visual fixes (found in Step 5 review / stills):**
   - the left-wall and ceiling panels were back-face culled, so they only appeared on the right and floor. Fixed with `DoubleSide`.
   - at the emblem's pulse peak, and much more at 6000 px, the glow washed the "AI" letters out. Fixed by capping the glow pulse and running UnrealBloom on a fixed 1920×1080 mip chain, so every output resolution blooms the same way.
   Both tunnels were re-rendered and every check re-run (attempt 3 for the tunnel files; all passed).
4. Smaller tuning before the final renders: the Binary Word word moved to a half-row digit sub-grid so it reads at 1080p; tunnel exposure, emblem size and the bloom pass order were tuned; the field went from N = 3 to N = 1 (block L = 360) so the 20 s loop doesn't visibly repeat every 6.7 s.

Nothing is still failing.

## Render time (4 vCPU, no GPU; Chromium + ANGLE → SwiftShader; concurrency 2)

| Look | 1080p ms/frame | 4K ms/frame (measured) | 4K 600-frame estimate |
|---|---:|---:|---:|
| Binary Word | 415 | 1 973 | ≈ 20 min |
| Soft Spinner | 315 | 1 579 | ≈ 16 min |
| Security Dashboard | 371 | 1 636 | ≈ 16 min |
| Model Training UI | 227 | 1 015 | ≈ 10 min |
| AI Core Tunnel | 1 826 | 7 295 | ≈ 73 min (CPU WebGL; a GPU will be much faster) |
