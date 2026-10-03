import * as THREE from "three";
import { Pipeline } from "../../lib/three/Pipeline";
import { SceneFactory, ThreeStage } from "../../lib/three/ThreeStage";
import { radialTexture } from "../../lib/three/textures";
import { keyed3, monotoneCubic } from "../../lib/curve";
import { clamp, mulberry32, smoothstep, TAU } from "../../lib/rng";
import type { BrainColors } from "../../versions";
import { barChartIcon, chatIcon, documentIcon, flagIcon, gaugeIcon, gearIcon } from "./icons";

// ---------------------------------------------------------------- layout (x, z on the ground)
const BRAIN_C = new THREE.Vector2(-4.1, 0.2);
type V2 = [number, number];
const NODES: Record<string, V2> = {
  R: [-1.95, 0.2],
  J0: [-1.0, 0.2],
  J1: [-0.4, -0.35],
  J2: [1.0, -0.95],
  J3: [2.9, -1.35],
  J4: [0.7, 0.75],
  DOC: [-0.45, -2.9],
  CHART: [1.55, -3.15],
  FLAG: [4.35, -2.65],
  GAUGE: [4.15, -0.35],
  CHAT: [-0.05, 2.15],
  GEAR: [2.75, 2.2],
};
// branches: from-node, intermediate bends, to-node
const EDGES: { from: string; via: V2[]; to: string }[] = [
  { from: "R", via: [], to: "J0" },
  { from: "J0", via: [], to: "J1" },
  { from: "J1", via: [[-0.45, -1.6]], to: "DOC" },
  { from: "J1", via: [[0.35, -0.35]], to: "J2" },
  { from: "J2", via: [[1.55, -1.8]], to: "CHART" },
  { from: "J2", via: [[2.3, -0.95]], to: "J3" },
  { from: "J3", via: [[3.7, -2.25]], to: "FLAG" },
  { from: "J3", via: [[3.6, -0.75]], to: "GAUGE" },
  { from: "J0", via: [[-0.35, 0.75]], to: "J4" },
  { from: "J4", via: [[0.0, 1.3]], to: "CHAT" },
  { from: "J4", via: [[1.9, 0.75], [2.6, 1.45]], to: "GEAR" },
];
const PLATFORMS: { node: string; icon: () => THREE.BufferGeometry; rotY: number }[] = [
  { node: "DOC", icon: documentIcon, rotY: 0.55 },
  { node: "CHART", icon: barChartIcon, rotY: 0.55 },
  { node: "FLAG", icon: flagIcon, rotY: 0.35 },
  { node: "GAUGE", icon: gaugeIcon, rotY: 0 },
  { node: "CHAT", icon: chatIcon, rotY: 0.55 },
  { node: "GEAR", icon: gearIcon, rotY: 0.55 },
];
const PLATFORM_R = 0.72;

// cumulative path distance from the brain to every node
const DIST: Record<string, number> = { R: 0 };
for (const e of EDGES) {
  const pts = [NODES[e.from], ...e.via, NODES[e.to]];
  let d = DIST[e.from];
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  // the strip stops at the platform rim
  DIST[e.to] = d - (NODES[e.to] && PLATFORMS.some((p) => p.node === e.to) ? PLATFORM_R : 0);
}
const MAX_DIST = Math.max(...Object.values(DIST));

// --------------------------------------------------------------- brain outline (top view)
const hemi = (side: 1 | -1, scale: number) => {
  const pts: THREE.Vector2[] = [];
  const N = 160;
  const cx = side * 1.02;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const bump = 1 + 0.045 * Math.sin(9 * a + side) + 0.03 * Math.sin(15 * a + 2 * side) + 0.02 * Math.sin(23 * a);
    let x = cx + Math.cos(a) * 1.0 * bump * scale;
    const y = Math.sin(a) * 1.32 * bump * scale * (1 - 0.12 * Math.cos(a) * side);
    if (side * x < 0.07 + (1 - scale) * 0.6) x = side * (0.07 + (1 - scale) * 0.6);
    pts.push(new THREE.Vector2(x, y));
  }
  return pts;
};

