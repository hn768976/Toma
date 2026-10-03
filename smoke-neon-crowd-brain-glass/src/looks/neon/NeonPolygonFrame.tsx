import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Pipeline } from "../../lib/three/Pipeline";
import { SceneFactory, ThreeStage } from "../../lib/three/ThreeStage";
import { mulberry32, TAU } from "../../lib/rng";
import type { NeonColors } from "../../versions";

const LOOP = 600;
const rand = mulberry32(0x5eed2);

type ShapeDef = {
  kind: "poly" | "prism";
  pts: THREE.Vector2[];
  depth: number;
  pos: THREE.Vector3;
  rot: THREE.Euler;
  colorIdx: number;
  // whole-cycle oscillations over the loop
  osc: { axis: 0 | 1 | 2; amp: number; k: number; ph: number }[];
  spinK: number; // whole turns around local normal over the loop (0 = none)
  bob: { amp: number; k: number; ph: number };
};

const polygon = (n: number, r0: number) => {
  const angs: number[] = [];
  for (let i = 0; i < n; i++) angs.push((i + 0.15 + rand() * 0.7) / n * TAU);
  return angs.map((a) => {
    const r = r0 * (0.65 + rand() * 0.45);
    return new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  });
};

// Layout: two crowded bands (top & bottom) plus a few at the sides, centre clear.
const SHAPES: ShapeDef[] = [];
const addShape = (x: number, y: number, z: number, side: 1 | -1 | 0) => {
  const kind = rand() < 0.35 ? "prism" : "poly";
  const n = kind === "prism" ? 3 + Math.floor(rand() * 2) : 3 + Math.floor(rand() * 3);
  const r = 2.3 + rand() * 1.6;
  const tiltX = (rand() - 0.5) * 1.6 + (side === 0 ? 0 : -side * 0.5);
  SHAPES.push({
    kind,
    pts: polygon(n, r),
    depth: 0.7 + rand() * 1.3,
    pos: new THREE.Vector3(x, y, z),
    rot: new THREE.Euler(tiltX, (rand() - 0.5) * 1.8, rand() * TAU),
    colorIdx: rand() < 0.55 ? 0 : 1,
    osc: [
      { axis: 0, amp: 0.12 + rand() * 0.22, k: 1 + Math.floor(rand() * 2), ph: rand() * TAU },
      { axis: 1, amp: 0.12 + rand() * 0.22, k: 1 + Math.floor(rand() * 2), ph: rand() * TAU },
    ],
    spinK: rand() < 0.3 ? (rand() < 0.5 ? 1 : -1) : 0,
    bob: { amp: 0.05 + rand() * 0.12, k: 1 + Math.floor(rand() * 2), ph: rand() * TAU },
  });
};
for (let i = 0; i < 13; i++) {
  addShape(-9.6 + i * 1.6 + (rand() - 0.5) * 0.9, 4.6 + rand() * 1.2, -3.2 + rand() * 2.8, 1);
  addShape(-9.6 + i * 1.6 + (rand() - 0.5) * 0.9, -4.6 - rand() * 1.2, -3.2 + rand() * 2.8, -1);
}
for (let i = 0; i < 4; i++) {
  const sx = i % 2 === 0 ? -1 : 1;
  addShape(sx * (9.8 + rand() * 1.2), (rand() - 0.5) * 3.0, -3.0 + rand() * 1.5, 0);
}

const radialTexture = () => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.15, "rgba(255,255,255,0.55)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.12)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
};

const tubeBetween = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, 6, 1, true);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
  return g;
};

