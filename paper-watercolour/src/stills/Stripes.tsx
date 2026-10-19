import React, { useCallback, useMemo } from "react";
import { hexToLinear, hexToOD } from "../lib/color";
import { STRIPE_CENTRES } from "../paint/layers";
import { Stage, type FrameContext } from "../lib/Stage";
import type { StripeColourway } from "../palettes";

const SCENE = /* glsl */ `
uniform sampler2D uStripes;
uniform vec3 uOD[7];
uniform float uCentres[7];
void main() {
  vec2 q = screenComp();
  vec2 uv = q / uBasis;
  float sharp = 1.0 - texture(uStripes, uv).r;
  float mid = 1.0 - textureLod(uStripes, uv, 2.0).r;
  // colour of the nearest painted stripe
  vec3 od = uOD[0];
  float best = 1e9;
  for (int i = 0; i < 7; i++) {
    float d = abs(q.y - uCentres[i]);
    if (d < best) { best = d; od = uOD[i]; }
  }
  float dens = sharp * 1.0 + max(0.0, sharp - mid) * 2.0;
  dens *= granulate(q, 0.7);
  outColor = vec4(paperBase(q) * exp(-od * dens * 1.6), 1.0);
}
`;

export const Stripes: React.FC<{ colourway: StripeColourway }> = ({ colourway }) => {
  const ods = useMemo(() => {
    const a = new Float32Array(21);
    colourway.pigments.slice(0, 7).forEach((c, i) => a.set(hexToOD(c), i * 3));
    return a;
  }, [colourway]);
  const onFrame = useCallback(
    ({ comp, frame }: FrameContext) =>
      comp.render(frame, 1, {
        uOD: { type: "3fv", value: ods },
        uCentres: { type: "1fv", value: new Float32Array(STRIPE_CENTRES) },
        uPaperColor: hexToLinear(colourway.paper),
      }),
    [ods, colourway],
  );
  return <Stage sceneSrc={SCENE} images={{ uStripes: "layers/stripes.png" }} onFrame={onFrame} />;
};
