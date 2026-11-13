import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { buildLayout } from "./layout";
import {
  buildCheckGeometry,
  buildFarRobotGeometry,
  buildFarTileGeometry,
  buildIconAtlas,
  buildRobotGeometry,
  buildTileGeometry,
  TILE_SIZE,
  TILE_TOP,
} from "./geometry";
import type { Palette } from "./palette";
import { clamp01, easeOutBack, lerp, smooth } from "./util";
import { cameraAt, FOV } from "./camera";

export type SceneHandle = {
  render: (timeInSeconds: number) => void;
  dispose: () => void;
};

const FOG_GLSL = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDist;
  vec3 applyFog(vec3 col, float dist) {
    float f = 1.0 - exp(-pow(dist / uFogDist, 2.0));
    return mix(col, uFogColor, f);
  }
`;

export const createScene = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  palette: Palette,
): SceneHandle => {
  // Under `--scale=0.5` Remotion sets devicePixelRatio to 0.5, so the same
  // 3840x2160 composition renders a native 1920x1080 backbuffer.
  const dpr = window.devicePixelRatio || 1;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  renderer.setClearColor(new THREE.Color(...palette.background), 1);
  const pxW = Math.round(width * dpr);
  const pxH = Math.round(height * dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.5, 2500);

  const layout = buildLayout();
  const { tiles, robots, links } = layout;
  const fog = {
    uFogColor: { value: new THREE.Vector3(...palette.background) },
    uFogDist: { value: 100 },
  };
  const disposables: { dispose: () => void }[] = [];

  // ---------------------------------------------------------------- ground
  const groundMat = new THREE.ShaderMaterial({
    uniforms: {
      ...fog,
      uNear: { value: new THREE.Vector3(...palette.groundNear) },
      uGlow: { value: new THREE.Vector3(...palette.groundGlow) },
      uDots: { value: new THREE.Vector3(...palette.groundDots) },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vW;
      uniform vec3 uNear, uGlow, uDots;
      uniform float uTime;
      ${FOG_GLSL}
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec2 p = vW.xz;
        float dist = length(cameraPosition - vW);
        vec3 col = uNear;
        // soft drifting haze of light on the floor
        vec2 q = p * 0.018 + vec2(uTime * 0.012, 0.0);
        float n = vnoise(q + 3.7) * 0.6 + vnoise(q * 2.3 + 9.1) * 0.4;
        col += uGlow * smoothstep(0.38, 0.85, n) * 0.5;
        // patches of tiny data dots
        float cell = 0.26;
        vec2 g = p / cell;
        vec2 id = floor(g);
        vec2 f = fract(g) - 0.5;
        float patchOn = step(0.7, hash(floor(id / vec2(7.0, 4.0)) + 3.0));
        float on = patchOn * step(0.45, hash(id + 17.0));
        float aa = fwidth(g.x) + fwidth(g.y);
        float d = 1.0 - smoothstep(0.16, 0.16 + max(aa, 0.04), length(f));
        float fade = 1.0 - smoothstep(0.2, 0.75, aa);
        float tw = 0.6 + 0.4 * sin(uTime * 2.0 + hash(id) * 40.0);
        col += uDots * on * d * fade * 0.5 * tw;
        gl_FragColor = vec4(applyFog(col, dist), 1.0);
      }
    `,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  disposables.push(groundMat, ground.geometry);

  // ----------------------------------------------------------------- tiles
  const nearTiles = tiles.filter((t) => t.near);
  const farTiles = tiles.filter((t) => !t.near);
  const tileMat = new THREE.ShaderMaterial({
    uniforms: { ...fog, uHalf: { value: TILE_SIZE / 2 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aLayer;
      varying vec3 vColor, vN, vW, vLocal;
      varying float vLayer;
      void main() {
        vColor = aColor;
        vLayer = aLayer;
        vLocal = position;
        vN = normalize(mat3(instanceMatrix) * normal);
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vColor, vN, vW, vLocal;
      varying float vLayer;
      uniform float uHalf;
      ${FOG_GLSL}
      void main() {
        vec3 n = normalize(vN);
        vec3 toCam = cameraPosition - vW;
        float dist = length(toCam);
        vec3 v = toCam / dist;
        float top = smoothstep(0.5, 0.9, n.y);
        vec2 q = abs(vLocal.xz) / uHalf;
        float edge = max(q.x, q.y);
        float rim = smoothstep(0.74, 0.96, edge) * top;
        float side = 1.0 - top;
        vec3 col = vColor * (0.24 + 0.44 * top + 0.3 * side * (0.5 + 0.5 * n.z));
        col += vColor * rim * 0.6 + vec3(rim * 0.12);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        col += (vColor * 0.5 + 0.08) * fres;
        // soft sheen across the key cap
        col += vColor * top * 0.16 * smoothstep(-1.0, 1.0, (vLocal.x - vLocal.z) / uHalf);
        col *= mix(0.5, 1.0, vLayer);
        gl_FragColor = vec4(applyFog(col, dist), 1.0);
      }
    `,
  });
  disposables.push(tileMat);

  const makeTileMesh = (geo: THREE.BufferGeometry, list: typeof tiles) => {
    const mesh = new THREE.InstancedMesh(geo, tileMat, list.length);
    const m = new THREE.Matrix4();
    list.forEach((t, i) => {
      m.makeTranslation(t.x, 0, t.z);
      mesh.setMatrixAt(i, m);
    });
    const colors = new THREE.InstancedBufferAttribute(
      new Float32Array(list.length * 3),
      3,
    );
    colors.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aColor", colors);
    mesh.frustumCulled = false;
    scene.add(mesh);
    disposables.push(geo);
    return colors;
  };
  const nearColors = makeTileMesh(buildTileGeometry(), nearTiles);
  const farColors = makeTileMesh(buildFarTileGeometry(), farTiles);

  // ----------------------------------------------------------------- icons
  const atlas = buildIconAtlas();
  const iconGeo = new THREE.PlaneGeometry(0.98, 0.98);
  iconGeo.rotateX(-Math.PI / 2);
  const iconMat = new THREE.ShaderMaterial({
    uniforms: {
      ...fog,
      uAtlas: { value: atlas },
      uColor: { value: new THREE.Vector3(...palette.icon) },
      uFade: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aIcon;
      varying vec2 vUv;
      varying vec3 vW;
      void main() {
        vec2 cell = vec2(mod(aIcon, 4.0), floor(aIcon / 4.0));
        vUv = (cell + vec2(uv.x, 1.0 - uv.y)) / vec2(4.0, 2.0);
        vUv.y = 1.0 - vUv.y;
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      varying vec3 vW;
      uniform sampler2D uAtlas;
      uniform vec3 uColor;
      uniform float uFade;
      ${FOG_GLSL}
      void main() {
        float a = texture2D(uAtlas, vUv).a * uFade * 0.92;
        float dist = length(cameraPosition - vW);
        gl_FragColor = vec4(applyFog(uColor, dist), a);
      }
    `,
  });
  const iconMesh = new THREE.InstancedMesh(iconGeo, iconMat, nearTiles.length);
  {
    const m = new THREE.Matrix4();
    const idx = new Float32Array(nearTiles.length);
    nearTiles.forEach((t, i) => {
      m.makeTranslation(t.x, TILE_TOP + 0.012, t.z);
      iconMesh.setMatrixAt(i, m);
      idx[i] = t.icon;
    });
    iconGeo.setAttribute("aIcon", new THREE.InstancedBufferAttribute(idx, 1));
  }
  iconMesh.frustumCulled = false;
  iconMesh.renderOrder = 2;
  scene.add(iconMesh);
  disposables.push(iconGeo, iconMat, atlas);

  // ------------------------------------------------------- network lines
  // Ribbons on the floor. The vertex shader keeps them at least ~1px wide
  // (trading width for opacity) so they stay clean at any resolution.
  const lineMat = new THREE.ShaderMaterial({
    uniforms: {
      ...fog,
      uColor: { value: new THREE.Vector3(...palette.lines) },
      uPxScale: { value: 1 },
      uFade: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aPerp;
      varying float vAlpha;
      varying float vDist;
      uniform float uPxScale;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec4 clip = projectionMatrix * viewMatrix * w;
        float px = clip.w * uPxScale;          // world size of one pixel here
        float half0 = 0.022;
        float halfW = max(half0, px * 0.65);
        vAlpha = half0 / halfW;
        w.xyz += aPerp * halfW;
        vDist = length(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying float vAlpha;
      varying float vDist;
      uniform vec3 uColor;
      uniform float uFade;
      ${FOG_GLSL}
      void main() {
        float f = exp(-pow(vDist / uFogDist, 2.0));
        gl_FragColor = vec4(uColor * 0.62 * vAlpha * f * uFade, 1.0);
      }
    `,
  });
  {
    const n = links.length;
    const pos = new Float32Array(n * 4 * 3);
    const perp = new Float32Array(n * 4 * 3);
    const index = new Uint32Array(n * 6);
    links.forEach(([a, b], k) => {
      const A = tiles[a];
      const B = tiles[b];
      const dx = B.x - A.x;
      const dz = B.z - A.z;
      const l = Math.hypot(dx, dz) || 1;
      const px = -dz / l;
      const pz = dx / l;
      const o = k * 12;
      const put = (i: number, x: number, z: number, s: number) => {
        pos[o + i * 3] = x;
        pos[o + i * 3 + 1] = 0.015;
        pos[o + i * 3 + 2] = z;
        perp[o + i * 3] = px * s;
        perp[o + i * 3 + 2] = pz * s;
      };
      put(0, A.x, A.z, -1);
      put(1, A.x, A.z, 1);
      put(2, B.x, B.z, -1);
      put(3, B.x, B.z, 1);
      index.set([k * 4, k * 4 + 1, k * 4 + 2, k * 4 + 2, k * 4 + 1, k * 4 + 3], k * 6);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aPerp", new THREE.BufferAttribute(perp, 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    const mesh = new THREE.Mesh(geo, lineMat);
    mesh.material.side = THREE.DoubleSide;
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    scene.add(mesh);
    disposables.push(geo, lineMat);
  }

  // ---------------------------------------------------------------- robots
  const robotMat = new THREE.ShaderMaterial({
    uniforms: { ...fog, uBoost: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float aEm;
      varying vec3 vColor, vN, vW;
      varying float vEm;
      void main() {
        vColor = color;
        vEm = aEm;
        vN = normalize(mat3(instanceMatrix) * normal);
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vColor, vN, vW;
      varying float vEm;
      uniform float uBoost;
      ${FOG_GLSL}
      void main() {
        vec3 n = normalize(vN);
        vec3 toCam = cameraPosition - vW;
        float dist = length(toCam);
        vec3 v = toCam / dist;
        vec3 L = normalize(vec3(0.35, 0.8, 0.55));
        float diff = max(dot(n, L), 0.0);
        float hemi = 0.5 + 0.5 * n.y;
        vec3 lit = vColor * (0.3 + 0.25 * hemi + 0.6 * diff);
        vec3 h = normalize(L + v);
        lit += vec3(0.35) * pow(max(dot(n, h), 0.0), 40.0);
        lit += vColor * pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.5;
        vec3 col = mix(lit, vColor * 1.05, vEm);
        col += vColor * uBoost;
        gl_FragColor = vec4(applyFog(col, dist), 1.0);
      }
    `,
  });
  disposables.push(robotMat);
  const nearRobots = robots.filter((t) => t.near);
  const farRobots = robots.filter((t) => !t.near);
  const makeRobotMesh = (geo: THREE.BufferGeometry, count: number) => {
    const mesh = new THREE.InstancedMesh(geo, robotMat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
    disposables.push(geo);
    return mesh;
  };
  const nearRobotMesh = makeRobotMesh(buildRobotGeometry(palette), nearRobots.length);
  const farRobotMesh = makeRobotMesh(buildFarRobotGeometry(palette), farRobots.length);

  // ----------------------------------------------------------- check marks
  const checkGeo = buildCheckGeometry();
  const checkMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Vector3(...palette.check) } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      void main() {
        vN = normalize(mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vN;
      uniform vec3 uColor;
      void main() {
        float l = 0.75 + 0.45 * abs(normalize(vN).z) + 0.2 * normalize(vN).y;
        gl_FragColor = vec4(uColor * l * 1.15, 1.0);
      }
    `,
  });
  const checkMesh = new THREE.InstancedMesh(checkGeo, checkMat, nearRobots.length);
  checkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  checkMesh.frustumCulled = false;
  scene.add(checkMesh);
  disposables.push(checkGeo, checkMat);

  // ---------------------------------------------- spawn pulses (dot matrix)
  const pulseGeo = new THREE.PlaneGeometry(2.1, 2.1);
  pulseGeo.rotateX(-Math.PI / 2);
  const pulseAlpha = new THREE.InstancedBufferAttribute(
    new Float32Array(nearRobots.length),
    1,
  );
  pulseAlpha.setUsage(THREE.DynamicDrawUsage);
  pulseGeo.setAttribute("aAlpha", pulseAlpha);
  const pulseMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Vector3(...palette.spawnDots) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      varying vec2 vUv;
      varying float vA;
      void main() {
        vUv = uv;
        vA = aAlpha;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      varying float vA;
      uniform vec3 uColor;
      void main() {
        vec2 g = vUv * 13.0;
        vec2 f = fract(g) - 0.5;
        float aa = fwidth(g.x) + fwidth(g.y);
        float d = 1.0 - smoothstep(0.2, 0.2 + max(aa, 0.05), length(f));
        float r = length(vUv - 0.5) * 2.0;
        float mask = (1.0 - smoothstep(0.35, 1.0, r));
        float fade = 1.0 - smoothstep(0.3, 0.9, aa);
        gl_FragColor = vec4(uColor * (d * fade + (1.0 - fade) * 0.12) * mask * vA * 1.3, 1.0);
      }
    `,
  });
  const pulseMesh = new THREE.InstancedMesh(pulseGeo, pulseMat, nearRobots.length);
  {
    const m = new THREE.Matrix4();
    nearRobots.forEach((t, i) => {
      m.makeTranslation(t.sx, 0.03, t.sz);
      pulseMesh.setMatrixAt(i, m);
    });
  }
  pulseMesh.frustumCulled = false;
  pulseMesh.renderOrder = 3;
  scene.add(pulseMesh);
  disposables.push(pulseGeo, pulseMat);

  // ------------------------------------------------------------ post chain
  const target = new THREE.WebGLRenderTarget(pxW, pxH, {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(dpr);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(pxW, pxH), 0.7, 0.55, 0.58);
  composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uGrade: { value: new THREE.Vector3(...palette.grade) },
      uVignette: { value: 0.55 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform vec3 uGrade;
      uniform float uVignette;
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb * uGrade;
        vec2 d = vUv - 0.5;
        float v = 1.0 - uVignette * smoothstep(0.25, 0.95, length(d * vec2(1.0, 0.8)) * 1.35);
        c *= v;
        c = c / (1.0 + max(max(c.r, c.g), c.b) * 0.12); // gentle highlight roll-off
        // tiny static dither against banding in the dark gradients
        float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        c += (n - 0.5) / 255.0;
        gl_FragColor = vec4(c * 1.08, 1.0);
      }
    `,
  });
  composer.addPass(grade);

  // --------------------------------------------------------------- animate
  const idle = palette.tileIdle;
  const done = palette.tileDone;
  const writeTileColors = (
    list: typeof tiles,
    attr: THREE.InstancedBufferAttribute,
    t: number,
    idleGain: number,
  ) => {
    const a = attr.array as Float32Array;
    for (let i = 0; i < list.length; i++) {
      const tl = list[i];
      const k = t > tl.land ? smooth((t - tl.land) / 0.4) : 0;
      const flash = t > tl.land ? Math.exp(-(t - tl.land) * 3.2) * 1.1 : 0;
      const gi = (0.82 + 0.3 * tl.seed) * idleGain;
      const gd = 1.12 + flash;
      a[i * 3] = lerp(idle[0] * gi, done[0] * gd, k);
      a[i * 3 + 1] = lerp(idle[1] * gi, done[1] * gd, k);
      a[i * 3 + 2] = lerp(idle[2] * gi, done[2] * gd, k);
    }
    attr.needsUpdate = true;
  };

  const writeRobots = (
    list: typeof tiles,
    mesh: THREE.InstancedMesh,
    t: number,
    detail: boolean,
    scale: number,
  ) => {
    const arr = mesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const o = i * 16;
      let s = 0;
      let x = r.x;
      let y = TILE_TOP;
      let z = r.z;
      let yaw = r.yaw;
      if (t > r.spawn && t < r.leave) {
        const age = t - r.spawn;
        s = easeOutBack(age / 0.42) * smooth((r.leave - t) / 0.3);
        const hop = smooth((t - (r.land - 0.8)) / 0.8);
        x = lerp(r.sx, r.x, hop);
        z = lerp(r.sz, r.z, hop);
        y = TILE_TOP * hop + Math.sin(Math.PI * hop) * 0.85;
        if (detail) {
          const ph = r.seed * 40;
          y += Math.abs(Math.sin(t * 3.1 + ph)) * 0.05 * (hop >= 1 ? 1 : 0.4);
          yaw += Math.sin(t * 1.7 + ph) * 0.22;
        }
        s *= (0.92 + 0.16 * r.seed) * scale;
      }
      const c = Math.cos(yaw) * s;
      const sn = Math.sin(yaw) * s;
      arr[o] = c;
      arr[o + 1] = 0;
      arr[o + 2] = -sn;
      arr[o + 3] = 0;
      arr[o + 4] = 0;
      arr[o + 5] = s;
      arr[o + 6] = 0;
      arr[o + 7] = 0;
      arr[o + 8] = sn;
      arr[o + 9] = 0;
      arr[o + 10] = c;
      arr[o + 11] = 0;
      arr[o + 12] = x;
      arr[o + 13] = y;
      arr[o + 14] = z;
      arr[o + 15] = 1;
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpS = new THREE.Vector3();
  const tmpP = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const CHECK_LIFE = 2.7;

  const render = (t: number) => {
    const cam = cameraAt(t);
    camera.position.set(cam.px, cam.py, cam.pz);
    camera.up.set(0, 1, 0);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    camera.rotateZ(cam.roll);
    camera.updateMatrixWorld();

    fog.uFogDist.value = 55 + cam.dist * 2.3;
    groundMat.uniforms.uTime.value = t;
    lineMat.uniforms.uPxScale.value =
      (2 * Math.tan((FOV * Math.PI) / 360)) / pxH;
    const farness = smooth((cam.dist - 45) / 60);
    lineMat.uniforms.uFade.value = 1 - 0.8 * farness;
    iconMat.uniforms.uFade.value = 1 - smooth((cam.dist - 40) / 45);
    // idle tiles dim a little once the whole field is in view
    const idleGain = 1 - 0.42 * smooth((t - 8.5) / 5);

    writeTileColors(nearTiles, nearColors, t, idleGain);
    writeTileColors(farTiles, farColors, t, idleGain);
    // seen from far away the bots are only a few pixels: enlarge and
    // brighten them a little so they still read as coloured dots
    robotMat.uniforms.uBoost.value = 0.9 * farness;
    const robotScale = 1.15 + 0.5 * farness;
    writeRobots(nearRobots, nearRobotMesh, t, true, robotScale);
    writeRobots(farRobots, farRobotMesh, t, false, robotScale);

    const checkGain = 1 - smooth((cam.dist - 55) / 40);
    const pa = pulseAlpha.array as Float32Array;
    for (let i = 0; i < nearRobots.length; i++) {
      const r = nearRobots[i];
      const age = t - r.land;
      let s = 0;
      if (age > 0 && age < CHECK_LIFE && checkGain > 0) {
        s =
          easeOutBack(age / 0.3) *
          smooth((CHECK_LIFE - age) / 0.4) *
          checkGain *
          1.15;
      }
      tmpP.set(r.x, 1.75 + 0.55 * smooth(age / CHECK_LIFE), r.z);
      tmpQ.setFromAxisAngle(yAxis, age * 3.0 + r.seed * 20);
      tmpS.set(s, s, s);
      tmpM.compose(tmpP, tmpQ, tmpS);
      checkMesh.setMatrixAt(i, tmpM);
      // dotted pulse while materialising and again while leaving
      const a1 =
        smooth((t - (r.spawn - 0.3)) / 0.3) *
        (1 - smooth((t - (r.land - 0.9)) / 0.6));
      pa[i] = clamp01(a1) * (1 - 0.7 * farness);
    }
    checkMesh.instanceMatrix.needsUpdate = true;
    pulseAlpha.needsUpdate = true;

    composer.render();
  };

  return {
    render,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      target.dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
};
