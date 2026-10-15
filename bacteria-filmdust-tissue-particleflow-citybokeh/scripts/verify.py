#!/usr/bin/env python3
"""Verification checks for one composition (steps 1-4 of the brief).

  python3 scripts/verify.py <CompositionId> <OutName> [--black]

1. ffprobe: 1280x720, 30/1, h264, yuv420p, no audio, 20.0 s
2. loop: renders frames 0 and 600 of the 601-frame variant (loopCheck prop) and
   compares pixels
3. determinism: cold-start `remotion still` of frame 300 vs the PNG from the
   full render, byte for byte
4. --black: samples 50 points between dust in the decoded mp4 (must be 0 +-1)
"""
import hashlib, json, os, subprocess, sys
import numpy as np
from PIL import Image

cid, name = sys.argv[1], sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(root)
B = os.environ.get("BUNDLE", "renders/bundle")
vdir = f"renders/verify/{name}"
os.makedirs(vdir, exist_ok=True)
mp4 = f"renders/previews/{name}.mp4"
res = {"name": name}

def sh(cmd):
    return subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True).stdout

def still(frame, out, props=None):
    p = f" --props='{json.dumps(props)}'" if props else ""
    sh(f"npx remotion still {B} {cid} {out} --frame={frame} --scale=0.3333333333333333 --image-format=png --gl=angle --log=error{p}")

# 1 ffprobe
probe = sh(f"ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt -show_entries format=duration -of json {mp4}")
pj = json.loads(probe)
st = pj["streams"]
v = [s for s in st if s["codec_type"] == "video"][0]
res["ffprobe"] = dict(codec=v["codec_name"], w=v["width"], h=v["height"], fps=v["r_frame_rate"], pix=v["pix_fmt"],
                      audio=any(s["codec_type"] == "audio" for s in st), duration=float(pj["format"]["duration"]))
f = res["ffprobe"]
res["step1_pass"] = (f["codec"] == "h264" and f["w"] == 1280 and f["h"] == 720 and f["fps"] == "30/1"
                     and f["pix"] == "yuv420p" and not f["audio"] and abs(f["duration"] - 20.0) < 0.01)

# 2 loop check (601-frame variant)
still(0, f"{vdir}/loop_f000.png", {"loopCheck": True})
still(600, f"{vdir}/loop_f600.png", {"loopCheck": True})
a = np.asarray(Image.open(f"{vdir}/loop_f000.png").convert("RGB")).astype(int)
b = np.asarray(Image.open(f"{vdir}/loop_f600.png").convert("RGB")).astype(int)
res["step2_loop_identical"] = bool((a == b).all())
res["step2_maxdiff"] = int(np.abs(a - b).max())

# 3 determinism: cold-start still of frame 300 vs full render frame 300
still(300, f"{vdir}/cold_f300.png")
h1 = hashlib.sha256(open(f"{vdir}/cold_f300.png", "rb").read()).hexdigest()
h2 = hashlib.sha256(open(f"renders/frames/{name}/element-300.png", "rb").read()).hexdigest()
res["step3_bytes_identical"] = h1 == h2
if h1 != h2:
    c = np.asarray(Image.open(f"{vdir}/cold_f300.png").convert("RGB")).astype(int)
    d = np.asarray(Image.open(f"renders/frames/{name}/element-300.png").convert("RGB")).astype(int)
    res["step3_pixel_maxdiff"] = int(np.abs(c - d).max())

# decoded mp4 frame 300 (bt709 limited -> full-range RGB)
sh(f"ffmpeg -v error -y -i {mp4} -vf \"select=eq(n\\,300),scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24\" -frames:v 1 {vdir}/decoded_f300.png")

if "--black" in sys.argv:
    src = np.asarray(Image.open(f"renders/frames/{name}/element-300.png").convert("RGB")).astype(int)
    dec = np.asarray(Image.open(f"{vdir}/decoded_f300.png").convert("RGB")).astype(int)
    # points "between the dust": source pixel and its 7x7 neighbourhood exactly 0
    z = (src.sum(axis=2) == 0)
    from numpy.lib.stride_tricks import sliding_window_view
    zz = np.zeros_like(z)
    zz[3:-3, 3:-3] = sliding_window_view(z, (7, 7)).all(axis=(2, 3))
    ys, xs = np.nonzero(zz)
    rng = np.random.default_rng(42)
    idx = rng.choice(len(ys), size=min(50, len(ys)), replace=False)
    samples = [tuple(int(c) for c in dec[ys[i], xs[i]]) for i in idx]
    res["step4_black_samples"] = len(samples)
    res["step4_black_max"] = max(max(s) for s in samples)
    res["step4_black_pass"] = res["step4_black_max"] <= 1
    res["step4_source_black_exact"] = int(src[zz].max())
print(json.dumps(res))
with open(f"{vdir}/result.json", "w") as fh:
    json.dump(res, fh, indent=1)
