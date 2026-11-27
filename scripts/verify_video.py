#!/usr/bin/env python3
"""verify_video.py - step 8A technical checks for one rendered MP4.

usage: verify_video.py VIDEO REFERENCE EXPECTED_FRAMES OUTDIR [--allow-static-until N]

Checks: container/stream specs, duration vs reference, full decode, per-frame
scan (blank frames, frozen runs, brightness jumps) and writes a contact sheet
(one frame per second) plus a x4 levels-stretched sheet for banding review.
Prints a JSON summary and writes it to OUTDIR/<name>.checks.json.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path):
    r = run(["ffprobe", "-v", "error", "-count_frames", "-show_entries",
             "format=duration:stream=index,codec_type,codec_name,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_read_frames,duration",
             "-of", "json", path])
    return json.loads(r.stdout)


def main():
    video, ref, expected, outdir = sys.argv[1], sys.argv[2], int(sys.argv[3]), Path(sys.argv[4])
    allow_static_until = int(sys.argv[sys.argv.index("--allow-static-until") + 1]) if "--allow-static-until" in sys.argv else 0
    outdir.mkdir(parents=True, exist_ok=True)
    name = Path(video).stem
    out = {"file": Path(video).name}

    p = probe(video)
    v = [s for s in p["streams"] if s["codec_type"] == "video"][0]
    audio = [s for s in p["streams"] if s["codec_type"] == "audio"]
    rp = probe(ref)
    ref_dur = float(rp["format"]["duration"])
    dur = float(p["format"]["duration"])
    out["specs"] = {
        "width": v["width"], "height": v["height"], "codec": v["codec_name"], "pix_fmt": v["pix_fmt"],
        "r_frame_rate": v["r_frame_rate"], "avg_frame_rate": v["avg_frame_rate"],
        "frames": int(v["nb_read_frames"]), "audio_streams": len(audio),
        "duration": dur, "reference_duration": ref_dur, "duration_diff": dur - ref_dur,
    }
    out["specs_pass"] = (
        v["width"] == 1920 and v["height"] == 1080 and v["codec_name"] == "h264" and v["pix_fmt"] == "yuv420p"
        and v["r_frame_rate"] == "30/1" and v["avg_frame_rate"] == "30/1"
        and int(v["nb_read_frames"]) == expected and not audio
    )
    out["duration_pass"] = abs(dur - ref_dur) < 1 / 30

    d = run(["ffmpeg", "-v", "error", "-i", video, "-f", "null", "-"])
    out["decode_errors"] = d.stderr.strip()
    out["integrity_pass"] = d.returncode == 0 and not d.stderr.strip()

    # Per-frame scan on a 320x180 gray proxy.
    W, H = 320, 180
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-i", video, "-vf", f"scale={W}:{H}:flags=area,format=gray",
                             "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
    means, diffs, prev = [], [], None
    while True:
        buf = proc.stdout.read(W * H)
        if len(buf) < W * H:
            break
        f = np.frombuffer(buf, np.uint8).astype(np.float32)
        means.append(float(f.mean()))
        if prev is not None:
            diffs.append(float(np.abs(f - prev).mean()))
        prev = f
    means = np.array(means)
    diffs = np.array(diffs)
    blank = [int(i) for i in np.where(means < 1.0)[0]]
    frozen = [int(i) + 1 for i in np.where(diffs < 0.02)[0] if i + 1 >= allow_static_until]
    jumps = np.abs(np.diff(means))
    # flicker: a brightness step that immediately reverses
    flick = [int(i) + 1 for i in range(len(jumps) - 1)
             if jumps[i] > 2.0 and jumps[i + 1] > 2.0 and np.sign(means[i + 1] - means[i]) != np.sign(means[i + 2] - means[i + 1])]
    out["scan"] = {
        "frames_scanned": len(means),
        "mean_brightness_min": float(means.min()), "mean_brightness_max": float(means.max()),
        "blank_frames": blank[:20], "frozen_frames": frozen[:20], "n_frozen": len(frozen),
        "max_brightness_step": float(jumps.max()), "max_brightness_step_at": int(jumps.argmax()) + 1,
        "flicker_frames": flick[:20],
        "frame_diff_min": float(diffs.min()), "frame_diff_median": float(np.median(diffs)), "frame_diff_max": float(diffs.max()),
    }
    out["scan_pass"] = not blank and not frozen and not flick

    # Contact sheets: one frame per second; and x4 levels stretch of the darkest quarter of the range.
    sheet = outdir / f"{name}.contact.png"
    cols = 8
    run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vf", f"fps=1,scale=320:-1,tile={cols}x{int(np.ceil(dur / cols))}",
         "-frames:v", "1", str(sheet)])
    out["contact_sheet"] = str(sheet)
    mid = outdir / f"{name}.mid.png"
    run(["ffmpeg", "-v", "error", "-y", "-ss", str(dur / 2), "-i", video, "-frames:v", "1", str(mid)])
    a = np.asarray(Image.open(mid).convert("RGB")).astype(np.float32)
    Image.fromarray(np.clip(a * 4, 0, 255).astype(np.uint8)).save(outdir / f"{name}.stretch-dark.png")
    Image.fromarray(np.clip((a - 191.25) * 4, 0, 255).astype(np.uint8)).save(outdir / f"{name}.stretch-bright.png")

    (outdir / f"{name}.checks.json").write_text(json.dumps(out, indent=1))
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
