import * as THREE from 'three';
import {defaultPostParams, PostPipeline} from '../three/Post';
import type {SceneController} from '../three/ThreeStage';
import type {Polygon} from '../lib/geo';
import {clamp, easeInOut} from '../lib/anim';
import {buildCoinGeometry, buildEmblemNormalMap, buildRoughnessMap, COIN_R, COIN_T, METALS, Metal} from './coinAssets';
import {CoinSpec, pileLayout, silverLayout, stairsLayout} from './layouts';
import {LH, LW, Overlay} from './overlays';
import type {CoinVersion} from './versions';

export const DURATION = 450;
const GROW_START = 30;
const GROW_END = 330;
const FALL = 7; // frames a stacking coin takes to drop onto its stack
const DROP = 2.4; // cm above its rest position
const SETTLE = 14;

export type RainData = {frames: number; coins: number; floats: number; data: Float32Array};

// --- tone-mapping helpers: set colours are given in display sRGB; invert the
// final pass's Khronos Neutral curve so the backdrop lands on those values.
const neutral = (x: number) => {
  const start = 0.8 - 0.04;
  const off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  const c = x - off;
  if (c < start) return c;
  const d = 1 - start;
  return 1 - (d * d) / (c + d - start);
};
const invNeutral = (y: number) => {
  let lo = 0;
  let hi = 16;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (neutral(m) < y) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
};
const sceneColor = (hex: string, exposure: number) => {
  const c = new THREE.Color(hex); // three converts hex (sRGB) to linear
  return new THREE.Color(invNeutral(c.r) / exposure, invNeutral(c.g) / exposure, invNeutral(c.b) / exposure);
};

const FLOOR_VERT = /* glsl */ `
uniform mat4 reflMatrix;
uniform mat4 reflView;
varying vec3 vWorld;
varying vec4 vReflCoord;
varying float vReflZ;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vReflCoord = reflMatrix * wp;
  vReflZ = -(reflView * wp).z;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const FLOOR_FRAG = /* glsl */ `
uniform sampler2D tRefl;
uniform sampler2D tReflDepth;
uniform vec2 reflTexel;
uniform float reflNear, reflFar, camHeight, reflectivity, fadeHeight, blurPerCm;
uniform vec3 nearColor, farColor;
uniform vec3 camPos;
uniform float nearDist, farDist;
varying vec3 vWorld;
varying vec4 vReflCoord;
varying float vReflZ;
float viewZ(float d) {
  float ndc = d * 2.0 - 1.0;
  return (2.0 * reflNear * reflFar) / (reflFar + reflNear - ndc * (reflFar - reflNear));
}
void main() {
  float dist = length(vWorld.xz - camPos.xz);
  vec3 base = mix(nearColor, farColor, smoothstep(nearDist, farDist, dist));
  vec2 ruv = vReflCoord.xy / vReflCoord.w;
  // height of the reflected point above the table (see CoinScene notes)
  float zq = viewZ(texture2D(tReflDepth, ruv).r);
  float h = max(0.0, (zq / vReflZ - 1.0) * camHeight);
  float r = clamp(h * blurPerCm, 0.0, 12.0);
  vec4 refl = texture2D(tRefl, ruv) * 0.25;
  refl += texture2D(tRefl, ruv + reflTexel * vec2(r, 0.0)) * 0.125;
  refl += texture2D(tRefl, ruv - reflTexel * vec2(r, 0.0)) * 0.125;
  refl += texture2D(tRefl, ruv + reflTexel * vec2(0.0, r)) * 0.125;
  refl += texture2D(tRefl, ruv - reflTexel * vec2(0.0, r)) * 0.125;
  refl += texture2D(tRefl, ruv + reflTexel * vec2(r, r) * 0.7) * 0.0625;
  refl += texture2D(tRefl, ruv + reflTexel * vec2(-r, r) * 0.7) * 0.0625;
  refl += texture2D(tRefl, ruv + reflTexel * vec2(r, -r) * 0.7) * 0.0625;
  refl += texture2D(tRefl, ruv + reflTexel * vec2(-r, -r) * 0.7) * 0.0625;
  float fade = exp(-h / fadeHeight);
  vec3 col = mix(base, refl.rgb / max(refl.a, 1e-3), clamp(refl.a, 0.0, 1.0) * fade * reflectivity);
  gl_FragColor = vec4(col, 1.0);
}
`;
const WALL_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const WALL_FRAG = /* glsl */ `
uniform vec3 topColor, bottomColor;
uniform float topY;
varying vec3 vWorld;
void main() {
  float t = smoothstep(0.0, topY, vWorld.y);
  gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
}
`;
const SHADOW_VERT = /* glsl */ `
attribute float shadowAlpha;
varying vec2 vUv;
varying float vA;
void main() {
  vUv = uv;
  vA = shadowAlpha;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}
