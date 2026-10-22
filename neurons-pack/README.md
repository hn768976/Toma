# Neurons, Flight Trails, Data Server, Ink Cloth, Tangled Threads, Proximity App

One Remotion project, 11 compositions, 3840×2160 at 30 fps. Everything is built in code:

- the 3D scenes use three.js 0.180 on WebGL2, hosted in `@remotion/three`'s `<ThreeCanvas>`;
- the 2D scenes (Flight Trails, Tangled Threads) use PixiJS 8 on WebGL2.

| Composition id | Output file | Engine | Length | Background |
|---|---|---|---|---|
| `NeuronNetwork-Silver` | `NeuronNetwork_Silver.mp4` | three.js | 20 s loop (600 f) | black (0,0,0) |
| `NeuronAnatomy-Labelled` | `NeuronAnatomy_Labelled.mp4` | three.js + SVG labels | 30 s (900 f) | black |
| `NeuronAnatomy-Clean` | `NeuronAnatomy_Clean.mp4` | three.js | 30 s | black |
| `FlightTrails-FlatNavy` | `FlightTrails_FlatNavy.mp4` | PixiJS 8 | 20 s loop | navy `#0A0A4A` |
| `DataServer-City` | `DataServer_City.mp4` | three.js | 20 s loop | white haze |
| `DataServer-Dark` | `DataServer_Dark.mp4` | three.js | 20 s loop | black |
| `InkCloth-White` | `InkCloth_White.mp4` | three.js `Points` (600,000) | 20 s loop | white (255,255,255) |
| `ProximityApp-City` | `ProximityApp_City.mp4` | three.js | 19 s (570 f) | white haze |
| `ProximityApp-GreenScreen` | `ProximityApp_GreenScreen.mp4` | three.js | 19 s | screen exactly `#00FF00` |
| `TangledThreads-White` | `TangledThreads_White.mp4` | PixiJS 8 | 17 s (510 f) | black |
| `TangledThreads-Ink` | `TangledThreads_Ink.mp4` | PixiJS 8 | 17 s | white |

Remotion only allows `a-z`, `0-9` and `-` in composition ids. Each id therefore uses a hyphen where its file name has an underscore.

## Setup

```bash
npm ci              # versions are pinned in package.json / package-lock.json
npm run dev         # Remotion Studio
```

`remotion.config.ts` sets PNG frames (JPEG would shift the exact black, white and green levels), `--gl=angle`, H.264, `yuv420p` and CRF 16. If a Playwright Chromium exists at `/opt/pw-browsers/...`, the config uses it. Otherwise Remotion downloads its own Chrome Headless Shell.

## Render at 4K

```bash
# one clip
npx remotion render NeuronNetwork-Silver out/NeuronNetwork_Silver.mp4 \
  --gl=angle --image-format=png --codec=h264 --crf=16 --pixel-format=yuv420p \
  --color-space=bt709 --muted

# all eleven
for id in NeuronNetwork-Silver NeuronAnatomy-Labelled NeuronAnatomy-Clean FlightTrails-FlatNavy \
          DataServer-City DataServer-Dark InkCloth-White ProximityApp-City ProximityApp-GreenScreen \
          TangledThreads-White TangledThreads-Ink; do
  npx remotion render "$id" "out/${id/-/_}.mp4" --gl=angle --image-format=png --codec=h264 \
    --crf=16 --pixel-format=yuv420p --color-space=bt709 --muted
done
```

- **720p preview:** add `--scale=0.3333333333333333`, or run `tools/render-previews.sh`.
- **ProRes for editing:** use `--codec=prores --prores-profile=4444`. Leave out `--pixel-format=yuv420p` and `--crf`.
- **GPU:** on a machine with a GPU, `--gl=angle` uses it. Without one, Chrome falls back to SwiftShader on the CPU. That is slow, but it gives the same pixels.

### Loop check

