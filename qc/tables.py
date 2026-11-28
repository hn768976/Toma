#!/usr/bin/env python3
"""tables.py - print the QC tables (markdown) from the JSON files that
verify.py and look-over-time.py wrote.

Usage: python3 qc/tables.py specs  01.json 02.json 03.json 04.json
       python3 qc/tables.py look   lot-01.json [lot-02.json ...]
       python3 qc/tables.py lookdev path/to/look-measures.json moment1,moment2,moment3
"""
import json
import sys

SHOW = ["lum_p1", "lum_p5", "lum_p50", "lum_p95", "lum_p99", "pct_above_90",
        "pct_below_5", "sat_mean", "hue_shadows", "hue_midtones", "hue_highlights",
        "glow_r50", "glow_r25", "glow_r10", "contrast_top", "contrast_mid",
        "contrast_bottom", "contrast_centre", "contrast_edge", "grain_std_8bit",
        "detail_lap_var", "vignette_ratio"]


def f(v):
    if v is None:
        return "-"
    if isinstance(v, float):
        return f"{v:.3f}".rstrip("0").rstrip(".") if abs(v) < 100 else f"{v:.0f}"
    return str(v)


def specs(paths):
    rows = [json.load(open(p)) for p in paths]
    print("| File | Size | Codec | Pixel fmt | fps | Frames | Duration (s) | Reference (s) | Diff (s) | Audio | Decode | Black | Frozen | Flicker |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for r in rows:
        c = r["checks"]
        ok = lambda k: "pass" if c[k] else "FAIL"
        name = r["file"].split("/")[-1]
        print(f"| `{name}` | {r['width']}x{r['height']} | {r['codec']} | {r['pix_fmt']} | {r['r_frame_rate']} | "
              f"{r['nb_read_frames']} | {r['duration']:.4f} | {r.get('ref_duration', 0):.4f} | {r.get('duration_diff', 0):+.4f} | "
              f"{'none' if r['audio_streams'] == 0 else r['audio_streams']} | {ok('decodes_clean')} | {ok('no_black_frames')} | "
              f"{ok('no_frozen_frames')} | {ok('no_flicker')} |")


def look(paths):
    for p in paths:
        d = json.load(open(p))
        name = d["video"].split("/")[-1]
        times = sorted({r["t"] for r in d["rows"]})
        print(f"\n**`{name}`** - {d['within']} of {d['total']} values within target\n")
        print("| Measure | " + " | ".join(f"{t} s ref | ours | diff" for t in times) + " |")
        print("|---|" + "---|---|---|" * len(times))
        keys = []
        for r in d["rows"]:
            if r["measure"] not in keys:
                keys.append(r["measure"])
        idx = {(r["t"], r["measure"]): r for r in d["rows"]}
        for k in keys:
            cells = []
            for t in times:
                r = idx[(t, k)]
                mark = "" if r["within"] else " ✗"
                cells.append(f"{f(r['ref'])} | {f(r['ours'])} | {f(r['diff'])}{mark}")
            print(f"| {k} | " + " | ".join(cells) + " |")


def lookdev(path, moments):
    d = json.load(open(path))
    names = moments.split(",")
    print("| Measure | " + " | ".join(f"{n} ref | ours" for n in names) + " |")
    print("|---|" + "---|---|" * len(names))
    for k in SHOW:
        print(f"| {k} | " + " | ".join(f"{f(d[i * 2][k])} | {f(d[i * 2 + 1][k])}" for i in range(len(names))) + " |")


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "specs":
        specs(sys.argv[2:])
    elif mode == "look":
        look(sys.argv[2:])
    elif mode == "lookdev":
        lookdev(sys.argv[2], sys.argv[3])
