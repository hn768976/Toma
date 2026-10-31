#!/usr/bin/env python3
"""Checks for the previews: ffprobe, background levels.
usage: verify.py probe <mp4...> | bg <id> <mp4> <png_dir>"""
import json, subprocess, sys
import numpy as np
from PIL import Image

def probe(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path])
    j = json.loads(out)
    v = [s for s in j["streams"] if s["codec_type"] == "video"]
    a = [s for s in j["streams"] if s["codec_type"] == "audio"]
    s = v[0]
    nb = int(subprocess.check_output(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
        "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", path]).decode().strip())
    res = dict(w=s["width"], h=s["height"], fps=s["r_frame_rate"], codec=s["codec_name"], pix=s["pix_fmt"],
               audio=len(a), dur=float(j["format"]["duration"]), frames=nb)
    ok = (res["w"], res["h"], res["fps"], res["codec"], res["pix"], res["audio"], res["frames"]) == (1280, 720, "30/1", "h264", "yuv420p", 0, 300) and abs(res["dur"] - 10.0) < 0.05
    return ok, res

def decode(path, frames):
    sel = "+".join(f"eq(n\\,{f})" for f in frames)
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-vf", f"select='{sel}'", "-vsync", "0",
                                   "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    return np.frombuffer(raw, np.uint8).reshape(len(frames), 720, 1280, 3)

if __name__ == "__main__":
    if sys.argv[1] == "probe":
        allok = True
        for p in sys.argv[2:]:
            ok, r = probe(p)
            allok &= ok
            print("PASS" if ok else "FAIL", p.split("/")[-1], r)
        sys.exit(0 if allok else 1)
    if sys.argv[1] == "bg":
        # 50 empty points per frame: points whose 21x21 neighbourhood holds no
        # drawing in the decoded frame, and away from drawn content in every
        # checked frame; their values must equal the background (+-1).
        path, bg = sys.argv[2], int(sys.argv[3])
        frames = [0, 37, 75, 112, 150, 187, 225, 262, 299]
        fr = decode(path, frames).astype(int)
        rng = np.random.default_rng(1)
        # Content mask: any channel more than 24 levels from bg, dilated 10px.
        content = (np.abs(fr - bg).max(axis=3) > 24).any(axis=0)
        from numpy.lib.stride_tricks import sliding_window_view
        pad = np.pad(content, 10)
        near = sliding_window_view(pad, (21, 21)).any(axis=(2, 3))
        ys, xs = np.nonzero(~near)
        if len(ys) < 50:
            print("FAIL not enough empty area", len(ys)); sys.exit(1)
        idx = rng.choice(len(ys), 50, replace=False)
        vals = fr[:, ys[idx], xs[idx], :]
        dev = np.abs(vals - bg).max()
        print(("PASS" if dev <= 1 else "FAIL"), path.split("/")[-1], f"bg={bg} max dev over 50 pts x {len(frames)} frames = {dev}",
              f"(empty area {100*len(ys)/(1280*720):.0f}% of frame)")
        sys.exit(0 if dev <= 1 else 1)
