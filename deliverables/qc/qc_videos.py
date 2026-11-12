#!/usr/bin/env python3
"""Technical QC for the delivered MP4s.

Checks per file: container/stream metadata (codec, profile, resolution,
fps, frame count, duration, pixel format, audio), a full decode for
bitstream errors, black frames, frozen/duplicate frames, frame-to-frame
luma jumps (flicker), and loop continuity (last frame vs first frame).

Usage: qc_videos.py REF_A.mp4 REF_B.mp4 OUT.json VIDEO [VIDEO ...]
"""
import json
import re
import subprocess
import sys


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path):
    r = run([
        "ffprobe", "-v", "error", "-count_frames", "-show_streams",
        "-show_format", "-of", "json", path,
    ])
    return json.loads(r.stdout)


def luma_series(path):
    r = run([
        "ffmpeg", "-v", "error", "-i", path, "-vf",
        "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-",
        "-f", "null", "-",
    ])
    return [float(x) for x in re.findall(r"YAVG=([0-9.]+)", r.stdout)]


def frame_diffs(path):
    """Mean absolute luma difference between consecutive frames (0..255)."""
    r = run([
        "ffmpeg", "-v", "error", "-i", path, "-vf",
        "tblend=all_mode=difference,signalstats,"
        "metadata=print:key=lavfi.signalstats.YAVG:file=-",
        "-f", "null", "-",
    ])
    return [float(x) for x in re.findall(r"YAVG=([0-9.]+)", r.stdout)]


def black_frames(path):
    r = run([
        "ffmpeg", "-v", "info", "-i", path, "-vf",
        "blackdetect=d=0.01:pic_th=0.90:pix_th=0.06", "-an", "-f", "null", "-",
    ])
    return re.findall(r"black_start:\S+ black_end:\S+ black_duration:\S+", r.stderr)


