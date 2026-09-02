# remotion-lib — component catalog

Shared building blocks for Remotion projects. Everything here is **fully
parameterised**, **palette-agnostic** (colours always arrive as arguments),
**deterministic** (a pure function of `frame` plus a stable string seed) and
**project-neutral**.

Import from the module path. `@lib` is aliased at both the bundler and
TypeScript — see [README.md](./README.md).

```ts
import { tickRing } from "@lib/draw/shapes";
```

**The determinism rule.** Nothing in here may call `Math.random()`,
`Date.now()`, `requestAnimationFrame`, or hold state. Remotion renders frames
out of order across parallel workers, so anything that is not a pure function
of `(frame, seed)` renders differently per worker and flickers.

**The loop rule.** Every helper that takes a `period` expects that period to
divide the composition's loop length exactly. A period that does not divide it
leaves the motion mid-stride at the cut. For a 450-frame loop the usable
periods are 1 2 3 5 6 9 10 15 18 25 30 45 50 75 90 150 225 450 — note that 60,
the tempting one, is **not** among them.

---

## `random/seeded`

Seeded randomness, all built on Remotion's `random()`.

| Export | Signature | Notes |
|---|---|---|
| `rnd` | `(seed) => number` | 0..1 |
| `rndRange` | `(seed, lo, hi) => number` | `[lo, hi)` |
| `rndInt` | `(seed, lo, hi) => number` | inclusive both ends |
| `pick` | `(seed, list) => T` | seeded choice |
| `clamp` | `(v, lo, hi) => number` | |
| `angleDelta` | `(a, b) => number` | shortest signed distance, `(-PI, PI]` |
| `angleForward` | `(a, b) => number` | forward distance, `[0, 2PI)` |

```ts
const jitter = rndRange(`bar-${i}-phase`, 0, 1);
```

*Gotcha:* seeds must be **stable across frames**. Interpolating a frame number
into a seed (`` `x-${frame}` ``) rerolls every frame, which is right for grain
and wrong for anything that should hold still. Use a generation index instead.

Used by: **hud-centre** (4K HUD dashboard).

---

## `canvas/canvas`

| Export | Signature |
|---|---|
| `useCanvasDraw` | `(width, height, draw) => RefObject<HTMLCanvasElement>` |
| `makeSprite` | `(width, height, draw) => HTMLCanvasElement \| null` |

`useCanvasDraw` runs `draw` once per React render — deliberately with **no
dependency array**, because Remotion re-renders per frame, so "once per render"
is "once per frame". Uses `useLayoutEffect` so the paint lands before Remotion
screenshots.

`makeSprite` rasterises once into a detached canvas. Wrap it in `useMemo` and
blit the result: this is how static panel chrome stays off the per-frame path.

```tsx
const chrome = useMemo(() => makeSprite(w, h, (ctx) => drawPanelChrome(ctx, {...})), [w, h]);
const ref = useCanvasDraw(w, h, (ctx) => {
  if (chrome) ctx.drawImage(chrome, 0, 0);
  drawValues(ctx);
});
return <canvas ref={ref} width={w} height={h} />;
```

*Gotcha:* `makeSprite` returns `null` during SSR (no `document`) — always
null-check before blitting.

Used by: **hud-centre**.

---

## `draw/shapes`

Palette-agnostic canvas primitives.

| Export | Key parameters | Defaults |
|---|---|---|
| `roundedRectPath` | `ctx, x, y, w, h, r` | — |
| `irregularDashes` | `seed, total, count, minFrac, maxFrac` | `0.25`, `1` |
| `radialPlaces` | `seed, count, rMin, rMax, angleFrom, angleTo, radiusBias` | `0`, `2PI`, `1` |
| `tickRing` | `cx, cy, radius, count, length, width, color, majorEvery, majorLength, majorColor, majorWidth, from, to` | `majorEvery: 0`, `majorLength: length*1.8`, `from/to: 0..2PI` |
| `brokenArcRing` | `cx, cy, radius, width, color, seed, pieces, minFrac, maxFrac, cap` | `7`, `0.3`, `0.92`, `"butt"` |
| `drawOn` / `clearDrawOn` | `ctx, pathLength, progress` | progress 0..1 |
| `withGlow` | `ctx, color, blur, body` | wraps in save/restore |

`irregularDashes` returns `{start, length}[]` — a rule drawn as unequal ticks,
the "hand-cut" look real instrument chrome has, rather than a uniform CSS dash.

`radialPlaces` uses a square root on the radius so points spread evenly by
**area** instead of clumping at the centre.

