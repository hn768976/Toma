"""
Banding check on the ENCODED mp4 (not the preview):
  python3 scripts/check_banding.py <video.mp4> <frame> <out.png> [y_frac x0_frac x1_frac] [lining box]

Extracts the frame to PNG with ffmpeg, then along a horizontal line through the
backdrop measures
  - run lengths of identical 8-bit values in single raw rows (banding shows as
    long flat runs followed by 1-code steps; dither/grain keeps runs short),
  - a 21-row average profile vs a smooth polynomial fit (staircase residual),
and writes a plot. Optional lining box (x0,y0,x1,y1 fractions) gets the same
run-length statistic in 2D.
"""
import json
import subprocess
import sys

import numpy as np
from PIL import Image


def runs(row):
    r, c = [], 1
    for a, b in zip(row[:-1], row[1:]):
        if a == b:
            c += 1
        else:
            r.append(c)
            c = 1
    r.append(c)
    return np.array(r)


def main():
    video, frame, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    yf, x0f, x1f = (float(v) for v in (sys.argv[4:7] if len(sys.argv) >= 7 else (0.5, 0.0, 0.3)))
    png = out.replace(".png", "_frame.png")
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", video, "-vf", f"select=eq(n\\,{frame})", "-vframes", "1", png],
        check=True,
    )
    im = np.asarray(Image.open(png).convert("RGB")).astype(float)
    H, W, _ = im.shape
    y = int(yf * H)
    x0, x1 = int(x0f * W), int(x1f * W)
    lum = im[..., 0] * 0.2126 + im[..., 1] * 0.7152 + im[..., 2] * 0.0722
    stats = {"video": video, "frame": frame, "row": y, "x": [x0, x1]}
    # raw rows: run lengths per channel
    rl = []
    for dy in range(-10, 11):
        for ch in range(3):
            rl.extend(runs(im[y + dy, x0:x1, ch].astype(int)))
    rl = np.array(rl)
    stats["raw_run_length_mean"] = round(float(rl.mean()), 2)
    stats["raw_run_length_p99"] = int(np.percentile(rl, 99))
    stats["raw_run_length_max"] = int(rl.max())
    # averaged profile vs smooth fit
    prof = lum[y - 10 : y + 11, x0:x1].mean(0)
    xs = np.arange(len(prof))
    fit = np.polyval(np.polyfit(xs, prof, 4), xs)
    res = prof - fit
    stats["profile_range_codes"] = round(float(prof.max() - prof.min()), 2)
    stats["profile_residual_rms"] = round(float(res.std()), 3)
    stats["profile_residual_max"] = round(float(np.abs(res).max()), 3)
    # a staircase shows up as residual structure at the step period; compare
    # the residual spectrum peak with the noise floor
    spec = np.abs(np.fft.rfft(res - res.mean()))
    stats["residual_spectrum_peak_over_median"] = round(float(spec[1:].max() / (np.median(spec[1:]) + 1e-9)), 2)
    if len(sys.argv) >= 11:
        bx0, by0, bx1, by1 = (float(v) for v in sys.argv[7:11])
        box = im[int(by0 * H) : int(by1 * H), int(bx0 * W) : int(bx1 * W)]
        rlb = []
        for row in box[::4]:
            for ch in range(3):
                rlb.extend(runs(row[:, ch].astype(int)))
        rlb = np.array(rlb)
        stats["lining_box_run_length_mean"] = round(float(rlb.mean()), 2)
        stats["lining_box_run_length_p99"] = int(np.percentile(rlb, 99))
        stats["lining_box_values_R"] = [int(box[..., 0].min()), int(box[..., 0].max())]
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(2, 1, figsize=(10, 6))
        ax[0].plot(im[y, x0:x1, 2], lw=0.6, label="raw row, blue channel")
        ax[0].plot(prof, lw=1.2, label="21-row average luminance")
        ax[0].legend()
        ax[0].set_title(f"{video.split('/')[-1]} frame {frame}: backdrop row {y}, x {x0}-{x1}")
        ax[1].plot(res, lw=0.8)
        ax[1].set_title("average minus smooth fit (a staircase would show here)")
        fig.tight_layout()
        fig.savefig(out, dpi=80)
    except Exception as e:  # plot is optional
        stats["plot_error"] = str(e)
    print(json.dumps(stats))


if __name__ == "__main__":
    main()
