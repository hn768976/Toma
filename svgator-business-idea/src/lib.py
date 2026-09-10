"""Shared helpers: build SVGator element dicts and render an equivalent flat SVG."""
import json, math

NAVY   = (2, 0, 71)
NAVY2  = (26, 20, 122)
INDIGO = (96, 92, 253)
YELLOW = (254, 202, 60)
YLT    = (254, 222, 128)
WHITE  = (255, 255, 255)
GEARBL = (229, 240, 251)

def paint(c, a=1.0):
    return {"type": "color", "value": {"r": c[0], "g": c[1], "b": c[2], "a": a}}
NONE = {"type": "none"}

_ids = {}
def uid(prefix):
    _ids[prefix] = _ids.get(prefix, 0) + 1
    return "%s-%d" % (prefix, _ids[prefix])

# ---------------------------------------------------------------- path nodes
def N(x, y, s=None, e=None, t="cusp"):
    """Path node. s/e are absolute (x,y) bezier control points."""
    n = {"x": round(x, 2), "y": round(y, 2), "type": t}
    if s: n["start"] = {"x": round(s[0], 2), "y": round(s[1], 2)}
    if e: n["end"] = {"x": round(e[0], 2), "y": round(e[1], 2)}
    return n

def L(x, y):
    return N(x, y, t="corner")

def circle_nodes(cx, cy, r):
    k = 0.5522847 * r
    return [
        N(cx, cy - r, (cx - k, cy - r), (cx + k, cy - r)),
        N(cx + r, cy, (cx + r, cy - k), (cx + r, cy + k)),
        N(cx, cy + r, (cx + k, cy + r), (cx - k, cy + r)),
        N(cx - r, cy, (cx - r, cy + k), (cx - r, cy - k)),
        N(cx, cy - r, (cx - k, cy - r), (cx + k, cy - r)),
    ]

def nodes_to_d(nodes):
    if not nodes: return ""
    d = "M %g %g" % (nodes[0]["x"], nodes[0]["y"])
    for i in range(1, len(nodes)):
        p, c = nodes[i - 1], nodes[i]
        c1 = p.get("end", {"x": p["x"], "y": p["y"]})
        c2 = c.get("start", {"x": c["x"], "y": c["y"]})
        d += " C %g %g %g %g %g %g" % (c1["x"], c1["y"], c2["x"], c2["y"], c["x"], c["y"])
    a, b = nodes[0], nodes[-1]
    if abs(a["x"] - b["x"]) < .01 and abs(a["y"] - b["y"]) < .01:
        d += " Z"
    return d

# ---------------------------------------------------------------- elements
def _props(fill, fop, stroke, sw, cap, join, translate, origin, rotate, scale, opacity, shape):
    p = {}
    if shape is not None:
        p["shape"] = shape
    t = translate or (0, 0)
    o = origin or (0, 0)
    # SVGator applies translate(origin) . rotate . scale . translate(translate),
    # so a classic "pivot at o, placed at t" becomes origin=t+o, translate=-o.
    tr = {"origin": {"x": round(t[0] + o[0], 2), "y": round(t[1] + o[1], 2), "type": "corner"},
          "translate": {"x": round(-o[0], 2), "y": round(-o[1], 2)},
          "scale": {"x": 1, "y": 1}, "skew": {"x": 0, "y": 0}, "rotate": 0, "autoRotate": False}
    if rotate:    tr["rotate"] = rotate
    if scale:     tr["scale"] = {"x": scale[0], "y": scale[1]}
    p["transform"] = tr
    if fill is not None or fop != 1:
        p["fill"] = {"paint": paint(fill) if fill else NONE, "opacity": fop, "rule": False}
    p["stroke"] = {"paint": paint(stroke) if stroke else NONE, "opacity": 1, "width": sw,
                   "lineCap": cap, "lineJoin": join, "miterLimit": 4, "dashOffset": 0, "dashArray": []}
    p["compositing"] = {"blend": "normal", "isolate": False, "opacity": opacity,
                        "paintOrder": "fill stroke markers", "clip": {"path": None, "rule": False},
                        "mask": {"source": None}}
    return p

def Path(title, nodes, fill=None, fop=1, stroke=None, sw=0, cap="round", join="round",
         origin=None, rotate=0, scale=None, opacity=1, anim=None, translate=None):
    e = {"id": uid("path"), "type": "path", "title": title, "locked": False, "hidden": False,
         "properties": _props(fill, fop, stroke, sw, cap, join, translate, origin, rotate, scale,
                              opacity, {"path": nodes})}
    if anim: e["animators"] = anim
    return e

def Circle(title, cx, cy, r, fill=None, fop=1, stroke=None, sw=0, opacity=1, anim=None, scale=None):
    e = {"id": uid("circle"), "type": "circle", "title": title, "locked": False, "hidden": False,
         "properties": _props(fill, fop, stroke, sw, "round", "round", (cx, cy), (0, 0), 0,
                              scale, opacity, {"radius": r})}
    if anim: e["animators"] = anim
    return e

