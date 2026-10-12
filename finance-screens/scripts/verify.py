#!/usr/bin/env python3
"""Verification for the Finance Screens previews (steps 1-6 of the brief).

usage: python3 -I scripts/verify.py <compositionId> <fileName>
"""
import hashlib, json, subprocess, sys, os
import numpy as np
from PIL import Image

ID, FILE = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
mp4 = f"renders/{FILE}.mp4"
fr = f"out/frames/{ID}"
res = {"id": ID}

# Step 1: ffprobe
out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
    "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
    "-show_entries", "format=duration", "-of", "json", mp4],
    capture_output=True, text=True).stdout
j = json.loads(out)
streams = j["streams"]
v = [s for s in streams if s["codec_type"] == "video"][0]
audio = [s for s in streams if s["codec_type"] == "audio"]
dur = float(j["format"]["duration"])
res["probe"] = dict(w=v["width"], h=v["height"], fps=v["r_frame_rate"], codec=v["codec_name"],
                    pix=v["pix_fmt"], audio=len(audio), duration=dur)
res["step1"] = (v["width"] == 1280 and v["height"] == 720 and v["r_frame_rate"] == "30/1"
                and v["codec_name"] == "h264" and v["pix_fmt"] == "yuv420p" and not audio
                and abs(dur - 20.0) < 0.001)

def load(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(np.int16)

# Step 2: loop (frame 0 vs frame 600 of the 601-frame render)
a, b = load(f"{fr}/element-000.png"), load(f"{fr}/element-600.png")
res["step2_maxdiff"] = int(np.abs(a - b).max())
# Seam continuity: the 599 -> 600(=0) step must look like an ordinary step.
def mad(i, j):
    return float(np.abs(load(f"{fr}/element-{i:03d}.png") - load(f"{fr}/element-{j:03d}.png")).mean())
seam = mad(599, 600)
typical = [mad(k, k + 1) for k in (100, 200, 299, 400, 500, 598)]
res["seam_step"] = round(seam, 3)
res["typical_steps"] = [round(x, 3) for x in typical]
res["step2"] = res["step2_maxdiff"] == 0 and seam <= 2.0 * max(typical) + 0.5
# Step 3: cold frame 300 vs full-render frame 300 (bytes and pixels)
fa, fb = f"{fr}/element-300.png", f"out/cold/{ID}_300.png"
ha = hashlib.sha256(open(fa, "rb").read()).hexdigest()
hb = hashlib.sha256(open(fb, "rb").read()).hexdigest()
res["step3_bytes_equal"] = ha == hb
res["step3_pixel_maxdiff"] = int(np.abs(load(fa) - load(fb)).max())
res["step3"] = res["step3_bytes_equal"]
res["frames"] = len(os.listdir(fr))
print(json.dumps(res))
