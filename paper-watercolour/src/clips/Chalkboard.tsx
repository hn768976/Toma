import React, { useCallback, useMemo, useRef } from "react";
import { designStrokes, polyLength, strokePartial, type Design, type Polyline } from "../lib/chalk";
import { hexToLinear } from "../lib/color";
import { boilSeed } from "../lib/random";
import { Stage, useOverlay, type FrameContext } from "../lib/Stage";
import type { BoardColourway } from "../palettes";

const SCENE = /* glsl */ `
uniform sampler2D uChalk;  // r = chalk lines, g = smudged residue
uniform vec3 uBoard;
uniform vec3 uChalkCol;
void main() {
  vec2 q = screenComp();
  vec2 s = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
  vec4 p = paperAt(q);
  vec3 col = uBoard * (1.0 + 0.16 * (p.g - 0.5) + 0.05 * (p.r - 0.5));
  // chalk dust haze and old eraser smudges, baked into the board
  float dust = smoothstep(0.5, 0.9, noiseAt(q, 2600.0).x);
  float c0 = cos(0.25), s0 = sin(0.25);
  vec2 r = mat2(c0, s0, -s0, c0) * q;
  // old eraser swipes: broad arcs of smeared chalk, ragged along their length
  float sm = 0.0;
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    vec2 cen = vec2(fract(sin(fk * 12.9898) * 43758.5453), fract(sin(fk * 78.233) * 12345.678)) * vec2(3840.0, 2160.0);
    float rad = 500.0 + 700.0 * fract(sin(fk * 3.17) * 999.1);
    vec2 dir = vec2(cos(fk * 2.4), sin(fk * 2.4));
    float span = smoothstep(0.1, 0.8, dot(normalize(q - cen), dir));
    float wob = (noiseAt(q, 1400.0).y - 0.5) * 260.0;
    float streak = noiseAt(q + vec2(fk * 500.0), 900.0).x;
    sm += smoothstep(220.0, 30.0, abs(length(q - cen) - rad + wob)) * span * smoothstep(0.42, 0.75, streak);
  }
  sm = clamp(sm, 0.0, 1.0) * smoothstep(0.3, 0.6, noiseAt(q, 3400.0).z + 0.2);
  col = mix(col, uChalkCol, 0.05 * dust + 0.045 * sm);

  vec4 c = texture(uChalk, s);
  float res = textureLod(uChalk, s, 1.5).g;
  // chalk only catches the tops of the board's tooth: grainy, broken edges
  float tooth = noiseAt(q, 48.0).x * 0.5 + noiseAt(q, 20.0).y * 0.2 + p.r * 0.3;
  float a = smoothstep(0.35, 0.7, min(c.r, 1.0) * 0.85 + (tooth - 0.5) * 4.6) * smoothstep(0.03, 0.25, c.r);
  // pressure varies along the stroke; dry patches skip
  a *= 0.7 + 0.3 * smoothstep(0.3, 0.6, noiseAt(q, 220.0).z);
  col = mix(col, uChalkCol, clamp(a, 0.0, 1.0) * 0.93);
  col = mix(col, uChalkCol, res * 0.22 * (0.6 + 0.8 * (noiseAt(q, 140.0).y - 0.5)));
  outColor = vec4(col, 1.0);
}
`;

type Slot = { x: number; y: number; design: Design };
const SLOTS: Slot[] = [
  { x: 600, y: 330, design: "formulaA" },
  { x: 1920, y: 260, design: "formulaC" },
  { x: 3240, y: 420, design: "atom" },
  { x: 3420, y: 1130, design: "bulb" },
  { x: 3200, y: 1840, design: "graph" },
  { x: 1920, y: 1900, design: "formulaD" },
  { x: 600, y: 1840, design: "arrow" },
  { x: 430, y: 1120, design: "star" },
];

// One smudge-and-redraw every 200 frames (6.7s, the nearest spacing that
// divides the 20s loop). Slot 0 swaps formula A -> B and back; slot 4's graph
// is wiped and redrawn. After the third event everything is as at frame 0.
type Ev = { slot: number; start: number; to: Design };
const EVENTS: Ev[] = [
  { slot: 0, start: 10, to: "formulaB" },
  { slot: 4, start: 210, to: "graph" },
  { slot: 0, start: 410, to: "formulaA" },
];
const ERASE = 40;
const GAP = 10;
const DRAW = 90;
const RESIDUE = 150;

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

type SlotState = {
  design: Design;
  drawFrac: number;
  erasing?: { design: Design; progress: number };
  residue?: { design: Design; amount: number; progress: number };
};

export const slotState = (i: number, f: number, still: boolean): SlotState => {
  let design = SLOTS[i].design;
  if (still) return { design, drawFrac: 1 };
  let st: SlotState = { design, drawFrac: 1 };
  for (const ev of EVENTS) {
    if (ev.slot !== i || f < ev.start) continue;
    const prev = design;
    design = ev.to;
    const t = f - ev.start;
    st = { design, drawFrac: 1 };
    if (t < ERASE) st = { design, drawFrac: 0, erasing: { design: prev, progress: t / ERASE } };
    else st.drawFrac = ease((t - ERASE - GAP) / DRAW);
    const amt = t < ERASE ? 0.45 : 0.45 * (1 - (t - ERASE) / RESIDUE);
    if (amt > 0) st.residue = { design: prev, amount: amt, progress: Math.min(1, t / ERASE) };
  }
  return st;
};

const bbox = (lines: Polyline[]) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of lines) for (const [x, y] of l) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y));
  return { x0: x0 - 50, y0: y0 - 50, x1: x1 + 50, y1: y1 + 50 };
};

