import * as THREE from "three";
import type { SceneFactory } from "../lib/GLCanvas";
import { PostFX } from "../lib/postfx";
import { mulberry32, smoothstep } from "../lib/random";
import {
  gridTexture,
  lineTexture,
  radialTexture,
  screenTexture,
  shaftTexture,
} from "./textures";
import { buildWorldParticles } from "./worldParticles";

export type CameraMode = "reference" | "orbit";

const DEG = Math.PI / 180;

// Look: cool white-blue light on teal-black, grey-white speckled map.
const BG = new THREE.Color(0.0, 0.0055, 0.006); // linear
const LIGHT = new THREE.Color(0.8, 0.9, 0.98);
const LIGHT_BLUE = new THREE.Color(0.35, 0.55, 0.85);
const BG_SCREEN = new THREE.Color(0.32, 0.45, 0.5);
const ORANGE = new THREE.Color(1.0, 0.55, 0.18);
const MAP_COLOR = new THREE.Color(0.86, 0.9, 0.93);
const LIFT = new THREE.Color(0.0, 0.0125, 0.0135);
const TEAL_HAZE = new THREE.Color(0.36, 0.5, 0.52);

const FOV = 35;
const MAP_FOCUS = new THREE.Vector3(-0.8, -0.1, 0);

/**
 * Version 1: locked-off camera (as in the reference) — only the light
 * structure behind the map drifts. Version 2: a slow low-angle orbital crane
 * across the map that rises to a near-frontal view, revealing depth/parallax.
 */
const cameraFor = (mode: CameraMode, t: number) => {
  if (mode === "reference") {
    return {
      position: new THREE.Vector3(0.02 * t, 0, 12.0 - 0.012 * t),
      target: new THREE.Vector3(0.02 * t, 0, 0),
      roll: 0,
    };
  }
  // eased 0..1 over the 10 s shot
  const u = Math.min(1, Math.max(0, t / 10));
  const e = u * u * (3 - 2 * u);
  const lerp = (a: number, b: number) => a + (b - a) * e;
  const yaw = lerp(-38, 10) * DEG;
  const pitch = lerp(-17, 5) * DEG;
  const dist = lerp(8.6, 12.4);
  const roll = lerp(6, -1.5) * DEG;
  const target = new THREE.Vector3(lerp(-2.2, -0.45), lerp(0.5, -0.05), 0);
  const cp = Math.cos(pitch);
  const position = new THREE.Vector3(
    target.x + dist * Math.sin(yaw) * cp,
    target.y + dist * Math.sin(pitch),
    target.z + dist * Math.cos(yaw) * cp,
  );
  return { position, target, roll };
};

type Animated = {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  base: THREE.Vector3;
  intensity: number;
  color: THREE.Color;
  period: number;
  phase: number;
  speed: number; // slide speed along local x (units/s)
  permanent: boolean;
};

