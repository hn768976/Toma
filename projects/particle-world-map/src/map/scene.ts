import * as THREE from "three";
import type { SceneFactory } from "../lib/GLCanvas";
import { PostFX } from "../lib/postfx";
import { mulberry32, smoothstep } from "../lib/random";
import {
  gridTexture,
  reflectionTexture,
  lineTexture,
  radialTexture,
  screenTexture,
  shaftTexture,
} from "./textures";
import { REFERENCE_MAP_HOMOGRAPHY, buildWorldParticles } from "./worldParticles";

export type CameraMode = "reference" | "orbit";

const DEG = Math.PI / 180;

// Look: cool white-blue light on teal-black, grey-white speckled map.
const BG = new THREE.Color(0.0, 0.0165, 0.018); // linear dark teal
const LIGHT = new THREE.Color(0.88, 0.92, 0.95);
const LIGHT_BLUE = new THREE.Color(0.35, 0.55, 0.85);
const BG_SCREEN = new THREE.Color(0.32, 0.45, 0.5);
const ORANGE = new THREE.Color(1.0, 0.42, 0.08);
const WARM_WHITE = new THREE.Color(1.0, 0.86, 0.66);
const MAP_COLOR = new THREE.Color(0.86, 0.9, 0.93);
const LIFT = new THREE.Color(0.0, 0.0022, 0.0024);
const SLAB = new THREE.Color(0.0, 0.0085, 0.0095);
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
      position: new THREE.Vector3(0, 0, 12.0),
      target: new THREE.Vector3(0, 0, 0),
      roll: 0,
    };
  }
  // eased 0..1 over the 10 s shot
  const u = Math.min(1, Math.max(0, t / 10));
  const e = u * u * (3 - 2 * u);
  const lerp = (a: number, b: number) => a + (b - a) * e;
  const yaw = lerp(-38, 10) * DEG;
  const pitch = lerp(-17, 5) * DEG;
  const dist = lerp(10.2, 12.4);
  const roll = lerp(6, -1.5) * DEG;
  const target = new THREE.Vector3(lerp(-1.8, -0.45), lerp(0.2, -0.05), 0);
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
      const m = glowMat(tex(screenTexture(500 + i, 0.6 + rnd() * 0.5)), BG_SCREEN, 0.07 + rnd() * 0.09);
      const mesh = new THREE.Mesh(plane(w, h), m);
      mesh.position.set(-12 + rnd() * 26, -4 + rnd() * 9, -15 - rnd() * 6);
      city.add(mesh);
    }

    // --- dark out-of-focus vertical shapes (server racks / city) behind ---
    const slabMat = track(new THREE.MeshBasicMaterial({ color: SLAB, toneMapped: false }));
    for (let i = 0; i < 9; i++) {
      const w = 0.8 + rnd() * 2.2;
      const h = 4 + rnd() * 7;
      const mesh = new THREE.Mesh(plane(w, h), slabMat);
      mesh.position.set(-9 + rnd() * 19, -1.5 + h / 2 - rnd() * 2, -9 - rnd() * 5);
      city.add(mesh);
    }

    // --- the "light hall": a glossy floor of light at eye level, seen almost
    // edge-on (it reads as the bright horizontal band), with lit panels and
    // pillars standing on it and their dimmer bluish mirror reflections below.
    // Rolled slightly with the map tilt; drifts slowly for parallax. ---
    const HALL = {
      pos: new THREE.Vector3(-0.1, -0.16, -6.6),
      rotY: -0.22,
      roll: -4.5 * DEG,
      hx: 6.4,
      hz: 4.2,
    };
    const hall = new THREE.Group();
    const hallInner = new THREE.Group();
    hall.position.copy(HALL.pos);
    hall.rotation.set(0, 0, HALL.roll);
    hallInner.rotation.y = HALL.rotY;
    hall.add(hallInner);
    city.add(hall);
    const hallMats: Array<{ mat: THREE.MeshBasicMaterial; color: THREE.Color; k: number }> = [];
    const hallMat = (color: THREE.Color, k: number, map: THREE.Texture | null, depth = true) => {
      const m = glowMat(map ?? lineTex, color, k, depth);
      if (!map) m.map = null;
      hallMats.push({ mat: m, color, k });
      return m;
    };
    const Y = new THREE.Vector3(0, 1, 0);
    const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) => {
      const d = b.clone().sub(a);
      const g = track(new THREE.CylinderGeometry(r, r, d.length(), 6, 1, true));
      const m = new THREE.Mesh(g, mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(Y, d.normalize());
      m.renderOrder = 10 + hallInner.children.length;
      hallInner.add(m);
      return m;
    };
    const REFL = 0.3; // reflection strength
    {
      const { hx, hz } = HALL;
      const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
      // the floor of light (grid), plus a bright leading edge
      const floor = new THREE.Mesh(plane(hx * 2, hz * 2), hallMat(LIGHT, 0.5, tex(gridTexture(70))));
      floor.rotation.x = -Math.PI / 2;
      hallInner.add(floor);
      const floor2 = new THREE.Mesh(plane(hx * 2.4, hz * 2.4), hallMat(TEAL_HAZE, 0.25, tex(reflectionTexture(91)), false));
      floor2.rotation.x = -Math.PI / 2;
      floor2.position.y = -0.02;
      hallInner.add(floor2);
      rod(v(-hx * 0.75, 0.01, hz * 0.55), v(hx * 0.3, 0.01, hz * 0.55), 0.06, hallMat(LIGHT, 0.9, null));

      // pillars standing on the floor, with mirrored reflections below
      for (let i = 0; i < 70; i++) {
        const x = -hx * 0.75 + rnd() * hx * 1.7;
        const z = -hz * 0.8 + rnd() * hz * 1.5;
        const h = 0.4 + Math.pow(rnd(), 1.4) * 2.6;
        const k = 0.24 + Math.pow(rnd(), 2) * 0.85;
        const r = 0.011 + rnd() * 0.022;
        const col = rnd() < 0.25 ? LIGHT_BLUE : LIGHT;
        const mat = glowMat(lineTex, col, k);
        mat.map = null;
        const mesh = rod(v(x, 0, z), v(x, h, z), r, mat);
        const rmat = glowMat(lineTex, LIGHT_BLUE, k * REFL, false);
        rmat.map = null;
        const rmesh = rod(v(x, -h * 0.8, z), v(x, 0, z), r * 1.4, rmat);
        const period = 3 + rnd() * 5;
        const phase = rnd() * 10;
        const permanent = rnd() < 0.5;
        addAnimated({ mesh, mat, intensity: k, color: col, period, phase, speed: 0, permanent });
        addAnimated({ mesh: rmesh, mat: rmat, intensity: k * REFL, color: LIGHT_BLUE, period, phase, speed: 0, permanent });
      }

      // horizontal data shelves at various heights (+ reflections)
      for (let i = 0; i < 26; i++) {
        const x0 = -hx * 0.7 + rnd() * hx * 1.3;
        const len = 0.5 + Math.pow(rnd(), 1.5) * 3.5;
        const y = 0.15 + Math.pow(rnd(), 1.3) * 2.2;
        const z = -hz * 0.7 + rnd() * hz * 1.4;
        const k = 0.2 + Math.pow(rnd(), 2) * 0.8;
        const mat = glowMat(lineTex, LIGHT, k);
        mat.map = null;
        const mesh = rod(v(x0, y, z), v(x0 + len, y, z), 0.018 + rnd() * 0.025, mat);
        const rmat = glowMat(lineTex, LIGHT_BLUE, k * REFL, false);
        rmat.map = null;
        const rmesh = rod(v(x0, -y * 0.9, z), v(x0 + len, -y * 0.9, z), 0.03, rmat);
        const period = 3 + rnd() * 5;
        const phase = rnd() * 10;
        const permanent = rnd() < 0.4;
        addAnimated({ mesh, mat, intensity: k, color: LIGHT, period, phase, speed: 0, permanent });
        addAnimated({ mesh: rmesh, mat: rmat, intensity: k * REFL, color: LIGHT_BLUE, period, phase, speed: 0, permanent });
      }

      // glass data panels standing on the floor (+ reflections)
      for (let i = 0; i < 26; i++) {
        const w = 0.6 + rnd() * 1.8;
        const h = 0.5 + rnd() * 2.0;
        const tx = tex(screenTexture(100 + i, 0.6 + rnd() * 0.6));
        const k = 0.25 + rnd() * 0.35;
        const m = glowMat(tx, LIGHT, k, false);
        const mesh = new THREE.Mesh(plane(w, h), m);
        const x = -hx * 0.7 + rnd() * hx * 1.6;
        const z = -hz * 0.8 + rnd() * hz * 1.4;
        mesh.position.set(x, h / 2 + rnd() * 0.3, z);
        if (rnd() < 0.3) mesh.rotation.y = (rnd() < 0.5 ? -1 : 1) * 1.3;
        hallInner.add(mesh);
        const rm = glowMat(tx, LIGHT_BLUE, k * REFL, false);
        const rmesh = new THREE.Mesh(plane(w, h), rm);
        rmesh.position.set(x, -h / 2 - 0.05, z);
        rmesh.rotation.y = mesh.rotation.y;
        rmesh.scale.y = -1;
        hallInner.add(rmesh);
        const period = 4 + rnd() * 6;
        const phase = rnd() * 10;
        const permanent = rnd() < 0.6;
        addAnimated({ mesh, mat: m, intensity: k, color: LIGHT, period, phase, speed: 0, permanent });
        addAnimated({ mesh: rmesh, mat: rm, intensity: k * REFL, color: LIGHT_BLUE, period, phase, speed: 0, permanent });
      }

      // stacked window dashes on the left (above the floor)

      // soft volume glow just above and below the floor
      for (let i = 0; i < 4; i++) {
        const g = new THREE.Mesh(plane(4 + rnd() * 3, 1.4 + rnd()), hallMat(i % 2 ? LIGHT_BLUE : LIGHT, 0.014, radialTex, false));
        g.position.set(-2 + i * 1.4, (i % 2 ? -0.5 : 0.4), hz * 0.3);
        hallInner.add(g);
      }
    }

    // --- near-field crisp detail (close to the focus plane, so it stays sharp):
    // thin grid lines converging to the right, small data dashes, bright points ---
    {
      const nearGroup = new THREE.Group();
      nearGroup.position.set(0.3, 0.02, -1.6);
      nearGroup.rotation.z = HALL.roll;
      city.add(nearGroup);
      const gridMat = glowMat(tex(gridTexture(77)), LIGHT, 0.5);
      const g = new THREE.Mesh(plane(7.5, 5), gridMat);
      g.rotation.x = -Math.PI / 2 + 0.06;
      g.rotation.z = 0.0;
      const gHolder = new THREE.Group();
      gHolder.rotation.y = -0.55; // lines converge to the right
      gHolder.add(g);
      nearGroup.add(gHolder);
      hallMats.push({ mat: gridMat, color: LIGHT, k: 0.5 });
      // stacked bright window dashes on the left (small, crisp)
      for (let i = 0; i < 7; i++) {
        const m = hallMat(WARM_WHITE, 1.5 + rnd() * 0.7, lineTex);
        const d = new THREE.Mesh(plane(0.3 + rnd() * 0.25, 0.05), m);
        d.position.set(-3.85 + rnd() * 0.2, 0.0 + i * 0.13, 0);
        nearGroup.add(d);
      }
      // scattered small data dashes along the band
      for (let i = 0; i < 34; i++) {
        const k = 0.9 + Math.pow(rnd(), 2) * 1.7;
        const m = glowMat(lineTex, rnd() < 0.3 ? LIGHT_BLUE : LIGHT, k);
        const d = new THREE.Mesh(plane(0.06 + rnd() * 0.25, 0.035), m);
        d.position.set(-2.6 + rnd() * 6.5, -0.25 + rnd() * 0.9, -rnd() * 1.2);
        nearGroup.add(d);
        addAnimated({ mesh: d, mat: m, intensity: k, color: LIGHT, period: 1.5 + rnd() * 3, phase: rnd() * 10, speed: 0, permanent: rnd() < 0.4 });
      }
      // a few thin vertical light lines (crisp)
      for (let i = 0; i < 8; i++) {
        const k = 0.4 + rnd() * 0.6;
        const m = glowMat(lineTex, LIGHT, k);
        const h = 0.4 + rnd() * 1.2;
        const d = new THREE.Mesh(plane(h, 0.05), m);
        d.rotation.z = Math.PI / 2;
        d.position.set(-2.2 + rnd() * 5, h / 2 - 0.05, -0.3 - rnd() * 1.0);
        nearGroup.add(d);
        addAnimated({ mesh: d, mat: m, intensity: k, color: LIGHT, period: 3 + rnd() * 4, phase: rnd() * 10, speed: 0, permanent: rnd() < 0.5 });
      }
    }

    // dim data panels on the right, extending the structure toward the beam end
    for (let i = 0; i < 6; i++) {
      const w = 0.6 + rnd() * 1.0;
      const h = 0.4 + rnd() * 0.9;
      const m = hallMat(LIGHT, 0.18 + rnd() * 0.15, tex(screenTexture(300 + i, 0.8)), false);
      const mesh = new THREE.Mesh(plane(w, h), m);
      mesh.position.set(4.3 + rnd() * 1.8, -0.1 + rnd() * 1.2, -3.2 - rnd() * 1.5);
      mesh.renderOrder = 5;
      city.add(mesh);
    }

    // fixed, deterministic draw order for every element of the structure
    {
      let order = 10;
      city.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.renderOrder = order++;
      });
    }

    // --- light shafts raking down-left / down-right from the core ---
    const shafts: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; k: number; ph: number }> = [];
    for (let i = 0; i < 11; i++) {
      const len = 3.5 + rnd() * 3;
      const wdt = i < 3 ? 0.4 + rnd() * 0.5 : 0.25 + rnd() * 0.45;
      const k = i < 3 ? 0.22 + rnd() * 0.12 : 0.09 + rnd() * 0.08;
      const geo = plane(len, wdt);
      geo.translate(len / 2, 0, 0); // origin at the bright end
      const m = glowMat(shaftTex, LIGHT_BLUE, k * 1.4, false);
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(-1.5 + gauss() * 1.4, 0.0, 1.5 + rnd() * 1.5);
      if (i < 3) {
        mesh.position.set(1.2 + rnd() * 1.2, 0.0, 1.2 + rnd() * 1.5);
        mesh.rotation.z = (-24 - rnd() * 16) * DEG;
      } else {
        mesh.rotation.z = (200 + rnd() * 24) * DEG;
      }
      hall.add(mesh);
      shafts.push({ mesh, mat: m, k, ph: rnd() * 6 });
    }

    // --- main long horizontal beam with a red end marker ---
    const beamMat = glowMat(lineTex, LIGHT, 1.0);
    const beam = new THREE.Mesh(plane(7.6, 0.15), beamMat);
    beam.position.set(2.55, 0.08, -0.3);
    beam.rotation.z = -6.1 * DEG;
    const sharpLayer: THREE.Object3D[] = [beam];
    const redMat = glowMat(radialTex, new THREE.Color(1, 0.15, 0.1), 1.6, false);
    const red = new THREE.Mesh(plane(0.075, 0.075), redMat);
    red.position.set(6.2, -0.3, -0.3);
    sharpLayer.push(red);

    // --- orange specks inside the structure ---
    const speckGeo = track(new THREE.BufferGeometry());
    const speckCount = 90;
    const speckPos = new Float32Array(speckCount * 3);
    const speckPhase = new Float32Array(speckCount);
    for (let i = 0; i < speckCount; i++) {
      if (i < 55) speckPos.set([0.2 + gauss() * 2.6, 0.25 + gauss() * 0.4, -4.5 + gauss() * 1.8], i * 3);
      else speckPos.set([-5 + rnd() * 9, -0.6 + rnd() * 2.8, -0.3 - rnd() * 0.6], i * 3);
      speckPhase[i] = rnd() * 6.28;
    }
    speckGeo.setAttribute("position", new THREE.BufferAttribute(speckPos, 3));
    speckGeo.setAttribute("aPhase", new THREE.BufferAttribute(speckPhase, 1));
    const speckMat = track(
      new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, color: { value: ORANGE.clone().multiplyScalar(2.2) }, pxScale: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute float aPhase;
          uniform float time;
          uniform float pxScale;
          varying float vA;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = max(2.0, 0.035 * pxScale / -mv.z);
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
        depthWrite: true,
      }),
    );
    const specks = new THREE.Points(speckGeo, speckMat);
    city.add(specks);

    // --- blurred blue light bar, near the lens, bottom-left ---
    const blueMat = glowMat(lineTex, LIGHT_BLUE, 0.45, false);
    const blueBar = new THREE.Mesh(plane(2.85, 0.22), blueMat);
    blueBar.position.set(-2.71, -1.7, 2.5);
    blueBar.rotation.z = -11 * DEG;
    scene.add(blueBar);

    // --- particle world map (overlay layer with per-particle DOF) ---
    const overlay = new THREE.Scene();
    // beam + end dot sit at the map plane: draw them crisp, after depth of field
    sharpLayer.forEach((o) => overlay.add(o));
    const particles =
      mode === "orbit"
        ? buildWorldParticles(90000, 2024, 0.05)
        : buildWorldParticles(90000, 2024, 0.01, REFERENCE_MAP_HOMOGRAPHY);
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
            float tw = 1.67 * (0.2 + 0.8 * pow(0.5 + 0.5 * sin(time * (8.0 + fract(aPhase * 3.7) * 12.0) + aPhase), 4.0));
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
    if (mode === "orbit") mapGroup.rotation.y = -4 * DEG;
    overlay.add(mapGroup);

    speckMat.uniforms.pxScale.value = pxScale;

    const post = new PostFX(renderer, width, height, { streaks: true });

    return {
      render: (frame) => {
        const t = frame / fps;

        // light-structure drift (parallax motion inside the hologram)
        hall.position.set(HALL.pos.x + 0.035 * t, HALL.pos.y, HALL.pos.z);
        hall.rotation.set(0, 0, HALL.roll);
        hallInner.rotation.y = HALL.rotY + 0.011 * t;
        const rise = 0.62 + 0.38 * smoothstep(0.45, 0.85, t);
        for (const h of hallMats) h.mat.color.copy(h.color).multiplyScalar(h.k * rise);

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
          a.mat.color.copy(a.color).multiplyScalar(a.intensity * env * rise);
          // never toggle visibility: hidden meshes stop writing depth, which
          // makes the depth of field pop for a frame or two
        }
        for (const s of shafts) {
          const k = s.k * (0.75 + 0.25 * Math.sin(t * 0.9 + s.ph));
          s.mat.color.copy(LIGHT_BLUE).multiplyScalar(k * 1.4);
        }
        beamMat.color.copy(LIGHT).multiplyScalar(1.0 * (0.9 + 0.1 * Math.sin(t * 3.1)));
        blueMat.color.copy(LIGHT_BLUE).multiplyScalar(0.45 * smoothstep(1.0, 1.2, t));
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
            blurRangeFar: 6.5,
            maxBlur: 0.03,
            bloomStrength: 0.11,
            bloomThreshold: 0.8,
            bloomKnee: 0.4,
            streakStrength: 0.03,
            streakThreshold: 1.1,
            streakTint: new THREE.Color(0.75, 0.88, 1.0),
            exposure: 0.84,
            contrast: 1.06,
            saturation: 0.82,
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
