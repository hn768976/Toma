#!/usr/bin/env python3
"""Technical QC for the delivered MP4s.

Usage: python3 qc_check.py REF_DURATION_SECONDS video1.mp4 [video2.mp4 ...]

Checks per file: decode errors, codec/profile, resolution, frame rate,
frame count, duration vs. reference, audio streams, black frames, frozen
frames, luma flicker (frame-to-frame jumps) and per-frame statistics.
Prints a JSON report.
"""
import json
import subprocess
import sys

import numpy as np


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path):
    out = run([
        "ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format",
        "-of", "json", path,
    ])
    return json.loads(out.stdout)


def decode_errors(path):
    r = run(["ffmpeg", "-v", "error", "-xerror", "-i", path, "-f", "null", "-"])
    return r.stderr.strip()


def detect(path, filt, key):
    r = run(["ffmpeg", "-hide_banner", "-i", path, "-vf", filt, "-an", "-f", "null", "-"])
    return [line.strip() for line in r.stderr.splitlines() if key in line]


def luma_series(path, w=192, h=108):
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h}", "-pix_fmt", "gray",
         "-f", "rawvideo", "-"],
        capture_output=True,
    )
    frames = np.frombuffer(r.stdout, dtype=np.uint8).reshape(-1, h, w).astype(np.float32)
    return frames


def main():
    ref = float(sys.argv[1])
    report = []
    for path in sys.argv[2:]:
        info = probe(path)
        v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
        a = [s for s in info["streams"] if s["codec_type"] == "audio"]
        num, den = (int(x) for x in v["r_frame_rate"].split("/"))
        anum, aden = (int(x) for x in v["avg_frame_rate"].split("/"))
        nb = int(v.get("nb_read_frames", 0))
        dur = float(info["format"]["duration"])
        frames = luma_series(path)
        means = frames.mean(axis=(1, 2))
        stds = frames.std(axis=(1, 2))
        jumps = np.abs(np.diff(means))
        mad = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))
        black = detect(path, "blackdetect=d=0.04:pix_th=0.10", "black_start")
        frozen = detect(path, "freezedetect=n=0.0005:d=0.2", "freeze_start")
        errs = decode_errors(path)
        entry = {
            "file": path.split("/")[-1],
            "codec": v["codec_name"],
            "profile": v.get("profile"),
            "pix_fmt": v.get("pix_fmt"),
            "color_range": v.get("color_range"),
            "color_space": v.get("color_space"),
            "width": v["width"],
            "height": v["height"],
            "r_frame_rate": f"{num}/{den}",
            "avg_frame_rate": f"{anum}/{aden}",
            "fps": num / den,
            "frames": nb,
            "duration_s": round(dur, 4),
            "frames_over_fps_s": round(nb * den / num, 4),
            "reference_duration_s": ref,
            "duration_match": abs(nb * den / num - ref) < 1e-6,
            "audio_streams": len(a),
            "bitrate_kbps": round(int(info["format"]["bit_rate"]) / 1000),
            "size_mb": round(int(info["format"]["size"]) / 1e6, 2),
            "decode_errors": errs or "none",
            "black_frame_events": black or "none",
            "freeze_events": frozen or "none",
            "luma_mean_min_max": [round(float(means.min()), 1), round(float(means.max()), 1)],
            "luma_std_min": round(float(stds.min()), 1),
            "max_frame_to_frame_luma_jump": round(float(jumps.max()), 2),
            "mean_frame_to_frame_abs_diff": round(float(mad.mean()), 2),
            "max_frame_to_frame_abs_diff": round(float(mad.max()), 2),
            "min_frame_to_frame_abs_diff": round(float(mad.min()), 2),
        }
        entry["pass"] = bool(
            entry["codec"] == "h264"
            and entry["pix_fmt"] == "yuv420p"
            and entry["width"] == 1920
            and entry["height"] == 1080
            and num == 30 and den == 1
            and anum == 30 and aden == 1
            and entry["duration_match"]
            and entry["decode_errors"] == "none"
            and entry["black_frame_events"] == "none"
            and entry["freeze_events"] == "none"
            and entry["max_frame_to_frame_luma_jump"] < 4.0
        )
        report.append(entry)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
