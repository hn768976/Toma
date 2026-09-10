"""Artwork definition — 'Business idea' scene, redrawn from the reference frames."""
import math, sys
sys.path.insert(0, ".")
from lib import *

RAY = (254, 232, 170)

# ------------------------------------------------------------------ backdrop
def desk():
    return Path("Desk line", [L(205, 1258), L(1345, 1258)], stroke=NAVY, sw=8)

def gear():
    cx, cy = 262, 1026
    kids = [Circle("Gear body", cx, cy, 70, fill=GEARBL)]
    for i in range(4):
        kids.append(Rect("Gear tooth %d" % (i + 1), cx - 19, cy - 89, 38, 178, rx=12,
                         fill=GEARBL, rotate=i * 45, origin=(19, 89)))
    kids.append(Circle("Gear hole", cx, cy, 46, fill=WHITE))
    return G("Gear", kids, origin=(cx, cy))

# ------------------------------------------------------------------- monitor
def monitor():
    stand = Path("Monitor stand", [
        L(536, 1040), L(606, 1040), L(646, 1250), L(494, 1250), L(536, 1040)],
        fill=NAVY, stroke=WHITE, sw=9, join="round")
    foot = Rect("Stand foot", 636, 1234, 62, 24, rx=6, fill=NAVY2)
    edge = Rect("Screen back edge", 402, 907, 395, 296, rx=34, stroke=NAVY, sw=6)
    body = Rect("Screen", 388, 897, 395, 296, rx=34, fill=NAVY)
    dot = Circle("Camera dot", 570, 1000, 17, fill=WHITE)
    return G("Monitor", [edge, stand, foot, body, dot], origin=(585, 1045))

def keyboard():
    kids = [Rect("Keyboard body", 743, 1234, 218, 24, rx=8, fill=NAVY)]
    for i in range(5):
        kids.append(Rect("Key %d" % (i + 1), 748 + i * 42, 1212, 34, 30, rx=9, fill=NAVY))
    return G("Keyboard", kids, origin=(852, 1235))