The loops are 600 frames. Pass `--props='{"loopCheck":true}'` to make them 601 frames, so you can render frame 600 and compare it with frame 0.

## Blend modes

- **Black-background clips** (Neuron Network, both Neuron Anatomy clips, Tangled Threads White): use **Screen** or **Add**. Black is exactly (0,0,0) wherever nothing is drawn.
- **White-background clips** (Ink Cloth, Tangled Threads Ink): use **Multiply**. White is exactly (255,255,255).
- **Flight Trails** is a full-frame background on flat navy `#0A0A4A`. Use it as is, or use Screen to bring in only the trails and map.
- **Data Server and Proximity App** are full-frame scenes. The Data Server Dark sky is pure black, so Screen also works there.

## Keying the green phone screen (`ProximityApp-GreenScreen`)

Every screen pixel is exactly `#00FF00`: unlit, with no reflections, grain, dither or bloom, and nothing ever crosses the screen. The connection lines leave from the phone's foot, along the ground. The round punch-hole camera sits on the screen, as it does on a real phone, so it stays black after keying.

- **After Effects:** apply Keylight, set Screen Colour to `#00FF00`, then set Screen Matte Clip Black to 5 and Clip White to 95.
- **Premiere:** Ultra Key, with the key colour picked from the screen.
- **Resolve:** the 3D Keyer.
- **ffmpeg:**

  ```bash
  ffmpeg -i your_app.mp4 -i ProximityApp_GreenScreen.mp4 -filter_complex \
    "[1:v]chromakey=0x00FF00:0.12:0.05[k];[0:v][k]overlay" out.mp4
  ```

The camera circles slowly, so the screen's perspective changes. Corner-pin your app with a planar tracker (Mocha) on the screen's four corners.

## Translating the anatomy labels

All label text lives in `data/neuronLabels.json`:

```json
{ "title": "NEURON", "cellBody": "cell body", "nucleus": "nucleus", "axon": "axon",
  "myelinSheath": "myelin sheath", "nodeOfRanvier": "node of Ranvier",
  "dendrites": "dendrites", "axonTerminals": "axon terminals" }
```

1. Edit the strings and re-render `NeuronAnatomy-Labelled`.
2. Text positions are set in `src/scenes/neuron/NeuronAnatomy.tsx` (`specs`, as fractions of the frame). Move them there if a translation runs long.
3. The leader lines are projected from 3D points on the neuron each frame, so they stay on the right structures.

The font is Inter SemiBold/Bold (SIL OFL), bundled from `@fontsource/inter`.

`NeuronAnatomy-Clean` is the same animation with no title or labels, ready for your own.

## Timings

**Neuron Anatomy (both clips):**

| Time | What happens |
|---|---|
| 0–4 s | The soma appears and turns slowly; the axon starts to extend (from 1.8 s). |
| 4–12 s | Dendrites grow; the axon grows across with myelin segments; the camera pulls back. |
| 12–15.5 s | The axon terminals branch out, ending in small bulbs. |
| 16 s and 19.1 s | Signals: in along three dendrites → the soma flashes → down the axon node to node → the terminals flash and release sparkles. |
| 22.4–26 s (Labelled) | The rule and NEURON title, then seven labels one by one. |
| 26.4 s (Labelled) / 23.2 s (Clean) | One more signal, then hold. |

**Tangled Threads:**

| Time | What happens |
|---|---|
| 0–3 s | A few threads drift in. |
| 3–8 s | Threads gather into a central tangle. |
| 8–13 s | Big looping coils. |
| 13–16 s | The tangle loosens and fades. |
| 16–17 s | About 10 strands remain. |

**Proximity App:**

| Time | What happens |
|---|---|
| 0–3 s | The disc pulses out. |
| 3–14.6 s | 30 people icons appear one by one, each with a line from the phone. The screen switches from map to list at 4–5.5 s, and the list grows with each icon. |
| 15–19 s | Hold. |

The camera circles about 48° over the whole clip.