`;
const SHADOW_FRAG = /* glsl */ `
varying vec2 vUv;
varying float vA;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.35, 1.0, r)) * vA;
  a += (1.0 - smoothstep(0.0, 0.62, r)) * vA * 0.6; // contact core
  gl_FragColor = vec4(0.0, 0.0, 0.0, clamp(a, 0.0, 1.0));
}
`;

// Adds a per-instance opacity to a lit material (for coins fading in as they drop).
const withInstanceOpacity = (m: THREE.MeshPhysicalMaterial) => {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instanceOpacity;\nvarying float vInstOpacity;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstOpacity = instanceOpacity;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vInstOpacity;')
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= vInstOpacity;');
  };
  m.customProgramCacheKey = () => 'instOpacity';
  return m;
};

type CoinState = {pos: THREE.Vector3; quat: THREE.Quaternion; alpha: number; visible: boolean};

export class CoinScene implements SceneController {
  private v: CoinVersion;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private reflCam: THREE.PerspectiveCamera;
  private reflRT: THREE.WebGLRenderTarget;
  private floorMat: THREE.ShaderMaterial;
  private solid: THREE.InstancedMesh;
  private fading: THREE.InstancedMesh;
  private fadeOpacity: THREE.InstancedBufferAttribute;
  private shadows: THREE.InstancedMesh;
  private shadowAlpha: THREE.InstancedBufferAttribute;
  private specs: CoinSpec[] = [];
  private rain: RainData | null;
  private overlay: Overlay | null = null;
  private overlayTex: THREE.CanvasTexture | null = null;
  private post = defaultPostParams();
  private clear = new THREE.Color(0, 0, 0);
  private anchorsWorld: THREE.Vector3[] = [];
  private metalColors: Record<Metal, THREE.Color>;
  private count: number;

  constructor(gl: THREE.WebGLRenderer, width: number, height: number, v: CoinVersion, env: THREE.Texture, rain: RainData | null, land: Polygon[] | null) {
    this.v = v;
    this.rain = v.layout === 'rain' ? rain : null;
    this.camera = new THREE.PerspectiveCamera(v.camera.fov, width / height, 0.5, 400);
    this.camera.layers.enable(1);
    this.reflCam = new THREE.PerspectiveCamera(v.camera.fov, width / height, 0.5, 400);
    this.reflCam.layers.set(0);

    // Environment (CC0 studio HDRI) prefiltered for PBR.
    const pmrem = new THREE.PMREMGenerator(gl);
    env.mapping = THREE.EquirectangularReflectionMapping;
    this.scene.environment = pmrem.fromEquirectangular(env).texture;
    pmrem.dispose();
    this.scene.environmentIntensity = v.envIntensity;
    this.scene.environmentRotation.set(0, v.envRotation, 0);

    const key = new THREE.DirectionalLight(0xffffff, v.key);
    key.position.set(-6, 9, 7);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, v.key * 0.25);
    fill.position.set(7, 4, 5);
    this.scene.add(fill);

    // Coins
    const geo = buildCoinGeometry();
    const normalMap = buildEmblemNormalMap();
    const rough = buildRoughnessMap();
    const mk = (face: boolean, fadeIn: boolean) => {
      const m = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 1,
        roughness: 0.22,
        roughnessMap: rough,
        normalMap: face ? normalMap : null,
        normalScale: new THREE.Vector2(0.9, 0.9),
        transparent: fadeIn,
      });
      return fadeIn ? withInstanceOpacity(m) : m;
    };
    if (this.rain) this.specs = [];
    else if (v.layout === 'stairs') this.specs = stairsLayout(v.seed);
    else if (v.layout === 'pile') this.specs = pileLayout(v.seed, false);
    else if (v.layout === 'pileMixed') this.specs = pileLayout(v.seed, true);
    else this.specs = silverLayout(v.seed);
    this.count = this.rain ? this.rain.coins : this.specs.length;

    const tint = new THREE.Color(v.metalTint);
    this.metalColors = {
      gold: new THREE.Color(METALS.gold).multiply(tint),
      silver: new THREE.Color(METALS.silver).multiply(tint),
      copper: new THREE.Color(METALS.copper).multiply(tint),
    };
    this.solid = new THREE.InstancedMesh(geo, [mk(true, false), mk(false, false)], this.count);
    this.fading = new THREE.InstancedMesh(geo, [mk(true, true), mk(false, true)], this.count);
    this.fadeOpacity = new THREE.InstancedBufferAttribute(new Float32Array(this.count), 1);
    this.fading.geometry = geo.clone();
    this.fading.geometry.setAttribute('instanceOpacity', this.fadeOpacity);
    for (const m of [this.solid, this.fading]) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < this.count; i++) m.setColorAt(i, this.metalColors.gold);
      this.scene.add(m);
    }
    this.fading.renderOrder = 2;

    // Contact shadows: soft blobs on the table under coins near it.
    const sGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.shadowAlpha = new THREE.InstancedBufferAttribute(new Float32Array(this.count), 1);
    sGeo.setAttribute('shadowAlpha', this.shadowAlpha);
    const sMat = new THREE.ShaderMaterial({
      vertexShader: SHADOW_VERT,
      fragmentShader: SHADOW_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.shadows = new THREE.InstancedMesh(sGeo, sMat, this.count);
    this.shadows.frustumCulled = false;
    this.shadows.layers.set(1);
    this.shadows.renderOrder = 1;
    this.scene.add(this.shadows);

    // Table and backdrop
    const hw = Math.max(1, Math.round(width / 2));
    const hh = Math.max(1, Math.round(height / 2));
    this.reflRT = new THREE.WebGLRenderTarget(hw, hh, {type: THREE.HalfFloatType, samples: 0});
    this.reflRT.depthTexture = new THREE.DepthTexture(hw, hh);
    this.reflRT.depthTexture.type = THREE.FloatType;
    this.floorMat = new THREE.ShaderMaterial({
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      uniforms: {
        tRefl: {value: this.reflRT.texture},
        tReflDepth: {value: this.reflRT.depthTexture},
        reflTexel: {value: new THREE.Vector2(1 / hw, 1 / hh)},
        reflMatrix: {value: new THREE.Matrix4()},
        reflView: {value: new THREE.Matrix4()},
        reflNear: {value: 0.5},
        reflFar: {value: 400},
        camHeight: {value: 3},
        reflectivity: {value: v.reflectivity},
        fadeHeight: {value: 7},
        blurPerCm: {value: (0.25 * hh) / 360},
        nearColor: {value: sceneColor(v.table[0], v.exposure)},
        farColor: {value: sceneColor(v.table[1], v.exposure)},
        camPos: {value: new THREE.Vector3()},
        nearDist: {value: 18},
        farDist: {value: 95},
      },
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 260).rotateX(-Math.PI / 2), this.floorMat);
    floor.position.set(0, 0, -90);
    floor.layers.set(1);
    this.scene.add(floor);
    const wallMat = new THREE.ShaderMaterial({
      vertexShader: WALL_VERT,
      fragmentShader: WALL_FRAG,
      uniforms: {
        topColor: {value: sceneColor(v.wall[0], v.exposure)},
        bottomColor: {value: sceneColor(v.wall[1], v.exposure)},
        topY: {value: 45},
      },
    });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(600, 300), wallMat);
    wall.position.set(0, 140, -220);
    wall.layers.set(1);
    this.scene.add(wall);

    // Overlay chart anchors: tops of the finished stacks, left to right.
    if (!this.rain) {
      const tops = new Map<number, THREE.Vector3>();
      for (const s of this.specs) {
        if (s.stack < 0) continue;
        const top = s.pos.clone().add(new THREE.Vector3(0, COIN_T / 2, 0));
        const prev = tops.get(s.stack);
        if (!prev || prev.y < top.y) tops.set(s.stack, top);
      }
      this.anchorsWorld = [...tops.values()].sort((a, b) => a.x - b.x);
    }
    if (v.overlay) {
      this.overlay = new Overlay(v.overlay, width, height, land);
      this.overlayTex = new THREE.CanvasTexture(this.overlay.canvas);
      this.overlayTex.colorSpace = THREE.NoColorSpace;
      this.overlayTex.generateMipmaps = false;
      this.overlayTex.minFilter = THREE.LinearFilter;
    }

    const p = this.post;
    p.dof = true;
    p.aperture = v.aperture;
    p.maxBlur = v.maxBlur;
    p.nearScale = 1;
    p.bloomStrength = v.bloom;
    p.bloomThreshold = 1.2;
    p.bloomRadius = 0.6;
    p.exposure = v.exposure;
    p.toneMap = 'neutral';
    p.vignette = 0.1;
    p.topLight = 0;
    p.grain = 0.01;
    p.tint.setRGB(...v.tint);
    p.saturation = v.saturation;
    p.overlay = this.overlayTex;
    p.overlayStrength = v.overlayStrength;
    p.overlayProtect = v.overlayProtect;
  }

  private placeCamera(f: number) {
    const c = this.v.camera;
    const grow = easeInOut(clamp(f / GROW_END));
    const hold = easeInOut(clamp((f - GROW_END) / (DURATION - GROW_END)));
    const pos = new THREE.Vector3(...c.pos)
      .add(new THREE.Vector3(...c.dolly).multiplyScalar(grow))
      .add(new THREE.Vector3(...c.drift).multiplyScalar(hold));
    const target = new THREE.Vector3(...c.target).add(new THREE.Vector3(...c.dolly).multiplyScalar(grow * 0.5));
    this.camera.position.copy(pos);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
    // Mirror camera for the planar reflection (table plane y = 0).
    this.reflCam.position.set(pos.x, -pos.y, pos.z);
    this.reflCam.up.set(0, -1, 0);
    this.reflCam.lookAt(target.x, -target.y, target.z);
    this.reflCam.updateMatrixWorld();
    this.reflCam.updateProjectionMatrix();
    return pos.distanceTo(new THREE.Vector3(...c.focus));
  }

  private coinState(s: CoinSpec, f: number, out: CoinState) {
    if (f < s.land - FALL) {
      out.visible = false;
      return;
    }
    out.visible = true;
    if (f < s.land) {
      const u = (f - (s.land - FALL)) / FALL;
      out.pos.copy(s.pos);
      out.pos.y += DROP * (1 - u * u);
      out.alpha = clamp(u / 0.55);
      out.quat.setFromAxisAngle(s.wobbleAxis, 0.16 * (1 - u)).multiply(s.quat);
      return;
    }
    const dt = f - s.land;
    out.alpha = 1;
    out.pos.copy(s.pos);
    if (dt < SETTLE) {
      const w = 0.055 * Math.exp(-dt / 2.4) * Math.cos(dt * 1.9);
      out.pos.y += 0.035 * Math.exp(-dt / 1.6) * Math.abs(Math.sin(dt * 1.7));
      out.quat.setFromAxisAngle(s.wobbleAxis, w).multiply(s.quat);
    } else out.quat.copy(s.quat);
  }

  render(frame: number, pipeline: PostPipeline) {
    const f = clamp(frame, 0, DURATION - 1);
    const focus = this.placeCamera(f);

    const st: CoinState = {pos: new THREE.Vector3(), quat: new THREE.Quaternion(), alpha: 1, visible: false};
    const m = new THREE.Matrix4();
    const one = new THREE.Vector3(1, 1, 1);
    let nSolid = 0;
    let nFade = 0;
    let nShadow = 0;
    const addShadow = (x: number, z: number, height: number, scale: number) => {
      const a = 0.3 * Math.exp(-height / 1.2);
      if (a < 0.01) return;
      m.compose(new THREE.Vector3(x, 0.003, z), new THREE.Quaternion(), new THREE.Vector3(COIN_R * 2.05 * scale, 1, COIN_R * 2.05 * scale));
      this.shadows.setMatrixAt(nShadow, m);
      this.shadowAlpha.setX(nShadow, a);
      nShadow++;
    };

    if (this.rain) {
      const {coins, floats, data} = this.rain;
      const fi = Math.min(this.rain.frames - 1, f);
      for (let i = 0; i < coins; i++) {
        const o = (fi * coins + i) * floats;
        if (data[o + 7] < 0.5) continue;
        st.pos.set(data[o], data[o + 1], data[o + 2]);
        st.quat.set(data[o + 3], data[o + 4], data[o + 5], data[o + 6]);
        m.compose(st.pos, st.quat, one);
        this.solid.setMatrixAt(nSolid, m);
        this.solid.setColorAt(nSolid, this.metalColors.gold);
        nSolid++;
        addShadow(st.pos.x, st.pos.z, Math.max(0, st.pos.y - COIN_T * 0.5), 0.85);
      }
    } else {
      for (const s of this.specs) {
        this.coinState(s, f, st);
        if (!st.visible) continue;
        m.compose(st.pos, st.quat, one);
        if (st.alpha < 0.999) {
          this.fading.setMatrixAt(nFade, m);
          this.fading.setColorAt(nFade, this.metalColors[s.metal]);
          this.fadeOpacity.setX(nFade, st.alpha);
          nFade++;
        } else {
          this.solid.setMatrixAt(nSolid, m);
          this.solid.setColorAt(nSolid, this.metalColors[s.metal]);
          nSolid++;
        }
        // only coins resting on (or dropping onto) the table cast a blob
        if (s.level === 0) addShadow(st.pos.x, st.pos.z, Math.max(0, st.pos.y - s.pos.y) + (st.alpha < 1 ? 1 - st.alpha : 0), 1);
      }
    }
    this.solid.count = nSolid;
    this.fading.count = nFade;
    this.shadows.count = nShadow;
    for (const mesh of [this.solid, this.fading]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.fadeOpacity.needsUpdate = true;
    this.shadows.instanceMatrix.needsUpdate = true;
    this.shadowAlpha.needsUpdate = true;

    // 1) planar reflection of the coins (layer 0 only) from the mirror camera
    const gl = pipeline.gl;
    gl.setRenderTarget(this.reflRT);
    gl.setClearColor(this.clear, 0);
    gl.clear(true, true, true);
    gl.render(this.scene, this.reflCam);
    const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    const u = this.floorMat.uniforms;
    u.reflMatrix.value.copy(bias).multiply(this.reflCam.projectionMatrix).multiply(this.reflCam.matrixWorldInverse);
    u.reflView.value.copy(this.reflCam.matrixWorldInverse);
    u.camHeight.value = this.camera.position.y;
    u.camPos.value.copy(this.camera.position);

    // 2) overlay chart for this frame
    if (this.overlay && this.overlayTex) {
      const progress = easeInOut(clamp((f - GROW_START) / (GROW_END - GROW_START - 20)));
      const anchors = this.anchorsWorld.map((w) => {
        const p = w.clone().project(this.camera);
        return {x: (p.x * 0.5 + 0.5) * LW, y: (0.5 - p.y * 0.5) * LH};
      });
      this.overlay.draw({progress, anchors, frame: f});
      this.overlayTex.needsUpdate = true;
    }

    // 3) main pass + post
    pipeline.renderScene(this.scene, this.camera, this.clear);
    this.post.focus = focus;
    this.post.grainFrame = f % 600;
    pipeline.post(this.camera, this.post);
  }
}

