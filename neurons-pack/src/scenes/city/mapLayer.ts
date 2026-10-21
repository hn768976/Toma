import * as THREE from "three";
import { hexToLinear } from "../../lib/color";
import { CLS, MAP_HALF, Palette, cityMap } from "./cityMap";

const ORDER: (keyof Palette)[] = ["block", "lot", "streetMinor", "streetSmall", "streetMid", "streetMajor", "highway", "river", "park"];

export type Fog = { near: number; far: number };

/** Ground map: block plane, fills, streets and (night) street glow. */
export const makeMapLayer = (palette: Palette, night: boolean, fog: Fog) => {
  const map = cityMap();
  const pal = ORDER.map((k) => new THREE.Vector3(...hexToLinear(palette[k])));
  const haze = new THREE.Vector3(...hexToLinear(palette.haze));
  const uniforms = {
    uPal: { value: pal },
    uHaze: { value: haze },
    uCam: { value: new THREE.Vector3() },
    uFog: { value: new THREE.Vector2(fog.near, fog.far) },
  };
  const vert = /* glsl */ `
precision highp float;
in vec3 position;
in float aCls;
in float aSide;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 modelMatrix;
out vec3 vWorld;
out float vCls;
out float vSide;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vCls = aCls;
  vSide = aSide;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
  const fogGlsl = /* glsl */ `
float fogAmt(vec3 w) {
  float d = length(w - uCam);
  float f = smoothstep(uFog.x, uFog.y, d);
  return f * f * (3.0 - 2.0 * f);
}`;
  const solid = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: vert,
    fragmentShader: /* glsl */ `
precision highp float;
uniform vec3 uPal[9];
uniform vec3 uHaze;
uniform vec3 uCam;
uniform vec2 uFog;
in vec3 vWorld;
in float vCls;
in float vSide;
out vec4 outColor;
${fogGlsl}
void main() {
  int c = int(vCls + 0.5);
  vec3 col = uPal[c];
  outColor = vec4(mix(col, uHaze, fogAmt(vWorld)), 1.0);
}`,
  });
  const glowMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: vert,
    fragmentShader: /* glsl */ `
precision highp float;
uniform vec3 uPal[9];
uniform vec3 uHaze;
uniform vec3 uCam;
uniform vec2 uFog;
in vec3 vWorld;
in float vCls;
in float vSide;
out vec4 outColor;
${fogGlsl}
void main() {
  int c = int(vCls + 0.5);
  float k = c == ${CLS.highway} ? 0.55 : c == ${CLS.major} ? 0.42 : c == ${CLS.mid} ? 0.32 : c == ${CLS.small} ? 0.2 : 0.08;
  float e = 1.0 - abs(vSide);
  float g = e * e * k * (1.0 - fogAmt(vWorld) * 0.85);
  outColor = vec4(uPal[c] * g, 0.0);
}`,
  });
  const group = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP_HALF * 6, MAP_HALF * 6).rotateX(-Math.PI / 2), solid);
  const groundCls = new Float32Array(ground.geometry.getAttribute("position").count).fill(CLS.block);
  ground.geometry.setAttribute("aCls", new THREE.BufferAttribute(groundCls, 1));
  ground.geometry.setAttribute("aSide", new THREE.BufferAttribute(new Float32Array(groundCls.length), 1));
  const layers: THREE.Mesh[] = [ground, new THREE.Mesh(map.fills, solid)];
  if (night) layers.push(new THREE.Mesh(map.glow, glowMat));
  layers.push(new THREE.Mesh(map.streets, solid));
  layers.forEach((m, i) => {
    m.renderOrder = -100 + i;
    m.frustumCulled = false;
    group.add(m);
  });
  return {
    group,
    update: (camPos: THREE.Vector3) => {
      uniforms.uCam.value.copy(camPos);
    },
    fogAmount: (p: THREE.Vector3) => {
      const d = p.distanceTo(uniforms.uCam.value);
      const f = Math.min(1, Math.max(0, (d - fog.near) / (fog.far - fog.near)));
      const s = f * f * (3 - 2 * f);
      return s * s * (3 - 2 * s);
    },
  };
};
