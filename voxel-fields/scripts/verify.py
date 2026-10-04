#!/usr/bin/env python3
"""Verify loop for the 1080p previews. Run after scripts/render-previews.py.

  python3 scripts/verify.py [step ...]     steps: probe loop determinism banding frames heights

Needs: ffmpeg/ffprobe, numpy, pillow, and the bundle in ./build.
Writes everything to out/verify/ and prints a PASS/FAIL line per check.
"""
import hashlib
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
OUT = "out/verify"
os.makedirs(OUT, exist_ok=True)

COMPS = ["VoxelCanyon-Green", "VoxelCanyon-White", "VoxelCanyon-Blue", "VoxelWave-Blue", "VoxelWave-Mint"]
LOOKS = {"canyon": COMPS[:3], "wave": COMPS[3:]}
results = []


def report(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}", flush=True)


def mp4(c):
    return f"out/previews/{c.replace('-', '_')}.mp4"


def seq_frame(c, f):
    d = f"out/frames/{c}"
    names = sorted(n for n in os.listdir(d) if n.endswith(".png"))
    return os.path.join(d, names[f])


def still(c, frame, path, env=None, scale=0.5):
    e = dict(os.environ)
    e.update(env or {})
    subprocess.run(
        ["npx", "remotion", "still", "build", c, path, f"--frame={frame}", f"--scale={scale}",
         "--gl=angle", "--timeout=900000", "--image-format=png"],
        check=True, env=e, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def img(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.float64)


def md5(path):
    return hashlib.md5(open(path, "rb").read()).hexdigest()


def video_frame(c, f, path):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4(c), "-vf", f"select=eq(n\\,{f})",
                    "-vsync", "0", "-frames:v", "1", path], check=True)


# --- Step 1: file checks ------------------------------------------------------
def step_probe():
    for c in COMPS:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                            "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames",
                            "-show_entries", "format=duration", "-of", "json", mp4(c)],
                           capture_output=True, text=True, check=True)
        j = json.loads(r.stdout)
        v = [s for s in j["streams"] if s["codec_type"] == "video"]
        a = [s for s in j["streams"] if s["codec_type"] == "audio"]
        s = v[0]
        dur = float(j["format"]["duration"])
        ok = (len(v) == 1 and not a and s["codec_name"] == "h264" and s["width"] == 1920
              and s["height"] == 1080 and s["r_frame_rate"] == "30/1" and s["pix_fmt"] == "yuv420p"
              and abs(dur - 20.0) < 1e-6 and int(s["nb_frames"]) == 600)
        report(f"probe {c}", ok, f"{s['codec_name']} {s['width']}x{s['height']} {s['r_frame_rate']} "
               f"{s['pix_fmt']} {dur}s frames={s['nb_frames']} audio_streams={len(a)}")


# --- Step 2: loop -------------------------------------------------------------
def step_loop():
    env = {"REMOTION_VOXEL_FRAMES": "601"}
    for c in COMPS:
        p0, p600 = f"{OUT}/{c}-loop-0000.png", f"{OUT}/{c}-loop-0600.png"
        still(c, 0, p0, env)
        still(c, 600, p600, env)
        same_bytes = md5(p0) == md5(p600)
        diff = np.abs(img(p0) - img(p600)).max()
        report(f"loop frame600==frame0 {c}", same_bytes and diff == 0,
               f"bytes {'identical' if same_bytes else 'DIFFER'}, max pixel diff {diff:.0f}")
        # Seam smoothness: the 599->0 step should look like any other step.
        steps = [np.abs(img(seq_frame(c, k)) - img(seq_frame(c, k + 1))).mean() for k in (0, 150, 300, 450, 598)]
        seam = np.abs(img(seq_frame(c, 599)) - img(seq_frame(c, 0))).mean()
        ok = seam <= 1.5 * max(steps)
        report(f"loop seam smooth {c}", ok,
               f"mean |599->0| = {seam:.2f}; typical steps {', '.join(f'{s:.2f}' for s in steps)}")


# --- Step 3: determinism ----------------------------------------------------------
def step_determinism():
    for c in COMPS:
        cold = f"{OUT}/{c}-cold-0300.png"
        still(c, 300, cold)
        full = seq_frame(c, 300)
        same = md5(cold) == md5(full)
        diff = np.abs(img(cold) - img(full)).max()
        report(f"determinism frame300 {c}", same, f"cold still vs full render: bytes {'identical' if same else 'DIFFER'}, max pixel diff {diff:.0f}")


# --- Step 4: banding ----------------------------------------------------------------
def longest_run(v):
    best = run = 1
    for a, b in zip(v, v[1:]):
        run = run + 1 if a == b else 1
        best = max(best, run)
    return best