// zig-zag eraser swipes over a box
const eraserPath = (b: ReturnType<typeof bbox>): Polyline[] => {
  const passes = 4;
  const pts: [number, number][] = [];
  for (let i = 0; i < passes; i++) {
    const y = b.y0 + ((i + 0.5) / passes) * (b.y1 - b.y0);
    const tilt = (b.y1 - b.y0) * 0.08;
    pts.push(i % 2 === 0 ? [b.x0 - 30, y - tilt] : [b.x1 + 30, y - tilt]);
    pts.push(i % 2 === 0 ? [b.x1 + 30, y + tilt] : [b.x0 - 30, y + tilt]);
  }
  return [pts];
};

const CHALK_W = 12;

export type ChalkboardProps = { loopCheck?: boolean; colourway: BoardColourway; still?: boolean };

export const Chalkboard: React.FC<ChalkboardProps> = ({ colourway, still = false }) => {
  const getOverlay = useOverlay();
  const tmpRef = useRef<HTMLCanvasElement | null>(null);
  const colours = useMemo(() => ({ board: hexToLinear(colourway.board), chalk: hexToLinear(colourway.chalk) }), [colourway]);

  const onFrame = useCallback(
    ({ comp, frame, scale, width, height }: FrameContext) => {
      const k = (comp.comp[0] / 3840) * scale;
      const ov = getOverlay(width, height);
      const ctx = ov.getContext("2d")!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      if (!tmpRef.current) tmpRef.current = document.createElement("canvas");
      const tmp = tmpRef.current;

      const strokeStyle = (c: CanvasRenderingContext2D, colour: string) => {
        c.strokeStyle = colour;
        c.lineWidth = CHALK_W;
        c.lineCap = "round";
        c.lineJoin = "round";
      };

      SLOTS.forEach((slot, i) => {
        const st = slotState(i, frame % 600, still);
        const seed = boilSeed(1000 + i * 977, still ? 0 : frame, 600);
        ctx.globalCompositeOperation = "lighter";
        // the sketch being written (or already there)
        if (st.drawFrac > 0) {
          const lines = designStrokes(st.design, seed);
          ctx.setTransform(k, 0, 0, k, slot.x * k, slot.y * k);
          strokeStyle(ctx, "#ff0000");
          // pressure: each stroke a little wider/brighter or thinner/fainter
          strokePartial(ctx, lines, st.drawFrac, (li) => {
            const h = ((li * 2654435761 + i * 40503) >>> 0) % 1000 / 1000;
            ctx.lineWidth = CHALK_W * (0.55 + 0.8 * h);
            ctx.strokeStyle = `rgb(${Math.round(120 + 135 * (1 - h * 0.7))},0,0)`;
          });
          // loose chalk dust: a faint haze that settles just below the strokes
          ctx.save();
          ctx.filter = `blur(${(10 * k).toFixed(2)}px)`;
          ctx.globalAlpha = 0.07;
          ctx.translate(0, 12);
          ctx.strokeStyle = "#00ff00";
          ctx.lineWidth = CHALK_W * 2.2;
          strokePartial(ctx, lines, st.drawFrac);
          ctx.restore();
        }
        // a sketch being wiped, and the smear it leaves behind
        const wipe = (design: Design, progress: number, channel: string, blur: number, alpha: number) => {
          const lines = designStrokes(design, seed);
          const b = bbox(lines);
          const er = eraserPath(b);
          const w = Math.ceil((b.x1 - b.x0 + 140) * k);
          const h = Math.ceil((b.y1 - b.y0 + 140) * k);
          tmp.width = w;
          tmp.height = h;
          const t = tmp.getContext("2d")!;
          t.setTransform(k, 0, 0, k, (70 - b.x0) * k, (70 - b.y0) * k);
          strokeStyle(t, channel);
          if (blur > 0) {
            t.filter = `blur(${(blur * k).toFixed(2)}px)`;
            for (let s = -4; s <= 4; s++) {
              t.save();
              t.translate(s * 22, s * 4);
              strokePartial(t, lines, 1);
              t.restore();
            }
            t.filter = "none";
            t.globalCompositeOperation = "destination-in";
          } else {
            strokePartial(t, lines, 1);
            t.globalCompositeOperation = "destination-out";
          }
          // felt eraser: soft, ragged edges rather than a clean cut
          t.lineWidth = (b.y1 - b.y0) / 2.2;
          t.lineCap = "round";
          t.strokeStyle = "#fff";
          t.filter = `blur(${(14 * k).toFixed(2)}px)`;
          strokePartial(t, er, progress);
          t.filter = "none";
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = alpha;
          ctx.drawImage(tmp, Math.round((slot.x + b.x0 - 70) * k), Math.round((slot.y + b.y0 - 70) * k));
          ctx.globalAlpha = 1;
        };
        if (st.erasing) wipe(st.erasing.design, st.erasing.progress, "#ff0000", 0, 1);
        if (st.residue) wipe(st.residue.design, st.residue.progress, "#00ff00", 22, st.residue.amount * 0.7);
      });
      ctx.globalCompositeOperation = "source-over";
      comp.setCanvas("uChalk", ov, { mipmap: true });
      comp.render(frame, 600, {
        uBoard: colours.board,
        uChalkCol: colours.chalk,
        uPaperColor: colours.board,
      });
    },
    [getOverlay, colours, still],
  );

  return <Stage sceneSrc={SCENE} paper={{ fibre: 0, seed: 21 }} onFrame={onFrame} />;
};

export const chalkStrokeLength = (d: Design) => polyLength(designStrokes(d, 1));