def transient_pops(path, w=480, h=270, thresh=50, block=16, min_block_px=40):
    """Frames where a compact blob flashes for 1-2 frames.

    A pixel "pops" in frame i when it differs from both the frame before the
    event (i-1) and the frame after it (i+1, or i+2 for a two-frame pop) by
    more than `thresh` levels in the same direction, while those surrounding
    frames agree with each other (< thresh/4). Thin moving lines and twinkling
    dots produce scattered pops; a defect blob produces a dense cluster, so a
    frame is flagged only when one block x block tile holds >= min_block_px
    popping pixels.
    """
    import numpy as np
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h}",
         "-pix_fmt", "gray", "-f", "rawvideo", "-"],
        capture_output=True).stdout
    f = np.frombuffer(raw, dtype=np.uint8).reshape(-1, h, w).astype(np.int16)
    n = len(f)
    hb, wb = h // block, w // block
    pops = []
    for i in range(n):
        prev = f[(i - 1) % n]
        for span in (1, 2):
            nxt = f[(i + span) % n]
            a, b = f[i] - prev, f[i] - nxt
            m = ((np.minimum(np.abs(a), np.abs(b)) > thresh) & (a * b > 0)
                 & (np.abs(prev - nxt) < thresh // 4))
            tiles = m[:hb * block, :wb * block].reshape(hb, block, wb, block).sum((1, 3))
            worst = int(tiles.max())
            if worst >= min_block_px:
                y, x = np.unravel_index(tiles.argmax(), tiles.shape)
                pops.append({"frame": i, "span": span, "block_px": worst,
                             "at_1080p": [int((x + 0.5) * block * 1920 / w),
                                          int((y + 0.5) * block * 1080 / h)]})
                break
    return pops


def decode_errors(path):
    r = run(["ffmpeg", "-v", "error", "-xerror", "-i", path, "-f", "null", "-"])
    return r.stderr.strip()


def loop_psnr(path, nframes):
    r = run([
        "ffmpeg", "-v", "info", "-i", path, "-i", path, "-filter_complex",
        f"[0]select=eq(n\\,0)[a];[1]select=eq(n\\,{nframes - 1})[b];[a][b]psnr",
        "-frames:v", "1", "-f", "null", "-",
    ])
    m = re.search(r"average:([0-9.inf]+)", r.stderr)
    return m.group(1) if m else None


def main():
    ref_a, ref_b, out_json, *videos = sys.argv[1:]
    refs = {}
    for name, p in (("A", ref_a), ("B", ref_b)):
        info = probe(p)
        refs[name] = float(info["format"]["duration"])
    report = {"reference_durations": refs, "videos": []}
    ok_all = True
    for v in videos:
        info = probe(v)
        vs = [s for s in info["streams"] if s["codec_type"] == "video"][0]
        audio = [s for s in info["streams"] if s["codec_type"] == "audio"]
        n = int(vs["nb_read_frames"])
        luma = luma_series(v)
        diffs = frame_diffs(v)
        # flicker: a frame whose mean luma departs from both neighbours by > 6 levels
        flicker = [
            i for i in range(1, len(luma) - 1)
            if abs(luma[i] - luma[i - 1]) > 6 and abs(luma[i] - luma[i + 1]) > 6
            and (luma[i] - luma[i - 1]) * (luma[i] - luma[i + 1]) > 0
        ]
        frozen = [i + 1 for i, d in enumerate(diffs[1:]) if d < 0.02]
        pops = transient_pops(v)
        ref_key = "A" if "NeonPipes" in v else "B"
        fps_num, fps_den = map(int, vs["r_frame_rate"].split("/"))
        avg_num, avg_den = map(int, vs["avg_frame_rate"].split("/"))
        rec = {
            "file": v.split("/")[-1],
            "codec": vs["codec_name"],
            "profile": vs.get("profile"),
            "pix_fmt": vs.get("pix_fmt"),
            "width": vs["width"],
            "height": vs["height"],
            "r_frame_rate": vs["r_frame_rate"],
            "avg_frame_rate": vs["avg_frame_rate"],
            "frames": n,
            "duration_s": float(info["format"]["duration"]),
            "stream_duration_s": float(vs.get("duration", 0)),
            "bitrate_kbps": round(int(info["format"]["bit_rate"]) / 1000),
            "size_mb": round(int(info["format"]["size"]) / 1e6, 2),
            "audio_streams": len(audio),
            "decode_errors": decode_errors(v) or "none",
            "black_segments": black_frames(v),
            "luma_min": round(min(luma), 2),
            "luma_max": round(max(luma), 2),
            "luma_mean": round(sum(luma) / len(luma), 2),
            "max_frame_to_frame_luma_jump": round(
                max(abs(luma[i] - luma[i - 1]) for i in range(1, len(luma))), 3),
            "flicker_frames": flicker,
            "frozen_frames": frozen,
            "transient_pop_frames": pops,
            "mean_motion_diff": round(sum(diffs[1:]) / max(1, len(diffs) - 1), 3),
            "loop_psnr_first_vs_last_db": loop_psnr(v, n),
            "reference": ref_key,
            "reference_duration_s": refs[ref_key],
            "reference_frames": 270,
        }
        checks = {
            "h264": rec["codec"] == "h264",
            "1080p": (rec["width"], rec["height"]) == (1920, 1080),
            "fps_30": fps_num / fps_den == 30 and avg_num / avg_den == 30,
            "frames_270": n == 270,
            "duration_9s": abs(rec["duration_s"] - 9.0) < 1e-3,
            "yuv420p": rec["pix_fmt"] == "yuv420p",
            "no_decode_errors": rec["decode_errors"] == "none",
            "no_black_frames": not rec["black_segments"],
            "no_flicker": not flicker,
            "no_frozen_frames": not frozen,
            "no_transient_pops": not pops,
        }
        rec["checks"] = checks
        rec["pass"] = all(checks.values())
        ok_all &= rec["pass"]
        report["videos"].append(rec)
        print(json.dumps(rec, indent=1))
    report["all_pass"] = ok_all
    json.dump(report, open(out_json, "w"), indent=2)
    print("ALL PASS" if ok_all else "SOME CHECKS FAILED")


if __name__ == "__main__":
    main()
