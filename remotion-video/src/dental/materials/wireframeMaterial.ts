// The scan-visualisation look for version 7.
//
// Drawing the real triangle wireframe is not an option here: after
// subdivision the arch is 375k triangles, which at 1080p collapses into
// grey moire. The reference is a regular quad grid anyway, so the grid is
// generated in the shader instead -- triplanar, so it wraps cusps and
// interproximal walls evenly without a UV seam, at a density chosen for
// the frame rather than inherited from the tessellation.

import { Color, DoubleSide, ShaderMaterial, Vector3 } from "three";
import { LightRig } from "./palette";

const VERTEX = /* glsl */ `
attribute float aGumT;
attribute float aTheta;
attribute float aBand;
attribute float aAo;

varying vec3 vModelPos;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vGumT;
varying float vBand;
varying float vAo;

void main() {
  vModelPos = position;
  vGumT = aGumT;
  vBand = aBand;
  vAo = aAo;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uSurfaceColor;
uniform vec3 uLineColor;
uniform vec3 uToothColor;
uniform float uDensity;
uniform float uLineWidth;
uniform float uLineStrength;
uniform float uSurfaceOpacity;
uniform float uFresnel;
uniform vec3 uKeyDir;
uniform float uExposure;

// Position of the scan band along the model's vertical axis, and how wide
// it is. The band brightens lines as it passes, which is what sells the
// shot as an acquisition rather than a static model.
uniform float uScanY;
uniform float uScanWidth;
uniform vec3 uScanColor;

varying vec3 vModelPos;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vGumT;
varying float vBand;
varying float vAo;

// Distance to the nearest grid line of a 2D lattice, in pixels, using
// screen-space derivatives so the lines hold a constant width at any
// camera distance.
//
// The second term is the important one. Where the surface turns away the
// cells shrink below a pixel, every pixel covers a line, and the grid
// collapses into flat blue. Fading the lines out as the cell size
// approaches the pixel size is the standard fix and keeps the far side of
// the arch reading as surface rather than paint.
float gridLine(vec2 uv, float width) {
  vec2 w = fwidth(uv);
  vec2 grid = abs(fract(uv - 0.5) - 0.5) / max(w, vec2(1e-5));
  float line = 1.0 - smoothstep(0.0, width, min(grid.x, grid.y));
  float fade = 1.0 - smoothstep(0.22, 0.55, max(w.x, w.y));
  return line * fade;
}

void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorldPos);

  // Triplanar blend: project the grid down whichever axes the surface
  // faces least, so cusps and walls both get a square-ish grid.
  vec3 blend = pow(abs(N), vec3(4.0));
  blend /= blend.x + blend.y + blend.z;
  vec3 p = vModelPos * uDensity;
  float line = gridLine(p.yz, uLineWidth) * blend.x
             + gridLine(p.xz, uLineWidth) * blend.y
             + gridLine(p.xy, uLineWidth) * blend.z;

  // Kept deliberately flat and high-key: this is a data visualisation, so
  // form should come from the grid, not from modelling with light.
  float lambert = clamp(dot(N, uKeyDir) * 0.3 + 0.86, 0.0, 1.25);
  float ao = mix(0.84, 1.0, vAo);
  vec3 base = mix(uSurfaceColor, uToothColor, smoothstep(0.35, 0.75, vBand) * step(0.0, vGumT));
  vec3 color = base * lambert * ao;

  // Edge-on surfaces read as silhouette, which keeps the arch legible
  // against a pale backdrop once the fill is nearly transparent.
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);

  float scan = exp(-pow((vWorldPos.y - uScanY) / max(uScanWidth, 0.0001), 2.0));
  vec3 lineColor = mix(uLineColor, uScanColor, scan * 0.85);
  float lineAmount = clamp(line * uLineStrength * (0.75 + 0.6 * scan), 0.0, 1.0);

  color = mix(color, lineColor, lineAmount);
  color += uLineColor * rim * uFresnel;
  color *= uExposure;

  float alpha = clamp(uSurfaceOpacity + lineAmount * 0.9 + rim * 0.55, 0.0, 1.0);

  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export type WireframeLook = {
  surfaceColor: string;
  lineColor: string;
  toothColor: string;
  scanColor: string;
  /** Grid cells per model unit; the arch is 1.0 wide. */
  density: number;
  lineWidth: number;
  lineStrength: number;
  surfaceOpacity: number;
  fresnel: number;
  scanY: number;
  scanWidth: number;
};

export const createWireframeMaterial = (): ShaderMaterial =>
  new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: true,
    side: DoubleSide,
    uniforms: {
      uSurfaceColor: { value: new Color("#EAF3FB") },
      uLineColor: { value: new Color("#4C8FD0") },
      uToothColor: { value: new Color("#FFFFFF") },
      uScanColor: { value: new Color("#19C9FF") },
      uDensity: { value: 90 },
      uLineWidth: { value: 1.15 },
      uLineStrength: { value: 0.85 },
      uSurfaceOpacity: { value: 0.9 },
      uFresnel: { value: 0.35 },
      uScanY: { value: 10 },
      uScanWidth: { value: 0.05 },
      uKeyDir: { value: new Vector3(0, 1, 0) },
      uExposure: { value: 1 },
    },
  });

export const applyWireframeLook = (
  material: ShaderMaterial,
  state: WireframeLook,
  rig: LightRig,
  viewOrientation?: { x: number; y: number; z: number; w: number },
) => {
  const u = material.uniforms;
  (u.uSurfaceColor.value as Color).set(state.surfaceColor);
  (u.uLineColor.value as Color).set(state.lineColor);
  (u.uToothColor.value as Color).set(state.toothColor);
  (u.uScanColor.value as Color).set(state.scanColor);
  u.uDensity.value = state.density;
  u.uLineWidth.value = state.lineWidth;
  u.uLineStrength.value = state.lineStrength;
  u.uSurfaceOpacity.value = state.surfaceOpacity;
  u.uFresnel.value = state.fresnel;
  u.uScanY.value = state.scanY;
  u.uScanWidth.value = state.scanWidth;
  u.uExposure.value = rig.exposure;

  const dir = u.uKeyDir.value as Vector3;
  dir.set(...rig.keyDir).normalize();
  if (rig.space === "camera" && viewOrientation) {
    dir.applyQuaternion(viewOrientation as never);
  }
};
