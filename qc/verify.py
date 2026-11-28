#!/usr/bin/env python3
"""Technical checks for a rendered video (step 8A, items 1-4 and the loop sanity check).

usage: verify.py <video.mp4> <reference.mp4> <expected_frames> <out_prefix>

Writes <out_prefix>.json and <out_prefix>-sheet.png (one frame per second).
Needs ffmpeg / ffprobe on the PATH, numpy and Pillow.
"""
import json
import subprocess
import sys

import numpy as np
from PIL import Image


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", path],
        capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def main():
    video, ref, expected, prefix = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
    info = probe(video)
    vs = [s for s in info["streams"] if s["codec_type"] == "video"]
    aus = [s for s in info["streams"] if s["codec_type"] == "audio"]
    v = vs[0]
    rinfo = probe(ref)
    rv = [s for s in rinfo["streams"] if s["codec_type"] == "video"][0]
    res = {
        "file": video,
        "width": v["width"], "height": v["height"], "codec": v["codec_name"], "pix_fmt": v["pix_fmt"],
        "r_frame_rate": v["r_frame_rate"], "avg_frame_rate": v["avg_frame_rate"],
        "frames": int(v["nb_read_frames"]), "audio_streams": len(aus),
        "duration": float(v["duration"]), "ref_duration": float(rv["duration"]),
        "size_bytes": int(info["format"]["size"]),
    }
    res["duration_diff"] = res["duration"] - res["ref_duration"]
    checks = {}
    checks["1_specs"] = (res["width"] == 1920 and res["height"] == 1080 and res["codec"] == "h264" and res["pix_fmt"] == "yuv420p"
                         and res["r_frame_rate"] == "30/1" and res["avg_frame_rate"] == "30/1" and res["frames"] == expected
                         and res["audio_streams"] == 0)
    checks["2_duration_within_one_frame"] = abs(res["duration_diff"]) <= 1 / 30 + 1e-6

    dec = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-f", "null", "-"], capture_output=True, text=True)
    res["decode_errors"] = dec.stderr.strip()
    checks["3_decodes_cleanly"] = dec.returncode == 0 and res["decode_errors"] == ""

    # frame scan on a 480x270 grey proxy
    w, h = 480, 270
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vf", f"scale={w}:{h}:flags=area,format=gray", "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, dtype=np.uint8).reshape(-1, h, w).astype(np.float32)
    means = frames.mean(axis=(1, 2))
    diffs = np.abs(frames[1:] - frames[:-1]).mean(axis=(1, 2))
    dmean = np.abs(np.diff(means))
    wrap = float(np.abs(frames[-1] - frames[0]).mean())
    res.update({
        "mean_min": float(means.min()), "mean_max": float(means.max()),
        "frame_diff_min": float(diffs.min()), "frame_diff_median": float(np.median(diffs)), "frame_diff_max": float(diffs.max()),
        "brightness_jump_max": float(dmean.max()), "brightness_jump_p99": float(np.percentile(dmean, 99)),
        "black_frames": int((means < 3).sum()),
        "duplicate_frames": int((diffs < 0.02).sum()),
        "last_to_first_diff": wrap,
    })
    # a flicker is a brightness step much larger than its neighbours
    med = float(np.median(dmean)) + 1e-6
    res["flicker_ratio"] = float(dmean.max() / max(med, 0.05))
    # second difference of brightness: a single-frame pop shows up here
    pops = np.abs(means[2:] - 2 * means[1:-1] + means[:-2])
    res["brightness_pop_max"] = float(pops.max())
    checks["4_no_black_frames"] = res["black_frames"] == 0
    checks["4_no_duplicate_frames"] = res["duplicate_frames"] == 0
    checks["4_no_flicker"] = res["brightness_pop_max"] < 1.5
    # loop sanity on the encoded video: stepping from the last frame to the first is no bigger than a normal step
    checks["5_loop_step_normal"] = wrap <= res["frame_diff_max"] * 1.25

    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vf", "fps=1,scale=480:-1,tile=6x2", "-frames:v", "1", prefix + "-sheet.png"], check=True)
    res["checks"] = {k: bool(v) for k, v in checks.items()}
    json.dump(res, open(prefix + ".json", "w"), indent=1)
    for k, val in res.items():
        if k != "checks":
            print(f"{k:28s} {val}")
    for k, val in res["checks"].items():
        print(f"{'PASS' if val else 'FAIL'}  {k}")
    Image.open(prefix + "-sheet.png").verify()
    return 0 if all(res["checks"].values()) else 1


if __name__ == "__main__":
    sys.exit(main())
