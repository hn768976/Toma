"""Verification checks for the rendered previews (steps 1-4 of the brief).

usage: python3 scripts/checks.py <file> [<file> ...]   (file = output name, e.g. CodeTowers_Cyan)
Needs: out/previews/<file>.mp4, out/frames/<file>/, out/checks/<file>_still<N>.png,
       out/checks/<file>_loop0.png and _loop<frames>.png (for loops).
"""
import json, subprocess, sys, hashlib
from PIL import Image
import numpy as np

STORY = {"FibreWorldMap_Story"}

def ffprobe(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
        "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt:format=duration",
        "-of", "json", path])
    return json.loads(out)

def pixels(path):
    return np.asarray(Image.open(path).convert("RGB"))

def frame_file(file, n):
    import os
    d = f"out/frames/{file}"
    names = sorted(n for n in os.listdir(d) if n.endswith(".png"))
    return f"{d}/{names[n]}"

def banding(file):
    # Read a frame from the encoded mp4 and look at vertical luminance profiles.
    t = "6" if file in STORY else "10"
    png = f"out/checks/{file}_mp4.png"
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-ss", t, "-i", f"out/previews/{file}.mp4", "-frames:v", "1", png])
    a = pixels(png).astype(float)
    lum = a @ np.array([0.2126, 0.7152, 0.0722])
    res = []
    for x in (160, 640, 1120):
        prof = lum[:, x - 8:x + 8].mean(axis=1)          # 16-px wide average
        steps = np.abs(np.diff(prof))
        col = np.round(lum[:, x]).astype(int)
        run, best = 1, 1
        for i in range(1, len(col)):
            run = run + 1 if col[i] == col[i - 1] and col[i] > 6 else 1
            best = max(best, run)
        res.append({"x": x, "max_step_16px_avg": round(float(steps.max()), 2),
                    "median_step": round(float(np.median(steps)), 3),
                    "longest_flat_run_px": best})
    return res

for file in sys.argv[1:]:
    rep = {"file": file}
    p = ffprobe(f"out/previews/{file}.mp4")
    v = [s for s in p["streams"] if s["codec_type"] == "video"][0]
    audio = [s for s in p["streams"] if s["codec_type"] == "audio"]
    dur = float(p["format"]["duration"])
    want = 12.0 if file in STORY else 20.0
    rep["step1"] = {"w": v["width"], "h": v["height"], "fps": v["r_frame_rate"], "codec": v["codec_name"],
                    "pix_fmt": v["pix_fmt"], "audio_streams": len(audio), "duration": dur,
                    "pass": v["width"] == 1280 and v["height"] == 720 and v["r_frame_rate"] == "30/1"
                    and v["codec_name"] == "h264" and v["pix_fmt"] == "yuv420p" and not audio and abs(dur - want) < 0.05}
    if file not in STORY:
        a, b = pixels(f"out/checks/{file}_loop0.png"), pixels(f"out/checks/{file}_loop600.png")
        rep["step2_loop_identical"] = bool((a == b).all())
    n = 180 if file in STORY else 300
    s = f"out/checks/{file}_still{n}.png"
    f = frame_file(file, n)
    rep["step3"] = {"pixels_identical": bool((pixels(s) == pixels(f)).all()),
                    "png_bytes_identical": hashlib.md5(open(s, "rb").read()).hexdigest() == hashlib.md5(open(f, "rb").read()).hexdigest()}
    rep["step4_banding"] = banding(file)
    print(json.dumps(rep))
