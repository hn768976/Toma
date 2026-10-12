#!/usr/bin/env python3
"""Banding check on frames decoded from the encoded mp4s (out/check/*-mp4-150.png).

- Looks 1–2: share of pixels away from marks (>6 px from anything brighter than 12) that are
  exactly 0,0,0, and the largest value found there.
- Gradient areas: vertical luminance profile (row median over a narrow strip, so sparse particles are ignored) through
  the gradient; reports the largest step between adjacent rows and how many distinct
  flat runs longer than 12 px appear (long flat runs + jumps = visible bands).
"""
import json, os
import numpy as np
from PIL import Image, ImageFilter

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
def load(stem):
    return np.asarray(Image.open(f"out/check/{stem}-mp4-150.png").convert("RGB")).astype(int)

def clean_black(stem):
    a = load(stem)
    m = Image.fromarray(((a.max(2) > 12) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(13))
    away = np.asarray(m) == 0
    px = a[away]
    return dict(away_pixels=int(away.sum()), exactly_black=round(float((px.max(1) == 0).mean()), 5), max_value_away=int(px.max()))

def profile(stem, x0, x1, y0, y1):
    a = load(stem)
    lum = (0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2])[y0:y1, x0:x1]
    lum = np.median(lum, 1)  # median ignores sparse particles/marks in the strip
    # 1-D median filter (5 rows) removes 1-2 px design lines (chart grid, LED gaps)
    pad = np.pad(lum, 2, mode='edge')
    lum = np.array([np.median(pad[i:i + 5]) for i in range(len(lum))])
    steps = np.abs(np.diff(lum))
    q = np.round(lum)
    runs, cur = [], 1
    for i in range(1, len(q)):
        if q[i] == q[i - 1]:
            cur += 1
        else:
            runs.append(cur); cur = 1
    runs.append(cur)
    return dict(rows=f"{y0}-{y1}", x=f"{x0}-{x1}", start=round(float(lum[0]), 1), end=round(float(lum[-1]), 1),
                max_step=round(float(steps.max()), 2), flat_runs_over_12px=int(sum(r > 12 for r in runs)))

out = {
    "NumberMatrix_Green": clean_black("NumberMatrix_Green"),
    "NumberMatrix_Amber": clean_black("NumberMatrix_Amber"),
    "RadialHUD_GreyGold": clean_black("RadialHUD_GreyGold"),
    "RadialHUD_Cyan": clean_black("RadialHUD_Cyan"),
    "TradingTerminal_Dark (empty chart navy)": profile("TradingTerminal_Dark", 60, 124, 60, 220),
    "CoinBadge_EtherPurple (vignette, lower-right corner)": profile("CoinBadge_EtherPurple", 1200, 1270, 380, 720),
    "CoinBadge_BitcoinOrange (vignette, lower-right corner)": profile("CoinBadge_BitcoinOrange", 1200, 1270, 380, 720),
    "ParticleWave_BlueViolet (sky haze)": profile("ParticleWave_BlueViolet", 900, 964, 10, 290),
    "NebulaHUD_Purple (band edge, right margin)": profile("NebulaHUD_Purple", 1245, 1275, 110, 330),
}
for k, v in out.items():
    print(f"{k:44s} {v}")
json.dump(out, open("out/check/banding.json", "w"), indent=1)
