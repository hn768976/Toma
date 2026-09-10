import sys, json, math
sys.path.insert(0, '.')
from lib import *
from art import *
from anim import *

def attach(el, animators):
    el["animators"] = merge(el.get("animators", {}), animators)
    return el

# --- backdrop -------------------------------------------------------------
g_gear = attach(gear(), gear_spin())

# --- coins (ambient float, staggered phase) -------------------------------
c1 = attach(coin("Coin small", 250, 505, 49), coin_float(250, 505, 20, 0.0, 4, cycles=1, steps=4))
c2 = attach(coin("Coin big",   339, 718, 65), coin_float(339, 718, 26, 2.1, -3.5, cycles=1, steps=4))
c3 = attach(coin("Coin mid",   803, 560, 52), coin_float(803, 560, 22, 4.2, 4.5, cycles=1, steps=4))

# --- props ----------------------------------------------------------------
g_rays   = attach(rays(),   rays_burst())
g_bulb   = attach(bulb(),   bulb_pop())
g_target = attach(target(), target_grow())
g_arrow  = attach(arrow(),  arrow_strike())
sp = sparkles()
for el, (d, spin) in zip(sp, [(980, 26), (1120, -22), (1260, 18)]):
    attach(el, sparkle(d, spin))

# --- character (breathing torso, head reacts to the strike) ---------------
g_char = attach(character(), breathe())
for kid in g_char["children"]:
    if kid.get("title") == "Head":
        attach(kid, head_react())

children = [desk(), g_gear, monitor(),
            g_rays, g_bulb, g_target, g_arrow, c1, c2, c3] + sp + [keyboard(), g_char]

document = {
    "id": "svg-root", "type": "svg", "title": "Business idea", "locked": False, "hidden": False,
    "animation": {"duration": DUR, "direction": 1, "iterations": 0, "fill": 1,
                  "alternate": False, "speed": 1},
    "properties": {"shape": {"position": {"x": 0, "y": 0},
                             "size": {"width": 1500, "height": 1500},
                             "bgColor": {"type": "color", "value": {"r": 255, "g": 255, "b": 255, "a": 1}}}},
    "children": children,
}
write_preview(children, 'scene.svg')
import cairosvg; cairosvg.svg2png(url='scene.svg', write_to='scene_big.png', output_width=1500, output_height=1500)

n = json.dumps(document)
print("elements:", n.count('"id"'), "| bytes:", len(n))

# ---- prune defaults so the payload stays small ---------------------------
DEF_TR = {"origin": {"x": 0, "y": 0, "type": "corner"}, "translate": {"x": 0, "y": 0},
          "scale": {"x": 1, "y": 1}, "skew": {"x": 0, "y": 0}, "rotate": 0, "autoRotate": False}

def prune(el):
    el.pop("locked", None); el.pop("hidden", None)
    p = el.get("properties", {})
    tr = p.get("transform")
    if tr:
        for k, v in list(tr.items()):
            if v == DEF_TR[k]: tr.pop(k)
        if not tr: p.pop("transform")
    st = p.get("stroke")
    if st and st["paint"]["type"] == "none":
        p.pop("stroke")
    elif st:
        for k, d in (("opacity", 1), ("miterLimit", 4), ("dashOffset", 0), ("dashArray", [])):
            if st.get(k) == d: st.pop(k)
    f = p.get("fill")
    if f:
        if f["paint"]["type"] == "none" and f.get("opacity", 1) == 1: p.pop("fill")
        else:
            if f.get("rule") is False: f.pop("rule")
            if f.get("opacity") == 1: f.pop("opacity")
    c = p.get("compositing")
    if c:
        if c.get("opacity", 1) == 1: p.pop("compositing")
        else:
            for k in ("blend", "isolate", "paintOrder", "clip", "mask"): c.pop(k, None)
    for k in el.get("children", []): prune(k)
    return el

for k in children: prune(k)
json.dump(document, open('document.json', 'w'), separators=(',', ':'))
n = json.dumps(document, separators=(',', ':'))
print("pruned bytes:", len(n))
