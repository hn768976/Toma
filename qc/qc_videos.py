#!/usr/bin/env python3
"""Technical QC for the delivered MP4s.

For each video: stream metadata (codec, profile, resolution, fps, pixel format,
frame count, duration, audio streams), a full decode pass (any decoder error
fails), black-frame and frozen-frame detection, and a per-frame luma analysis
that flags flicker (sudden single-frame brightness spikes).

Usage: qc_videos.py <reference.mp4> <video.mp4> [<video.mp4> ...]
Prints a JSON report to stdout.
"""
import json
import re
import subprocess
import sys


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path):
    out = run([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-count_frames",
        "-of", "json", path,
    ])
    if out.returncode != 0:
        raise RuntimeError(out.stderr)
    return json.loads(out.stdout)


def frac(s):
    n, d = s.split("/")
    return float(n) / float(d) if float(d) else 0.0


def luma_series(path):
    # Mean luma (YAVG) per frame via signalstats.
    out = run([
        "ffmpeg", "-v", "error", "-i", path, "-vf",
        "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-",
        "-f", "null", "-",
    ])
    vals = [float(m) for m in re.findall(r"YAVG=([\d.]+)", out.stdout)]
    return vals


def detect(path, filt, key):
    out = run(["ffmpeg", "-v", "info", "-i", path, "-vf", filt, "-f", "null", "-"])
    return [l.strip() for l in out.stderr.splitlines() if key in l]


def qc(path, ref_frames=None):
    p = probe(path)
    v = [s for s in p["streams"] if s["codec_type"] == "video"]
    a = [s for s in p["streams"] if s["codec_type"] == "audio"]
    vs = v[0]
    decode = run(["ffmpeg", "-v", "error", "-xerror", "-i", path, "-f", "null", "-"])
    luma = luma_series(path)
    diffs = [abs(luma[i] - luma[i - 1]) for i in range(1, len(luma))]
    # Flicker = a frame that jumps away from BOTH neighbours in opposite directions.
    flicker = []
    for i in range(1, len(luma) - 1):
        d1 = luma[i] - luma[i - 1]
        d2 = luma[i + 1] - luma[i]
        if abs(d1) > 4.0 and abs(d2) > 4.0 and d1 * d2 < 0:
            flicker.append(i)
    black = detect(path, "blackdetect=d=0.03:pix_th=0.10", "black_start")
    frozen = detect(path, "freezedetect=n=0.0005:d=0.5", "freeze_start")
    rep = {
        "file": path,
        "codec": vs["codec_name"],
        "profile": vs.get("profile"),
        "width": vs["width"],
        "height": vs["height"],
        "pix_fmt": vs.get("pix_fmt"),
        "r_frame_rate": vs["r_frame_rate"],
        "avg_frame_rate": vs["avg_frame_rate"],
        "fps": round(frac(vs["avg_frame_rate"]), 6),
        "nb_frames": int(vs.get("nb_read_frames") or vs.get("nb_frames")),
        "duration_s": round(float(p["format"]["duration"]), 6),
        "stream_duration_s": round(float(vs.get("duration", 0)), 6),
        "bitrate_kbps": round(int(p["format"]["bit_rate"]) / 1000),
        "audio_streams": len(a),
        "decode_errors": decode.stderr.strip()[:500] or None,
        "luma_min": round(min(luma), 2) if luma else None,
        "luma_max": round(max(luma), 2) if luma else None,
        "max_frame_to_frame_luma_change": round(max(diffs), 3) if diffs else None,
        "flicker_frames": flicker,
        "black_segments": black,
        "frozen_segments": frozen,
    }
    if ref_frames is not None:
        rep["matches_reference_frame_count"] = rep["nb_frames"] == ref_frames
    return rep


if __name__ == "__main__":
    ref = sys.argv[1]
    rp = probe(ref)
    rv = [s for s in rp["streams"] if s["codec_type"] == "video"][0]
    ref_info = {
        "file": ref,
        "fps": round(frac(rv["avg_frame_rate"]), 6),
        "nb_frames": int(rv["nb_read_frames"]),
        "duration_s": round(float(rp["format"]["duration"]), 6),
        "audio_streams": len([s for s in rp["streams"] if s["codec_type"] == "audio"]),
    }
    reports = [qc(f, ref_info["nb_frames"]) for f in sys.argv[2:]]
    print(json.dumps({"reference": ref_info, "videos": reports}, indent=2))
