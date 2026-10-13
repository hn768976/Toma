"""Step 6: 2 s around frame 300 (frames 270-329) of each preview.
Per-frame mean absolute difference to the previous frame; strobing or
flicker shows as alternating spikes (diff(t) much larger than its
neighbours). Also writes a strip of 1:1 crops of 6 consecutive frames."""
import subprocess, sys, os, json
from PIL import Image, ImageChops, ImageStat

ids = sys.argv[1:]
os.makedirs("out/motion", exist_ok=True)
crops = {"CloudUpload-Blue": (280, 120), "DataPills-Blue": (500, 250), "DataPills-Amber": (500, 250),
         "DiamondFrames-BlackGold": (440, 40), "DiamondFrames-BlackSilver": (440, 40),
         "TopoLines-Silver": (500, 300), "TopoLines-Cyan": (500, 300), "FacetedRelief-MidnightBlue": (500, 280)}
rep = {}
for cid in ids:
    d = f"out/motion/{cid}"
    os.makedirs(d, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"out/previews/{cid.replace('-', '_')}.mp4",
                    "-vf", "select=between(n\\,270\\,329)", "-vsync", "0", f"{d}/f%03d.png"], check=True)
    files = sorted(os.listdir(d))
    ims = [Image.open(f"{d}/{f}").convert("L") for f in files]
    diffs = [ImageStat.Stat(ImageChops.difference(ims[i], ims[i - 1])).mean[0] for i in range(1, len(ims))]
    spikes = sum(1 for i in range(1, len(diffs) - 1) if diffs[i] > 2.0 * max(diffs[i - 1], diffs[i + 1]) and diffs[i] > 0.5)
    x, y = crops[cid]
    strip = Image.new("RGB", (6 * 320, 180))
    for k in range(6):
        strip.paste(Image.open(f"{d}/{files[27 + k]}").convert("RGB").crop((x, y, x + 320, y + 180)), (k * 320, 0))
    strip.save(f"out/motion/{cid}_strip.png")
    rep[cid] = {"frames": len(ims), "mean_diff": round(sum(diffs) / len(diffs), 3),
                "min_diff": round(min(diffs), 3), "max_diff": round(max(diffs), 3), "isolated_spikes": spikes}
print(json.dumps(rep, indent=1))
