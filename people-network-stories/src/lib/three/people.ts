import * as THREE from "three";
import { HEAD, PICTO_WIDTH, bodyOutline } from "../pictogram";
import { hexToRgb } from "../ease";

// Extruded pictogram: depth 15% of its width, flat-shaded with a darker side face.
const buildGeometry = (female: boolean) => {
  const body = new THREE.Shape(bodyOutline(female).map(([x, y]) => new THREE.Vector2(x, y)));
  const head = new THREE.Shape();
  head.absarc(HEAD.cx, HEAD.cy, HEAD.r, 0, Math.PI * 2, false);
  const depth = PICTO_WIDTH * 0.15;
  const geo = new THREE.ExtrudeGeometry([body, head], { depth, bevelEnabled: false, curveSegments: 14 });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
};

let cached: { male: THREE.BufferGeometry; female: THREE.BufferGeometry } | null = null;
export const pictogramGeometries = () => {
  if (!cached) cached = { male: buildGeometry(false), female: buildGeometry(true) };
  return cached;
};

const VERT = /* glsl */ `
uniform vec3 uFront;
uniform vec3 uSide;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
varying vec3 vCol;
void main() {
  float front = step(0.5, abs(normal.z));
  vec3 base = mix(uSide, uFront, front);
#ifdef USE_INSTANCING_COLOR
  base *= instanceColor;
#endif
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  // Distance fog towards the background (the Big Data horizon).
  vCol = mix(base, uFogColor, smoothstep(uFogNear, uFogFar, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform float uOpacity;
varying vec3 vCol;
void main() {
  gl_FragColor = vec4(vCol, uOpacity);
}`;

export type PeopleOptions = {
  front: string;
  side: string;
  // Fraction of people drawn with the female (dress) pictogram.
  femaleShare?: number;
  transparent?: boolean;
  fog?: { color: string; near: number; far: number };
};

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

// A crowd of up to `count` pictograms as two InstancedMeshes (male and female).
// Per frame: call set() for every visible person, hide() the rest, then commit().
export class People {
  readonly group = new THREE.Group();
  readonly material: THREE.ShaderMaterial;
  private meshes: THREE.InstancedMesh[];
  // person index -> [mesh, slot]
  private slots: Int32Array;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private c = new THREE.Color();
  readonly female: Uint8Array;

  constructor(count: number, isFemale: (i: number) => boolean, opts: PeopleOptions) {
    const geos = pictogramGeometries();
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uFront: { value: new THREE.Vector3(...hexToRgb(opts.front)) },
        uSide: { value: new THREE.Vector3(...hexToRgb(opts.side)) },
        uOpacity: { value: 1 },
        uFogColor: { value: new THREE.Vector3(...hexToRgb(opts.fog?.color ?? "#000000")) },
        uFogNear: { value: opts.fog?.near ?? 1e8 },
        uFogFar: { value: opts.fog?.far ?? 2e8 },
      },
      transparent: !!opts.transparent,
    });
    this.female = new Uint8Array(count);
    let nf = 0;
    for (let i = 0; i < count; i++) {
      this.female[i] = isFemale(i) ? 1 : 0;
      nf += this.female[i];
    }
    const male = new THREE.InstancedMesh(geos.male, this.material, Math.max(1, count - nf));
    const fem = new THREE.InstancedMesh(geos.female, this.material, Math.max(1, nf));
    this.meshes = [male, fem];
    this.slots = new Int32Array(count * 2);
    const next = [0, 0];
    for (let i = 0; i < count; i++) {
      const g = this.female[i];
      this.slots[i * 2] = g;
      this.slots[i * 2 + 1] = next[g]++;
    }
    for (const mesh of this.meshes) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(mesh.count * 3).fill(1), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      for (let k = 0; k < mesh.count; k++) mesh.setMatrixAt(k, HIDDEN);
      this.group.add(mesh);
    }
  }

  // Feet at (x, y, z), `height` in world units, rotation about the vertical axis.
  set(i: number, x: number, y: number, z: number, height: number, bright = 1, rotY = 0) {
    const mesh = this.meshes[this.slots[i * 2]];
    const k = this.slots[i * 2 + 1];
    const sc = height / 1.26;
    this.e.set(0, rotY, 0);
    this.q.setFromEuler(this.e);
    this.m.compose(this.v.set(x, y, z), this.q, this.s.set(sc, sc, sc));
    mesh.setMatrixAt(k, this.m);
    mesh.setColorAt(k, this.c.setRGB(bright, bright, bright));
  }

  setFront(hex: string, side: string) {
    this.material.uniforms.uFront.value.set(...hexToRgb(hex));
    this.material.uniforms.uSide.value.set(...hexToRgb(side));
  }

  setTint(i: number, r: number, g: number, b: number) {
    const mesh = this.meshes[this.slots[i * 2]];
    mesh.setColorAt(this.slots[i * 2 + 1], this.c.setRGB(r, g, b));
  }

  hide(i: number) {
    const mesh = this.meshes[this.slots[i * 2]];
    mesh.setMatrixAt(this.slots[i * 2 + 1], HIDDEN);
  }

  commit() {
    for (const mesh of this.meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}
