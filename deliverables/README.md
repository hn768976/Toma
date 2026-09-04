# Data Tunnel Flythrough - deliverables

| File | What it is |
| ---- | ---------- |
| `V1_DataTunnelBlue.mp4` | V1 deep blue, 1920x1080, H.264 `yuv420p`, 30fps, 15.00s, seamless loop |
| `V2_DataTunnelMono.mp4` | V2 neutral monochrome, same spec |
| `V1_DataTunnelBlue_still.png` | 1920x1080 still, frame 180 (two bright streaks crossing) |
| `V2_DataTunnelMono_still.png` | 1920x1080 still, frame 180 |
| `data-tunnel-project.zip` | The full Remotion project, ready to render at 4K |

The mp4s are **1080p previews** rendered with `--scale=0.5`. The compositions
themselves are defined at 3840x2160; the 4K masters are rendered separately -
see the README inside the zip for the exact commands, the required Chromium GL
flag and the measured per-frame render times.

The project source also lives unzipped at `../data-tunnel/`.

## Checks run on these files

- **Loop.** Frame 449 -> frame 0 differs by 3.23 mean levels/channel, against
  3.08 and 3.14 for ordinary one-frame steps elsewhere in the clip and 3.47
  for a two-frame step. The seam is an ordinary frame step.
- **V2 neutrality.** Every one of the 2,073,600 pixels in a decoded V2 frame
  has R = G = B exactly; mean 13.651 on all three channels.
- **Resolution independence.** A 4K still downscaled to 1080p and a directly
  rendered 1080p still of the same frame agree to a mean 0.98 levels per
  channel, with mean image level matching to within 0.04% - so point sizes
  and blur radii scale correctly between the preview and the 4K master.
- **Banding.** The dark background ramp in the encoded file carries +/-1
  dither throughout rather than hard contours.
