"""64x64 blue-noise dither mask (void-and-cluster), written to
public/brain/bluenoise.bin as 4096 uint8 ranks. Deterministic."""

import os

import numpy as np

N = 64
SIGMA = 1.9


def kernel():
    f = np.fft.fftfreq(N) * N
    d2 = f[:, None] ** 2 + f[None, :] ** 2
    g = np.exp(-d2 / (2 * SIGMA * SIGMA))
    return np.fft.fft2(g)


K = kernel()


def energy(b):
    return np.real(np.fft.ifft2(np.fft.fft2(b.astype(float)) * K))


def main():
    rng = np.random.default_rng(7)
    b = np.zeros((N, N), bool)
    b.flat[rng.choice(N * N, N * N // 10, replace=False)] = True
    # Relax the initial pattern.
    while True:
        e = energy(b)
        tc = np.argmax(np.where(b, e, -np.inf))
        b.flat[tc] = False
        e = energy(b)
        lv = np.argmin(np.where(b, np.inf, e))
        b.flat[lv] = True
        if lv == tc:
            break
    rank = np.zeros(N * N, np.int32)
    ones = int(b.sum())
    proto = b.copy()
    # Phase 1: remove tightest clusters.
    for r in range(ones - 1, -1, -1):
        e = energy(b)
        tc = np.argmax(np.where(b, e, -np.inf))
        b.flat[tc] = False
        rank[tc] = r
    # Phase 2/3: fill largest voids.
    b = proto
    for r in range(ones, N * N):
        e = energy(b)
        lv = np.argmin(np.where(b, np.inf, e))
        b.flat[lv] = True
        rank[lv] = r
    out = (rank * 256 // (N * N)).astype(np.uint8)
    path = os.path.join(os.path.dirname(__file__), "..", "..", "public", "brain", "bluenoise.bin")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out.tofile(path)
    print("wrote", os.path.abspath(path), out.mean())


if __name__ == "__main__":
    main()
