# Airport Departure Boards — deliverables

| File | What it is |
| --- | --- |
| `V1_DeparturesLCD.mp4` | Modern blue LCD board, rows typing in. 1920×1080, H.264 yuv420p, 30 fps, 14 s, seamless loop. |
| `V2_DeparturesSplitFlap.mp4` | Classic black split-flap board, two columns. Same format. |
| `V1_DeparturesLCD_still.png` | Frame 315 — board full, one remark mid-retype and one mid-clear. 1920×1080. |
| `V2_DeparturesSplitFlap_still.png` | Frame 205 — board full, three cells mid-riffle. 1920×1080. |
| `departures-project.zip` | The whole Remotion project, ready to render at 4K elsewhere. |

The two mp4s are **1080p previews**, rendered with `--scale=0.5 --crf=23`. The
compositions themselves are defined at 3840×2160; the 4K render is a separate
step and the commands are in the project's own `README.md`:

```bash
npx remotion render DeparturesLCD out/V1_DeparturesLCD.mp4 --scale=1 --crf=16
npx remotion render DeparturesSplitFlap out/V2_DeparturesSplitFlap.mp4 --scale=1 --crf=16
```

The zip excludes `node_modules`, `.git` and all render output. `npm install &&
npx remotion studio` was verified from a clean extraction of it.

The project source also lives in this repository under `departures-project/`.
