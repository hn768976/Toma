#!/usr/bin/env python3
"""Verify loop for the 720p previews. Usage: python3 verify.py <previews dir> <work dir>

Checks: ffprobe format, loop seams (frame 0 vs 600), black level, transition
coverage, timecode crops, determinism (cold still vs sequential render).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

PREV = Path(sys.argv[1])
WORK = Path(sys.argv[2])
WORK.mkdir(parents=True, exist_ok=True)
SCALE = "--scale=0.3333333333333333"
CLIPS = {
    "HUDScope_Violet": ("HUDScope-Violet", 20.0),
    "VHSPlayback_OSD": ("VHSPlayback-OSD", 20.0),
    "VHSPlayback_Clean": ("VHSPlayback-Clean", 20.0),
    "TVStatic_Datamosh": ("TVStatic-Datamosh", 10.0),
    "TVStatic_Transition": ("TVStatic-Transition", 2.0),
    "ChalkMath_Flythrough": ("ChalkMath-Flythrough", 20.0),
    "ChalkMath_Write": ("ChalkMath-Write", 10.0),
    "NeuralGlobe_Labels": ("NeuralGlobe-Labels", 20.0),
}
LOOPS = ["HUDScope_Violet", "VHSPlayback_Clean", "ChalkMath_Flythrough", "NeuralGlobe_Labels"]
BLACK = ["HUDScope_Violet", "ChalkMath_Flythrough", "ChalkMath_Write", "NeuralGlobe_Labels"]
report = {}


def run(cmd):
    return subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True).stdout


def still(comp, frame, out, props=None):
    p = f"--props='{json.dumps(props)}'" if props else ""
    run(f"npx remotion still {comp} {out} --frame={frame} {SCALE} {p} --log=error")
    return np.asarray(Image.open(out).convert("RGB"))


def video_frame(name, idx, out):
    run(f"ffmpeg -v error -y -i {PREV / (name + '.mp4')} -vf \"select=eq(n\\,{idx})\" -vsync 0 -frames:v 1 {out}")
    return np.asarray(Image.open(out).convert("RGB")).astype(int)


# 1. ffprobe
for name, (_, dur) in CLIPS.items():
    info = json.loads(run(f"ffprobe -v error -show_streams -show_format -of json {PREV / (name + '.mp4')}"))
    v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
    audio = [s for s in info["streams"] if s["codec_type"] == "audio"]
    ok = (v["width"], v["height"], v["r_frame_rate"], v["codec_name"], v["pix_fmt"]) == (1280, 720, "30/1", "h264", "yuv420p")
    d = float(info["format"]["duration"])
    report.setdefault(name, {})["ffprobe"] = {
        "size": f'{v["width"]}x{v["height"]}', "fps": v["r_frame_rate"], "codec": v["codec_name"],
        "pix_fmt": v["pix_fmt"], "audio": len(audio), "duration": round(d, 3), "frames": int(v.get("nb_frames", 0)),
        "pass": ok and not audio and abs(d - dur) < 0.02,
    }

# 2. loops: frame 0 vs frame 600 of the 601-frame variant (lossless PNG)
for name in LOOPS:
    comp = CLIPS[name][0]
    a = still(comp, 0, WORK / f"{name}_f0.png", {"loopCheck": True})
    b = still(comp, 600, WORK / f"{name}_f600.png", {"loopCheck": True})
    diff = np.abs(a.astype(int) - b.astype(int))
    report[name]["loop"] = {"max_diff": int(diff.max()), "pixels_differing": int((diff.max(axis=2) > 0).sum()), "pass": int(diff.max()) == 0}

# 3. black level: 50 points in empty areas (no ink within 12 px in the lossless still), read from the mp4
rng = np.random.default_rng(7)
for name in BLACK:
    comp = CLIPS[name][0]
    fidx = {"ChalkMath_Write": 285}.get(name, 300)
    ref = still(comp, fidx, WORK / f"{name}_black_ref.png").max(axis=2)
    empty = np.asarray(Image.fromarray(ref.astype(np.uint8)).filter(ImageFilter.MaxFilter(25))) == 0
    ys, xs = np.nonzero(empty)
    pick = rng.choice(len(ys), size=50, replace=False)
    vid = video_frame(name, fidx, WORK / f"{name}_black_vid.png")
    vals = vid[ys[pick], xs[pick]]
    report[name]["black"] = {
        "frame": fidx, "empty_fraction": round(float(empty.mean()), 3), "still_max_in_empty": int(ref[empty].max()),
        "video_max_at_50_points": int(vals.max()), "pass": int(vals.max()) <= 1 and int(ref[empty].max()) == 0,
    }

# 4. transition: no black pixels in frames 6..47 (0.2s-1.6s)
mins = []
for f in range(6, 48):
    fr = video_frame("TVStatic_Transition", f, WORK / "tr.png")
    mins.append(int(fr.max(axis=2).min()))
report["TVStatic_Transition"]["no_black_0.2_1.6"] = {"min_pixel_value_per_frame_min": min(mins), "pass": min(mins) > 2}

# 5. timecode crops at 0s, 5s, 10s, 19.9s
crops = []
for f in [0, 150, 300, 597]:
    fr = video_frame("VHSPlayback_OSD", f, WORK / "tc.png")
    crops.append(fr[585:640, 740:940].astype(np.uint8))
Image.fromarray(np.vstack(crops)).resize((400, 440)).save(WORK / "timecodes.png")

# 6. determinism: cold still of the middle frame vs the same frame reached sequentially
for name, (comp, dur) in CLIPS.items():
    mid = int(dur * 30 / 2)
    cold = still(comp, mid, WORK / f"{name}_cold.png")
    seq_dir = WORK / f"{name}_seq"
    run(f"npx remotion render {comp} {seq_dir} --sequence --image-format=png --frames={mid - 8}-{mid} --concurrency=1 {SCALE} --log=error")
    seq_file = sorted(seq_dir.glob("*.png"))[-1]
    seq = np.asarray(Image.open(seq_file).convert("RGB"))
    report[name]["determinism"] = {"frame": mid, "identical": bool(np.array_equal(cold, seq)), "pass": bool(np.array_equal(cold, seq))}

print(json.dumps(report, indent=1))
(WORK / "report.json").write_text(json.dumps(report, indent=1))
