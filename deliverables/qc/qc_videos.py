#!/usr/bin/env python3
"""
Technical QC for the delivered MP4s.

For every video:
  * stream metadata via ffprobe (codec, profile, resolution, pixel format,
    frame rate, exact frame count, duration, audio streams)
  * full decode with ffmpeg (-xerror) to catch corrupt packets / frames
  * ffmpeg blackdetect over the whole clip
  * per-frame analysis on a 320x180 decode of every frame:
      - mean luma (unintended black frames, sudden exposure jumps)
      - frame-to-frame mean absolute difference (frozen / duplicated frames,
        flicker spikes, hard cuts)
  * comparison of duration / frame count / fps with its reference clip

Usage: python3 qc_videos.py out.json video1.mp4:ref1.mp4 [video2.mp4:ref2.mp4 ...]
"""
import json
import subprocess
import sys

import numpy as np

W, H = 320, 180


def ffprobe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", path],
        capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(out)


def full_decode(path):
    r = subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-i", path, "-f", "null", "-"],
                       capture_output=True, text=True)
    return r.returncode, r.stderr.strip()


def blackdetect(path):
    r = subprocess.run(
        ["ffmpeg", "-v", "info", "-i", path, "-vf", "blackdetect=d=0.03:pic_th=0.95:pix_th=0.06", "-an", "-f", "null", "-"],
        capture_output=True, text=True)
    return [l.strip() for l in r.stderr.splitlines() if "black_start" in l]


def frame_stats(path):
    p = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}:flags=area", "-pix_fmt", "gray", "-f", "rawvideo", "-"],
        capture_output=True, check=True)
    frames = np.frombuffer(p.stdout, dtype=np.uint8).reshape(-1, H, W).astype(np.float32)
    luma = frames.mean(axis=(1, 2))
    diff = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))
    dl = np.abs(np.diff(luma))
    med = float(np.median(diff))
    return {
        "frames_decoded": int(len(frames)),
        "luma_min": round(float(luma.min()), 2),
        "luma_max": round(float(luma.max()), 2),
        "luma_mean": round(float(luma.mean()), 2),
        "frames_below_luma_16": int((luma < 16).sum()),
        "max_frame_to_frame_luma_jump": round(float(dl.max()), 3),
        "frame_diff_median": round(med, 3),
        "frame_diff_max": round(float(diff.max()), 3),
        "frame_diff_max_at_frame": int(diff.argmax()) + 1,
        "frozen_frames(diff<0.02)": int((diff < 0.02).sum()),
        "diff_spikes(>6x median and >2.0)": int(((diff > 6 * med) & (diff > 2.0)).sum()),
    }


def main():
    out_json = sys.argv[1]
    results = []
    for arg in sys.argv[2:]:
        vid, ref = arg.split(":")
        info = ffprobe(vid)
        refinfo = ffprobe(ref)
        v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
        rv = [s for s in refinfo["streams"] if s["codec_type"] == "video"][0]
        audio = [s for s in info["streams"] if s["codec_type"] == "audio"]
        ref_audio = [s for s in refinfo["streams"] if s["codec_type"] == "audio"]
        rc, err = full_decode(vid)
        res = {
            "file": vid,
            "reference": ref,
            "codec": v["codec_name"],
            "profile": v.get("profile"),
            "pix_fmt": v.get("pix_fmt"),
            "width": v["width"],
            "height": v["height"],
            "r_frame_rate": v["r_frame_rate"],
            "avg_frame_rate": v["avg_frame_rate"],
            "nb_read_frames": int(v["nb_read_frames"]),
            "stream_duration": float(v["duration"]),
            "container_duration": float(info["format"]["duration"]),
            "format": info["format"]["format_name"],
            "bit_rate_kbps": round(int(info["format"]["bit_rate"]) / 1000),
            "size_mb": round(int(info["format"]["size"]) / 1e6, 2),
            "audio_streams": len(audio),
            "ref_frames": int(rv["nb_read_frames"]),
            "ref_duration": float(rv["duration"]),
            "ref_fps": rv["r_frame_rate"],
            "ref_audio_streams": len(ref_audio),
            "full_decode_returncode": rc,
            "full_decode_errors": err,
            "blackdetect": blackdetect(vid),
            **frame_stats(vid),
        }
        res["checks"] = {
            "h264": res["codec"] == "h264",
            "mp4_container": "mp4" in res["format"],
            "1080p": (res["width"], res["height"]) == (1920, 1080),
            "fps_exactly_30": res["r_frame_rate"] == "30/1" and res["avg_frame_rate"] == "30/1",
            "frame_count_matches_reference": res["nb_read_frames"] == res["ref_frames"],
            "duration_matches_reference": abs(res["stream_duration"] - res["ref_duration"]) < 1e-3,
            "decodes_without_errors": rc == 0 and not err,
            "no_black_frames": not res["blackdetect"] and res["frames_below_luma_16"] == 0,
            "no_frozen_frames": res["frozen_frames(diff<0.02)"] == 0,
            "no_flicker_spikes": res["diff_spikes(>6x median and >2.0)"] == 0,
            "audio_matches_reference(none)": res["audio_streams"] == res["ref_audio_streams"] == 0,
        }
        res["all_passed"] = all(res["checks"].values())
        results.append(res)
        print(json.dumps(res, indent=2))
    json.dump(results, open(out_json, "w"), indent=2)


if __name__ == "__main__":
    main()
