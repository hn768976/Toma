#!/usr/bin/env python3
"""Technical QC for the four delivered MP4s.

Usage: python3 qc_videos.py <ref1.mp4> <ref2.mp4> <deliverables dir> > report.json
Checks: container/codec/resolution/fps/frame-count/duration, full decode
without errors, black frames, frozen frames, luminance flicker, colour
statistics vs. reference, temporal motion profile vs. reference.
"""
import json, subprocess, sys, re, hashlib, os
import numpy as np

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)

def probe(path):
    out = run(["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", path]).stdout
    return json.loads(out)

def frames_small(path, w=192, h=108):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h}:flags=area",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).astype(np.float32)

def color_stats(a):
    flat = a.reshape(-1, 3)
    return {
        "mean_rgb": a.mean((0, 1, 2)).round(1).tolist(),
        "pct_rgb": {str(p): np.percentile(flat, p, axis=0).round().tolist() for p in (1, 10, 50, 90, 99)},
    }

def lag_profile(a):
    return {str(k): round(float(np.abs(a[k:] - a[:-k]).mean()), 2) for k in (1, 5, 15, 30)}

def analyse(path, ref_path, expect_frames):
    r = {"file": os.path.basename(path), "size_bytes": os.path.getsize(path)}
    r["sha256"] = hashlib.sha256(open(path, "rb").read()).hexdigest()
    p = probe(path)
    v = [s for s in p["streams"] if s["codec_type"] == "video"]
    a = [s for s in p["streams"] if s["codec_type"] == "audio"]
    vs = v[0]
    r.update({
        "container": p["format"]["format_name"],
        "video_streams": len(v), "audio_streams": len(a),
        "codec": vs["codec_name"], "profile": vs.get("profile"), "pix_fmt": vs["pix_fmt"],
        "width": vs["width"], "height": vs["height"],
        "r_frame_rate": vs["r_frame_rate"], "avg_frame_rate": vs["avg_frame_rate"],
        "nb_read_frames": int(vs["nb_read_frames"]),
        "stream_duration_s": float(vs["duration"]), "format_duration_s": float(p["format"]["duration"]),
        "bit_rate": int(p["format"]["bit_rate"]),
    })
    # Full decode, any error is fatal.
    dec = run(["ffmpeg", "-v", "error", "-xerror", "-i", path, "-f", "null", "-"])
    r["decode_errors"] = dec.stderr.strip() or None
    # Black frames / frozen frames.
    bd = run(["ffmpeg", "-i", path, "-vf", "blackdetect=d=0.03:pic_th=0.90:pix_th=0.10", "-an", "-f", "null", "-"]).stderr
    r["black_segments"] = re.findall(r"black_start:\S+ black_end:\S+", bd)
    fd = run(["ffmpeg", "-i", path, "-vf", "freezedetect=n=0.0005:d=0.2", "-an", "-f", "null", "-"]).stderr
    r["frozen_segments"] = re.findall(r"freeze_start: \S+", fd)
    # Luminance flicker and frame-to-frame change.
    f = frames_small(path)
    ref = frames_small(ref_path)
    luma = f.mean((1, 2, 3))
    rluma = ref.mean((1, 2, 3))
    r["luma_mean"] = round(float(luma.mean()), 2)
    r["luma_min_max"] = [round(float(luma.min()), 2), round(float(luma.max()), 2)]
    r["max_luma_jump_between_frames"] = round(float(np.abs(np.diff(luma)).max()), 3)
    r["ref_max_luma_jump_between_frames"] = round(float(np.abs(np.diff(rluma)).max()), 3)
    d = np.abs(np.diff(f, axis=0)).mean((1, 2, 3))
    r["frame_diff_min_mean_max"] = [round(float(d.min()), 3), round(float(d.mean()), 3), round(float(d.max()), 3)]
    r["duplicate_consecutive_frames"] = int((d < 0.01).sum())
    # Spikes: a frame whose diff is > 3x the local median -> potential glitch.
    med = np.median(d)
    r["diff_spikes_over_3x_median"] = int((d > 3 * med).sum())
    r["colour"] = color_stats(f)
    r["ref_colour"] = color_stats(ref)
    r["motion_lag_mean_abs_diff"] = lag_profile(f)
    r["ref_motion_lag_mean_abs_diff"] = lag_profile(ref)
    rp = probe(ref_path)
    rv = [s for s in rp["streams"] if s["codec_type"] == "video"][0]
    r["ref_frames"] = int(rv["nb_read_frames"])
    r["ref_duration_s"] = float(rp["format"]["duration"])
    checks = {
        "h264": r["codec"] == "h264",
        "mp4_container": "mp4" in r["container"],
        "1080p": (r["width"], r["height"]) == (1920, 1080),
        "fps_30_exact": r["r_frame_rate"] == "30/1" and r["avg_frame_rate"] == "30/1",
        "frame_count_matches_reference": r["nb_read_frames"] == expect_frames == r["ref_frames"],
        "duration_equals_frames_over_30": abs(r["format_duration_s"] - expect_frames / 30) < 1e-3,
        "decodes_cleanly": r["decode_errors"] is None,
        "no_black_frames": not r["black_segments"],
        "no_frozen_segments": not r["frozen_segments"],
        "no_duplicate_frames": r["duplicate_consecutive_frames"] == 0,
        "no_diff_spikes": r["diff_spikes_over_3x_median"] == 0,
        "yuv420p": r["pix_fmt"] == "yuv420p",
    }
    r["checks"] = checks
    r["all_pass"] = all(checks.values())
    return r

if __name__ == "__main__":
    ref1, ref2, d = sys.argv[1:4]
    jobs = [
        ("Composition1_V1_Reference_1080p.mp4", ref1, 480),
        ("Composition1_V2_EmeraldLagoon_1080p.mp4", ref1, 480),
        ("Composition2_V1_Reference_1080p.mp4", ref2, 540),
        ("Composition2_V2_LowAngleDolly_1080p.mp4", ref2, 540),
    ]
    res = [analyse(os.path.join(d, f), rp, n) for f, rp, n in jobs if os.path.exists(os.path.join(d, f))]
    print(json.dumps(res, indent=1))