```ts
tickRing(ctx, {
  cx, cy, radius: 300, count: 180, length: 10, width: 1.5,
  color: "rgba(46,107,122,0.9)", majorEvery: 15, majorLength: 20,
});
```

*Gotcha:* `drawOn` sets `lineDash` on the context and does **not** restore it.
Call `clearDrawOn` (or wrap in `save`/`restore`) or the dash leaks into the next
stroke.

Used by: **hud-centre**.

---

## `draw/grid`

| Export | Key parameters | Defaults |
|---|---|---|
| `panelGrid` | `x, y, w, h, columns, rows, headerHeight, colors {headerRule, line}, headerRuleWidth, lineWidth, dividerInset` | `0`, `2`, `1`, `10` |
| `guideLines` | `x, y, w, h, color, lineWidth, vertical, horizontal` | `1`, `0`, `0` |

`panelGrid` is the rule-work of a tabular panel: header underline, row
separators, column dividers. `guideLines` is the faint chart graticule.

```ts
guideLines(ctx, { ...inner, color: "#0F3040", vertical: 8, horizontal: 4 });
```

*Gotcha:* `guideLines` draws `n + 1` lines for `n` divisions (both edges
included). Pass `0` to skip an axis entirely — it is not "1 line".

Used by: **hud-centre**.

---

## `draw/panel-chrome`

The chrome a panel-based HUD shares.

| Export | Key parameters | Defaults |
|---|---|---|
| `drawPanelChrome` | `w, h, label, labelFont, colors {fill, border, tick, labelText, labelStrip}, borderWidth, labelHeight, cornerTick, bracketOnly, letterSpacing` | `2`, `38`, `20`, `false`, `"3px"` |
| `panelFlash` | `loopedFrame, panelIndex, panelCount, slotFrames, flashLength` | returns 0..1 |
| `drawBorderFlash` | `ctx, w, h, amount, color, borderWidth` | `2` |
| `smallCaps` | `ctx, text, x, y, {font, color, align, baseline, spacing, alpha}` | `"3px"` |

`bracketOnly: true` draws corner brackets instead of a closed box — for "open"
regions like a stage frame.

`panelFlash` allocates **one** flash slot every `slotFrames` and picks exactly
one panel per slot, so a whole dashboard averages a steady flash rate with no
two ever overlapping:

```ts
// 16 panels, one flash every 10 frames lasting 4 = a steady 3 flashes/sec
const amount = panelFlash(frame, myIndex, 16, 10, 4);
drawBorderFlash(ctx, w, h, amount, "#A8E8F5");
```

*Gotcha:* `smallCaps` upper-cases the text for you — don't pre-upper-case, or
`letterSpacing` will read differently than you expect. And Canvas2D
`letterSpacing` needs a units string (`"3px"`), not a number.

Used by: **hud-centre**.

---

## `motion/stepped`

| Export | Key parameters | Defaults |
|---|---|---|
| `steppedSpring` | `frame, fps, period, loopLength, seed, min, max, damping, mass, stiffness` | `14`, `0.9`, `85` |
| `steppedValue` | `frame, period, loopLength, seed, min, max, offset` | `offset: 0` |
| `pulseEnvelope` | `frame, period, start, width` | returns a 0..1 sine bell |

`steppedSpring` re-targets every `period` frames and **closes the loop**: there
are exactly `loopLength / period` targets indexed cyclically, so frame 0 sits on
the last generation's target with zero spring progress, which is where the final
frame has just settled.

`steppedValue` snaps instead of springing, and also returns
`ageInGeneration` — useful for flashing a cell that has just changed.

```ts
const arc = steppedSpring({ frame, fps: 30, period: 90, loopLength: 450, seed: "gauge-1", min: 0.1, max: 0.95 });
const { value, ageInGeneration } = steppedValue({ frame, period: 75, loopLength: 450, seed: "cell-3-2", min: 0, max: 9999 });
```

*Gotcha:* `loopLength % period` must be `0`, and the spring must **settle
inside one period** — the default config takes about 45 frames, so periods
below ~60 will be caught still moving.

Used by: **hud-centre**.

---

## `effects/finish`

| Export | Key parameters | Defaults |
|---|---|---|
| `scanlinePass` | `width, height, step, thickness, color, alpha` | `5`, `1`, `"0, 0, 0"`, `0.03` |
| `vignettePass` | `width, height, color, stops, radiusFactor` | `"2, 6, 10"`, `[[0,0],[0.55,0.04],[0.82,0.2],[1,0.46]]`, `0.62` |
| `makeGrainTiles` | `count, size, seed` | `seed: "grain"` |
| `grainPass` | `width, height, tiles, frame, alpha, seed, composite` | `0.04`, `"grain"`, `"overlay"` |

