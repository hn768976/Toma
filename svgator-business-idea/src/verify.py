import sys, json, copy, math
sys.path.insert(0,'.')
import lib, cairosvg
from PIL import Image

doc = json.load(open('document.json'))
DUR = doc['animation']['duration']

def bez_y(e, u):
    if e is None or e['type'] == 'linear': return u
    if e['type'] == 'steps':
        n = e['value']['steps']; return min(int(u*n)+e['value'].get('jump',0), n)/n
    f, t = e['value']['from'], e['value']['to']
    x1,y1,x2,y2 = f['x'], f['y'], t['x'], t['y']
    lo, hi = 0.0, 1.0
    for _ in range(40):
        m = (lo+hi)/2
        x = 3*(1-m)**2*m*x1 + 3*(1-m)*m*m*x2 + m**3
        if x < u: lo = m
        else: hi = m
    m = (lo+hi)/2
    return 3*(1-m)**2*m*y1 + 3*(1-m)*m*m*y2 + m**3

def lerp(a, b, p):
    if isinstance(a, (int, float)): return a + (b-a)*p
    out = dict(a)
    for k in ('x','y'):
        if k in a: out[k] = a[k] + (b[k]-a[k])*p
    return out

def sample(keys, t):
    if t <= keys[0]['time']: return keys[0]['value']
    if t >= keys[-1]['time']: return keys[-1]['value']
    for i in range(len(keys)-1):
        a, b = keys[i], keys[i+1]
        if a['time'] <= t <= b['time']:
            span = b['time']-a['time']
            u = 0 if span == 0 else (t-a['time'])/span
            return lerp(a['value'], b['value'], bez_y(a.get('easing'), u))
    return keys[-1]['value']

def apply(el, t):
    an = el.get('animators')
    if an:
        p = el.setdefault('properties', {})
        for grp, chans in an.items():
            for chan, spec in chans.items():
                v = sample(spec['keys'], t)
                if grp == 'transform':
                    p.setdefault('transform', {})[chan] = v
                elif grp == 'compositing':
                    p.setdefault('compositing', {})[chan] = v
                elif grp == 'fill':
                    p.setdefault('fill', {})[chan] = v
    for c in el.get('children', []): apply(c, t)

frames, N = [], 44
for i in range(N):
    t = i * DUR / N
    d = copy.deepcopy(doc)
    for c in d['children']: apply(c, t)
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1500">'
           '<rect width="1500" height="1500" fill="#fff"/>'
           + "".join(lib.to_svg(c) for c in d['children']) + '</svg>')
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=420, output_height=420)
    open('f.png','wb').write(png)
    frames.append(Image.open('f.png').convert('RGB').copy())

frames[0].save('anim.gif', save_all=True, append_images=frames[1:],
               duration=int(DUR/N), loop=0, optimize=True)
# contact sheet of 12 evenly spaced frames
sel = [frames[int(k*N/12)] for k in range(12)]
sheet = Image.new('RGB', (4*300, 3*300), 'white')
for i, fr in enumerate(sel):
    sheet.paste(fr.resize((300,300)), ((i%4)*300, (i//4)*300))
sheet.save('sheet.png')
print('frames', len(frames))
