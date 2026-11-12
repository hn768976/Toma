# Sea ABC — 15 s pilot (Remotion)

Original 2D cut-out style kids' alphabet test: **Nova** the baby narwhal, **Puff** the pufferfish,
a seabed set and an alphabet slate. 1920×1080, 30 fps, 450 frames (120 BPM, one beat = 15 frames).

| Frames  | Shot |
|---------|------|
| 0–60    | Wide seabed. Clam opens (Lottie) on 20, Nova's horn peeks on 28, she bursts out on 32 (stretch → squash landing → overshoot settle). Puff idles, then scoots under the slate when Nova lands beside him. |
| 60–135  | Nova swims a mid-water arc to the slate: PixiJS MeshRope body bend (S-curve), camera push-in 1.00 → 1.12 combined with a pan. |
| 135–150 | Nova points with her horn: anticipation, jab, hold. Blink on 145. |
| 150–345 | Letter close-up. A 165, B 195, C 255, D 285. The horn tip lands centred under each letter on its beat (pull-back, jab, 4-frame hold, glide). Puff steals C's beat on 225 (pop, inflate, 12-frame hold, deflate, zip away). Nova's head + tucked horn slide out of frame together for the gag and back. Staggered group bounce 300/315/330. |
| 345–450 | Wide again (closer). Nova cheer (Lottie), Puff spins, bubble burst, held pose for the last 15 frames. |

Wide-shot layout: the seabed is a 2400 px wide world (`WORLD_W`) and `Camera` in `src/scenes/WideShot.tsx`
maps it to the frame (`screen = (world - cam) * zoom`). Nova is drawn at 1.52x (~1/3 of the frame height),
Puff and the clam scale with her.

## Style: no outlines

Nothing has a stroke (React SVG, PixiJS texture and the Lottie files: `"ty":"st"` count is 0).
Parts are separated by colour: each hue has a base, a darker same-hue tone (~15-20%) for
shading (under the belly, under fins, inside the clam, letter bottoms) and a lighter tone for
small highlights (top of the head, eye shine, top edge of the horn, a glint on each letter).
Facial features are filled #1E2A44 shapes. The background (water, sand, kelp, set coral) is
slightly muted so the characters stay the brightest, warmest things on screen. Palette:
`src/theme.ts` (mirrored at the top of `scripts/lottie/build.mjs`). Letters are flat colour plus a
6px darker same-hue bottom edge, a soft blurred drop shadow and a clipped glint (`ChunkyText`).
Nova's body shading is baked into the MeshRope texture (`novaBodySvg`) so it bends with her.

## Install

Requires Node 20.19+ / 22.13+ / 24+.

```bash
npm ci
# optional, only for editing with an AI agent:
npx skills add remotion-dev/skills
npx skills add diffusionstudio/lottie
npx skills add pixijs/pixijs-skills
```

## Render the final 1080p mp4

```bash
npx remotion render SeaAbcPilot out/sea_abc_pilot_1080p.mp4 --codec=h264
```

The PixiJS layer needs WebGL2 in headless Chrome. `remotion.config.ts` already sets
**`--gl=swangle`** (ANGLE on SwiftShader, CPU), which works on any machine, including servers
without a GPU or X display. If you have a GPU you can try the faster:

```bash
npx remotion render SeaAbcPilot out/sea_abc_pilot_1080p.mp4 --codec=h264 --gl=angle
```

If Nova's body is missing (only her face shows), WebGL failed: go back to `--gl=swangle`.

Other renders:

```bash
# 720p preview (exact 2/3 scale: 0.6667 gives 720.036px and is rejected)
npx remotion render SeaAbcPilot out/sea_abc_pilot_720p.mp4 --scale=0.6666666666666666 --codec=h264 --x264-preset=veryfast
# Studio preview
npm run dev
# contact sheet (bundles once, renders stills, tiles them with frame labels)
node scripts/stills.mjs --frames=10,35,50,100,140,170,230,240,300,380,440 --scale=1 --out=out/contact --sheet=out/contact_sheet.png --cols=4
```

Optional env vars: `REMOTION_GL=angle` (default renderer), `REMOTION_BROWSER=/path/to/chrome-headless-shell`.
When `HTTPS_PROXY` is set (locked-down CI/sandboxes), the config routes Chrome through that proxy so
Google Fonts (Fredoka) can load. Elsewhere this does nothing.

## Swap the song

Audio is one layer: `src/Soundtrack.tsx`. Replace `public/audio/beat_placeholder.wav`, or point
`SOUNDTRACK_SRC` at your file. The placeholder is a soft click every 15 frames, accented every 4 beats,
generated with:

```bash
ffmpeg -f lavfi -i "aevalsrc='0.35*sin(2*PI*1400*t)*exp(-90*mod(t,0.5))*(1+0.6*lt(mod(t,2),0.5)) + 0.25*sin(2*PI*180*t)*exp(-45*mod(t,0.5))*lt(mod(t,2),0.5)':s=48000:d=15" -c:a pcm_s16le public/audio/beat_placeholder.wav
```

## What does what

| Tool | Used for | Files |
|------|----------|-------|
| PixiJS 8 (WebGL2) | Nova's side-view body+tail rasterised from SVG and bent on a 20-point `MeshRope`. The amplitude grows from 0 at the head to max at the tail, at 1.2 waves/s, with a slight opposite bend over the front third (S-curve) and a lag bend driven by body rotation. Ticker stopped, `preserveDrawingBuffer`, one `app.render()` per Remotion frame. | `src/characters/NovaRig.tsx`, `novaArt.ts` |
| SVG face layer | Eyes, eyelids (blinks), pupils, brows, 5 mouths, horn, fins. Locked to the rope's head point and angle, so the face never distorts. | `src/characters/NovaFace.tsx` |
| Lottie (`@remotion/lottie`, frame-driven via `<Freeze>`) | `clam_open`, `puff_idle` (2 s loop), `puff_inflate`, `nova_cheer`. Shape-path morphs (mouth), keyframed squash. | `public/lottie/*.json`, generated by `scripts/lottie/build.mjs` |
| Remotion `interpolate`-style keyframe tracks + Bézier easing | Jump arcs, swim path, pointing, camera, letters, horn pointer, kelp, bubbles. | `src/lib/motion.ts`, `src/scenes/*` |

The Lottie files are authored in code. Rebuild them with `node scripts/lottie/build.mjs`. They were
previewed in the official text-to-lottie Skottie player (`npx degit diffusionstudio/lottie`).

Everything is a pure function of the frame number. There is no `Math.random` (a seeded mulberry32
is used instead) and no `requestAnimationFrame`.
`scripts/determinism_check.py` compares an in-order sequence render against out-of-order stills:

```bash
npx remotion render SeaAbcPilot out/det/inorder --sequence --frames=0-20 --image-format=png
npx remotion render SeaAbcPilot out/det/inorder_swim --sequence --frames=60-80 --image-format=png
node scripts/stills.mjs --scale=1 --out=out/det/shuffled \
  --frames=$(python3 -c "import random;a=[*range(21),*range(60,81)];random.shuffle(a);print(','.join(map(str,a)))")
python3 scripts/determinism_check.py out/det
```
