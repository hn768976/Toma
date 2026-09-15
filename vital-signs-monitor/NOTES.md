# Reference match notes

Measured from the supplied reference clip (596×336, VP8/WebM, 30 fps, 17.000 s):

| Property | Reference | This project |
|---|---|---|
| Duration | 17.000 s | 17.000 s (510 frames) |
| Frame rate | 30 fps | 30 fps |
| Aspect | 596×336 (1.774) | 16:9 |
| Sweep wrap period | 181 frames (wraps at f96 / f277 / f458) | 181 frames |
| R-R spacing | ~258 px in 1920-space | 258 px (`BEAT_PX`) |
| Eraser gap width | ~239–274 px | 255 px (`ERASER_PX`) |
| Trace colour (core) | `#ebffff` | `#ebffff` |
| Digit colour | `#54beb4` | `#54beb4` |
| Grey block | `#bebdc0` | `#bebdc0` |
| Background | `#010002` | pure black |
| Heart rate shown | hunts 59–61 | hunts 59–61 |
| Secondary readout | `1.2.0` … `1.9.0` | same, middle digit steps |

## Deliberate departures

- **No watermark.** The reference carries a Shutterstock watermark; it is not
  reproduced.
- **Beat rate vs. displayed HR.** In the reference these disagree — the trace
  runs at roughly 43 bpm while the readout shows ~60. Visual fidelity was
  prioritised, so the R-R spacing matches the reference and the readout keeps
  showing 59–61, exactly as the source does.
- **Red variant.** Every lit element is red - trace, HR number, secondary
  readout and the marker squares. The grey block keeps its neutral grey, as in
  the reference, where it reads as a greyscale status indicator rather than a
  colour-coded channel. To take it red too, set `grey` in the `RED` theme.
