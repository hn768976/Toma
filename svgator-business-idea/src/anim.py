"""Motion direction. Playful personality; primary / secondary / ambient layers."""
DUR = 4400

def cb(x1, y1, x2, y2):
    return {"type": "cubic-bezier", "value": {"from": {"x": x1, "y": y1}, "to": {"x": x2, "y": y2}}}
LIN      = {"type": "linear", "value": None}
EASE_OUT = cb(0, 0, 0.2, 1)
EASE_IN  = cb(0.4, 0, 1, 1)
SINE     = cb(0.37, 0, 0.63, 1)
BACK     = cb(0.34, 1.4, 0.2, 1)
SNAP     = cb(0.23, 1, 0.32, 1)
GLIDE    = cb(0.32, 0.72, 0, 1)

def K(t, v, e=EASE_OUT):
    return {"time": t, "value": v, "easing": e}

def ch(keys):
    return {"disabled": False, "keys": keys}

def S(v):      return {"x": v, "y": v}
def O(x, y):   return {"x": x, "y": y, "type": "corner"}

def merge(*animators):
    out = {}
    for a in animators:
        for grp, chans in a.items():
            out.setdefault(grp, {}).update(chans)
    return out

# ---------------------------------------------------------------- ambient
import math

def gear_spin():
    return {"transform": {"rotate": ch([K(0, 0, LIN), K(DUR, 360, LIN)])}}

def coin_float(cx, cy, rise, phase, tilt, cycles=2, steps=8):
    """Sampled sine — an integer cycle count keeps the loop seam invisible."""
    okeys, rkeys = [], []
    for i in range(steps + 1):
        t = round(i * DUR / steps)
        a = 2 * math.pi * cycles * i / steps + phase
        y = cy - rise * 0.5 * (1 + math.sin(a))
        okeys.append(K(t, O(cx, round(y, 2)), SINE))
        rkeys.append(K(t, round(tilt * math.cos(a), 2), SINE))
    return {"transform": {"origin": ch(okeys), "rotate": ch(rkeys)}}

def breathe():
    t = [0, 1100, 2200, 3300, DUR]
    v = [1, 1.008, 1, 1.008, 1]
    return {"transform": {"scale": ch([K(a, S(b), SINE) for a, b in zip(t, v)])}}

# ---------------------------------------------------------------- beats
def bulb_pop():
    sc = ch([K(0, S(0.88), LIN), K(500, S(0.88), EASE_OUT), K(860, S(1.075), BACK),
             K(1050, S(1.0), SINE), K(2600, S(1.0), SINE), K(3100, S(1.02), SINE),
             K(3900, S(1.0), EASE_IN), K(4160, S(0.88), LIN), K(DUR, S(0.88), LIN)])
    op = ch([K(0, 0, LIN), K(500, 0, EASE_OUT), K(640, 1, LIN), K(3900, 1, EASE_IN),
             K(4160, 0, LIN), K(DUR, 0, LIN)])
    return {"transform": {"scale": sc}, "compositing": {"opacity": op}}

def rays_burst():
    sc = ch([K(0, S(0.72), LIN), K(780, S(0.72), EASE_OUT), K(1000, S(1.06), EASE_OUT),
             K(1420, S(1.22), LIN), K(DUR, S(0.72), LIN)])
    op = ch([K(0, 0, LIN), K(780, 0, EASE_OUT), K(1000, 1, EASE_IN), K(1420, 0, LIN),
             K(DUR, 0, LIN)])
    return {"transform": {"scale": sc}, "compositing": {"opacity": op}}

def target_grow():
    sc = ch([K(0, S(0.14), LIN), K(1150, S(0.14), EASE_OUT), K(1240, S(0.30), GLIDE),
             K(1540, S(1.06), SINE), K(1660, S(1.0), LIN),
             # impact squash when the arrow lands, then settle
             K(1980, S(1.0), EASE_OUT), K(2040, S(1.055), SINE), K(2160, S(0.982), SINE),
             K(2300, S(1.0), LIN), K(3700, S(1.0), EASE_IN),
             K(3960, S(0.14), LIN), K(DUR, S(0.14), LIN)])
    rot = ch([K(0, -14, LIN), K(1150, -14, GLIDE), K(1660, 0, LIN), K(3700, 0, EASE_IN),
              K(3960, 12, LIN), K(DUR, 12, LIN)])
    op = ch([K(0, 0, LIN), K(1150, 0, EASE_OUT), K(1260, 1, EASE_IN), K(3860, 1, EASE_IN),
             K(3960, 0, LIN), K(DUR, 0, LIN)])
    return {"transform": {"scale": sc, "rotate": rot}, "compositing": {"opacity": op}}

def arrow_strike():
    far = O(1253, 32)
    org = ch([K(0, far, LIN), K(1660, far, SNAP), K(1980, O(886, 414), EASE_OUT),
              K(2090, O(893, 407), LIN), K(3560, O(893, 407), EASE_OUT),
              K(3640, O(906, 393), EASE_IN), K(3900, far, LIN), K(DUR, far, LIN)])
    rot = ch([K(0, 0, LIN), K(1980, 0, EASE_OUT), K(2050, 3.4, SINE), K(2150, -1.9, SINE),
              K(2260, 0.7, SINE), K(2380, 0, LIN), K(DUR, 0, LIN)])
    op = ch([K(0, 0, LIN), K(1660, 0, EASE_OUT), K(1730, 1, EASE_IN), K(3700, 1, EASE_IN),
             K(3880, 0, LIN), K(DUR, 0, LIN)])
    return {"transform": {"origin": org, "rotate": rot}, "compositing": {"opacity": op}}

def head_react():
    rot = ch([K(0, 0, LIN), K(2040, 0, EASE_OUT), K(2160, -2.4, SINE), K(2440, 0.7, SINE),
              K(2700, 0, LIN), K(DUR, 0, LIN)])
    return {"transform": {"rotate": rot}}

def sparkle(delay, spin):
    sc = ch([K(0, S(0.35), LIN), K(delay, S(0.35), BACK), K(delay + 220, S(1.15), SINE),
             K(delay + 380, S(1.0), SINE), K(3850, S(1.0), EASE_IN),
             K(4090, S(0.35), LIN), K(DUR, S(0.35), LIN)])
    op = ch([K(0, 0, LIN), K(delay, 0, EASE_OUT), K(delay + 180, 1, EASE_IN),
             K(3850, 1, EASE_IN), K(4090, 0, LIN), K(DUR, 0, LIN)])
    return {"transform": {"scale": sc}, "compositing": {"opacity": op}}
