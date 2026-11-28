#!/usr/bin/env python3
"""Measure the look of 5 frames of a final video against the same moments of its reference (step 8A, item 7).

usage: look-over-time.py <video.mp4> <reference.mp4> <project-dir> <out.json> [--skip hue,saturation,...]
"""
import json
import os
import subprocess
import sys
import tempfile

video, ref, project, out = sys.argv[1:5]
skip = sys.argv[sys.argv.index("--skip") + 1] if "--skip" in sys.argv else ""
script = os.path.join(project, "scripts", "measure-look.py")
REGIONS = {
    "conveyor-parcels": "--mask 0.37,0.40,0.63,0.61 --near 0.05,0.78,0.95,0.98 --far 0.02,0.02,0.98,0.26",
    "mars-dome": "--mask 0.37,0.40,0.63,0.61 --near 0.05,0.72,0.75,0.98 --far 0.02,0.02,0.98,0.2",
}[os.path.basename(os.path.normpath(project))]
times = [0.0, 2.6, 5.2, 7.8, 10.3]
tmp = tempfile.mkdtemp()
result = {"video": video, "times": times, "skip": skip, "frames": []}
for t in times:
    a = os.path.join(tmp, f"ref-{t}.png")
    b = os.path.join(tmp, f"mine-{t}.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", ref, "-frames:v", "1", a], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", video, "-frames:v", "1", b], check=True)
    j = os.path.join(tmp, f"{t}.json")
    cmd = f"python3 {script} compare {a} {b} {REGIONS} --quiet --json {j}" + (f" --skip {skip}" if skip else "")
    subprocess.run(cmd, shell=True, check=True)
    result["frames"].append({"t": t, "rows": json.load(open(j))["rows"]})
ok = sum(r["status"] == "ok" for f in result["frames"] for r in f["rows"])
fail = sum(r["status"] == "FAIL" for f in result["frames"] for r in f["rows"])
skipn = sum(r["status"] == "skip" for f in result["frames"] for r in f["rows"])
result["summary"] = {"within": ok, "outside": fail, "skipped": skipn}
# frame-to-frame stability of the look: the same measure must not jump between sampled moments beyond what the reference does
json.dump(result, open(out, "w"), indent=1)
print(f"{'measure':22s}" + "".join(f"{('t=' + str(t)):>20s}" for t in times))
for i, row in enumerate(result["frames"][0]["rows"]):
    line = f"{row['measure']:22s}"
    for f in result["frames"]:
        r = f["rows"][i]
        mark = {"ok": " ", "FAIL": "x", "skip": "-"}[r["status"]]
        line += f"{r['ref']:9.2f}/{r['mine']:7.2f} {mark} "
    print(line)
print(result["summary"])
