import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { buildParts, buildTraces } from "./board";
import { buildBoardTexture, buildTextTexture } from "./textures";
import { CameraPathName, FOV, makeCamera } from "./camera";
import { clamp01, mulberry32, smooth } from "./util";

export type SceneHandle = {
  render: (timeInSeconds: number) => void;
  dispose: () => void;
};

/** Moment the hologram plate touches the chip (seconds). */
export const IMPACT = 3.1;
const CHIP = 4.0; // heat-spreader edge length
const CHIP_TOP = 0.56;

export const plateHeight = (t: number) =>
  CHIP_TOP + 0.02 + 7.5 * Math.pow(1 - clamp01((t - 0.7) / (IMPACT - 0.7)), 1.25);

// Shared lighting: a cool key light, a fake overhead soft box for specular,
// the white glow of the socket and the blue energy released on impact.
const LIGHT_GLSL = /* glsl */ `
  uniform float uGlow;        // white socket glow
  uniform float uEnergy;      // overall blue energy light
  uniform float uFront;       // radius of the expanding shock front
  uniform float uRing;        // intensity of the shock front
  uniform vec3 uEnergyColor;
  vec3 shade(vec3 albedo, float spec, vec3 n, vec3 w, vec3 v) {
    vec3 key = normalize(vec3(-0.35, 0.85, 0.4));
    float diff = max(dot(n, key), 0.0);
    vec3 col = albedo * (0.2 + 0.85 * diff) * vec3(0.9, 0.95, 1.06);
    vec3 r = reflect(-v, n);
    float sky = smoothstep(0.0, 0.9, r.y) * 0.35 + smoothstep(0.7, 0.97, r.y) * 0.7;
    col += spec * sky * vec3(0.5, 0.56, 0.66) * (0.35 + 0.65 * albedo.g * 1.4);
    vec3 toC = vec3(0.0, 0.7, 0.0) - w;
    float d2 = dot(toC, toC);
    vec3 lc = toC * inversesqrt(d2);
    float nl = max(dot(n, lc), 0.0) * 0.75 + 0.25;
    float fall = 1.0 / (1.0 + d2 * 0.05);
    // the lid itself is lit far less by its own gasket than the board around it
    float self = mix(0.12, 1.0, smoothstep(1.6, 3.6, max(abs(w.x), abs(w.z))));
    col += (albedo * 1.0 + spec * 0.03 + 0.01) * uGlow * fall * nl * self * vec3(0.86, 0.93, 1.0);
    float fallE = 1.0 / (1.0 + d2 * 0.009);
    float ring = exp(-pow((sqrt(d2) - uFront) / 3.0, 2.0)) * uRing;
    col += (albedo * 2.2 + spec * 0.12 + 0.02) * uEnergyColor * nl * (uEnergy * fallE + ring * 1.4);
    return col;
  }
`;

