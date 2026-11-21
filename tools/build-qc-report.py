#!/usr/bin/env python3
"""build-qc-report.py - assembles deliverables/QC-report.md from the measured artefacts.

usage: tools/build-qc-report.py <notes-dir>
Reads: <notes-dir>/*.md|txt (hand-written analysis and review notes), deliverables/qc/*-verify.json,
deliverables/qc/*-look.md, tools/render-times.txt.
"""
import json
import os
import sys

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
notes = sys.argv[1]
qc = os.path.join(root, "deliverables", "qc")


def read(path, default=""):
    try:
        with open(path) as fh:
            return fh.read().strip()
    except FileNotFoundError:
        return default


VIDEOS = [
    ("01-V1-hazard-barrels", "A", 250, 8.341667),
    ("02-V2-hazard-barrels", "A", 250, 8.341667),
    ("03-V1-memory-chips", "B", 450, 15.015),
    ("04-V2-memory-chips", "B", 450, 15.015),
]

out = []
w = out.append
w("# QC report – two references → four videos\n")
w(read(os.path.join(notes, "summary.md")))
w("")
w(read(os.path.join(notes, "analysis.md")))
w("")

# ---- look development ------------------------------------------------------------
w("## 2. Look development (step 4A)\n")
w(read(os.path.join(notes, "lookdev-intro.md")))
w("")
for tag, name, final in (("A", "hazard-barrels", "lookA-final.txt"), ("B", "memory-chips", "lookB-final.txt")):
    w(f"### {name}: look-dev stills against the reference\n")
    w(f"Side-by-side images (reference | ours | difference ×2): `{name}/lookdev/compare-start.png`, `compare-middle.png`, `compare-end.png` (also copied to `deliverables/qc/lookdev/{name}-compare-*.png`).\n")
    txt = read(os.path.join(notes, final))
    moment = None
    rows = {}
    order = []
    for line in txt.splitlines():
        if line.startswith("=="):
            moment = line.replace("==", "").strip()
            continue
        if line.startswith("--") or not line.strip():
            if line.startswith("--") and moment:
                rows.setdefault("__score__", {})[moment] = line.replace("--", "").strip()
            continue
        parts = line.split()
        key = parts[0]
        if key not in rows:
            rows[key] = {}
            order.append(key)
        # key ref X mine Y diff [unit] status
        ref, mine = parts[2], parts[4]
        status = parts[-1]
        diff = " ".join(parts[5:-1])
        rows[key][moment] = (ref, mine, diff, status)
    moments = ["start", "middle", "end"]
    w("| measure | " + " | ".join(f"{m}: ref | ours | diff" for m in moments) + " |")
    w("|---|" + "---|---|---|" * 3)
    for k in order:
        cells = []
        for m in moments:
            r = rows[k].get(m)
            if r is None:
                cells += ["–", "–", "–"]
            else:
                mark = "" if r[3] == "ok" else " ✗"
                cells += [r[0], r[1], r[2] + mark]
        w(f"| {k} | " + " | ".join(cells) + " |")
    sc = rows.get("__score__", {})
    w("\nWithin target: " + "; ".join(f"{m} {sc.get(m, '?')}" for m in moments) + ". ✗ marks a value outside ±10% (hue ±10°).\n")
    w(read(os.path.join(notes, f"look{tag}-rounds.md")))
    w("")

# ---- step 8 checks ---------------------------------------------------------------
w("## 3. Verification (step 8)\n")
w("### A. Technical checks\n")
w("| # | check | " + " | ".join(v[0] for v in VIDEOS) + " |")
w("|---|---|" + "---|" * len(VIDEOS))
ver = {}
for v, *_ in VIDEOS:
    try:
        ver[v] = json.load(open(os.path.join(qc, f"{v}-verify.json")))
    except FileNotFoundError:
        ver[v] = None


def cell(v, fn):
    d = ver[v]
    return "not run" if d is None else fn(d)


def yn(b):
    return "pass" if b else "**FAIL**"


rowsdef = [
    ("1", "resolution", lambda d: f"{d['spec']['width']}×{d['spec']['height']} – {yn(d['checks']['1920x1080'])}"),
    ("1", "codec / pixel format", lambda d: f"{d['spec']['codec']} / {d['spec']['pix_fmt']} – {yn(d['checks']['h264'] and d['checks']['yuv420p'])}"),
    ("1", "frame rate", lambda d: f"{d['spec']['r_frame_rate']} – {yn(d['checks']['30/1 fps'])}"),
    ("1", "frame count", lambda d: f"{d['spec']['nb_read_frames']} – {yn(d['checks']['frame count'])}"),
    ("1", "audio streams", lambda d: f"{d['spec']['audio_streams']} – {yn(d['checks']['no audio'])}"),
    ("2", "duration vs reference", lambda d: f"{d['spec']['duration']:.3f} s ({d['duration_diff_s']:+.4f} s) – {yn(d['checks']['duration within one frame'])}"),
    ("3", "full decode", lambda d: yn(d['checks']['decodes cleanly'])),
    ("4", "black frames", lambda d: f"{len(d['scan']['black_frames'])} (frame mean {d['scan']['mean_min']:.1f}–{d['scan']['mean_max']:.1f} of 255) – {yn(d['checks']['no black frames'])}"),
    ("4", "frozen / duplicated frames", lambda d: f"{len(d['scan']['frozen_pairs'])} (frame-to-frame change {d['scan']['frame_diff_min']:.2f}–{d['scan']['frame_diff_max']:.2f}) – {yn(d['checks']['no frozen frames'])}"),
    ("4", "brightness jumps / flicker", lambda d: f"largest step {d['scan']['max_brightness_step']:.3f} of 255 – {yn(d['checks']['no brightness jumps'])}"),
]
for num, name, fn in rowsdef:
    w(f"| {num} | {name} | " + " | ".join(cell(v[0], fn) for v in VIDEOS) + " |")
w("")
w(read(os.path.join(notes, "checks-extra.md")))
w("")
w("### Look over time (check 7)\n")
w(read(os.path.join(notes, "look-over-time-intro.md")))
w("")
for v, *_ in VIDEOS:
    w(f"#### {v}\n")
    w(read(os.path.join(qc, f"{v}-look.md"), "_not measured_"))
    w("")
w("### B. Visual match by separate agents (checks 10 and 11)\n")
w(read(os.path.join(notes, "match-notes.md")))
w("")
w(read(os.path.join(notes, "tail.md")))
w("")
with open(os.path.join(root, "deliverables", "QC-report.md"), "w") as fh:
    fh.write("\n".join(out) + "\n")
print("wrote deliverables/QC-report.md,", sum(len(x) for x in out), "chars")
