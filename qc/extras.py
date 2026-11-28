#!/usr/bin/env python3
"""Images and extra numbers for the QC report, made from the four final videos (step 8A items 4, 7, 8 and 8B item 11).

usage: extras.py [frames-dir-for-reviewers]

Writes into qc/images/:
  sheet-<video>.jpg        contact sheet, one frame per second
  banding-<video>.png      dark / soft-gradient crops with levels stretched x4
  visual-<video>.jpg       reference (top) against the video (bottom) at start, middle and end
  distinct-<project>.jpg   Version 1 (left) against Version 2 (right) at start, middle and end
and <project>/lookdev/compare-<moment>.png (reference | video | difference) from the Version 1 videos,
plus qc/results/stability.json (frame-to-frame steadiness of brightness, contrast and fine detail).
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "qc", "images")
RES = os.path.join(ROOT, "qc", "results")
os.makedirs(IMG, exist_ok=True)
REVIEW = sys.argv[1] if len(sys.argv) > 1 else None

VIDEOS = [
    ("01-V1-conveyor-parcels", "conveyor-parcels", 313),
    ("02-V2-conveyor-parcels", "conveyor-parcels", 313),
    ("03-V1-mars-dome", "mars-dome", 311),
    ("04-V2-mars-dome", "mars-dome", 311),
]
# dark or softly graded areas, as fractions of the frame (left, top, right, bottom)
BAND_REGIONS = {
    "conveyor-parcels": [("background, top left", (0.0, 0.0, 0.45, 0.3)), ("belt, bottom left", (0.0, 0.72, 0.45, 1.0)),
                         ("carton face", (0.45, 0.52, 0.85, 0.72))],
    "mars-dome": [("haze, top", (0.25, 0.0, 0.7, 0.25)), ("glass, bottom right", (0.62, 0.65, 1.0, 1.0)),
                  ("plaza, bottom left", (0.0, 0.7, 0.4, 1.0))],
}
LOOKDEV = {
    "conveyor-parcels": ([("start", 0), ("peak", 90), ("middle", 156)],
                         "--mask 0.37,0.40,0.63,0.61 --near 0.05,0.78,0.95,0.98 --far 0.02,0.02,0.98,0.26", "A"),
    "mars-dome": ([("start", 0), ("middle", 156), ("peak", 188)],
                  "--mask 0.37,0.40,0.63,0.61 --near 0.05,0.72,0.75,0.98 --far 0.02,0.02,0.98,0.2", "B"),
}


def video_path(name, project):
    flat = os.environ.get("QC_VIDEO_DIR")  # optional: a folder holding the four MP4s side by side
    return os.path.join(flat, name + ".mp4") if flat else os.path.join(ROOT, project, "out", name + ".mp4")


def frame(path, index, fps=30.0):
    """Frame `index` of a 30 fps video, as an RGB image (exact, by frame number)."""
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"select=eq(n\\,{index})", "-frames:v", "1",
                          "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True, check=True).stdout
    from io import BytesIO
    return Image.open(BytesIO(out)).convert("RGB")


def ref_frame(project, seconds):
    """The reference frame showing at `seconds` (clamped to its last frame)."""
    path = os.path.join(ROOT, "refs", project + ".mp4")
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries",
                                      "stream=nb_read_frames,r_frame_rate", "-of", "json", path],
                                     capture_output=True, text=True, check=True).stdout)["streams"][0]
    num, den = info["r_frame_rate"].split("/")
    fps = float(num) / float(den)
    idx = min(int(round(seconds * fps)), int(info["nb_read_frames"]) - 1)
    return frame(path, idx)


def grid(rows, width, gap=6, bg=(255, 255, 255)):
    """rows: list of lists of images; every image is scaled to `width`."""
    scaled = [[im.resize((width, round(im.height * width / im.width)), Image.LANCZOS) for im in row] for row in rows]
    h = [max(im.height for im in row) for row in scaled]
    cols = max(len(r) for r in scaled)
    out = Image.new("RGB", (cols * width + (cols - 1) * gap, sum(h) + (len(h) - 1) * gap), bg)
    y = 0
    for row, rh in zip(scaled, h):
        for i, im in enumerate(row):
            out.paste(im, (i * (width + gap), y))
        y += rh + gap
    return out


stability = {}
frames_cache = {}
for name, project, n in VIDEOS:
    path = video_path(name, project)
    if not os.path.exists(path):
        print("missing", path)
        continue
    moments = [0, n // 2, n - 1]
    mine = [frame(path, i) for i in moments]
    refs = [ref_frame(project, i / 30) for i in moments]
    frames_cache[name] = mine
    grid([refs, mine], 640).save(os.path.join(IMG, f"visual-{name}.jpg"), quality=90)
    if REVIEW:
        d = os.path.join(REVIEW, name)
        os.makedirs(d, exist_ok=True)
        for k, (r, m) in enumerate(zip(refs, mine)):
            label = ["start", "middle", "end"][k]
            r.resize((1280, 720), Image.LANCZOS).save(os.path.join(d, f"reference-{k + 1}-{label}.png"))
            m.resize((1280, 720), Image.LANCZOS).save(os.path.join(d, f"attempt-{k + 1}-{label}.png"))

    sheet = os.path.join(RES, f"verify-{name}-sheet.png")
    if os.path.exists(sheet):
        Image.open(sheet).convert("RGB").save(os.path.join(IMG, f"sheet-{name}.jpg"), quality=88)

    # banding: stretch levels x4 around each crop's median
    crops = []
    for im in mine:
        a = np.asarray(im).astype(np.float32)
        row = []
        for _, (l, t, r, b) in BAND_REGIONS[project]:
            c = a[int(t * a.shape[0]):int(b * a.shape[0]), int(l * a.shape[1]):int(r * a.shape[1])]
            med = np.median(c.reshape(-1, 3), axis=0)
            row.append(Image.fromarray(np.clip((c - med) * 4 + 128, 0, 255).astype(np.uint8)))
        crops.append(row)
    widest = max(c.width for row in crops for c in row)
    grid(crops, min(widest, 640)).save(os.path.join(IMG, f"banding-{name}.png"))

    # steadiness over all frames, on a 480x270 grey proxy
    w, h = 480, 270
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h}:flags=area,format=gray", "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    g = np.frombuffer(raw, dtype=np.uint8).reshape(-1, h, w).astype(np.float32)
    mean = g.mean(axis=(1, 2))
    std = g.std(axis=(1, 2))
    lap = (4 * g[:, 1:-1, 1:-1] - g[:, :-2, 1:-1] - g[:, 2:, 1:-1] - g[:, 1:-1, :-2] - g[:, 1:-1, 2:]).var(axis=(1, 2))
    top = g[:, : h // 4].mean(axis=(1, 2))

    def pop(x):
        return float(np.abs(x[2:] - 2 * x[1:-1] + x[:-2]).max())

    stability[name] = {
        "brightness_range": [float(mean.min()), float(mean.max())], "brightness_pop_max": pop(mean),
        "contrast_range": [float(std.min()), float(std.max())], "contrast_pop_max": pop(std),
        "far_band_brightness_range": [float(top.min()), float(top.max())], "far_band_pop_max": pop(top),
        "detail_range": [float(lap.min()), float(lap.max())], "detail_pop_max_pct": float(pop(lap) / np.median(lap) * 100),
    }
    print(name, json.dumps(stability[name]))

    # look-dev side-by-sides from the Version 1 video
    if "-V1-" in name:
        moments_ld, regions, letter = LOOKDEV[project]
        os.makedirs(os.path.join(ROOT, project, "lookdev"), exist_ok=True)
        for label, idx in moments_ld:
            a = os.path.join(RES, f"_ref-{letter}-{label}.png")
            b = os.path.join(RES, f"_mine-{letter}-{label}.png")
            ref_frame(project, idx / 30).save(a)
            frame(path, idx).save(b)
            script = os.path.join(ROOT, project, "scripts", "measure-look.py")
            subprocess.run(f"python3 {script} compare {a} {b} {regions} --quiet --json {RES}/lookdev-{letter}-{label}.json "
                           f"--out {ROOT}/{project}/lookdev/compare-{label}.png", shell=True, check=True)
            os.remove(a)
            os.remove(b)

json.dump(stability, open(os.path.join(RES, "stability.json"), "w"), indent=1)

for project, v1, v2 in [("conveyor-parcels", "01-V1-conveyor-parcels", "02-V2-conveyor-parcels"),
                        ("mars-dome", "03-V1-mars-dome", "04-V2-mars-dome")]:
    if v1 in frames_cache and v2 in frames_cache:
        grid([[a, b] for a, b in zip(frames_cache[v1], frames_cache[v2])], 720).save(
            os.path.join(IMG, f"distinct-{project}.jpg"), quality=90)
print("done")
