import json

INK   = {"type":"color","value":{"r":26,"g":24,"b":20,"a":1}}
MINT  = {"type":"color","value":{"r":146,"g":231,"b":167,"a":1}}
YEL   = {"type":"color","value":{"r":243,"g":222,"b":104,"a":1}}
CREAM = {"type":"color","value":{"r":253,"g":251,"b":242,"a":1}}
NONE  = {"type":"none"}

def cb(x1,y1,x2,y2): return {"type":"cubic-bezier","value":{"from":{"x":x1,"y":y1},"to":{"x":x2,"y":y2}}}
LIN  = {"type":"linear","value":None}
BACK = cb(0.34,1.56,0.64,1)      # ease-out-back  (playful overshoot)
EIO  = cb(0.42,0,0.58,1)
SINE = cb(0.37,0,0.63,1)
EOUT = cb(0.16,1,0.3,1)
EIN  = cb(0.55,0,0.85,0.3)

def stroke(w, cap="round"):
    return {"paint":INK,"opacity":1,"width":w,"lineCap":cap,"lineJoin":"round",
            "miterLimit":4,"dashOffset":0,"dashArray":[]}
NOSTROKE = {"paint":NONE,"opacity":1,"width":0,"lineCap":"round","lineJoin":"round",
            "miterLimit":4,"dashOffset":0,"dashArray":[]}

# --- sprout is designed at full size then fitted into its vertical slot -------
def sp(x, y):
    """fit the sprout (drawn at full size) into its slot between the two lines"""
    return (300 + 0.92*(x-300), 450 + 0.92*(y-450) - 47)

def n(x, y, t="cusp", start=None, end=None, warp=False):
    f = sp if warp else (lambda a,b: (a,b))
    node = {"x": round(f(x,y)[0],2), "y": round(f(x,y)[1],2), "type": t}
    if start: node["start"] = {"x": round(f(*start)[0],2), "y": round(f(*start)[1],2)}
    if end:   node["end"]   = {"x": round(f(*end)[0],2),   "y": round(f(*end)[1],2)}
    return node

# ---------------------------------------------------------------- geometry --
backing = [
    n(298,68,  "cusp", (82,74),   (518,70)),
    n(542,310, "cusp", (540,94),  (544,524)),
    n(302,547, "cusp", (520,547), (84,545)),
    n(58,304,  "cusp", (56,522),  (60,90)),
    n(298,68,  "cusp", (82,74),   (518,70)),
]
face = [
    n(301,92,  "cusp", (105,95),  (497,93)),
    n(518,308, "cusp", (518,114), (518,502)),
    n(299,523, "cusp", (495,523), (103,521)),
    n(82,307,  "cusp", (82,501),  (82,113)),
    n(301,92,  "cusp", (105,95),  (497,93)),
]
def sparkle(cx, cy, r, k=0.16):
    d = r*k
    return [
        n(cx,     cy - r, "cusp", (cx-d, cy-d*1.6), (cx+d, cy-d*1.4)),
        n(cx + r, cy,     "cusp", (cx+d*1.6, cy-d), (cx+d*1.6, cy+d)),
        n(cx,     cy + r, "cusp", (cx+d, cy+d*1.4), (cx-d, cy+d*1.6)),
        n(cx - r, cy,     "cusp", (cx-d*1.6, cy+d), (cx-d*1.6, cy-d)),
        n(cx,     cy - r, "cusp", (cx-d, cy-d*1.6), (cx+d, cy-d*1.4)),
    ]
W = dict(warp=True)
ground   = [n(238,434,"cusp",None,(278,444),**W), n(362,430,"cusp",(322,442),**W)]
tick_l   = [n(254,449,"cusp",None,(268,453),**W), n(288,445,"cusp",(274,452),**W)]
tick_r   = [n(314,446,"cusp",None,(330,453),**W), n(352,451,"cusp",(336,454),**W)]
stem = [
    n(284,426,"corner", None,      (280,376), **W),
    n(296,262,"cusp",   (290,316), (303,255), **W),
    n(313,269,"cusp",   (306,256), (317,320), **W),
    n(314,426,"corner", (320,378), None,      **W),
    n(284,426,"corner", None,      None,      **W),
]
leaf_l = [
    n(294,352,"cusp",(236.2,359.8),(282.4,294.8),**W),
    n(190,278,"cusp",(247.8,270.2),(201.6,335.2),**W),
    n(294,352,"cusp",(236.2,359.8),(282.4,294.8),**W),
]
vein_l = [n(280,340,"cusp",None,(252,320),**W), n(212,292,"cusp",(238,308),**W)]
leaf_r = [
    n(306,326,"cusp",(367.0,334.6),(317.0,265.4),**W),
    n(414,248,"cusp",(353.0,239.4),(403.0,308.6),**W),
    n(306,326,"cusp",(367.0,334.6),(317.0,265.4),**W),
]
vein_r = [n(320,316,"cusp",None,(350,300),**W), n(392,262,"cusp",(362,278),**W)]

P_STEM   = sp(299,426)
P_LEAF_L = sp(294,352)
P_LEAF_R = sp(306,326)
P_SPROUT = sp(300,450)

