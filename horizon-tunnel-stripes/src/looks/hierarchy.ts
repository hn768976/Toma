import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { makeBackdrop } from "../engine/backdrop";
import { Dot, makeDots } from "../engine/dots";
import { makeLines, Seg } from "../engine/lines";
import { LookFactory } from "../engine/Stage";
import { HierarchyColors } from "../versions";

// Look 3 - Hierarchy Network (360 frames, not a loop).
// A root node appears on a dark blue glossy surface; glowing lines branch
// out in right-angled paths, ending in arrows where new nodes pop up:
// 1 -> 2 -> 6. Light dots run along finished lines. The camera sits ~45
// degrees above and orbits ~25 degrees while pulling back slightly.

export type HierarchyParams = { colors: HierarchyColors };

const Y = 0.012; // lines sit just above the surface

type Node = { x: number; z: number; pop: number };
type Path = { pts: [number, number][]; start: number; end: number; arrow: boolean };

const ROOT: Node = { x: 0, z: -2.5, pop: 6 };
const L2: Node[] = [
  { x: -3.4, z: 0.2, pop: 124 },
  { x: 3.4, z: 0.2, pop: 128 },
];
const L3X = [-2.05, 0, 2.05];
const L3: Node[] = L2.flatMap((p, pi) =>
  L3X.map((dx, i) => ({ x: p.x + dx, z: 2.9, pop: 232 + i * 6 + pi * 3 })),
);
const NODES = [ROOT, ...L2, ...L3];
const PAD = 0.62; // half size of the pad outline

const PATHS: Path[] = [
  // root -> level 2: out sideways from the pad, 90 degree turn toward camera
  { pts: [[-PAD, -2.5], [-3.4, -2.5], [-3.4, 0.2 - PAD - 0.1]], start: 40, end: 118, arrow: true },
  { pts: [[PAD, -2.5], [3.4, -2.5], [3.4, 0.2 - PAD - 0.1]], start: 44, end: 122, arrow: true },
  // level 2 -> level 3: trunk, crossbar, drops with arrows
  ...L2.flatMap((p, pi) =>
    L3X.map((dx, i) => {
      const jz = 1.55;
      const s = 136 + pi * 4;
      const pts: [number, number][] =
        dx === 0
          ? [[p.x, p.z + PAD], [p.x, 2.9 - PAD - 0.1]]
          : [[p.x, p.z + PAD], [p.x, jz], [p.x + dx, jz], [p.x + dx, 2.9 - PAD - 0.1]];
      return { pts, start: s + (dx === 0 ? 18 : 0), end: 226 + i * 6 + pi * 3, arrow: true };
    }),
  ),
];

const ease = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};
const easeOutBack = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  const k = 1.9;
  return 1 + (k + 1) * Math.pow(c - 1, 3) + k * Math.pow(c - 1, 2);
};

// Shader: a segment is visible up to the path's progress; bright head at
// the drawing tip; after completion, dots of light run along the path.
const PATH_MOD = /* glsl */ `
uniform float uProg[24];
uniform float uDone[24];
uniform float uTime;
float lineMod(float u, vec4 p) {
  float s = mix(p.x, p.y, u);
  int id = int(p.z + 0.5);
  float prog = uProg[id];
  float vis = smoothstep(prog + 0.004, prog - 0.004, s);
  float head = exp(-pow((s - prog) / 0.025, 2.0)) * 3.0 * (1.0 - uDone[id]);
  float run = fract(s * p.w * 0.9 - uTime * 0.9);
  float dots = exp(-pow((run - 0.5) / 0.035, 2.0)) * 2.2 * uDone[id];
  return vis * (1.0 + dots) + head * step(0.0005, prog);
}
`;