const factory: SceneFactory<{ colors: NeonColors }> = ({ gl, props }) => {
  const { colors } = props;
  const rand = mulberry32(0xface); // local stream: identical every time the scene is built
  const scene = new THREE.Scene();
  const bg = new THREE.Color(colors.bg);
  scene.background = bg;
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 100);
  camera.position.set(0, 0, 12);

  const cols = [new THREE.Color(colors.a), new THREE.Color(colors.b)];
  const glowTex = radialTexture();
  const TUBE_R = 0.018;

  const root = new THREE.Group();
  scene.add(root);
  scene.add(new THREE.HemisphereLight(0x3a2a90, 0x401060, 0.35));
  // soft coloured haze behind everything (big dim discs)
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: cols[i % 2].clone().multiplyScalar(0.025),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    s.position.set((rand() - 0.5) * 18, (i % 2 ? 1 : -1) * (2.5 + rand() * 2), -6);
    s.scale.setScalar(9 + rand() * 6);
    scene.add(s);
  }

  const groups: { g: THREE.Group; d: ShapeDef }[] = [];
  SHAPES.forEach((d, si) => {
    const g = new THREE.Group();
    const col = cols[d.colorIdx];
    const faceMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#140d30"),
      roughness: 0.38,
      metalness: 0.55,
      side: THREE.DoubleSide,
    });
    const tubes: THREE.BufferGeometry[] = [];
    const corners: THREE.Vector3[] = [];
    const n = d.pts.length;
    if (d.kind === "poly") {
      const shape = new THREE.Shape(d.pts);
      const face = new THREE.Mesh(new THREE.ShapeGeometry(shape), faceMat);
      g.add(face);
      for (let i = 0; i < n; i++) {
        const a = new THREE.Vector3(d.pts[i].x, d.pts[i].y, 0);
        const b = new THREE.Vector3(d.pts[(i + 1) % n].x, d.pts[(i + 1) % n].y, 0);
        tubes.push(tubeBetween(a, b, TUBE_R));
        corners.push(a);
      }
    } else {
      // open prism: side walls only, outlined top and bottom rims + vertical edges
      const h = d.depth / 2;
      const pos: number[] = [];
      for (let i = 0; i < n; i++) {
        const p = d.pts[i];
        const q = d.pts[(i + 1) % n];
        pos.push(p.x, p.y, -h, q.x, q.y, -h, q.x, q.y, h, p.x, p.y, -h, q.x, q.y, h, p.x, p.y, h);
      }
      const wg = new THREE.BufferGeometry();
      wg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      wg.computeVertexNormals();
      g.add(new THREE.Mesh(wg, faceMat));
      for (let i = 0; i < n; i++) {
        const p = d.pts[i];
        const q = d.pts[(i + 1) % n];
        const a0 = new THREE.Vector3(p.x, p.y, -h), b0 = new THREE.Vector3(q.x, q.y, -h);
        const a1 = new THREE.Vector3(p.x, p.y, h), b1 = new THREE.Vector3(q.x, q.y, h);
        tubes.push(tubeBetween(a0, b0, TUBE_R), tubeBetween(a1, b1, TUBE_R), tubeBetween(a0, a1, TUBE_R));
        corners.push(a0, a1);
      }
    }
    const sat = new THREE.Color(Math.pow(col.r, 1.6), Math.pow(col.g, 1.6), Math.pow(col.b, 1.6));
    const lineMat = new THREE.MeshBasicMaterial({ color: sat.multiplyScalar(2.6) });
    g.add(new THREE.Mesh(mergeGeometries(tubes), lineMat));
    tubes.forEach((t) => t.dispose());
    // hot corners
    corners.forEach((c, ci) => {
      if (rand() < 0.6) return;
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: col.clone().lerp(new THREE.Color(1, 1, 1), 0.45).multiplyScalar(0.9),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      s.position.copy(c);
      s.scale.setScalar(0.3 + rand() * 0.25);
      g.add(s);
    });
    // a coloured light riding with every other shape: glow reflected on the dark faces
    if (si % 2 === 0) {
      const L = new THREE.PointLight(col, 9, 6.5, 1.6);
      L.position.copy(corners[0]).multiplyScalar(0.8).add(new THREE.Vector3(0, 0, 0.6));
      g.add(L);
    }
    g.position.copy(d.pos);
    root.add(g);
    groups.push({ g, d });
  });

  const pipe = new Pipeline(gl, scene, camera, {
    bloom: { strength: 0.8, radius: 0.3, threshold: 0.3 },
    grain: 0.02,
    vignette: 0.25,
  });

  return {
    render(frame) {
      const { w, h } = pipe.ensureSize();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const t = (frame % LOOP) / LOOP; // 0..1 around the loop
      for (const { g, d } of groups) {
        const e = d.rot.clone();
        const v = [e.x, e.y, e.z];
        for (const o of d.osc) v[o.axis] += o.amp * Math.sin(TAU * o.k * t + o.ph);
        v[2] += d.spinK * TAU * t;
        g.rotation.set(v[0], v[1], v[2]);
        g.position.y = d.pos.y + d.bob.amp * Math.sin(TAU * d.bob.k * t + d.bob.ph);
      }
      root.rotation.set(0.04 * Math.sin(TAU * t), 0.06 * Math.sin(TAU * t + 1.3), 0.015 * Math.sin(TAU * 2 * t));
      root.position.x = 0.25 * Math.sin(TAU * t);
      pipe.render(frame % LOOP);
    },
    dispose() {
      pipe.dispose();
    },
  };
};

export const NeonPolygonFrame: React.FC<{ colors: NeonColors }> = ({ colors }) => (
  <ThreeStage factory={factory} props={{ colors }} background={colors.bg} />
);
