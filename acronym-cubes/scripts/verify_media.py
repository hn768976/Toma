"""Steps 1, 4, 5, 6 helpers: ffprobe checks, banding profile, contact sheets, motion metrics.
python3 scripts/verify_media.py <AcronymCubes_X.mp4> <outdir>
"""
import json, subprocess, sys, os
import numpy as np
from PIL import Image

mp4, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
name = os.path.basename(mp4)[:-4]
res = {"file": name}

# --- step 1: ffprobe
p = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", mp4]))
v = [s for s in p["streams"] if s["codec_type"] == "video"]
a = [s for s in p["streams"] if s["codec_type"] == "audio"]
v = v[0]
res["probe"] = dict(codec=v["codec_name"], w=v["width"], h=v["height"], fps=v["r_frame_rate"],
                    pix=v["pix_fmt"], dur=float(p["format"]["duration"]), audio=len(a), frames=v.get("nb_frames"))
res["step1"] = (v["codec_name"] == "h264" and v["width"] == 1280 and v["height"] == 720 and v["r_frame_rate"] == "30/1"
                and v["pix_fmt"] == "yuv420p" and abs(float(p["format"]["duration"]) - 20.0) < 0.02 and not a)

def frames(start, count):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", mp4, "-vf", f"select='between(n\\,{start}\\,{start+count-1})'",
                                   "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    return np.frombuffer(raw, np.uint8).reshape(-1, 720, 1280, 3)

# --- step 4: banding on the decoded mp4 (frame 300)
f300 = frames(300, 1)[0]
Image.fromarray(f300).save(f"{outdir}/{name}_f300.png")
L = f300.astype(float) @ [0.2126, 0.7152, 0.0722]
def profile(rows, cols):
    seg = L[rows[0]:rows[1], cols[0]:cols[1]]
    col = seg.mean(axis=1)                    # vertical profile, averaged across a strip
    d = np.abs(np.diff(col))
    return dict(max_step=round(float(d.max()), 2), mean_step=round(float(d.mean()), 2), range=[round(float(col.min()),1), round(float(col.max()),1)])
res["band_top_bokeh"] = profile((0, 140), (560, 720))
res["band_plate"] = profile((300, 360), (290, 330))  # plate top face, left of the letters
res["band_bottom_bokeh"] = profile((620, 720), (560, 720))
# plateau test: in a wide smooth strip, look for runs of identical 8-bit values with 1-level jumps
strip = f300[0:140, 600:680].astype(int).mean(axis=1)
res["top_unique_levels"] = int(len(np.unique(np.round(strip))))

# --- step 5: contact sheet, 5 evenly spaced frames
idx = [0, 120, 240, 360, 480]
imgs = [frames(i, 1)[0] for i in idx]
sheet = np.concatenate(imgs, axis=1)
Image.fromarray(sheet).resize((3200, 360), Image.LANCZOS).save(f"{outdir}/{name}_sheet.png")

# --- step 6: motion around frame 300 (2 s), consecutive-frame difference energy
clip = frames(270, 60).astype(np.int16)
diffs = [float(np.abs(clip[i+1] - clip[i]).mean()) for i in range(len(clip)-1)]
res["motion_diff_mean"] = round(float(np.mean(diffs)), 3)
res["motion_diff_cv"] = round(float(np.std(diffs) / (np.mean(diffs) + 1e-9)), 3)
res["motion_diff_maxratio"] = round(float(max(diffs) / (np.median(diffs) + 1e-9)), 3)
# a strip of 6 consecutive crops for eyeballing icon shimmer
crops = [clip[i, 450:560, 300:700].astype(np.uint8) for i in range(28, 34)]
Image.fromarray(np.concatenate(crops, axis=0)).save(f"{outdir}/{name}_motion_crops.png")
# loop seam: frame 599 → frame 0 difference vs typical
a599 = frames(599, 1)[0].astype(np.int16); a0 = frames(0, 1)[0].astype(np.int16)
res["seam_diff"] = round(float(np.abs(a599 - a0).mean()), 3)
print(json.dumps(res))
