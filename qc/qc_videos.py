#!/usr/bin/env python3
"""Technical QC for the delivered MP4s.

usage: qc_videos.py <deliverable.mp4>=<reference.mp4> [...]  > report.json
Checks: container/codec/profile, resolution, fps, frame count & duration vs
reference, full decode without errors, black frames, frozen frames, frame-to-
frame luminance flicker, audio streams.
"""
import json, subprocess, sys
import numpy as np

def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format",
                          "-count_frames", "-of", "json", path], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)

def luma_series(path, w=192, h=108):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h},format=gray",
                          "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
    return f

def check(deliv, ref):
    p, r = probe(deliv), probe(ref)
    v = [s for s in p["streams"] if s["codec_type"] == "video"][0]
    rv = [s for s in r["streams"] if s["codec_type"] == "video"][0]
    audio = [s for s in p["streams"] if s["codec_type"] == "audio"]
    num, den = map(int, v["r_frame_rate"].split("/"))
    anum, aden = map(int, v["avg_frame_rate"].split("/"))
    dec = subprocess.run(["ffmpeg", "-v", "error", "-i", deliv, "-f", "null", "-"], capture_output=True, text=True)
    frames = luma_series(deliv)
    means = frames.mean(axis=(1, 2))
    black = int((means < 6).sum())
    diffs = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))
    frozen = int((diffs < 0.05).sum())
    # flicker: a frame whose mean luma jumps away from BOTH neighbours
    dm = np.diff(means)
    spikes = [i + 1 for i in range(len(dm) - 1) if abs(dm[i]) > 4 and abs(dm[i + 1]) > 4 and np.sign(dm[i]) != np.sign(dm[i + 1])]
    res = {
        "file": deliv.split("/")[-1],
        "reference": ref.split("/")[-1],
        "container": p["format"]["format_name"],
        "codec": v["codec_name"], "profile": v.get("profile"), "pix_fmt": v["pix_fmt"],
        "width": v["width"], "height": v["height"],
        "r_frame_rate": v["r_frame_rate"], "avg_frame_rate": v["avg_frame_rate"],
        "frames": int(v["nb_read_frames"]), "ref_frames": int(rv["nb_read_frames"]),
        "duration_s": float(v["duration"]), "ref_duration_s": float(rv["duration"]),
        "bitrate_kbps": round(int(p["format"]["bit_rate"]) / 1000),
        "size_mb": round(int(p["format"]["size"]) / 1e6, 2),
        "decode_errors": dec.stderr.strip()[:500],
        "audio_streams": len(audio), "ref_audio_streams": len([s for s in r["streams"] if s["codec_type"] == "audio"]),
        "black_frames": black, "frozen_frame_pairs": frozen,
        "luma_mean_min_max": [round(float(means.min()), 1), round(float(means.max()), 1)],
        "max_frame_to_frame_luma_change": round(float(np.abs(dm).max()), 2),
        "flicker_spike_frames": spikes,
    }
    res["PASS"] = all([
        res["codec"] == "h264", res["width"] == 1920, res["height"] == 1080,
        num / den == 30 and anum / aden == 30,
        res["frames"] == res["ref_frames"], abs(res["duration_s"] - res["ref_duration_s"]) < 1e-3,
        not res["decode_errors"], res["black_frames"] == 0, not spikes,
        res["audio_streams"] == res["ref_audio_streams"],
    ])
    return res

if __name__ == "__main__":
    out = [check(*a.split("=", 1)) for a in sys.argv[1:]]
    print(json.dumps(out, indent=2))