def step_banding():
    # A large flat top face in each frame: picked as the brightest 64x24 block
    # with no lattice line in it (low max gradient after grain is averaged out).
    for c, f in (("VoxelCanyon-White", 450), ("VoxelWave-Blue", 450)):
        path = f"{OUT}/{c}-mp4-{f:04d}.png"
        video_frame(c, f, path)
        a = img(path)
        lum = a.mean(axis=2)
        best = None
        for y in range(40, 1040, 8):
            for x in range(40, 1840, 8):
                blk = lum[y:y + 24, x:x + 64]
                prof = blk.mean(axis=0)
                rough = np.abs(np.diff(prof)).max()
                score = rough - 0.002 * blk.mean()
                if best is None or score < best[0]:
                    best = (score, x, y)
        _, x, y = best
        blk = a[y:y + 24, x:x + 64]
        row = blk[12, :, 1].astype(int)
        prof = blk.mean(axis=(0, 2))
        rnd = np.round(prof).astype(int)
        steps = np.abs(np.diff(prof))
        ok = steps.max() < 1.0 and len(set(row.tolist())) > 3
        with open(f"{OUT}/{c}-banding.txt", "w") as fh:
            fh.write(f"block x={x} y={y} (64x24 px) from encoded mp4 frame {f}\n")
            fh.write("raw G values along the middle row:\n" + " ".join(map(str, row.tolist())) + "\n")
            fh.write("24-row averaged luminance profile:\n" + " ".join(f"{v:.2f}" for v in prof) + "\n")
        report(f"banding {c}", ok,
               f"block@({x},{y}): raw row has {len(set(row.tolist()))} distinct values, longest flat run {longest_run(row.tolist())} px; "
               f"averaged profile max step {steps.max():.2f} (8-bit), range {prof.min():.1f}-{prof.max():.1f}")


# --- Step 5: five frames ------------------------------------------------------------
def step_frames():
    picks = [0, 120, 240, 360, 480]
    for c in COMPS:
        paths = []
        for f in picks:
            p = f"{OUT}/{c}-f{f:04d}.png"
            video_frame(c, f, p)
            paths.append(p)
        ims = [img(p) for p in paths]
        moved = [np.abs(ims[k] - ims[k + 1]).mean() for k in range(4)]
        lum = [im.mean(axis=2) for im in ims]
        dark = [float((l < 40).mean()) for l in lum]
        report(f"frames moved {c}", min(moved) > 2,
               f"mean |diff| between picks: {', '.join(f'{m:.1f}' for m in moved)}")
        report(f"no void {c}", max(dark) < 0.001, f"dark (<40) pixel share per pick: {', '.join(f'{100*d:.3f}%' for d in dark)}")
        # Contact sheet for the visual checks.
        sheet = f"{OUT}/{c}-sheet.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", *sum([["-i", p] for p in paths], []),
                        "-f", "lavfi", "-i", "color=black:s=1920x1080",
                        "-filter_complex", "[0][1][2][3][4][5]xstack=inputs=6:layout=0_0|w0_0|0_h0|w0_h0|0_h0+h1|w0_h0+h1,scale=1920:-1",
                        "-frames:v", "1", "-update", "1", sheet], check=True)


# --- heights identical across palettes ----------------------------------------------
def step_heights():
    for look, comps in LOOKS.items():
        sums = {}
        for c in comps:
            p = f"{OUT}/{c}-depth-0300.png"
            still(c, 300, p, {"REMOTION_VF_PROFILE": "depth"})
            sums[c] = md5(p)
        ok = len(set(sums.values())) == 1
        report(f"identical heights ({look}) frame 300", ok,
               "depth renders " + ("byte-identical" if ok else "DIFFER") + ": " + ", ".join(f"{k}={v[:8]}" for k, v in sums.items()))


# --- stills: no empty holes in the delivered stills -------------------------------
def step_stills():
    import glob as g
    for p in sorted(g.glob("out/stills-1080/*.png")) + sorted(g.glob("out/stills/*.png")):
        a = img(p).mean(axis=2)
        dark = float((a < 40).mean())
        report(f"no void {os.path.basename(p)}", dark < 0.001, f"dark (<40) pixel share {100*dark:.3f}%")


STEPS = {"probe": step_probe, "loop": step_loop, "determinism": step_determinism,
         "banding": step_banding, "frames": step_frames, "heights": step_heights,
         "stills": step_stills}

if __name__ == "__main__":
    todo = sys.argv[1:] or list(STEPS)
    for s in todo:
        STEPS[s]()
    with open(f"{OUT}/results.txt", "a") as fh:
        for name, ok, detail in results:
            fh.write(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}\n")
    sys.exit(0 if all(ok for _, ok, _ in results) else 1)
