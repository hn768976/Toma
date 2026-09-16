// The backdrop: a single off-centre radial ramp plus a corner vignette,
// evaluated per pixel in the shader rather than blitted from a texture so
// it stays perfectly smooth at 4K.

import * as THREE from "three/webgpu";
import {
  Fn,
  float,
  mix,
  screenCoordinate,
  screenUV,
  uniform,
  vec2,
} from "three/tsl";
import type { Theme } from "./themes";

export type BackgroundNode = {
  node: ReturnType<typeof Fn>;
  setAspect: (aspect: number) => void;
};

export const createBackgroundNode = (theme: Theme) => {
  const uInner = uniform(new THREE.Color(theme.bgInner));
  const uOuter = uniform(new THREE.Color(theme.bgOuter));
  const uCorner = uniform(new THREE.Color(theme.bgCorner));
  const uHotspot = uniform(new THREE.Vector2(...theme.bgHotspot));
  const uAspect = uniform(16 / 9);

  const node = Fn(() => {
    // screenUV runs y-down here, matching how the theme states the
    // hotspot -- the way you'd read it off a frame.
    const p = vec2(screenUV.x, screenUV.y);

    // Distance to the hotspot, aspect-corrected so the falloff is circular
    // on screen rather than stretched with the frame.
    const q = vec2(p.x.sub(uHotspot.x).mul(uAspect), p.y.sub(uHotspot.y));
    const ramp = q.length().div(1.25).clamp(0, 1).pow(0.9);
    const base = mix(uInner, uOuter, ramp.smoothstep(0, 1));

    // Corner vignette, on top of the ramp.
    const c = vec2(p.x.sub(0.5).mul(uAspect), p.y.sub(0.5));
    const vignette = c.length().div(0.95).clamp(0, 1).pow(2.4);
    const col = mix(base, uCorner, vignette.mul(0.6));

    // Ordered-ish dither. These ramps span the whole frame, so without a
    // sub-LSB of noise the 8-bit H.264 output bands visibly across them.
    const hash = screenCoordinate.xy
      .dot(vec2(12.9898, 78.233))
      .sin()
      .mul(43758.5453)
      .fract();
    return col.add(hash.sub(0.5).mul(float(1.6 / 255)));
  })();

  return {
    node,
    setAspect: (aspect: number) => {
      uAspect.value = aspect;
    },
  };
};
