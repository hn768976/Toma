#!/usr/bin/env python3
"""Technical QC for delivered MP4s: container/stream metadata, full decode,
black frames, frozen frames, flicker (frame-to-frame luma jumps), audio."""
import json, subprocess, sys

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)

def probe(path):
    r = run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format",
             "-show_streams", "-count_frames", path])
    return json.loads(r.stdout)

def luma_stats(path):
    # per-frame average luma (YAVG) and difference to previous frame (YDIF)
    r = run(["ffprobe", "-v", "error", "-f", "lavfi",
             f"movie={path},signalstats", "-show_entries",
             "frame_tags=lavfi.signalstats.YAVG,lavfi.signalstats.YDIF",
             "-print_format", "json"])
    fr = json.loads(r.stdout)["frames"]
    return [(float(f["tags"]["lavfi.signalstats.YAVG"]), float(f["tags"]["lavfi.signalstats.YDIF"])) for f in fr]

def main(path, ref_frames, ref_dur):
    info = probe(path)
    v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
    a = [s for s in info["streams"] if s["codec_type"] == "audio"]
    dec = run(["ffmpeg", "-v", "error", "-i", path, "-f", "null", "-"])
    ls = luma_stats(path)
    yavg = [x[0] for x in ls]
    ydif = [x[1] for x in ls[1:]]
    black = [i for i, y in enumerate(yavg) if y < 20]
    frozen = [i + 1 for i, d in enumerate(ydif) if d < 0.02]
    mean_d = sum(ydif) / len(ydif)
    spikes = [i + 1 for i, d in enumerate(ydif) if d > max(12, 6 * mean_d)]
    dur = float(info["format"]["duration"])
    res = {
        "file": path.split("/")[-1],
        "codec": v["codec_name"], "profile": v.get("profile"),
        "pix_fmt": v["pix_fmt"], "size": f'{v["width"]}x{v["height"]}',
        "r_frame_rate": v["r_frame_rate"], "avg_frame_rate": v["avg_frame_rate"],
        "frames": int(v["nb_read_frames"]), "duration_s": round(dur, 4),
        "ref_duration_s": ref_dur, "ref_frames_at_30fps": ref_frames,
        "duration_delta_ms": round((dur - ref_dur) * 1000, 1),
        "bitrate_kbps": round(int(info["format"]["bit_rate"]) / 1000),
        "audio_streams": len(a),
        "decode_errors": dec.stderr.strip() or "none",
        "black_frames(YAVG<20)": black[:10], "frozen_frames": frozen[:10],
        "luma_min_max": [round(min(yavg), 1), round(max(yavg), 1)],
        "mean_frame_diff": round(mean_d, 2), "max_frame_diff": round(max(ydif), 2),
        "flicker_spikes": spikes[:10],
    }
    checks = {
        "H.264": v["codec_name"] == "h264",
        "1920x1080": (v["width"], v["height"]) == (1920, 1080),
        "30 fps CFR": v["r_frame_rate"] == "30/1" and v["avg_frame_rate"] == "30/1",
        "frame count": int(v["nb_read_frames"]) == ref_frames,
        "duration within 1 frame of reference": abs(dur - ref_dur) < 1 / 30,
        "clean decode": not dec.stderr.strip(),
        "no black frames": not black,
        "no frozen frames": not frozen,
        "no flicker spikes": not spikes,
    }
    res["checks"] = {k: ("PASS" if ok else "FAIL") for k, ok in checks.items()}
    print(json.dumps(res, indent=1))

if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]), float(sys.argv[3]))
