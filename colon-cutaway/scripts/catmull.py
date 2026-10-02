"""Centripetal Catmull-Rom matching three.js CatmullRomCurve3 (open, 'centripetal')."""
import numpy as np


def _coef(x0, x1, t0, t1):
    return x0, t0, -3 * x0 + 3 * x1 - 2 * t0 - t1, 2 * x0 - 2 * x1 + t0 + t1


def _nonuniform(x0, x1, x2, x3, dt0, dt1, dt2):
    t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1
    t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2
    return _coef(x1, x2, t1 * dt1, t2 * dt1)


def cr_point(points, t):
    """three.js CatmullRomCurve3.getPoint(t) for an open centripetal curve."""
    pts = np.asarray(points, float)
    n = len(pts)
    p = (n - 1) * t
    ip = int(np.floor(p))
    w = p - ip
    if w == 0 and ip == n - 1:
        ip = n - 2
        w = 1.0
    p0 = pts[ip - 1] if ip > 0 else 2 * pts[0] - pts[1]
    p1 = pts[ip % n]
    p2 = pts[(ip + 1) % n]
    p3 = pts[ip + 2] if ip + 2 < n else 2 * pts[n - 1] - pts[n - 2]
    dt0 = np.sum((p0 - p1) ** 2) ** 0.25
    dt1 = np.sum((p1 - p2) ** 2) ** 0.25
    dt2 = np.sum((p2 - p3) ** 2) ** 0.25
    if dt1 < 1e-4:
        dt1 = 1.0
    if dt0 < 1e-4:
        dt0 = dt1
    if dt2 < 1e-4:
        dt2 = dt1
    out = np.zeros(3)
    for k in range(3):
        c0, c1, c2, c3 = _nonuniform(p0[k], p1[k], p2[k], p3[k], dt0, dt1, dt2)
        out[k] = c0 + c1 * w + c2 * w * w + c3 * w * w * w
    return out


def sample_by_arclength(points, n_out, dense=20000):
    ts = np.linspace(0, 1, dense)
    P = np.array([cr_point(points, t) for t in ts])
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    L = cum[-1]
    s = np.linspace(0, L, n_out)
    out = np.stack([np.interp(s, cum, P[:, k]) for k in range(3)], axis=1)
    return out, s, L, (P, cum)
