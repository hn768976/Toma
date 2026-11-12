#!/usr/bin/env python3
"""Technical QC for the delivered MP4s.

Checks per video: container/stream metadata (codec, resolution, fps, frame
count, duration, pixel format, audio), full decode for errors, black frames,
frozen frames, luminance flicker, per-frame difference spikes (corrupt /
glitched frames) and, where a reference is given, duration / frame-count match.

Usage: python3 qc_check.py <video> [<reference>] [--loop]
Outputs a JSON report on stdout.
"""
import json
import re
import subprocess
import sys


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path):
    out = run([
        "ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format",
        "-of", "json", path,
    ])
    return json.loads(out.stdout)


def frame_stats(path):
    """Per-frame mean luma (YAVG) and mean abs difference to previous frame."""
    out = run([
        "ffmpeg", "-v", "error", "-i", path, "-vf",
        "scale=480:-2,signalstats,metadata=print:file=-", "-f", "null", "-",
    ])
    yavg = [float(m) for m in re.findall(r"lavfi\.signalstats\.YAVG=([\d.]+)", out.stdout)]
    out2 = run([
        "ffmpeg", "-v", "error", "-i", path, "-vf",
        "scale=480:-2,format=gray,tblend=all_mode=difference,signalstats,metadata=print:file=-",
        "-f", "null", "-",
    ])
    diff = [float(m) for m in re.findall(r"lavfi\.signalstats\.YAVG=([\d.]+)", out2.stdout)]
    return yavg, diff


def first_last_diff(path, n_frames):
    """Mean abs luma difference between frame 0 and the last frame (loop check)."""
    out = run([
        "ffmpeg", "-v", "error", "-i", path, "-vf",
        f"select='eq(n\\,0)+eq(n\\,{n_frames - 1})',scale=480:-2,format=gray,"
        "tblend=all_mode=difference,signalstats,metadata=print:file=-",
        "-vsync", "0", "-f", "null", "-",
    ])
    vals = [float(m) for m in re.findall(r"lavfi\.signalstats\.YAVG=([\d.]+)", out.stdout)]
    return vals[-1] if vals else None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    loop = "--loop" in sys.argv
    path = args[0]
    ref = args[1] if len(args) > 1 else None
    rep = {"file": path}

    p = probe(path)
    v = [s for s in p["streams"] if s["codec_type"] == "video"][0]
    a = [s for s in p["streams"] if s["codec_type"] == "audio"]
    n = int(v["nb_read_frames"])
    rep["codec"] = v["codec_name"]
    rep["profile"] = v.get("profile")
    rep["resolution"] = f'{v["width"]}x{v["height"]}'
    rep["pix_fmt"] = v["pix_fmt"]
    rep["r_frame_rate"] = v["r_frame_rate"]
    rep["avg_frame_rate"] = v["avg_frame_rate"]
    rep["frames"] = n
    rep["duration_s"] = round(float(p["format"]["duration"]), 3)
    rep["bitrate_mbps"] = round(int(p["format"]["bit_rate"]) / 1e6, 2)
    rep["audio_streams"] = len(a)

    dec = run(["ffmpeg", "-v", "error", "-i", path, "-f", "null", "-"])
    rep["decode_errors"] = dec.stderr.strip().splitlines()

    blk = run(["ffmpeg", "-v", "info", "-i", path, "-vf",
               "blackdetect=d=0.033:pix_th=0.10:pic_th=0.98", "-an", "-f", "null", "-"])
    rep["black_segments"] = re.findall(r"black_start:\S+ black_end:\S+ black_duration:\S+", blk.stderr)

    frz = run(["ffmpeg", "-v", "info", "-i", path, "-vf",
               "freezedetect=n=0.0005:d=0.2", "-an", "-f", "null", "-"])
    rep["frozen_segments"] = re.findall(r"freeze_start: \S+", frz.stderr)

    yavg, diff = frame_stats(path)
    if yavg:
        jumps = [abs(yavg[i] - yavg[i - 1]) for i in range(1, len(yavg))]
        rep["luma_mean"] = round(sum(yavg) / len(yavg), 2)
        rep["luma_min"] = round(min(yavg), 2)
        rep["luma_max"] = round(max(yavg), 2)
        rep["max_luma_jump_between_frames"] = round(max(jumps), 3)
        rep["flicker_frames(luma jump>4)"] = [i for i, j in enumerate(jumps, 1) if j > 4]
    if diff:
        d = diff[1:]  # first frame has nothing to diff against
        mean_d = sum(d) / len(d)
        rep["mean_frame_diff"] = round(mean_d, 3)
        rep["max_frame_diff"] = round(max(d), 3)
        rep["diff_spike_frames(>4x mean & >6)"] = [
            i + 1 for i, x in enumerate(d) if x > 4 * mean_d and x > 6
        ]
    if loop:
        rep["loop_first_vs_last_mean_abs_luma_diff"] = first_last_diff(path, n)

    if ref:
        pr = probe(ref)
        rv = [s for s in pr["streams"] if s["codec_type"] == "video"][0]
        rep["reference"] = {
            "file": ref,
            "frames": int(rv["nb_read_frames"]),
            "r_frame_rate": rv["r_frame_rate"],
            "duration_s": round(float(pr["format"]["duration"]), 3),
        }
        rep["frame_count_matches_reference"] = n == int(rv["nb_read_frames"])
        rep["duration_delta_vs_reference_s"] = round(
            rep["duration_s"] - rep["reference"]["duration_s"], 3)

    checks = {
        "h264": rep["codec"] == "h264",
        "1080p": rep["resolution"] == "1920x1080",
        "30fps": rep["r_frame_rate"] == "30/1" and rep["avg_frame_rate"] == "30/1",
        "no_decode_errors": not rep["decode_errors"],
        "no_black_frames": not rep["black_segments"],
        "no_frozen_segments": not rep["frozen_segments"],
        "no_flicker": not rep.get("flicker_frames(luma jump>4)"),
        "no_corrupt_frame_spikes": not rep.get("diff_spike_frames(>4x mean & >6)"),
        "yuv420p": rep["pix_fmt"] == "yuv420p",
    }
    if ref:
        checks["frame_count_matches_reference"] = rep["frame_count_matches_reference"]
    rep["checks"] = checks
    rep["PASS"] = all(checks.values())
    print(json.dumps(rep, indent=2))


if __name__ == "__main__":
    main()
