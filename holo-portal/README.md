# Holo Portal

A holographic "data portal" motion graphic made with Remotion: a glowing HUD ring
lights up on a plexus floor of orange and blue nodes, then sends icons, data
streaks and particles upward.

- **Compositions are authored at 4K** (3840×2160), 30 fps, 361 frames (12.033 s, the same length as the reference clip).
- **Deliverables are rendered at 1080p** with `--scale=0.5`, H.264 MP4.
- **Technology:** Canvas 2D with a small custom perspective camera (`src/portal/camera.ts`).
  Bloom and depth of field come from blurred quarter-resolution buffers that are
  composited additively. Every frame is computed from the frame number alone with a
  seeded PRNG, so the output is deterministic.

## Compositions

| ID                | Description                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `HoloPortal`      | Matches the reference: low, near-locked-off camera with a slow push-in.                         |
| `HoloPortalOrbit` | Variant: the camera orbits about 38° around the portal while rising to look down into it and pushing in. |

## Timeline

| Frames  | Event                                                         |
| ------- | ------------------------------------------------------------- |
| 0–15    | Plexus floor only                                             |
| 15–34   | Portal ring ignites (flash + shockwave sweeping across floor) |
| 38+     | Data streaks and particles start rising                       |
| 52+     | Icons begin floating up (emission ramps up over time)         |
| 95–165  | Outer HUD: equaliser bars, tick ring, rotating arcs           |

## Commands

```console
npm i
npm run dev                 # Remotion Studio
npm run render:reference    # out/HoloPortal_reference_1080p.mp4
npm run render:orbit        # out/HoloPortal_orbit_1080p.mp4
npm run render:reference:4k # full 4K render (optional)
npm run render:orbit:4k
```

If Remotion cannot download its headless Chrome, add
`--browser-executable=/path/to/chrome-headless-shell` to the render command.
