"""Steps 4-6 on the encoded previews.
- banding: frame 150 decoded from the mp4; luminance profiles across the areas
  named in the brief, averaged across a 24 px band. Reports the largest step
  between neighbouring samples and the longest flat run.
- contact sheets: 5 evenly spaced frames per composition.
- motion: mean absolute difference between consecutive frames 270..330;
  a pop shows up as a spike relative to its neighbours.
Usage: python3 scripts/analyze.py out/previews out/analysis
"""
import subprocess, sys, os, json
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)

def frames(mp4, idx):
    out = []
    for i in idx:
        p = f"{dst}/_f.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", f"select=eq(n\\,{i})", "-frames:v", "1", p], check=True)
        out.append(np.asarray(Image.open(p).convert("RGB")).astype(np.float64))
    return out

def lum(a):
    return a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722

# (name, orientation, fixed coord fraction, start, end) all as fractions of W/H
PROFILES = {
    "WindFarmHologram_Blue": [("sky column x=0.88", "v", 0.88, 0.03, 0.62), ("violet bloom row y=0.55", "h", 0.55, 0.45, 0.78)],
    "WindFarmHologram_Green": [("sky column x=0.88", "v", 0.88, 0.03, 0.62), ("glow row y=0.55", "h", 0.55, 0.45, 0.78)],
    "PrismDispersion_Dark": [("row y=0.12 across incoming beam", "h", 0.12, 0.05, 0.6)],
    "MagneticTorus_PinkViolet": [("bg row y=0.08", "h", 0.08, 0.02, 0.98), ("bg column x=0.04", "v", 0.04, 0.02, 0.98)],
    "BarMagnets_Attract": [("column through shadow x=0.3", "v", 0.3, 0.5, 0.95), ("bg row y=0.06", "h", 0.06, 0.02, 0.98)],
    "BarMagnets_Repel": [("column through shadow x=0.3", "v", 0.3, 0.5, 0.95)],
    "ElectricField_OppositeCharges": [("row y=0.25", "h", 0.25, 0.0, 1.0)],
    "ElectricField_LikeCharges": [("row y=0.25", "h", 0.25, 0.0, 1.0)],
}
report = {}
for name, profs in PROFILES.items():
    mp4 = f"{src}/{name}.mp4"
    if not os.path.exists(mp4):
        continue
    f150 = frames(mp4, [150])[0]
    Image.fromarray(f150.astype(np.uint8)).save(f"{dst}/{name}_f150.png")
    L = lum(f150)
    H, W = L.shape
    rep = []
    for label, o, c, a, b in profs:
        if o == "h":
            y = int(c * H)
            band = L[max(0, y - 12): y + 12, int(a * W): int(b * W)].mean(axis=0)
        else:
            x = int(c * W)
            band = L[int(a * H): int(b * H), max(0, x - 12): x + 12].mean(axis=1)
        d = np.abs(np.diff(band))
        r = np.round(band, 1)
        run, best = 1, 1
        for i in range(1, len(r)):
            run = run + 1 if r[i] == r[i - 1] else 1
            best = max(best, run)
        rep.append({"profile": label, "min": round(band.min(), 1), "max": round(band.max(), 1),
                    "max_step": round(float(d.max()), 2), "p99_step": round(float(np.percentile(d, 99)), 2),
                    "longest_flat_run_px": best,
                    "samples": [round(v, 1) for v in band[:: max(1, len(band) // 12)]]})
    # contact sheet
    fs = frames(mp4, [0, 120, 240, 360, 480])
    sheet = np.concatenate([np.asarray(Image.fromarray(f.astype(np.uint8)).resize((384, 216), Image.LANCZOS)) for f in fs], axis=1)
    Image.fromarray(sheet).save(f"{dst}/{name}_sheet.png")
    # motion around frame 300
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", "select=between(n\\,270\\,330)", "-vsync", "0", f"{dst}/_m%03d.png"], check=True)
    ms = sorted(p for p in os.listdir(dst) if p.startswith("_m"))
    arr = [lum(np.asarray(Image.open(f"{dst}/{p}").convert("RGB")).astype(np.float64)) for p in ms]
    diffs = [float(np.abs(arr[i + 1] - arr[i]).mean()) for i in range(len(arr) - 1)]
    for p in ms:
        os.remove(f"{dst}/{p}")
    med = float(np.median(diffs))
    spikes = [i + 270 for i, v in enumerate(diffs) if v > 2.5 * med + 0.2]
    report[name] = {"banding": rep, "motion_mean_abs_diff": [round(v, 2) for v in diffs], "motion_median": round(med, 2), "motion_spikes_at": spikes}
    print(name, json.dumps({"banding": [(r["profile"], r["max_step"], r["longest_flat_run_px"]) for r in rep], "motion_median": round(med, 2), "spikes": spikes}))
json.dump(report, open(f"{dst}/report.json", "w"), indent=1)
