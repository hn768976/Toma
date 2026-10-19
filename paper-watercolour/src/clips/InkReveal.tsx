import React, { useCallback, useMemo } from "react";
import { hexToLinear, hexToOD } from "../lib/color";
import { Stage, type FrameContext } from "../lib/Stage";
import type { InkColourway } from "../palettes";

// Wash depth used to normalise the distance from the frame edge (comp px
// at 3840 wide): sides / top-bottom. Matches paint/layers.ts edgeWash.
const DEPTH_X = 560;
const DEPTH_Y = 400;

const SCENE = /* glsl */ `
uniform sampler2D uWash;
uniform sampler2D uSplat;
uniform vec3 uDark;     // optical densities
uniform vec3 uLight;
uniform float uT;       // seconds
uniform float uReveal;  // 0..1 progress of the bleed
uniform float uWet;     // 1 wet .. 0 dry
uniform vec2 uDepth;
uniform float uSplatOn; // 0 = no splatters (corner-wash still)
uniform float uWashAmt; // wash strength (low for the splatter still)

float edgeDist(vec2 q) {
  vec2 e = min(q, uBasis - q) / uDepth;
  return min(e.x, e.y);
}

void main() {
  vec2 q = screenComp();
  vec2 uv = q / uBasis;
  float wet = uWet;
  // painted wash: blurred while wet, crisp once dry
  float sharp = 1.0 - texture(uWash, uv).r;
  float soft = 1.0 - textureLod(uWash, uv, 3.5).r;
  float mid = 1.0 - textureLod(uWash, uv, 2.0).r;
  float D = mix(sharp, soft, wet * 0.6) * smoothstep(0.04, 0.11, soft);

  // bleed-in mask: an uneven, finger-like front advancing from all edges
  float e = edgeDist(q);
  vec4 n = noiseAt(q, 1500.0);
  vec4 nf = noiseAt(q, 380.0);
  float front = e + (n.x - 0.5) * 0.9 + (nf.y - 0.5) * (0.08 + 0.17 * (1.0 - wet));
  // the front stops at ~1.15 wash depths, so the centre stays clean paper
  float P = uReveal * 1.4 - 0.25;
  float mask = smoothstep(P + 0.05 + 0.08 * wet, P - 0.05 - 0.08 * wet, front);
  float rim = exp(-pow((front - P) / 0.07, 2.0)) * wet * step(0.001, uReveal) * smoothstep(0.02, 0.1, soft);

  float dens = uWashAmt * D * mask * (1.0 + 0.9 * (1.0 - smoothstep(0.0, 0.7, e)));
  dens += rim * 0.35;
  // drying: pigment pulls to the edges of each wash (soft hard-lines)
  float hardLine = max(0.0, sharp - mid) * 2.6 * (1.0 - wet) * mask;
  dens += hardLine;
  dens *= granulate(q, 0.12 + 0.38 * (1.0 - wet));

  // splatters land during the bleed, each patch at its own moment
  float s = 1.0 - mix(texture(uSplat, uv).r, textureLod(uSplat, uv, 2.0).r, wet * 0.5);
  float ts = 0.15 + 0.75 * noiseAt(q, 2600.0).z;
  float sOn = smoothstep(ts, ts + 0.02, uReveal) * uSplatOn;
  dens += smoothstep(0.02, 0.25, s) * (2.2 + 2.0 * s) * sOn * smoothstep(1.35, 1.05, e);

  vec3 pig = mix(uLight, uDark, smoothstep(0.15, 0.75, dens));
  vec3 od = pig * dens * 1.5;
  outColor = vec4(paperBase(q) * exp(-od), 1.0);
}
`;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export type InkRevealProps = {
  colourway: InkColourway;
  /** "edge" = the 12s story; "corner" / "splatter" = stills */
  variant?: "edge" | "corner" | "splatter";
  still?: boolean;
};

export const InkReveal: React.FC<InkRevealProps> = ({ colourway, variant = "edge", still = false }) => {
  const od = useMemo(() => ({ dark: hexToOD(colourway.dark), light: hexToOD(colourway.light) }), [colourway]);
  const images = useMemo(
    () => ({
      uWash: variant === "corner" ? "layers/corner_wash.png" : variant === "splatter" ? "layers/edge_wash.png" : "layers/edge_wash.png",
      uSplat: variant === "splatter" ? "layers/splatter_frame.png" : "layers/ink_splatter.png",
    }),
    [variant],
  );

  const onFrame = useCallback(
    ({ comp, frame }: FrameContext) => {
      const t = still ? 12 : frame / 30;
      // 0-1s blank, 1-6s bleed in, 6-8s settle, 8-12s hold
      const reveal = smooth(1, 6, t);
      const wet = 1 - smooth(6, 8, t);
      // very slow drift: starts at rest, eases along
      const drift = smooth(0, 12, t);
      comp.render(frame, 360, {
        uDark: od.dark,
        uLight: od.light,
        uT: t,
        uReveal: reveal,
        uWashAmt: variant === "splatter" ? 0.22 : 1,
        uWet: wet,
        uDepth: [DEPTH_X, DEPTH_Y],
        uSplatOn: variant === "corner" ? 0 : 1,
        uPaperColor: hexToLinear(colourway.paper),
        uCam: [drift * 36, drift * 14],
        uCamZoom: 1 + 0.012 * drift,
      });
    },
    [od, colourway, still, variant],
  );

  return <Stage sceneSrc={SCENE} images={images} onFrame={onFrame} />;
};
