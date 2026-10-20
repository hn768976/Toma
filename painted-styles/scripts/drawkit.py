"""Shared helpers for every scene script: skill import path, deterministic seeding,
resolution scaling and byte-stable PNG saving."""
import os
import random
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILL = os.path.join(ROOT, 'vendor', 'claude-drawing-skill')
sys.path.insert(0, os.path.join(SKILL, 'lib'))

DESIGN_W, DESIGN_H = 1920, 1080   # every scene is authored in this coordinate space


def seed_all(seed):
    """The skill's classes take their own `seed=`, but a few helpers fall back to the
    global generators. Pin both before every paint so a run never depends on history."""
    random.seed(seed)
    np.random.seed(seed % (2 ** 32))


class Scaler:
    """Map 1920x1080 design coordinates onto the real canvas.

    W x H is the visible frame (any 16:9 size). With bleed=b the canvas grows by b on every
    side (canvas = W*(1+2b) x H*(1+2b)) and design point (0, 0) lands at (b*W, b*H).
    Full-width elements must cover the design range X0..X1 / Y0..Y1, which extends past
    0..1920 / 0..1080 by the bleed."""
    def __init__(self, W, H, bleed=0.0):
        self.s = W / DESIGN_W
        self.ox, self.oy = round(W * bleed), round(H * bleed)
        self.W, self.H = W + 2 * self.ox, H + 2 * self.oy          # canvas size
        self.X0, self.X1 = -self.ox / self.s, DESIGN_W + self.ox / self.s
        self.Y0, self.Y1 = -self.oy / self.s, DESIGN_H + self.oy / self.s

    def __call__(self, v):
        """lengths (radii, widths, sigmas): scale only"""
        return v * self.s

    def x(self, x):
        return x * self.s + self.ox

    def y(self, y):
        return y * self.s + self.oy

    def pt(self, x, y):
        return (x * self.s + self.ox, y * self.s + self.oy)

    def pts(self, seq):
        return [(x * self.s + self.ox, y * self.s + self.oy) for x, y in seq]


def group_rng(seed, name):
    """Independent, order-free generator for one layer group, so skipping a group never
    changes what any other group (or the finishing passes) draws."""
    gid = sum((i + 1) * ord(c) for i, c in enumerate(name))
    return np.random.default_rng([int(seed), gid])


def to_image(obj):
    """Accept a PIL image or a float/uint8 array and return an RGB(A) PIL image."""
    if isinstance(obj, Image.Image):
        return obj
    a = np.asarray(obj)
    if a.dtype != np.uint8:
        a = (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(a)


def save_png(img, path):
    """PNG with no metadata and fixed compression, so identical pixels give identical bytes."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    img = to_image(img)
    if img.mode not in ('RGB', 'RGBA'):
        img = img.convert('RGB')
    img.save(path, format='PNG', optimize=False, compress_level=6)
