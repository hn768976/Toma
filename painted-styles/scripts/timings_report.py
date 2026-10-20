"""docs/timings.md from docs/phase2_times.json (paint, measured one job at a time) and renders/render_times.txt."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
t = json.load(open(os.path.join(ROOT, 'docs', 'phase2_times.json')))
out = ['# Timings', '', 'Machine: 4-core cloud container, numpy single-threaded, one paint job at a time (the determinism re-run).', '',
       '## Layer paints (3840x2160 + 10% bleed = 4608x2592)', '',
       'Each layer is cut from a cumulative paint (sky, sky+clouds, ...), so the time for layer *n* paints groups 0..n.',
       'The last prefix (reeds) also writes the 40-60 draw-on snapshots for the three draw-on styles.', '',
       '| Style | ' + ' | '.join(['sky', 'clouds', 'far', 'near', 'water', 'mist', 'boat', 'birds', 'reeds']) + ' | total |', '|' + '---|' * 11]
for k, v in t.get('layers', {}).items():
    g = ['sky', 'clouds', 'far', 'near', 'water', 'mist', 'boat', 'birds', 'reeds']
    out.append(f'| {k} | ' + ' | '.join(f'{v.get(x, 0):.0f}s' for x in g) + f' | {sum(v.values()) / 60:.1f} min |')
out += ['', '## Stills (3840x2160)', '', '| Still | Paint time |', '|---|---|']
for f, s in sorted(t.get('stills', {}).items()):
    out.append(f'| {f} | {s:.0f}s |')
tot = sum(t.get('stills', {}).values())
out += [f'| **all 30** | **{tot / 60:.1f} min** |', '']
rt = os.path.join(ROOT, 'renders', 'render_times.txt')
if os.path.exists(rt):
    out += ['## Remotion 720p previews (--scale=1/3, --concurrency=4, --gl=angle, CRF 16)', '', '| Composition | Frames | Wall time | Per frame |', '|---|---|---|---|']
    for line in open(rt):
        c, fr, s = line.split()
        a, b = map(int, fr.split('-')); n = b - a + 1; sec = int(s[:-1])
        out.append(f'| {c} | {n} | {sec}s | {sec / n:.2f}s |')
extra = os.path.join(ROOT, 'docs', 'timings_4k.md')
if os.path.exists(extra):
    out += ['', open(extra).read()]
open(os.path.join(ROOT, 'docs', 'timings.md'), 'w').write('\n'.join(out) + '\n')
print('\n'.join(out))
