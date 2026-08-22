"""Recreation of a "binary data grid" stock-footage loop in Manim.

The source clip is a static grid of 4-bit binary groups on a near-white
background. Nothing translates: the motion comes entirely from per-cell
opacity, driven by soft bands of brightness that sweep across the grid, and
from cell values re-rolling at random. A handful of cells hold a small
circular face glyph instead of a number.
"""

from __future__ import annotations

import random

import numpy as np
from manim import *

BG = "#FDFDFD"
INK = "#0A0A0A"

COLS = 32
ROWS = 26
DURATION = 30.0
SEED = 7

# Opacity floor/ceiling for a cell, and how much of the grid re-rolls per second.
DIM = 0.10
BRIGHT = 0.92
REROLL_PER_SEC = 0.55

# Travelling brightness bands: (cycles over DURATION, width, weight, y-tilt, phase).
# Integer cycle counts keep the animation seamless end-to-end.
WAVES = [
    (1, 0.055, 0.62, 0.35, 0.00),
    (2, 0.085, 0.40, -0.20, 0.31),
    (1, 0.130, 0.30, 0.60, 0.67),
    (3, 0.045, 0.34, 0.10, 0.12),
]


def face_glyph(size: float) -> VGroup:
    """A small stroke-only smiley, standing in for the clip's emoji cells."""
    head = Circle(radius=size * 0.5, stroke_width=1.1, stroke_color=INK, fill_opacity=0)
    eyes = VGroup(
        *[
            Circle(radius=size * 0.02, stroke_width=1.4, stroke_color=INK, fill_opacity=0)
            .move_to([dx * size * 0.17, size * 0.13, 0])
            for dx in (-1, 1)
        ]
    )
    mouth = Arc(
        radius=size * 0.26,
        start_angle=PI + 0.55,
        angle=PI - 1.1,
        stroke_width=1.1,
        stroke_color=INK,
    ).shift(DOWN * size * 0.03)
    return VGroup(head, eyes, mouth)


class BinaryRain(Scene):
    def construct(self):
        self.camera.background_color = BG
        rng = random.Random(SEED)

        cell_w = config.frame_width / COLS
        cell_h = config.frame_height / ROWS

        # Pre-render the 16 possible nibbles once; cells are cheap copies of these.
        bank = {}
        for value in range(16):
            text = format(value, "04b")
            glyph = Text(text, font="DejaVu Sans Mono", color=INK)
            glyph.scale_to_fit_width(cell_w * 0.74)
            bank[text] = glyph

        face = face_glyph(cell_h * 0.95)

        def centre(row: int, col: int) -> np.ndarray:
            return np.array(
                [
                    -config.frame_width / 2 + (col + 0.5) * cell_w,
                    config.frame_height / 2 - (row + 0.5) * cell_h,
                    0.0,
                ]
            )

        # Per-cell static offset, so the grid never reads as uniformly lit, and a
        # per-cell gain that breaks the bands up into speckle rather than solid bars.
        base = np.array(
            [[rng.uniform(-0.06, 0.22) for _ in range(COLS)] for _ in range(ROWS)]
        )
        gain = np.array(
            [[rng.uniform(0.15, 1.55) for _ in range(COLS)] for _ in range(ROWS)]
        )

        positions = [centre(r, c) for r in range(ROWS) for c in range(COLS)]
        is_face = [rng.random() < 0.028 for _ in range(ROWS * COLS)]

        grid = VGroup()
        for index, position in enumerate(positions):
            if is_face[index]:
                cell = face.copy().move_to(position)
            else:
                cell = bank[format(rng.randrange(16), "04b")].copy().move_to(position)
            grid.add(cell)
        self.add(grid)

        # Grid geometry as arrays, for a vectorised brightness field per frame.
        col_x = (np.arange(COLS) + 0.5) / COLS
        row_y = (np.arange(ROWS) + 0.5) / ROWS
        xs, ys = np.meshgrid(col_x, row_y)

        def brightness(t: float) -> np.ndarray:
            field = np.zeros_like(base)
            for cycles, width, weight, tilt, phase in WAVES:
                pos = (xs + tilt * ys - cycles * t / DURATION + phase) % 1.0
                distance = np.minimum(pos, 1.0 - pos)
                field += weight * np.exp(-((distance / width) ** 2))
            return np.clip(base + gain * field, DIM, BRIGHT)

        def apply(cell: Mobject, opacity: float, face_cell: bool) -> None:
            if face_cell:
                cell.set_stroke(opacity=opacity * 0.75)
            else:
                cell.set_fill(opacity=opacity)
                cell.set_stroke(opacity=0)

        clock = ValueTracker(0.0)

        def tick(mobject: Mobject, dt: float) -> None:
            t = clock.get_value() + dt
            clock.set_value(t)
            field = brightness(t)

            # Re-roll a slice of the numeric cells, swapping in a cached nibble.
            for _ in range(int(rng.random() + REROLL_PER_SEC * dt * COLS * ROWS)):
                index = rng.randrange(ROWS * COLS)
                if is_face[index]:
                    continue
                replacement = (
                    bank[format(rng.randrange(16), "04b")]
                    .copy()
                    .move_to(positions[index])
                )
                grid.submobjects[index] = replacement

            flat = field.reshape(-1)
            for index, cell in enumerate(grid.submobjects):
                apply(cell, float(flat[index]), is_face[index])

        tick(grid, 0.0)
        grid.add_updater(tick)
        self.wait(DURATION)
        grid.remove_updater(tick)
