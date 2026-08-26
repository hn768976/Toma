# YOUR ADHD BRAIN CAN'T HEAR

A 35.0s Kurzgesagt-style explainer built as a Rive `.riv` and exported to mp4.

    node build/buildAll.mjs    # scene spec -> adhd-brain.riv
    node build/render.mjs      # .riv -> frames/seq/*.png (1050 frames)
    ffmpeg -framerate 30 -i frames/seq/%05d.png -c:v libx264 -preset slow \
      -profile:v high -pix_fmt yuv420p -b:v 10M -maxrate 12M -bufsize 20M \
      -movflags +faststart adhd-brain.mp4

## Structure

`build/lib.mjs` holds the palette, the scene table and the camera solver;
`build/artboards.mjs` builds the 12 nested artboards; `build/scenes.mjs` lays
out the main artboard; `build/animations.mjs` writes the six scene timelines.

Scene spans are contiguous (A 0-195, B 195-405, C 405-555, D 555-720,
E 720-910, F 910-1050) so playback never gaps. One state machine, `Main`,
chains them with time-based transitions only — no triggers, no conditions.

## Camera

Three depth layers (`camFar` 0.4x, `camMid` 1.0x, `camNear` 1.5x) each carry
the full camera transform at their own rate, which is what makes the Scene B
push read as a camera rather than a scale. Moves are anchored explicitly:
`layer.x = anchor.x * (1 - scale)` keeps the listener's head fixed while the
world grows around it. Ambient drift is a closed figure-eight, +/-10px
horizontal and +/-6px vertical over 240 frames, sampled at absolute time so it
stays continuous across scene boundaries.

## Deviations from the brief

- **Ear -> Mic morph.** `riv_create` keyframes mesh vertices on *images* only
  (`<imageId>#v<row>_<col>`); vector `PointsPath` vertices are not animatable,
  so a true point-for-point interpolation is not authorable here. Ear and Mic
  are generated from one 15-point set (`EAR_PTS` / `MIC_PTS`) and the morph is
  a cross-registered scale + crossfade over the specified 18 frames.
- **Posture blend state.** The `posture` blend1d state (upright <-> slumped)
  is built on the rig as specified, but a parent timeline cannot key a nested
  artboard's state-machine input, so the hero's 30% slump is driven by a
  time-based transition into a pre-blended `slump30` pose at 5.0s.
- **Per-instance character colour.** Nested artboards expose SM inputs, not
  fill colours (that needs data binding, which `riv_create` does not author).
  Colour variants are separate artboards emitted from one generator function.
- **Scene E** ends at frame 910 rather than 920, so it does not overlap F.
- **No VO audio.** The brief supplies VO as timing only; no audio asset was
  provided and none can be synthesised here, so the export is silent with the
  on-screen caption band carrying the script.

Font: Poppins ExtraBold / Bold (SIL OFL 1.1), embedded in the `.riv`.