export const createScene = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  cameraPath: CameraPathName,
): SceneHandle => {
  // Under `--scale=0.5` devicePixelRatio is 0.5 => native 1080p backbuffer.
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
  renderer.setClearColor(0x020306, 1);
  const pxW = Math.round(width * dpr);
  const pxH = Math.round(height * dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, width / height, 1, 160);
  const camAt = makeCamera(cameraPath);
  const disposables: { dispose: () => void }[] = [];

  const L = {
    uGlow: { value: 0.6 },
    uEnergy: { value: 0 },
    uFront: { value: 0 },
    uRing: { value: 0 },
    uEnergyColor: { value: new THREE.Vector3(0.1, 0.42, 1.0) },
  };
  const uTime = { value: 0 };
  const textTex = buildTextTexture();
  const boardTex = buildBoardTexture();
  disposables.push(textTex, boardTex);

  // ------------------------------------------------------------------ board
  const boardMat = new THREE.ShaderMaterial({
    uniforms: { ...L, uTex: { value: boardTex } },
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
      uniform sampler2D uTex;
      ${LIGHT_GLSL}
      void main() {
        vec3 v = normalize(cameraPosition - vW);
        float tr = texture2D(uTex, vW.xz / 22.0).r;
        vec3 albedo = mix(vec3(0.02, 0.023, 0.03), vec3(0.075, 0.085, 0.105), tr);
        float spec = 0.25 + tr * 0.9;
        vec3 col = shade(albedo, spec, vec3(0.0, 1.0, 0.0), vW, v);
        float far = smoothstep(30.0, 70.0, length(vW.xz));
        gl_FragColor = vec4(col * (1.0 - far), 1.0);
      }
    `,
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), boardMat);
  board.rotation.x = -Math.PI / 2;
  // One huge quad has imprecise interpolated depth, which can swallow the
  // thin traces lying on it for a frame. It is the lowest thing in the
  // scene: draw it first without writing depth (it is still included in
  // the separate depth pre-pass used for depth of field).
  boardMat.depthWrite = false;
  board.renderOrder = -10;
  scene.add(board);
  disposables.push(boardMat, board.geometry);

  // ------------------------------------------------------------- components
  const parts = buildParts();
  const partGeo = new THREE.BoxGeometry(1, 1, 1);
  const partMat = new THREE.ShaderMaterial({
    uniforms: { ...L },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSpec;
      attribute vec3 aSize;
      varying vec3 vColor, vN, vW, vLocal, vSize;
      varying float vSpec;
      void main() {
        vColor = aColor;
        vSpec = aSpec;
        vSize = aSize;
        vLocal = position * aSize;
        vN = normal;
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vColor, vN, vW, vLocal, vSize;
      varying float vSpec;
      ${LIGHT_GLSL}
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(cameraPosition - vW);
        vec3 col = shade(vColor, vSpec, n, vW, v);
        // catch-light along the top edges so the dark packages read as solids
        vec3 e = vSize * 0.5 - abs(vLocal);
        float edge = n.y > 0.5 ? min(e.x, e.z) : (abs(n.x) > 0.5 ? e.y : e.y);
        float hl = 1.0 - smoothstep(0.0, 0.045, edge);
        float topSide = n.y > 0.5 ? 1.0 : step(0.0, vLocal.y);
        col += hl * topSide * (0.035 + vColor * 0.35) * (0.6 + uGlow * 0.5);
        float far = smoothstep(30.0, 70.0, length(vW.xz));
        gl_FragColor = vec4(col * (1.0 - far), 1.0);
      }
    `,
  });
  {
    const mesh = new THREE.InstancedMesh(partGeo, partMat, parts.length);
    const colors = new Float32Array(parts.length * 3);
    const specs = new Float32Array(parts.length);
    const sizes = new Float32Array(parts.length * 3);
    const m = new THREE.Matrix4();
    parts.forEach((p, i) => {
      m.makeScale(p.sx, p.sy, p.sz);
      m.setPosition(p.x, p.y, p.z);
      mesh.setMatrixAt(i, m);
      colors.set(p.color, i * 3);
      specs[i] = p.spec;
      sizes.set([p.sx, p.sy, p.sz], i * 3);
    });
    partGeo.setAttribute("aColor", new THREE.InstancedBufferAttribute(colors, 3));
    partGeo.setAttribute("aSpec", new THREE.InstancedBufferAttribute(specs, 1));
    partGeo.setAttribute("aSize", new THREE.InstancedBufferAttribute(sizes, 3));
    mesh.frustumCulled = false;
    scene.add(mesh);
    disposables.push(partGeo, partMat);
  }

  // ------------------------------------------------------------------ socket
  const solidMat = (albedo: [number, number, number], spec: number, emissive = 0) =>
    new THREE.ShaderMaterial({
      uniforms: {
        ...L,
        uAlbedo: { value: new THREE.Vector3(...albedo) },
        uSpec: { value: spec },
        uEmissive: { value: emissive },
      },
      vertexShader: /* glsl */ `
        varying vec3 vN, vW;
        void main() {
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vN, vW;
        uniform vec3 uAlbedo;
        uniform float uSpec, uEmissive;
        ${LIGHT_GLSL}
        void main() {
          vec3 n = normalize(vN);
          vec3 v = normalize(cameraPosition - vW);
          vec3 col = shade(uAlbedo, uSpec, n, vW, v);
          col += uEmissive * (0.55 + uGlow * 0.75) * vec3(0.9, 0.95, 1.0);
          col += uEmissive * uEnergyColor * uEnergy * 0.6;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  const addMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    scene.add(mesh);
    disposables.push(geo, mat);
    return mesh;
  };
  // dark socket frame, glowing gasket, silver heat spreader
  addMesh(new RoundedBoxGeometry(4.9, 0.1, 4.9, 2, 0.04), solidMat([0.04, 0.045, 0.055], 0.5), 0.05);
  addMesh(new RoundedBoxGeometry(4.24, 0.1, 4.24, 2, 0.05), solidMat([0.8, 0.85, 0.9], 0.2, 0.9), 0.13);
  const spreaderMat = solidMat([0.36, 0.375, 0.4], 0.7, 0.03);
  addMesh(new RoundedBoxGeometry(CHIP, 0.4, CHIP, 3, 0.09), spreaderMat, 0.36);
  // corner alignment marks on the board
  {
    const mat = solidMat([0.55, 0.58, 0.62], 0.8, 0.25);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const a = addMesh(new THREE.BoxGeometry(0.62, 0.03, 0.12), mat, 0.02);
        a.position.set(sx * 2.72, 0.02, sz * 2.97);
        const b = addMesh(new THREE.BoxGeometry(0.12, 0.03, 0.62), mat, 0.02);
        b.position.set(sx * 2.97, 0.02, sz * 2.72);
      }
  }

  // The chip's top face: silver lid -> blue hologram -> dark glass with "AI".
  const FACE_GLSL = /* glsl */ `
    uniform sampler2D uText;
    uniform float uTime;
    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    vec3 holoLook(vec2 uv, float gain) {
      float txt = texture2D(uText, uv).r;
      vec3 base = mix(vec3(0.03, 0.3, 0.95), vec3(0.2, 0.95, 1.0), smoothstep(0.0, 1.0, uv.y * 0.6 + uv.x * 0.4));
      vec2 g = abs(fract(uv * 20.0) - 0.5);
      float aa = fwidth(uv.x) * 20.0;
      float grid = 1.0 - smoothstep(0.03, 0.03 + aa * 1.5, min(g.x, g.y));
      float scan = 0.85 + 0.15 * sin(uv.y * 90.0 - uTime * 6.0);
      vec3 col = base * (0.62 + 0.3 * grid) * scan;
      vec2 e = abs(uv - 0.5) * 2.0;
      col += vec3(0.3, 0.9, 1.0) * smoothstep(0.9, 1.0, max(e.x, e.y)) * 0.7;
      col = mix(col, vec3(1.0, 0.78, 0.9) * 1.35, txt);
      return col * gain;
    }
  `;
  const faceMat = new THREE.ShaderMaterial({
    uniforms: {
      ...L,
      uText: { value: textTex },
      uTime,
      uHolo: { value: 0 },
      uWipe: { value: 0 },
      uFlash: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vW;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      varying vec3 vW;
      uniform float uHolo, uWipe, uFlash;
      ${LIGHT_GLSL}
      ${FACE_GLSL}
      void main() {
        vec3 v = normalize(cameraPosition - vW);
        vec3 n = vec3(0.0, 1.0, 0.0);
        vec2 e = abs(vUv - 0.5) * 2.0;
        float edge = max(e.x, e.y);
        // --- silver lid with a field of contact dots and a centre emboss
        vec2 g = fract(vUv * 27.0) - 0.5;
        float aa = fwidth(vUv.x) * 27.0;
        float dotm = (1.0 - smoothstep(0.2, 0.2 + aa * 1.5, length(g))) * (1.0 - smoothstep(0.3, 1.0, aa));
        float inner = step(edge, 0.9);
        float emb = step(edge, 0.3) - step(edge, 0.26) + step(edge, 0.1);
        vec3 silverA = vec3(0.36, 0.375, 0.4) * (1.0 - 0.4 * dotm * inner * (1.0 - step(edge, 0.3)));
        silverA += emb * 0.08;
        vec3 silver = shade(silverA, 0.7, n, vW, v);
        silver += vec3(0.9, 0.95, 1.0) * smoothstep(0.93, 1.0, edge) * (0.25 + uGlow * 0.3);
        // --- dark glass with glowing lettering
        float txt = texture2D(uText, vUv).r;
        vec3 dark = shade(vec3(0.022, 0.025, 0.032), 0.7, n, vW, v);
        dark += vec3(0.5, 0.56, 0.62) * (step(edge, 0.955) - step(edge, 0.94)) * 0.3;
        dark = mix(dark, vec3(0.42, 0.66, 1.0) * 1.15, txt);
        // --- hologram skin
        vec3 holo = holoLook(vUv, 1.0);
        vec3 col = mix(silver, holo, uHolo);
        // diagonal sparkle wipe from hologram to glass
        float diag = (vUv.x + (1.0 - vUv.y)) * 0.5;
        float p = uWipe * 1.3 - 0.15;
        float w = smoothstep(p + 0.05, p - 0.05, diag);
        float band = exp(-pow((diag - p) / 0.09, 2.0)) * step(0.001, uWipe) * (1.0 - step(0.999, uWipe));
        float sp = step(0.72, hash21(floor(vUv * 70.0) + floor(uTime * 24.0)));
        col = mix(col, dark, w);
        col += band * (0.35 + sp * 1.6) * vec3(0.6, 0.85, 1.0);
        col += uFlash * vec3(0.9, 0.95, 1.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  {
    const geo = new THREE.PlaneGeometry(CHIP - 0.16, CHIP - 0.16);
    geo.rotateX(-Math.PI / 2);
    addMesh(geo, faceMat, CHIP_TOP + 0.002);
  }

  // ------------------------------------------------------------ holo plate
  const plateMat = new THREE.ShaderMaterial({
    uniforms: { uText: { value: textTex }, uTime, uAlpha: { value: 1 } },
    transparent: true,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vN;
      void main() {
        vUv = vec2(position.x / ${(CHIP - 0.16).toFixed(2)} + 0.5, 0.5 - position.z / ${(CHIP - 0.16).toFixed(2)});
        vN = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      varying vec3 vN;
      uniform float uAlpha;
      ${FACE_GLSL}
      void main() {
        vec3 col = abs(vN.y) > 0.5 ? holoLook(vUv, 1.0) : vec3(0.35, 0.95, 1.0) * 1.3;
        gl_FragColor = vec4(col, uAlpha * (abs(vN.y) > 0.5 ? 0.93 : 1.0));
      }
    `,
  });
  const plate = addMesh(new THREE.BoxGeometry(CHIP - 0.16, 0.07, CHIP - 0.16), plateMat, 9);
  plate.renderOrder = 5;

  // light rain between the plate and the chip
  const STREAKS = 520;
  const streakGeo = new THREE.PlaneGeometry(1, 1);
  streakGeo.translate(0, 0.5, 0);
  const streakMat = new THREE.ShaderMaterial({
    uniforms: { uTime, uPlateY: { value: 9 }, uI: { value: 0 }, uPxScale: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec4 aData; // x, z, phase, speed
      varying float vY;
      varying float vPhase, vSpeed, vLen, vA;
      uniform float uPlateY, uPxScale;
      void main() {
        float y0 = ${CHIP_TOP.toFixed(2)};
        vLen = max(uPlateY - y0, 0.001);
        vY = position.y;
        vPhase = aData.z;
        vSpeed = aData.w;
        vec3 base = vec3(aData.x, y0 + position.y * vLen, aData.y);
        vec4 mv = viewMatrix * modelMatrix * vec4(base, 1.0);
        float px = -mv.z * uPxScale;
        float half0 = 0.011;
        float halfW = max(half0, px * 0.6);
        vA = half0 / halfW;
        mv.x += position.x * 2.0 * halfW;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying float vY, vPhase, vSpeed, vLen, vA;
      uniform float uTime, uI;
      void main() {
        float s = fract(vY * vLen * 0.22 + uTime * vSpeed + vPhase);
        float dash = smoothstep(0.35, 1.0, s);
        float head = smoothstep(0.93, 1.0, s);
        float a = (0.1 + dash * 0.5 + head * 1.6) * (0.35 + 0.65 * vY);
        gl_FragColor = vec4(vec3(0.4, 0.68, 1.0) * a * uI * vA * 0.7, 1.0);
      }
    `,
  });
  {
    const rand = mulberry32(31);
    const data = new Float32Array(STREAKS * 4);
    const h = (CHIP - 0.2) / 2;
    for (let i = 0; i < STREAKS; i++) {
      let x: number;
      let z: number;
      if (rand() < 0.8) {
        // curtain along the plate's edge
        const s = (rand() * 2 - 1) * h;
        const side = Math.floor(rand() * 4);
        const inset = h - rand() * rand() * 0.5;
        x = side === 0 ? s : side === 1 ? inset : side === 2 ? s : -inset;
        z = side === 0 ? inset : side === 1 ? s : side === 2 ? -inset : s;
      } else {
        x = (rand() * 2 - 1) * h;
        z = (rand() * 2 - 1) * h;
      }
      data.set([x, z, rand(), 0.5 + rand() * 0.9], i * 4);
    }
    streakGeo.setAttribute("aData", new THREE.InstancedBufferAttribute(data, 4));
    const mesh = new THREE.InstancedMesh(streakGeo, streakMat, STREAKS);
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    scene.add(mesh);
    disposables.push(streakGeo, streakMat);
  }

  // --------------------------------------------------------- energy traces
  const traceMat = new THREE.ShaderMaterial({
    uniforms: {
      ...L,
      uTime,
      uTraceE: { value: 0 },
      uHead: { value: 0 },
      uPxScale: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec3 aPerp;
      attribute vec2 aInfo; // path distance from the socket, seed
      varying float vD, vSeed, vA;
      uniform float uPxScale;
      void main() {
        vD = aInfo.x;
        vSeed = aInfo.y;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec4 clip = projectionMatrix * viewMatrix * w;
        float px = clip.w * uPxScale;
        float half0 = 0.028;
        float halfW = max(half0, px * 0.6);
        vA = half0 / halfW;
        w.xyz += aPerp * halfW;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying float vD, vSeed, vA;
      uniform float uTime, uTraceE, uHead;
      ${LIGHT_GLSL}
      void main() {
        vec3 col = vec3(0.026, 0.03, 0.038);                        // bare copper
        col += vec3(0.8, 0.88, 1.0) * exp(-vD / 1.3) * uGlow * 0.16;  // lit by the socket
        float behind = smoothstep(uFront + 0.4, uFront - 2.0, vD);
        float flow = 0.55 + 0.45 * sin(vD * 2.2 - uTime * 7.0 + vSeed * 6.283);
        float reach = exp(-vD / 9.0);
        col += uEnergyColor * 1.9 * uTraceE * behind * flow * (0.35 + 0.65 * reach);
        float head = exp(-pow((vD - uFront) / 0.9, 2.0)) * uHead;
        col += (uEnergyColor + vec3(0.4, 0.55, 0.6)) * head * 1.8;
        gl_FragColor = vec4(col * vA, 1.0);
      }
    `,
  });
  {
    const paths = buildTraces();
    const pos: number[] = [];
    const perp: number[] = [];
    const info: number[] = [];
    const idx: number[] = [];
    const quad = (
      ax: number,
      az: number,
      bx: number,
      bz: number,
      d0: number,
      d1: number,
      seed: number,
      widen = 1,
    ) => {
      const dx = bx - ax;
      const dz = bz - az;
      const l = Math.hypot(dx, dz) || 1;
      const nx = (-dz / l) * widen;
      const nz = (dx / l) * widen;
      // extend a hair so mitred corners do not show gaps
      const ex = (dx / l) * 0.02;
      const ez = (dz / l) * 0.02;
      const base = pos.length / 3;
      pos.push(ax - ex, 0.012, az - ez, ax - ex, 0.012, az - ez, bx + ex, 0.012, bz + ez, bx + ex, 0.012, bz + ez);
      perp.push(-nx, 0, -nz, nx, 0, nz, -nx, 0, -nz, nx, 0, nz);
      info.push(d0, seed, d0, seed, d1, seed, d1, seed);
      idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    };
    for (const p of paths) {
      let d = 0;
      for (let i = 0; i < p.pts.length - 1; i++) {
        const [ax, az] = p.pts[i];
        const [bx, bz] = p.pts[i + 1];
        const l = Math.hypot(bx - ax, bz - az);
        quad(ax, az, bx, bz, d, d + l, p.seed);
        d += l;
      }
      const [ex, ez] = p.pts[p.pts.length - 1];
      quad(ex - 0.05, ez, ex + 0.05, ez, d, d, p.seed, 3.2); // end pad
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("aPerp", new THREE.Float32BufferAttribute(perp, 3));
    geo.setAttribute("aInfo", new THREE.Float32BufferAttribute(info, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, traceMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    scene.add(mesh);
    disposables.push(geo, traceMat);
  }

  // ---------------------------------------------- shock-front light motes
  const MOTES = 900;
  const moteMat = new THREE.ShaderMaterial({
    uniforms: { ...L, uPx: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      varying float vI;
      uniform float uPx;
      uniform float uFront, uRing;
      void main() {
        float r = length(position.xz);
        vI = exp(-pow((r - uFront) / (1.3 + aSeed), 2.0)) * uRing * (0.4 + aSeed);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp((0.16 + aSeed * 0.22) * uPx / -mv.z, 1.0, 120.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying float vI;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = 1.0 - smoothstep(0.55, 1.0, d);
        gl_FragColor = vec4(vec3(0.16, 0.5, 1.0) * a * vI * 2.4, 1.0);
      }
    `,
  });
  {
    const rand = mulberry32(77);
    const pos = new Float32Array(MOTES * 3);
    const seed = new Float32Array(MOTES);
    for (let i = 0; i < MOTES; i++) {
      const r = 4.5 + rand() * 24;
      const a = rand() * Math.PI * 2;
      pos.set([Math.cos(a) * r, 0.08 + rand() * 0.5, Math.sin(a) * r], i * 3);
      seed[i] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const pts = new THREE.Points(geo, moteMat);
    pts.frustumCulled = false;
    pts.renderOrder = 6;
    scene.add(pts);
    disposables.push(geo, moteMat);
  }

  // impact flash (camera-facing glow)
  const flashMat = new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0 } },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uI;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = exp(-d * d * 5.0) + 0.35 * exp(-d * d * 1.6);
        gl_FragColor = vec4(vec3(0.75, 0.86, 1.0) * a * uI * (1.0 - smoothstep(0.8, 1.0, d)), 1.0);
      }
    `,
  });
  const flash = addMesh(new THREE.PlaneGeometry(15, 15), flashMat, 0.6);
  flash.renderOrder = 10;

  // ------------------------------------------------------------ post chain
  // Depth is rendered separately (opaque geometry only) for depth of field.
  const depthTarget = new THREE.WebGLRenderTarget(pxW, pxH, {
    depthTexture: new THREE.DepthTexture(pxW, pxH),
  });
  depthTarget.depthTexture!.type = THREE.UnsignedIntType;
  const target = new THREE.WebGLRenderTarget(pxW, pxH, {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(dpr);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  const dof = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: depthTarget.depthTexture },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uFocus: { value: 15 },
      uAperture: { value: 1 },
      uMaxR: { value: new THREE.Vector2(0.01, 0.01) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDiffuse, tDepth;
      uniform float uNear, uFar, uFocus, uAperture;
      uniform vec2 uMaxR;
      float viewZ(vec2 uv) {
        float d = texture2D(tDepth, uv).x;
        float ndc = d * 2.0 - 1.0;
        return 2.0 * uNear * uFar / (uFar + uNear - ndc * (uFar - uNear));
      }
      float coc(float z) {
        return clamp(abs(z - uFocus) / z * uAperture, 0.0, 1.0);
      }
      void main() {
        float c0 = coc(viewZ(vUv));
        vec3 acc = texture2D(tDiffuse, vUv).rgb;
        float wsum = 1.0;
        const int N = 22;
        for (int i = 0; i < N; i++) {
          float fi = float(i) + 0.5;
          float r = sqrt(fi / float(N));
          float a = fi * 2.39996323;
          vec2 o = vec2(cos(a), sin(a)) * r;
          vec2 uv = vUv + o * uMaxR * c0;
          // samples that are themselves sharp contribute less (keeps the
          // in-focus chip from bleeding into the blurred background)
          float cs = coc(viewZ(uv));
          float w = mix(0.15, 1.0, smoothstep(0.0, 0.35, cs / max(c0, 0.001)));
          acc += texture2D(tDiffuse, uv).rgb * w;
          wsum += w;
        }
        gl_FragColor = vec4(acc / wsum, 1.0);
      }
    `,
  });
  composer.addPass(dof);
  const bloom = new UnrealBloomPass(new THREE.Vector2(pxW, pxH), 0.7, 0.6, 0.62);
  composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uExposure: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform float uExposure;
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure;
        vec2 d = vUv - 0.5;
        c *= 1.0 - 0.6 * smoothstep(0.3, 1.0, length(d * vec2(1.0, 0.85)) * 1.4);
        c = c / (1.0 + max(max(c.r, c.g), c.b) * 0.1);
        c = pow(c, vec3(0.93)) * vec3(0.97, 1.0, 1.06);
        float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        c += (n - 0.5) / 255.0;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  composer.addPass(grade);

  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  const hiddenInDepth: THREE.Object3D[] = [];
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && m.depthWrite === false && o !== board) hiddenInDepth.push(o);
  });

  // --------------------------------------------------------------- animate
  const render = (t: number) => {
    const cam = camAt(t);
    camera.position.set(cam.px, cam.py, cam.pz);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, cam.ty, 0);
    camera.rotateZ(cam.roll);
    camera.updateMatrixWorld();

    const dt = t - IMPACT;
    const after = dt > 0;
    uTime.value = t;
    const approach = smooth((t - 1.0) / 1.9);
    L.uGlow.value =
      0.55 + 0.05 * Math.sin(t * 2.3) + (after ? 0.9 * Math.exp(-dt * 3.2) + 0.25 : approach * 0.2);
    L.uEnergy.value = after ? 0.95 * Math.exp(-dt * 0.95) + 0.03 : approach * 0.16;
    L.uFront.value = after ? dt * 11.5 : -10;
    L.uRing.value = after ? Math.exp(-dt * 1.0) * smooth(dt / 0.15) : 0;
    traceMat.uniforms.uTraceE.value = after ? 0.1 + 1.0 * Math.exp(-dt * 0.85) : 0;
    traceMat.uniforms.uHead.value = after ? Math.exp(-dt * 0.9) : 0;
    const pxScale = (2 * Math.tan((FOV * Math.PI) / 360)) / pxH;
    traceMat.uniforms.uPxScale.value = pxScale;
    streakMat.uniforms.uPxScale.value = pxScale;
    moteMat.uniforms.uPx.value = pxH / (2 * Math.tan((FOV * Math.PI) / 360));

    // plate + rain
    const py = plateHeight(t);
    plate.visible = !after;
    plate.position.y = py + 0.035;
    plate.rotation.y = 0;
    plate.rotation.z = Math.sin(t * 1.3) * 0.015 * (1 - approach);
    streakMat.uniforms.uPlateY.value = py;
    streakMat.uniforms.uI.value = after ? 0 : smooth((t - 1.0) / 0.6) * (0.55 + 0.45 * smooth((py - 0.7) / 0.6));

    // chip face
    faceMat.uniforms.uHolo.value = after ? 1 : 0;
    faceMat.uniforms.uWipe.value = smooth((t - 4.45) / 0.95);
    const flashI = after ? Math.exp(-dt * 5.0) : smooth((t - (IMPACT - 0.2)) / 0.2) * 0.3;
    faceMat.uniforms.uFlash.value = flashI * 1.0;
    flashMat.uniforms.uI.value = flashI * 0.5;
    flash.quaternion.copy(camera.quaternion);
    grade.uniforms.uExposure.value = 1.0 + flashI * 0.3;

    // depth of field: focus on the chip, wide open during the impact swing
    dof.uniforms.uFocus.value = cam.dist;
    dof.uniforms.uAperture.value = 1.25 + 0.9 * (after ? Math.exp(-dt * 2.2) : 0);
    const maxR = 0.0115;
    dof.uniforms.uMaxR.value.set(maxR * (pxH / pxW), maxR);

    // depth prepass
    for (const o of hiddenInDepth) o.visible = false;
    const plateVisible = plate.visible;
    scene.overrideMaterial = depthOnly;
    renderer.setRenderTarget(depthTarget);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    scene.overrideMaterial = null;
    for (const o of hiddenInDepth) o.visible = true;
    plate.visible = plateVisible;

    composer.render();
  };

  return {
    render,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      depthOnly.dispose();
      depthTarget.dispose();
      target.dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
};