# ------------------------------------------------------------------ character
def character():
    shirt = Path("Shirt", [
        N(975, 903, (1000, 900), (908, 912)),
        N(845, 944, (872, 921), (816, 970)),
        N(800, 1032, (802, 992), (798, 1092)),
        L(798, 1258),
        L(1246, 1258),
        N(1240, 1120, (1250, 1200), (1234, 1048)),
        N(1210, 998, (1226, 1030), (1198, 976)),
        N(1148, 934, (1180, 954), (1120, 918)),
        N(1068, 902, (1102, 908), (1050, 899)),
        N(1018, 928, (1050, 934), (992, 920)),
        N(975, 903, (1000, 900), (908, 912)),
    ], fill=INDIGO)

    seam_l = Path("Sleeve seam L", [N(850, 962, None, (856, 1040)), N(868, 1200, (862, 1120), None)],
                  stroke=NAVY, sw=7)
    hem_l = Path("Sleeve hem L", [N(793, 1004, None, (826, 1014)), N(864, 1032, (832, 1020), None)],
                 stroke=NAVY, sw=7)
    arm_l = Path("Far arm", [
        N(782, 1040, None, (792, 1092)),
        N(799, 1172, (795, 1140), (824, 1180)),
        N(866, 1190, (842, 1186), None)], stroke=NAVY, sw=7)

    seam_r = Path("Sleeve seam R", [N(1085, 994, None, (1096, 1024)), N(1108, 1058, (1100, 1030), None)],
                  stroke=NAVY, sw=7)

    arm = Path("Right arm", [
        L(1107, 1015),
        L(1207, 1012),
        N(1232, 1120, (1226, 1050), (1236, 1166)),
        N(1224, 1200, (1234, 1184), (1214, 1222)),
        N(1170, 1241, (1200, 1236), (1146, 1246)),
        N(1090, 1244, (1126, 1248), (1058, 1238)),
        N(985, 1214, (1032, 1224), (952, 1208)),
        N(887, 1206, (930, 1210), (872, 1204)),
        N(864, 1188, (868, 1200), (860, 1174)),
        N(898, 1142, (872, 1158), (920, 1128)),
        N(1000, 1110, (948, 1116), (1052, 1105)),
        N(1136, 1126, (1094, 1110), (1140, 1120)),
        L(1107, 1015),
    ], fill=WHITE, stroke=NAVY, sw=7, join="round")

    fingers = []
    fpts = [((922, 1147), (900, 1201)), ((943, 1150), (921, 1205)),
            ((966, 1160), (944, 1207)), ((1006, 1176), (982, 1206))]
    for i, (a, b) in enumerate(fpts):
        fingers.append(Path("Finger %d" % (i + 1), [
            N(a[0], a[1], None, (a[0] - 26, a[1] + 18)),
            N(b[0], b[1], (b[0] - 22, b[1] - 18), None)], stroke=NAVY, sw=7))
    fingers.append(Path("Knuckle", [
        N(886, 1168, None, (872, 1186)), N(890, 1200, (876, 1198), None)], stroke=NAVY, sw=7))

    neck = Path("Neck", [
        N(982, 826, (980, 838), (978, 876)),
        N(1002, 916, (976, 908), (1034, 922)),
        N(1064, 890, (1052, 916), (1068, 870)),
        N(1066, 816, (1066, 846), (1066, 798)),
    ], fill=WHITE, stroke=NAVY, sw=7)

    face = Path("Face", [
        N(986, 672, (938, 680), (1030, 668)),
        N(1058, 744, (1048, 694), (1064, 778)),
        N(1046, 806, (1056, 788), (1036, 823)),
        N(994, 846, (1026, 843), (965, 850)),
        N(934, 816, (952, 840), (921, 798)),
        N(921, 748, (919, 780), (925, 712)),
        N(986, 672, (938, 680), (1030, 668)),
    ], fill=WHITE, stroke=NAVY, sw=7)

    hair = Path("Hair", [
        N(1004, 660, (992, 668), (1030, 646)),
        N(1064, 648, (1044, 644), (1086, 650)),
        N(1101, 668, (1098, 652), (1106, 682)),
        N(1097, 696, (1102, 690), (1092, 702)),
        N(1123, 722, (1114, 704), (1129, 738)),
        N(1110, 748, (1120, 742), (1104, 754)),
        N(1105, 778, (1118, 762), (1096, 792)),
        N(1070, 780, (1088, 790), (1054, 772)),
        N(1053, 744, (1058, 762), (1048, 726)),
        N(1022, 702, (1042, 716), (1006, 690)),
        N(1004, 660, (1004, 682), (992, 668)),
    ], fill=NAVY)
    bun = Ellipse("Hair bun", 1003, 623, 55, 54, fill=NAVY, rotate=-8)

    ear = Path("Ear", [
        N(1057, 758, (1050, 750), (1082, 750)),
        N(1106, 780, (1102, 756), (1108, 798)),
        N(1064, 813, (1092, 810), (1052, 816)),
        N(1057, 758, (1050, 750), (1082, 750)),
    ], fill=WHITE, stroke=NAVY, sw=7)
    ear_in = Path("Ear inner", [
        N(1072, 774, (1066, 768), (1090, 772)),
        N(1082, 794, (1090, 786), (1076, 798)),
    ], stroke=NAVY, sw=6)

    brow_l = Path("Brow L", [
        N(947, 713, None, (951, 702)),
        N(972, 712, (965, 700), None)], stroke=NAVY, sw=6)
    brow_r = Path("Brow R", [
        N(997, 734, None, (1001, 723)),
        N(1019, 734, (1013, 722), None)], stroke=NAVY, sw=7)
    eye_l = Ellipse("Eye L", 952, 728, 7, 10, fill=NAVY, rotate=-12)
    eye_r = Ellipse("Eye R", 1001, 748, 7, 10, fill=NAVY, rotate=-12)
    nose = Path("Nose", [
        N(966, 752, None, (958, 772)),
        N(961, 780, (957, 780), (972, 785)),
        N(975, 782, (971, 785), None)], stroke=NAVY, sw=7)
    smile = Path("Smile", [
        N(971, 796, None, (978, 812)),
        N(1002, 796, (995, 812), None)], stroke=NAVY, sw=7)

    lens_l = Circle("Lens L", 954, 723, 23, stroke=INDIGO, sw=8)
    lens_r = Circle("Lens R", 1002, 743, 21, stroke=INDIGO, sw=8)
    bridge = Path("Bridge", [N(975, 720, None, (980, 717)), N(983, 725, (979, 720), None)],
                  stroke=INDIGO, sw=8)
    temple_r = Path("Temple", [N(1023, 748, None, (1046, 754)), N(1078, 762, (1056, 757), None)],
                    stroke=INDIGO, sw=9)
    temple_l = Path("Temple L", [N(932, 712, None, (927, 713)), N(920, 717, (924, 715), None)],
                    stroke=INDIGO, sw=8)

    head = G("Head", [neck, hair, face, hair, bun, ear, ear_in,
                      brow_l, brow_r, eye_l, eye_r, nose, smile,
                      lens_l, lens_r, bridge, temple_r, temple_l],
             origin=(1018, 906))
    kids = [shirt, hem_l, seam_l, arm_l, seam_r, arm] + fingers + [head]
    return G("Character", kids, origin=(1020, 1258))

