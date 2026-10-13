"""Step 4: read pixel values from a frame of the ENCODED mp4 across the
banding-prone areas and check that they change smoothly.

For each sample line: luminance profile (8-bit), smoothed over 9 px to
remove grain; we report the largest step between neighbouring smoothed
samples and the longest flat run followed by a jump >= 1 level (a
staircase). Smooth = no step > 1.0 level and no staircase."""
import subprocess, sys, json
from PIL import Image

LINES = {  # id: list of (name, x0, y0, x1, y1) in 1280x720 coordinates
    "CloudUpload-Blue": [("left haze, horizontal", 0, 120, 360, 120), ("upper-right background", 900, 30, 1270, 140)],
    "DataPills-Blue": [("left haze, horizontal", 0, 380, 500, 380), ("right background", 900, 20, 1270, 20)],
    "DataPills-Amber": [("left haze, horizontal", 0, 380, 500, 380), ("right background", 900, 20, 1270, 20)],
    "DiamondFrames-BlackGold": [("centre panel, vertical", 640, 200, 640, 640)],
    "DiamondFrames-BlackSilver": [("centre panel, vertical", 640, 200, 640, 640)],
    "TopoLines-Silver": [("black + glow falloff", 0, 360, 1279, 360)],
    "TopoLines-Cyan": [("black + glow falloff", 0, 360, 1279, 360)],
    "FacetedRelief-MidnightBlue": [("facet gradient", 0, 500, 1279, 500)],
}

def lum(p):
    r, g, b = p[:3]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

out = {}
sel = sys.argv[1:] or list(LINES)
for cid, lines in [(c, LINES[c]) for c in sel]:
    mp4 = f"out/previews/{cid.replace('-', '_')}.mp4"
    png = f"out/checks/{cid}_mp4_f300.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", "select=eq(n\\,300)", "-frames:v", "1", png], check=True)
    im = Image.open(png).convert("RGB")
    res = []
    for name, x0, y0, x1, y1 in lines:
        n = max(abs(x1 - x0), abs(y1 - y0)) + 1
        vals = [lum(im.getpixel((round(x0 + (x1 - x0) * i / (n - 1)), round(y0 + (y1 - y0) * i / (n - 1))))) for i in range(n)]
        k = 4
        sm = [sum(vals[max(0, i - k):i + k + 1]) / len(vals[max(0, i - k):i + k + 1]) for i in range(n)]
        steps = [abs(sm[i + 1] - sm[i]) for i in range(n - 1)]
        # staircase: flat run (raw values within +-0) >= 12 px, then jump >= 1 level, in a
        # region where the smoothed slope is small (true gradient, not an edge)
        raw = [round(v) for v in vals]
        stair = 0
        run = 1
        for i in range(1, n):
            if raw[i] == raw[i - 1]:
                run += 1
            else:
                if run >= 12 and abs(raw[i] - raw[i - 1]) >= 1 and raw[i - 1] > 2:
                    stair = max(stair, run)
                run = 1
        sample = [round(v, 1) for v in sm[:: max(1, n // 12)]]
        res.append({"line": name, "min": round(min(vals), 1), "max": round(max(vals), 1),
                    "max_smoothed_step": round(max(steps), 2), "longest_flat_run_before_jump": stair,
                    "smoothed_profile_sample": sample})
    out[cid] = res
print(json.dumps(out, indent=1))
