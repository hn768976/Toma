// A generic modern phone (original design, no logos): graphite frame,
// thin black bezel, round punch-hole camera, flat screen plane.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { hexToLinear } from "../../lib/color";

export const PHONE = { w: 9.4, h: 19.6, d: 0.95, r: 1.35, bezel: 0.32 };

const roundedRect = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ShapeGeometry(s, 12);
};

export const makePhone = (c: { frame: string; glass: string }, screenMat: THREE.Material) => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(PHONE.w, PHONE.h, PHONE.d, 6, PHONE.r * 0.5),
    new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uCol: { value: new THREE.Vector3(...hexToLinear(c.frame)) } },
      vertexShader: /* glsl */ `
precision highp float;
in vec3 position;
in vec3 normal;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
out vec3 vN;
out vec3 vV;
void main() {
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: /* glsl */ `
precision highp float;
uniform vec3 uCol;
in vec3 vN;
in vec3 vV;
out vec4 outColor;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vV);
  vec3 L = normalize(vec3(-0.5, 0.8, 0.5));
  float diff = max(dot(N, L), 0.0);
  float spec = pow(max(dot(N, normalize(L + V)), 0.0), 60.0);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.0);
  outColor = vec4(uCol * (0.45 + 0.8 * diff) + vec3(0.35) * spec + uCol * rim * 0.8, 1.0);
}`,
    }),
  );
  g.add(body);
  const glass = new THREE.Mesh(
    roundedRect(PHONE.w - 0.3, PHONE.h - 0.3, PHONE.r - 0.15),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(c.glass) }),
  );
  glass.position.z = PHONE.d / 2 + 0.01;
  g.add(glass);
  const sw = PHONE.w - 0.3 - 2 * PHONE.bezel;
  const sh = PHONE.h - 0.3 - 2 * PHONE.bezel;
  const screenGeo = roundedRect(sw, sh, PHONE.r - 0.4);
  // UV over the screen rectangle: (0,0) bottom-left, (1,1) top-right.
  const p = screenGeo.getAttribute("position");
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[2 * i] = p.getX(i) / sw + 0.5;
    uv[2 * i + 1] = p.getY(i) / sh + 0.5;
  }
  screenGeo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.z = PHONE.d / 2 + 0.02;
  g.add(screen);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.28, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  hole.position.set(0, sh / 2 - 0.75, PHONE.d / 2 + 0.03);
  g.add(hole);
  for (const m of g.children) m.frustumCulled = false;
  return { group: g, screenSize: [sw, sh] as const };
};
