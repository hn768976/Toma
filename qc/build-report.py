#!/usr/bin/env python3
"""Assemble QC-report.md from the JSON written by the other qc/ scripts."""
import glob
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = os.path.join(ROOT, "qc", "results")
VIDEOS = [
    ("01-V1-conveyor-parcels", "conveyor-parcels", "V1-conveyor-parcels", "A"),
    ("02-V2-conveyor-parcels", "conveyor-parcels", "V2-conveyor-parcels", "A"),
    ("03-V1-mars-dome", "mars-dome", "V1-mars-dome", "B"),
    ("04-V2-mars-dome", "mars-dome", "V2-mars-dome", "B"),
]


def load(path):
    return json.load(open(path)) if os.path.exists(path) else None


def fmt(v, nd=2):
    return "–" if v is None else (f"{v:.{nd}f}" if isinstance(v, float) else str(v))


out = []
w = out.append
w("# QC report — two references → four videos\n")
w(open(os.path.join(ROOT, "qc", "report-static-summary.md")).read())
w(open(os.path.join(ROOT, "qc", "report-static-analysis.md")).read())

# ------------------------------------------------------------------ look tables
w("\n## 2. Look table (step 4A and step 8A-7)\n")
w("`scripts/measure-look.py` on five frames of each final 1080p video and the same moments of its reference "
  "(0.0, 2.6, 5.2, 7.8 and 10.3 s). Each cell is *reference / video*. Target: within ±10% (hue ±10°), "
  "with a small absolute floor for near-zero values (2 luminance points, 1 percentage point, 0.02 saturation, "
  "1% of frame height for glow radii, 0.25 code values of grain, 1.5 of detail, 0.05 of vignette ratio). "
  "**Bold** cells are outside the target; `skip` marks measures the Version 2 change affects. "
  "The watermark area of the reference is masked out of both frames.\n")
for name, proj, comp, _ in VIDEOS:
    d = load(os.path.join(R, f"look-{name}.json"))
    if not d:
        continue
    s = d["summary"]
    w(f"\n### {name}.mp4 — {s['within']} within target, {s['outside']} outside, {s['skipped']} skipped (of {s['within'] + s['outside'] + s['skipped']})\n")
    w("| measure | " + " | ".join(f"{t} s" for t in d["times"]) + " |")
    w("|---|" + "---|" * len(d["times"]))
    for i, row in enumerate(d["frames"][0]["rows"]):
        cells = []
        for f in d["frames"]:
            r = f["rows"][i]
            c = f"{r['ref']:.1f} / {r['mine']:.1f}" if abs(r["ref"]) >= 10 else f"{r['ref']:.2f} / {r['mine']:.2f}"
            if r["status"] == "FAIL":
                c = f"**{c}**"
            elif r["status"] == "skip":
                c = f"{c} `skip`"
            cells.append(c)
        w(f"| {row['measure']} | " + " | ".join(cells) + " |")
w("\nLook-development side-by-sides (reference | attempt | difference ×2) are in each project's `lookdev/` folder: "
  "`compare-start.png`, `compare-middle.png`, `compare-peak.png`.\n")
w(open(os.path.join(ROOT, "qc", "report-static-look-notes.md")).read())

# ------------------------------------------------------------------ technical checks
w("\n## 3. Technical checks (step 8A)\n")
w("| check | " + " | ".join(n for n, *_ in VIDEOS) + " |")
w("|---|" + "---|" * len(VIDEOS))
V = {n: load(os.path.join(R, f"verify-{n}.json")) for n, *_ in VIDEOS}
C = {n: load(os.path.join(R, c, "checks.json")) for n, _, c, _ in VIDEOS}


def row(label, fn):
    w(f"| {label} | " + " | ".join(fn(n) for n, *_ in VIDEOS) + " |")


def pf(b):
    return "pass" if b else "**FAIL**"


row("1. resolution", lambda n: f"{V[n]['width']}×{V[n]['height']}" if V[n] else "–")
row("1. codec / pixel format", lambda n: f"{V[n]['codec']} / {V[n]['pix_fmt']}" if V[n] else "–")
row("1. frame rate (r / avg)", lambda n: f"{V[n]['r_frame_rate']} / {V[n]['avg_frame_rate']}" if V[n] else "–")
row("1. frame count", lambda n: str(V[n]["frames"]) if V[n] else "–")
row("1. audio streams", lambda n: str(V[n]["audio_streams"]) if V[n] else "–")
row("1. specs", lambda n: pf(V[n]["checks"]["1_specs"]) if V[n] else "–")
row("2. duration (video / reference)", lambda n: f"{V[n]['duration']:.4f} s / {V[n]['ref_duration']:.4f} s" if V[n] else "–")
row("2. difference", lambda n: f"{V[n]['duration_diff'] * 1000:+.1f} ms — {pf(V[n]['checks']['2_duration_within_one_frame'])}" if V[n] else "–")
row("3. full decode (`ffmpeg -v error … -f null -`)", lambda n: pf(V[n]["checks"]["3_decodes_cleanly"]) if V[n] else "–")
row("4. black / blank frames", lambda n: f"{V[n]['black_frames']} — {pf(V[n]['checks']['4_no_black_frames'])}" if V[n] else "–")
row("4. duplicated frames", lambda n: f"{V[n]['duplicate_frames']} — {pf(V[n]['checks']['4_no_duplicate_frames'])}" if V[n] else "–")
row("4. mean brightness range (0–255)", lambda n: f"{V[n]['mean_min']:.1f}–{V[n]['mean_max']:.1f}" if V[n] else "–")
row("4. frame-to-frame difference (min / median / max)", lambda n: f"{V[n]['frame_diff_min']:.2f} / {V[n]['frame_diff_median']:.2f} / {V[n]['frame_diff_max']:.2f}" if V[n] else "–")
row("4. largest single-frame brightness pop", lambda n: f"{V[n]['brightness_pop_max']:.2f} — {pf(V[n]['checks']['4_no_flicker'])}" if V[n] else "–")
row("5. loop: frame N vs frame 0 (lossless PNG)", lambda n: (f"{C[n]['loop_differing_pixels']} differing pixels — {pf(C[n]['pass_loop'])}") if C[n] else "–")
row("5. loop: last→first step in the MP4 vs largest normal step", lambda n: f"{V[n]['last_to_first_diff']:.2f} vs {V[n]['frame_diff_max']:.2f} — {pf(V[n]['checks']['5_loop_step_normal'])}" if V[n] else "–")
row("6. determinism: cold middle frame vs sequential render", lambda n: (("byte-identical" if C[n]["determinism_bytes_identical"] else f"max diff {C[n]['determinism_max_abs_diff']}") + f" — {pf(C[n]['pass_determinism'])}") if C[n] else "–")
row("7. look over time", lambda n: (lambda d: f"{d['summary']['within']} / {d['summary']['within'] + d['summary']['outside']} within target" if d else "–")(load(os.path.join(R, f"look-{n}.json"))))
w(open(os.path.join(ROOT, "qc", "report-static-tail.md")).read())

open(os.path.join(ROOT, "QC-report.md"), "w").write("\n".join(out) + "\n")
print("wrote QC-report.md", len(out), "lines")
