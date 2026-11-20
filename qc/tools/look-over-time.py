#!/usr/bin/env python3
"""look-over-time.py VIDEO REF OUT.md --times t1,t2,.. [--crop-aspect A] [--skip a,b] [--label L]
Step 8.7: measure-look on 5 frames of a final video and the same moments of its reference."""
import argparse, json, subprocess, tempfile, os, sys
ap = argparse.ArgumentParser(); ap.add_argument("video"); ap.add_argument("ref"); ap.add_argument("out")
ap.add_argument("--times", required=True); ap.add_argument("--crop-aspect", default="0"); ap.add_argument("--skip", default=""); ap.add_argument("--label", default="")
ap.add_argument("--measure", required=True)
a = ap.parse_args()
rows = {}; fails = []
d = tempfile.mkdtemp()
times = a.times.split(",")
for t in times:
    r = f"{d}/r-{t}.png"; o = f"{d}/o-{t}.png"; j = f"{d}/m-{t}.json"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", t, "-i", a.ref, "-frames:v", "1", r], check=True)
    f = round(float(t) * 30)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.video, "-vf", f"select=eq(n\\,{f})", "-frames:v", "1", o], check=True)
    cmd = ["python3", a.measure, r, o, "--json", j, "--quiet", "--crop-aspect", a.crop_aspect]
    if a.skip: cmd += ["--skip", a.skip]
    subprocess.run(cmd, check=True, capture_output=True)
    m = json.load(open(j)); fails.append(m["fails"])
    for k, rv, ov, diff, verdict in m["rows"]:
        rows.setdefault(k, []).append((rv, ov, diff, verdict))
with open(a.out, "w") as fh:
    fh.write(f"#### {a.label}\n\n")
    fh.write("| measure | " + " | ".join(f"{t}s ref / ours (diff)" for t in times) + " |\n")
    fh.write("|---|" + "---|" * len(times) + "\n")
    for k, v in rows.items():
        cells = []
        for rv, ov, diff, verdict in v:
            mark = "" if verdict == "ok" else (" (skipped)" if verdict == "skip" else " **x**")
            cells.append(f"{rv:.3f} / {ov:.3f} ({diff}){mark}")
        fh.write(f"| {k} | " + " | ".join(cells) + " |\n")
    fh.write("| **outside target** | " + " | ".join(f"{n} of {len(rows)}" for n in fails) + " |\n\n")
print(a.label, "outside target per frame:", fails)