Grain is a **pre-rolled tile** filled as a repeating pattern, not a full-frame
noise buffer: at 4K the latter is 8.3 million seeded randoms per frame and
would dominate the render. Which tile, and its offset, come from the frame
number, so it moves every frame while staying deterministic.

```tsx
const tiles = useMemo(() => makeGrainTiles(10, 256), []);
const staticLayer = useMemo(() => makeSprite(W, H, (ctx) => {
  scanlinePass(ctx, { width: W, height: H });
  vignettePass(ctx, { width: W, height: H });
}), []);
// per frame:
ctx.drawImage(staticLayer, 0, 0);
grainPass(ctx, { width: W, height: H, tiles, frame });
```

*Gotcha:* `grainPass` picks a tile with `frame % tiles.length`. Pass a frame
already wrapped into the loop, and make sure `tiles.length` divides the loop
length or the grain will not repeat exactly at the cut.

Used by: **hud-centre**.

---

## `effects/bloom`

`<BloomCanvas />`

| Prop | Type | Default |
|---|---|---|
| `width`, `height` | `number` | — |
| `draw` | `(ctx) => void` | — |
| `blurPx` | `number` | `26` |
| `opacity` | `number` | `0.62` |
| `blendMode` | CSS `mixBlendMode` | `"screen"` |
| `style` | `CSSProperties` | applied to **both** layers |

Draws once into an offscreen buffer, then composites twice: a CSS-blurred copy
screened underneath and a crisp copy on top. Both layers are the same pixels —
drawing twice would double the cost and let the copies drift.

```tsx
<BloomCanvas
  width={1306} height={950} draw={drawScene}
  blurPx={26} opacity={0.62}
  style={{ position: "absolute", left: 2050, top: 420 }}
/>
```

*Gotcha:* the glow layer's CSS blur renders **outside** the canvas box, so a
bright element near an edge haloes over whatever is behind it. That is usually
what you want; wrap it in a clipping container if it must be contained.

Used by: **hud-centre**.

---

## `scopes/radar-scope`

The sweep-plus-persistence-plus-contacts pattern.

| Export | Purpose |
|---|---|
| `drawRadarGrid` | static range rings + radial spokes, optional denser sub-grid over one sector |
| `drawRadarSweep` | the rotating wedge and its phosphor trail |
| `drawRadarContacts` | dots that light as the sweep crosses them, then decay |
| `makeContacts` | deterministic contact placements |
| `sweepAngle` | `(frame, period) => radians` |

`RadarScopeOpts`: `cx, cy, radius, frame, period, rings, spokeStep, wedgeSpan,
colors {grid, gridFaint, sweep, trail, contact, contactHot}, contacts,
contactDecay, contactRadius, wedgeAlpha (0.85), trailAlpha (0.17),
lineWidth (2), denseSector`.

**Persistence is computed, not accumulated.** The obvious phosphor trail
composites a low-alpha rect over the previous frame instead of clearing — but
that makes each frame depend on every frame before it, which Remotion's
out-of-order parallel rendering breaks. Since the sweep turns at a constant
rate, the time since it crossed any bearing is exactly
`((A - theta) mod 2PI) / omega`, and brightness is `exp(-age / tau)`. Sampling
that into a conic gradient gives the same picture as accumulation while staying
a pure function of the frame.

```ts
const opts = {
  cx, cy, radius: 380, frame, period: 150, rings: 5, spokeStep: 30,
  wedgeSpan: (28 * Math.PI) / 180, colors, contacts,
  contactDecay: 40, contactRadius: 11,
  denseSector: { from: Math.PI, to: Math.PI * 1.5 }, // upper-left quadrant
};
drawRadarGrid(ctx, opts);   // static — rasterise once
drawRadarSweep(ctx, opts);  // per frame
drawRadarContacts(ctx, opts);
```

*Gotchas:* canvas angles increase **clockwise** (y points down), so a rising
`period` phase sweeps clockwise and `denseSector: {from: PI, to: 1.5*PI}` is the
**upper-left** quadrant. `drawRadarGrid` is static and belongs in a sprite;
only the sweep and contacts are per-frame. And `createConicGradient` needs
Chrome 104+ — fine for Remotion, not for arbitrary browsers.

Used by: **hud-centre** (both the small dashboard scope and the full-stage
centre element, at different sizes and densities).

---

## `rings/segment-ring`

A circular progress indicator built from discrete rounded blocks.

| Export | Purpose |
|---|---|
| `drawSegmentRing` | the per-frame segments |
| `drawSegmentRingChrome` | static outer tick ring + inner circle |

