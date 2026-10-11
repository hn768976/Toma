import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { linearColor } from "../lib/color";
import { FullscreenPass, makeTarget } from "../lib/post";
import { mulberry32 } from "../lib/random";
import { motionFrame, wrapFrame } from "../lib/loop";
import { FramePipeline } from "../lib/ThreeStage";
import { BoxSpec, LAYOUT, PILE_TOP, TILE } from "./layout";
import { ATLAS_COLS, ATLAS_ROWS, buildDecalAtlas, buildKraft, KRAFT_SPAN } from "./textures";

export interface BoxesPalette {
  haze: string;
  key: string;
  sky: string;
  ground: string;
  floor: string;
}

const LOOP = 600;
const TAU = Math.PI * 2;

const VERT_DECL = /* glsl */ `
attribute vec3 aSize;
attribute vec4 aDecal;
attribute vec4 aDecalRect;
attribute float aVar;
varying vec3 vLocal;
varying vec3 vLocalN;
flat varying vec3 vSize;
flat varying vec4 vDecal;
flat varying vec4 vDecalRect;
flat varying float vVar;
`;
const VERT_BODY = /* glsl */ `
#include <begin_vertex>
vLocal = position;
vLocalN = normal;
vSize = aSize;
vDecal = aDecal;
vDecalRect = aDecalRect;
vVar = aVar;
`;
const FRAG_DECL = /* glsl */ `
uniform sampler2D uKraft;
uniform sampler2D uKraftRough;
uniform sampler2D uDecals;
varying vec3 vLocal;
varying vec3 vLocalN;
flat varying vec3 vSize;
flat varying vec4 vDecal;
flat varying vec4 vDecalRect;
flat varying float vVar;
`;
const FRAG_ALBEDO = /* glsl */ `
vec3 P = vLocal * vSize;
vec3 an = abs(vLocalN);
vec2 fuv; vec2 hs; int face;
if (an.y > an.x && an.y > an.z) { face = vLocalN.y > 0.0 ? 0 : 5; fuv = vec2(P.x, -P.z); hs = vSize.xz * 0.5; }
else if (an.z > an.x) { face = vLocalN.z > 0.0 ? 1 : 2; fuv = P.xy; hs = vSize.xy * 0.5; }
else { face = vLocalN.x > 0.0 ? 3 : 4; fuv = P.zy; hs = vSize.zy * 0.5; }
vec2 kuv = (fuv + vec2(vVar * 7.31, vVar * 3.17)) / ${KRAFT_SPAN.toFixed(1)};
if (face == 0 || face == 5) kuv = kuv.yx; // flutes run along the box length on top
vec3 albedo = texture2D(uKraft, kuv).rgb;
float kRough = texture2D(uKraftRough, kuv).r;
albedo *= mix(vec3(0.80, 0.79, 0.80), vec3(1.10, 1.06, 1.0), vVar);
float vb = fract(vVar * 17.13);
albedo *= mix(vec3(1.0), vec3(1.05, 0.97, 0.88), step(0.75, vb)); // some redder board
albedo *= mix(1.0, 1.08, step(0.9, vb));
albedo = mix(albedo, albedo * vec3(1.18, 1.16, 1.12), step(0.95, fract(vVar * 31.7))); // a few bleached boxes
// Tape strip across the top, running down the two end faces.
float tw = 0.06;
float tapeEdge = smoothstep(tw, tw - 0.004, abs(P.x));
float onTape = 0.0;
if (face == 0) onTape = tapeEdge;
if (face == 1 || face == 2) onTape = tapeEdge * smoothstep(vSize.y * 0.5 - 0.11, vSize.y * 0.5 - 0.106, P.y);
// Flap seam under the tape.
if (face == 0) albedo *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.006, abs(P.x)));
float tapeLine = smoothstep(0.012, 0.0, abs(abs(P.x) - tw + 0.004));
albedo = mix(albedo, albedo * vec3(0.98, 0.92, 0.82) * (1.0 - 0.15 * tapeLine), onTape);
kRough = mix(kRough, 0.2, onTape);
// Edge darkening.
vec2 ed = hs - abs(fuv);
float e = min(ed.x, ed.y);
albedo *= mix(0.78, 1.0, smoothstep(0.0, 0.07, e));
// Decal (label or pictograms) on the top or the +z face.
if (vDecal.x > 0.5 && ((vDecal.z < 0.5 && face == 0) || (vDecal.z > 0.5 && face == 1))) {
  vec2 l = (fuv - vDecalRect.xy) / vDecalRect.zw + 0.5;
  if (l.x > 0.0 && l.x < 1.0 && l.y > 0.0 && l.y < 1.0) {
    float cell = vDecal.y;
    float cx = mod(cell, ${ATLAS_COLS.toFixed(1)});
    float cy = floor(cell / ${ATLAS_COLS.toFixed(1)});
    vec2 auv = vec2((cx + l.x) / ${ATLAS_COLS.toFixed(1)}, 1.0 - (cy + 1.0 - l.y) / ${ATLAS_ROWS.toFixed(1)});
    vec4 dc = texture2D(uDecals, auv);
    albedo = mix(albedo, dc.rgb, dc.a);
    kRough = mix(kRough, 0.6, dc.a);
  }
}
diffuseColor.rgb *= albedo;
`;

