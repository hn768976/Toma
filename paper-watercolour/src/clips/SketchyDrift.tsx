import React, { useCallback, useMemo } from "react";
import { hexToLinear } from "../lib/color";
import { boilSeed, hashString, mulberry32, onTwos } from "../lib/random";
import { drawShape, makeMovers, moverAt, roughOn } from "../lib/sketch";
import { Stage, useOverlay, type FrameContext } from "../lib/Stage";
import type { SketchColourway } from "../palettes";

// Ink layer composited onto paper: the ink soaks slightly into the paper
// (a touch of the blurred mip under the crisp line) and skips on the tooth.
export const INK_SCENE = /* glsl */ `
uniform sampler2D uInk;
uniform float uInkStrength;
void main() {
  vec2 q = screenComp();
  vec2 s = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
  vec4 ink = texture(uInk, s);
  vec4 soak = textureLod(uInk, s, 1.6);
  float a = max(ink.a, soak.a * 0.35);
  vec3 c = srgbToLinear(ink.a > 0.02 ? ink.rgb / ink.a : soak.rgb / max(soak.a, 0.001));
  vec4 p = paperAt(q);
  float tooth = 0.82 + 0.3 * p.r + 0.12 * (noiseAt(q, 90.0).z - 0.5);
  a = clamp(a * tooth, 0.0, 1.0);
  vec3 od = -log(max(c, vec3(0.003))) * uInkStrength;
  outColor = vec4(paperBase(q) * exp(-od * a), 1.0);
}
`;

export type SketchyDriftProps = { loopCheck?: boolean; colourway: SketchColourway; seedId: string; still?: boolean; countScale?: number };

export const SketchyDrift: React.FC<SketchyDriftProps> = ({ colourway, seedId, still = false, countScale = 1 }) => {
  const getCanvas = useOverlay();
  const W = 3840;
  const H = 2160;
  const movers = useMemo(
    () => makeMovers(mulberry32(hashString(seedId)), Math.round(colourway.count * countScale), W, H),
    [seedId, colourway, countScale],
  );

  const onFrame = useCallback(
    ({ comp, frame, scale, width, height }: FrameContext) => {
      const canvas = getCanvas(width, height);
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const rc = roughOn(canvas);
      const k = (comp.comp[0] / W) * scale; // comp px (3840 basis) -> device px
      const t = onTwos(frame % 600); // held motion: positions update every 2 frames
      for (const m of movers) {
        const p = moverAt(m, t, 600, W, H, 220);
        ctx.setTransform(k, 0, 0, k, p.x * k, p.y * k);
        ctx.rotate(p.r);
        const seed = boilSeed(m.seed, still ? 0 : frame % 600, 600);
        const o = { seed, strokeWidth: m.weight, roughness: 1.3, hachureGap: m.gap, hachureAngle: m.angle };
        drawShape(rc, m.kind, m.size, colourway.inks[m.ink], o, m.variant);
        // a faint re-trace slightly off the first line, as when a pen goes over a shape twice
        ctx.globalAlpha = 0.35;
        drawShape(rc, m.kind, m.size * 1.02, colourway.inks[m.ink], { ...o, seed: seed + 3, strokeWidth: m.weight * 0.6, roughness: 1.8 }, m.variant, true);
        ctx.globalAlpha = 1;
      }
      comp.setCanvas("uInk", canvas, { mipmap: true });
      comp.render(frame, 600, { uPaperColor: hexToLinear(colourway.paper), uInkStrength: 1.0 });
    },
    [movers, colourway, getCanvas, still],
  );

  return <Stage sceneSrc={INK_SCENE} onFrame={onFrame} />;
};
