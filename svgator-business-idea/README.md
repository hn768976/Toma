# Business Idea — SVGator animation

An animated SVG scene rebuilt from a reference GIF: a person at a desk, a light
bulb switching on, a target taking an arrow, and dollar coins drifting overhead.

**SVGator project:** https://app.svgator.com/editor#/dd979b758af74642b9dc98bae7191480

## Palette

Sampled directly from the reference frames, used unchanged.

| Role | Hex |
|------|-----|
| Background / fills | `#FFFFFF` |
| Outlines, monitor, hair | `#020047` |
| Shirt, target rings, glasses | `#605CFD` |
| Coins, bulb, sparkles | `#FECA3C` |
| Bulb highlight | `#FEDE80` |
| Bulb rays | `#FEE8AA` |
| Gear | `#E5F0FB` |
| Stand foot | `#1A147A` |

## Timeline (4400 ms, infinite loop)

| ms | Beat |
|----|------|
| 0–4400 | Ambient: coins float on a sine, gear rotates once, torso breathes |
| 500–1050 | Bulb scales in (0.88 → 1.075 → 1) on an ease-out-back curve |
| 780–1420 | Rays burst outward and fade — secondary to the bulb |
| 1150–1660 | Target grows from a dot, unwinding a −14° rotation |
| 1660–2090 | Arrow flies in along its own axis and lands past centre, then settles |
| 1980–2300 | Target squash/settle on impact — secondary |
| 2040–2700 | Head tilts in reaction, 60 ms behind the strike — secondary |
| 980–1640 | Sparkles pop in, staggered 140 ms apart |
| 3560–4160 | Everything exits as its entrance reversed; 240 ms of stillness before the loop |

First and last poses match exactly, so the loop seam is invisible.

## Layout

`src/` regenerates `document.json`, the exact payload sent to SVGator's
`create_project`.

- `lib.py` — element builders, path-node helpers, and a flat-SVG renderer that
  mirrors SVGator's transform composition (`translate(origin) · rotate · scale ·
  translate(translate)`), so local previews match the real player.
- `art.py` — every shape, positioned from measurements taken off the reference frames.
- `anim.py` — the timeline: easing curves and per-channel keyframes.
- `build.py` — assembles the document and writes `document.json` + `still.svg`.
- `verify.py` — samples the timeline locally and writes `preview.gif`.

```
python3 -m pip install cairosvg pillow
cd src && python3 build.py && python3 verify.py
```

## Notes

- The account is on SVGator's Free plan, so exported SVGs carry a SVGator
  watermark and GIF/MP4 export is unavailable. `preview.gif` here is rendered
  locally from the same keyframe data and is watermark-free.
- The reference frames carry an iconscout watermark; nothing from it was copied.
