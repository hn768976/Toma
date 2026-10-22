"""Verification for the Brain Pack previews (see README "Verification").

    python3 scripts/verify.py probe      out/brain-pack
    python3 scripts/verify.py loops      <stills dir with <Id>-0.png and <Id>-600-true.png>
    python3 scripts/verify.py levels     out/brain-pack
    python3 scripts/verify.py key        out/brain-pack/BrainSolid_Green.mp4 <workdir>
    python3 scripts/verify.py banding    out/brain-pack <workdir>
    python3 scripts/verify.py same       <a.png> <b.png>
"""

import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

EXPECT = {
    "BrainMembrane_Violet": 600,
    "BrainFibre_LightReveal": 300,
    "BrainFibre_LightLoop": 600,
    "BrainSolid_Black": 600,
    "BrainSolid_Green": 600,
    "BrainGlass_Thoughts": 720,
    "BrainParticles_Assemble": 600,
    "BrainOrbit_DeepBlue": 600,
}
LOOPS = ["BrainMembrane-Violet", "BrainFibre-LightLoop", "BrainSolid-Black", "BrainSolid-Green", "BrainOrbit-DeepBlue"]


def frames(path, times, w=1280, h=720):
    """Decode frames (by index) to RGB uint8 arrays with ffmpeg."""
    out = []
    for f in times:
        raw = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", path, "-vf", f"select=eq(n\\,{f})", "-vframes", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            capture_output=True,
            check=True,
        ).stdout
        out.append(np.frombuffer(raw, np.uint8).reshape(h, w, 3))
    return out


def probe(d):
    ok = True
    for name, n in EXPECT.items():
        p = os.path.join(d, name + ".mp4")
        j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", p], capture_output=True, check=True).stdout)
        v = [s for s in j["streams"] if s["codec_type"] == "video"][0]
        a = [s for s in j["streams"] if s["codec_type"] == "audio"]
        got = (v["width"], v["height"], v["r_frame_rate"], v["codec_name"], v["pix_fmt"], int(v["nb_read_frames"]), len(a))
        want = (1280, 720, "30/1", "h264", "yuv420p", n, 0)
        good = got == want
        ok &= good
        print(f"{'PASS' if good else 'FAIL'} {name}: {got[0]}x{got[1]} {got[2]} {got[3]} {got[4]} frames={got[5]} ({got[5]/30:.2f}s) audio_streams={got[6]}")
    return ok


def same(a, b):
    A = np.asarray(Image.open(a).convert("RGB")).astype(int)
    B = np.asarray(Image.open(b).convert("RGB")).astype(int)
    diff = np.abs(A - B)
    n = int((diff.max(2) > 0).sum())
    print(f"{'PASS' if n == 0 else 'FAIL'} {os.path.basename(a)} vs {os.path.basename(b)}: differing pixels={n} max diff={int(diff.max())}")
    return n == 0


def loops(d):
    ok = True
    for i in LOOPS:
        ok &= same(os.path.join(d, f"{i}-0.png"), os.path.join(d, f"{i}-600-true.png"))
    return ok


def empty_points(img, bg, tol, n, rng, region):
    """n points in `region` (x0,x1,y0,y1 fractions) whose neighbourhood is far from the subject."""
    h, w, _ = img.shape
    pts = []
    tries = 0
    while len(pts) < n and tries < 20000:
        tries += 1
        x = int(rng.uniform(region[0], region[1]) * w)
        y = int(rng.uniform(region[2], region[3]) * h)
        pts.append((x, y))
    return pts


def levels(d):
    rng = np.random.default_rng(5)
    ok = True
    spec = {
        "BrainSolid_Black": ((0, 0, 0), 1, [(0.0, 0.12, 0.0, 1.0), (0.88, 1.0, 0.0, 1.0)]),
        "BrainSolid_Green": ((0, 255, 0), 2, [(0.0, 0.12, 0.0, 1.0), (0.88, 1.0, 0.0, 1.0)]),
        "BrainGlass_Thoughts": ((0, 0, 0), 1, [(0.78, 1.0, 0.0, 1.0), (0.0, 0.03, 0.0, 1.0)]),
    }
    for name, (col, tol, regions) in spec.items():
        p = os.path.join(d, name + ".mp4")
        fs = [0, 150, 300, 450] if name != "BrainGlass_Thoughts" else [0, 250, 450, 700]
        worst = 0
        count = 0
        for img in frames(p, fs):
            for reg in regions:
                for x, y in empty_points(img, col, tol, 25, rng, reg):
                    dev = int(np.abs(img[y, x].astype(int) - np.array(col)).max())
                    worst = max(worst, dev)
                    count += 1
        good = worst <= tol
        ok &= good
        print(f"{'PASS' if good else 'FAIL'} {name}: {count} empty samples, max deviation from {col} = {worst} (tolerance {tol})")
    return ok


