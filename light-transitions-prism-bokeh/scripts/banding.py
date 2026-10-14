# Step 4 banding: read gradients from the ENCODED mp4. Each profile is averaged over a
# 24-px strip (removes grain/dither), then we look for staircase steps.
# A banded gradient shows flat runs ending in a >= 1 LSB jump; a dithered one changes smoothly.
import subprocess, sys, numpy as np
def frame(path, n, w=1280, h=720):
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',path,'-vf',f'select=eq(n\\,{n})','-vsync','0','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'])
    return np.frombuffer(raw,np.uint8).reshape(h,w,3).astype(float)
def profile(im, x0, y0, x1, y1, half=12):
    n = int(np.hypot(x1-x0, y1-y0)); t = np.linspace(0,1,n)
    d = np.array([x1-x0, y1-y0]) / n; perp = np.array([-d[1], d[0]])
    acc = []
    for o in range(-half, half+1):
        xs = np.clip((x0 + (x1-x0)*t + perp[0]*o).astype(int), 0, im.shape[1]-1)
        ys = np.clip((y0 + (y1-y0)*t + perp[1]*o).astype(int), 0, im.shape[0]-1)
        acc.append(im[ys, xs])
    return np.mean(acc, 0)
def report(label, path, n, line, ch):
    im = frame(path, n); p = profile(im, *line)[:, ch]
    raw = frame(path, n)
    k = 8; s = np.convolve(p, np.ones(k)/k, mode='valid')
    steps = np.abs(np.diff(s))
    # "flat runs": stretches of >= 24 px where the strip-averaged value stays within +-0.15 while the overall gradient moves
    slope = abs(p[-1]-p[0]) / len(p)
    print(f"{label}: frame {n}, line {line}, channel {'RGB'[ch]}: {p[0]:.1f} -> {p[-1]:.1f} over {len(p)} px "
          f"(mean slope {slope:.3f} LSB/px); largest 1-px step of smoothed profile {steps.max():.3f} LSB; "
          f"profile every 64 px: {[round(v,1) for v in p[::64]]}")
args = sys.argv[1:]
report('Red Bokeh background (sprites hidden)', 'out/checks/redbg.mp4', 10, (0,0,690,324), 0)
report('Red Bokeh background (sprites hidden)', 'out/checks/redbg.mp4', 10, (1279,719,690,324), 0)
report('Red Bokeh background (sprites hidden)', 'out/checks/redbg.mp4', 10, (0,400,1279,400), 1)
report('Light Sweep Violet band', 'out/previews/LightSweep_Violet.mp4', 78, (640,600,1270,60), 0)
report('Light Sweep Violet band', 'out/previews/LightSweep_Violet.mp4', 78, (640,600,1270,60), 2)
report('Light Sweep Gold band', 'out/previews/LightSweep_Gold.mp4', 78, (640,600,1270,60), 1)
report('Flare Burst VioletGold glow', 'out/previews/FlareBurst_VioletGold.mp4', 140, (620,420,1270,700), 2)
report('Flare Burst Cyan glow', 'out/previews/FlareBurst_Cyan.mp4', 140, (620,420,1270,700), 1)
report('Light Leak VioletBlue cloud', 'out/previews/LightLeak_VioletBlue.mp4', 75, (450,250,1270,250), 2)
report('Light Leak WarmAmber cloud', 'out/previews/LightLeak_WarmAmber.mp4', 75, (450,250,1270,250), 0)
report('Prism Light shards/centre', 'out/previews/PrismLight_Rainbow.mp4', 300, (640,360,1270,700), 2)
