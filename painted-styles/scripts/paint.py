"""Build-time painting. Every image the project uses is produced here with fixed seeds.

  python scripts/paint.py audit [--keys a,b] [--size 1920x1080]   -> audit/<key>.png + audit/times.json
  python scripts/paint.py time4k [--keys a,b]                       -> 4K paint times (images to scratch dir)
  python scripts/paint.py speed --keys a,b,c                        -> 1920 / 3840 / 6000 timings
  python scripts/paint.py determinism --keys a [--size 1920x1080]   -> paints twice, compares sha256
  python scripts/paint.py sheet                                     -> StyleAudit.png (5 x 4, 640x360 tiles)

Phase 2 (5 chosen styles):
  python scripts/paint.py layers [--keys ...] [--jobs 3]   -> remotion/public/layers/<key>/, drawon/<key>/, manifest
  python scripts/paint.py stills [--keys ...] [--jobs 3]   -> stills/<Style>_<Scene>_<Colourway>.png (3840x2160)
  python scripts/paint.py stillsheet                       -> StillsSheet.png (6 x 5, 640x360 tiles)
  python scripts/paint.py manifest                         -> remotion/src/manifest.json from what is on disk
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


PHASE2 = [  # key, file prefix, colourway used for the loop / draw-on
    ('watercolour', 'Watercolour', 'Dusk'),
    ('artdeco', 'ArtDeco', 'Dusk'),
    ('stainedglass', 'StainedGlass', 'Dusk'),
    ('inkwash', 'InkWash', 'BlackInk'),
    ('linocut', 'Linocut', 'Vermilion'),
]
SCENES = [('lake', 'Lake'), ('coast', 'Coast'), ('forest', 'Forest')]
P2 = {k: (pre, cw) for k, pre, cw in PHASE2}
BUILD = os.path.join(ROOT, 'build')
PUB = os.path.join(ROOT, 'remotion', 'public')


def p2_times():
    p = os.path.join(ROOT, 'docs', 'phase2_times.json')
    return json.load(open(p)) if os.path.exists(p) else {}


def p2_save_times(t):
    json.dump(t, open(os.path.join(ROOT, 'docs', 'phase2_times.json'), 'w'), indent=1, sort_keys=True)


def _paint_still(key, scene, cw, out):
    mod = importlib.import_module(f'scenes.{key}_{scene}')
    t = time.perf_counter()
    img = mod.paint(3840, 2160, seed=SEED, colourway=cw)
    dt = time.perf_counter() - t
    img = drawkit.to_image(img).convert('RGB')
    assert img.size == (3840, 2160), img.size
    save_png(img, out)
    return dt


def write_manifest():
    styles = []
    for k, pre, cw in PHASE2:
        meta = os.path.join(PUB, 'layers', k, 'layers.json')
        if not os.path.exists(meta):
            continue
        m = json.load(open(meta))
        d = os.path.join(PUB, 'drawon', k)
        frames = sorted(f'drawon/{k}/{f}' for f in os.listdir(d)) if os.path.isdir(d) and m.get('drawon') else None
        styles.append({'key': k, 'prefix': pre, 'name': m['name'], 'canvas': m['canvas'], 'bleed': m['bleed'],
                       'horizon': m['horizon'], 'boatPivot': m['boatPivot'],
                       'layers': [{'group': g, 'src': f'layers/{k}/{f}'} for g, f in m['layers']],
                       'drawon': {'frames': frames} if frames else None})
    json.dump({'styles': styles}, open(os.path.join(ROOT, 'remotion', 'src', 'manifest.json'), 'w'), indent=1)
    print('manifest:', [s['key'] for s in styles])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd')
    ap.add_argument('--keys', default=','.join(AUDIT_KEYS))
    ap.add_argument('--size', default='1920x1080')
    ap.add_argument('--sizes', default='1920x1080,3840x2160,6000x3375')
    ap.add_argument('--jobs', type=int, default=3)
    ap.add_argument('--drawon', default='watercolour,artdeco,stainedglass,inkwash,linocut')
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
        sizes = [(3840, 2160)] if a.cmd == 'time4k' else [tuple(map(int, z.split('x'))) for z in a.sizes.split(',')]
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
    elif a.cmd == 'layers':
        import layers as L
        times = p2_times()
        drawon_keys = set(a.drawon.split(','))
        for k in (keys if a.keys != ','.join(AUDIT_KEYS) else list(P2)):
            pre, cw = P2[k]
            cache = os.path.join(BUILD, 'prefix', k); dense = os.path.join(BUILD, 'dense', k)
            G, t = L.paint_prefixes(k, cw, SEED, cache, jobs=a.jobs, dense_dir=dense if k in drawon_keys else None)
            times.setdefault('layers', {}).setdefault(k, {}).update({g: round(v, 1) for g, v in t.items()})
            p2_save_times(times)
            out = os.path.join(PUB, 'layers', k)
            lay, st = L.extract(k, G, cache, out)
            mod = scene(k)
            drawon = None
            if k in drawon_keys and os.path.isdir(dense):
                drawon = len(L.crop_drawon(dense, os.path.join(PUB, 'drawon', k)))
            S = drawkit.Scaler(3840, 2160, L.BLEED)
            json.dump({'name': mod.STYLE, 'colourway': cw, 'canvas': [S.W, S.H], 'bleed': [S.ox, S.oy],
                       'horizon': st['horizon'], 'boatPivot': st['boatPivot'], 'drawon': drawon,
                       'layers': [[g, os.path.basename(p)] for g, p in lay], 'check': st},
                      open(os.path.join(out, 'layers.json'), 'w'), indent=1)
            print(k, 'layers', [g for g, _ in lay], st, flush=True)
        write_manifest()
    elif a.cmd == 'manifest':
        write_manifest()
    elif a.cmd == 'stills':
        import concurrent.futures as cf
        times = p2_times()
        ks = keys if a.keys != ','.join(AUDIT_KEYS) else list(P2)
        jobs = []
        for k in ks:
            pre = P2[k][0]
            cws = importlib.import_module(f'scenes.{k}_lake').COLOURWAYS
            for sc, scn in SCENES:
                for cw in cws:
                    jobs.append((k, sc, cw, os.path.join(ROOT, 'stills', f'{pre}_{scn}_{cw}.png')))
        with cf.ProcessPoolExecutor(a.jobs) as ex:
            futs = {ex.submit(_paint_still, *j): j for j in jobs}
            for f in cf.as_completed(futs):
                k, sc, cw, out = futs[f]
                times.setdefault('stills', {})[os.path.basename(out)] = round(f.result(), 1)
                p2_save_times(times); print(os.path.basename(out), f'{f.result():.0f}s', flush=True)
    elif a.cmd == 'stillsheet':
        tw, th, lab = 640, 360, 34
        files = []
        for k, pre, cw in PHASE2:
            cws = importlib.import_module(f'scenes.{k}_lake').COLOURWAYS
            for sc, scn in SCENES:
                for c in cws:
                    files.append(f'{pre}_{scn}_{c}.png')
        sheet = Image.new('RGB', (tw * 6, (th + lab) * 5), (24, 24, 26))
        dr = ImageDraw.Draw(sheet)
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 19)
        for i, f in enumerate(files):
            x, y = (i % 6) * tw, (i // 6) * (th + lab)
            im = Image.open(os.path.join(ROOT, 'stills', f)).convert('RGB').resize((tw, th), Image.LANCZOS)
            sheet.paste(im, (x, y))
            dr.text((x + 10, y + th + 7), f[:-4].replace('_', ' · '), fill=(235, 235, 235), font=font)
        save_png(sheet, os.path.join(ROOT, 'StillsSheet.png'))
        print('StillsSheet.png', sheet.size)
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