export const hierarchyLook: LookFactory<HierarchyParams> = ({ assets, params, renderer }) => {
  const c = params.colors;
  const lineCol = new THREE.Color(c.line);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.5, 200);

  // Studio HDRI for glossy reflections on cubes and surface.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(assets.hdri!).texture;
  pmrem.dispose();
  // Assigned per material (not scene.environment) so each material's
  // envMapIntensity applies.

  const bg = makeBackdrop(
    /* glsl */ `
    uniform vec3 uSurf;
    vec3 backdrop(vec2 uv, vec2 p) { return uSurf * 0.3; }
  `,
    { uSurf: { value: new THREE.Color(c.surface) } },
  );
  scene.add(bg);

  // Surface: glossy dark blue with large soft light patches.
  const floorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(c.surface),
    roughness: 0.62,
    metalness: 0.0,
    envMap: env,
    envMapIntensity: 0.015,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  scene.add(new THREE.HemisphereLight(0x2a6ad0, 0x041030, 1.8));
  const patches: [number, number, number, number][] = [
    [-9, 3, 7, 110],
    [8, 2, -6, 80],
    [2, 7, -14, 90],
    [-4, 4, 10, 55],
  ];
  patches.forEach(([x, z, tx, inten]) => {
    const sp = new THREE.SpotLight(0x3f8cff, inten * 1.4, 0, 0.6, 1, 2);
    sp.position.set(x, 9, z);
    sp.target.position.set(tx * 0.3 + x * 0.4, 0, z + tx * 0.2);
    scene.add(sp, sp.target);
  });
  const key = new THREE.DirectionalLight(0x5f9cff, 1.1);
  key.position.set(-4, 8, 6);
  scene.add(key);

  // Nodes: a glossy rounded cube over a narrower base, on a pad outline.
  const cubeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(c.cube),
    roughness: 0.28,
    metalness: 0.2,
    clearcoat: 0.8,
    clearcoatRoughness: 0.25,
    envMap: env,
    envMapIntensity: 0.08,
  });
  const baseMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(c.cube).multiplyScalar(0.45),
    roughness: 0.35,
    metalness: 0.2,
    envMap: env,
    envMapIntensity: 0.25,
  });
  const topGeo = new RoundedBoxGeometry(0.72, 0.36, 0.72, 4, 0.07);
  const baseGeo = new RoundedBoxGeometry(0.5, 0.28, 0.5, 3, 0.05);
  const nodeGroups = NODES.map((n) => {
    const g = new THREE.Group();
    g.position.set(n.x, 0, n.z);
    const top = new THREE.Mesh(topGeo, cubeMat);
    top.position.y = 0.46;
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.14;
    g.add(top, base);
    scene.add(g);
    return g;
  });

  // Pad outlines (rounded squares) drawn as path segments too.
  const segs: Seg[] = [];
  const pathLen: number[] = [];
  const addPath = (pts: [number, number][], id: number, width: number) => {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      segs.push({
        a: [pts[i - 1][0], Y, pts[i - 1][1]],
        b: [pts[i][0], Y, pts[i][1]],
        color: lineCol,
        intensity: 1.5,
        widthA: width,
        param: [acc / total, (acc + d) / total, id, total],
      });
      acc += d;
    }
    pathLen[id] = total;
  };
  PATHS.forEach((p, i) => addPath(p.pts, i, 0.035));
  // Pads: ids 8.. (one per node), animated with the node pop.
  const padIds: number[] = [];
  NODES.forEach((n, i) => {
    const id = PATHS.length + i;
    padIds.push(id);
    const pts: [number, number][] = [];
    const r = 0.12;
    const h = PAD;
    // rounded square, starting at the front-middle
    // (centre x, centre z, start angle); angle 0 = +z, PI/2 = +x
    const corners: [number, number, number][] = [
      [h - r, h - r, 0],
      [h - r, -h + r, Math.PI / 2],
      [-h + r, -h + r, Math.PI],
      [-h + r, h - r, Math.PI * 1.5],
    ];
    pts.push([n.x, n.z + h]);
    corners.forEach(([cx, cz, a0]) => {
      for (let k = 0; k <= 4; k++) {
        const a = a0 + (k / 4) * (Math.PI / 2);
        pts.push([n.x + cx + Math.sin(a) * r, n.z + cz + Math.cos(a) * r]);
      }
    });
    pts.push([n.x, n.z + h]);
    addPath(pts, id, 0.03);
  });
  const uProg = { value: new Array(24).fill(0) };
  const uDone = { value: new Array(24).fill(0) };
  const uTime = { value: 0 };
  const lines = makeLines(segs, {
    worldWidth: true,
    softness: 0.25,
    lineMod: PATH_MOD,
    uniforms: { uProg, uDone, uTime },
    minHalfPx: 0.7,
  });
  lines.renderOrder = 2;
  scene.add(lines);

  // Wide soft glow under the lines (reads as light spilling on the surface).
  const glowSegs: Seg[] = segs.map((s) => ({ ...s, intensity: 0.22, widthA: 0.32 }));
  const glow = makeLines(glowSegs, {
    worldWidth: true,
    softness: 1,
    feather: 1.6,
    lineMod: PATH_MOD.replace("* 3.0 *", "* 1.0 *").replace("* 2.2 *", "* 0.6 *"),
    uniforms: { uProg, uDone, uTime },
  });
  glow.renderOrder = 1;
  scene.add(glow);

  // Arrowheads: small flat glowing triangles at path ends.
  const arrowGeo = new THREE.BufferGeometry();
  arrowGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.16, -0.11, 0, -0.04, 0.11, 0, -0.04], 3));
  const arrowMat = new THREE.MeshBasicMaterial({
    color: lineCol.clone().multiplyScalar(2.2),
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const arrows = PATHS.map((p) => {
    const a = new THREE.Mesh(arrowGeo, arrowMat);
    const e = p.pts[p.pts.length - 1];
    const q = p.pts[p.pts.length - 2];
    a.position.set(e[0], Y * 2, e[1]);
    a.rotation.y = Math.atan2(e[0] - q[0], e[1] - q[1]);
    a.renderOrder = 3;
    scene.add(a);
    return a;
  });

  // Small sparkle at each node's pad when it lands.
  const sparkDots: Dot[] = NODES.map((n) => ({
    p: [n.x, 0.05, n.z],
    color: lineCol,
    intensity: 0,
    size: 0.05,
  }));
  const sparks = makeDots(sparkDots, { softness: 1 });
  sparks.visible = false;
  scene.add(sparks);

  const target = new THREE.Vector3(0, 0, 0.5);

  const update = (frame: number) => {
    uTime.value = frame / 30;
    PATHS.forEach((p, i) => {
      const x = (frame - p.start) / (p.end - p.start);
      uProg.value[i] = x <= 0 ? 0 : ease(x) * 1.0005;
      uDone.value[i] = Math.min(1, Math.max(0, (frame - p.end - 4) / 20));
      const arr = arrows[i];
      const k = easeOutBack((frame - p.end + 2) / 10);
      arr.scale.setScalar(Math.max(0.0001, k));
      arr.visible = frame >= p.end - 2;
    });
    NODES.forEach((n, i) => {
      const k = (frame - n.pop) / 16;
      const s = k <= 0 ? 0 : easeOutBack(k);
      const g = nodeGroups[i];
      g.visible = s > 0.001;
      g.scale.set(Math.max(s, 0.001), Math.max(s, 0.001), Math.max(s, 0.001));
      g.position.y = (1 - Math.min(1, Math.max(0, k))) * 0.4;
      const id = padIds[i];
      const pk = (frame - n.pop + 4) / 22;
      uProg.value[id] = pk <= 0 ? 0 : ease(pk) * 1.0005;
      uDone.value[id] = 0;
    });

    // Camera: ~45 degrees above, slow 25 degree orbit with slight pull back.
    const t = frame / 359;
    const e = t * t * (3 - 2 * t) * 0.6 + t * 0.4;
    const az = THREE.MathUtils.degToRad(-14 + 25 * e);
    const el = THREE.MathUtils.degToRad(44 - 3 * e);
    const dist = 12.2 + 1.5 * e;
    camera.position.set(
      target.x + Math.sin(az) * Math.cos(el) * dist,
      target.y + Math.sin(el) * dist,
      target.z + Math.cos(az) * Math.cos(el) * dist,
    );
    camera.lookAt(target);
  };

  return {
    scene,
    camera,
    update,
    dispose: () => env.dispose(),
  };
};
