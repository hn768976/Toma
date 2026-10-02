#!/usr/bin/env python3
"""Verify the 720p previews (run after scripts/render-previews.sh).

Steps (mirrors the brief's verify loop):
  1  ffprobe: 1280x720, 30/1, h264, yuv420p, no audio, exact duration
  2  loop: frames 0 and N rendered as stills with loopCheck=true -> identical
  3  black: Light Trails area above the curve, decoded from the mp4, <= 1
  4  determinism: frame 200 rendered alone from a cold start == frame 200 of
     the full render (PNG bytes and pixels)
  5  banding: decoded mp4 frames, scan dark gradients/glows for flat steps
Writes a report to renders/verify.txt. Needs: ffmpeg, ffprobe, numpy, Pillow.
"""
import hashlib
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
SCALE = "0.3333333333333333"
COMPS = {
    "CloudServers-Blue": (600, True),
    "CloudServers-Violet": (600, True),
    "LightTrails-Blue": (600, True),
    "LightTrails-RedOrange": (600, True),
    "GoldBarChart-Rising": (360, False),
    "GoldBarChart-Falling": (360, False),
    "TradeWar-USA-China": (450, False),
    "FileWave-Documents": (600, True),
    "FileWave-Folders": (600, True),
}
only = sys.argv[1:]
out = []


def log(s=""):
    print(s)
    out.append(s)


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def still(comp, frame, path, props=None):
    cmd = ["npx", "remotion", "still", "build", comp, path, f"--frame={frame}", f"--scale={SCALE}", "--gl=angle", "--log=error"]
    if props:
        cmd.append("--props=" + json.dumps(props))
    run(cmd)


def mp4_frame(name, frame):
    p = f"out/verify/{name}_mp4_{frame}.png"
    run(["ffmpeg", "-v", "error", "-y", "-i", f"renders/{name}.mp4", "-vf", f"select=eq(n\\,{frame})", "-vsync", "0", "-frames:v", "1", p])
    return np.asarray(Image.open(p).convert("RGB")).astype(int)


def seq_frame(name, frame):
    d = f"renders/frames/{name}"
    files = sorted(os.listdir(d))
    return os.path.join(d, files[frame])


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def banding(img, label):
    """Smooth dark ramps: count runs of identical luma >= 8px along rows where
    the local gradient is gentle and luma < 80. Report the longest step and the
    largest jump between neighbours inside those ramps."""
    y = (0.2126 * img[..., 0] + 0.7152 * img[..., 1] + 0.0722 * img[..., 2])
    dark = y < 80
    d = np.abs(np.diff(y, axis=1))
    gentle = (d <= 3) & dark[:, 1:] & dark[:, :-1]
    big = float(d[gentle].max()) if gentle.any() else 0.0
    # longest flat run inside gentle dark regions that are not pure black
    longest = 0
    for r in range(0, img.shape[0], 8):
        row = y[r]
        run_len, best = 1, 1
        for i in range(1, len(row)):
            if row[i] == row[i - 1] and 3 < row[i] < 80:
                run_len += 1
                best = max(best, run_len)
            else:
                run_len = 1
        longest = max(longest, best)
    log(f"   {label}: dark-ramp max neighbour step {big:.1f} levels; longest flat run {longest}px")
    return longest


os.makedirs("out/verify", exist_ok=True)
fails = []
for comp, (frames, loops) in COMPS.items():
    if only and comp not in only:
        continue
    name = comp.replace("-", "_")
    log(f"== {comp} ({name}.mp4)")
    # 1 ffprobe
    info = json.loads(run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames", "-show_entries", "format=duration", "-of", "json", f"renders/{name}.mp4"]))
    st = info["streams"]
    v = [s for s in st if s["codec_type"] == "video"][0]
    audio = [s for s in st if s["codec_type"] == "audio"]
    dur = float(info["format"]["duration"])
    ok1 = v["width"] == 1280 and v["height"] == 720 and v["r_frame_rate"] == "30/1" and v["codec_name"] == "h264" and v["pix_fmt"] == "yuv420p" and not audio and abs(dur - frames / 30) < 1e-3 and int(v["nb_frames"]) == frames
    log(f"1  {v['codec_name']} {v['width']}x{v['height']} {v['r_frame_rate']} {v['pix_fmt']} audio={len(audio)} duration={dur:.3f}s frames={v['nb_frames']} -> {'PASS' if ok1 else 'FAIL'}")
    if not ok1:
        fails.append(f"{comp}: step 1")
    # 2 loop
    if loops:
        a, b = f"out/verify/{name}_loop0.png", f"out/verify/{name}_loop{frames}.png"
        still(comp, 0, a, {"loopCheck": True})
        still(comp, frames, b, {"loopCheck": True})
        ia, ib = np.asarray(Image.open(a)).astype(int), np.asarray(Image.open(b)).astype(int)
        diff = int(np.abs(ia - ib).max())
        ok2 = diff == 0
        log(f"2  loop: frame 0 vs frame {frames} max pixel diff {diff} (bytes equal: {sha(a) == sha(b)}) -> {'PASS' if ok2 else 'FAIL'}")
        if not ok2:
            fails.append(f"{comp}: step 2")
    # 3 black
    if comp.startswith("LightTrails"):
        worst = 0
        for fr in (0, 200, 400):
            img = mp4_frame(name, fr)
            top = img[: int(img.shape[0] * 0.2)]
            worst = max(worst, int(top.max()))
        ok3 = worst <= 1
        log(f"3  black: max RGB value in top 20% of decoded mp4 frames 0/200/400 = {worst} -> {'PASS' if ok3 else 'FAIL'}")
        if not ok3:
            fails.append(f"{comp}: step 3")
    # 4 determinism
    cold = f"out/verify/{name}_cold200.png"
    still(comp, 200, cold)
    full = seq_frame(name, 200)
    ic, ifull = np.asarray(Image.open(cold)).astype(int), np.asarray(Image.open(full)).astype(int)
    d4 = int(np.abs(ic - ifull).max())
    ok4 = d4 == 0
    log(f"4  frame 200 cold still vs full render: PNG bytes equal {sha(cold) == sha(full)}, max pixel diff {d4} -> {'PASS' if ok4 else 'FAIL'}")
    if not ok4:
        fails.append(f"{comp}: step 4")
    # 5 banding (looks 1, 3, 4, 5 version A)
    if comp in ("CloudServers-Blue", "GoldBarChart-Rising", "TradeWar-USA-China", "FileWave-Documents"):
        img = mp4_frame(name, min(300, frames - 1))
        banding(img, "decoded mp4 frame 300")

log()
log("FAILURES: " + (", ".join(fails) if fails else "none"))
with open("renders/verify.txt", "a") as f:
    f.write("\n".join(out) + "\n")
