// The bokeh layer: the out-of-focus discs and pin-sharp sparkles that give
// the reference clip its depth.
//
// Rather than rendering a sharp particle field and running a depth-of-field
// post pass (expensive, and it fights with additive blending), each particle
// carries its own circle of confusion. A particle far from the focal plane is
// drawn as a large, faint, crisp-edged disc with a brighter rim — which is what
// a real defocused highlight looks like — while one near the focal plane is a
// small soft point. Same visual result, a fraction of the cost, and every
// parameter stays directly art-directable.

import * as THREE from "three/webgpu";
import {
  Fn,
  vec2,
  vec3,
  vec4,
  float,
  uniform,
  uv,
  varying,
  mix,
  smoothstep,
  fract,
  abs,
  pow,
  cos,
  sin,
  clamp,
  length,
  instancedBufferAttribute,
} from "three/tsl";

import {
  BOKEH_Z_NEAR,
  CAMERA_FOV,
  CAMERA_Z,
  FOCAL_RANGE,
  FOCAL_Z,
  SPARKLE_FRACTION,
  BOKEH_DRIFT_CYCLES,
} from "./constants";
import type { Palette } from "./palettes";
import { bell, between, createRandom, weightedIndex } from "./random";

const srgb = (hex: string) => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);

/** How much a fully defocused particle grows relative to its base size. */
const COC_GAIN = 20.0;
/** Falloff of brightness as a particle spreads. 2.0 would be energy-exact. */
const COC_DIM = 1.15;
/** Oversize of the scatter volume vs. the frustum, so drift never pops in. */
const FRUSTUM_OVERSIZE = 1.18;

export type BokehFieldOptions = {
  palette: Palette;
  mirror: 1 | -1;
  count: number;
  aspect: number;
  seed: number;
  loopPeriod: number;
};

export type BokehField = {
  mesh: THREE.InstancedMesh;
  update: (timeSeconds: number) => void;
  dispose: () => void;
};