# --------------------------------------------------------------- animators --
def keys(ch, pairs):
    return {"disabled": False, "keys": [
        {"time": t, "value": v, "easing": (e if e else LIN)} for t, v, e in pairs]}

sticker_scale = keys("scale", [
    (0,    {"x":1,     "y":1},     EIN),
    (300,  {"x":1.05,  "y":0.94},  EOUT),
    (620,  {"x":0.96,  "y":1.07},  EIN),
    (900,  {"x":1.06,  "y":0.93},  BACK),
    (1150, {"x":0.99,  "y":1.01},  SINE),
    (1400, {"x":1,     "y":1},     SINE),
    (2200, {"x":1.014, "y":0.99},  SINE),
    (3000, {"x":0.994, "y":1.007}, SINE),
    (3600, {"x":1,     "y":1},     None),
])
sticker_rot = keys("rotate", [
    (0,0,EIO), (300,-1.2,EOUT), (620,-2.2,EIN), (900,1.4,BACK),
    (1400,0,SINE), (2400,0.7,SINE), (3600,0,None),
])
stem_rot = keys("rotate", [
    (0,0,EIO), (420,1.8,EOUT), (740,-2.6,EIO), (1020,1.6,EIO), (1320,-0.7,SINE),
    (1700,0,SINE), (2400,1.1,SINE), (3000,-0.9,SINE), (3600,0,None),
])
leafl_rot = keys("rotate", [
    (0,0,EIO), (500,-3.2,EOUT), (830,4,EIO), (1140,-1.8,EIO), (1520,0,SINE),
    (2300,2.4,SINE), (2950,-1.4,SINE), (3600,0,None),
])
leafr_rot = keys("rotate", [
    (0,0,EIO), (560,4.2,EOUT), (890,-3.6,EIO), (1200,1.6,EIO), (1580,0,SINE),
    (2500,-2.2,SINE), (3100,1.2,SINE), (3600,0,None),
])
def twinkle(pairs):
    sc = keys("scale", [(t, {"x": v, "y": v}, e) for t, v, e in pairs[0]])
    return sc, keys("opacity", pairs[1])

# two twinkles on opposite phases so the pair never blinks together
sparkA_s, sparkA_o = twinkle((
    [(0,0.72,SINE),(450,1.16,SINE),(900,0.72,SINE),(1500,0.58,BACK),
     (2100,1.08,SINE),(2700,0.70,SINE),(3200,0.66,SINE),(3600,0.72,None)],
    [(0,0.64,SINE),(450,1.0,SINE),(900,0.66,SINE),(1500,0.50,SINE),
     (2100,0.98,SINE),(2700,0.70,SINE),(3200,0.60,SINE),(3600,0.64,None)]))
sparkB_s, sparkB_o = twinkle((
    [(0,0.62,SINE),(700,0.74,SINE),(1300,1.16,SINE),(1900,0.60,BACK),
     (2400,0.72,SINE),(2900,1.10,SINE),(3300,0.74,SINE),(3600,0.62,None)],
    [(0,0.50,SINE),(700,0.68,SINE),(1300,1.0,SINE),(1900,0.50,SINE),
     (2400,0.68,SINE),(2900,0.98,SINE),(3300,0.70,SINE),(3600,0.50,None)]))


def text_rot(base, a, b, c):
    return keys("rotate", [(0,base,SINE),(800,a,SINE),(1700,b,SINE),
                           (2700,c,SINE),(3600,base,None)])

# ------------------------------------------------------------------- tree ---
def tf(origin=(0,0), translate=(0,0), scale=(1,1), rotate=0):
    return {"origin":{"x":round(origin[0],2),"y":round(origin[1],2),"type":"corner"},
            "translate":{"x":round(translate[0],2),"y":round(translate[1],2)},
            "scale":{"x":scale[0],"y":scale[1]},"skew":{"x":0,"y":0},
            "rotate":rotate,"autoRotate":False}