const SSAO_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uDepth;
uniform mat4 uProj;
uniform mat4 uInvProj;
uniform vec2 uTexel;
uniform vec3 uKernel[16];
uniform float uRadius;
vec3 viewPos(vec2 uv) {
  float d = texture(uDepth, uv).r;
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return v.xyz / v.w;
}
void main() {
  float d0 = texture(uDepth, vUv).r;
  if (d0 >= 0.99999) { outColor = vec4(1.0); return; }
  vec3 p = viewPos(vUv);
  vec3 pr = viewPos(vUv + vec2(uTexel.x, 0.0)), pl = viewPos(vUv - vec2(uTexel.x, 0.0));
  vec3 pu = viewPos(vUv + vec2(0.0, uTexel.y)), pd = viewPos(vUv - vec2(0.0, uTexel.y));
  vec3 dx = abs(pr.z - p.z) < abs(p.z - pl.z) ? pr - p : p - pl;
  vec3 dy = abs(pu.z - p.z) < abs(p.z - pd.z) ? pu - p : p - pd;
  vec3 n = normalize(cross(dx, dy));
  // Fixed 4x4 interleaved rotation pattern (no temporal component).
  ivec2 ip = ivec2(gl_FragCoord.xy) & 3;
  float ang = float(ip.x * 4 + ip.y) * (6.2831853 / 16.0) + 0.37;
  vec3 rv = normalize(vec3(cos(ang), sin(ang), 0.35));
  float occ = 0.0;
  for (int i = 0; i < 16; i++) {
    vec3 k = reflect(uKernel[i], rv);
    if (dot(k, n) < 0.0) k = -k;
    vec3 s = p + k * uRadius;
    vec4 c = uProj * vec4(s, 1.0);
    vec2 suv = c.xy / c.w * 0.5 + 0.5;
    float sz = viewPos(suv).z;
    float range = smoothstep(0.0, 1.0, uRadius / max(abs(p.z - sz), 1e-4));
    occ += step(s.z + 0.03, sz) * range;
  }
  float ao = pow(1.0 - occ / 16.0, 2.2);
  outColor = vec4(vec3(ao), 1.0);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform sampler2D uAO;
uniform vec2 uAOTexel;
uniform float uAOStrength;
void main() {
  float ao = 0.0;
  for (int i = -1; i <= 2; i++) for (int j = -1; j <= 2; j++)
    ao += texture(uAO, vUv + (vec2(i, j) - 0.5) * uAOTexel).r;
  ao /= 16.0;
  vec3 c = texture(uScene, vUv).rgb;
  outColor = vec4(c * mix(1.0, ao, uAOStrength), 1.0);
}
`;

const DOF_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform float uNear, uFar, uFocus, uPxScale;
uniform vec2 uTexel;
float linZ(vec2 uv) {
  float d = texture(uDepth, uv).r * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - d * (uFar - uNear));
}
float coc(float z) {
  float nearC = clamp((uFocus - z) / (uFocus - 1.2), 0.0, 1.0);
  float farC = clamp((z - uFocus) / 40.0, 0.0, 1.0) * 0.55;
  return max(nearC, farC) * 8.0 * uPxScale; // pixels
}
void main() {
  float c0 = coc(linZ(vUv));
  vec3 acc = texture(uColor, vUv).rgb;
  float wsum = 1.0;
  if (c0 > 0.5) {
    const float GA = 2.39996323;
    for (int i = 1; i < 32; i++) {
      float fi = float(i);
      float r = sqrt(fi / 31.0) * c0;
      vec2 o = vec2(cos(fi * GA), sin(fi * GA)) * r * uTexel;
      float cs = coc(linZ(vUv + o));
      float w = smoothstep(r - 1.0, r + 0.5, max(cs, c0 * 0.6));
      acc += texture(uColor, vUv + o).rgb * w;
      wsum += w;
    }
  }
  outColor = vec4(acc / wsum, 1.0);
}
`;

const BRIGHT_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uColor;
uniform vec2 uTexel;
void main() {
  vec3 c = vec3(0.0);
  for (int i = -1; i <= 2; i++) for (int j = -1; j <= 2; j++)
    c += texture(uColor, vUv + (vec2(i, j) - 0.5) * uTexel).rgb;
  c /= 16.0;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  outColor = vec4(c * smoothstep(0.45, 0.95, l), 1.0);
}
`;
const BLUR_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uDir;
void main() {
  vec3 c = vec3(0.0);
  float ws = 0.0;
  for (int i = -8; i <= 8; i++) {
    float fi = float(i);
    float w = exp(-fi * fi / 24.0);
    c += texture(uTex, vUv + uDir * fi * 1.5).rgb * w;
    ws += w;
  }
  outColor = vec4(c / ws, 1.0);
}
`;
const FINAL_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uColor;
uniform sampler2D uBloom;
uniform float uFrame;
uniform float uAspect;
void main() {
  vec3 c = texture(uColor, vUv).rgb + texture(uBloom, vUv).rgb * 0.8;
  // warm haze glow toward the upper right
  c += vec3(0.20, 0.16, 0.10) * exp(-dot((vUv - vec2(0.8, 1.05)) * vec2(1.6, 2.2), (vUv - vec2(0.8, 1.05)) * vec2(1.6, 2.2)));
  // warm grade
  c *= vec3(1.02, 1.0, 0.97);
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(lum), c, 0.8); // towards pale kraft beige
  c *= vec3(1.0, 1.02, 0.95);
  c = c / (1.0 + 0.12 * c);
  // gentle S-curve for contrast (in log-ish space)
  vec3 l = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
  l = mix(l, l * l * (3.0 - 2.0 * l), 0.35);
  c = pow(l, vec3(2.2));
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  c *= 1.0 - 0.28 * smoothstep(0.35, 1.15, length(q));
  c = linearToSrgb(c);
  c = grainDither(c, gl_FragCoord.xy, uFrame, 0.015);
  outColor = vec4(c, 1.0);
}
`;

const makeBucketMesh = (
  specs: { b: BoxSpec; ox: number; oz: number }[],
  geo: THREE.BufferGeometry,
  material: THREE.Material,
) => {
  const n = specs.length;
  const mesh = new THREE.InstancedMesh(geo, material, n);
  const size = new Float32Array(n * 3);
  const decal = new Float32Array(n * 4);
  const rect = new Float32Array(n * 4);
  const vari = new Float32Array(n);
  const m = new THREE.Matrix4();
  specs.forEach(({ b, ox, oz }, i) => {
    m.compose(new THREE.Vector3(b.pos.x + ox, b.pos.y, b.pos.z + oz), b.quat, b.size);
    mesh.setMatrixAt(i, m);
    size.set([b.size.x, b.size.y, b.size.z], i * 3);
    decal.set([b.decalType, b.decalCell, b.decalFace, 0], i * 4);
    rect.set([b.decalRect.x, b.decalRect.y, b.decalRect.z, b.decalRect.w], i * 4);
    vari[i] = b.variation;
  });
  geo = geo.clone();
  mesh.geometry = geo;
  geo.setAttribute("aSize", new THREE.InstancedBufferAttribute(size, 3));
  geo.setAttribute("aDecal", new THREE.InstancedBufferAttribute(decal, 4));
  geo.setAttribute("aDecalRect", new THREE.InstancedBufferAttribute(rect, 4));
  geo.setAttribute("aVar", new THREE.InstancedBufferAttribute(vari, 1));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
};

export const createBoxesPipeline =
  (pal: BoxesPalette) =>
  (renderer: THREE.WebGLRenderer, bw: number, bh: number): FramePipeline => {
    const aspect = bw / bh;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;

    const scene = new THREE.Scene();
    const haze = linearColor(pal.haze);
    scene.background = haze;
    // Linear fog, fully opaque before the farthest tile row so nothing pops in at the loop.
    scene.fog = new THREE.Fog(haze, 6, 105);

    const kraft = buildKraft();
    const atlas = buildDecalAtlas();
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0 });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uKraft = { value: kraft.color };
      shader.uniforms.uKraftRough = { value: kraft.rough };
      shader.uniforms.uDecals = { value: atlas };
      shader.vertexShader = VERT_DECL + shader.vertexShader.replace("#include <begin_vertex>", VERT_BODY);
      shader.fragmentShader = FRAG_DECL + shader.fragmentShader
        .replace("#include <map_fragment>", FRAG_ALBEDO)
        .replace("#include <roughnessmap_fragment>", "float roughnessFactor = roughness * kRough;");
    };
    material.customProgramCacheKey = () => "kraft-boxes-v1";

    // Size buckets so the bevel radius stays close to constant in world units.
    const xs = [-60, -20, 20];
    const zs = [-160, -120, -80, -40, 0, 40]; // one row behind the start: the key light casts shadows forward
    const buckets: { b: BoxSpec; ox: number; oz: number }[][] = [[], [], []];
    for (const b of LAYOUT) {
      const s = Math.max(b.size.x, b.size.y, b.size.z);
      const k = s < 1.1 ? 0 : s < 1.7 ? 1 : 2;
      for (const ox of xs) for (const oz of zs) buckets[k].push({ b, ox, oz });
    }
    const bucketSize = [0.85, 1.4, 2.05];
    buckets.forEach((specs, k) => {
      const r = 0.022 / bucketSize[k];
      const geo = new RoundedBoxGeometry(1, 1, 1, 2, r);
      scene.add(makeBucketMesh(specs, geo, material));
    });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: linearColor(pal.floor), roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    scene.add(new THREE.HemisphereLight(linearColor(pal.sky), linearColor(pal.ground), 1.6));
    const key = new THREE.DirectionalLight(linearColor(pal.key), 5.6);
    const keyDir = new THREE.Vector3(-0.4, 1, 0.3).normalize();
    // Fixed shadow frustum covering the whole travelled range plus the fogged distance,
    // so every camera position along the loop sees identical shadow coverage.
    key.target.position.set(0, 0, -42);
    key.position.copy(key.target.position).addScaledVector(keyDir, 70);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 8192);
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.up.set(0, 0, -1); // left/right = world x, top/bottom = travel axis z
    sc.left = -26; sc.right = 26; sc.top = 96; sc.bottom = -96; sc.near = 10; sc.far = 150;
    sc.updateProjectionMatrix();
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    scene.add(key, key.target);

    const camera = new THREE.PerspectiveCamera(37, aspect, 0.3, 160);
    const camY = PILE_TOP + 1.25;

    // Render targets.
    const depthTex = new THREE.DepthTexture(bw, bh, THREE.UnsignedIntType);
    const sceneRT = makeTarget(bw, bh, { depthBuffer: true, samples: 4, depthTexture: depthTex });
    const aoRT = makeTarget(bw / 2, bh / 2, { type: THREE.UnsignedByteType });
    const compRT = makeTarget(bw, bh);
    const dofRT = makeTarget(bw, bh);
    const bloomA = makeTarget(bw / 4, bh / 4);
    const bloomB = makeTarget(bw / 4, bh / 4);

    const krng = mulberry32(0x55a0);
    const kernel: THREE.Vector3[] = [];
    for (let i = 0; i < 16; i++) {
      const v = new THREE.Vector3(krng() * 2 - 1, krng() * 2 - 1, krng()).normalize();
      const s = (i + 1) / 16;
      v.multiplyScalar(0.15 + 0.85 * s * s);
      kernel.push(v);
    }
    const ssao = new FullscreenPass(SSAO_FRAG, {
      uDepth: { value: depthTex },
      uProj: { value: camera.projectionMatrix },
      uInvProj: { value: camera.projectionMatrixInverse },
      uTexel: { value: new THREE.Vector2(2 / bw, 2 / bh) },
      uKernel: { value: kernel },
      uRadius: { value: 0.9 },
    });
    const composite = new FullscreenPass(COMPOSITE_FRAG, {
      uScene: { value: sceneRT.texture },
      uAO: { value: aoRT.texture },
      uAOTexel: { value: new THREE.Vector2(2 / bw, 2 / bh) },
      uAOStrength: { value: 1.0 },
    });
    const dof = new FullscreenPass(DOF_FRAG, {
      uColor: { value: compRT.texture },
      uDepth: { value: depthTex },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uFocus: { value: 6 },
      uPxScale: { value: bh / 2160 * 3 },
      uTexel: { value: new THREE.Vector2(1 / bw, 1 / bh) },
    });
    const bright = new FullscreenPass(BRIGHT_FRAG, {
      uColor: { value: dofRT.texture },
      uTexel: { value: new THREE.Vector2(1 / bw, 1 / bh) },
    });
    const blur = new FullscreenPass(BLUR_FRAG, { uTex: { value: null }, uDir: { value: new THREE.Vector2() } });
    const final = new FullscreenPass(FINAL_FRAG, {
      uColor: { value: dofRT.texture },
      uBloom: { value: bloomB.texture },
      uFrame: { value: 0 },
      uAspect: { value: aspect },
    });

    const Z0 = 20;
    return {
      render: (frame) => {
        const f = wrapFrame(frame, LOOP);
        const t = motionFrame(frame, LOOP) / LOOP;
        // Exactly one tile of travel per loop; bob and roll are whole cycles.
        const z = Z0 - TILE * t;
        const bob = 0.06 * Math.sin(TAU * 2 * t);
        const roll = ((1 * Math.PI) / 180) * Math.sin(TAU * t);
        const sway = ((0.8 * Math.PI) / 180) * Math.sin(TAU * t + 1.1);
        camera.position.set(0.35 * Math.sin(TAU * t), camY + bob, z);
        camera.rotation.set(0, 0, 0);
        camera.rotation.order = "YXZ";
        camera.rotation.y = sway;
        camera.rotation.x = (-25 * Math.PI) / 180;
        camera.rotation.z = roll;
        camera.updateMatrixWorld();

        renderer.setRenderTarget(sceneRT);
        renderer.render(scene, camera);
        ssao.render(renderer, aoRT);
        composite.render(renderer, compRT);
        dof.render(renderer, dofRT);
        bright.render(renderer, bloomA);
        blur.uniforms.uTex.value = bloomA.texture;
        blur.uniforms.uDir.value.set(4 / bw, 0);
        blur.render(renderer, bloomB);
        blur.uniforms.uTex.value = bloomB.texture;
        blur.uniforms.uDir.value.set(0, 4 / bh);
        blur.render(renderer, bloomA);
        blur.uniforms.uTex.value = bloomA.texture;
        blur.uniforms.uDir.value.set(4 / bw, 4 / bh).multiplyScalar(0.7);
        blur.render(renderer, bloomB);
        final.uniforms.uFrame.value = f;
        final.render(renderer, null);
      },
    };
  };


