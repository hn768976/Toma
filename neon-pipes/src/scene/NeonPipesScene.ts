import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { SceneFactory } from "../ThreeStage";
import type { NeonPalette } from "../palettes";
import { roundedPath, strokeOutline, type V2 } from "./paths";

/* ------------------------------------------------------------------ */
/* Layout constants (world units)                                       */
/* ------------------------------------------------------------------ */
const BAR = 0.62; // square bar cross-section
const LO = 0.36; // centre height of low bars
const HI = 1.9; // centre height of high bars
const PERIOD = 4.8; // repeat distance of the chain pattern along +X
const WIRE_R = 0.034; // wire tube radius
const OUTLINE_D = 0.46; // wire outline offset from bar centre line

export type CameraRig = {
  /** Distance travelled along the chain over the whole clip (world units). */
  travel: number;
  /** Start position on the chain. */
  startX: number;
  /** Camera elevation in degrees. */
  elevation: number;
  /** Azimuth in degrees (rotates the chain diagonal on screen). */
  azimuth: number;
  /** Gentle oscillation amplitude of the azimuth (deg). */
  azimuthSway: number;
  /** Gentle oscillation of the elevation (deg). */
  elevationSway: number;
  distance: number;
  fov: number;
  /** Lateral (z) offset of the look-at target. */
  lateral: number;
  /** Camera roll in degrees. */
  roll: number;
};

/**
 * Long-lens, near-orthographic view like the reference. The camera travels
 * exactly one pattern period over the clip, so the last frame flows straight
 * back into the first (seamless loop).
 */
export const referenceRig: CameraRig = {
  travel: PERIOD,
  startX: 0,
  elevation: 60,
  azimuth: 39,
  azimuthSway: 1.5,
  elevationSway: 1.2,
  distance: 28,
  fov: 17,
  lateral: 0.2,
  roll: 0,
};

/* deterministic PRNG */
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type Bracket = { y: number; pts: V2[] };

/** One repeat of the interlocking chain; `m` mirrors it across the chain axis. */
const periodBrackets = (
  x: number,
  m: number,
): { brackets: Bracket[]; posts: V2[] } => {
  const brackets: Bracket[] = [
    // high "C" bracket opening across the chain
    {
      y: HI,
      pts: [
        [x + 0.0, 1.55 * m],
        [x + 0.0, -1.25 * m],
        [x + 2.9, -1.25 * m],
        [x + 2.9, 0.35 * m],
      ],
    },
    // low "L" bracket running underneath and into the next link
    {
      y: LO,
      pts: [
        [x + 1.45, -2.1 * m],
        [x + 1.45, 0.95 * m],
        [x + 4.6, 0.95 * m],
      ],
    },
    // high cross bar hooking into the low L of the previous link
    {
      y: HI,
      pts: [
        [x + 1.45, 2.15 * m],
        [x + 4.0, 2.15 * m],
      ],
    },
  ];
  const posts: V2[] = [
    [x + 2.9, 0.35 * m],
    [x + 1.45, 2.15 * m],
    [x + 0.0, 1.55 * m],
  ];
  return { brackets, posts };
};

/* ------------------------------------------------------------------ */
/* Wire shader: lit coloured tube with a travelling emissive pulse      */
/* ------------------------------------------------------------------ */
const wireVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vPosV;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vPosV = mv.xyz;
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

