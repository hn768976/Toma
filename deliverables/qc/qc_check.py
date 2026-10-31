#!/usr/bin/env python3
"""Technical QC for the delivered MP4s.

Usage: python3 qc_check.py <video.mp4> <expected_frames> [reference.mp4]

Checks: container/stream metadata (H.264, 1920x1080, 30 fps CFR, yuv420p,
frame count, duration), full decode with error reporting, black frames,
per-frame luma/chroma statistics (flicker spikes), duplicated/frozen frames
and audio presence. Prints a JSON summary.
"""
import json
import subprocess
import sys


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path):
    r = run([
        "ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format",
        "-of", "json", path,
    ])
    return json.loads(r.stdout)


def frame_stats(path):
    # Per-frame mean luma (YAVG) and saturation via signalstats.
    r = run([
        "ffprobe", "-v", "error", "-f", "lavfi",
        f"movie={path},signalstats",
        "-show_entries", "frame_tags=lavfi.signalstats.YAVG,lavfi.signalstats.SATAVG",
        "-of", "csv=p=0",
    ])
    rows = []
    for line in r.stdout.strip().splitlines():
        parts = [p for p in line.split(",") if p]
        if len(parts) >= 2:
            rows.append((float(parts[0]), float(parts[1])))
    return rows


def frame_hashes(path):
    r = run(["ffmpeg", "-v", "error", "-i", path, "-f", "framemd5", "-"])
    return [l.split(",")[-1].strip() for l in r.stdout.splitlines() if l and not l.startswith("#")]


def main():
    path = sys.argv[1]
    expected = int(sys.argv[2])
    info = probe(path)
    v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
    audio = [s for s in info["streams"] if s["codec_type"] == "audio"]

    decode = run(["ffmpeg", "-v", "error", "-i", path, "-f", "null", "-"])
    black = run([
        "ffmpeg", "-v", "info", "-i", path, "-vf",
        "blackdetect=d=0:pix_th=0.04:pic_th=0.98", "-an", "-f", "null", "-",
    ])
    black_events = [l.strip() for l in black.stderr.splitlines() if "black_start" in l]

    stats = frame_stats(path)
    lum = [s[0] for s in stats]
    # Flicker: a frame whose luma departs from BOTH neighbours in the same
    # direction by a large margin (a one-frame spike), not a smooth ramp.
    spikes = []
    for i in range(1, len(lum) - 1):
        a, b, c = lum[i - 1], lum[i], lum[i + 1]
        d1, d2 = b - a, b - c
        if d1 * d2 > 0 and min(abs(d1), abs(d2)) > 6.0:
            spikes.append({"frame": i, "luma": round(b, 2), "prev": round(a, 2), "next": round(c, 2)})
    max_step = max((abs(lum[i] - lum[i - 1]), i) for i in range(1, len(lum))) if len(lum) > 1 else (0, 0)

    hashes = frame_hashes(path)
    dup_runs = 0
    longest = 1
    cur = 1
    for i in range(1, len(hashes)):
        if hashes[i] == hashes[i - 1]:
            cur += 1
            dup_runs += 1
            longest = max(longest, cur)
        else:
            cur = 1

    fr = v.get("r_frame_rate")
    num, den = (int(x) for x in fr.split("/"))
    out = {
        "file": path,
        "codec": v.get("codec_name"),
        "profile": v.get("profile"),
        "pix_fmt": v.get("pix_fmt"),
        "width": v.get("width"),
        "height": v.get("height"),
        "r_frame_rate": fr,
        "avg_frame_rate": v.get("avg_frame_rate"),
        "fps": num / den,
        "nb_read_frames": int(v.get("nb_read_frames", 0)),
        "expected_frames": expected,
        "stream_duration_s": float(v.get("duration", 0)),
        "format_duration_s": float(info["format"]["duration"]),
        "size_bytes": int(info["format"]["size"]),
        "bit_rate": int(info["format"].get("bit_rate", 0)),
        "audio_streams": len(audio),
        "decode_errors": decode.stderr.strip()[:500],
        "black_segments": black_events,
        "luma_min": round(min(lum), 2) if lum else None,
        "luma_max": round(max(lum), 2) if lum else None,
        "max_frame_to_frame_luma_step": [round(max_step[0], 2), max_step[1]],
        "one_frame_flicker_spikes": spikes,
        "duplicate_consecutive_frames": dup_runs,
        "longest_identical_run": longest,
    }
    checks = {
        "h264": out["codec"] == "h264",
        "1080p": out["width"] == 1920 and out["height"] == 1080,
        "30fps": fr == "30/1" and out["avg_frame_rate"] == "30/1",
        "frame_count": out["nb_read_frames"] == expected,
        "duration": abs(out["format_duration_s"] - expected / 30) < 0.02,
        "yuv420p": out["pix_fmt"] == "yuv420p",
        "decodes_clean": out["decode_errors"] == "",
        "no_black_frames": len(black_events) == 0,
        "no_flicker_spikes": len(spikes) == 0,
    }
    out["checks"] = checks
    out["pass"] = all(checks.values())
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
