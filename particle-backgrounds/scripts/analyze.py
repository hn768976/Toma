#!/usr/bin/env python3
"""
Post-render checks on the ENCODED previews (not the Studio preview).
  python3 scripts/analyze.py <deliverables dir>
Writes <dir>/checks/analysis.md and contact sheets <dir>/checks/<Name>/frames5.png
Needs: ffmpeg, ffprobe, numpy, pillow.
"""
import json, subprocess, sys, os
import numpy as np
from PIL import Image

OUT = sys.argv[1]
NAMES = [l.split()[1] for l in subprocess.check_output(["bash", "scripts/compositions.sh"], text=True).strip().splitlines()]

def frame(mp4, n):
    """Decode frame n of the mp4 to an RGB array (uint8)."""
    raw = subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", mp4, "-vf", f"select=eq(n\\,{n})", "-vsync", "0",
        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    return np.frombuffer(raw, np.uint8).reshape(720, 1280, 3)

def probe(mp4):
    j = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", mp4]))
    v = [s for s in j["streams"] if s["codec_type"] == "video"]
    a = [s for s in j["streams"] if s["codec_type"] == "audio"]
    s = v[0]
    ok = (s["codec_name"] == "h264" and s["width"] == 1280 and s["height"] == 720 and s["r_frame_rate"] == "30/1"
          and s["pix_fmt"] == "yuv420p" and abs(float(j["format"]["duration"]) - 20.0) < 1e-6 and not a)
    return ok, f'{s["codec_name"]} {s["width"]}x{s["height"]} {s["r_frame_rate"]} {s["pix_fmt"]} {float(j["format"]["duration"]):.3f}s audio_streams={len(a)} frames={s.get("nb_frames")}'

def profile(img, axis, start, stop, at, half=20):
    """Median luminance profile (band of 2*half+1 px), luma in 8-bit levels."""
    y = img.astype(np.float64) @ np.array([0.2126, 0.7152, 0.0722])
    if axis == "y":  # vertical profile at column `at`
        band = y[start:stop, at - half:at + half + 1]
        return np.median(band, axis=1)
    band = y[at - half:at + half + 1, start:stop]
    return np.median(band, axis=0)

def banding_stats(p):
    k = 9
    sm = np.convolve(p, np.ones(k) / k, mode="valid")
    d = np.abs(np.diff(sm))
    # longest plateau in the *raw* median profile where the smoothed trend still moves
    runs, cur = [], 1
    q = np.round(p)
    for i in range(1, len(q)):
        if q[i] == q[i - 1]: cur += 1
        else: runs.append(cur); cur = 1
    runs.append(cur)
    return float(sm.max() - sm.min()), float(d.max()), int(max(runs))

lines = ["# Encoded-preview analysis\n"]
for name in NAMES:
    mp4 = f"{OUT}/previews/{name}.mp4"
    if not os.path.exists(mp4):
        lines.append(f"## {name}\nMISSING\n"); continue
    ok, desc = probe(mp4)
    lines.append(f"## {name}\n- ffprobe: {'PASS' if ok else 'FAIL'} - {desc}")
    rep = open(f"{OUT}/checks/{name}/report.txt").read().strip().replace("\n", "; ")
    lines.append(f"- render/verify: {rep}")
    # five evenly spaced frames + motion between them
    idx = [0, 120, 240, 360, 480]
    fr = [frame(mp4, n) for n in idx]
    diffs = [float(np.abs(fr[i].astype(int) - fr[i + 1].astype(int)).mean()) for i in range(4)]
    lines.append(f"- frames {idx}: mean abs diff between neighbours = {', '.join(f'{d:.2f}' for d in diffs)}")
    sheet = np.concatenate([np.concatenate(fr[:3], 1), np.concatenate(fr[3:] + [np.zeros_like(fr[0])], 1)], 0)
    Image.fromarray(sheet).resize((1920, 720)).save(f"{OUT}/checks/{name}/frames5.png")
    f150 = frame(mp4, 150)
    Image.fromarray(f150).save(f"{OUT}/checks/{name}/mp4_frame150.png")
    if name.startswith("PulseRings"):
        corners = [f150[0:8, 0:8], f150[0:8, -8:], f150[-8:, 0:8], f150[-8:, -8:]]
        cmax = max(int(c.max()) for c in corners)
        yy, xx = np.mgrid[0:720, 0:1280]
        r = np.hypot(xx - 640, yy - 360)
        outside = f150[r > 0.45 * 720 * 0.5 * 4 / 3 + 12]  # beyond the fading 4th ring's max radius
        omax = int(outside.max())
        all_max = max(int(frame(mp4, n)[r > 0.45 * 720 * 0.5 * 4 / 3 + 12].max()) for n in [0, 37, 74])
        lines.append(f"- black check (mp4 frame 150): corners max={cmax}, outside-ring area max={omax} (frames 0/37/74 max={all_max}) -> {'PASS' if max(cmax, omax, all_max) <= 1 else 'FAIL'}")
    # banding profiles on gradient/glow areas
    probes = {
        "CyberNetwork": [("y", 0, 720, 1240, "sky gradient, right edge column")],
        "ParticleSphere": [("x", 640, 1280, 360, "glow falloff, centre row to right edge"),
                            ("y", 0, 360, 640, "glow falloff, centre column upward")],
        "ParticleWaves": [("x", 0, 1280, 30, "upper-left light, top rows"), ("y", 0, 230, 200, "sky gradient under the light")],
        "DataCity": [("y", 0, 140, 640, "sky gradient above the towers"), ("y", 0, 300, 1000, "sky gradient, right")],
    }
    for key, pr in probes.items():
        if name.startswith(key):
            for axis, a0, a1, at, label in pr:
                p = profile(f150, axis, a0, a1, at)
                rng, mx, run = banding_stats(p)
                lines.append(f"- banding [{label}]: range={rng:.1f} levels, max step (9px-smoothed)={mx:.2f}, longest flat run={run}px")
                np.savetxt(f"{OUT}/checks/{name}/profile_{axis}{at}.txt", p, fmt="%.2f")
    lines.append("")
open(f"{OUT}/checks/analysis.md", "w").write("\n".join(lines))
print("\n".join(lines))
