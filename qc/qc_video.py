#!/usr/bin/env python3
"""Technical QC for delivered MP4 files.

usage: qc_video.py <reference.mp4> <deliverable.mp4> [--json out.json]

Checks: container/stream specs (H.264, 1920x1080, 30 fps CFR, yuv420p, no
audio unless the reference has audio), exact frame count / duration vs the
reference, full error-free decode, and per-frame analysis for black frames,
flicker (luma spikes), frozen frames and isolated corrupted/torn frames.
"""
import json
import subprocess
import sys

import numpy as np

W, H = 320, 180  # analysis resolution


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", path],
        check=True, capture_output=True, text=True,
    ).stdout
    return json.loads(out)


def decode_errors(path):
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-xerror", "-i", path, "-f", "null", "-"],
        capture_output=True, text=True,
    )
    return r.returncode, r.stderr.strip()


def frames_gray(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}:flags=area,format=gray",
         "-f", "rawvideo", "-"],
        check=True, capture_output=True,
    ).stdout
    a = np.frombuffer(raw, dtype=np.uint8)
    return a.reshape(-1, H, W).astype(np.float32)


def mean_rgb(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", "fps=2,scale=160:90:flags=area,format=rgb24",
         "-f", "rawvideo", "-"],
        check=True, capture_output=True,
    ).stdout
    a = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(np.float32)
    return [round(float(x), 1) for x in a.mean(axis=0)]


def main():
    ref, vid = sys.argv[1], sys.argv[2]
    jout = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None
    res = {"file": vid, "reference": ref, "checks": {}, "pass": True}

    def check(name, ok, detail):
        res["checks"][name] = {"ok": bool(ok), "detail": detail}
        if not ok:
            res["pass"] = False

    pr, pv = probe(ref), probe(vid)
    rv = [s for s in pr["streams"] if s["codec_type"] == "video"][0]
    vstreams = [s for s in pv["streams"] if s["codec_type"] == "video"]
    astreams = [s for s in pv["streams"] if s["codec_type"] == "audio"]
    ref_audio = [s for s in pr["streams"] if s["codec_type"] == "audio"]
    v = vstreams[0]
    check("single_video_stream", len(vstreams) == 1, f"{len(vstreams)} video stream(s)")
    check("codec_h264", v["codec_name"] == "h264", f'{v["codec_name"]} / profile {v.get("profile")} / level {v.get("level")}')
    check("container_mp4", "mp4" in pv["format"]["format_name"], pv["format"]["format_name"])
    check("resolution_1080p", (v["width"], v["height"]) == (1920, 1080), f'{v["width"]}x{v["height"]}')
    check("pixel_format", v.get("pix_fmt") == "yuv420p", v.get("pix_fmt"))
    check("fps_30_exact", v["r_frame_rate"] == "30/1" and v["avg_frame_rate"] == "30/1",
          f'r={v["r_frame_rate"]} avg={v["avg_frame_rate"]}')
    nref, nvid = int(rv["nb_read_frames"]), int(v["nb_read_frames"])
    check("frame_count_matches_reference", nref == nvid, f"reference {nref} frames, output {nvid} frames")
    dref, dvid = float(pr["format"]["duration"]), float(pv["format"]["duration"])
    check("duration_matches_reference", abs(dref - dvid) < 0.0015, f"reference {dref:.4f}s, output {dvid:.4f}s")
    check("audio", (len(astreams) == 0) == (len(ref_audio) == 0),
          f"output audio streams: {len(astreams)}, reference audio streams: {len(ref_audio)}")
    rc, err = decode_errors(vid)
    check("full_decode_no_errors", rc == 0 and not err, err or "clean decode")

    f = frames_gray(vid)
    n = len(f)
    yavg = f.mean(axis=(1, 2))
    ymax = np.percentile(f.reshape(n, -1), 99.5, axis=1)
    black = [int(i) for i in np.where((yavg < 3.0) & (ymax < 24))[0]]
    check("no_black_frames", not black, f"black frames: {black[:20]}")
    # flicker: frame luma deviating from the average of its neighbours
    spikes = []
    for i in range(1, n - 1):
        dev = yavg[i] - 0.5 * (yavg[i - 1] + yavg[i + 1])
        if abs(dev) > max(3.0, 0.12 * yavg[i]):
            spikes.append((i, round(float(dev), 2)))
    check("no_flicker_spikes", not spikes, f"max |luma step| {float(np.max(np.abs(np.diff(yavg)))):.2f}; spikes: {spikes[:10]}")
    # temporal analysis
    d_prev = np.array([np.abs(f[i] - f[i - 1]).mean() for i in range(1, n)])
    frozen = [int(i + 1) for i in np.where(d_prev < 0.01)[0]]
    check("no_frozen_frames", not frozen, f"identical consecutive frames: {frozen[:20]}")
    isolated = []
    for i in range(1, n - 1):
        a, b = d_prev[i - 1], d_prev[i]  # (i-1,i) and (i,i+1)
        skip = np.abs(f[i + 1] - f[i - 1]).mean()
        if min(a, b) > 2.0 and skip < 0.45 * min(a, b):
            isolated.append((i, round(float(a), 2), round(float(b), 2), round(float(skip), 2)))
    # row-band tearing: rows of frame i that disagree with BOTH neighbours
    # while the neighbours agree with each other (a partially updated frame).
    torn = []
    for i in range(1, n - 1):
        rp = np.abs(f[i] - f[i - 1]).mean(axis=1)
        rn = np.abs(f[i + 1] - f[i]).mean(axis=1)
        rs = np.abs(f[i + 1] - f[i - 1]).mean(axis=1)
        bad = (np.minimum(rp, rn) > 6.0) & (rs < 0.4 * np.minimum(rp, rn))
        if bad.sum() >= 12:  # a real tear spans many rows (>6% of the frame)
            torn.append((i, int(bad.sum())))
    check("no_corrupted_or_torn_frames", not isolated and not torn,
          f"isolated outliers: {isolated[:10]}; torn: {torn[:10]}; "
          f"mean inter-frame diff {d_prev.mean():.2f}, max {d_prev.max():.2f}")
    res["stats"] = {
        "frames": n,
        "luma_mean": round(float(yavg.mean()), 2),
        "luma_min": round(float(yavg.min()), 2),
        "luma_max": round(float(yavg.max()), 2),
        "mean_rgb": mean_rgb(vid),
        "reference_mean_rgb": mean_rgb(ref),
        "bitrate_kbps": round(int(pv["format"]["bit_rate"]) / 1000),
        "size_mb": round(int(pv["format"]["size"]) / 1e6, 1),
    }
    print(json.dumps(res, indent=2))
    if jout:
        json.dump(res, open(jout, "w"), indent=2)
    sys.exit(0 if res["pass"] else 1)


if __name__ == "__main__":
    main()
