import { useMemo } from "react";
import * as THREE from "three";
import { getSpriteAtlas } from "../lib/atlas";

/**
 * One instanced, camera-facing quad type, shared by every glowing element:
 * atmosphere particles, node badges and their glyphs, node and core glows, the
 * volumetric haze, the travelling trace pulses and the card's pin lights.
 *
 * Billboarding happens in the vertex shader (the quad is expanded in view
 * space), so nothing here depends on the camera on the CPU and sizes stay in
 * world units — the 1080p preview and the 4K render frame identically.
 *
 * Additive blending against an opaque background is what stands in for a bloom
 * pass: the atlas's glow cell carries a long, soft falloff, so the hot elements
 * bloom and the circuit plane below stays crisp.
 */
export type SpriteBuffers = {
  count: number;
  /** 3 floats per instance */
  center: Float32Array;
  /** 1 float per instance, world units */
  size: Float32Array;
  /** 4 floats per instance: uv offset xy, uv scale zw */
  uv: Float32Array;
  /** 3 floats per instance */
  color: Float32Array;
  /** 1 float per instance */
  alpha: Float32Array;
  /** 1 float per instance, radians; optional */
  rotation?: Float32Array;
};

export const allocSprites = (capacity: number): SpriteBuffers => ({
  count: 0,
  center: new Float32Array(capacity * 3),
  size: new Float32Array(capacity),
  uv: new Float32Array(capacity * 4),
  color: new Float32Array(capacity * 3),
  alpha: new Float32Array(capacity),
  rotation: new Float32Array(capacity),
});

const VERT = /* glsl */ `
attribute vec3 aCenter;
attribute float aSize;
attribute vec4 aUv;
attribute vec3 aColor;
attribute float aAlpha;
attribute float aRot;

varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vUv = aUv.xy + uv * aUv.zw;
  vColor = aColor;
  vAlpha = aAlpha;

  float c = cos(aRot);
  float s = sin(aRot);
  vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * aSize;

  vec4 mv = modelViewMatrix * vec4(aCenter, 1.0);
  mv.xy += p;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;

varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 t = texture2D(uMap, vUv);
  // Premultiplied output, paired with a plain one/one blend: pure additive.
  gl_FragColor = vec4(vColor * t.rgb * t.a * vAlpha, t.a * vAlpha);
}
`;

export const InstancedSprites: React.FC<{
  buffers: SpriteBuffers;
  capacity: number;
  renderOrder?: number;
}> = ({ buffers, capacity, renderOrder = 0 }) => {
  const mesh = useMemo(() => {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.getAttribute("position"));
    geo.setAttribute("uv", base.getAttribute("uv"));
    base.dispose();

    geo.setAttribute("aCenter", new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3));
    geo.setAttribute("aSize", new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1));
    geo.setAttribute("aUv", new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4));
    geo.setAttribute("aColor", new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3));
    geo.setAttribute("aAlpha", new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1));
    geo.setAttribute("aRot", new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uMap: { value: getSpriteAtlas() } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquation: THREE.AddEquation,
      toneMapped: false,
    });

    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    return m;
  }, [capacity]);

  // Frame state is a pure function of the frame, so copying it in during render
  // is safe and keeps the geometry itself allocated once.
  const geo = mesh.geometry as THREE.InstancedBufferGeometry;
  const put = (name: string, src: Float32Array) => {
    const attr = geo.getAttribute(name) as THREE.InstancedBufferAttribute;
    (attr.array as Float32Array).set(src.subarray(0, attr.itemSize * buffers.count));
    attr.needsUpdate = true;
  };
  put("aCenter", buffers.center);
  put("aSize", buffers.size);
  put("aUv", buffers.uv);
  put("aColor", buffers.color);
  put("aAlpha", buffers.alpha);
  if (buffers.rotation) put("aRot", buffers.rotation);
  geo.instanceCount = buffers.count;
  mesh.renderOrder = renderOrder;

  return <primitive object={mesh} />;
};

/** Small helper for filling the buffers without index arithmetic at call sites. */
export class SpriteWriter {
  private i = 0;
  constructor(private readonly b: SpriteBuffers) {}

  push(
    x: number,
    y: number,
    z: number,
    size: number,
    uv: readonly [number, number, number, number],
    color: readonly [number, number, number],
    alpha: number,
    rotation = 0,
  ) {
    if (alpha <= 0.0008 || size <= 0) return;
    const i = this.i;
    this.b.center[i * 3] = x;
    this.b.center[i * 3 + 1] = y;
    this.b.center[i * 3 + 2] = z;
    this.b.size[i] = size;
    this.b.uv[i * 4] = uv[0];
    this.b.uv[i * 4 + 1] = uv[1];
    this.b.uv[i * 4 + 2] = uv[2];
    this.b.uv[i * 4 + 3] = uv[3];
    this.b.color[i * 3] = color[0];
    this.b.color[i * 3 + 1] = color[1];
    this.b.color[i * 3 + 2] = color[2];
    this.b.alpha[i] = alpha;
    if (this.b.rotation) this.b.rotation[i] = rotation;
    this.i += 1;
  }

  done() {
    this.b.count = this.i;
    return this.b;
  }
}
