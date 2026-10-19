#!/usr/bin/env python3
"""Checks the rendered previews: ffprobe specs, exact loops, banding, contact sheets.

    python3 scripts/verify.py [renders]
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
R = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "renders")
CLIPS = [
    ("WatercolourBloom_Pastel", True), ("WatercolourBloom_Sunset", True),
    ("InkReveal_Indigo", False), ("InkReveal_Sepia", False),
    ("SketchyDrift_KidsBright", True), ("SketchyDrift_Muted", True),
    ("HatchedMap_Antique", True), ("Chalkboard_Green", True),
]


def probe(f):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(f)],
                         capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    v = [s for s in j["streams"] if s["codec_type"] == "video"][0]
    return {
        "width": v["width"], "height": v["height"], "codec": v["codec_name"], "pix_fmt": v["pix_fmt"],
        "fps": v["r_frame_rate"], "duration": round(float(j["format"]["duration"]), 3),
        "frames": int(v.get("nb_frames", 0)),
        "audio": any(s["codec_type"] == "audio" for s in j["streams"]),
    }


def decode(f, idx, w=1280, h=720):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-vf", f"select=eq(n\\,{idx})", "-vframes", "1",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3)


def banding(img):
    """Share of pixels in long flat runs inside smooth areas (higher = more banding).
    Smooth areas: local 9px variation <= 6 levels. A dithered wash flips values
    every few pixels; a banded one sits on one value for long runs."""
    g = img.astype(np.int16).mean(axis=2)
    runs = []
    for y in range(0, g.shape[0], 8):
        row = np.round(g[y]).astype(np.int16)
        run = 1
        for x in range(1, len(row)):
            if row[x] == row[x - 1]:
                run += 1
            else:
                runs.append(run)
                run = 1
        runs.append(run)
    runs = np.array(runs)
    return {"meanRun": round(float(runs.mean()), 2), "share_runs_ge_16px": round(float(runs[runs >= 16].sum() / runs.sum()), 4)}


report = {}
for name, loop in CLIPS:
    mp4 = R / f"{name}.mp4"
    if not mp4.exists():
        continue
    r = {"probe": probe(mp4)}
    p = r["probe"]
    want = 20.0 if loop else 12.0
    r["spec_ok"] = (p["width"], p["height"], p["codec"], p["pix_fmt"], p["fps"], p["audio"]) == (1280, 720, "h264", "yuv420p", "30/1", False) and abs(p["duration"] - want) < 0.02
    frames = R / name / "frames"
    if loop:
        a = np.asarray(Image.open(frames / "element-000.png").convert("RGB"))
        b = np.asarray(Image.open(frames / "element-600.png").convert("RGB"))
        r["loop_png_identical"] = bool((a == b).all())
        r["loop_png_maxdiff"] = int(np.abs(a.astype(int) - b.astype(int)).max())
        m601 = R / name / f"{name}_601.mp4"
        # (re)encode the loop-check file: constant QP 16, IDR forced at frame 600
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "30", "-start_number", "0", "-i", str(frames / "element-%03d.png"),
                        "-frames:v", "601", "-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int",
                        "-c:v", "libx264", "-preset", "slow", "-qp", "16", "-x264-params", "keyint=600:min-keyint=600:scenecut=0",
                        "-pix_fmt", "yuv420p", "-an", str(m601)], check=True)
        d0, d600 = decode(m601, 0), decode(m601, 600)
        diff = np.abs(d0.astype(int) - d600.astype(int))
        r["loop_mp4"] = {"frames": probe(m601)["frames"], "maxdiff": int(diff.max()), "meandiff": round(float(diff.mean()), 4),
                         "identical": bool((diff == 0).all())}
    mid = 300 if loop else 300
    r["banding_mp4_frame%d" % mid] = banding(decode(mp4, mid))
    if name.startswith("InkReveal"):
        # clean centre: widest run of unpainted columns through the middle band
        img = decode(mp4, 359).astype(int)
        band = img[int(720 * 0.3):int(720 * 0.7)]
        paper = np.median(img[300:420, 560:720].reshape(-1, 3), axis=0)
        painted = (np.abs(band - paper).max(axis=2) > 18).mean(axis=0) > 0.02
        c = 640
        l = c
        while l > 0 and not painted[l - 1]:
            l -= 1
        rr = c
        while rr < 1279 and not painted[rr + 1]:
            rr += 1
        r["clean_centre_width_frac"] = round((rr - l + 1) / 1280, 3)
    if name.startswith("WatercolourBloom"):
        covs = []
        for i in range(0, 600, 60):
            img = decode(mp4, i).astype(int)
            paper = np.array([243, 235, 221])
            covs.append(float((np.abs(img - paper).max(axis=2) > 10).mean()))
        r["bloom_coverage"] = {"mean": round(float(np.mean(covs)), 3), "min": round(min(covs), 3), "max": round(max(covs), 3)}
    # contact sheet: 5 frames
    n = 600 if loop else 360
    idx = [0, n // 4, n // 2, 3 * n // 4, n - 1]
    sheet = R / f"contact_{name}.png"
    sel = "+".join(f"eq(n\\,{i})" for i in idx)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp4), "-vf", f"select='{sel}',scale=768:432:flags=lanczos,tile=5x1:padding=8:color=white",
                    "-vsync", "0", "-frames:v", "1", str(sheet)], check=True)
    r["contact_frames"] = idx
    report[name] = r
    print(name, json.dumps(r))

res = R / "results.json"
allres = json.loads(res.read_text()) if res.exists() else {}
for k, v in report.items():
    allres.setdefault(k, {})["verify"] = v
res.write_text(json.dumps(allres, indent=2))
