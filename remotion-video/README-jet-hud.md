# Jet HUD (JetHudBlue / JetHudAmber)

Two 4K Remotion compositions: a generic delta-canard fighter crossing a tilted
heads-up display, drawn entirely as 2D canvas vector work. No 3D, no
Three.js, no model files.

**The aircraft is an invented design** carrying no national insignia, roundel,
squadron marking or tail code. Every label and line of code-like text on the
interface is fictional, generated from invented token pools.

| id | 
| --- |
| `JetHudBlue` — solid flat-shaded aircraft, lower-left to upper-right, dense HUD receding upper-right |
| `JetHudAmber` — the same airframe as a glowing wireframe, upper-right to lower-left, sparse HUD receding upper-left |

Both 3840×2160, 30 fps, 390 frames (13.0 s), seamlessly looping.

```sh
npx remotion render JetHudBlue  out/jet-hud-blue.mp4  --codec=h264 --crf=12 --concurrency=8
npx remotion render JetHudAmber out/jet-hud-amber.mp4 --codec=h264 --crf=12 --concurrency=8
```

`JetHudLoopCheck` and `JetSpriteQA` are development compositions — the first
renders frame 390 so it can be compared against frame 0, the second draws the
aircraft sprite alone.

Full documentation ships inside `dist-zips/jet-hud-{blue,amber}.zip`
(`README.md`). Shared components live in `src/lib/`, vendored from
`../remotion-lib`.
