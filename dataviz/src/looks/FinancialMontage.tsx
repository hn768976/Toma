import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { LOOP_FRAMES } from "../lib/loop";
import { NeonFilter } from "../lib/glow";
import { Grain, DitherPatch } from "../lib/grain";
import { DESIGN_W, DESIGN_H, useScale } from "../lib/layout";
import { MONO_FONT, UI_FONT } from "../lib/fonts";
import { smoothPath } from "../lib/geom";
import { mulberry32, range, intRange } from "../lib/random";
import { seededSeries } from "../lib/series";

/**
 * sin(2*PI*f + phi) and sin(phi) are equal in maths but not in float64, and
 * the residue is enough to shift a sub-pixel transform and change
 * antialiasing by 1-2/255 across the frame. Quantising every emitted
 * coordinate removes that without hiding a genuinely wrong frequency, which
 * would move things by orders of magnitude more than this.
 */
const q = (n: number) => Math.round(n * 1e4) / 1e4;

const INK = "#d6f2f2";
const INK_DIM = "#8fc4c2";
const INK_FAINT = "#456f70";

type PanelKind = "line" | "bars" | "numbers" | "pie" | "table" | "ticks" | "area";

type MPanel = {
  kind: PanelKind;
  x: number;
  y: number;
  w: number;
  h: number;
  seed: number;
  op: number;
};

/**
 * Five depth layers. Nearer layers drift further (parallax) and are sharper.
 * Every drift is a closed Lissajous with integer frequencies, so the whole
 * field returns to its starting arrangement at the end of the loop.
 */
type Layer = {
  z: number;
  blur: number;
  op: number;
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  px: number;
  py: number;
  /** Static plane rotation, so the panels recede instead of sitting flat. */
  rx: number;
  ry: number;
  rz: number;
  panels: MPanel[];
};

const KINDS: PanelKind[] = ["line", "bars", "numbers", "pie", "table", "ticks", "area"];

const buildLayer = (seed: number, count: number, sizeScale: number): MPanel[] => {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const w = range(rnd, 320, 900) * sizeScale;
    return {
      kind: KINDS[Math.floor(rnd() * KINDS.length) % KINDS.length],
      // Biased toward the centre: two averaged samples give a triangular
      // distribution, which crowds the middle and leaves the margins black.
      x: ((range(rnd, -0.02, 0.92) + range(rnd, 0.0, 0.86)) / 2) * DESIGN_W,
      y: ((range(rnd, -0.04, 0.84) + range(rnd, 0.02, 0.78)) / 2) * DESIGN_H,
      w,
      h: w * range(rnd, 0.45, 1.05),
      seed: seed * 131 + i * 17,
      op: range(rnd, 0.32, 1),
    };
  });
};

const LAYERS: Layer[] = [
  { z: -2400, blur: 15, op: 0.34, ax: 22, ay: 14, fx: 1, fy: 2, px: 0.12, py: 0.6, rx: 5, ry: -13, rz: -1.5, panels: buildLayer(9001, 26, 1.25) },
  { z: -1700, blur: 9, op: 0.48, ax: 44, ay: 26, fx: 1, fy: 1, px: 0.7, py: 0.2, rx: -4, ry: 11, rz: 1.2, panels: buildLayer(9002, 25, 1.05) },
  { z: -1050, blur: 4.5, op: 0.68, ax: 74, ay: 40, fx: 2, fy: 1, px: 0.33, py: 0.85, rx: 6, ry: -9, rz: -2, panels: buildLayer(9003, 23, 0.9) },
  { z: -520, blur: 1.6, op: 0.8, ax: 112, ay: 62, fx: 1, fy: 2, px: 0.88, py: 0.42, rx: -5, ry: 14, rz: 1.8, panels: buildLayer(9004, 19, 0.78) },
  { z: -120, blur: 0, op: 0.95, ax: 168, ay: 92, fx: 2, fy: 3, px: 0.5, py: 0.05, rx: 3, ry: -7, rz: -1, panels: buildLayer(9005, 14, 0.66) },
];

/* ----------------------------------------------------------- panel art */

