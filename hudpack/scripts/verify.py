#!/usr/bin/env python3
"""Verification for the 720p previews (steps 1-4 of the brief).

Usage: python3 scripts/verify.py <CompositionId> [--skip-loop] [--skip-cold]
Expects scripts/preview.sh to have produced renders/frames/<Name>/ and
deliverables/<Name>.mp4. Writes a JSON report to renders/verify/<Name>.json.
"""
import hashlib
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

SCALE = "0.3333333333333333"
LOOPS = {"StockScreen-Teal", "AIHUD-WhiteOverlay", "MarketMap-Blue", "MarketMap-Gold"}
DURATION = {"ParticleHeart": 10.0, "LoadingHUD": 12.0}
BLACK = {"AIHUD", "ParticleHeart", "LoadingHUD"}


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def still(comp, frame, out, props=None):
    cmd = ["npx", "remotion", "still", comp, out, f"--frame={frame}", f"--scale={SCALE}"]
    if props:
        cmd.append(f"--props={json.dumps(props)}")
    run(cmd)


def pixels(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.int16)


def md5(path):
    return hashlib.md5(open(path, "rb").read()).hexdigest()


def mp4_frame(mp4, frame, out):
    run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", f"select=eq(n\\,{frame})", "-vsync", "0", "-frames:v", "1", out])
    return pixels(out)


def main():
    comp = sys.argv[1]
    name = comp.replace("-", "_", 1)
    family = comp.split("-")[0]
    mp4 = f"deliverables/{name}.mp4"
    frames_dir = f"renders/frames/{name}"
    vdir = f"renders/verify/{name}"
    os.makedirs(vdir, exist_ok=True)
    rep = {"composition": comp}

    # ---- step 1: file checks
    probe = run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
                 "-show_entries", "format=duration", "-of", "json", mp4])
    pj = json.loads(probe)
    streams = pj["streams"]
    v = [s for s in streams if s["codec_type"] == "video"][0]
    want_dur = DURATION.get(family, 20.0)
    dur = float(pj["format"]["duration"])
    rep["step1"] = {
        "width": v["width"], "height": v["height"], "fps": v["r_frame_rate"], "codec": v["codec_name"],
        "pix_fmt": v["pix_fmt"], "audio_streams": sum(s["codec_type"] == "audio" for s in streams), "duration": dur,
        "pass": v["width"] == 1280 and v["height"] == 720 and v["r_frame_rate"] == "30/1" and v["codec_name"] == "h264"
        and v["pix_fmt"] == "yuv420p" and not any(s["codec_type"] == "audio" for s in streams) and abs(dur - want_dur) < 0.02,
    }

    total = len(os.listdir(frames_dir))
    mid = total // 2

    # ---- step 2: loop check (frame 0 vs frame 600 of a 601-frame version)
    if comp in LOOPS and "--skip-loop" not in sys.argv:
        a, b = f"{vdir}/loop_0000.png", f"{vdir}/loop_0600.png"
        still(comp, 0, a, {"loopCheck": True})
        still(comp, 600, b, {"loopCheck": True})
        pa, pb = pixels(a), pixels(b)
        rep["step2"] = {"identical_pixels": bool(np.array_equal(pa, pb)), "max_diff": int(np.abs(pa - pb).max()),
                        "md5_equal": md5(a) == md5(b)}
        rep["step2"]["pass"] = rep["step2"]["identical_pixels"]

    # ---- step 3: middle frame from a cold start vs the full render
    if "--skip-cold" not in sys.argv:
        cold = f"{vdir}/cold_{mid:04d}.png"
        still(comp, mid, cold)
        full = sorted(os.listdir(frames_dir))[mid]
        pf, pc = pixels(f"{frames_dir}/{full}"), pixels(cold)
        rep["step3"] = {"frame": mid, "full_render_file": full, "identical_pixels": bool(np.array_equal(pf, pc)),
                        "max_diff": int(np.abs(pf - pc).max()), "png_bytes_equal": md5(f"{frames_dir}/{full}") == md5(cold)}
        rep["step3"]["pass"] = rep["step3"]["identical_pixels"]

    # ---- step 4: banding + black level, read from the encoded mp4
    enc = mp4_frame(mp4, mid, f"{vdir}/mp4_{mid:04d}.png")
    src = pixels(f"{frames_dir}/{sorted(os.listdir(frames_dir))[mid]}")
    s4 = {}
    if family in BLACK:
        # points away from content: lossless frame is 0 in a 31x31 neighbourhood
        lum = src.max(axis=2)
        from numpy.lib.stride_tricks import sliding_window_view
        pad = np.pad(lum, 15, constant_values=255)
        nb = sliding_window_view(pad, (31, 31)).max(axis=(2, 3))
        ys, xs = np.nonzero(nb == 0)
        if len(ys) == 0:
            s4["black"] = {"pass": False, "note": "no empty region found"}
        else:
            idx = np.linspace(0, len(ys) - 1, 50).astype(int)
            vals = [enc[ys[i], xs[i]].tolist() for i in idx]
            mx = max(max(v) for v in vals)
            s4["black"] = {"points": 50, "max_value": int(mx), "sample": vals[:5], "pass": mx <= 1}
    # banding: luminance along a vertical and a horizontal line in a quiet column/row
    g = enc.astype(np.float32).mean(axis=2)
    col = g[:, 1280 // 2]
    row = g[720 // 2, :]
    def steps(line):
        # smooth with a 9-px median to drop thin content, then look for plateaus/jumps
        k = 9
        med = np.array([np.median(line[max(0, i - k):i + k + 1]) for i in range(len(line))])
        d = np.abs(np.diff(med))
        return float(d.max()), med[::90].round(1).tolist()
    s4["vertical_line"] = steps(col)
    s4["horizontal_line"] = steps(row)
    rep["step4"] = s4

    json.dump(rep, open(f"renders/verify/{name}.json", "w"), indent=1)
    print(json.dumps(rep, indent=1))


if __name__ == "__main__":
    main()