# ---------------------------------------------------------------------- coin
def coin(name, cx, cy, R):
    u = R
    def p(nx, ny): return (cx + nx * u, cy + ny * u)
    s_pts = [(0.277, -0.454), (-0.262, -0.500), (-0.338, -0.223),
             (0.062, -0.008), (0.292, 0.146), (0.246, 0.377), (-0.338, 0.377)]
    S = [
        N(*p(*s_pts[0]), e=p(0.10, -0.52)),
        N(*p(*s_pts[1]), s=p(-0.15, -0.52), e=p(-0.36, -0.47)),
        N(*p(*s_pts[2]), s=p(-0.36, -0.32), e=p(-0.33, -0.13)),
        N(*p(*s_pts[3]), s=p(-0.06, -0.06), e=p(0.17, 0.04)),
        N(*p(*s_pts[4]), s=p(0.24, 0.09), e=p(0.34, 0.22)),
        N(*p(*s_pts[5]), s=p(0.31, 0.32), e=p(0.14, 0.40)),
        N(*p(*s_pts[6]), s=p(-0.10, 0.40)),
    ]
    bar = [N(cx + 0.01 * u, cy - 0.67 * u), N(cx + 0.01 * u, cy + 0.73 * u)]
    sw = round(0.164 * R, 1)
    return G(name, [
        Circle(name + " rim", cx - 4, cy + 4, R + 9, fill=NAVY),
        Circle(name + " face", cx, cy, R, fill=YELLOW),
        Path(name + " S", S, stroke=WHITE, sw=sw),
        Path(name + " bar", bar, stroke=WHITE, sw=sw),
    ], origin=(cx, cy))

# ---------------------------------------------------------------------- bulb
def bulb():
    body = Path("Bulb glass", smooth([
        (525, 312), (669, 368), (729, 508), (703, 604), (672, 656),
        (626, 714), (556, 766), (500, 766), (430, 714), (384, 656),
        (351, 604), (321, 508), (381, 368),
    ]), fill=YELLOW)
    hi1 = Ellipse("Glass highlight", 397, 426, 27, 46, fill=YLT, rotate=-16)
    hi2 = Ellipse("Glass highlight small", 383, 516, 16, 25, fill=YLT, rotate=-12)
    fil_l = Path("Filament left", [
        N(538, 764, None, (522, 668)),
        N(508, 600, (514, 642), (482, 596)),
        N(430, 594, (458, 598), (412, 590)),
        N(400, 566, (402, 582), (398, 548)),
        N(412, 537, (400, 528), (428, 534)),
        N(450, 540, (436, 534), (466, 548)),
        N(484, 568, (472, 554), (500, 582)),
        N(512, 600, (500, 588), (532, 600)),
        N(562, 594, (540, 598), None),
    ], stroke=WHITE, sw=17)
    fil_r = Path("Filament right", [
        N(592, 762, None, (578, 666)),
        N(570, 588, (576, 636), (570, 556)),
        N(596, 514, (578, 534), (608, 502)),
        N(632, 504, (616, 498), (648, 508)),
        N(652, 546, (654, 518), (650, 564)),
        N(624, 574, (642, 568), (610, 580)),
        N(586, 584, (604, 582), (574, 588)),
        N(560, 592, (570, 588), None),
    ], stroke=WHITE, sw=17)
    screw = Ellipse("Bulb screw", 585, 830, 54, 46, fill=NAVY)
    bar1 = Rect("Base bar 1", 492, 752, 175, 30, rx=15, fill=WHITE, stroke=NAVY, sw=8,
                rotate=-12.7, origin=(87.5, 15))
    bar2 = Rect("Base bar 2", 492, 789, 175, 30, rx=15, fill=WHITE, stroke=NAVY, sw=8,
                rotate=-12.7, origin=(87.5, 15))
    return G("Bulb", [body, hi1, hi2, fil_l, fil_r, screw, bar1, bar2], origin=(525, 560))

