import * as THREE from "three";

// Instanced glowing capsules defined by two world points (tail → head) and a
// world-space radius. Opaque (writes depth, so depth of field treats them
// correctly); per-instance values are set from the frame each update.
const VERT = /* glsl */ `
attribute vec2 corner;
attribute vec3 iHead;
attribute vec3 iTail;
attribute vec2 iRad;      // radius (world), intensity
attribute vec3 iColor;
uniform vec2 uRes;
varying vec2 vP;          // px relative to the tail
varying vec2 vAxis;       // px of head relative to tail
varying float vR;
varying vec3 vCol;
void main() {
  vec4 cH = projectionMatrix * modelViewMatrix * vec4(iHead, 1.0);
  vec4 cT = projectionMatrix * modelViewMatrix * vec4(iTail, 1.0);
  vec2 sH = cH.xy / cH.w * 0.5 * uRes;
  vec2 sT = cT.xy / cT.w * 0.5 * uRes;
  float rH = iRad.x * projectionMatrix[1][1] * 0.5 * uRes.y / cH.w;
  float rT = iRad.x * projectionMatrix[1][1] * 0.5 * uRes.y / cT.w;
  float r = max(max(rH, rT), 0.75);
  vec2 d = sH - sT;
  float len = length(d);
  vec2 ax = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 pe = vec2(-ax.y, ax.x);
  vec2 p = mix(sT - ax * r, sH + ax * r, corner.x) + pe * corner.y * r;
  vP = p - sT;
  vAxis = d;
  vR = r;
  vCol = iColor * iRad.y;
  vec4 c = mix(cT, cH, corner.x);
  gl_Position = vec4(p / (0.5 * uRes) * c.w, c.z, c.w);
  if (iRad.y <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;
const FRAG = /* glsl */ `
varying vec2 vP;
varying vec2 vAxis;
varying float vR;
varying vec3 vCol;
void main() {
  float l2 = dot(vAxis, vAxis);
  float h = l2 > 1e-6 ? clamp(dot(vP, vAxis) / l2, 0.0, 1.0) : 0.0;
  float dist = length(vP - vAxis * h) / vR;
  if (dist > 1.0) discard;
  float core = 1.0 - dist * dist;
  gl_FragColor = vec4(vCol * (0.55 + 0.45 * core), 1.0);
}
`;

export class Capsules {
  mesh: THREE.Mesh;
  head: THREE.InstancedBufferAttribute;
  tail: THREE.InstancedBufferAttribute;
  rad: THREE.InstancedBufferAttribute;
  color: THREE.InstancedBufferAttribute;
  material: THREE.ShaderMaterial;
  constructor(count: number, w: number, h: number) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
    g.setAttribute("corner", new THREE.Float32BufferAttribute([0, -1, 1, -1, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.head = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.tail = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.rad = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    g.setAttribute("iHead", this.head);
    g.setAttribute("iTail", this.tail);
    g.setAttribute("iRad", this.rad);
    g.setAttribute("iColor", this.color);
    g.instanceCount = count;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uRes: { value: new THREE.Vector2(w, h) } },
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
  }
  set(i: number, head: THREE.Vector3, tail: THREE.Vector3, radius: number, intensity: number, color: THREE.Color) {
    this.head.setXYZ(i, head.x, head.y, head.z);
    this.tail.setXYZ(i, tail.x, tail.y, tail.z);
    this.rad.setXY(i, radius, intensity);
    this.color.setXYZ(i, color.r, color.g, color.b);
  }
  commit() {
    this.head.needsUpdate = true;
    this.tail.needsUpdate = true;
    this.rad.needsUpdate = true;
    this.color.needsUpdate = true;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
