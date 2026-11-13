#!/usr/bin/env python3
"""Technical QC for the delivered MP4s.

For each deliverable: container/stream probe (codec, profile, pixel format,
resolution, frame rate, exact frame count, duration, audio), full decode for
errors, black-frame detection, freeze detection, and a per-frame luma /
frame-difference scan to catch flicker, flashes and corrupted frames.
Results are compared against the matching reference clip.

Usage: python3 qc_videos.py <out.json> <ref.mp4>=<deliverable.mp4> ...
"""
import json
import re
import subprocess
import sys


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    return p.returncode, p.stdout, p.stderr


def probe(path):
    _, out, _ = run([
        "ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format",
        "-of", "json", path,
    ])
    j = json.loads(out)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    a = [s for s in j["streams"] if s["codec_type"] == "audio"]
    num, den = map(int, v["r_frame_rate"].split("/"))
    anum, aden = map(int, v["avg_frame_rate"].split("/"))
    return {
        "codec": v["codec_name"],
        "profile": v.get("profile"),
        "pix_fmt": v.get("pix_fmt"),
        "width": v["width"],
        "height": v["height"],
        "r_frame_rate": num / den,
        "avg_frame_rate": anum / aden if aden else 0,
        "frames": int(v["nb_read_frames"]),
        "stream_duration": float(v.get("duration", 0)),
        "format_duration": float(j["format"]["duration"]),
        "format": j["format"]["format_name"],
        "bit_rate_kbps": round(int(j["format"].get("bit_rate", 0)) / 1000),
        "size_mb": round(int(j["format"]["size"]) / 1e6, 2),
        "audio_streams": len(a),
    }


def decode_errors(path):
    _, _, err = run(["ffmpeg", "-v", "error", "-xerror", "-i", path, "-f", "null", "-"])
    return err.strip()


def detect(path, vf):
    _, _, err = run(["ffmpeg", "-hide_banner", "-i", path, "-vf", vf, "-an", "-f", "null", "-"])
    return err


def black_frames(path):
    # a frame counts as black if >=98% of pixels are below 6% luma
    err = detect(path, "blackdetect=d=0:pic_th=0.98:pix_th=0.06")
    return re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", err)


def freezes(path):
    err = detect(path, "freezedetect=n=0.0003:d=0.5")
    return re.findall(r"freeze_start: ([\d.]+)", err)


def frame_stats(path):
    """Per-frame mean luma and mean abs difference to the previous frame."""
    _, out, _ = run([
        "ffprobe", "-v", "error", "-f", "lavfi",
        "-i", f"movie='{path}',signalstats",
        "-show_entries", "frame_tags=lavfi.signalstats.YAVG",
        "-of", "csv=p=0",
    ])
    yavg = [float(l.strip().strip(",")) for l in out.strip().splitlines() if l.strip()]
    _, out2, _ = run([
        "ffprobe", "-v", "error", "-f", "lavfi",
        "-i", f"movie='{path}',tblend=all_mode=difference,signalstats",
        "-show_entries", "frame_tags=lavfi.signalstats.YAVG", "-of", "csv=p=0",
    ])
    diff = [float(l.strip().strip(",")) for l in out2.strip().splitlines() if l.strip()]
    jumps = [abs(yavg[i] - yavg[i - 1]) for i in range(1, len(yavg))]
    med = sorted(diff)[len(diff) // 2] if diff else 0
    # spikes: frame differences far above the clip's typical motion
    spikes = [i + 1 for i, d in enumerate(diff) if med > 0 and d > max(6 * med, med + 4)]
    return {
        "luma_mean": round(sum(yavg) / len(yavg), 2),
        "luma_min_frame": round(min(yavg), 2),
        "luma_max_frame": round(max(yavg), 2),
        "max_luma_jump_between_frames": round(max(jumps) if jumps else 0, 3),
        "median_frame_diff": round(med, 3),
        "max_frame_diff": round(max(diff) if diff else 0, 3),
        "diff_spike_frames": spikes[:20],
    }


def main():
    out_json = sys.argv[1]
    results = []
    for pair in sys.argv[2:]:
        ref, deliv = pair.split("=", 1)
        r = probe(ref)
        d = probe(deliv)
        res = {
            "file": deliv,
            "reference": ref,
            "probe": d,
            "reference_probe": {k: r[k] for k in ("frames", "format_duration", "r_frame_rate", "width", "height")},
            "decode_errors": decode_errors(deliv),
            "black_segments": black_frames(deliv),
            "freezes": freezes(deliv),
            "stats": frame_stats(deliv),
        }
        checks = {
            "h264": d["codec"] == "h264",
            "mp4_container": "mp4" in d["format"],
            "1080p": d["width"] == 1920 and d["height"] == 1080,
            "fps_30_exact": d["r_frame_rate"] == 30 and abs(d["avg_frame_rate"] - 30) < 1e-9,
            "frame_count_matches_reference": d["frames"] == r["frames"],
            "duration_matches_reference": abs(d["format_duration"] - r["format_duration"]) < 1e-3,
            "no_decode_errors": res["decode_errors"] == "",
            "no_black_frames": len(res["black_segments"]) == 0,
            "no_freezes": len(res["freezes"]) == 0,
            "no_diff_spikes": len(res["stats"]["diff_spike_frames"]) == 0,
            "audio_streams_match_reference": d["audio_streams"] == r["audio_streams"],
        }
        res["checks"] = checks
        res["pass"] = all(checks.values())
        results.append(res)
        print(json.dumps({"file": deliv, "pass": res["pass"], "checks": checks, "probe": d, "stats": res["stats"]}, indent=1))
    with open(out_json, "w") as f:
        json.dump(results, f, indent=2)


if __name__ == "__main__":
    main()
