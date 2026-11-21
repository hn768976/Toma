#!/usr/bin/env python3
"""verify-video.py - technical checks for a delivered MP4.

Usage: python3 tools/verify-video.py <video.mp4> --frames N --ref-duration S [--sheet out.png]

Checks: container/stream specs (ffprobe), duration against the reference, full
decode without errors, and a per-frame scan for black frames, frozen/duplicated
frames and brightness jumps (flicker). Optionally writes a one-frame-per-second
contact sheet. Prints a JSON summary; exit code 1 if any check fails.
"""
import argparse
import json
import subprocess
import sys

import numpy as np


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--frames", type=int, required=True)
    ap.add_argument("--ref-duration", type=float, required=True)
    ap.add_argument("--sheet")
    a = ap.parse_args()
    out = {"file": a.video, "checks": {}}
    ok = True

    p = run(["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", a.video])
    info = json.loads(p.stdout)
    vs = [s for s in info["streams"] if s["codec_type"] == "video"]
    aus = [s for s in info["streams"] if s["codec_type"] == "audio"]
    v = vs[0]
    spec = {
        "width": v["width"], "height": v["height"], "codec": v["codec_name"], "pix_fmt": v["pix_fmt"],
        "r_frame_rate": v["r_frame_rate"], "avg_frame_rate": v["avg_frame_rate"],
        "nb_read_frames": int(v["nb_read_frames"]), "audio_streams": len(aus),
        "duration": float(info["format"]["duration"]), "size_bytes": int(info["format"]["size"]),
    }
    out["spec"] = spec
    c = out["checks"]
    c["1920x1080"] = spec["width"] == 1920 and spec["height"] == 1080
    c["h264"] = spec["codec"] == "h264"
    c["yuv420p"] = spec["pix_fmt"] == "yuv420p"
    c["30/1 fps"] = spec["r_frame_rate"] == "30/1" and spec["avg_frame_rate"] == "30/1"
    c["frame count"] = spec["nb_read_frames"] == a.frames
    c["no audio"] = spec["audio_streams"] == 0
    out["duration_diff_s"] = round(spec["duration"] - a.ref_duration, 4)
    c["duration within one frame"] = abs(spec["duration"] - a.ref_duration) < 1 / 30

    d = run(["ffmpeg", "-v", "error", "-i", a.video, "-f", "null", "-"])
    out["decode_errors"] = d.stderr.strip()
    c["decodes cleanly"] = d.returncode == 0 and not d.stderr.strip()

    # per-frame scan on small greyscale frames
    w, h = 320, 180
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", a.video, "-vf", f"scale={w}:{h}:flags=area,format=gray", "-f", "rawvideo", "-"],
        capture_output=True,
    ).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
    means = fr.mean(axis=(1, 2))
    diffs = np.abs(fr[1:] - fr[:-1]).mean(axis=(1, 2))
    dmean = np.abs(np.diff(means))
    scan = {
        "frames_scanned": int(len(fr)),
        "mean_min": float(means.min()), "mean_max": float(means.max()),
        "black_frames": [int(i) for i in np.nonzero(means < 2.0)[0]],
        "frame_diff_min": float(diffs.min()), "frame_diff_median": float(np.median(diffs)), "frame_diff_max": float(diffs.max()),
        "frozen_pairs": [int(i) for i in np.nonzero(diffs < 0.02)[0]],
        "max_brightness_step": float(dmean.max()), "max_brightness_step_at": int(dmean.argmax()),
        # a jump is a step far outside the clip's own frame-to-frame variation
        "flicker_frames": [int(i) for i in np.nonzero(dmean > max(1.5, 8 * float(np.median(dmean)) + 0.5))[0]],
        "diff_spikes": [int(i) for i in np.nonzero(diffs > 4 * float(np.median(diffs)) + 1.0)[0]],
    }
    out["scan"] = scan
    c["no black frames"] = not scan["black_frames"]
    c["no frozen frames"] = not scan["frozen_pairs"]
    c["no brightness jumps"] = not scan["flicker_frames"] and not scan["diff_spikes"]

    if a.sheet:
        secs = max(1, int(round(a.frames / 30)))
        cols = 5
        rows = (secs + cols - 1) // cols
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.video, "-vf",
                        f"select='not(mod(n,30))',scale=480:-1,tile={cols}x{rows}", "-frames:v", "1", a.sheet])
        out["sheet"] = a.sheet

    ok = all(c.values())
    out["pass"] = ok
    print(json.dumps(out, indent=1))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