export const createBokehField = ({
  palette,
  mirror,
  count,
  aspect,
  seed,
  loopPeriod,
}: BokehFieldOptions): BokehField => {
  const rnd = createRandom(seed);
  const tanHalfFov = Math.tan((CAMERA_FOV / 2) * (Math.PI / 180));
  const weights = palette.bokeh.map((b) => b.weight);
  const tints = palette.bokeh.map((b) => srgb(b.color));

  const origin = new Float32Array(count * 3);
  const motion = new Float32Array(count * 4);
  const style = new Float32Array(count * 3);
  const tint = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const isSparkle = rnd() < SPARKLE_FRACTION;

    // Depth is derived from how defocused we want the particle to be, rather
    // than scattered uniformly through the volume and letting disc size fall
    // out of it. Same physics either way, but this makes the size distribution
    // directly art-directable: the exponent is what keeps big discs rare, and
    // the reference only ever has a handful on screen at once.
    //
    // Sparkles are pinned near the focal plane so they stay pin-sharp.
    const defocus = Math.pow(rnd(), 3.0);
    const z = isSparkle
      ? FOCAL_Z + between(rnd, -1.1, 1.1)
      : Math.min(FOCAL_Z + defocus * FOCAL_RANGE, BOKEH_Z_NEAR);

    // Scatter inside the camera frustum at this depth, so screen-space density
    // stays even instead of thinning out toward the camera.
    const dist = CAMERA_Z - z;
    const halfH = tanHalfFov * dist * FRUSTUM_OVERSIZE;
    const halfW = halfH * aspect;

    // Mild bias toward the dense side. The open side still gets bokeh — in the
    // reference it is the gyri that stop, not the particles.
    const skew = Math.pow(rnd(), 1.8) * 2 - 1;
    const x = skew * halfW * mirror;
    const y = between(rnd, -halfH, halfH);

    origin[i * 3] = x;
    origin[i * 3 + 1] = y;
    origin[i * 3 + 2] = z;

    // Integer drift cycles keep the wrap seamless across the clip.
    const cycles = BOKEH_DRIFT_CYCLES * (rnd() < 0.5 ? 1 : 2);
    motion[i * 4] = cycles;
    motion[i * 4 + 1] = halfH * 2;
    motion[i * 4 + 2] = isSparkle ? between(rnd, 0.05, 0.22) : between(rnd, 0.1, 0.5);
    motion[i * 4 + 3] = rnd() * Math.PI * 2;

    style[i * 3] = isSparkle
      ? bell(rnd, 0.010, 0.032)
      : bell(rnd, 0.022, 0.075);
    style[i * 3 + 1] = isSparkle
      ? between(rnd, 1.0, 2.6)
      : between(rnd, 0.7, 1.8);
    style[i * 3 + 2] = isSparkle ? 1 : 0;

    const c = tints[weightedIndex(rnd, weights)];
    tint[i * 3] = c.r;
    tint[i * 3 + 1] = c.g;
    tint[i * 3 + 2] = c.b;
  }

  const aOrigin = instancedBufferAttribute<"vec3">(
    new THREE.InstancedBufferAttribute(origin, 3),
    "vec3",
  );
  const aMotion = instancedBufferAttribute<"vec4">(
    new THREE.InstancedBufferAttribute(motion, 4),
    "vec4",
  );
  const aStyle = instancedBufferAttribute<"vec3">(
    new THREE.InstancedBufferAttribute(style, 3),
    "vec3",
  );
  const aTint = instancedBufferAttribute<"vec3">(
    new THREE.InstancedBufferAttribute(tint, 3),
    "vec3",
  );

  const uPhase = uniform(0);
  const uMirror = uniform(mirror);
  const uAspect = uniform(aspect);

  const material = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  // --- animated position --------------------------------------------------
  // Built once and referenced by both positionNode and scaleNode; TSL caches
  // it within the vertex stage so the maths only runs once per vertex.
  const animated = Fn(() => {
    const seedPhase = aMotion.w;
    const swirl = aMotion.z;

    // Two circular harmonics. Circles rather than drift so each particle is
    // back where it started at the loop point.
    const a = uPhase.add(seedPhase);
    const wobble = vec3(
      cos(a).mul(swirl).add(cos(a.mul(2.0)).mul(swirl.mul(0.3))),
      sin(a).mul(swirl.mul(0.6)).add(sin(a.mul(2.0)).mul(swirl.mul(0.22))),
      sin(a.mul(0.5)).mul(swirl.mul(0.4)),
    );

    // Vertical drift that wraps through the volume an integer number of times.
    const wrapH = aMotion.y;
    const tNorm = uPhase.div(Math.PI * 2);
    const yNorm = fract(aOrigin.y.div(wrapH).add(0.5).add(tNorm.mul(aMotion.x)));
    const y = yNorm.sub(0.5).mul(wrapH);

    return vec3(aOrigin.x, y, aOrigin.z).add(wobble);
  })().toVar("bokehPos");

  // Circle of confusion: 0 in perfect focus, 1 fully spread.
  const coc = clamp(
    abs(animated.z.sub(FOCAL_Z)).div(FOCAL_RANGE),
    0,
    1,
  ).toVar("bokehCoc");
  const spread = float(1.0).add(coc.mul(coc).mul(COC_GAIN)).toVar("bokehSpread");

  const vCoc = varying(float(0), "vCoc");
  const vAlpha = varying(float(0), "vAlpha");
  const vTint = varying(vec3(0), "vTint");

  material.positionNode = animated;
  material.scaleNode = Fn(() => {
    const size = aStyle.x.mul(spread);

    // How far across the frame this particle sits, 0 = dense side.
    const dist = float(CAMERA_Z).sub(animated.z);
    const halfW = dist.mul(tanHalfFov).mul(uAspect);
    const across = clamp(
      animated.x.mul(uMirror).div(halfW).mul(0.5).add(0.5),
      0,
      1,
    );

    const alpha = aStyle.y
      .div(pow(spread, COC_DIM))
      .mul(mix(1.0, 0.62, across));

    vCoc.assign(coc);
    vAlpha.assign(alpha);
    vTint.assign(aTint);

    return vec2(size, size);
  })();

  material.colorNode = Fn(() => {
    const d = length(uv().sub(0.5)).mul(2.0).toVar();

    // Sharp points are gaussian-ish blobs; defocused ones are hard-edged discs
    // with a brighter rim, which is the giveaway of a real bokeh highlight.
    const softness = mix(float(0.95), float(0.14), vCoc);
    const disc = smoothstep(1.0, float(1.0).sub(softness), d).toVar();
    const rim = pow(smoothstep(0.45, 1.0, d), 3.0).mul(vCoc).mul(0.85);

    const rgb = vTint.mul(disc).mul(float(0.85).add(rim)).mul(vAlpha);
    return vec4(rgb, 1.0);
  })();

  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;

  return {
    mesh,
    update: (timeSeconds: number) => {
      uPhase.value = (timeSeconds / loopPeriod) * Math.PI * 2;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
};
