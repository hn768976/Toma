#!/usr/bin/env python3
"""Technical QC for the delivered MP4s.

Checks per file: container/codec (H.264), resolution (1920x1080), exact 30/1 fps,
frame count and duration vs. the reference clip, full decode without errors,
black frames, frozen frames, luminance flicker, audio streams.
Usage: qc_videos.py <deliverable.mp4>:<reference.mp4> ...
"""
import json, re, subprocess, sys

def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", path],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)

def luma_series(path):
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-",
                          "-f", "null", "-"], capture_output=True, text=True).stdout
    return [float(v) for v in re.findall(r"YAVG=([0-9.]+)", out)]

def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr

results = []
for arg in sys.argv[1:]:
    path, ref = arg.split(":", 1)
    r = {"file": path.split("/")[-1]}
    info = probe(path)
    refinfo = probe(ref)
    v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
    rv = [s for s in refinfo["streams"] if s["codec_type"] == "video"][0]
    a = [s for s in info["streams"] if s["codec_type"] == "audio"]
    ref_dur = float(refinfo["format"]["duration"])
    r["codec"] = f'{v["codec_name"]} ({v.get("profile")}, {v.get("pix_fmt")})'
    r["resolution"] = f'{v["width"]}x{v["height"]}'
    r["fps"] = v["r_frame_rate"] + " / avg " + v["avg_frame_rate"]
    r["frames"] = int(v["nb_read_frames"])
    r["duration_s"] = float(info["format"]["duration"])
    r["video_stream_duration_s"] = float(v["duration"])
    r["reference_duration_s"] = ref_dur
    r["expected_frames"] = round(ref_dur * 30)
    r["audio_streams"] = len(a)
    r["reference_audio_streams"] = len([s for s in refinfo["streams"] if s["codec_type"] == "audio"])
    rc, err = run(["ffmpeg", "-v", "error", "-xerror", "-i", path, "-f", "null", "-"])
    r["decode_errors"] = "none" if rc == 0 and not err.strip() else err.strip()[:300]
    _, bd = run(["ffmpeg", "-v", "info", "-i", path, "-vf", "blackdetect=d=0.03:pix_th=0.06:pic_th=0.98", "-an", "-f", "null", "-"])
    r["black_segments"] = len(re.findall(r"black_start", bd))
    _, fd = run(["ffmpeg", "-v", "info", "-i", path, "-vf", "freezedetect=n=0.0005:d=0.5", "-an", "-f", "null", "-"])
    r["frozen_segments_over_0.5s"] = len(re.findall(r"freeze_start", fd))
    y = luma_series(path)
    jumps = [abs(y[i + 1] - y[i]) for i in range(len(y) - 1)]
    r["luma_min_avg_max"] = [round(min(y), 1), round(sum(y) / len(y), 1), round(max(y), 1)]
    r["max_frame_to_frame_luma_jump"] = round(max(jumps), 2)
    r["flicker_events(>6 luma, sign-alternating)"] = sum(
        1 for i in range(1, len(jumps)) if jumps[i] > 6 and jumps[i - 1] > 6 and (y[i + 1] - y[i]) * (y[i] - y[i - 1]) < 0)
    ok = (v["codec_name"] == "h264" and v["width"] == 1920 and v["height"] == 1080 and v["r_frame_rate"] == "30/1"
          and v["avg_frame_rate"] == "30/1" and r["frames"] == r["expected_frames"]
          and abs(r["video_stream_duration_s"] - ref_dur) < 1e-3 and r["decode_errors"] == "none"
          and r["black_segments"] == 0 and r["audio_streams"] == r["reference_audio_streams"])
    r["PASS"] = ok
    results.append(r)
print(json.dumps(results, indent=2))
