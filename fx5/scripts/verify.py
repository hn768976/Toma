"""Verify loop analysis: probes, black ends, loop/determinism equality,
overlay black levels, banding profiles, contact sheets. Run with python3 -I."""
import json, subprocess, sys, os
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.dirname(__file__) + '/..')
PREV = f'{ROOT}/out/previews'
VER = f'{ROOT}/out/verify'
os.makedirs(VER, exist_ok=True)
NAMES = ['InkBloom_Multicolour', 'InkBloom_Violet', 'NeuralPaths_Green', 'NeuralPaths_Magenta',
         'Lightning_BlueViolet', 'Lightning_BlackOverlay', 'FlarePass_Orange', 'FlarePass_Blue',
         'SpiralGalaxy_Violet', 'SpiralGalaxy_Teal']
names = sys.argv[1:] or NAMES
DUR = {'InkBloom': 14.0, 'FlarePass': 8.0}
def dur(n): return next((v for k, v in DUR.items() if n.startswith(k)), 20.0)
def nframes(n): return int(round(dur(n) * 30))

def frames(path, idxs):
    """decode given frame indices from the encoded mp4 as RGB uint8 arrays"""
    out = {}
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(-1, 720, 1280, 3)
    for i in idxs: out[i] = a[min(i, len(a) - 1)]
    return out, len(a)

report = {}
for n in names:
    r = {}
    mp4 = f'{PREV}/{n}.mp4'
    pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
        'stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt:format=duration', '-of', 'json', mp4],
        capture_output=True, check=True).stdout)
    st = pr['streams']
    v = st[0]
    r['probe'] = dict(codec=v['codec_name'], w=v['width'], h=v['height'], fps=v['r_frame_rate'], pix=v['pix_fmt'],
                      audio=any(s['codec_type'] == 'audio' for s in st), duration=float(pr['format']['duration']))
    r['probe_ok'] = (v['codec_name'] == 'h264' and v['width'] == 1280 and v['height'] == 720 and v['r_frame_rate'] == '30/1'
                     and v['pix_fmt'] == 'yuv420p' and not r['probe']['audio'] and abs(r['probe']['duration'] - dur(n)) < 0.02
                     and len(st) == 1)
    N = nframes(n)
    sheet_idx = [int(round(i * (N - 1) / 7)) for i in range(8)] if N != 600 else [0, 150, 300, 450, 599]
    fr, count = frames(mp4, list(range(N)))
    r['decoded_frames'] = count
    if n.startswith(('InkBloom', 'FlarePass')):
        r['first_frame_max'] = int(fr[0].max()); r['last_frame_max'] = int(fr[N - 1].max())
        r['black_ends_ok'] = r['first_frame_max'] <= 1 and r['last_frame_max'] <= 1
    else:
        a, b = f'{VER}/{n}_f0.png', f'{VER}/{n}_f600.png'
        if os.path.exists(a) and os.path.exists(b):
            A = np.asarray(Image.open(a).convert('RGB')); B = np.asarray(Image.open(b).convert('RGB'))
            r['loop_identical'] = bool(np.array_equal(A, B)); r['loop_maxdiff'] = int(np.abs(A.astype(int) - B).max())
    a, b = f'{VER}/{n}_mid_cold.png', f'{VER}/{n}_mid_full.png'
    if os.path.exists(a) and os.path.exists(b):
        A = np.asarray(Image.open(a).convert('RGB')); B = np.asarray(Image.open(b).convert('RGB'))
        r['determinism_identical'] = bool(np.array_equal(A, B)); r['determinism_maxdiff'] = int(np.abs(A.astype(int) - B).max())
    # overlay black level: 30 seeded points per sampled frame, far from anything lit
    if n in ('Lightning_BlackOverlay', 'FlarePass_Orange', 'FlarePass_Blue'):
        rng = np.random.default_rng(7)
        samples = []
        test = [60, 120, 160, 200] if n.startswith('Flare') else [5, 50, 120, 200, 330, 450, 560]
        for i in test:
            f = fr[i]
            lit = f.max(axis=2) > 6
            # dilate lit area by ~48px (cheap separable max filter)
            from numpy.lib.stride_tricks import sliding_window_view as sw
            pad = np.pad(lit, 48)
            d = sw(pad, 97, axis=0).max(axis=-1); d = sw(d, 97, axis=1).max(axis=-1)
            ys, xs = np.nonzero(~d)
            if len(ys) == 0: continue
            pick = rng.choice(len(ys), size=min(30, len(ys)), replace=False)
            vals = f[ys[pick], xs[pick]]
            samples.append(dict(frame=i, n=len(pick), max=int(vals.max()), mean=float(vals.mean())))
        r['black_samples'] = samples
        r['black_ok'] = all(s['max'] <= 1 for s in samples)
    # banding: vertical/horizontal profiles through gradients, averaged over 16 px
    prof_spec = {
        'Lightning_BlueViolet': (300, 'col', 704), 'FlarePass_Orange': (150, 'row', 300), 'FlarePass_Blue': (150, 'row', 300),
        'SpiralGalaxy_Violet': (300, 'row', 360), 'SpiralGalaxy_Teal': (300, 'row', 360),
        'NeuralPaths_Green': (0, 'row', 360), 'NeuralPaths_Magenta': (0, 'row', 360),
        'InkBloom_Multicolour': (300, 'row', 360), 'InkBloom_Violet': (300, 'row', 360),
        'Lightning_BlackOverlay': (40, 'row', 300),
    }
    fi, kind, at = prof_spec[n]
    f = fr[fi].astype(float).mean(axis=2)
    if kind == 'col': p = f[:, at - 8:at + 8].mean(axis=1)
    else: p = f[at - 8:at + 8, :].mean(axis=0)
    dif = np.abs(np.diff(p))
    r['banding_profile'] = dict(frame=fi, kind=kind, at=at, max_step=round(float(dif.max()), 2),
                                p95_step=round(float(np.percentile(dif, 95)), 2),
                                sample=[round(float(x), 1) for x in p[::64]])
    # contact sheet
    tiles = [Image.fromarray(fr[i]).resize((480, 270)) for i in sheet_idx]
    cols = 4 if len(tiles) == 8 else 5
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (480 * cols, 270 * rows))
    for k, t in enumerate(tiles): sheet.paste(t, ((k % cols) * 480, (k // cols) * 270))
    sheet.save(f'{VER}/{n}_sheet.png')
    report[n] = r
    print(n, json.dumps(r))
old = json.load(open(f'{VER}/report.json')) if os.path.exists(f'{VER}/report.json') else {}
old.update(report)
json.dump(old, open(f'{VER}/report.json', 'w'), indent=1)