const circuitCanvas = (draw: (g: CanvasRenderingContext2D, size: number) => void, size = 1024) => {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

/** Orthogonal/45° traces with pads — used on the brain faces and the floor. */
const drawTraces = (
  g: CanvasRenderingContext2D,
  rand: () => number,
  n: number,
  box: [number, number, number, number],
  step: number,
  width: number,
  color: string,
) => {
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = width;
  g.lineCap = "round";
  g.lineJoin = "round";
  const dirs = [
    [1, 0],
    [0.7071, 0.7071],
    [0, 1],
    [-0.7071, 0.7071],
    [-1, 0],
    [-0.7071, -0.7071],
    [0, -1],
    [0.7071, -0.7071],
  ];
  for (let i = 0; i < n; i++) {
    let x = box[0] + rand() * (box[2] - box[0]);
    let y = box[1] + rand() * (box[3] - box[1]);
    let d = Math.floor(rand() * 4) * 2;
    g.beginPath();
    g.arc(x, y, width * 1.8, 0, TAU);
    g.fill();
    g.beginPath();
    g.moveTo(x, y);
    const segs = 2 + Math.floor(rand() * 4);
    for (let s = 0; s < segs; s++) {
      const len = step * (0.5 + rand() * 1.8);
      x += dirs[d][0] * len;
      y += dirs[d][1] * len;
      g.lineTo(x, y);
      d = (d + (rand() < 0.5 ? 1 : 7)) % 8;
    }
    g.stroke();
    g.beginPath();
    g.arc(x, y, width * 1.8, 0, TAU);
    g.fill();
  }
};

const factory: SceneFactory<{ colors: BrainColors }> = ({ gl, assets, props }) => {
  const { colors } = props;
  const rand = mulberry32(0xb2a1);
  const glow = new THREE.Color(colors.glow);
  const surfaceCol = new THREE.Color(colors.surface);

  const scene = new THREE.Scene();
  scene.background = surfaceCol.clone().multiplyScalar(0.5);
  scene.fog = new THREE.Fog(surfaceCol.clone().multiplyScalar(0.55), 16, 34);
  const pmrem = new THREE.PMREMGenerator(gl);
  scene.environment = pmrem.fromEquirectangular(assets.hdr!).texture;
  scene.environmentIntensity = 0.3;
  // tip the studio softboxes away from straight overhead so up-facing tops don't mirror them
  scene.environmentRotation.set(0.9, 0.4, 0);
  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0x9fd0ff, surfaceCol, 1.1));
  const key = new THREE.DirectionalLight(0xcfe6ff, 1.3);
  key.position.set(-3, 8, 5);
  scene.add(key);

  // ------------------------------------------------------------- surface
  const floorTex = circuitCanvas((g, S) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, S, S);
    // faint grid
    g.strokeStyle = "rgba(120,190,255,0.22)";
    g.lineWidth = 1.2;
    for (let i = 0; i <= 16; i++) {
      g.beginPath();
      g.moveTo((i / 16) * S, 0);
      g.lineTo((i / 16) * S, S);
      g.stroke();
      g.beginPath();
      g.moveTo(0, (i / 16) * S);
      g.lineTo(S, (i / 16) * S);
      g.stroke();
    }
    drawTraces(g, rand, 260, [0, 0, S, S], S / 90, 1.6, "rgba(120,200,255,0.5)");
    // scattered dots
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(150,220,255,${0.15 + rand() * 0.5})`;
      g.fillRect(rand() * S, rand() * S, 2, 2);
    }
  }, 2048);
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(3, 3);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshPhysicalMaterial({
      color: surfaceCol,
      roughness: 0.75,
      specularIntensity: 0.25,
      envMapIntensity: 0,
      emissive: glow.clone().multiplyScalar(0.22),
      emissiveMap: floorTex,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  // soft glow pool under the brain
  const tex = radialTexture();
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: tex, color: glow.clone().multiplyScalar(0.1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  pool.position.set(BRAIN_C.x, 0.01, BRAIN_C.y);
  pool.scale.set(7.5, 1, 5.5);
  scene.add(pool);

  // ------------------------------------------------------------- brain tile
  const brain = new THREE.Group();
  brain.position.set(BRAIN_C.x, 0, BRAIN_C.y);
  scene.add(brain);
  const rimMat = new THREE.MeshPhysicalMaterial({ color: 0xb4c4dc, roughness: 0.32, clearcoat: 0.4, clearcoatRoughness: 0.25, metalness: 0, envMapIntensity: 0.12 });
  const faceTex = circuitCanvas((g, S) => {
    // maps brain-local x∈[-2.4,2.4], y∈[-2.4,2.4]
    g.fillStyle = "#000";
    g.fillRect(0, 0, S, S);
    drawTraces(g, rand, 340, [S * 0.05, S * 0.15, S * 0.95, S * 0.85], S / 70, 2.4, "rgba(140,230,255,0.95)");
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(160,240,255,${0.3 + rand() * 0.6})`;
      g.beginPath();
      g.arc(S * (0.08 + rand() * 0.84), S * (0.15 + rand() * 0.7), 2 + rand() * 2, 0, TAU);
      g.fill();
    }
  });
  faceTex.repeat.set(1 / 4.8, 1 / 4.8);
  faceTex.offset.set(0.5, 0.5);
  const faceMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.surface).multiplyScalar(0.7),
    roughness: 0.55,
    metalness: 0.0,
    envMapIntensity: 0.15,
    emissive: glow.clone().multiplyScalar(0.9),
    emissiveMap: faceTex,
  });
  for (const side of [-1, 1] as const) {
    const outer = hemi(side, 1);
    const inner = hemi(side, 0.86);
    const rimShape = new THREE.Shape(outer);
    rimShape.holes.push(new THREE.Path([...inner].reverse()));
    const rim = new THREE.ExtrudeGeometry(rimShape, { depth: 0.34, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3, curveSegments: 4 });
    rim.rotateX(-Math.PI / 2);
    brain.add(new THREE.Mesh(rim, rimMat));
    const face = new THREE.ExtrudeGeometry(new THREE.Shape(inner), { depth: 0.24, bevelEnabled: false });
    face.rotateX(-Math.PI / 2);
    brain.add(new THREE.Mesh(face, faceMat));
  }
  // AI chip
  const chipTex = circuitCanvas((g, S) => {
    const grd = g.createLinearGradient(0, 0, S, S);
    grd.addColorStop(0, "#1b5fb8");
    grd.addColorStop(1, "#0b2f6e");
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    g.strokeStyle = "#bff6ff";
    g.lineWidth = S * 0.035;
    g.strokeRect(S * 0.06, S * 0.06, S * 0.88, S * 0.88);
    g.fillStyle = "#ffffff";
    g.font = `700 ${Math.round(S * 0.42)}px Montserrat`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("AI", S * 0.5, S * 0.53);
  }, 512);
  const chipEmis = circuitCanvas((g, S) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, S, S);
    g.strokeStyle = "#fff";
    g.lineWidth = S * 0.035;
    g.strokeRect(S * 0.06, S * 0.06, S * 0.88, S * 0.88);
    g.fillStyle = "#fff";
    g.font = `700 ${Math.round(S * 0.42)}px Montserrat`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("AI", S * 0.5, S * 0.53);
  }, 512);
  const chipSide = new THREE.MeshStandardMaterial({ color: 0x2a6fd0, roughness: 0.3, metalness: 0.4, emissive: glow.clone().multiplyScalar(0.5) });
  const chipTop = new THREE.MeshStandardMaterial({ map: chipTex, emissiveMap: chipEmis, emissive: glow.clone().multiplyScalar(2.2), roughness: 0.4, metalness: 0.0, envMapIntensity: 0.1 });
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.95), [chipSide, chipSide, chipTop, chipSide, chipSide, chipSide]);
  chip.position.set(0, 0.4, 0.05);
  brain.add(chip);
  // pins around the chip
  const pinGeo = new THREE.BoxGeometry(0.05, 0.04, 0.14);
  const pinMat = new THREE.MeshBasicMaterial({ color: glow.clone().multiplyScalar(2.5) });
  for (let i = 0; i < 5; i++) {
    for (const s of [-1, 1]) {
      const p1 = new THREE.Mesh(pinGeo, pinMat);
      p1.position.set(-0.32 + i * 0.16, 0.36, 0.05 + s * 0.55);
      brain.add(p1);
      const p2 = new THREE.Mesh(pinGeo, pinMat);
      p2.rotation.y = Math.PI / 2;
      p2.position.set(s * 0.55, 0.36, 0.05 - 0.32 + i * 0.16);
      brain.add(p2);
    }
  }
  const brainLight = new THREE.PointLight(glow, 1.5, 5, 1.5);
  brainLight.position.set(0, 1.0, 0);
  brain.add(brainLight);

  // ------------------------------------------------------------- glowing paths
  const pos: number[] = [];
  const dist: number[] = [];
  const side: number[] = [];
  const W = 0.15;
  for (const e of EDGES) {
    const pts = [NODES[e.from], ...e.via, NODES[e.to]].map((p) => new THREE.Vector2(p[0], p[1]));
    const isPlat = PLATFORMS.some((p) => p.node === e.to);
    if (isPlat) {
      const a = pts[pts.length - 2], b = pts[pts.length - 1];
      pts[pts.length - 1] = b.clone().sub(b.clone().sub(a).normalize().multiplyScalar(PLATFORM_R - 0.02));
    }
    let d0 = DIST[e.from];
    // extend backwards into the parent a little so joints overlap cleanly
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dir = b.clone().sub(a).normalize();
      const n = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(W / 2);
      const len = a.distanceTo(b);
      const ext = i > 0 || e.from !== "R" ? W / 2 : 0;
      const a2 = a.clone().sub(dir.clone().multiplyScalar(ext));
      const b2 = b.clone().add(dir.clone().multiplyScalar(i < pts.length - 2 ? W / 2 : 0));
      const da = d0 - ext;
      const db = d0 + len + (i < pts.length - 2 ? W / 2 : 0);
      const quad = [
        [a2.x - n.x, a2.y - n.y, da, -1],
        [a2.x + n.x, a2.y + n.y, da, 1],
        [b2.x + n.x, b2.y + n.y, db, 1],
        [b2.x - n.x, b2.y - n.y, db, -1],
      ];
      for (const idx of [0, 1, 2, 0, 2, 3]) {
        const q = quad[idx];
        pos.push(q[0], 0.03 + i * 0.0005, q[1]);
        dist.push(q[2]);
        side.push(q[3]);
      }
      d0 += len;
    }
  }
  const pathGeo = new THREE.BufferGeometry();
  pathGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  pathGeo.setAttribute("aDist", new THREE.Float32BufferAttribute(dist, 1));
  pathGeo.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
  const pathMat = new THREE.ShaderMaterial({
    uniforms: {
      uHead: { value: 0 },
      uPulse: { value: 0 },
      uPulseAmt: { value: 0 },
      uGlow: { value: glow.clone() },
    },
    vertexShader: /* glsl */ `
      attribute float aDist; attribute float aSide;
      varying float vDist; varying float vSide;
      void main() { vDist = aDist; vSide = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uHead; uniform float uPulse; uniform float uPulseAmt; uniform vec3 uGlow;
      varying float vDist; varying float vSide;
      void main() {
        if (vDist > uHead) discard;
        float edge = smoothstep(0.55, 0.95, abs(vSide));
        float dash = step(0.5, fract(vDist * 7.0)) * (1.0 - smoothstep(0.0, 0.18, abs(vSide)));
        float head = exp(-(uHead - vDist) * 5.0);
        float pulse = uPulseAmt * exp(-pow((mod(vDist - uPulse, 3.2) - 0.25) * 3.5, 2.0));
        vec3 base = uGlow * (0.9 + 2.2 * edge + 1.2 * dash);
        vec3 c = base * (1.0 + 2.5 * pulse) + vec3(1.0) * head * 5.0 + uGlow * head * 4.0;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
  scene.add(new THREE.Mesh(pathGeo, pathMat));
  // soft wide halo under each strip (same geometry, scaled-width blur fake)
  const haloGeo = pathGeo.clone();
  const hp = haloGeo.getAttribute("position") as THREE.BufferAttribute;
  // widen: recompute by pushing along the side direction is complex; instead use sprites at the head

  // bright moving heads (one sprite per edge)
  const headSprites = EDGES.map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: glow.clone().lerp(new THREE.Color(1, 1, 1), 0.4).multiplyScalar(2), blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(0.9);
    scene.add(s);
    return s;
  });
  void hp;
  const edgePolylines = EDGES.map((e) => {
    const pts = [NODES[e.from], ...e.via, NODES[e.to]].map((p) => new THREE.Vector2(p[0], p[1]));
    return { pts, d0: DIST[e.from], d1: DIST[e.to] };
  });
  const pointAt = (pl: { pts: THREE.Vector2[]; d0: number }, d: number) => {
    let acc = pl.d0;
    for (let i = 0; i < pl.pts.length - 1; i++) {
      const L = pl.pts[i].distanceTo(pl.pts[i + 1]);
      if (d <= acc + L) return pl.pts[i].clone().lerp(pl.pts[i + 1], (d - acc) / L);
      acc += L;
    }
    return pl.pts[pl.pts.length - 1].clone();
  };

  // ------------------------------------------------------------- platforms + icons
  const iconMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f8ff, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.1, transparent: true });
  const ringTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    grd.addColorStop(0, "rgba(255,255,255,0)");
    grd.addColorStop(0.86, "rgba(255,255,255,0)");
    grd.addColorStop(0.92, "rgba(255,255,255,0.9)");
    grd.addColorStop(0.95, "rgba(255,255,255,0.25)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 512);
    return new THREE.CanvasTexture(c);
  })();
  const plats = PLATFORMS.map((p) => {
    const [x, z] = NODES[p.node];
    const grp = new THREE.Group();
    grp.position.set(x, 0, z);
    scene.add(grp);
    const discMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.surface).multiplyScalar(2.2), roughness: 0.3, metalness: 0.4, emissive: glow.clone().multiplyScalar(0.08), transparent: true });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(PLATFORM_R, PLATFORM_R, 0.16, 64), discMat);
    disc.position.y = 0.08;
    grp.add(disc);
    const rimMatP = new THREE.MeshBasicMaterial({ color: glow.clone().multiplyScalar(3.2), transparent: true });
    const rimP = new THREE.Mesh(new THREE.TorusGeometry(PLATFORM_R - 0.02, 0.025, 8, 80), rimMatP);
    rimP.rotation.x = Math.PI / 2;
    rimP.position.y = 0.165;
    grp.add(rimP);
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(PLATFORM_R * 0.45, 0.012, 6, 64), rimMatP);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.165;
    grp.add(innerRing);
    const ringMat = new THREE.MeshBasicMaterial({ map: ringTex, color: glow.clone().multiplyScalar(1.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), ringMat);
    ring.scale.setScalar(PLATFORM_R * 2.75);
    ring.position.y = 0.012;
    grp.add(ring);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, color: glow.clone().multiplyScalar(0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pad.scale.setScalar(PLATFORM_R * 4);
    pad.position.y = 0.011;
    grp.add(pad);
    const icon = new THREE.Mesh(p.icon(), iconMat.clone());
    icon.rotation.y = p.rotY;
    grp.add(icon);
    return { grp, disc, discMat, rimMatP, ringMat, pad, icon, d: DIST[p.node] };
  });

  const pipe = new Pipeline(gl, scene, camera, {
    bloom: { strength: 0.6, radius: 0.35, threshold: 2.2 },
    grain: 0.02,
    vignette: 0.4,
    clampHDR: 4,
  });

  // ------------------------------------------------------------- camera
  const KF = [0, 40, 150, 300, 360];
  const camPos = keyed3(KF, [
    [-4.1, 6.2, 0.9],
    [-4.0, 6.4, 1.3],
    [-3.9, 8.0, 10.2],
    [-3.6, 7.7, 9.8],
    [-3.55, 7.65, 9.7],
  ]);
  const camLook = keyed3(KF, [
    [-4.1, 0, 0.2],
    [-4.0, 0, 0.1],
    [-0.55, 0, -0.45],
    [-0.45, 0, -0.4],
    [-0.43, 0, -0.4],
  ]);
  const fovK = monotoneCubic([0, 40, 150], [38, 38, 34]);
  const headK = monotoneCubic([55, 120, 250], [0, 0.42 * MAX_DIST, MAX_DIST + 0.2]);

  return {
    render(frame) {
      const { w, h } = pipe.ensureSize();
      camera.aspect = w / h;
      camera.fov = fovK(frame);
      camera.updateProjectionMatrix();
      const p = camPos(frame);
      const l = camLook(frame);
      camera.position.set(p[0], p[1], p[2]);
      camera.lookAt(l[0], l[1], l[2]);

      const head = headK(frame);
      pathMat.uniforms.uHead.value = head;
      pathMat.uniforms.uPulseAmt.value = smoothstep(240, 290, frame);
      pathMat.uniforms.uPulse.value = (frame - 240) * 0.055;
      edgePolylines.forEach((pl, i) => {
        const s = headSprites[i];
        const active = head > pl.d0 && head < pl.d1 + 0.05;
        const fade = active ? 1 : 0;
        const q = pointAt(pl, clamp(head, pl.d0, pl.d1));
        s.position.set(q.x, 0.08, q.y);
        (s.material as THREE.SpriteMaterial).opacity = fade;
      });
      brainLight.intensity = 1.5 + 0.4 * Math.sin(frame * 0.12);

      for (const pl of plats) {
        const appear = smoothstep(pl.d - 1.2, pl.d - 0.2, head);
        pl.grp.visible = appear > 0.001;
        pl.discMat.opacity = appear;
        pl.rimMatP.opacity = appear;
        pl.ringMat.opacity = appear;
        (pl.pad.material as THREE.MeshBasicMaterial).opacity = appear;
        pl.disc.scale.set(0.85 + 0.15 * appear, 1, 0.85 + 0.15 * appear);
        // icon: pop up after the path arrives — rise, scale 0.9 → overshoot → 1
        const arrive = MAX_DIST > 0 ? headK : headK;
        void arrive;
        const tIcon = clamp((head - pl.d - 0.05) / 0.9);
        const k = tIcon;
        const over = k <= 0 ? 0 : 1 + 0.12 * Math.sin(Math.PI * Math.min(1, k * 1.25)) * (1 - k);
        const sc = k <= 0 ? 0.9 : 0.9 + 0.1 * smoothstep(0, 0.6, k);
        pl.icon.visible = k > 0;
        pl.icon.scale.setScalar(sc * (k > 0 ? over : 1));
        pl.icon.position.y = 0.16 - 0.35 * (1 - smoothstep(0, 0.55, k)) + 0.05 * Math.sin(Math.PI * clamp(k * 1.4));
        (pl.icon.material as THREE.MeshPhysicalMaterial).opacity = smoothstep(0, 0.25, k);
      }
      pipe.render(frame);
    },
    dispose() {
      pipe.dispose();
      pmrem.dispose();
    },
  };
};

export const AIBrainPaths: React.FC<{ colors: BrainColors }> = ({ colors }) => (
  <ThreeStage factory={factory} props={{ colors }} needHDR background={colors.surface} />
);
