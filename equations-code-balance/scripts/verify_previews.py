#!/usr/bin/env python3
"""Checks on the ENCODED preview files (not the browser preview).

Step 1  file checks: 1920x1080, 30/1, h264, yuv420p, duration, no audio,
        pure 0,0,0 black in empty areas of EquationFlight_Black.
Step 6  banding: pixel values along a line through the smoothest gradient.
Step 7  five evenly spaced frames per clip, saved as a contact sheet.

Usage: python3 scripts/verify_previews.py out/previews
Needs ffmpeg/ffprobe, Pillow and numpy.
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image

EXPECT = {
    "EquationFlight_Black": 20.0, "EquationFlight_Navy": 20.0,
    "AICodeScreen_Dark": 20.0, "AICodeScreen_Light": 20.0,
    "BalanceScreen_Drain": 10.0, "BalanceScreen_Grow": 10.0,
}

def probe(f):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(f)],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)

def frame(f, t, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.4f}", "-i", str(f), "-frames:v", "1", str(out)], check=True)
    return np.asarray(Image.open(out).convert("RGB")).astype(int)

def main(d):
    d = Path(d); chk = d / "checks"; chk.mkdir(exist_ok=True)
    ok_all = True
    for name, dur in EXPECT.items():
        f = d / f"{name}.mp4"
        if not f.exists():
            print(f"{name}: MISSING"); ok_all = False; continue
        p = probe(f)
        v = [s for s in p["streams"] if s["codec_type"] == "video"][0]
        audio = [s for s in p["streams"] if s["codec_type"] == "audio"]
        fdur = float(p["format"]["duration"])
        res = dict(size=f'{v["width"]}x{v["height"]}', fps=v["r_frame_rate"], codec=v["codec_name"],
                   pix=v["pix_fmt"], dur=round(fdur, 3), frames=v.get("nb_frames"), audio=len(audio))
        ok = (res["size"] == "1920x1080" and res["fps"] == "30/1" and res["codec"] == "h264"
              and res["pix"] == "yuv420p" and abs(fdur - dur) < 0.05 and not audio)
        ok_all &= ok
        print(f"{name}: {'PASS' if ok else 'FAIL'} {res}")

        # Step 7 contact sheet: 5 evenly spaced frames
        n = int(round(dur * 30))
        tiles = []
        for i in range(5):
            fr = int(i * (n - 1) / 4)
            img = frame(f, fr / 30 + 0.001, chk / f"{name}_f{fr:03d}.png")
            tiles.append(Image.fromarray(img.astype(np.uint8)).resize((640, 360)))
        sheet = Image.new("RGB", (640 * 5, 360))
        for i, t in enumerate(tiles):
            sheet.paste(t, (640 * i, 0))
        sheet.save(chk / f"{name}_sheet.png")

        if name == "EquationFlight_Black":
            # Empty-black samples: the darkest 2% of pixels in several frames
            # must be exactly 0,0,0 after decoding.
            zeros = []
            for fr in (0, 150, 300, 450, 599):
                img = frame(f, fr / 30 + 0.001, chk / f"black_{fr}.png")
                lum = img.sum(2)
                thr = np.percentile(lum, 2)
                dark = img[lum <= thr]
                zeros.append((fr, int(dark.max()), round(float((lum == 0).mean()) * 100, 1)))
            pure = all(z[1] == 0 for z in zeros)
            ok_all &= pure
            print(f"  black check {'PASS' if pure else 'FAIL'}: (frame, max value in darkest 2%, % pixels exactly 0,0,0) = {zeros}")

    # Step 6 banding: profile along a row through the smoothest gradient.
    for name, row, x0, x1 in [("EquationFlight_Navy", 1060, 0, 1919), ("AICodeScreen_Dark", 1070, 0, 1919),
                              ("AICodeScreen_Light", 1070, 0, 1919), ("BalanceScreen_Drain", 1070, 0, 1919)]:
        f = d / f"{name}.mp4"
        if not f.exists():
            continue
        img = frame(f, 5.0, chk / f"band_{name}.png")
        line = img[row, x0:x1 + 1].mean(1)
        # Plateaus longer than 40 px followed by a jump >= 1 level would be
        # visible steps. Grain makes adjacent values vary, so smooth first and
        # count the longest run of identical smoothed values.
        k = 15
        sm = np.convolve(line, np.ones(k) / k, mode="valid")
        steps = np.abs(np.diff(np.round(sm)))
        runs, cur = [], 1
        for i in range(1, len(sm)):
            if round(sm[i]) == round(sm[i - 1]):
                cur += 1
            else:
                runs.append(cur); cur = 1
        runs.append(cur)
        jitter = float(np.abs(np.diff(line)).mean())
        print(f"{name} banding row {row}: range {line.min():.0f}-{line.max():.0f}, mean |dx| {jitter:.2f} (grain), "
              f"longest flat run (smoothed) {max(runs)} px, max smoothed jump {steps.max():.0f}")
        np.savetxt(chk / f"band_{name}_row{row}.txt", line, fmt="%.1f")
    print("ALL BASIC CHECKS PASS" if ok_all else "SOME CHECKS FAILED")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "out/previews")
