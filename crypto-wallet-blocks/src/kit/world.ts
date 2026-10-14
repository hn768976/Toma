import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { Version } from "../versions";
import { BLOCK, FLOOR_Y, FRONT_Z, WALLET } from "./layout";
import { linearColor, makeBackdropMaterial, makeEdgeMaterial, makeFloorMaterial, makeSheenMaterial } from "./materials";
import { ScreenTexture, makeCircuitTexture } from "./textures";
import {
  LOCK,
  PANEL,
  balances,
  blockCount,
  blockPose,
  cameraPose,
  linkAlpha,
  links,
  lockState,
  loosePose,
  looseCount,
  panelState,
  type BlockPose,
} from "./timeline";

const roundedRect = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};

const roundedOutline = (w: number, h: number, r: number, perCorner: number) => {
  const pts: [number, number][] = [];
  const corners: [number, number, number][] = [
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI],
    [w / 2 - r, -h / 2 + r, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, a0] of corners)
    for (let k = 0; k <= perCorner; k++) {
      const a = a0 + (k / perCorner) * (Math.PI / 2);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  return pts;
};

// The wallet slab, built by hand so it is watertight: centre-fan caps (no
// sliver triangles), a small bevel ring front and back, and straight sides.
const slabGeometry = (w: number, h: number, r: number, d: number, bevel: number, perCorner = 16) => {
  const outer = roundedOutline(w, h, r, perCorner);
  const inner = roundedOutline(w - bevel * 2, h - bevel * 2, r - bevel, perCorner);
  const n = outer.length;
  const pos: number[] = [];
  const idx: number[] = [];
  // Side + bevel rings share vertices so the edge shades smoothly.
  const rings: [typeof outer, number][] = [
    [inner, d / 2],
    [outer, d / 2 - bevel],
    [outer, -d / 2 + bevel],
    [inner, -d / 2],
  ];
  rings.forEach(([ring, z]) => ring.forEach(([x, y]) => pos.push(x, y, z)));
  for (let ri = 0; ri < rings.length - 1; ri++)
    for (let k = 0; k < n; k++) {
      const a = ri * n + k;
      const b = ri * n + ((k + 1) % n);
      const c = (ri + 1) * n + k;
      const e = (ri + 1) * n + ((k + 1) % n);
      idx.push(a, c, b, b, c, e);
    }
  const side = new THREE.BufferGeometry();
  side.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  side.setIndex(idx);
  side.computeVertexNormals();
  // Caps: separate vertices with flat normals, fanned from the centre.
  const cap = (z: number, dir: 1 | -1) => {
    const p: number[] = [0, 0, z];
    const nn: number[] = [0, 0, dir];
    inner.forEach(([x, y]) => {
      p.push(x, y, z);
      nn.push(0, 0, dir);
    });
    const id: number[] = [];
    for (let k = 0; k < n; k++) {
      const a = 1 + k;
      const b = 1 + ((k + 1) % n);
      if (dir > 0) id.push(0, a, b);
      else id.push(0, b, a);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nn, 3));
    g.setIndex(id);
    return g;
  };
  return [side, cap(d / 2, 1), cap(-d / 2, -1)];
};

