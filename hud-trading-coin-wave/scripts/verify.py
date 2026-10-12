#!/usr/bin/env python3
"""Verify loop: file checks, loop check (0 vs 600), cold-start determinism
(frame 300), banding probes from the encoded mp4, and contact sheets.

usage: scripts/verify.py [comp-id ...]   (expects build/ and out/previews/)
"""
import hashlib, json, os, shutil, subprocess, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
SCALE = "0.3333333333333333"
COMPS = [l.strip().strip('"').split(":") for l in open("scripts/comps.sh") if l.strip().startswith('"')]
sel = sys.argv[1:]
os.makedirs("out/check", exist_ok=True)
os.makedirs("out/sheets", exist_ok=True)
report = {}

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(r.stdout[-3000:], r.stderr[-3000:])
        raise SystemExit(f"failed: {' '.join(cmd)}")
    return r.stdout

def pix(path):
    return np.asarray(Image.open(path).convert("RGB"))

for cid, stem in COMPS:
    if sel and cid not in sel:
        continue
    res = {}
    mp4 = f"out/previews/{stem}.mp4"
    # ---- step 1: file checks
    probe = json.loads(run(["ffprobe", "-v", "error", "-show_entries",
        "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt:format=duration", "-of", "json", mp4]))
    streams = probe["streams"]
    v = [s for s in streams if s["codec_type"] == "video"][0]
    res["file"] = dict(size=f'{v["width"]}x{v["height"]}', fps=v["r_frame_rate"], codec=v["codec_name"],
        pix_fmt=v["pix_fmt"], audio=any(s["codec_type"] == "audio" for s in streams),
        duration=float(probe["format"]["duration"]))
    f = res["file"]
    res["file_ok"] = (f["size"] == "1280x720" and f["fps"] == "30/1" and f["codec"] == "h264"
        and f["pix_fmt"] == "yuv420p" and not f["audio"] and abs(f["duration"] - 20.0) < 1e-3)

    # ---- step 2 + 3: full out-of-order PNG render of the 601-frame version
    seq = f"out/check/seq-{stem}"
    shutil.rmtree(seq, ignore_errors=True)
    run(["npx", "remotion", "render", "build", cid, seq, "--sequence", "--image-format=png",
         f"--scale={SCALE}", "--gl=angle", "--concurrency=4", '--props={"loopCheck":true}'])
    files = sorted(os.listdir(seq))
    assert len(files) == 601, len(files)
    f0, f600, f300 = (os.path.join(seq, files[i]) for i in (0, 600, 300))
    a0, a600 = pix(f0), pix(f600)
    res["loop_identical"] = bool(np.array_equal(a0, a600))
    res["loop_maxdiff"] = int(np.abs(a0.astype(int) - a600.astype(int)).max())
    # seam smoothness: mean abs diff 599→600(=0) vs typical neighbouring frames
    d = lambda i, j: float(np.abs(pix(os.path.join(seq, files[i])).astype(int) - pix(os.path.join(seq, files[j])).astype(int)).mean())
    res["seam_diff_599_600"] = round(d(599, 600), 3)
    res["typical_diff_299_300"] = round(d(299, 300), 3)
    cold = f"out/check/{stem}-300-cold.png"
    run(["npx", "remotion", "still", "build", cid, cold, "--frame=300", f"--scale={SCALE}", "--gl=angle"])
    res["frame300_identical"] = bool(np.array_equal(pix(cold), pix(f300)))
    shutil.copy(f300, f"out/check/{stem}-300-full.png")
    # step 6 material: 2s around frame 300 kept as PNGs for stepping
    keep = f"out/check/motion-{stem}"
    shutil.rmtree(keep, ignore_errors=True)
    os.makedirs(keep)
    for i in range(270, 331):
        shutil.copy(os.path.join(seq, files[i]), os.path.join(keep, f"{i:04d}.png"))
    shutil.rmtree(seq)

    # ---- step 4: banding probe from the encoded mp4 (frame 150)
    probe_png = f"out/check/{stem}-mp4-150.png"
    run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", "select=eq(n\\,150)", "-frames:v", "1", probe_png])
    res["mp4_frame"] = probe_png

    # ---- step 5: contact sheet, 5 evenly spaced frames from the mp4
    sheet = f"out/sheets/{stem}.png"
    run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf",
         "select=eq(n\\,0)+eq(n\\,120)+eq(n\\,240)+eq(n\\,360)+eq(n\\,480),scale=640:360,tile=5x1", "-frames:v", "1", sheet])
    report[stem] = res
    print(stem, json.dumps(res))

old = json.load(open("out/check/report.json")) if os.path.exists("out/check/report.json") else {}
old.update(report)
json.dump(old, open("out/check/report.json", "w"), indent=1)
