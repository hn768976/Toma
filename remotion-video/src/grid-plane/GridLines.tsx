import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  CELL_SIZE,
  CELLS_PER_LOOP,
  FOG_DENSITY,
  FOG_START_DEPTH,
  GLOW_ALPHA_SCALE,
  GLOW_DEPTH_FALLOFF,
  GLOW_WIDTH_PX,
  LINE_ALPHA_NEAR,
  LINE_WIDTH_FADE_FAR,
  LINE_WIDTH_FADE_NEAR,
  LINE_WIDTH_FAR_PX,
  LINE_WIDTH_NEAR_PX,
} from "./constants";
import { VERTEX_COUNT, computeHeights } from "./displacement";
import { buildGridBuffers } from "./geometry";
import {
  GridPlaneVariant,
  rippleAmplitude,
  swellAmplitude,
} from "./variants";

const vertexShader = /* glsl */ `
attribute vec2 aStartXZ;
attribute vec2 aEndXZ;
attribute float aStartY;
attribute float aEndY;
attribute float aSide;
attribute float aEndSelect;
attribute float aBrightness;
attribute float aTint;

uniform vec2 uHalfResolution;
uniform float uPixelScale;
uniform float uWidthNear;
uniform float uWidthFar;
uniform float uWidthFadeNear;
uniform float uWidthFadeFar;
uniform float uAlpha;
uniform float uFogDensity;
uniform float uFogStart;
uniform vec3 uBaseColor;
uniform vec3 uAccentColor;
uniform float uGlowMode;
uniform float uGlowWidth;
uniform float uGlowAlphaScale;
uniform float uGlowDepthFalloff;

varying float vDistPx;
varying float vHalfCore;
varying float vAlpha;
varying vec3 vColor;

void main() {
  vec4 viewStart = modelViewMatrix * vec4(aStartXZ.x, aStartY, aStartXZ.y, 1.0);
  vec4 viewEnd = modelViewMatrix * vec4(aEndXZ.x, aEndY, aEndXZ.y, 1.0);
  vec4 clipStart = projectionMatrix * viewStart;
  vec4 clipEnd = projectionMatrix * viewEnd;

  vec4 clipCurrent = mix(clipStart, clipEnd, aEndSelect);
  vec4 viewCurrent = mix(viewStart, viewEnd, aEndSelect);
  float depth = max(-viewCurrent.z, 0.001);

  // Expand the segment into a ribbon perpendicular to its own
  // screen-space direction, so the width is exact in pixels no matter
  // the output resolution.
  vec2 screenStart = clipStart.xy / max(clipStart.w, 1e-4) * uHalfResolution;
  vec2 screenEnd = clipEnd.xy / max(clipEnd.w, 1e-4) * uHalfResolution;
  vec2 delta = screenEnd - screenStart;
  float len = length(delta);
  vec2 dir = len > 1e-5 ? delta / len : vec2(1.0, 0.0);
  vec2 normalDir = vec2(-dir.y, dir.x);

  float coreWidth = mix(
    uWidthNear,
    uWidthFar,
    smoothstep(uWidthFadeNear, uWidthFadeFar, depth)
  ) * uPixelScale;
  float halfCore = 0.5 * coreWidth;
  float halfGlow = 0.5 * uGlowWidth * uPixelScale;
  // A pixel of feather either side of the core gives the coverage
  // falloff in the fragment shader somewhere to live.
  float halfQuad = mix(halfCore + 1.0, halfGlow, uGlowMode);

  clipCurrent.xy += normalDir * aSide * halfQuad / uHalfResolution * clipCurrent.w;
  gl_Position = clipCurrent;

  vDistPx = aSide * halfQuad;
  vHalfCore = mix(halfCore, halfGlow, uGlowMode);

  float fog = exp(-uFogDensity * max(depth - uFogStart, 0.0));
  float alpha = uAlpha * aBrightness * fog;
  alpha *= mix(1.0, uGlowAlphaScale * exp(-uGlowDepthFalloff * depth), uGlowMode);
  vAlpha = alpha;
  vColor = mix(uBaseColor, uAccentColor, aTint);
}
`;

const fragmentShader = /* glsl */ `
uniform float uGlowMode;

varying float vDistPx;
varying float vHalfCore;
varying float vAlpha;
varying vec3 vColor;

void main() {
  float d = abs(vDistPx);
  float coverage;
  if (uGlowMode > 0.5) {
    float s = d / max(vHalfCore, 0.0001);
    coverage = exp(-3.0 * s * s);
  } else {
    // Trapezoidal coverage: integrates to the true line width, and
    // degrades gracefully to a dimmer line once the core drops below a
    // pixel instead of dropping out entirely.
    coverage = clamp(vHalfCore + 0.5 - d, 0.0, 1.0);
  }
  float a = vAlpha * coverage;
  if (a < 0.002) discard;
  gl_FragColor = vec4(vColor * a, a);
}
`;

const makeUniforms = () => ({
  uHalfResolution: { value: new THREE.Vector2(960, 540) },
  uPixelScale: { value: 1 },
  uWidthNear: { value: LINE_WIDTH_NEAR_PX },
  uWidthFar: { value: LINE_WIDTH_FAR_PX },
  uWidthFadeNear: { value: LINE_WIDTH_FADE_NEAR },
  uWidthFadeFar: { value: LINE_WIDTH_FADE_FAR },
  uAlpha: { value: LINE_ALPHA_NEAR },
  uFogDensity: { value: FOG_DENSITY },
  uFogStart: { value: FOG_START_DEPTH },
  uBaseColor: { value: new THREE.Color("#cfe0ff") },
  uAccentColor: { value: new THREE.Color("#5b8fd6") },
  uGlowMode: { value: 0 },
  uGlowWidth: { value: GLOW_WIDTH_PX },
  uGlowAlphaScale: { value: GLOW_ALPHA_SCALE },
  uGlowDepthFalloff: { value: GLOW_DEPTH_FALLOFF },
});