def Ellipse(title, cx, cy, rx, ry, fill=None, fop=1, stroke=None, sw=0, rotate=0, opacity=1,
            anim=None, scale=None):
    e = {"id": uid("ellipse"), "type": "ellipse", "title": title, "locked": False, "hidden": False,
         "properties": _props(fill, fop, stroke, sw, "round", "round", (cx, cy), (0, 0), rotate,
                              scale, opacity, {"radius": {"x": rx, "y": ry}})}
    if anim: e["animators"] = anim
    return e

def Rect(title, x, y, w, h, rx=0, fill=None, fop=1, stroke=None, sw=0, rotate=0, origin=None,
         opacity=1, anim=None, scale=None):
    if origin is None: origin = (w / 2.0, h / 2.0)
    e = {"id": uid("rect"), "type": "rect", "title": title, "locked": False, "hidden": False,
         "properties": _props(fill, fop, stroke, sw, "round", "round", (x, y), origin, rotate,
                              scale, opacity, {"size": {"width": w, "height": h},
                                               "radius": {"x": rx, "y": rx}})}
    if anim: e["animators"] = anim
    return e

def G(title, children, origin=None, rotate=0, scale=None, opacity=1, anim=None, translate=None):
    e = {"id": uid("g"), "type": "g", "title": title, "locked": False, "hidden": False,
         "properties": _props(None, 1, None, 0, "round", "round", translate, origin, rotate,
                              scale, opacity, None),
         "children": children}
    e["properties"].pop("fill", None)
    e["properties"].pop("stroke", None)
    if anim: e["animators"] = anim
    return e

# ---------------------------------------------------------------- flat SVG preview
def _col(c): return "rgb(%d,%d,%d)" % c

def to_svg(el):
    p = el["properties"]
    tr = p.get("transform", {})
    t = tr.get("translate", {"x": 0, "y": 0}); o = tr.get("origin", {"x": 0, "y": 0})
    sc = tr.get("scale", {"x": 1, "y": 1}); rot = tr.get("rotate", 0)
    xf = []
    if o["x"] or o["y"]: xf.append("translate(%g %g)" % (o["x"], o["y"]))
    if rot: xf.append("rotate(%g)" % rot)
    if sc["x"] != 1 or sc["y"] != 1: xf.append("scale(%g %g)" % (sc["x"], sc["y"]))
    if t["x"] or t["y"]: xf.append("translate(%g %g)" % (t["x"], t["y"]))
    a = ' transform="%s"' % " ".join(xf) if xf else ""
    f = p.get("fill"); s = p.get("stroke"); comp = p.get("compositing", {})
    st = []
    if f is not None:
        st.append("fill:%s" % (_col((f["paint"]["value"]["r"], f["paint"]["value"]["g"], f["paint"]["value"]["b"])) if f["paint"]["type"] == "color" else "none"))
        if f.get("opacity", 1) != 1: st.append("fill-opacity:%g" % f["opacity"])
    else:
        st.append("fill:none")
    if s and s["paint"]["type"] == "color":
        st.append("stroke:%s" % _col((s["paint"]["value"]["r"], s["paint"]["value"]["g"], s["paint"]["value"]["b"])))
        st.append("stroke-width:%g" % s["width"])
        st.append("stroke-linecap:%s" % s["lineCap"]); st.append("stroke-linejoin:%s" % s["lineJoin"])
    if comp.get("opacity", 1) != 1: st.append("opacity:%g" % comp["opacity"])
    a += ' style="%s"' % ";".join(st)
    ty = el["type"]; sh = p.get("shape", {})
    if ty == "path":  return '<path d="%s"%s/>' % (nodes_to_d(sh["path"]), a)
    if ty == "circle":return '<circle r="%g"%s/>' % (sh["radius"], a)
    if ty == "ellipse":return '<ellipse rx="%g" ry="%g"%s/>' % (sh["radius"]["x"], sh["radius"]["y"], a)
    if ty == "rect":  return '<rect width="%g" height="%g" rx="%g" ry="%g"%s/>' % (
        sh["size"]["width"], sh["size"]["height"], sh["radius"]["x"], sh["radius"]["y"], a)
    if ty == "g":     return '<g%s>%s</g>' % (a, "".join(to_svg(c) for c in el["children"]))
    return ""

def write_preview(children, path, w=1500, h=1500):
    body = "".join(to_svg(c) for c in children)
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">'
           '<rect width="%d" height="%d" fill="#fff"/>%s</svg>' % (w, h, w, h, w, h, body))
    open(path, "w").write(svg)
    return svg

def smooth(points, closed=True, k=1.0/6):
    """Catmull-Rom-ish smooth path through points -> SVGator node list."""
    n = len(points)
    out = []
    for i, (x, y) in enumerate(points):
        if closed:
            p0 = points[(i - 1) % n]; p2 = points[(i + 1) % n]
        else:
            p0 = points[max(i - 1, 0)]; p2 = points[min(i + 1, n - 1)]
        tx, ty = (p2[0] - p0[0]) * k, (p2[1] - p0[1]) * k
        out.append(N(x, y, (x - tx, y - ty), (x + tx, y + ty)))
    if closed:
        f = out[0]
        out.append(N(f["x"], f["y"], (f["start"]["x"], f["start"]["y"]),
                     (f["end"]["x"], f["end"]["y"])))
    return out
