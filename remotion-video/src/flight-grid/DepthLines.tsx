import { useMemo } from "react";
import * as THREE from "three";
import type { SegmentBatch } from "./lines";

// Screen-space line renderer with defocus built into the shader.
//
// Why not GL_LINES: they are locked to 1 device pixel, so the grid would
// look identical at 1080p and 4K and there would be nothing to blur.
//
// Why not a post-process depth-of-field pass: the whole frame is thin
// additive white lines on black. A depth-buffer bokeh pass needs the lines
// to write depth, which fights additive blending, and it costs a
// full-resolution blur every frame. Instead each segment is drawn as a
// camera-facing ribbon whose width grows with its circle of confusion and
// whose brightness drops to match, which is what defocus actually does to
// a line and is essentially free.
//
// Every segment is one instance of a 4-vertex quad; the vertex shader
// projects both endpoints, expands perpendicular in pixel space, and the
// fragment shader lays a Gaussian across the ribbon.

const VERTEX_SHADER = /* glsl */ `
  attribute vec2 aCorner;   // x: 0|1 along the segment, y: -1|+1 across it
  attribute vec3 aStart;
  attribute vec3 aEnd;

  uniform vec2 uResolution;
  uniform float uWidthPx;
  uniform float uFocus;
  uniform float uBokehK;
  uniform float uMaxCoc;
  uniform float uNear;

  varying float vSide;
  varying float vHalfW;
  varying float vViewZ;

  void main() {
    vec4 vs = modelViewMatrix * vec4(aStart, 1.0);
    vec4 ve = modelViewMatrix * vec4(aEnd, 1.0);

    // Near-plane clip in view space. A segment straddling the camera
    // plane projects to garbage and smears a bright streak across the
    // frame, so trim it before the perspective divide.
    if (vs.z > -uNear && ve.z > -uNear) {
      vSide = 0.0;
      vHalfW = 1.0;
      vViewZ = 0.0;
      gl_Position = vec4(0.0, 0.0, 2.0, 1.0); // behind the far plane
      return;
    }
    if (vs.z > -uNear) {
      vs = mix(vs, ve, (-uNear - vs.z) / (ve.z - vs.z));
    } else if (ve.z > -uNear) {
      ve = mix(ve, vs, (-uNear - ve.z) / (vs.z - ve.z));
    }

    vec4 clipS = projectionMatrix * vs;
    vec4 clipE = projectionMatrix * ve;

    vec2 halfRes = uResolution * 0.5;
    vec2 pxS = (clipS.xy / clipS.w) * halfRes;
    vec2 pxE = (clipE.xy / clipE.w) * halfRes;

    vec2 delta = pxE - pxS;
    float len = length(delta);
    vec2 dir = len > 1e-5 ? delta / len : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);

    float t = aCorner.x;
    vec4 clip = mix(clipS, clipE, t);
    float viewZ = max(-mix(vs.z, ve.z, t), 0.001);

    // Thin-lens circle of confusion: proportional to |1/focus - 1/z|.
    float coc = min(uBokehK * abs(1.0 / uFocus - 1.0 / viewZ), uMaxCoc);
    float halfW = 0.5 * (uWidthPx + coc);

    clip.xy += (nrm * aCorner.y * halfW) / halfRes * clip.w;

    vSide = aCorner.y;
    vHalfW = halfW;
    vViewZ = viewZ;
    gl_Position = clip;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uWidthPx;
  uniform float uFogDensity;

  varying float vSide;
  varying float vHalfW;
  varying float vViewZ;

  void main() {
    // Gaussian across the ribbon. k = 4 puts the edge at ~2% of peak, so
    // an in-focus line antialiases itself without MSAA.
    const float k = 4.0;
    float profile = exp(-k * vSide * vSide);

    // A defocused line spreads the same light over a wider ribbon, so it
    // has to dim in proportion. At minimum blur halfW == uWidthPx * 0.5
    // and this is exactly 1.
    float amp = (uWidthPx * 0.5) / max(vHalfW, 1e-4);

    float fog = exp(-uFogDensity * vViewZ);

    gl_FragColor = vec4(uColor, profile * amp * fog * uOpacity);
    if (gl_FragColor.a < 0.002) discard;
  }
`;

export type DepthLinesProps = {
  batch: SegmentBatch;
  /** Line width in device px, already multiplied by resolutionScale. */
  widthPx: number;
  /** Drawing-buffer size in px. */
  resolution: [number, number];
  /** Distance from the camera that stays sharp, in world units. */
  focus: number;
  /** Defocus strength, already multiplied by resolutionScale. */
  bokehK: number;
  maxCocPx: number;
  fogDensity: number;
  opacity: number;
  color?: string;
  near: number;
  renderOrder?: number;
};

export const DepthLines: React.FC<DepthLinesProps> = ({
  batch,
  widthPx,
  resolution,
  focus,
  bokehK,
  maxCocPx,
  fogDensity,
  opacity,
  color = "#ffffff",
  near,
  renderOrder = 0,
}) => {
  const geometry = useMemo(() => {
    const geo = new THREE.InstancedBufferGeometry();
    // One quad, with (alongSegment, acrossSegment) packed per corner.
    const corners = new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]);
    geo.setAttribute("aCorner", new THREE.BufferAttribute(corners, 2));
    // `position` is never read by the shader but three still wants it for
    // the draw-range bookkeeping.
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(12), 3),
    );
    geo.setIndex([0, 2, 1, 1, 2, 3]);
    geo.setAttribute(
      "aStart",
      new THREE.InstancedBufferAttribute(batch.starts, 3),
    );
    geo.setAttribute("aEnd", new THREE.InstancedBufferAttribute(batch.ends, 3));
    geo.instanceCount = batch.count;
    return geo;
  }, [batch]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uResolution: { value: new THREE.Vector2(1920, 1080) },
          uWidthPx: { value: 2 },
          uFocus: { value: 200 },
          uBokehK: { value: 1000 },
          uMaxCoc: { value: 24 },
          uNear: { value: 1 },
          uColor: { value: new THREE.Color("#ffffff") },
          uOpacity: { value: 1 },
          uFogDensity: { value: 0.003 },
        },
      }),
    [],
  );

  // Remotion drives this from React state, one commit per frame, and the
  // canvas draws after the commit — so writing uniforms here is enough and
  // avoids a render-loop hook that would not run under `frameloop="never"`.
  const u = material.uniforms;
  u.uResolution.value.set(resolution[0], resolution[1]);
  u.uWidthPx.value = widthPx;
  u.uFocus.value = focus;
  u.uBokehK.value = bokehK;
  u.uMaxCoc.value = maxCocPx;
  u.uNear.value = near;
  u.uColor.value.set(color);
  u.uOpacity.value = opacity;
  u.uFogDensity.value = fogDensity;

  return (
    <mesh
      geometry={geometry}
      material={material}
      renderOrder={renderOrder}
      frustumCulled={false}
    />
  );
};
