#!/usr/bin/env python3
"""verify.py - technical checks on a rendered MP4 (QC step 8A).

Usage: python3 qc/verify.py video.mp4 --ref reference.mp4 --frames N [--json out.json]

Checks: container/stream specs, duration against the reference, a full decode,
and a per-frame scan for black frames, frozen runs and brightness jumps.
"""
import argparse
import json
import subprocess
import sys

import numpy as np


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format",
         "-of", "json", path], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--ref")
    ap.add_argument("--frames", type=int, required=True)
    ap.add_argument("--json")
    a = ap.parse_args()

    info = probe(a.video)
    v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
    audio = [s for s in info["streams"] if s["codec_type"] == "audio"]
    res = {
        "file": a.video,
        "width": v["width"], "height": v["height"], "codec": v["codec_name"],
        "pix_fmt": v["pix_fmt"], "r_frame_rate": v["r_frame_rate"],
        "avg_frame_rate": v["avg_frame_rate"],
        "nb_read_frames": int(v["nb_read_frames"]),
        "duration": float(v.get("duration", info["format"]["duration"])),
        "audio_streams": len(audio),
    }
    checks = {
        "1920x1080": (v["width"], v["height"]) == (1920, 1080),
        "h264": v["codec_name"] == "h264",
        "yuv420p": v["pix_fmt"] == "yuv420p",
        "fps_30/1": v["r_frame_rate"] == "30/1" and v["avg_frame_rate"] == "30/1",
        "frame_count": int(v["nb_read_frames"]) == a.frames,
        "no_audio": len(audio) == 0,
    }
    if a.ref:
        r = probe(a.ref)
        rv = [s for s in r["streams"] if s["codec_type"] == "video"][0]
        rd = float(rv["duration"])
        res["ref_duration"] = rd
        res["duration_diff"] = round(res["duration"] - rd, 5)
        checks["duration_within_1_frame"] = abs(res["duration"] - rd) < 1 / 30

    # full decode
    dec = subprocess.run(["ffmpeg", "-v", "error", "-i", a.video, "-f", "null", "-"],
                         capture_output=True, text=True)
    res["decode_errors"] = dec.stderr.strip()
    checks["decodes_clean"] = dec.returncode == 0 and dec.stderr.strip() == ""

    # frame scan at 320x180 grey
    W, H = 320, 180
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", a.video, "-vf", f"scale={W}:{H}",
         "-pix_fmt", "gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    fr = np.frombuffer(raw, dtype=np.uint8).reshape(-1, H, W).astype(np.float32) / 255
    mean = fr.reshape(len(fr), -1).mean(1)
    diff = np.abs(np.diff(fr, axis=0)).reshape(len(fr) - 1, -1).mean(1)
    res["mean_brightness_min"] = round(float(mean.min()), 4)
    res["mean_brightness_max"] = round(float(mean.max()), 4)
    black = [int(i) for i in np.nonzero(mean < 0.004)[0]]
    res["black_frames"] = black
    checks["no_black_frames"] = len(black) == 0
    # frozen: consecutive identical frames (motion is expected everywhere)
    frozen = [int(i + 1) for i in np.nonzero(diff < 1e-5)[0]]
    res["frozen_frames"] = frozen
    res["min_frame_diff"] = round(float(diff.min()), 6)
    checks["no_frozen_frames"] = len(frozen) == 0
    # flicker: mean brightness that jumps one way and straight back
    d = np.diff(mean)
    flick = [int(i + 1) for i in range(len(d) - 1)
             if abs(d[i]) > 0.02 and abs(d[i + 1]) > 0.02 and d[i] * d[i + 1] < 0]
    res["flicker_frames"] = flick
    res["max_brightness_step"] = round(float(np.abs(d).max()), 4)
    res["max_brightness_step_at"] = int(np.abs(d).argmax() + 1)
    checks["no_flicker"] = len(flick) == 0
    res["checks"] = checks
    res["all_pass"] = all(checks.values())
    if a.json:
        with open(a.json, "w") as fh:
            json.dump(res, fh, indent=1)
    for k, val in res.items():
        if k != "checks":
            print(f"{k:26} {val}")
    for k, val in checks.items():
        print(f"  [{'PASS' if val else 'FAIL'}] {k}")
    sys.exit(0 if res["all_pass"] else 1)


if __name__ == "__main__":
    main()
