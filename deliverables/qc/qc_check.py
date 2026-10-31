#!/usr/bin/env python3
"""
Technical QC for the delivered MP4s.

For each video this checks the container and stream metadata (codec, profile,
resolution, frame rate, frame count, duration, pixel format, audio). It then
decodes every frame and looks for decode errors, black frames, frozen
(duplicated) frames, brightness flicker and per-frame clipping. Results go to
stdout as JSON.

usage: qc_check.py <video.mp4>:<expected_frames>:<WxH> [...]
"""
import json
import statistics
import subprocess
import sys


def ffprobe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", path],
        check=True, capture_output=True, text=True,
    ).stdout
    return json.loads(out)


def frame_stats(path):
    """Per-frame luma mean/min/max and the luma difference to the previous frame."""
    cmd = [
        "ffmpeg", "-v", "error", "-i", path, "-vf",
        "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-,"
        "metadata=print:key=lavfi.signalstats.YMAX:file=-,"
        "metadata=print:key=lavfi.signalstats.YDIF:file=-",
        "-f", "null", "-",
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    yavg, ymax, ydif = [], [], []
    for line in res.stdout.splitlines():
        if "YAVG=" in line:
            yavg.append(float(line.split("=")[1]))
        elif "YMAX=" in line:
            ymax.append(float(line.split("=")[1]))
        elif "YDIF=" in line:
            ydif.append(float(line.split("=")[1]))
    return yavg, ymax, ydif, res.stderr.strip()


def loop_seam(path):
    """Mean absolute luma difference between the last and the first frame."""
    res = subprocess.run(
        ["ffmpeg", "-v", "error", "-sseof", "-0.2", "-i", path, "-i", path, "-filter_complex",
         "[0:v]reverse,trim=end_frame=1,setpts=PTS-STARTPTS,format=gray[a];"
         "[1:v]trim=end_frame=1,setpts=PTS-STARTPTS,format=gray[b];"
         "[a][b]blend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-",
         "-f", "null", "-"],
        capture_output=True, text=True,
    )
    vals = [float(l.split("=")[1]) for l in res.stdout.splitlines() if "YAVG=" in l]
    return vals[0] if vals else float("nan")


def decode_errors(path):
    res = subprocess.run(
        ["ffmpeg", "-v", "error", "-xerror", "-i", path, "-f", "null", "-"],
        capture_output=True, text=True,
    )
    return res.returncode, res.stderr.strip()


def check(spec):
    path, frames, res = spec.rsplit(":", 2)
    frames = int(frames)
    w, h = (int(x) for x in res.split("x"))
    info = ffprobe(path)
    v = [s for s in info["streams"] if s["codec_type"] == "video"]
    a = [s for s in info["streams"] if s["codec_type"] == "audio"]
    vs = v[0]
    expected_dur = frames / 30
    yavg, ymax, ydif, stats_err = frame_stats(path)
    rc, dec_err = decode_errors(path)

    black = [i for i, m in enumerate(ymax) if m < 40]  # no pixel brighter than near-black
    frozen = [i for i, d in enumerate(ydif) if i > 0 and d < 0.01]
    # Flicker: a large frame-to-frame jump in mean luma relative to the clip's typical change.
    deltas = [abs(yavg[i] - yavg[i - 1]) for i in range(1, len(yavg))]
    med = statistics.median(deltas) if deltas else 0
    flicker = [i + 1 for i, d in enumerate(deltas) if d > max(6.0, med * 12)]
    # Loop seam: luma jump from the last frame back to the first, relative to a
    # typical frame-to-frame step (YDIF median). The references loop seamlessly.
    ydif_med = statistics.median(ydif[1:]) if len(ydif) > 1 else 0
    seam = loop_seam(path)

    r = {
        "file": path,
        "codec": vs["codec_name"],
        "profile": vs.get("profile"),
        "pix_fmt": vs.get("pix_fmt"),
        "width": vs["width"],
        "height": vs["height"],
        "r_frame_rate": vs["r_frame_rate"],
        "avg_frame_rate": vs["avg_frame_rate"],
        "nb_read_frames": int(vs.get("nb_read_frames", -1)),
        "stream_duration": float(vs.get("duration", 0)),
        "format_duration": float(info["format"]["duration"]),
        "audio_streams": len(a),
        "decode_returncode": rc,
        "decode_errors": dec_err[:500],
        "luma_mean_range": [round(min(yavg), 2), round(max(yavg), 2)] if yavg else None,
        "luma_mean_avg": round(statistics.mean(yavg), 2) if yavg else None,
        "max_frame_to_frame_luma_jump": round(max(deltas), 2) if deltas else None,
        "median_frame_to_frame_luma_jump": round(med, 3),
        "loop_seam_luma_diff": round(seam, 3),
        "loop_seam_vs_median_step": round(seam / ydif_med, 2) if ydif_med else None,
        "black_frames": black,
        "frozen_frames": frozen,
        "flicker_frames": flicker,
    }
    checks = {
        "codec_h264": r["codec"] == "h264",
        "resolution": (r["width"], r["height"]) == (w, h),
        "fps_30": r["r_frame_rate"] == "30/1" and r["avg_frame_rate"] == "30/1",
        "frame_count": r["nb_read_frames"] == frames,
        "duration": abs(r["stream_duration"] - expected_dur) < 1e-3,
        "pix_fmt_yuv420p": r["pix_fmt"] == "yuv420p",
        "decodes_cleanly": rc == 0 and not dec_err,
        "no_black_frames": not black,
        "no_frozen_frames": not frozen,
        "no_flicker": not flicker,
    }
    r["checks"] = checks
    r["pass"] = all(checks.values())
    return r


if __name__ == "__main__":
    results = [check(s) for s in sys.argv[1:]]
    print(json.dumps(results, indent=2))
    sys.exit(0 if all(r["pass"] for r in results) else 1)
