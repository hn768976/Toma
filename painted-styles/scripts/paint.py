"""Build-time painting. Every image the project uses is produced here with fixed seeds.

  python scripts/paint.py audit [--keys a,b] [--size 1920x1080]   -> audit/<key>.png + audit/times.json
  python scripts/paint.py time4k [--keys a,b]                       -> 4K paint times (images to scratch dir)
  python scripts/paint.py speed --keys a,b,c                        -> 1920 / 3840 / 6000 timings
  python scripts/paint.py determinism --keys a [--size 1920x1080]   -> paints twice, compares sha256
  python scripts/paint.py sheet                                     -> StyleAudit.png (5 x 4, 640x360 tiles)
"""
import argparse, hashlib, importlib, json, os, sys, tempfile, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drawkit
from drawkit import save_png, ROOT
from PIL import Image, ImageDraw, ImageFont

AUDIT_KEYS = [  # the 13 requested + 7 picked
    'inkwash', 'watercolour', 'ukiyoe', 'stainedglass', 'mosaic', 'artdeco', 'delft',
    'shadowpuppet', 'xray', 'vhs', 'ballpoint', 'pastelui', 'storybook',
    'linocut', 'oilpaint', 'stitch', 'flatvector', 'synthwave', 'papercut', 'pencilbook',
]
SEED = 1
SCRATCH = os.environ.get('PAINT_SCRATCH', tempfile.gettempdir())


def scene(key):
    return importlib.import_module(f'scenes.{key}_lake')


def paint_timed(key, W, H, seed=SEED, stages_dir=None):
    mod = scene(key)
    t = time.perf_counter()
    img = mod.paint(W, H, seed=seed, stages_dir=stages_dir)
    dt = time.perf_counter() - t
    img = drawkit.to_image(img)
    assert img.size == (W, H), (key, img.size)
    return img, dt


def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def load_times():
    p = os.path.join(ROOT, 'audit', 'times.json')
    return json.load(open(p)) if os.path.exists(p) else {}


def save_times(t):
    json.dump(t, open(os.path.join(ROOT, 'audit', 'times.json'), 'w'), indent=1, sort_keys=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd')
    ap.add_argument('--keys', default=','.join(AUDIT_KEYS))
    ap.add_argument('--size', default='1920x1080')
    a = ap.parse_args()
    keys = a.keys.split(',')
    W, H = map(int, a.size.split('x'))

    if a.cmd == 'audit':
        times = load_times()
        for k in keys:
            img, dt = paint_timed(k, W, H)
            save_png(img, os.path.join(ROOT, 'audit', f'{k}.png'))
            times.setdefault(k, {})[f'{W}x{H}'] = round(dt, 1)
            save_times(times); print(k, f'{dt:.1f}s', flush=True)
    elif a.cmd in ('time4k', 'speed'):
        times = load_times()
        sizes = [(3840, 2160)] if a.cmd == 'time4k' else [(1920, 1080), (3840, 2160), (6000, 3375)]
        for k in keys:
            for (w, h) in sizes:
                img, dt = paint_timed(k, w, h)
                save_png(img, os.path.join(SCRATCH, f'{k}_{w}.png'))
                times.setdefault(k, {})[f'{w}x{h}'] = round(dt, 1)
                save_times(times); print(k, w, h, f'{dt:.1f}s', flush=True)
    elif a.cmd == 'determinism':
        for k in keys:
            hs = []
            for i in range(2):
                img, _ = paint_timed(k, W, H)
                p = os.path.join(SCRATCH, f'det_{k}_{i}.png'); save_png(img, p); hs.append(sha(p))
            print(k, 'IDENTICAL' if hs[0] == hs[1] else 'DIFFERENT', hs[0][:16], hs[1][:16], flush=True)
    elif a.cmd == 'sheet':
        names = {k: scene(k).STYLE for k in AUDIT_KEYS}
        tw, th, lab = 640, 360, 34
        sheet = Image.new('RGB', (tw * 5, (th + lab) * 4), (24, 24, 26))
        dr = ImageDraw.Draw(sheet)
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 20)
        for i, k in enumerate(AUDIT_KEYS):
            x, y = (i % 5) * tw, (i // 5) * (th + lab)
            im = Image.open(os.path.join(ROOT, 'audit', f'{k}.png')).convert('RGB').resize((tw, th), Image.LANCZOS)
            sheet.paste(im, (x, y))
            label = f'{i + 1}. ' + names[k].split(' · ')[0]
            dr.text((x + 10, y + th + 6), label, fill=(235, 235, 235), font=font)
        save_png(sheet, os.path.join(ROOT, 'StyleAudit.png'))
        print('StyleAudit.png', sheet.size)


if __name__ == '__main__':
    main()