`SegmentRingOpts`: `cx, cy, radius, thickness, segments, gapFraction, frame,
period, colors {lit, unlit, tick, tickMajor, innerCircle}`.

Segments light progressively clockwise from 12 o'clock, hold briefly at full,
then all extinguish before the cycle restarts. The newest segment burns
brightest, which is what makes the direction of travel legible.

Segments are **round-capped stroked arcs** — a stroked arc with
`lineCap: "round"` *is* a rounded block, and is far cheaper than building each
one as a polar rounded rectangle.

```ts
drawSegmentRingChrome(ctx, { cx, cy, radius: 360, thickness: 34, colors });
drawSegmentRing(ctx, {
  cx, cy, radius: 360, thickness: 34,
  segments: 30, gapFraction: 0.34,
  frame, period: 150,       // 3 cycles across a 450-frame loop
  colors: { lit: accent, unlit: "rgba(46,107,122,0.85)", ... },
});
```

*Gotcha:* `period` must divide the loop length or the ring is caught mid-fill
at the cut. `gapFraction` is a fraction of each segment's angular **slot**, not
an absolute angle, so the gap scales with `segments`.

Used by: **hud-centre**.

---

## `panels/traces`

| Export | Key parameters | Defaults |
|---|---|---|
| `makeJaggedSeries` | `seed, samples, spikeChance, {slowCycles, fastCycles, jitter}` | `3`, `7`, `0.32` |
| `drawScrollingTrace` | `x, y, w, h, series, offsetFraction, color, lineWidth, glow, amplitudeFraction` | `0`, `0.42` |

The series is cyclic by construction, so drawing it twice side by side tiles
seamlessly — that is what lets a scrolling waveform close on a loop. Both tiles
go into **one** path so the seam is a normal line join, not a visible break.

```ts
const series = useMemo(() => makeJaggedSeries("wave-main", 96, 0.1), []);
ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
drawScrollingTrace(ctx, {
  x, y, w, h, series,
  offsetFraction: (frame % 150) / 150,
  color: "#3FD4E8", lineWidth: 3, glow: 12,
});
ctx.restore();
```

*Gotcha:* it does **not** clip for you. Without a clip the incoming tile draws
outside the panel.

Used by: **hud-centre**.

---

## `panels/bars`

| Export | Key parameters | Defaults |
|---|---|---|
| `drawBarSeries` | `x, y, w, h, values, orientation, colors {bar, highlight, cap, track}, highlightIndex, thicknessFraction, gutter, capPx` | `-1`, `0.62` / `0.5`, `0`, `4` |
| `staggeredBarLevel` | `frame, slowPeriod, fastPeriod, slowPhase, fastPhase, bias, slowAmp, fastAmp, min, max` | `0`, `0.3`, `0.17`, `0.06`, `1` |

`drawBarSeries` **returns each bar's geometry** (`{index, x, y, w, h}`) so the
caller can hang value labels off it without recomputing the layout.

`colors.track` accepts a function `(index, barColor) => string`, so a track can
be tinted from the bar it belongs to — a highlighted bar keeps a matching
track instead of the series colour.

```ts
const values = bars.map((_, i) => staggeredBarLevel({
  frame, slowPeriod: 90, fastPeriod: 50,
  slowPhase: phase[i].slow, fastPhase: phase[i].fast,
}));
const geo = drawBarSeries(ctx, {
  ...inner, values, orientation: "horizontal", highlightIndex: 4, gutter: 118,
  colors: { bar: "#3FD4E8", highlight: "#F5A03F", track: (_i, c) => withAlpha(c, 0.2) },
});
```

*Gotcha:* both periods must divide the loop length. Using one period for the
whole series makes every bar pulse in unison — the two staggered cycles with
per-bar phases are the point.

Used by: **hud-centre**.

---

## `panels/gauge-ring`

| Export | Key parameters | Defaults |
|---|---|---|
| `drawGaugeTrack` | `cx, cy, radius, width, color` | — |
| `drawGaugeArc` | `cx, cy, radius, width, value, color, glow, startAngle, cap` | `0`, `-PI/2`, `"round"` |

Split in two because the track never changes: rasterise it once into a sprite
and redraw only the arc per frame.

```ts
drawGaugeTrack(ctx, { cx, cy, radius: 90, width: 17, color: dim });   // sprite
drawGaugeArc(ctx, { cx, cy, radius: 90, width: 17, value, color: accent, glow: 25 }); // per frame
```

*Gotcha:* `value` is a fraction of a **full turn**, not degrees. A round `cap`
overhangs the arc's ends by half the line width, so a `value` of 0 still paints
a dot.

Used by: **hud-centre**.
