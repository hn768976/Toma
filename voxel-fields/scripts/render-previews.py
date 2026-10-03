#!/usr/bin/env python3
"""Resumable 1080p preview render.

Renders each composition's PNG sequence in chunks (so an interrupted run loses
at most one chunk), then encodes H.264 / yuv420p / CRF 16 / 30 fps / no audio.
Frames are tagged with a hash of src/: frames rendered by different code are
discarded and redone. Logs wall time per composition to out/logs/timing.txt.

  python3 scripts/render-previews.py [CompositionId ...]
"""
import glob
import hashlib
import os
import re
import shutil
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
COMPS = sys.argv[1:] or ["VoxelCanyon-Green", "VoxelCanyon-White", "VoxelCanyon-Blue", "VoxelWave-Blue", "VoxelWave-Mint"]
CHUNK = 50
FRAMES = 600


def src_hash():
    h = hashlib.sha1()
    for p in sorted(glob.glob("src/**/*", recursive=True)):
        if os.path.isfile(p):
            h.update(p.encode())
            h.update(open(p, "rb").read())
    return h.hexdigest()[:12]


def main():
    tag = src_hash()
    built = open("build/.srchash").read().strip() if os.path.exists("build/.srchash") else None
    if built != tag:
        shutil.rmtree("build", ignore_errors=True)
        subprocess.run(["npx", "remotion", "bundle", "--out-dir=build"], check=True, stdout=subprocess.DEVNULL)
        open("build/.srchash", "w").write(tag)
    os.makedirs("out/previews", exist_ok=True)
    os.makedirs("out/logs", exist_ok=True)
    for c in COMPS:
        d = f"out/frames/{c}"
        stamp = os.path.join(d, ".srchash")
        if not os.path.exists(stamp) or open(stamp).read().strip() != tag:
            shutil.rmtree(d, ignore_errors=True)
            os.makedirs(d)
            open(stamp, "w").write(tag)
            open(os.path.join(d, ".seconds"), "w").write("0")
        for start in range(0, FRAMES, CHUNK):
            end = min(FRAMES, start + CHUNK) - 1
            if all(os.path.exists(f"{d}/element-{f:03d}.png") for f in range(start, end + 1)):
                continue
            tmp = f"out/frames/tmp_{c.replace('-', '_')}"
            shutil.rmtree(tmp, ignore_errors=True)
            t0 = time.time()
            with open(f"out/logs/{c}.render.log", "a") as log:
                subprocess.run(["npx", "remotion", "render", "build", c, tmp, "--sequence", "--image-format=png",
                                f"--frames={start}-{end}", "--scale=0.5", "--concurrency=2", "--gl=angle",
                                "--timeout=900000"], check=True, stdout=log, stderr=log)
            dt = time.time() - t0
            for p in os.listdir(tmp):
                m = re.search(r"(\d+)\.png$", p)
                if m:
                    os.replace(os.path.join(tmp, p), f"{d}/element-{int(m.group(1)):03d}.png")
            shutil.rmtree(tmp, ignore_errors=True)
            secs = float(open(os.path.join(d, ".seconds")).read()) + dt
            open(os.path.join(d, ".seconds"), "w").write(str(secs))
            print(f"{c} frames {start}-{end} in {dt:.0f}s", flush=True)
        name = c.replace("-", "_")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "30", "-pattern_type", "glob", "-i", f"{d}/element-*.png",
                        "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-r", "30", "-an",
                        "-movflags", "+faststart", f"out/previews/{name}.mp4"], check=True)
        secs = float(open(os.path.join(d, ".seconds")).read())
        line = f"{c} frames={FRAMES} render_s={secs:.0f} per_frame_s={secs / FRAMES:.2f} (chunks of {CHUNK}, incl. startup)"
        print(line, flush=True)
        with open("out/logs/timing.txt", "a") as fh:
            fh.write(line + "\n")
    print("ALL DONE", flush=True)


if __name__ == "__main__":
    main()