const Panel: React.FC<{ p: MPanel }> = ({ p }) => {
  const rnd = mulberry32(p.seed);
  const VB = 100;
  const common = {
    x: p.x,
    y: p.y,
    width: p.w,
    height: p.h,
    viewBox: `0 0 ${VB} ${VB}`,
    preserveAspectRatio: "none" as const,
    overflow: "visible" as const,
  };

  if (p.kind === "line") {
    const n = intRange(rnd, 7, 13);
    const pts = Array.from({ length: n }, (_, i) => ({
      x: (VB * i) / (n - 1),
      y: range(rnd, 12, 88),
    }));
    return (
      <svg {...common} opacity={p.op}>
        <polyline
          points={pts.map((q) => `${q.x},${q.y}`).join(" ")}
          fill="none"
          stroke={INK_DIM}
          strokeWidth={1.4}
        />
        {pts.map((q, i) => (
          <rect key={i} x={q.x - 1.4} y={q.y - 1.4} width={2.8} height={2.8} fill={INK} />
        ))}
      </svg>
    );
  }
  if (p.kind === "bars") {
    const n = intRange(rnd, 8, 18);
    return (
      <svg {...common} opacity={p.op}>
        {Array.from({ length: n }, (_, i) => {
          const h = range(rnd, 12, 92);
          return (
            <rect
              key={i}
              x={(VB * i) / n + 0.6}
              y={VB - h}
              width={VB / n - 1.6}
              height={h}
              fill={INK_DIM}
              opacity={range(rnd, 0.4, 1)}
            />
          );
        })}
      </svg>
    );
  }
  if (p.kind === "numbers") {
    const rows = intRange(rnd, 4, 7);
    return (
      <svg {...common} opacity={p.op}>
        <g fontFamily={MONO_FONT} fontSize={VB / rows / 1.18} fill={INK} style={{ fontVariantNumeric: "tabular-nums" }}>
          {Array.from({ length: rows }, (_, i) => (
            <text key={i} x={2} y={((i + 1) * VB) / rows} opacity={range(rnd, 0.45, 1)}>
              {Math.floor(range(rnd, 1000, 9999))}
            </text>
          ))}
        </g>
      </svg>
    );
  }
  if (p.kind === "pie") {
    const segs = intRange(rnd, 3, 6);
    let a = -Math.PI / 2;
    return (
      <svg {...common} opacity={p.op}>
        {Array.from({ length: segs }, (_, i) => {
          const sweep = (Math.PI * 2) / segs;
          const a0 = a;
          a += sweep;
          const x0 = 50 + Math.cos(a0) * 46;
          const y0 = 50 + Math.sin(a0) * 46;
          const x1 = 50 + Math.cos(a) * 46;
          const y1 = 50 + Math.sin(a) * 46;
          return (
            <path
              key={i}
              d={`M50,50 L${x0},${y0} A46,46 0 0 1 ${x1},${y1} Z`}
              fill={i % 2 ? INK_FAINT : INK_DIM}
              opacity={range(rnd, 0.35, 0.95)}
              stroke={INK}
              strokeWidth={0.5}
              strokeOpacity={0.5}
            />
          );
        })}
      </svg>
    );
  }
  if (p.kind === "table") {
    const rows = intRange(rnd, 6, 12);
    const cols = intRange(rnd, 3, 6);
    return (
      <svg {...common} opacity={p.op}>
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => (
            <rect
              key={`${r}-${c}`}
              x={(VB * c) / cols + 1.5}
              y={(VB * r) / rows + 1.5}
              width={(VB / cols) * range(rnd, 0.4, 0.86)}
              height={VB / rows - 3.5}
              fill={INK_DIM}
              opacity={range(rnd, 0.2, 0.75)}
            />
          )),
        )}
      </svg>
    );
  }
  if (p.kind === "ticks") {
    const n = intRange(rnd, 10, 26);
    return (
      <svg {...common} opacity={p.op}>
        <line x1={0} y1={50} x2={VB} y2={50} stroke={INK_DIM} strokeWidth={1} />
        {Array.from({ length: n }, (_, i) => (
          <line
            key={i}
            x1={(VB * i) / n}
            y1={50 - range(rnd, 3, 18)}
            x2={(VB * i) / n}
            y2={50 + range(rnd, 3, 18)}
            stroke={INK}
            strokeWidth={0.9}
            opacity={range(rnd, 0.3, 0.9)}
          />
        ))}
      </svg>
    );
  }
  const n = 24;
  const pts = Array.from({ length: n }, (_, i) => ({
    x: (VB * i) / (n - 1),
    y: range(rnd, 20, 92),
  }));
  return (
    <svg {...common} opacity={p.op}>
      <path d={`${smoothPath(pts, 0.4)} L${VB},${VB} L0,${VB} Z`} fill={INK_FAINT} opacity={0.5} />
      <path d={smoothPath(pts, 0.4)} fill="none" stroke={INK} strokeWidth={1.2} />
    </svg>
  );
};

/* ------------------------------------------------------------ hero curve */

const HERO_D = (() => {
  const pts = Array.from({ length: 41 }, (_, i) => {
    const u = i / 40;
    return {
      x: -0.08 * DESIGN_W + u * 1.2 * DESIGN_W,
      // A clean exponential-ish rise, left to right, across the whole frame.
      y: 1.15 * DESIGN_H - Math.pow(u, 1.9) * 1.05 * DESIGN_H,
    };
  });
  return smoothPath(pts, 0.4);
})();

const ZIG_SERIES = seededSeries(4242, 32, [1, 2, 4, 8], [1, 0.6, 0.35, 0.2]);

