import * as THREE from "three";

// Camera-facing '0' / '1' glyphs (binary strings), instanced, world-sized.
// The atlas is drawn once with the (already loaded) mono font.

const VERT = /* glsl */ `
attribute vec3 aPos;
attribute float aGlyph;
attribute float aAlpha;
uniform float uSize;
uniform float uFogNear;
uniform float uFogFar;
varying vec2 vUv;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  if (aAlpha <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  mv.xy += position.xy * vec2(0.62, 1.0) * uSize;
  gl_Position = projectionMatrix * mv;
  vUv = vec2((position.x * 0.5 + 0.5 + aGlyph) * 0.5, position.y * 0.5 + 0.5);
  vA = aAlpha * (1.0 - smoothstep(uFogNear, uFogFar, -mv.z));
}`;

const FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec3 uColor;
varying vec2 vUv;
varying float vA;
void main() {
  float a = texture2D(uAtlas, vUv).a * vA;
  if (a <= 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}`;

export class Glyphs {
  readonly mesh: THREE.Mesh;
  readonly pos: Float32Array;
  readonly glyph: Float32Array;
  readonly alpha: Float32Array;
  private attrs: THREE.InstancedBufferAttribute[];

  constructor(readonly count: number, fontFamily: string, color: string, size: number, fog: { near: number; far: number }) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 160;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `300 128px "${fontFamily}"`;
    ctx.fillText("0", 64, 84);
    ctx.fillText("1", 192, 84);
    const tex = new THREE.CanvasTexture(c);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 4;
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.pos = new Float32Array(count * 3);
    this.glyph = new Float32Array(count);
    this.alpha = new Float32Array(count);
    const mk = (a: Float32Array, n: number) => {
      const at = new THREE.InstancedBufferAttribute(a, n);
      at.setUsage(THREE.DynamicDrawUsage);
      return at;
    };
    this.attrs = [mk(this.pos, 3), mk(this.glyph, 1), mk(this.alpha, 1)];
    geo.setAttribute("aPos", this.attrs[0]);
    geo.setAttribute("aGlyph", this.attrs[1]);
    geo.setAttribute("aAlpha", this.attrs[2]);
    geo.instanceCount = count;
    const col = new THREE.Color(color);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uAtlas: { value: tex },
        uColor: { value: new THREE.Vector3(col.r, col.g, col.b) },
        uSize: { value: size },
        uFogNear: { value: fog.near },
        uFogFar: { value: fog.far },
      },
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
  }

  commit() {
    for (const a of this.attrs) a.needsUpdate = true;
  }
}
