#!/usr/bin/env python3
"""look-over-time.py - compare the look of a video with its reference at
several moments (QC step 8A-7).

Usage:
  python3 qc/look-over-time.py VIDEO REFERENCE --times 0.5,1.5,3.5,6,9.5 \
      --measure path/to/measure-look.py [--skip hue,sat] [--json out.json]

For every time it extracts the frame of both clips, runs measure-look.py on
them and reports each measure with the difference. A measure is "within
target" when it is inside +-10% of the reference (hues: +-10 degrees;
measures whose reference value is tiny use a small absolute tolerance).
"""
import argparse
import importlib.util
import json
import os
import subprocess
import tempfile

KEYS = [
    "lum_p1", "lum_p5", "lum_p50", "lum_p95", "lum_p99",
    "pct_above_90", "pct_below_5", "sat_mean",
    "hue_shadows", "hue_midtones", "hue_highlights",
    "glow_r50", "glow_r25", "glow_r10",
    "contrast_top", "contrast_mid", "contrast_bottom",
    "contrast_centre", "contrast_edge",
    "grain_std_8bit", "detail_lap_var", "vignette_ratio",
]
# absolute tolerances for values where 10% of the reference is meaningless
ABS_TOL = {"lum_p1": 0.02, "lum_p5": 0.02, "lum_p50": 0.02, "pct_above_90": 1.0,
           "pct_below_5": 5.0, "grain_std_8bit": 0.5, "sat_mean": 0.03,
           "glow_r50": 0.03, "glow_r25": 0.05, "glow_r10": 0.05,
           "vignette_ratio": 0.05}


def within(key, ref, ours):
    if ref is None or ours is None:
        return ref is None and ours is None
    if key.startswith("hue_"):
        d = abs(ref - ours) % 360
        return min(d, 360 - d) <= 10
    tol = max(abs(ref) * 0.10, ABS_TOL.get(key, 0))
    return abs(ref - ours) <= tol


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("reference")
    ap.add_argument("--times", required=True)
    ap.add_argument("--measure", required=True)
    ap.add_argument("--mask", default="0.37,0.39,0.63,0.60")
    ap.add_argument("--skip", default="", help="comma list: hue, sat")
    ap.add_argument("--json")
    a = ap.parse_args()
    spec = importlib.util.spec_from_file_location("measure_look", a.measure)
    ml = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ml)
    mask = [float(v) for v in a.mask.split(",")]
    skip = [s for s in a.skip.split(",") if s]
    keys = [k for k in KEYS if not any(
        (s == "hue" and k.startswith("hue_")) or (s == "sat" and k.startswith("sat")) for s in skip)]
    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        for t in [float(x) for x in a.times.split(",")]:
            fr = os.path.join(tmp, f"ref{t}.png")
            fo = os.path.join(tmp, f"our{t}.png")
            for src, dst in ((a.reference, fr), (a.video, fo)):
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", src,
                                "-frames:v", "1", dst], check=True)
            r = ml.measure(fr, (768, 432), mask)
            o = ml.measure(fo, (768, 432), mask)
            for k in keys:
                if r[k] is None or o[k] is None:
                    diff = None
                elif k.startswith("hue_"):  # shortest way round the colour wheel
                    diff = round((o[k] - r[k] + 180) % 360 - 180, 1)
                else:
                    diff = round(o[k] - r[k], 4)
                rows.append({"t": t, "measure": k, "ref": r[k], "ours": o[k],
                             "diff": diff,
                             "within": within(k, r[k], o[k])})
    n_ok = sum(1 for x in rows if x["within"])
    print(f"{n_ok}/{len(rows)} measures within target")
    cur = None
    for x in rows:
        if x["t"] != cur:
            cur = x["t"]
            print(f"\n t = {cur} s")
        flag = "ok " if x["within"] else "OUT"
        print(f"   {flag} {x['measure']:18} ref {str(x['ref']):>9}  ours {str(x['ours']):>9}  diff {str(x['diff']):>9}")
    if a.json:
        with open(a.json, "w") as fh:
            json.dump({"video": a.video, "within": n_ok, "total": len(rows), "rows": rows}, fh, indent=1)


if __name__ == "__main__":
    main()
