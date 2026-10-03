"""Interference check for the gear chain: rebuilds every meshing pair's tooth
outline (same formulas as src/looks/WireframeGears.tsx) and tests polygon
overlap at 600 phases of the loop. Prints the worst overlap area."""
import math
from shapely.geometry import Polygon
from shapely import affinity

MODULE, P = 0.15, 36
def outline(T):
    R = MODULE * T / 2; Ra = R + 0.72 * MODULE; Rr = R - 1.05 * MODULE
    pitch = 2 * math.pi / T; base = 0.29 * pitch; tip = 0.17 * pitch
    pts = []
    pol = lambda r, a: (math.cos(a) * r, math.sin(a) * r)
    for k in range(T):
        c = k * pitch
        pts += [pol(Rr, c - 0.5 * pitch), pol(Rr, c - base), pol(R + 0.45 * MODULE, c - tip - 0.03 * pitch),
                pol(Ra, c - tip * 0.7), pol(Ra, c + tip * 0.7), pol(R + 0.45 * MODULE, c + tip + 0.03 * pitch), pol(Rr, c + base)]
    return Polygon(pts)

worst = 0.0
for Tp, Tc in [(12, 12), (12, 18), (18, 12)]:
    for a_deg in range(-75, 76, 15):
        a = math.radians(a_deg)
        Rp, Rc = MODULE * Tp / 2, MODULE * Tc / 2
        d = Rp + Rc
        pp0 = 0.37
        cphase0 = -(Tp / Tc) * (pp0 - a) + a + math.pi + math.pi / Tc
        gp, gc = outline(Tp), outline(Tc)
        for f in range(600):
            t = f / 600
            ap = pp0 + (P / Tp) * 2 * math.pi * t
            ac = cphase0 - (P / Tc) * 2 * math.pi * t
            A = affinity.rotate(gp, ap, origin=(0, 0), use_radians=True)
            Bp = affinity.translate(affinity.rotate(gc, ac, origin=(0, 0), use_radians=True), d * math.cos(a), d * math.sin(a))
            worst = max(worst, A.intersection(Bp).area)
print(f"worst tooth overlap area: {worst:.6f} (gear area ~{outline(12).area:.3f}); {'PASS no interference' if worst < 1e-6 else 'FAIL'}")