const wireFragment = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uGlow;
  uniform vec3 uLightDir;
  uniform vec3 uSky;
  uniform vec3 uGround;
  uniform float uLen;
  uniform float uHead;
  uniform float uSeg;
  uniform float uLit;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vPosV;
  void main() {
    vec3 n = normalize(vNormalV);
    vec3 v = normalize(-vPosV);
    float diff = max(dot(n, uLightDir), 0.0);
    vec3 h = normalize(uLightDir + v);
    float spec = pow(max(dot(n, h), 0.0), 40.0) * 0.35;
    float hemi = n.y * 0.5 + 0.5;
    vec3 amb = mix(uGround, uSky, hemi) * 0.35;
    vec3 col = uBase * (amb + diff * 0.95) + vec3(spec);

    // travelling pulse along the arc-length parameter
    float s = vUv.x * uLen;
    float d = uHead - s;              // distance behind the head
    float inside = step(0.0, d) * step(d, uSeg);
    float soft = smoothstep(0.0, 0.06, d) * (1.0 - smoothstep(uSeg - 0.25, uSeg, d));
    float k = max(inside * soft, uLit);
    float core = 0.55 + 0.45 * pow(max(dot(n, v), 0.0), 0.5);
    col = mix(col, uGlow * core, k);
    gl_FragColor = vec4(col, 1.0);
  }