// A flat rounded-rectangle ring built as an explicit triangle strip between
// matching outer and inner outlines. (ShapeGeometry with a hole triangulates
// into near-degenerate slivers across the face that rasterise as dashes.)
const ringGeometry = (w: number, h: number, r: number, inset: number, perCorner = 12) => {
  const outline = (W: number, H: number, R: number) => {
    const pts: [number, number][] = [];
    const corners: [number, number, number][] = [
      [W / 2 - R, H / 2 - R, 0],
      [-W / 2 + R, H / 2 - R, Math.PI / 2],
      [-W / 2 + R, -H / 2 + R, Math.PI],
      [W / 2 - R, -H / 2 + R, (3 * Math.PI) / 2],
    ];
    for (const [cx, cy, a0] of corners)
      for (let k = 0; k <= perCorner; k++) {
        const a = a0 + (k / perCorner) * (Math.PI / 2);
        pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
      }
    return pts;
  };
  const o = outline(w, h, r);
  const i = outline(w - inset * 2, h - inset * 2, Math.max(0.001, r - inset));
  const pos: number[] = [];
  const idx: number[] = [];
  for (let k = 0; k < o.length; k++) pos.push(o[k][0], o[k][1], 0, i[k][0], i[k][1], 0);
  for (let k = 0; k < o.length; k++) {
    const n = (k + 1) % o.length;
    idx.push(k * 2, n * 2, k * 2 + 1, k * 2 + 1, n * 2, n * 2 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

// Planar UVs (0..1 across the bounding box) for flat shape geometry.
const planarUV = (g: THREE.BufferGeometry, w: number, h: number) => {
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / w + 0.5;
    uv[i * 2 + 1] = pos.getY(i) / h + 0.5;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
};

// A soft studio for reflections: dark room, a top softbox, cool side strips.
const makeEnvironment = (gl: THREE.WebGLRenderer, accent: THREE.Color) => {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x020306);
  const box = (w: number, h: number, color: THREE.Color, pos: V3, look: V3) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    env.add(m);
  };
  box(8, 4, new THREE.Color(1, 1, 1).multiplyScalar(2.2), [0, 7, 1], [0, 0, 0]);
  box(1.6, 8, accent.clone().multiplyScalar(2.0), [-7, 1, -2], [0, 0, 0]);
  box(1.2, 7, new THREE.Color(0.9, 0.95, 1).multiplyScalar(1.6), [7, 1, 2], [0, 0, 0]);
  box(6, 1.2, new THREE.Color(0.7, 0.8, 1).multiplyScalar(0.6), [0, 2, 8], [0, 0, 0]);
  box(10, 3, accent.clone().multiplyScalar(0.35), [-2, -3, -8], [0, 0, 0]);
  box(9, 5, new THREE.Color(0.55, 0.6, 0.7).multiplyScalar(0.22), [-2, -4, 7], [0, 0, 0]);
  const pm = new THREE.PMREMGenerator(gl);
  const rt = pm.fromScene(env, 0.035);
  pm.dispose();
  env.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  return rt;
};

type V3 = [number, number, number];

type BlockObj = { group: THREE.Group; edge: THREE.ShaderMaterial };

export class WalletWorld {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(28, 16 / 9, 1.0, 150);
  focusDistance = 8;
  private readonly disposables: { dispose: () => void }[] = [];
  private readonly screen: ScreenTexture;
  private readonly blocks: BlockObj[] = [];
  private readonly loose: BlockObj[] = [];
  private readonly linkLines: LineSegments2 | null = null;
  private readonly linkGeom: LineSegmentsGeometry | null = null;
  private readonly linkMat: LineMaterial | null = null;
  private readonly linkPos: Float32Array;
  private readonly linkCol: Float32Array;
  private readonly panels: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial }[] = [];
  private readonly lock = new THREE.Group();
  private readonly shackle = new THREE.Group();
  private readonly lockMat: THREE.MeshPhysicalMaterial;
  private readonly lockBase: THREE.Color;
  private readonly blockEdgeColor: THREE.Color;
  private readonly rimMat: THREE.ShaderMaterial;
  // The secure slab reads as softer ice than the blocks story's bright edge.
  private readonly dockedEdge: number;

  constructor(
    private readonly version: Version,
    gl: THREE.WebGLRenderer,
  ) {
    const p = version.palette;
    const track = <T extends { dispose: () => void }>(x: T) => {
      this.disposables.push(x);
      return x;
    };

    const envRT = track(makeEnvironment(gl, linearColor(p.accent)));
    this.scene.environment = envRT.texture;
    this.scene.environmentIntensity = 0.9;

    // Backdrop + floor
    const backdropMat = track(makeBackdropMaterial(linearColor(p.background), linearColor(p.glow)));
    // The secure references have a much stronger blue pool than the blocks one.
    const glowAmt = version.story === "blocks" ? 0.2 : 1;
    backdropMat.uniforms.uGlowAmt.value = glowAmt;
    // Ambient level per reference: the blocks one is darker than the secure one.
    const bgAmt = version.story === "blocks" ? 0.3 : 0.36;
    backdropMat.uniforms.uBgAmt.value = bgAmt;
    this.scene.add(new THREE.Mesh(track(new THREE.SphereGeometry(60, 48, 24)), backdropMat));
    const floor = new THREE.Mesh(
      track(new THREE.PlaneGeometry(80, 80)),
      track(makeFloorMaterial(linearColor(p.background), linearColor(p.floorSpot), linearColor(p.glow))),
    );
    const floorU = (floor.material as THREE.ShaderMaterial).uniforms;
    floorU.uGlowAmt.value = glowAmt * 1.6;
    floorU.uBgAmt.value = bgAmt;
    floorU.uSpotAmt.value = version.story === "blocks" ? 0.12 : 0.2;
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    floor.renderOrder = -1;
    this.scene.add(floor);

    // Lights: a soft key from the front right, a cool rim from behind left.
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 5, 6);
    this.scene.add(key);
    const rimL = new THREE.DirectionalLight(linearColor(p.accent), 1.4);
    rimL.position.set(-6, 2, -4);
    this.scene.add(rimL);
    // Small hot light just above the top-right of the block slot: gives the
    // docked glass its bright corner and top edge.
    if (version.story === "blocks") {
      const hot = new THREE.PointLight(0xffffff, 3.2, 2.2, 2);
      hot.position.set(0.85, 1.55, 0.6);
      this.scene.add(hot);
    }

    // --- Wallet ------------------------------------------------------------
    const wallet = new THREE.Group();
    this.scene.add(wallet);
    const bodyMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0x0e1014,
        roughness: 0.32,
        metalness: 0.25,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.1,
      }),
    );
    for (const g of slabGeometry(WALLET.w, WALLET.h, WALLET.r, WALLET.d, 0.025)) wallet.add(new THREE.Mesh(track(g), bodyMat));
    // Dark backing just behind the face (belt and braces against any hairline
    // gap between the screen and the body).
    const blocker = new THREE.Mesh(track(new THREE.PlaneGeometry(WALLET.w - 0.08, WALLET.h - 0.08)), track(new THREE.MeshBasicMaterial({ color: 0x050608 })));
    blocker.position.z = FRONT_Z - 0.008;
    wallet.add(blocker);

    // Screen (emissive text on the glossy front)
    this.screen = track(new ScreenTexture(version.screen.title, p.screenText));
    const sw = WALLET.w - 0.12;
    const screenGeom = track(planarUV(new THREE.ShapeGeometry(roundedRect(sw, sw, WALLET.r - 0.06), 24), sw, sw));
    const screenMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0x0a0b0e,
        roughness: 0.18,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        emissive: 0xffffff,
        emissiveMap: this.screen.texture,
        emissiveIntensity: 1.35,
        envMapIntensity: 0.6,
      }),
    );
    const screen = new THREE.Mesh(screenGeom, screenMat);
    screen.position.z = FRONT_Z + 0.002;
    wallet.add(screen);
    // The secure reference shows a blue reflection across the face.
    const sheenMat = track(makeSheenMaterial(linearColor(version.story === "blocks" ? "#C8D4E8" : p.accent)));
    sheenMat.uniforms.uAmt.value = version.story === "blocks" ? 1 : 2.6;
    const sheen = new THREE.Mesh(screenGeom, sheenMat);
    sheen.position.z = FRONT_Z + 0.0025;
    wallet.add(sheen);

    // Rim: a thin bright ring at the front and back edges.
    const rimGeom = track(ringGeometry(WALLET.w + 0.004, WALLET.h + 0.004, WALLET.r + 0.002, 0.014));
    // Glossy rim light, brightest toward the bottom-right corner as in the reference.
    this.rimMat = track(
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: linearColor(p.rim) } },
        vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uColor; varying vec2 vP;
          void main() { float t = smoothstep(-1.2, 1.2, (vP.x - vP.y) * 0.75); gl_FragColor = vec4(uColor * (0.45 + 1.6 * t * t), 1.0); }`,
        side: THREE.DoubleSide,
      }),
    );
    const rimF = new THREE.Mesh(rimGeom, this.rimMat);
    rimF.position.z = FRONT_Z + 0.003;
    wallet.add(rimF);
    const rimBackMat = track(new THREE.MeshBasicMaterial({ color: linearColor(p.rim).multiplyScalar(0.5), side: THREE.DoubleSide }));
    const rimB = new THREE.Mesh(rimGeom, rimBackMat);
    rimB.position.z = -FRONT_Z - 0.003;
    wallet.add(rimB);

    // Strap tab with a round button on the right edge (wallet clasp). The
    // secure reference has no clasp (it would sit behind the padlock), so it is
    // only built for the blocks story.
    const strap = new THREE.Group();
    strap.visible = version.story === "blocks";
    wallet.add(strap);
    const strapMat = track(new THREE.MeshPhysicalMaterial({ color: 0x1a1d23, roughness: 0.3, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.4 }));
    const tab = new THREE.Mesh(track(new RoundedBoxGeometry(0.48, 0.32, 0.07, 6, 0.035)), strapMat);
    tab.position.set(WALLET.w / 2 - 0.16, 0.0, FRONT_Z + 0.035);
    strap.add(tab);
    const tabSide = new THREE.Mesh(track(new RoundedBoxGeometry(0.07, 0.32, WALLET.d + 0.1, 6, 0.035)), strapMat);
    tabSide.position.set(WALLET.w / 2 + 0.025, 0.0, 0);
    strap.add(tabSide);
    const btnMat = track(new THREE.MeshPhysicalMaterial({ color: 0xd0d8e4, roughness: 0.14, metalness: 1, envMapIntensity: 2.4 }));
    const btn = new THREE.Mesh(track(new THREE.SphereGeometry(0.085, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2)), btnMat);
    btn.rotation.x = Math.PI / 2;
    btn.scale.set(1, 0.45, 1);
    btn.position.set(WALLET.w / 2 - 0.27, 0.0, FRONT_Z + 0.07);
    strap.add(btn);
    const btnRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.087, 0.01, 12, 48)), btnMat);
    btnRing.position.copy(btn.position).setZ(FRONT_Z + 0.071);
    strap.add(btnRing);

    // --- Blocks ------------------------------------------------------------
    this.blockEdgeColor = linearColor(p.blockEdge);
    this.dockedEdge = version.story === "blocks" ? 1.3 : 0.75;
    const glassGeom = track(new RoundedBoxGeometry(BLOCK.size, BLOCK.size, BLOCK.size, 3, BLOCK.radius));
    const edgeGeom = track(new THREE.BoxGeometry(1, 1, 1));
    const glassMat = track(
      new THREE.MeshPhysicalMaterial({
        color: linearColor(p.blockTint),
        transmission: 0.6,
        roughness: 0.22,
        thickness: 0.3,
        ior: 1.45,
        metalness: 0,
        clearcoat: 0.25,
        clearcoatRoughness: 0.2,
        emissive: linearColor(p.blockEdge),
        emissiveIntensity: 0.035,
        envMapIntensity: 1.0,
      }),
    );
    const makeBlock = (): BlockObj => {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(glassGeom, glassMat));
      const edge = track(makeEdgeMaterial({ color: this.blockEdgeColor, intensity: 1.3, width: 0.006, glow: 0.16, inner: 0.05, fresnel: 0.3 }));
      const s = BLOCK.size * 1.012;
      edge.uniforms.uSize.value.set(s, s, s);
      const em = new THREE.Mesh(edgeGeom, edge);
      em.scale.set(s, s, s);
      group.add(em);
      this.scene.add(group);
      return { group, edge };
    };
    for (let i = 0; i < blockCount(version.story); i++) this.blocks.push(makeBlock());
    for (let i = 0; i < looseCount(version.story); i++) this.loose.push(makeBlock());

    // Chain links between neighbouring blocks in flight.
    const ls = links(version.story);
    this.linkPos = new Float32Array(Math.max(1, ls.length) * 6);
    this.linkCol = new Float32Array(Math.max(1, ls.length) * 6);
    if (ls.length > 0) {
      this.linkGeom = track(new LineSegmentsGeometry());
      this.linkMat = track(
        new LineMaterial({ vertexColors: true, linewidth: 1.3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, worldUnits: false }),
      );
      this.linkLines = new LineSegments2(this.linkGeom, this.linkMat);
      this.linkLines.frustumCulled = false;
      this.scene.add(this.linkLines);
    }

    // --- Security panels and padlock ----------------------------------------
    const accent = linearColor(p.accent);
    if (version.story !== "blocks") {
      const circuit = track(makeCircuitTexture(0xc1c0));
      for (let k = 0; k < 3; k++) {
        const mat = track(
          makeEdgeMaterial({ color: accent, intensity: 0.9, width: 0.011, glow: 0.8, tex: circuit, texAmt: 3.2, side: 0.7, fill: 0.26, fresnel: 0 }),
        );
        mat.side = THREE.DoubleSide;
        const mesh = new THREE.Mesh(edgeGeom, mat);
        mesh.renderOrder = 2;
        this.scene.add(mesh);
        this.panels.push({ mesh, mat });
      }

      this.lockBase = linearColor(p.lock);
      this.lockMat = track(
        new THREE.MeshPhysicalMaterial({
          color: this.lockBase,
          transmission: 0.5,
          // Rough enough that what is behind (the wallet's bright rim) blurs
          // into a glow instead of reading as a sharp line through the lock.
          roughness: 0.42,
          thickness: 1.2,
          ior: 1.5,
          attenuationColor: this.lockBase,
          attenuationDistance: 0.2,
          clearcoat: 1,
          clearcoatRoughness: 0.06,
          emissive: this.lockBase,
          emissiveIntensity: 0.9,
          envMapIntensity: 1.0,
        }),
      );
      const body = new THREE.Mesh(track(new RoundedBoxGeometry(LOCK.bodyW, LOCK.bodyH, LOCK.bodyD, 5, 0.085)), this.lockMat);
      this.lock.add(body);
      // Keyhole
      const keyMat = track(new THREE.MeshBasicMaterial({ color: this.lockBase.clone().multiplyScalar(0.3) }));
      const hole = new THREE.Mesh(track(new THREE.CircleGeometry(0.055, 32)), keyMat);
      hole.position.set(0, 0.04, LOCK.bodyD / 2 + 0.002);
      const slot = new THREE.Mesh(track(new THREE.PlaneGeometry(0.04, 0.14)), keyMat);
      slot.position.set(0, -0.04, LOCK.bodyD / 2 + 0.002);
      this.lock.add(hole, slot);
      // Shackle: a half torus on two legs.
      const R = 0.27;
      const tube = 0.072;
      const arc = new THREE.Mesh(track(new THREE.TorusGeometry(R, tube, 24, 48, Math.PI)), this.lockMat);
      arc.position.y = LOCK.bodyH / 2 + 0.26;
      const legGeom = track(new THREE.CylinderGeometry(tube, tube, 0.42, 24));
      const legL = new THREE.Mesh(legGeom, this.lockMat);
      legL.position.set(-R, LOCK.bodyH / 2 + 0.05, 0);
      const legR = new THREE.Mesh(legGeom, this.lockMat);
      legR.position.set(R, LOCK.bodyH / 2 + 0.05, 0);
      this.shackle.add(arc, legL, legR);
      this.lock.add(this.shackle);
      this.lock.position.set(LOCK.x, LOCK.y, LOCK.z);
      this.lock.rotation.y = -0.08;
      this.lock.scale.setScalar(0.95);
      this.scene.add(this.lock);
    } else {
      this.lockBase = new THREE.Color();
      this.lockMat = track(new THREE.MeshPhysicalMaterial());
    }
  }

  private applyBlock(o: BlockObj, pose: BlockPose) {
    o.group.visible = pose.visible;
    o.group.position.set(...pose.pos);
    o.group.rotation.set(...pose.rot);
    o.group.scale.setScalar(pose.scale ?? 1);
    o.edge.uniforms.uIntensity.value = (pose.docked ? this.dockedEdge : 1.3) * pose.edge;
    // Docked blocks read as one frosted, luminous slab rather than a grid.
    o.edge.uniforms.uFaceFill.value = pose.docked ? 0.07 : 0.05;
    o.edge.uniforms.uWidth.value = pose.docked ? 0.004 : 0.006;
  }

  // Sets every object for this frame. Pure function of `frame`.
  update(frame: number, pixelScale: number, bufW: number, bufH: number) {
    const v = this.version;
    const story = v.story;
    const loop = v.loopFrames;

    const [b1, b2] = balances(story, v.screen.rows, frame, loop);
    this.screen.draw(b1, b2);

    this.blocks.forEach((o, i) => this.applyBlock(o, blockPose(story, i, frame, loop)));
    this.loose.forEach((o, i) => this.applyBlock(o, loosePose(i, frame, loop)));

    if (this.linkGeom && this.linkMat) {
      const ls = links(story);
      ls.forEach(([a, b], k) => {
        const pa = this.blocks[a].group.position;
        const pb = this.blocks[b].group.position;
        const vis = this.blocks[a].group.visible && this.blocks[b].group.visible;
        const al = vis ? linkAlpha(story, a, b, frame, pa.distanceTo(pb)) : 0;
        this.linkPos.set([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z], k * 6);
        const c = this.blockEdgeColor;
        const s = al * 1.4;
        this.linkCol.set([c.r * s, c.g * s, c.b * s, c.r * s, c.g * s, c.b * s], k * 6);
      });
      this.linkGeom.setPositions(this.linkPos);
      this.linkGeom.setColors(this.linkCol);
      this.linkMat.linewidth = 1.3 * pixelScale;
      this.linkMat.resolution.set(bufW, bufH);
    }

    this.panels.forEach(({ mesh, mat }, k) => {
      const st = panelState(story, k, frame, loop);
      const x = PANEL.x0 + k * PANEL.dx;
      mesh.visible = st.opacity > 0.001;
      mesh.position.set(x, PANEL.y, FRONT_Z + 0.004 + st.depth / 2);
      mesh.scale.set(PANEL.w, PANEL.h, st.depth);
      mat.uniforms.uSize.value.set(PANEL.w, PANEL.h, st.depth);
      mat.uniforms.uOpacity.value = st.opacity;
      mat.uniforms.uIntensity.value = 0.9 * st.shimmer;
      // Mirrored-repeat texture: its period is 2, so scrolling exactly 2 per loop
      // returns to the start (seamless in the hold loop).
      mat.uniforms.uTexOffset.value.set(k * 0.31, k * 0.17 + st.scroll * 2);
    });

    if (story !== "blocks") {
      const l = lockState(story, frame, loop);
      this.lock.visible = l.visible;
      this.lock.position.set(LOCK.x, LOCK.y + l.drop, LOCK.z);
      this.shackle.position.y = l.shackle;
      this.lockMat.emissiveIntensity = 0.9 + 0.3 * l.glow + 1.3 * l.flash;
    }

    const cam = cameraPose(story, frame, loop);
    const t = new THREE.Vector3(...cam.target);
    this.camera.position.set(
      t.x + cam.dist * Math.sin(cam.az) * Math.cos(cam.el),
      t.y + cam.dist * Math.sin(cam.el),
      t.z + cam.dist * Math.cos(cam.az) * Math.cos(cam.el),
    );
    this.camera.lookAt(t);
    this.camera.updateMatrixWorld();
    this.focusDistance = this.camera.position.distanceTo(new THREE.Vector3(0, 0.1, 0.2));
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