export const makeWorldMapFactory =
  (mode: CameraMode): SceneFactory =>
  ({ renderer, width, height, fps }) => {
    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(d: T) => {
      disposables.push(d);
      return d;
    };
    const tex = (canvas: HTMLCanvasElement) => {
      const t = track(new THREE.CanvasTexture(canvas));
      t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.anisotropy = 4;
      return t;
    };
    const plane = (w: number, h: number) => track(new THREE.PlaneGeometry(w, h));
    const glowMat = (map: THREE.Texture, color: THREE.Color, k: number, depth = true) => {
      const m = track(
        new THREE.MeshBasicMaterial({
          map,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: depth,
          alphaTest: depth ? 0.08 : 0,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      m.color.copy(color).multiplyScalar(k);
      return m;
    };

    const lineTex = tex(lineTexture());
    const shaftTex = tex(shaftTexture());
    const radialTex = tex(radialTexture());

    const scene = new THREE.Scene();
    scene.background = BG.clone();
    const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.3, 200);

    const city = new THREE.Group();
    scene.add(city);
    const animated: Animated[] = [];
    const rnd = mulberry32(31337);
    const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;

    const addAnimated = (a: Omit<Animated, "base">) => {
      animated.push({ ...a, base: a.mesh.position.clone() });
    };

    // --- far background: dim screens / building windows ---
    for (let i = 0; i < 22; i++) {
      const w = 2.5 + rnd() * 5;
      const h = 2 + rnd() * 6;
      const m = glowMat(tex(screenTexture(500 + i, 0.6 + rnd() * 0.5)), BG_SCREEN, 0.16 + rnd() * 0.18);
      const mesh = new THREE.Mesh(plane(w, h), m);
      mesh.position.set(-12 + rnd() * 26, -4 + rnd() * 9, -15 - rnd() * 6);
      city.add(mesh);
    }

    // --- mid screens (glass panels with data cells), some as side walls ---
    for (let i = 0; i < 34; i++) {
      const w = 0.6 + rnd() * 2.2;
      const h = 0.5 + rnd() * 2.6;
      const bright = 0.5 + rnd() * 0.7;
      const m = glowMat(tex(screenTexture(100 + i, bright)), LIGHT, 0.3 + rnd() * 0.5);
      const mesh = new THREE.Mesh(plane(w, h), m);
      mesh.position.set(0.4 + gauss() * 3.4, 0.1 + gauss() * 1.6, -1.8 - rnd() * 9);
      if (rnd() < 0.35) mesh.rotation.y = (rnd() < 0.5 ? -1 : 1) * (1.2 + rnd() * 0.3);
      city.add(mesh);
      addAnimated({
        mesh,
        mat: m,
        intensity: m.color.r / LIGHT.r,
        color: LIGHT,
        period: 4 + rnd() * 6,
        phase: rnd() * 10,
        speed: 0,
        permanent: rnd() < 0.6,
      });
    }

    // --- perspective light floors (grids seen at grazing angles) ---
    for (let i = 0; i < 3; i++) {
      const m = glowMat(tex(gridTexture(70 + i)), LIGHT, 0.35 + i * 0.12);
      const mesh = new THREE.Mesh(plane(7 + i * 2, 9), m);
      mesh.rotation.x = -Math.PI / 2 + 0.12;
      mesh.position.set(0.6 + i * 0.4, -0.55 + i * 0.5, -5.5 - i * 0.5);
      city.add(mesh);
    }

    // --- horizontal light strips ("floors" of data) ---
    for (let i = 0; i < 130; i++) {
      const len = 0.5 + Math.pow(rnd(), 1.6) * 4.5;
      const thick = 0.02 + rnd() * 0.05;
      const k = 0.22 + Math.pow(rnd(), 3) * 1.1;
      const m = glowMat(lineTex, LIGHT, k);
      const mesh = new THREE.Mesh(plane(len, thick * 4), m);
      const level = (Math.floor(rnd() * 12) - 6) * 0.19;
      mesh.position.set(0.3 + gauss() * 3.0, 0.05 + level, -1.5 - rnd() * 8.5);
      city.add(mesh);
      addAnimated({
        mesh,
        mat: m,
        intensity: k,
        color: LIGHT,
        period: 3 + rnd() * 6,
        phase: rnd() * 10,
        speed: (rnd() - 0.5) * 0.8,
        permanent: rnd() < 0.3,
      });
    }

    // --- vertical beams ---
    for (let i = 0; i < 46; i++) {
      const h = 0.4 + Math.pow(rnd(), 1.3) * 2.8;
      const k = 0.2 + Math.pow(rnd(), 3) * 1.0;
      const m = glowMat(lineTex, LIGHT, k);
      const mesh = new THREE.Mesh(plane(h, 0.12 + rnd() * 0.12), m);
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set(0.2 + gauss() * 2.6, 0.2 + gauss() * 0.9, -1.6 - rnd() * 8);
      city.add(mesh);
      addAnimated({
        mesh,
        mat: m,
        intensity: k,
        color: LIGHT,
        period: 4 + rnd() * 5,
        phase: rnd() * 10,
        speed: 0,
        permanent: rnd() < 0.4,
      });
    }

    // --- bright core glow + volumetric haze ---
    for (let i = 0; i < 5; i++) {
      const haze = new THREE.Mesh(
        plane(7 + rnd() * 6, 3 + rnd() * 3),
        glowMat(radialTex, i % 2 ? TEAL_HAZE : LIGHT, 0.018 + rnd() * 0.02, false),
      );
      haze.position.set(0.2 + gauss() * 1.5, 0.1 + gauss() * 0.6, -4 - rnd() * 5);
      city.add(haze);
    }

    // --- light shafts raking down-left from the core ---
    const shafts: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; k: number; ph: number }> = [];
    for (let i = 0; i < 11; i++) {
      const len = 4 + rnd() * 4;
      const wdt = 0.3 + rnd() * 1.0;
      const k = 0.1 + rnd() * 0.14;
      const geo = plane(len, wdt);
      geo.translate(len / 2, 0, 0); // origin at the bright end
      const m = glowMat(shaftTex, LIGHT, k, false);
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(0.8 + gauss() * 0.8, 0.0 + gauss() * 0.4, -2.5 - rnd() * 2);
      mesh.rotation.z = (196 + rnd() * 20) * DEG;
      city.add(mesh);
      shafts.push({ mesh, mat: m, k, ph: rnd() * 6 });
    }

    // --- main long horizontal beam with a red end marker ---
    const beamMat = glowMat(lineTex, LIGHT, 1.3);
    const beam = new THREE.Mesh(plane(11.5, 0.17), beamMat);
    beam.position.set(1.4, -0.12, -0.7);
    beam.rotation.z = -2.2 * DEG;
    scene.add(beam);
    const redMat = glowMat(radialTex, new THREE.Color(1, 0.15, 0.1), 1.6, false);
    const red = new THREE.Mesh(plane(0.075, 0.075), redMat);
    red.position.set(7.0, -0.34, -0.7);
    scene.add(red);

    // --- orange specks inside the structure ---
    const speckGeo = track(new THREE.BufferGeometry());
    const speckCount = 90;
    const speckPos = new Float32Array(speckCount * 3);
    const speckPhase = new Float32Array(speckCount);
    for (let i = 0; i < speckCount; i++) {
      speckPos.set([0.5 + gauss() * 2.6, 0.1 + gauss() * 0.9, -1.2 - rnd() * 6], i * 3);
      speckPhase[i] = rnd() * 6.28;
    }
    speckGeo.setAttribute("position", new THREE.BufferAttribute(speckPos, 3));
    speckGeo.setAttribute("aPhase", new THREE.BufferAttribute(speckPhase, 1));
    const speckMat = track(
      new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, color: { value: ORANGE.clone().multiplyScalar(3.0) }, pxScale: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute float aPhase;
          uniform float time;
          uniform float pxScale;
          varying float vA;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = max(2.0, 0.06 * pxScale / -mv.z);
            vA = 0.4 + 0.6 * (0.5 + 0.5 * sin(time * 2.3 + aPhase));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 color;
          varying float vA;
          void main() {
            float d = length(gl_PointCoord * 2.0 - 1.0);
            float a = 1.0 - smoothstep(0.4, 1.0, d);
            gl_FragColor = vec4(color * a * vA, 1.0);
          }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const specks = new THREE.Points(speckGeo, speckMat);
    city.add(specks);

    // --- blurred blue light bar, near the lens, bottom-left ---
    const blueMat = glowMat(lineTex, LIGHT_BLUE, 0.45, false);
    const blueBar = new THREE.Mesh(plane(2.1, 0.16), blueMat);
    blueBar.position.set(-2.0, -1.25, 5.0);
    blueBar.rotation.z = -11 * DEG;
    scene.add(blueBar);

    // --- particle world map (overlay layer with per-particle DOF) ---
    const overlay = new THREE.Scene();
    const particles = buildWorldParticles(90000, 2024, mode === "orbit" ? 0.05 : 0.01);
    const mapGeo = track(new THREE.BufferGeometry());
    mapGeo.setAttribute("position", new THREE.BufferAttribute(particles.positions, 3));
    mapGeo.setAttribute("aSize", new THREE.BufferAttribute(particles.sizes, 1));
    mapGeo.setAttribute("aBright", new THREE.BufferAttribute(particles.brightness, 1));
    mapGeo.setAttribute("aPhase", new THREE.BufferAttribute(particles.phases, 1));
    const pxScale = height / (2 * Math.tan((FOV * DEG) / 2));
    const mapMat = track(
      new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          color: { value: MAP_COLOR.clone().multiplyScalar(0.85) },
          pxScale: { value: pxScale },
          baseSize: { value: 0.0082 },
          focusDistance: { value: 12 },
          focusRange: { value: 0.15 },
          blurRange: { value: 3 },
          maxBlurPx: { value: 20 * (height / 2160) },
          minPx: { value: 1.6 * (height / 2160) },
          sheen: { value: 0 },
        },
        vertexShader: /* glsl */ `
          attribute float aSize;
          attribute float aBright;
          attribute float aPhase;
          uniform float time;
          uniform float pxScale;
          uniform float baseSize;
          uniform float focusDistance;
          uniform float focusRange;
          uniform float blurRange;
          uniform float maxBlurPx;
          uniform float minPx;
          uniform float sheen;
          varying float vA;
          varying float vSharp;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float dist = -mv.z;
            float sizePx = max(minPx, baseSize * aSize * pxScale / dist);
            float coc = clamp((abs(dist - focusDistance) - focusRange) / blurRange, 0.0, 1.0) * maxBlurPx;
            float total = sizePx + coc;
            gl_PointSize = total + 2.0;
            float tw = 0.82 + 0.18 * sin(time * (0.7 + fract(aPhase * 3.7) * 1.6) + aPhase);
            // a slow diagonal light sweep across the continents
            float sweep = exp(-pow((position.x + position.y * 0.6) - sheen, 2.0) * 0.5) * 0.5;
            vA = aBright * tw * (1.0 + sweep) * (sizePx * sizePx) / (total * total);
            vSharp = sizePx / (total + 2.0);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 color;
          varying float vA;
          varying float vSharp;
          void main() {
            float d = length(gl_PointCoord * 2.0 - 1.0);
            float edge = max(vSharp, 0.05);
            float a = 1.0 - smoothstep(edge * 0.55, min(1.0, edge + 0.25), d);
            gl_FragColor = vec4(color * a * vA, 1.0);
          }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    );
    const mapPoints = new THREE.Points(mapGeo, mapMat);
    mapPoints.frustumCulled = false;
    const mapGroup = new THREE.Group();
    mapGroup.add(mapPoints);
    // slight 3D yaw like the reference (right side a touch further away)
    mapGroup.rotation.y = -4 * DEG;
    overlay.add(mapGroup);

    speckMat.uniforms.pxScale.value = pxScale;

    const post = new PostFX(renderer, width, height, { streaks: true });

    return {
      render: (frame) => {
        const t = frame / fps;

        // light-structure drift (parallax motion inside the hologram)
        city.position.set(-0.45 + 0.085 * t, 0.04 * Math.sin(t * 0.4), 0.12 * t);
        city.rotation.y = -0.06 + 0.009 * t;

        for (const a of animated) {
          let env = 1;
          let slide = 0;
          if (!a.permanent) {
            const u = ((t + a.phase) / a.period) % 1;
            env = Math.pow(Math.sin(Math.PI * u), 1.5);
            slide = a.speed * (u - 0.5) * a.period;
          } else {
            env = 0.8 + 0.2 * Math.sin(t * (6.28 / a.period) + a.phase);
          }
          a.mesh.position.set(a.base.x + slide, a.base.y, a.base.z);
          a.mat.color.copy(a.color).multiplyScalar(a.intensity * env);
          a.mesh.visible = env > 0.002;
        }
        for (const s of shafts) {
          const k = s.k * (0.75 + 0.25 * Math.sin(t * 0.9 + s.ph));
          s.mat.color.copy(LIGHT).multiplyScalar(k);
        }
        beamMat.color.copy(LIGHT).multiplyScalar(1.3 * (0.9 + 0.1 * Math.sin(t * 3.1)));
        blueMat.color.copy(LIGHT_BLUE).multiplyScalar(0.45 * smoothstep(0.4, 1.8, t));
        speckMat.uniforms.time.value = t;

        const cam = cameraFor(mode, t);
        camera.position.copy(cam.position);
        camera.up.set(0, 1, 0);
        camera.lookAt(cam.target);
        camera.rotateZ(cam.roll);
        camera.updateMatrixWorld();

        const focus = camera.position.distanceTo(mode === "reference" ? cam.target : MAP_FOCUS);
        mapMat.uniforms.time.value = t;
        mapMat.uniforms.focusDistance.value = focus;
        mapMat.uniforms.sheen.value = -9 + 1.6 * t;

        post.render(
          scene,
          camera,
          {
            focusDistance: focus,
            focusRange: 0.8,
            blurRangeNear: 3.0,
            blurRangeFar: 11,
            maxBlur: 0.022,
            bloomStrength: 0.22,
            bloomThreshold: 0.7,
            bloomKnee: 0.4,
            streakStrength: 0.08,
            streakThreshold: 1.1,
            streakTint: new THREE.Color(0.75, 0.88, 1.0),
            exposure: 0.9,
            contrast: 1.06,
            saturation: 0.92,
            lift: LIFT,
            vignette: 0.4,
            grain: 0.03,
            aberration: 0.0018,
            seed: (frame * 0.618) % 1,
          },
          overlay,
        );
      },
      dispose: () => {
        post.dispose();
        disposables.forEach((d) => d.dispose());
      },
    };
  };