def rays():
    kids = []
    cx, cy = 525, 508
    for i, ang in enumerate([-158, -134, -110, -86, -62, -38]):
        a = math.radians(ang)
        x1, y1 = cx + 222 * math.cos(a), cy + 222 * math.sin(a)
        x2, y2 = cx + 268 * math.cos(a), cy + 268 * math.sin(a)
        kids.append(Path("Ray %d" % (i + 1), [L(x1, y1), L(x2, y2)], stroke=RAY, sw=17))
    return G("Rays", kids, origin=(cx, cy))

# -------------------------------------------------------------------- target
def target():
    cx, cy = 894, 400
    return G("Target", [
        Circle("Ring 1", cx, cy, 137, fill=INDIGO),
        Circle("Ring 2", cx, cy, 101, fill=WHITE),
        Circle("Ring 3", cx, cy, 65, fill=INDIGO),
        Circle("Ring 4", cx, cy, 32, fill=WHITE),
        Circle("Bullseye", cx, cy, 13, fill=INDIGO),
    ], origin=(cx, cy))

def arrow():
    tip = (893, 407); tail = (1046, 248)
    ax, ay = -0.693, 0.721        # along shaft, tail -> tip
    px, py = 0.721, 0.693         # perpendicular
    bcx, bcy = tip[0] - 78 * ax, tip[1] - 78 * ay
    b1 = (bcx + 26 * px, bcy + 26 * py)
    b2 = (bcx - 26 * px, bcy - 26 * py)
    head = Path("Arrow head", [
        L(tip[0], tip[1]),
        N(b1[0], b1[1], (tip[0] - 46 * ax + 20 * px, tip[1] - 46 * ay + 20 * py), (bcx + 8 * px - 8 * ax, bcy + 8 * py - 8 * ay)),
        N(b2[0], b2[1], (bcx - 8 * px - 8 * ax, bcy - 8 * py - 8 * ay), (tip[0] - 46 * ax - 20 * px, tip[1] - 46 * ay - 20 * py)),
        L(tip[0], tip[1]),
    ], fill=NAVY)
    shaft = Path("Arrow shaft", [L(tail[0] + 8, tail[1] - 8), L(920, 380)], stroke=NAVY, sw=11)
    barbs = []
    for i in range(3):
        bx, by = tail[0] + ax * (10 + i * 30), tail[1] + ay * (10 + i * 30)
        barbs.append(Path("Fletch %d" % (i + 1), [
            L(bx - 5, by + 5), L(bx + 26, by - 28)], stroke=NAVY, sw=9))
    return G("Arrow", [shaft] + barbs + [head], origin=(893, 407))

def sparkles():
    pts = [(1128, 588, 13, 18), (1186, 706, 10, -14), (770, 470, 9, 24)]
    kids = []
    for i, (x, y, r, rot) in enumerate(pts):
        kids.append(Rect("Sparkle %d" % (i + 1), x - r, y - r, 2 * r, 2 * r, rx=r * 0.42,
                         fill=YELLOW, rotate=rot, origin=(r, r)))
    return kids
