import React, { useCallback } from "react";
import { GLSL_HEADER } from "../lib/glsl";
import { ShaderPipeline, useStableUniforms } from "../lib/ShaderPipeline";
import * as THREE from "three";
import {
  hexToLinear,
  LCh,
  linearToOklch,
  oklchToLinear,
  smoothstep,
} from "../lib/color";
import type { RainbowRingsRow } from "../data";

const FRAG = `${GLSL_HEADER}
uniform vec2 uResolution;
uniform float uFrame;
uniform float uLoop;
uniform float uSpacing;      // ring period, fraction of frame height
uniform float uRingsPerLoop; // whole ring spacings travelled per loop
uniform vec3 uDark;
uniform vec3 uLight;
uniform vec3 uEdge;
out vec4 fragColor;

// Antialiased band: 1 inside [a,b] (in ring-phase units), box filtered by w.
float band(float x, float a, float b, float w) {
  return clamp((x - a) / w + 0.5, 0.0, 1.0) - clamp((x - b) / w + 0.5, 0.0, 1.0);
}
float lineAt(float x, float c, float halfW, float w) {
  return band(x, c - halfW, c + halfW, max(w, 1e-4));
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float r = length(p);
  float t = uFrame / uLoop;
  float phase = r / uSpacing - uRingsPerLoop * t;
  float w = fwidth(phase) * 1.2;
  float x = fract(phase);

  // A ring: light band [0, 0.52], dark band [0.52, 1].
  // Light band edges carry a thin highlight, plus two faint inner grooves.
  float light = band(x, 0.0, 0.52, w) + band(x, 1.0, 1.52, w);
  vec3 col = mix(uDark, uLight, light);
  float edge = lineAt(x, 0.035, 0.012, w) + lineAt(x, 0.485, 0.012, w);
  float groove = lineAt(x, 0.17, 0.008, w) + lineAt(x, 0.34, 0.008, w);
  float darkGroove = lineAt(x, 0.76, 0.01, w);
  col = mix(col, uEdge, clamp(edge, 0.0, 1.0) * 0.85);
  col = mix(col, uEdge, clamp(groove, 0.0, 1.0) * 0.35);
  float grooveDark = lineAt(x, 0.255, 0.008, w);
  col = mix(col, uDark, clamp(grooveDark, 0.0, 1.0) * 0.3);
  col = mix(col, mix(uDark, uLight, 0.4), clamp(darkGroove, 0.0, 1.0) * 0.5);

  fragColor = vec4(col, 1.0);
}
`;

type Key = { dark: LCh; light: LCh; edge: LCh };

const makeKey = (hex: string, lightHex?: string): Key => {
  const dark = linearToOklch(hexToLinear(hex));
  const light: LCh = lightHex
    ? linearToOklch(hexToLinear(lightHex))
    : [dark[0] + 0.065, dark[1] * 1.04, dark[2]];
  // Highlights stay saturated (no pastel wash).
  const edge: LCh = [Math.min(0.97, light[0] + 0.09), light[1] * 1.0, light[2]];
  return { dark, light, edge };
};

const lerpLch = (a: LCh, b: LCh, t: number, dh: number): LCh => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + dh * t,
];

/** Signed hue step going the "down the spectrum" direction (decreasing hue). */
const hueStep = (from: number, to: number) => {
  let d = to - from;
  while (d > 0) d -= 360;
  while (d <= -360) d += 360;
  return d;
};

export const RainbowRings: React.FC<{ row: RainbowRingsRow }> = ({ row }) => {
  const keys = React.useMemo(() => row.keys.map((k) => makeKey(k[0], k[1])), [row]);
  const uniforms = useStableUniforms(() => ({
    uLoop: { value: row.durationInFrames },
    uSpacing: { value: row.spacing },
    uRingsPerLoop: { value: row.ringsPerLoop },
    uDark: { value: new THREE.Vector3() },
    uLight: { value: new THREE.Vector3() },
    uEdge: { value: new THREE.Vector3() },
  }));

  const update = useCallback(
    (frame: number) => {
      const n = keys.length;
      const seg = (frame / row.durationInFrames) * n;
      const i = Math.floor(seg) % n;
      const j = (i + 1) % n;
      const u = seg - Math.floor(seg);
      // Hold each key, then blend into the next.
      const tt = smoothstep(row.hold, 1, u);
      const a = keys[i];
      const b = keys[j];
      const set = (name: "uDark" | "uLight" | "uEdge", ka: LCh, kb: LCh) => {
        const c = oklchToLinear(lerpLch(ka, kb, tt, hueStep(ka[2], kb[2])));
        uniforms[name].value.set(c[0], c[1], c[2]);
      };
      set("uDark", a.dark, b.dark);
      set("uLight", a.light, b.light);
      set("uEdge", a.edge, b.edge);
    },
    [keys, row, uniforms],
  );

  return (
    <ShaderPipeline
      fragment={FRAG}
      uniforms={uniforms}
      update={update}
      loopFrames={row.durationInFrames}
    />
  );
};
