"""64x64 blue-noise threshold map (void-and-cluster, Ulichney 1993), fixed and deterministic."""
import os, sys
import numpy as np
from PIL import Image

N, SIGMA = 64, 1.5


def energy_kernel():
    d = np.minimum(np.arange(N), N - np.arange(N))
    return np.fft.rfft2(np.exp(-(d[:, None] ** 2 + d[None, :] ** 2) / (2 * SIGMA ** 2)))


def blur(m, K):
    return np.fft.irfft2(np.fft.rfft2(m) * K, s=(N, N))


def void_and_cluster():
    K = energy_kernel()
    rng = np.random.default_rng(7)
    pat = np.zeros((N, N), bool)
    pat.flat[rng.choice(N * N, N * N // 10, replace=False)] = True
    while True:                                   # relax the initial pattern
        e = blur(pat.astype(float), K)
        c = np.unravel_index(np.where(pat, e, -np.inf).argmax(), pat.shape); pat[c] = False
        e = blur(pat.astype(float), K)
        v = np.unravel_index(np.where(~pat, e, np.inf).argmin(), pat.shape)
        if v == c:
            pat[c] = True; break
        pat[v] = True
    rank = np.zeros((N, N), int); ones = int(pat.sum())
    p = pat.copy()
    for r in range(ones - 1, -1, -1):             # phase 1: remove tightest clusters
        e = blur(p.astype(float), K)
        c = np.unravel_index(np.where(p, e, -np.inf).argmax(), p.shape); p[c] = False; rank[c] = r
    p = pat.copy()
    for r in range(ones, N * N):                  # phase 2/3: fill largest voids
        e = blur(p.astype(float), K)
        v = np.unravel_index(np.where(~p, e, np.inf).argmin(), p.shape); p[v] = True; rank[v] = r
    return rank


if __name__ == '__main__':
    out = sys.argv[1]
    r = void_and_cluster()
    img = ((r + 0.5) / (N * N) * 256).astype(np.uint8)
    Image.fromarray(img, 'L').convert('RGB').save(out, optimize=False, compress_level=6)
    print('saved', out)