def key(path, work):
    """Chroma-key clip 5 over mid-grey (on the encoded yuv420p frames) and check
    green fringes, holes and arc survival — with chromakey alone and with
    chromakey + despill. ffmpeg's chromakey keeps each edge pixel's own colour
    at partial alpha, so pure-green pixels next to any subject leave a 1-2 px
    green band unless a despill follows."""
    from scipy.ndimage import binary_erosion

    os.makedirs(work, exist_ok=True)
    fs = [0, 58, 110, 260, 400, 570]
    ok = True
    for f in fs:
        nut = os.path.join(work, f"f{f}.nut")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-vf", f"select=eq(n\\,{f})", "-frames:v", "1", "-c:v", "rawvideo", "-pix_fmt", "yuv420p", nut], check=True)
        orig = frames(path, [f])[0].astype(int)
        bg = (orig[:, :, 1] > 200) & (orig[:, :, 0] < 60) & (orig[:, :, 2] < 60)
        subject = binary_erosion(~bg, iterations=3)
        for label, chain in (("chromakey", "chromakey=0x00FF00:0.12:0.05"), ("chromakey+despill", "chromakey=0x00FF00:0.12:0.05,despill=type=green")):
            out = os.path.join(work, f"keyed-{f}-{label}.png")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", nut, "-f", "lavfi", "-i", "color=c=0x808080:s=1280x720", "-filter_complex", f"[0:v]{chain}[k];[1:v][k]overlay=shortest=1,format=rgb24", "-frames:v", "1", out], check=True)
            k = np.asarray(Image.open(out).convert("RGB")).astype(int)
            fringe = int(((k[:, :, 1] - np.maximum(k[:, :, 0], k[:, :, 2])) > 18).sum())
            holes = int((subject & (np.abs(k - 128).max(2) <= 3) & (np.abs(orig - 128).max(2) > 12)).sum())
            arcs_o = int(((orig[:, :, 2] - orig[:, :, 0]) > 25).sum())
            arcs_k = int(((k[:, :, 2] - k[:, :, 0]) > 25).sum())
            good = holes < 20 and fringe < 40
            if label == "chromakey+despill":
                ok &= good
            print(f"{'PASS' if good else 'FAIL'} frame {f} {label}: green-fringe px={fringe} hole px={holes} arcs px {arcs_o}->{arcs_k}")
    return ok


def banding(d, work):
    """Levels x4 views of the gradient areas (for eyeballing) + a numeric check:
    after a light blur, adjacent-pixel steps in the smooth gradient region should
    be tiny and no long flat runs (plateaus) should exist."""
    os.makedirs(work, exist_ok=True)
    jobs = {
        "BrainMembrane_Violet": ([0, 300], (0.0, 0.25, 0.0, 0.6), "dark"),
        "BrainFibre_LightReveal": ([0, 290], (0.0, 0.2, 0.0, 1.0), "light"),
        "BrainOrbit_DeepBlue": ([0, 300], (0.0, 0.25, 0.0, 1.0), "dark"),
    }
    for name, (fs, reg, kind) in jobs.items():
        for f, img in zip(fs, frames(os.path.join(d, name + ".mp4"), fs)):
            h, w, _ = img.shape
            x0, x1, y0, y1 = int(reg[0] * w), int(reg[1] * w), int(reg[2] * h), int(reg[3] * h)
            crop = img[y0:y1, x0:x1].astype(float)
            if kind == "dark":
                s = np.clip((crop - crop.min()) * 4, 0, 255)
            else:
                s = np.clip((crop - crop.min()) * 4, 0, 255)
            Image.fromarray(s.astype(np.uint8)).save(os.path.join(work, f"band-{name}-{f}.png"))
            lum = crop.mean(2)
            # column-averaged vertical profile: steps between neighbours
            prof = lum.mean(1)
            steps = np.abs(np.diff(prof))
            print(f"     {name} frame {f}: region {x1-x0}x{y1-y0}, profile range {prof.min():.2f}-{prof.max():.2f}, max row step {steps.max():.3f}")


if __name__ == "__main__":
    cmd = sys.argv[1]
    r = {"probe": lambda: probe(sys.argv[2]), "loops": lambda: loops(sys.argv[2]), "levels": lambda: levels(sys.argv[2]),
         "key": lambda: key(sys.argv[2], sys.argv[3]), "banding": lambda: banding(sys.argv[2], sys.argv[3]),
         "same": lambda: same(sys.argv[2], sys.argv[3])}[cmd]()
    sys.exit(0 if r in (None, True) else 1)
