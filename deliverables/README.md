# Data Tunnel Flythrough - deliverables

| File | What it is |
| ---- | ---------- |
| `V1_DataTunnelBlue.mp4` | V1 deep blue, 1920x1080, H.264 `yuv420p`, 30fps, 15.00s, seamless loop |
| `V2_DataTunnelMono.mp4` | V2 neutral monochrome, same spec |
| `V1_DataTunnelBlue_still.png` | 1920x1080 still, frame 180 |
| `V2_DataTunnelMono_still.png` | 1920x1080 still, frame 180 |
| `data-tunnel-project.zip` | The full Remotion project, ready to render at 4K |

The mp4s are **1080p previews** rendered with `--scale=0.5`. The compositions
themselves are defined at 3840x2160; the 4K masters are rendered separately -
see the README inside the zip for the exact commands, the required Chromium GL
flag and the measured per-frame render times.

The project source also lives unzipped at `../data-tunnel/`.

## Checks run on these files

- **Frame coverage.** The outer 6% bands and both far corners of an encoded
  frame sit at 69-75% of the centre's mean level (left 73, right 71, top 75,
  bottom 73, corners 69-73), so the field bleeds off all four edges instead
  of ending on a visible boundary. The vanishing point is centred, so
  left/right agree to within 2 points.
- **Loop.** Frame 449 -> frame 0 differs by 3.13 mean levels/channel, against
  3.10 and 2.98 for ordinary one-frame steps elsewhere in the clip and 3.49
  for a two-frame step. The seam is an ordinary frame step.
- **V2 neutrality.** Every one of the 2,073,600 pixels in a decoded V2 frame
  has R = G = B exactly; mean 19.323 on all three channels.
- **Resolution independence.** A 4K still downscaled to 1080p and a directly
  rendered 1080p still of the same frame agree to a mean 0.98 levels per
  channel, with mean image level matching to within 1.2% - so point sizes
  and blur radii scale correctly between the preview and the 4K master.
- **Banding.** The dark background ramp in the encoded file breaks into 359
  dithered runs across 750px (longest 18px) rather than hard contours.