**Loops (Neuron Network, Flight Trails, Data Server ×2, Ink Cloth):**

- Every motion has a period that divides 600 frames, and every scene reads `frame % 600`.
- Noise is sampled on a circle in time.
- The camera drift is one tile (Neuron Network) or one whole sine cycle (Data Server).
- The flight routes repeat every 600, 300 or 200 frames, and the walkers pace out and back once per 600 frames.

## Render times

Measured on a 4-core cloud container with no GPU (Chrome with SwiftShader, `--gl=angle`). A machine with a GPU will be much faster.

| Clip | 720p preview, whole clip (concurrency 2) | 720p per frame | 4K per frame (measured) | 4K whole clip (estimate, concurrency 1) |
|---|---|---|---|---|
| Flight Trails | 143 s | 0.24 s | 1.4 s | about 14 min |
| Data Server City | 255 s | 0.42 s | 2.1 s | about 21 min |
| Ink Cloth | 626 s | 1.04 s | 3.3 s | about 33 min |
| Data Server Dark | 288 s | 0.48 s | — | about 25 min |
| Neuron Network Silver | 659 s | 1.10 s | — | about 45 min |
| Neuron Anatomy Labelled / Clean | 201 s / 192 s | 0.22 s | — | about 15 min each |
| Proximity App City / GreenScreen | 203 s / 167 s | 0.33 s | — | about 15 min each |
| Tangled Threads White / Ink | 104 s / 95 s | 0.19 s | — | about 6 min each |

The three measured 4K times are the extra cost of each frame beyond the first: a 5-frame render minus a 1-frame render, divided by 4. They include PNG capture and H.264 encoding. The other 4K figures are estimates, scaled from each clip's 720p time by the 4K/720p ratio of a similar measured clip.

## How it is built

- **Determinism:** every value comes from `useCurrentFrame()`. All data — neurons, map, routes, threads, people, events — is generated once from `mulberry32` seeds. Nothing uses `Math.random()`, `useFrame`, `Date.now()`, state-driven animation or temporal AA. Fonts load behind `delayRender`, and so does the PixiJS init. The map data is bundled JSON.
- **Banding:** each frame renders into a half-float (RGBA16F) target with 4× MSAA in three.js, or a half-float render texture in Pixi. A final pass converts it to sRGB and adds a static ±1/255 dither. The dither applies only where the pixel is above 2% brightness, is not pure white and is not `#00FF00`. Flight Trails also leaves the flat navy undithered wherever nothing is drawn.
- **`data/`:** `colors.json` holds palettes, `counts.json` holds counts (neurons, routes, people, particles, threads), and `neuronLabels.json` holds the label text.
- **Map data:** Natural Earth 110m land (public domain), via the `world-atlas` package. Land only, with no borders. Antarctica is left out, as in the reference.
- **Interpretation notes:**
  - The Flight Trails land fill (`#7E8CB8` at 60%) is drawn as a fine halftone dot texture over a faint 5% tint. A solid 60% fill came out far brighter than the reference's land.
  - The Neuron Network repeating tile is 18 world units wide, so about 45 of the 70 neurons in a tile are on screen at once.
  - The city is invented: a seeded, warped street grid with highways, a river and parks.

## Project layout

```
src/lib/three/GLStage.tsx    three.js host: ThreeCanvas + half-float MSAA target + dither pass
src/lib/pixi/PixiStage.tsx   PixiJS 8 host: async init, half-float target, composite + dither
src/lib/glsl.ts              hashes, sRGB, dither, simplex noise (GLSL)
src/scenes/neuron/           neuron generator, network, anatomy (+ labels)
src/scenes/flights/          world map + routes + trails
src/scenes/city/             city map, people, server, phone, app UI, Data Server, Proximity App
src/scenes/ink/              Ink Cloth
src/scenes/threads/          Tangled Threads
tools/render-previews.sh     720p previews with per-clip timing
tools/verify.py              ffprobe / loop / background / green screen / determinism checks
```
