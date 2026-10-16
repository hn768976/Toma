import React, { useCallback } from "react";
import * as THREE from "three";
import { lin, glslVec3 } from "../../lib/color";
import { LOOP_FRAMES, TAU } from "../../lib/loop";
import { mulberry32 } from "../../lib/random";
import { makeGlowLineMaterial, makeLineSegments, setLineResolution } from "../../lib/three/glowLine";
import { PostFX } from "../../lib/three/post";
import { ThreeStage } from "../../lib/three/ThreeStage";
import { TERRAIN, TILE_L } from "./terrain";

export type RetroVersion = {
  id: string;
  sky: { top: string; mid: string; horizon: string; midElev: number; topElev: number };
  stars: { count: number; brightness: number; size: number };
  line: { color: string; far: string; farFrom: number; farTo: number; intensity: number; coreWhite: number };
  halo: string; // bloom tint
  fill: { low: string; high: string; tone: string }; // tone: some facets lean this way
  mountFade: [number, number]; // mountain line energy fades out over this depth range
  glow: { color: string; strength: number; haze: number; column: number };
  fog: string;
  bloomStrength: number;
};

const CAM_HEIGHT = 1.5;
const TILES_AHEAD = 4;

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const skyFrag = (v: RetroVersion) => /* glsl */ `
uniform vec2 horizonP;
uniform vec2 horizonN;
uniform float pxPerDeg;
varying vec3 vDir;
vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 hex(vec3 c) { return c; }
void main() {
  vec3 d = normalize(vDir);
  // elevation proxy measured straight up from the horizon line on screen, so
  // the bands stay straight (and roll with the camera) like the reference
  float e = dot(gl_FragCoord.xy - horizonP, horizonN) / pxPerDeg;
  // gradient stops are authored in sRGB and blended there, like a paint ramp
  vec3 top = ${srgbVec(v.sky.top)};
  vec3 mid = ${srgbVec(v.sky.mid)};
  vec3 hor = ${srgbVec(v.sky.horizon)};
  float a = smoothstep(0.0, ${v.sky.midElev.toFixed(2)}, e);
  float b = smoothstep(${v.sky.midElev.toFixed(2)}, ${v.sky.topElev.toFixed(2)}, e);
  vec3 c = mix(hor, mid, a);
  c = mix(c, top, b);
  vec3 col = toLin(c);
  // haze band hugging the horizon, brightest toward the vanishing point
  float az = atan(d.x, -d.z);
  float band = exp(-pow(e / 1.6, 2.0)) * (0.35 + 0.65 * exp(-pow(az / 0.5, 2.0)));
  col += ${glslVec3(v.glow.color)} * band * ${v.glow.haze.toFixed(3)};
  gl_FragColor = vec4(col, 0.0); // alpha 0: no bloom from the sky
}`;

function srgbVec(hex: string) {
  const c = new THREE.Color();
  c.setHex(parseInt(hex.slice(1), 16), THREE.SRGBColorSpace);
  const s = c.clone().convertLinearToSRGB();
  return `vec3(${s.r.toFixed(6)}, ${s.g.toFixed(6)}, ${s.b.toFixed(6)})`;
}

const starVert = /* glsl */ `
uniform float t;
uniform float pxScale;
attribute vec4 aStar; // size, brightness, twinkle cycles, phase
varying float vB;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w * 0.99999;
  float tw = aStar.z > 0.0 ? 0.6 + 0.4 * sin(6.2831853 * (aStar.z * t + aStar.w)) : 1.0;
  float size = aStar.x * pxScale;
  gl_PointSize = max(size, 1.5) + 1.0;
  float horizonFade = smoothstep(0.01, 0.06, normalize(position).y);
  vB = aStar.y * tw * horizonFade * min(size, 1.5) / 1.5;
}`;
const starFrag = /* glsl */ `
uniform vec3 starColor;
varying float vB;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p) * 2.0;
  float a = exp(-r * r * 3.5);
  gl_FragColor = vec4(starColor * vB * a, 0.0);
}`;

const glowVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const glowFrag = (v: RetroVersion) => /* glsl */ `
varying vec2 vUv;
void main() {
  float r = length(vUv * vec2(1.0, 1.0));
  float core = exp(-r * r * 2500.0) * 5.0;
  float mid = exp(-r * r * 400.0) * 0.45;
  float wide = exp(-r * r * 30.0) * 0.04;
  // horizontal flare along the horizon and a faint light column on the floor
  float flare = exp(-vUv.y * vUv.y * 3000.0) * exp(-abs(vUv.x) * 9.0) * 0.35;
  float column = exp(-vUv.x * vUv.x * 9000.0) * smoothstep(0.0, -0.01, vUv.y) * exp(vUv.y * 9.0) * ${v.glow.column.toFixed(3)};
  vec3 c = ${glslVec3(v.glow.color)};
  vec3 col = (c * (mid + wide + flare + column) + mix(c, vec3(1.0), 0.75) * core) * ${v.glow.strength.toFixed(3)};
  gl_FragColor = vec4(col, clamp(dot(col, vec3(0.3, 0.6, 0.1)) * 3.0, 0.0, 1.0));
}`;

