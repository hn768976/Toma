#!/usr/bin/env python3
"""Verify loop: file checks, loop check, cold-frame determinism, banding,
contact sheet and motion smoothness for one composition.
usage: python3 scripts/verify.py <CompositionId> <OutputName> [bundle]"""
import hashlib, json, subprocess, sys, os
import numpy as np
from PIL import Image

ID, NAME = sys.argv[1], sys.argv[2]
BUNDLE = sys.argv[3] if len(sys.argv) > 3 else "out/bundle"
OUT = f"out/verify/{NAME}"; os.makedirs(OUT, exist_ok=True)
MP4 = f"out/previews/{NAME}.mp4"
FR = f"out/frames/{NAME}"
SCALE = "0.3333333333333333"
res = {"name": NAME}

def run(cmd):
    return subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True).stdout

def still(frame, path, loop=False):
    props = " --props='{\"loopCheck\":true}'" if loop else ""
    run(f"npx remotion still {BUNDLE} {ID} {path} --frame={frame} --scale={SCALE} --log=error{props}")

# Step 1: file checks
p = json.loads(run(f"ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt -show_entries format=duration -of json {MP4}"))
st = p["streams"]
v = [s for s in st if s["codec_type"] == "video"][0]
res["step1"] = {
    "width": v["width"], "height": v["height"], "fps": v["r_frame_rate"], "codec": v["codec_name"],
    "pix_fmt": v["pix_fmt"], "audio_streams": sum(s["codec_type"] == "audio" for s in st),
    "duration": float(p["format"]["duration"]),
}
s1 = res["step1"]
res["step1"]["pass"] = (s1["width"], s1["height"], s1["fps"], s1["codec"], s1["pix_fmt"], s1["audio_streams"]) == (1280, 720, "30/1", "h264", "yuv420p", 0) and abs(s1["duration"] - 20.0) < 1e-6

# Step 2: loop check (601-frame composition, frames 0 and 600, both cold)
still(0, f"{OUT}/loop_0.png", True)
still(600, f"{OUT}/loop_600.png", True)
a = np.asarray(Image.open(f"{OUT}/loop_0.png").convert("RGB")).astype(int)
b = np.asarray(Image.open(f"{OUT}/loop_600.png").convert("RGB")).astype(int)
res["step2"] = {"max_abs_diff": int(np.abs(a - b).max()), "pass": bool((a == b).all())}

# Step 3: frame 300 cold vs frame 300 of the full render
still(300, f"{OUT}/cold_300.png")
full = f"{FR}/element-300.png"
ha = hashlib.sha256(open(f"{OUT}/cold_300.png", "rb").read()).hexdigest()
hb = hashlib.sha256(open(full, "rb").read()).hexdigest()
pa = np.asarray(Image.open(f"{OUT}/cold_300.png").convert("RGB")); pb = np.asarray(Image.open(full).convert("RGB"))
res["step3"] = {"file_bytes_equal": ha == hb, "pixels_equal": bool((pa == pb).all()), "pass": ha == hb}

# Step 4: banding probe on a frame decoded from the encoded mp4
run(f"ffmpeg -v error -y -ss 10 -i {MP4} -frames:v 1 {OUT}/mp4_frame.png")
img = np.asarray(Image.open(f"{OUT}/mp4_frame.png").convert("RGB")).astype(float)
lum = img @ np.array([0.2126, 0.7152, 0.0722])
probes = {}
for name, (y0, y1, x0, x1) in json.loads(os.environ.get("PROBES", "{}")).items():
    reg = lum[y0:y1, x0:x1]
    # A banded gradient shows long flat runs separated by 1-level jumps once
    # noise is averaged out; measure the column profile after averaging rows.
    prof = reg.mean(axis=0)
    d = np.abs(np.diff(prof))
    q = np.round(reg).astype(int)
    runs = []
    for row in q[:: max(1, (y1 - y0) // 8)]:
        r = 1; best = 1
        for i in range(1, len(row)):
            r = r + 1 if row[i] == row[i - 1] else 1
            best = max(best, r)
        runs.append(best)
    probes[name] = {
        "mean": round(float(reg.mean()), 2), "min": int(q.min()), "max": int(q.max()),
        "profile_max_step": round(float(d.max()), 3), "longest_flat_run_px": int(np.median(runs)),
        "profile": [round(float(x), 2) for x in prof[:: max(1, len(prof) // 24)]],
    }
res["step4"] = probes

# Step 5: contact sheet (five evenly spaced frames)
tiles = []
for t in [0, 4, 8, 12, 16]:
    run(f"ffmpeg -v error -y -ss {t} -i {MP4} -frames:v 1 -vf scale=512:288 {OUT}/cs_{t}.png")
    tiles.append(Image.open(f"{OUT}/cs_{t}.png"))
sheet = Image.new("RGB", (512 * 5, 288))
for i, t in enumerate(tiles): sheet.paste(t, (i * 512, 0))
sheet.save(f"{OUT}/contact_sheet.png")

# Step 6: motion smoothness around frame 300 (2 s, from the full PNG render)
run(f"ffmpeg -v error -y -start_number 270 -framerate 30 -i {FR}/element-%03d.png -frames:v 60 -c:v libx264 -crf 16 -pix_fmt yuv420p {OUT}/motion_270_329.mp4")
diffs = []
prev = None
for f in range(270, 330):
    x = np.asarray(Image.open(f"{FR}/element-{f:03d}.png").convert("L")).astype(float)
    if prev is not None: diffs.append(float(np.abs(x - prev).mean()))
    prev = x
diffs = np.array(diffs)
res["step6"] = {"mean_frame_diff": round(float(diffs.mean()), 3), "max_frame_diff": round(float(diffs.max()), 3),
                "max_over_median": round(float(diffs.max() / max(1e-6, np.median(diffs))), 2)}
json.dump(res, open(f"{OUT}/verify.json", "w"), indent=1)
print(json.dumps(res, indent=1))
