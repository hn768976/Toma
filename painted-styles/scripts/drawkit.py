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
    """Map 1920x1080 design coordinates onto the real canvas (W x H, any 16:9 size)."""
    def __init__(self, W, H):
        self.W, self.H = W, H
        self.s = W / DESIGN_W

    def __call__(self, v):
        return v * self.s

    def pt(self, x, y):
        return (x * self.s, y * self.s)

    def pts(self, seq):
        return [(x * self.s, y * self.s) for x, y in seq]


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