const createRetroScene = (v: RetroVersion) => (renderer: THREE.WebGLRenderer) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.2, 1200);
  const post = new PostFX(renderer, {
    bloomStrength: v.bloomStrength,
    bloomRadius: 0.55,
    levels: 6,
    bloomThreshold: 0,
    bloomKnee: 0,
    bloomMask: true,
    bloomTint: v.halo,
    exposure: 1,
    grain: 0.01,
    dither: true,
    whiteBurn: 0.9,
  });

  // sky dome (follows the camera position)
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1000, 64, 32),
    new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag(v),
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        horizonP: { value: new THREE.Vector2() },
        horizonN: { value: new THREE.Vector2(0, 1) },
        pxPerDeg: { value: 10 },
      },
    }),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  // stars, seeded once
  const rng = mulberry32(0x57a125 ^ v.stars.count);
  const n = v.stars.count;
  const sp = new Float32Array(n * 3);
  const sa = new Float32Array(n * 4);
  const cycles = [0, 0, 1, 2, 3, 4, 5, 6, 8, 10];
  for (let i = 0; i < n; i++) {
    const y = 0.02 + Math.pow(rng(), 1.1) * 0.9;
    const az = rng() * TAU;
    const rr = Math.sqrt(1 - y * y);
    sp[i * 3] = Math.cos(az) * rr * 900;
    sp[i * 3 + 1] = y * 900;
    sp[i * 3 + 2] = Math.sin(az) * rr * 900;
    const big = rng() < 0.03;
    sa[i * 4] = (big ? 1.4 + rng() * 0.6 : 0.5 + rng() * 0.5) * v.stars.size;
    sa[i * 4 + 1] = (big ? 0.9 : 0.25 + rng() * 0.45) * v.stars.brightness;
    sa[i * 4 + 2] = rng() < 0.25 ? cycles[2 + Math.floor(rng() * 8)] : 0;
    sa[i * 4 + 3] = rng();
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  starGeo.setAttribute("aStar", new THREE.BufferAttribute(sa, 4));
  const starMat = new THREE.ShaderMaterial({
    vertexShader: starVert,
    fragmentShader: starFrag,
    uniforms: { t: { value: 0 }, pxScale: { value: 1 }, starColor: { value: lin("#FFF4FF") } },
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    depthWrite: false,
    transparent: true,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -9;
  stars.frustumCulled = false;
  scene.add(stars);

  // terrain fill (flat-shaded dark facets, height gradient, a few redder
  // or darker facets)
  const low = lin(v.fill.low);
  const high = lin(v.fill.high);
  const tone = lin(v.fill.tone);
  const makeFill = (pos: Float32Array, shade: Float32Array) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const cols = new Float32Array(shade.length);
    for (let i = 0; i < cols.length; i += 3) {
      const h = shade[i];
      const f = shade[i + 1];
      const tj = shade[i + 2];
      const c = low.clone().lerp(high, h).lerp(tone, tj < 0.3 ? 0.55 : 0).multiplyScalar(f * (0.85 + 0.3 * tj));
      cols[i] = c.r;
      cols[i + 1] = c.g;
      cols[i + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    return g;
  };
  const floorGeo = makeFill(TERRAIN.floorPositions, TERRAIN.floorShade);
  const mountGeo = makeFill(TERRAIN.mountPositions, TERRAIN.mountShade);
  const fillMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec3 color;
      varying vec3 vColor;
      varying float vDepth;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 fogColor;
      varying vec3 vColor;
      varying float vDepth;
      void main() {
        float f = smoothstep(60.0, 240.0, vDepth);
        gl_FragColor = vec4(mix(vColor, fogColor, f), 0.0);
      }`,
    uniforms: { fogColor: { value: lin(v.fog) } },
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1.5,
    polygonOffsetUnits: 2,
  });

  const colorFn = /* glsl */ `
    vec3 lineColor(vec3 w, float depth, vec3 data) {
      vec3 nearC = ${glslVec3(v.line.color)};
      vec3 farC = ${glslVec3(v.line.far)};
      vec3 c = mix(nearC, farC, smoothstep(${v.line.farFrom.toFixed(1)}, ${v.line.farTo.toFixed(1)}, depth));
      return c * (1.0 + 0.6 * data.x); // the floor's centre line runs brighter
    }`;
  const lineCommon = {
    fogNear: 30,
    fogFar: 200,
    fogColor: lin(v.fog),
    fogAmount: 1,
    fadeNear: v.mountFade[0],
    fadeFar: v.mountFade[1],
    coreWhite: v.line.coreWhite,
    intensity: v.line.intensity,
    colorFn,
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
    depthTest: true,
    depthPull: 0.004,
  } as const;
  const floorMat = makeGlowLineMaterial({
    ...lineCommon,
    fogNear: 8,
    fogFar: 60,
    fadeNear: 10,
    fadeFar: 48,
    linewidth: 1,
    nearBoost: 1.8,
    nearDist: 1.5,
    farDist: 30,
    taperDepth: 9,
  });
  const mountMat = makeGlowLineMaterial({
    ...lineCommon,
    linewidth: 1,
    nearBoost: 1.6,
    nearDist: 2,
    farDist: 35,
    taperDepth: 40,
  });

  const world = new THREE.Group();
  scene.add(world);
  for (let k = -1; k < TILES_AHEAD; k++) {
    const tile = new THREE.Group();
    tile.position.z = -k * TILE_L;
    for (const g of [floorGeo, mountGeo]) {
      const fill = new THREE.Mesh(g, fillMat);
      fill.frustumCulled = false;
      tile.add(fill);
    }
    tile.add(makeLineSegments(TERRAIN.floorSegs, TERRAIN.floorData, floorMat));
    tile.add(makeLineSegments(TERRAIN.mountSegs, TERRAIN.mountData, mountMat));
    world.add(tile);
  }

  // glow point at the vanishing point (camera-relative billboard)
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({
      vertexShader: glowVert,
      fragmentShader: glowFrag(v),
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    }),
  );
  glow.renderOrder = 10;
  glow.frustumCulled = false;
  scene.add(glow);

  return {
    render: (loopFrame: number) => {
      const t = loopFrame / LOOP_FRAMES;
      const w = post.pixelWidth;
      const h = post.pixelHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      setLineResolution(floorMat, w, h, 0.9);
      setLineResolution(mountMat, w, h, 0.95);
      floorMat.uniforms.nearBoost.value = 1.5;
      starMat.uniforms.t.value = t;
      starMat.uniforms.pxScale.value = h / 720;

      // forward exactly one tile per loop; sway and roll in whole cycles
      const z = -t * TILE_L;
      const sway = 0.45 * Math.sin(TAU * t) + 0.12 * Math.sin(TAU * 3 * t + 1.1);
      const roll = THREE.MathUtils.degToRad(4) * Math.cos(TAU * 2 * t);
      const bob = 0.06 * Math.sin(TAU * 4 * t);
      camera.position.set(sway, CAM_HEIGHT + bob, z);
      camera.rotation.order = "YXZ";
      camera.rotation.set(THREE.MathUtils.degToRad(9.5), -0.025 * Math.cos(TAU * t), roll);
      camera.updateMatrixWorld();

      sky.position.copy(camera.position);
      // vanishing line of the ground plane → screen pixels
      const toPx = (dx: number) => {
        const p = new THREE.Vector3(camera.position.x + dx, camera.position.y, camera.position.z - 1e5).project(camera);
        return new THREE.Vector2((p.x * 0.5 + 0.5) * w, (p.y * 0.5 + 0.5) * h);
      };
      const a = toPx(-4e4);
      const b = toPx(4e4);
      const dir = b.clone().sub(a).normalize();
      const su = (sky.material as THREE.ShaderMaterial).uniforms;
      su.horizonP.value.copy(a);
      su.horizonN.value.set(-dir.y, dir.x);
      su.pxPerDeg.value = h / camera.fov;
      stars.position.copy(camera.position);
      glow.position.set(camera.position.x, CAM_HEIGHT * 0.6, camera.position.z - 900);
      glow.scale.set(260, 260, 1);
      glow.quaternion.copy(camera.quaternion);

      post.render(scene, camera, loopFrame);
    },
    dispose: () => {
      post.dispose();
      floorGeo.dispose();
      mountGeo.dispose();
      starGeo.dispose();
    },
  };
};

export const RetroMountains: React.FC<{ version: RetroVersion }> = ({ version }) => {
  const factory = useCallback((r: THREE.WebGLRenderer) => createRetroScene(version)(r), [version]);
  return <ThreeStage factory={factory} />;
};