`;

type Wire = {
  mesh: THREE.Mesh<THREE.TubeGeometry, THREE.ShaderMaterial>;
  len: number;
  speed: number;
  phase: number;
  seg: number;
  gap: number;
};

const makeStripeTexture = (palette: NeonPalette) => {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = palette.stripe;
  // 4 stripes per tile, each ~16% of the pitch
  const pitch = size / 4;
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(0, i * pitch, size, pitch * 0.14);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 16;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
};

export const createNeonPipesScene =
  (palette: NeonPalette, rig: CameraRig): SceneFactory =>
  (renderer, width, height, fps, durationInFrames) => {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.clear);

    const camera = new THREE.PerspectiveCamera(
      rig.fov,
      width / height,
      0.5,
      200,
    );

    /* lights */
    const hemi = new THREE.HemisphereLight(
      new THREE.Color(palette.ambientSky),
      new THREE.Color(palette.ambientGround),
      0.75,
    );
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.left = -16;
    sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 16;
    sun.shadow.camera.bottom = -16;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 10;
    sun.shadow.intensity = 0.42;
    scene.add(sun);
    scene.add(sun.target);
    const sunOffset = new THREE.Vector3(-6, 18, 9);

    /* ground */
    const stripeTex = makeStripeTexture(palette);
    const groundSize = 260;
    stripeTex.repeat.set(groundSize / 1.25, groundSize / 1.25);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundSize, groundSize),
      new THREE.MeshStandardMaterial({
        map: stripeTex,
        roughness: 0.95,
        metalness: 0,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    // stripes run across the chain at an angle, like the reference
    ground.rotation.z = THREE.MathUtils.degToRad(84);
    ground.receiveShadow = true;
    scene.add(ground);

    /* structure */
    const barMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.bar),
      roughness: 0.62,
      metalness: 0.0,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.cap),
      emissive: new THREE.Color(palette.cap),
      emissiveIntensity: 0.55,
      roughness: 0.4,
    });
    const capGeo = new THREE.SphereGeometry(WIRE_R * 1.9, 16, 12);
    const geoCache = new Map<string, THREE.BufferGeometry>();
    const boxGeo = (sx: number, sy: number, sz: number) => {
      const key = `${sx.toFixed(3)}_${sy.toFixed(3)}_${sz.toFixed(3)}`;
      let g = geoCache.get(key);
      if (!g) {
        g = new RoundedBoxGeometry(sx, sy, sz, 4, 0.12);
        geoCache.set(key, g);
      }
      return g;
    };

    const lightDirV = new THREE.Vector3();
    const wires: Wire[] = [];
    const wireUniformsShared = {
      uLightDir: { value: lightDirV },
      uSky: { value: new THREE.Color(palette.ambientSky) },
      uGround: { value: new THREE.Color(palette.ambientGround) },
    };
    const glowColor = new THREE.Color(palette.glow).multiplyScalar(1.45);
    const baseWire = new THREE.Color(palette.wire);
    // re-seeded for every period so all periods are identical (needed for the seamless loop)
    let rand = mulberry32(7);
    let periodIndex = 0;
    const loopSeconds = durationInFrames / fps;

    const addWire = (
      path: THREE.Curve<THREE.Vector3>,
      closed: boolean,
      opts: { speed: number; seg: number; lit?: number },
    ) => {
      const len = path.getLength();
      const segs = Math.max(16, Math.ceil(len * 14));
      const geo = new THREE.TubeGeometry(path, segs, WIRE_R, 8, closed);
      const mat = new THREE.ShaderMaterial({
        vertexShader: wireVertex,
        fragmentShader: wireFragment,
        uniforms: {
          ...wireUniformsShared,
          uBase: { value: baseWire },
          uGlow: { value: glowColor },
          uLen: { value: len },
          uHead: { value: 0 },
          uSeg: { value: opts.seg },
          uLit: { value: opts.lit ?? 0 },
        },
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      scene.add(mesh);
      // Shift each period's pulse phase by one loop's worth of travel so that,
      // after the camera advances one period, period k+1 at the end matches
      // period k at the start.
      wires.push({
        mesh,
        len,
        speed: opts.speed,
        phase: rand() * 50 - periodIndex * opts.speed * loopSeconds,
        seg: opts.seg,
        gap: 3 + rand() * 6,
      });
    };

    const addCap = (p: THREE.Vector3) => {
      const s = new THREE.Mesh(capGeo, capMat);
      s.position.copy(p);
      scene.add(s);
    };

    const addBar = (a: THREE.Vector3, b: THREE.Vector3) => {
      const d = b.clone().sub(a);
      const sx = Math.abs(d.x) + BAR;
      const sy = Math.abs(d.y) + BAR;
      const sz = Math.abs(d.z) + BAR;
      const m = new THREE.Mesh(boxGeo(sx, sy, sz), barMat);
      m.position.copy(a.clone().add(b).multiplyScalar(0.5));
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    };

    const firstPeriod = -6;
    const lastPeriod = 10;
    for (let k = firstPeriod; k <= lastPeriod; k++) {
      const x0 = k * PERIOD;
      const m = 1;
      rand = mulberry32(7);
      periodIndex = k;
      const { brackets, posts } = periodBrackets(x0, m);
      for (const br of brackets) {
        for (let i = 0; i < br.pts.length - 1; i++) {
          addBar(
            new THREE.Vector3(br.pts[i][0], br.y, br.pts[i][1]),
            new THREE.Vector3(br.pts[i + 1][0], br.y, br.pts[i + 1][1]),
          );
        }
        // outline wire around the bracket, a little above its centre line
        const outline = strokeOutline(br.pts, OUTLINE_D).map(
          (p) => new THREE.Vector3(p[0], br.y + 0.2, p[1]),
        );
        const r1 = rand();
        if (r1 < 0.72) {
          addWire(roundedPath(outline, 0.32, true), true, {
            speed: 5 + rand() * 4,
            seg: 2.2 + rand() * 3.5,
          });
        } else {
          // an open outline that drops down at both ends into glowing caps
          const open = outline.slice(0, Math.ceil(outline.length / 2) + 1);
          const first = open[0].clone();
          const last = open[open.length - 1].clone();
          const pts = [
            first.clone().add(new THREE.Vector3(0, -0.55, 0)),
            ...open,
            last.clone().add(new THREE.Vector3(0, -0.55, 0)),
          ];
          addWire(roundedPath(pts, 0.25, false), false, {
            speed: 4 + rand() * 4,
            seg: 2 + rand() * 2.5,
          });
          addCap(pts[0]);
          addCap(pts[pts.length - 1]);
        }
        // a lower belt wire on some brackets
        if (rand() < 0.45) {
          const belt = strokeOutline(br.pts, OUTLINE_D * 0.86).map(
            (p) => new THREE.Vector3(p[0], br.y - 0.26, p[1]),
          );
          addWire(roundedPath(belt, 0.28, true), true, {
            speed: 3 + rand() * 3,
            seg: 1.2 + rand() * 1.8,
          });
        }
        // little hanging drops with caps at the bracket end
        const end = br.pts[br.pts.length - 1];
        const prev = br.pts[br.pts.length - 2];
        const dir = new THREE.Vector2(
          end[0] - prev[0],
          end[1] - prev[1],
        ).normalize();
        // starts exactly on the straight end segment of the outline wire
        const tip = new THREE.Vector3(
          end[0] + dir.x * OUTLINE_D,
          br.y + 0.2,
          end[1] + dir.y * OUTLINE_D,
        );
        const dropLen = 0.45 + rand() * 0.35;
        const dropPath = new THREE.LineCurve3(
          tip,
          tip.clone().add(new THREE.Vector3(0, -dropLen, 0)),
        );
        addWire(dropPath, false, {
          speed: 1,
          seg: 0,
          lit: rand() < 0.6 ? 1 : 0,
        });
        addCap(tip);
        addCap(tip.clone().add(new THREE.Vector3(0, -dropLen, 0)));
      }
      for (const p of posts) {
        addBar(
          new THREE.Vector3(p[0], LO, p[1]),
          new THREE.Vector3(p[0], HI, p[1]),
        );
        // vertical wire loop around the post
        const off = OUTLINE_D;
        const loop = [
          new THREE.Vector3(p[0] - off, LO - 0.05, p[1] + 0.3),
          new THREE.Vector3(p[0] - off, HI + off, p[1] + 0.3),
          new THREE.Vector3(p[0] + off, HI + off, p[1] + 0.3),
          new THREE.Vector3(p[0] + off, LO - 0.05, p[1] + 0.3),
        ];
        addWire(roundedPath(loop, 0.22, false), false, {
          speed: 3 + rand() * 2,
          seg: 0.9 + rand() * 0.8,
          lit: rand() < 0.25 ? 1 : 0,
        });
        addCap(loop[0]);
        addCap(loop[3]);
      }
    }

    /* post-processing */
    const composer = new EffectComposer(
      renderer,
      new THREE.WebGLRenderTarget(width, height, {
        type: THREE.HalfFloatType,
      }),
    );
    composer.setPixelRatio(1);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(width / 2, height / 2),
      0.38,
      0.25,
      0.95,
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const target = new THREE.Vector3();
    const offset = new THREE.Vector3();

    const render = (frame: number) => {
      const t = frame / fps;
      const p = frame / durationInFrames; // frame 270 == frame 0
      const tau = Math.PI * 2;
      const az = THREE.MathUtils.degToRad(
        rig.azimuth + rig.azimuthSway * Math.sin(tau * (t / 4.5)),
      );
      const el = THREE.MathUtils.degToRad(
        rig.elevation + rig.elevationSway * Math.sin(tau * (t / 3) + 1.1),
      );
      target.set(rig.startX + rig.travel * p, 0.9, rig.lateral);
      offset
        .set(
          Math.cos(el) * Math.sin(az),
          Math.sin(el),
          Math.cos(el) * Math.cos(az),
        )
        .multiplyScalar(rig.distance);
      camera.position.copy(target).add(offset);
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      if (rig.roll !== 0) {
        camera.rotateZ(THREE.MathUtils.degToRad(rig.roll));
      }
      camera.updateMatrixWorld();

      // the striped floor travels with the camera: stripes stay fixed on screen as in the reference
      ground.position.set(target.x, 0, target.z);
      sun.position.copy(target).add(sunOffset);
      sun.target.position.copy(target);
      sun.target.updateMatrixWorld();

      // light direction in view space for the custom wire shader
      lightDirV
        .copy(sunOffset)
        .normalize()
        .transformDirection(camera.matrixWorldInverse);

      for (const w of wires) {
        const u = w.mesh.material.uniforms;
        const cycle = w.len + w.seg + w.gap;
        u.uHead.value = ((w.phase + t * w.speed) % cycle) - w.gap * 0.5;
      }
      composer.render();
    };

    return {
      render,
      dispose: () => {
        composer.dispose();
        scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
        });
        stripeTex.dispose();
      },
    };
  };
