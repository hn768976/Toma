import React, { useCallback, useMemo } from "react";
import { hexToLinear, hexToOD } from "../lib/color";
import { hashString, mulberry32, range } from "../lib/random";
import { roughOn } from "../lib/sketch";
import { Stage, useOverlay, type FrameContext } from "../lib/Stage";
import type { PencilColourway } from "../palettes";

// Graphite on paper: the lead only marks the tops of the paper tooth.
const SCENE = /* glsl */ `
uniform sampler2D uInk;
uniform vec3 uLeadOD;
void main() {
  vec2 q = screenComp();
  vec2 s = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
  float a = texture(uInk, s).a;
  vec4 p = paperAt(q);
  float tooth = p.r * 0.55 + noiseAt(q, 40.0).x * 0.45;
  float g = smoothstep(0.08, 0.7, a - (1.0 - tooth) * 0.55);
  outColor = vec4(paperBase(q) * exp(-uLeadOD * g * 0.8), 1.0);
}
`;

type Stroke = [number, number, number, number, number];

// Patches of parallel pencil strokes tiled round a ragged border band,
// cross-hatched more densely towards the outer edge.
const makeHatching = (seedId: string) => {
  const rng = mulberry32(hashString(seedId));
  const W = 3840;
  const H = 2160;
  const strokes: Stroke[] = [];
  const band = (x: number, y: number) => {
    const e = Math.min(x, W - x, y, H - y);
    return e;
  };
  for (let layer = 0; layer < 3; layer++) {
    const depth = [430, 270, 140][layer];
    const tries = [380, 260, 170][layer];
    for (let i = 0; i < tries; i++) {
      const x = range(rng, -60, W + 60);
      const y = range(rng, -60, H + 60);
      const e = band(x, y);
      const lim = depth * (0.75 + 0.5 * Math.sin(x * 0.004 + y * 0.003 + layer) * Math.sin(x * 0.0017 - y * 0.0041));
      if (e > lim) continue;
      const ang = (layer === 1 ? -1 : 1) * range(rng, 0.62, 0.9) + (layer === 2 ? Math.PI / 2 : 0);
      const n = Math.floor(range(rng, 6, 13));
      const len = range(rng, 110, 230);
      const gap = range(rng, 10, 14);
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);
      for (let k = 0; k < n; k++) {
        const cx = x + nx * gap * (k - n / 2) + range(rng, -4, 4);
        const cy = y + ny * gap * (k - n / 2) + range(rng, -4, 4);
        const l = len * range(rng, 0.8, 1.1);
        strokes.push([cx - Math.cos(ang) * l * 0.5, cy - Math.sin(ang) * l * 0.5, cx + Math.cos(ang) * l * 0.5, cy + Math.sin(ang) * l * 0.5, range(rng, 2.2, 3.4)]);
      }
    }
  }
  return strokes;
};

export const PencilFrame: React.FC<{ colourway: PencilColourway }> = ({ colourway }) => {
  const getOverlay = useOverlay();
  const strokes = useMemo(() => makeHatching(`PencilFrame_${colourway.name}`), [colourway]);
  const onFrame = useCallback(
    ({ comp, frame, scale, width, height }: FrameContext) => {
      const k = (comp.comp[0] / 3840) * scale;
      const ov = getOverlay(width, height);
      const ctx = ov.getContext("2d")!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      const rc = roughOn(ov);
      strokes.forEach(([x1, y1, x2, y2, w], i) => {
        ctx.globalAlpha = 0.45 + 0.45 * ((i * 7919) % 100) / 100;
        rc.line(x1, y1, x2, y2, { stroke: "#000", strokeWidth: w, roughness: 0.9, bowing: 1.4, seed: 11 + i, disableMultiStroke: true });
      });
      ctx.globalAlpha = 0.9;
      // a loose double rule just inside the hatching
      for (const [inset, seed] of [[520, 3], [545, 4]])
        rc.rectangle(inset, inset * 0.62, 3840 - inset * 2, 2160 - inset * 1.24, { stroke: "#000", strokeWidth: 4.5, roughness: 1.3, bowing: 1.5, seed });
      comp.setCanvas("uInk", ov);
      comp.render(frame, 1, { uLeadOD: hexToOD(colourway.lead), uPaperColor: hexToLinear(colourway.paper) });
    },
    [getOverlay, strokes, colourway],
  );
  return <Stage sceneSrc={SCENE} onFrame={onFrame} />;
};
