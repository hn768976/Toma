#!/usr/bin/env python3
"""Technical QC for delivered MP4s.

usage: qc_video.py <video.mp4> <expected_frames> [reference.mp4]

Checks: container/codec/profile, resolution, exact frame rate, frame count and
duration (vs. expected / reference), full decode without errors, black
frames, frozen runs, frame-to-frame luminance flicker, audio streams.
Prints a JSON report.
"""
import json
import subprocess
import sys


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path):
    out = run([
        "ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", path,
    ])
    return json.loads(out.stdout)


def main():
    path, expected = sys.argv[1], int(sys.argv[2])
    ref = sys.argv[3] if len(sys.argv) > 3 else None
    info = probe(path)
    v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
    audio = [s for s in info["streams"] if s["codec_type"] == "audio"]
    report = {
        "file": path.split("/")[-1],
        "format": info["format"]["format_name"],
        "codec": v["codec_name"],
        "profile": v.get("profile"),
        "pix_fmt": v.get("pix_fmt"),
        "width": v["width"],
        "height": v["height"],
        "r_frame_rate": v["r_frame_rate"],
        "avg_frame_rate": v["avg_frame_rate"],
        "frames": int(v["nb_read_frames"]),
        "stream_duration_s": float(v["duration"]),
        "bitrate_kbps": round(int(info["format"]["bit_rate"]) / 1000),
        "audio_streams": len(audio),
    }
    if ref:
        rv = [s for s in probe(ref)["streams"] if s["codec_type"] == "video"][0]
        report["reference_frames"] = int(rv["nb_read_frames"])
        report["reference_duration_s"] = float(rv["duration"])

    # full decode: any error output means corrupt data
    dec = run(["ffmpeg", "-v", "error", "-i", path, "-f", "null", "-"])
    report["decode_errors"] = dec.stderr.strip().splitlines()[:5]

    # black frames, frozen runs and per-frame luma stats
    filt = ("blackdetect=d=0.03:pix_th=0.06,freezedetect=n=0.0005:d=0.5,"
            "signalstats,metadata=print:key=lavfi.signalstats.YAVG")
    an = run(["ffmpeg", "-v", "info", "-i", path, "-vf", filt, "-an", "-f", "null", "-"])
    err = an.stderr
    report["black_segments"] = [l.split("]")[-1].strip() for l in err.splitlines() if "black_start" in l]
    report["frozen_segments"] = [l.split("]")[-1].strip() for l in err.splitlines() if "freeze_start" in l]
    yavg = [float(l.split("=")[-1]) for l in err.splitlines() if "lavfi.signalstats.YAVG" in l]
    diffs = [abs(b - a) for a, b in zip(yavg, yavg[1:])]
    report["luma_min"] = round(min(yavg), 2)
    report["luma_max"] = round(max(yavg), 2)
    report["max_frame_to_frame_luma_jump"] = round(max(diffs), 3) if diffs else 0
    # flicker: a spike up then straight back down (or vice versa) between neighbours
    spikes = 0
    for a, b, c in zip(yavg, yavg[1:], yavg[2:]):
        if abs(b - a) > 2.0 and abs(c - b) > 2.0 and (b - a) * (c - b) < 0:
            spikes += 1
    report["flicker_spikes"] = spikes

    checks = {
        "h264": report["codec"] == "h264",
        "mp4": "mp4" in report["format"],
        "1080p": (report["width"], report["height"]) == (1920, 1080),
        "30fps": report["r_frame_rate"] == "30/1" and report["avg_frame_rate"] == "30/1",
        "frame_count": report["frames"] == expected,
        "duration_matches_reference": (abs(report["stream_duration_s"] - report["reference_duration_s"]) < 1e-3
                                       and report["frames"] == report["reference_frames"]) if ref else None,
        "decodes_cleanly": not report["decode_errors"],
        "no_black_frames": not report["black_segments"],
        "no_frozen_segments": not report["frozen_segments"],
        "no_flicker": spikes == 0,
        "no_audio_expected_none": report["audio_streams"] == 0,
    }
    report["checks"] = checks
    report["PASS"] = all(v is not False for v in checks.values())
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