spec = {
 "type":"g","id":"g-sticker","title":"Sticker","pivot":(300,547),
 "animators":{"transform":{"scale":sticker_scale,"rotate":sticker_rot}},
 "children":[
   {"type":"path","id":"p-backing","title":"Sticker Backing","path":backing,
    "fill":MINT,"stroke":stroke(14)},
   {"type":"path","id":"p-face","title":"Sticker Face","path":face,
    "fill":YEL,"stroke":stroke(12)},
   {"type":"text","id":"t-top","title":"Headline Top","text":"Trust The",
    "size":78,"pivot":(300,163),"baseline":(128,191),"rotate":-3,
    "animators":{"transform":{"rotate":text_rot(-3,-1.7,-3.7,-2.4)}}},
   {"type":"text","id":"t-bottom","title":"Headline Bottom","text":"Process!",
    "size":84,"pivot":(300,454),"baseline":(135,484),"rotate":2,
    "animators":{"transform":{"rotate":text_rot(2,3.4,1.3,2.8)}}},
   {"type":"path","id":"p-spark-l","title":"Sparkle Left","path":sparkle(182,360,34),
    "pivot":(182,360),"fill":CREAM,"stroke":stroke(5),"opacity":0.7,"scale":(0.72,0.72),
    "animators":{"transform":{"scale":sparkA_s},"compositing":{"opacity":sparkA_o}}},
   {"type":"path","id":"p-spark-r","title":"Sparkle Right","path":sparkle(418,364,27),
    "pivot":(418,364),"fill":CREAM,"stroke":stroke(5),"opacity":0.7,"scale":(0.72,0.72),
    "animators":{"transform":{"scale":sparkB_s},"compositing":{"opacity":sparkB_o}}},
   {"type":"g","id":"g-sprout","title":"Sprout","pivot":P_SPROUT,"children":[
      {"type":"path","id":"p-ground","title":"Ground Line","path":ground,
       "fill":NONE,"stroke":stroke(8)},
      {"type":"path","id":"p-tick-l","title":"Ground Tick Left","path":tick_l,
       "fill":NONE,"stroke":stroke(6)},
      {"type":"path","id":"p-tick-r","title":"Ground Tick Right","path":tick_r,
       "fill":NONE,"stroke":stroke(6)},
      {"type":"path","id":"p-stem","title":"Stem","path":stem,"pivot":P_STEM,
       "fill":MINT,"stroke":stroke(11),
       "animators":{"transform":{"rotate":stem_rot}}},
      {"type":"g","id":"g-leaf-l","title":"Leaf Left","pivot":P_LEAF_L,
       "animators":{"transform":{"rotate":leafl_rot}},"children":[
         {"type":"path","id":"p-leaf-l","title":"Leaf Left Blade","path":leaf_l,
          "fill":MINT,"stroke":stroke(11)},
         {"type":"path","id":"p-vein-l","title":"Leaf Left Vein","path":vein_l,
          "fill":NONE,"stroke":stroke(6)}]},
      {"type":"g","id":"g-leaf-r","title":"Leaf Right","pivot":P_LEAF_R,
       "animators":{"transform":{"rotate":leafr_rot}},"children":[
         {"type":"path","id":"p-leaf-r","title":"Leaf Right Blade","path":leaf_r,
          "fill":MINT,"stroke":stroke(11)},
         {"type":"path","id":"p-vein-r","title":"Leaf Right Vein","path":vein_r,
          "fill":NONE,"stroke":stroke(6)}]},
   ]},
 ]}

def build(s, off):
    """off = absolute coords of the parent's local (0,0)"""
    pivot = s.get("pivot")
    origin = (pivot[0]-off[0], pivot[1]-off[1]) if pivot else (0.0, 0.0)
    base = pivot if pivot else off          # this element's own local (0,0)
    el = {"id": s["id"], "type": s["type"], "title": s["title"],
          "locked": False, "hidden": False, "properties": {}}
    props = el["properties"]
    translate = (0,0)
    if s["type"] == "text":
        props["shape"] = {"text": s["text"], "fontFamily": "Baloo 2",
                          "fontSize": s["size"],
                          "fontStyle": {"bold": False, "italic": False, "weight": 800},
                          "textDecoration": {"underline": False,"overline": False,"strike": False},
                          "letterSpacing": 1}
        translate = (s["baseline"][0]-base[0], s["baseline"][1]-base[1])
    elif s["type"] == "path":
        props["shape"] = {"path": [
            {**nd,
             "x": round(nd["x"]-base[0],2), "y": round(nd["y"]-base[1],2),
             **({"start":{"x":round(nd["start"]["x"]-base[0],2),
                          "y":round(nd["start"]["y"]-base[1],2)}} if "start" in nd else {}),
             **({"end":{"x":round(nd["end"]["x"]-base[0],2),
                        "y":round(nd["end"]["y"]-base[1],2)}} if "end" in nd else {})}
            for nd in s["path"]]}
    props["transform"] = tf(origin, translate, s.get("scale",(1,1)), s.get("rotate",0))
    if "fill" in s:
        props["fill"] = {"paint": s["fill"], "opacity": 1, "rule": False}
        props["stroke"] = s["stroke"]
    if s["type"] == "text":
        props["fill"] = {"paint": INK, "opacity": 1, "rule": False}
        props["stroke"] = NOSTROKE
    props["compositing"] = {"blend":"normal","isolate":False,"opacity":s.get("opacity",1),
                            "paintOrder":"fill stroke markers",
                            "clip":{"path":None,"rule":False},"mask":{"source":None}}
    if "animators" in s: el["animators"] = s["animators"]
    if "children" in s:
        el["children"] = [build(c, base) for c in s["children"]]
    return el

doc = {"id":"svg-root","type":"svg","title":"Trust The Process Sticker",
  "locked":False,"hidden":False,
  "animation":{"duration":3600,"direction":1,"iterations":0,"fill":1,
               "alternate":False,"speed":1},
  "properties":{"shape":{"position":{"x":0,"y":0},
                         "size":{"width":600,"height":600},
                         "bgColor":{"type":"none"}}},
  "children":[build(spec,(0,0))]}

open("doc.json","w").write(json.dumps(doc))
print("bytes", len(json.dumps(doc)))
print("sprout base", P_SPROUT, "stem pivot", P_STEM)
