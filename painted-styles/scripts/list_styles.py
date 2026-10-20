"""Build docs/styles.md from the vendored skill: names from SKILL.md / README.md,
constructor parameters parsed from each lib with ast (nothing is imported or run)."""
import ast, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SK = os.path.join(ROOT, 'vendor', 'claude-drawing-skill')
skill = open(os.path.join(SK, 'SKILL.md'), encoding='utf-8', errors='replace').read()
readme = open(os.path.join(SK, 'README.md'), encoding='utf-8', errors='replace').read()

# English display names from the README gallery: "![key](examples/drawing_<example>.gif)" under "**English · 中文**"
eng = {}
rows = [l for l in readme.splitlines() if l.startswith('|') and not set(l) <= set('|-: ')]
for head, imgs in zip(rows, rows[1:]):
    names = [c.strip().strip('*') for c in head.strip('|').split('|')]
    ex = re.findall(r'\]\(examples/drawing_([a-z0-9_]+)\.gif\)', imgs)
    if len(ex) == len(names):
        for n, e in zip(names, ex):
            eng.setdefault(e, n)

out = ['# Styles in claude-drawing-skill', '',
       f'Pinned commit: `{subprocess.check_output(["git", "-C", SK, "rev-parse", "HEAD"]).decode().strip()}`', '',
       'The repo was advertised with 63 styles; at this commit SKILL.md says **74** (seventy-four).',
       'Every style is a Python class you drive with your own scene script (pixel coordinates); there is no',
       '"apply style X to scene Y" switch. Common parameters: `W, H` (canvas size), `seed` (all randomness',
       'comes from `np.random.default_rng(seed)`), plus per-style knobs below (supersampling `ss`, tile/cell size,',
       'misregistration, screen pitch, pen width, light direction, paper tone). Palettes are passed per call',
       '(colour arguments to glaze/fill/stroke methods), not as a global palette option.', '',
       '| # | Style (repo display name) | 中文 | lib | Class | Constructor parameters | Benchmark example | Repo time |',
       '|---|---|---|---|---|---|---|---|']
n = 0
for line in skill.splitlines():
    m = re.match(r'\| ([^|]+) \| `lib/(\w+)\.py` · `(\w+)` \| `examples/(\w+)\.py`[^|]*\|([^|]*)\|', line)
    if not m: continue
    zh, lib, cls, ex, t = m.groups()
    tree = ast.parse(open(os.path.join(SK, 'lib', lib + '.py'), encoding='utf-8').read())
    sig = '?'
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == cls:
            for f in node.body:
                if isinstance(f, ast.FunctionDef) and f.name == '__init__':
                    a = f.args; defs = [None] * (len(a.args) - len(a.defaults)) + a.defaults
                    parts = [arg.arg + ('' if d is None else '=' + ast.unparse(d)) for arg, d in zip(a.args, defs) if arg.arg != 'self']
                    parts += [k.arg + '=' + ast.unparse(d) for k, d in zip(a.kwonlyargs, a.kw_defaults)]
                    sig = ', '.join(parts) or '(none)'
    eng.setdefault('bawansiqian', 'Ink wash'); eng.setdefault('watercolor_autumn', 'Watercolour')
    e_name = re.sub(r'（.*?）', '', eng.get(ex, '')).split(' · ')[0] or zh.split(' · ')[-1]
    n += 1
    out.append(f'| {n} | {e_name} | {zh.split(" · ")[0].strip()} | `{lib}` | `{cls}` | `{sig}` | `{ex}.py` | {t.strip()} |')
out += ['', f'Total parsed: **{n}** style rows (ink wash and watercolour each have a second example).']
open(os.path.join(ROOT, 'docs', 'styles.md'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print(n)
