"""Verification for rendered previews.

Usage: python3 scripts/verify.py <out_dir> <workdir> [packId,packId]

Checks per pack: ffprobe stream properties and frame count, screen colour
(30 sampled points + every interior screen pixel in several frames),
green background colour (packs on green), a chromakey test over a test image,
and (packs 3 and 5) that the final 30 frames are only #00FF00.
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

OUT, WORK = sys.argv[1], sys.argv[2]
os.makedirs(WORK, exist_ok=True)
DATA = json.load(open("data/packs.json"))
ONLY = sys.argv[3].split(",") if len(sys.argv) > 3 else None
W, H = 1280, 720
TOL = 2
DECODE = "scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24"


def ffprobe(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", path],
        capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def frames(path, idx):
    """Decode the listed frame indices (exact, by frame number) to RGB arrays."""
    sel = "+".join(f"eq(n\\,{i})" for i in idx)
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", f"select='{sel}',{DECODE}", "-vsync", "0",
         "-f", "rawvideo", "-"], capture_output=True, check=True)
    arr = np.frombuffer(r.stdout, np.uint8).reshape(-1, H, W, 3)
    assert len(arr) == len(idx), (len(arr), len(idx))
    return dict(zip(idx, arr))


def frame_range(path, start, count):
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", f"select='gte(n\\,{start})',{DECODE}", "-vsync", "0",
         "-frames:v", str(count), "-f", "rawvideo", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.uint8).reshape(-1, H, W, 3)


def green_dev(px):
    px = px.astype(int)
    return np.max(np.abs(px - np.array([0, 255, 0])), axis=-1)


def screen_interior(img):
    """Loose green mask (would include any glare-tinted green), eroded 4px."""
    i = img.astype(int)
    loose = (i[..., 1] > 140) & (i[..., 0] < 140) & (i[..., 2] < 140) & (i[..., 1] - np.maximum(i[..., 0], i[..., 2]) > 60)
    # Fill holes so glare spots inside a screen would be counted, not skipped.
    filled = ndimage.binary_fill_holes(loose)
    hole = filled & ~loose
    # A glare spot would be a bright, green-tinted hole enclosed by screen green.
    # Punch-holes (dark) and, on green packs, whole phone bodies (grey) are fine.
    lab, n = ndimage.label(hole)
    big_holes = 0
    for k, sl in enumerate(ndimage.find_objects(lab), start=1):
        comp = lab[sl] == k
        sz = int(comp.sum())
        if sz <= 400:
            continue
        mean = img[sl][comp].mean(axis=0)
        if mean[1] > 170 and mean[1] > mean[0] + 40:
            big_holes += 1
    interior = ndimage.binary_erosion(loose, iterations=4)
    deep = ndimage.binary_erosion(loose, iterations=8)
    return interior, deep, big_holes


rng = np.random.default_rng(1234)
report = {}
testimg = os.path.join(WORK, "testcard.png")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"testsrc2=size={W}x{H}:rate=1",
                "-frames:v", "1", testimg], check=True)
card = np.array(Image.open(testimg).convert("RGB")).astype(int)

for pack in DATA["packs"]:
    pid = pack["id"]
    if ONLY and pid not in ONLY:
        continue
    path = os.path.join(OUT, f"{pid}.mp4")
    rep = {}
    # 1. ffprobe
    info = ffprobe(path)
    v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
    rep["ffprobe"] = {
        "width": v["width"], "height": v["height"], "r_frame_rate": v["r_frame_rate"],
        "codec": v["codec_name"], "pix_fmt": v["pix_fmt"], "frames": int(v["nb_read_frames"]),
        "audio_streams": sum(1 for s in info["streams"] if s["codec_type"] == "audio"),
        "duration": float(info["format"]["duration"]),
    }
    f = rep["ffprobe"]
    rep["ffprobe_ok"] = (f["width"], f["height"], f["r_frame_rate"], f["codec"], f["pix_fmt"], f["frames"], f["audio_streams"]) == (
        1280, 720, "30/1", "h264", "yuv420p", pack["durationInFrames"], 0)

    # 3. screen colour, frames at 45% of each segment
    idx = [s["start"] + int(s["length"] * 0.45) for s in pack["segments"]]
    imgs = frames(path, idx)
    samples, worst, n_interior, big_holes = [], 0, 0, 0
    deep_n, deep_ok, deep_worst = 0, 0, 0
    for fi, img in imgs.items():
        interior, deep, bh = screen_interior(img)
        dvals = green_dev(img[deep])
        deep_n += int(deep.sum())
        deep_ok += int((dvals <= TOL).sum())
        deep_worst = max(deep_worst, int(dvals.max()) if dvals.size else 0)
        big_holes += bh
        ys, xs = np.nonzero(interior)
        if len(ys) == 0:
            continue
        n_interior += len(ys)
        worst = max(worst, int(green_dev(img[ys, xs]).max()))
        pick = rng.choice(len(ys), size=min(30, len(ys)), replace=False)
        for k in pick:
            samples.append((fi, int(xs[k]), int(ys[k]), tuple(int(c) for c in img[ys[k], xs[k]])))
    pick30 = [samples[i] for i in rng.choice(len(samples), size=min(30, len(samples)), replace=False)]
    rep["screen"] = {
        "frames": idx,
        "interior_pixels_checked": n_interior,
        "max_channel_deviation": worst,
        "big_holes_in_screens": big_holes,
        "deep8_pixels": deep_n,
        "deep8_within_tol_frac": round(deep_ok / max(1, deep_n), 6),
        "deep8_max_dev": deep_worst,
        "sample30": pick30,
        "sample30_ok": all(max(abs(p[3][0]), abs(p[3][1] - 255), abs(p[3][2])) <= TOL for p in pick30),
    }
    # Formal check per spec: 30 sampled interior points within +-2 and no glare holes.
    # The full-interior and 8px-deep stats are reported alongside (H.264 ringing near edges).
    rep["screen_ok"] = rep["screen"]["sample30_ok"] and big_holes == 0

    if pack["background"] == "green":
        # Background = green in the outer 12% border band that is >= 8px from any
        # non-green pixel (so phone edges and their codec ringing are excluded).
        bg = []
        for fi in idx:
            img = imgs[fi]
            deep = ndimage.binary_erosion(green_dev(img) <= 40, iterations=8)
            band = np.zeros_like(deep)
            bx, by = int(W * 0.12), int(H * 0.12)
            band[:by, :] = band[-by:, :] = True
            band[:, :bx] = band[:, -bx:] = True
            ys, xs = np.nonzero(deep & band)
            for k in rng.choice(len(ys), size=min(30, len(ys)), replace=False):
                bg.append(tuple(int(c) for c in img[ys[k], xs[k]]))
        rep["background_samples"] = len(bg)
        rep["background_max_dev"] = int(max(max(abs(c[0]), abs(c[1] - 255), abs(c[2])) for c in bg))
        rep["background_ok"] = rep["background_max_dev"] <= TOL

    # 4. key test
    keyed = []
    for fi in idx[:: max(1, len(idx) // 4)]:
        out_png = os.path.join(WORK, f"key_{pid}_{fi:04d}.png")
        subprocess.run([
            "ffmpeg", "-v", "error", "-y", "-i", path, "-loop", "1", "-i", testimg, "-filter_complex",
            f"[0:v]select='eq(n\\,{fi})',setpts=0,chromakey=0x00FF00:0.12:0.05,"
            "scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgba[k];"
            "[1:v]setpts=0,format=rgba[c];[c][k]overlay=format=rgb:shortest=1,format=rgb24",
            "-frames:v", "1", out_png], check=True)
        comp = np.array(Image.open(out_png).convert("RGB")).astype(int)
        orig = imgs[fi].astype(int)
        dev = green_dev(orig)
        green = ndimage.binary_erosion(dev <= 6, iterations=3)
        dist_from_green = np.sqrt(orig[..., 0] ** 2 + (orig[..., 1] - 255) ** 2 + orig[..., 2] ** 2)
        body = ndimage.binary_erosion(dist_from_green > 200, iterations=3)
        g_replaced = float(np.mean(np.max(np.abs(comp[green] - card[green]), axis=-1) <= 4)) if green.any() else 1.0
        b_kept = float(np.mean(np.max(np.abs(comp[body] - orig[body]), axis=-1) <= 4)) if body.any() else 1.0
        # Edge band: pixels that are neither clean green nor clean body.
        band = ~(ndimage.binary_dilation(green, iterations=3) | ndimage.binary_dilation(body, iterations=3))
        keyed.append({"frame": fi, "green_replaced": round(g_replaced, 5), "body_kept": round(b_kept, 5),
                      "green_px": int(green.sum()), "body_px": int(body.sum()),
                      "unclassified_px": int(band.sum()), "composite": os.path.basename(out_png)})
    rep["key_test"] = keyed
    rep["key_ok"] = all(k["green_replaced"] >= 0.999 and k["body_kept"] >= 0.999 for k in keyed)

    # 5. push-in: last 30 frames only #00FF00
    if pack["segments"][-1]["move"] == "pushIntoScreen":
        tail = frame_range(path, pack["durationInFrames"] - 30, 30)
        rep["push_tail_frames"] = len(tail)
        rep["push_tail_max_dev"] = int(green_dev(tail).max())
        rep["push_ok"] = len(tail) == 30 and rep["push_tail_max_dev"] <= TOL

    report[pid] = rep
    flags = {k: v for k, v in rep.items() if k.endswith("_ok")}
    print(pid, flags, "screen max dev", worst, "interior px", n_interior)

json.dump(report, open(os.path.join(WORK, "verify_report.json"), "w"), indent=1)
print("report:", os.path.join(WORK, "verify_report.json"))