export const FinancialMontage: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useScale();
  const t = frame / LOOP_FRAMES;

  // Zigzag trace with markers, scrolling on the shared window so it loops.
  const zigN = 32;
  const ws = zigN * t;
  const leakA = q(Math.sin(Math.PI * t) * 0.85);

  const zigPts = Array.from({ length: 17 }, (_, i) => ({
    x: q(-0.05 * DESIGN_W + (i / 16) * 1.1 * DESIGN_W),
    y: q(0.22 * DESIGN_H + (1 - ZIG_SERIES.norm(ws + i)) * 0.56 * DESIGN_H),
  }));

  return (
    <AbsoluteFill style={{ backgroundColor: "#01050a" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(70% 66% at 50% 46%, #0a2c31 0%, #05171c 38%, #01080b 70%, #000203 88%, #000000 100%)",
        }}
      />

      {/* ---- layered panel field ---- */}
      {LAYERS.map((L, li) => {
        const dx = q(L.ax * Math.sin(Math.PI * 2 * L.fx * t + L.px * Math.PI * 2));
        const dy = q(L.ay * Math.sin(Math.PI * 2 * L.fy * t + L.py * Math.PI * 2));
        return (
          <AbsoluteFill key={li} style={{ filter: L.blur ? `blur(${L.blur * k}px)` : undefined, opacity: L.op }}>
            <AbsoluteFill style={{ perspective: `${2600 * k}px`, perspectiveOrigin: "50% 50%" }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: `translateZ(${L.z * k}px) rotateX(${L.rx}deg) rotateY(${L.ry}deg) rotateZ(${L.rz}deg) translate(${dx * k}px, ${dy * k}px)`,
                  transformStyle: "preserve-3d",
                }}
              >
                <svg
                  viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`}
                  width="100%"
                  height="100%"
                  style={{ overflow: "visible" }}
                >
                  {L.panels.map((p, pi) => (
                    <Panel key={pi} p={p} />
                  ))}
                </svg>
              </div>
            </AbsoluteFill>
          </AbsoluteFill>
        );
      })}

      {/* ---- hero rising curve, in front of everything and the only sharp
              element in the frame ---- */}
      <svg
        viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`}
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <NeonFilter
            id="montHero"
            r={9}
            stops={[1.15, 1.75, 2.3]}
            region={{ x: -600, y: -600, w: DESIGN_W + 1200, h: DESIGN_H + 1200 }}
          />
        </defs>
        <g opacity={0.78} filter="url(#montHero)">
          <polyline
            points={zigPts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={INK_DIM}
            strokeWidth={7}
            strokeDasharray="26 18"
          />
          {zigPts.map((p, i) => (
            <rect key={i} x={p.x - 11} y={p.y - 11} width={22} height={22} fill="#ffffff" opacity={0.92} />
          ))}
        </g>
        <g filter="url(#montHero)">
          <path d={HERO_D} fill="none" stroke="#bfeef2" strokeWidth={22} opacity={0.9} />
          {/* Clipped-white core: the reference's bright strokes blow out. */}
          <path d={HERO_D} fill="none" stroke="#ffffff" strokeWidth={8} opacity={1} />
        </g>
        <g fontFamily={UI_FONT} fontSize={26} fill={INK_DIM} opacity={0.38} letterSpacing={5}>
          <text x={0.035 * DESIGN_W} y={0.07 * DESIGN_H}>
            SERIES 1
          </text>
          <text x={0.035 * DESIGN_W} y={0.07 * DESIGN_H + 44}>
            SERIES 2
          </text>
        </g>
      </svg>

      {/* ---- blue light leak: one pass per loop ----
          Drawn as an SVG gradient rather than a CSS-blurred div. A gradient
          this wide is already smooth, so the blur added nothing visually but
          did add a large filtered compositing layer whose rasterisation
          rounded differently between capture paths, costing byte-identical
          determinism. It is also skipped entirely once invisible, so the loop
          closes with nothing drawn at either end. */}
      {leakA > 0.0005 ? (
        <svg
          viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`}
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0 }}
        >
          <defs>
            <linearGradient id="leakGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#3c96c8" stopOpacity="0" />
              <stop offset="0.22" stopColor="#5fb4dc" stopOpacity="0.1" />
              <stop offset="0.42" stopColor="#78cdf5" stopOpacity="0.3" />
              <stop offset="0.55" stopColor="#afe8ff" stopOpacity="0.46" />
              <stop offset="0.7" stopColor="#78cdf5" stopOpacity="0.24" />
              <stop offset="1" stopColor="#3c96c8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g transform={`rotate(11 ${DESIGN_W / 2} ${DESIGN_H / 2})`} opacity={leakA}>
            <rect
              x={q((-0.75 + t * 2.5) * DESIGN_W)}
              y={-0.45 * DESIGN_H}
              width={0.62 * DESIGN_W}
              height={1.9 * DESIGN_H}
              fill="url(#leakGrad)"
            />
          </g>
        </svg>
      ) : null}

      {/* Vignette — the reference falls off hard into black at every edge. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(62% 62% at 50% 49%, rgba(0,0,0,0) 26%, rgba(0,0,0,0.45) 56%, rgba(0,0,0,0.86) 80%, rgba(0,0,0,1) 100%)",
          pointerEvents: "none",
        }}
      />

      <DitherPatch opacity={0.02} />
      <Grain opacity={0.025} />
    </AbsoluteFill>
  );
};
