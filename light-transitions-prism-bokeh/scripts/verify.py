# Verify loop helpers. Usage: python3 -I scripts/verify.py <step> ...
import subprocess, sys, json, os
import numpy as np
from PIL import Image

SPEC = {  # file -> (duration, kind)
  'LightSweep_Violet': (8.0, 'overlay'), 'LightSweep_Gold': (8.0, 'overlay'),
  'FlareBurst_VioletGold': (6.0, 'overlay'), 'FlareBurst_Cyan': (6.0, 'overlay'),
  'LightLeak_VioletBlue': (12.0, 'overlay'), 'LightLeak_WarmAmber': (12.0, 'overlay'),
  'PrismLight_Rainbow': (20.0, 'loop'), 'RedBokeh_RedGold': (20.0, 'loop'),
}

def maximum_filter(a, size):
    # separable max filter (no scipy dependency)
    r = size // 2
    def run(x, axis):
        out = x.copy()
        for k in range(1, r + 1):
            out = np.maximum(out, np.roll(x, k, axis)); out = np.maximum(out, np.roll(x, -k, axis))
        return out
    return run(run(a, 0), 1)

def frame(path, n, w=1280, h=720):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'select=eq(n\\,{n})', '-vsync', '0',
                                   '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3)

def nframes(path):
    j = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v',
                                            '-show_entries', 'stream=nb_read_frames', '-of', 'json', path]))
    return int(j['streams'][0]['nb_read_frames'])

def probe(path):
    j = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
        'stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt', '-show_entries', 'format=duration', '-of', 'json', path]))
    return j

def step1(d):
    ok = True
    for name, (dur, _) in SPEC.items():
        p = os.path.join(d, name + '.mp4'); j = probe(p); s = j['streams']
        v = [x for x in s if x['codec_type'] == 'video'][0]; audio = [x for x in s if x['codec_type'] == 'audio']
        D = float(j['format']['duration'])
        good = (v['width'], v['height'], v['r_frame_rate'], v['codec_name'], v['pix_fmt']) == (1280, 720, '30/1', 'h264', 'yuv420p') \
            and not audio and abs(D - dur) < 0.05
        ok &= good
        print(f"{'PASS' if good else 'FAIL'} {name}: {v['width']}x{v['height']} {v['r_frame_rate']} {v['codec_name']} {v['pix_fmt']} audio={len(audio)} dur={D:.3f}s (want {dur})")
    return ok

def step2_black(d):
    ok = True
    for name, (dur, kind) in SPEC.items():
        if kind != 'overlay': continue
        p = os.path.join(d, name + '.mp4'); n = nframes(p)
        a, b = frame(p, 0), frame(p, n - 1)
        good = a.max() <= 1 and b.max() <= 1
        ok &= good
        print(f"{'PASS' if good else 'FAIL'} {name}: frame 0 max={a.max()} nonzero={int((a>0).sum())}; frame {n-1} max={b.max()} nonzero={int((b>0).sum())}")
    return ok

def step4_black(d):
    # In frames with black areas, sample 30 points that are well away from light.
    ok = True
    rng = np.random.default_rng(1)
    for name, (dur, kind) in SPEC.items():
        if kind != 'overlay': continue
        p = os.path.join(d, name + '.mp4'); n = nframes(p)
        res = []
        for f in np.linspace(5, n - 6, 12).astype(int):
            im = frame(p, f).astype(int); mx = im.max(2)
            # "black area": pixels whose 41x41 neighbourhood max is <= 1
            # black area = at least 12 px away from any pixel brighter than 3% (8/255)
            cand = np.nonzero(maximum_filter(mx, size=25) < 8)
            if len(cand[0]) < 30: continue
            idx = rng.choice(len(cand[0]), 30, replace=False)
            vals = im[cand[0][idx], cand[1][idx]]
            res.append((int(f), int(vals.max())))
        worst = max(v for _, v in res) if res else None
        good = worst is not None and worst <= 1
        ok &= good
        print(f"{'PASS' if good else 'FAIL'} {name}: 30-point black samples in {len(res)} frames, max channel value = {worst}  {res}")
    return ok

def banding(d, name, frames, rows):
    p = os.path.join(d, name + '.mp4')
    for f in frames:
        im = frame(p, f).astype(int)
        for (y0, x0, y1, x1) in rows:
            n = int(max(abs(x1 - x0), abs(y1 - y0)))
            ys = np.linspace(y0, y1, n).astype(int); xs = np.linspace(x0, x1, n).astype(int)
            line = im[ys, xs]
            # smooth with a 15-px box to remove grain; then look for plateaus + jumps
            k = np.ones(15) / 15
            sm = np.stack([np.convolve(line[:, c], k, mode='valid') for c in range(3)], 1)
            dif = np.abs(np.diff(sm, axis=0)).max()
            raw_steps = np.abs(np.diff(line, axis=0)).max(0)
            print(f"  {name} f{f} line ({x0},{y0})->({x1},{y1}): smoothed max step {dif:.2f}/px, samples every 80px:",
                  [tuple(int(v) for v in line[i]) for i in range(0, n, 80)])

if __name__ == '__main__':
    step = sys.argv[1]
    if step == 'step1': sys.exit(0 if step1(sys.argv[2]) else 1)
    if step == 'black-ends': sys.exit(0 if step2_black(sys.argv[2]) else 1)
    if step == 'black-samples': sys.exit(0 if step4_black(sys.argv[2]) else 1)
    if step == 'png-equal':
        a = np.asarray(Image.open(sys.argv[2]).convert('RGB')); b = np.asarray(Image.open(sys.argv[3]).convert('RGB'))
        same_bytes = open(sys.argv[2], 'rb').read() == open(sys.argv[3], 'rb').read()
        diff = int((a != b).any(2).sum())
        print(f"{'PASS' if diff == 0 else 'FAIL'} {os.path.basename(sys.argv[2])} vs {os.path.basename(sys.argv[3])}: differing pixels={diff}, identical file bytes={same_bytes}")
        sys.exit(0 if diff == 0 else 1)