const makeMaterial = (glow: boolean) => {
  const uniforms = makeUniforms();
  uniforms.uGlowMode.value = glow ? 1 : 0;
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    // The ribbon corners are emitted in a fixed order relative to the
    // line's own direction, which makes every quad wind the same way --
    // and that way is back-facing. Draw both sides rather than depending
    // on a winding that carries no meaning for a flat ribbon.
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    premultipliedAlpha: true,
    // Additive colour, "over" alpha. Additive is order-independent, which
    // matters because depth testing is off: tens of thousands of
    // transparent ribbons in arbitrary order would otherwise composite
    // differently depending on buffer layout.
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  return material;
};

export type GridLinesProps = {
  variant: GridPlaneVariant;
  /** frame / durationInFrames, in [0, 1). */
  loopProgress: number;
  width: number;
  height: number;
  /** Output height / 2160, so pixel-denominated sizes hold at any resolution. */
  pixelScale: number;
};

export const GridLines: React.FC<GridLinesProps> = ({
  variant,
  loopProgress,
  width,
  height,
  pixelScale,
}) => {
  const buffers = useMemo(() => buildGridBuffers(), []);
  const heights = useMemo(() => new Float32Array(VERTEX_COUNT), []);
  const startY = useMemo(
    () => new Float32Array(buffers.vertexCount),
    [buffers.vertexCount],
  );
  const endY = useMemo(
    () => new Float32Array(buffers.vertexCount),
    [buffers.vertexCount],
  );

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(buffers.vertexCount * 3), 3),
    );
    g.setAttribute("aStartXZ", new THREE.BufferAttribute(buffers.startXZ, 2));
    g.setAttribute("aEndXZ", new THREE.BufferAttribute(buffers.endXZ, 2));
    g.setAttribute("aSide", new THREE.BufferAttribute(buffers.side, 1));
    g.setAttribute("aEndSelect", new THREE.BufferAttribute(buffers.endSelect, 1));
    g.setAttribute(
      "aBrightness",
      new THREE.BufferAttribute(buffers.brightness, 1),
    );
    g.setAttribute("aTint", new THREE.BufferAttribute(buffers.tint, 1));
    const startAttribute = new THREE.BufferAttribute(startY, 1);
    const endAttribute = new THREE.BufferAttribute(endY, 1);
    startAttribute.setUsage(THREE.DynamicDrawUsage);
    endAttribute.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aStartY", startAttribute);
    g.setAttribute("aEndY", endAttribute);
    g.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
    // Positions live in the vertex shader, so there is nothing sensible
    // to derive a bounding sphere from. Frustum culling is off below.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    return g;
  }, [buffers, startY, endY]);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  const lineMaterial = useMemo(() => makeMaterial(false), []);
  const glowMaterial = useMemo(() => makeMaterial(true), []);
  useLayoutEffect(
    () => () => {
      lineMaterial.dispose();
      glowMaterial.dispose();
    },
    [lineMaterial, glowMaterial],
  );

  const groupRef = useRef<THREE.Group>(null);

  // Travel: exactly CELLS_PER_LOOP cells over the loop. Only the
  // remainder is applied to the mesh, so it wraps every cell and lands
  // back on zero at loopProgress = 1 -- the loop comes for free.
  const travel = CELLS_PER_LOOP * CELL_SIZE * loopProgress;
  const phase = travel - Math.floor(travel / CELL_SIZE) * CELL_SIZE;

  useLayoutEffect(() => {
    computeHeights(
      heights,
      phase,
      loopProgress,
      swellAmplitude(variant),
      rippleAmplitude(variant),
    );
    const { startHeightIndex, endHeightIndex, segmentCount } = buffers;
    for (let segment = 0; segment < segmentCount; segment++) {
      const a = heights[startHeightIndex[segment]];
      const b = heights[endHeightIndex[segment]];
      const base = segment * 4;
      startY[base] = a;
      startY[base + 1] = a;
      startY[base + 2] = a;
      startY[base + 3] = a;
      endY[base] = b;
      endY[base + 1] = b;
      endY[base + 2] = b;
      endY[base + 3] = b;
    }
    geometry.attributes.aStartY.needsUpdate = true;
    geometry.attributes.aEndY.needsUpdate = true;
    if (groupRef.current) {
      groupRef.current.position.z = phase;
    }
  }, [buffers, geometry, heights, startY, endY, phase, loopProgress, variant]);

  useLayoutEffect(() => {
    for (const material of [lineMaterial, glowMaterial]) {
      const u = material.uniforms;
      u.uHalfResolution.value.set(width / 2, height / 2);
      u.uPixelScale.value = pixelScale;
      u.uAlpha.value = LINE_ALPHA_NEAR * variant.alphaScale;
      u.uBaseColor.value.set(variant.lineColor);
      u.uAccentColor.value.set(variant.accentColor);
    }
  }, [lineMaterial, glowMaterial, width, height, pixelScale, variant]);

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} material={glowMaterial} frustumCulled={false} renderOrder={0} />
      <mesh geometry={geometry} material={lineMaterial} frustumCulled={false} renderOrder={1} />
    </group>
  );
};
