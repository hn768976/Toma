import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Corridor dimensions (world units). One cabinet column = one drawer width;
// the reference repeats every 42 frames, i.e. the camera advances exactly one
// column (and one floor tile) every 42 frames.
export const COL_W = 0.55;
export const ROW_H = 0.28;
export const ROWS = 10;
export const HALF_W = 2 * COL_W;
export const CEIL_H = ROWS * ROW_H;
export const EYE_H = 0.9;
const COLUMNS = 64;
const Z_START = 2;
const END_Z = -Z_START - COLUMNS * COL_W;

export type ArchiveScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dispose: () => void;
};

const makeFloorTexture = () => {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#f4f5f6");
  g.addColorStop(1, "#eceef0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#8f9396";
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
};

export const buildArchiveScene = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): ArchiveScene => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color("#e9ebec");
  scene.background = fogColor;
  // Haze lightens the far walls (as in the reference) and suppresses
  // shimmer from the dense drawer grid near the vanishing point.
  scene.fog = new THREE.Fog(fogColor, 3, 34);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;

  scene.add(new THREE.HemisphereLight("#ffffff", "#9a9da0", 1.4));
  const key = new THREE.DirectionalLight("#ffffff", 1.6);
  key.position.set(0, 6, -8);
  scene.add(key);
  const fill = new THREE.DirectionalLight("#ffffff", 0.6);
  fill.position.set(0, 2, 6);
  scene.add(fill);

  const disposables: { dispose: () => void }[] = [envTex, pmrem];

  // --- Floor ---------------------------------------------------------------
  const corridorLen = Z_START - END_Z;
  const floorTex = makeFloorTexture();
  floorTex.repeat.set((2 * HALF_W) / COL_W, corridorLen / COL_W);
  const floorGeo = new THREE.PlaneGeometry(2 * HALF_W, corridorLen);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.38,
    metalness: 0,
    color: "#cfd1d1",
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0.02,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, (Z_START + END_Z) / 2);
  scene.add(floor);
  disposables.push(floorTex, floorGeo, floorMat);

  // --- Luminous ceiling ------------------------------------------------------
  const ceilGeo = new THREE.PlaneGeometry(2 * HALF_W, corridorLen);
  const ceilMat = new THREE.MeshBasicMaterial({ color: "#c3c5c6" });
  const ceil = new THREE.Mesh(ceilGeo, ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, CEIL_H, (Z_START + END_Z) / 2);
  scene.add(ceil);
  disposables.push(ceilGeo, ceilMat);

  // --- Bright opening at the far end ------------------------------------------
  const endGeo = new THREE.PlaneGeometry(2 * HALF_W, CEIL_H);
  const endMat = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false });
  const end = new THREE.Mesh(endGeo, endMat);
  end.position.set(0, CEIL_H / 2, END_Z + 0.01);
  scene.add(end);
  disposables.push(endGeo, endMat);

  // Soft bloom around the opening.
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = 256;
  glowCanvas.height = 256;
  const gctx = glowCanvas.getContext("2d")!;
  const grad = gctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex,
    fog: false,
    depthWrite: false,
    transparent: true,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(9, 9, 1);
  glow.position.set(0, CEIL_H / 2, END_Z + 0.5);
  scene.add(glow);
  disposables.push(glowTex, glowMat);

  // --- Dark backing behind the drawers (reads as the seams) ------------------
  const backGeo = new THREE.PlaneGeometry(corridorLen, CEIL_H);
  const backMat = new THREE.MeshStandardMaterial({
    color: "#5a5c5c",
    roughness: 0.9,
  });
  for (const side of [-1, 1]) {
    const back = new THREE.Mesh(backGeo, backMat);
    back.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    back.position.set(side * HALF_W, CEIL_H / 2, (Z_START + END_Z) / 2);
    scene.add(back);
  }
  disposables.push(backGeo, backMat);

  // --- Instanced drawers ----------------------------------------------------
  const gap = 0.012;
  const frontDepth = 0.04;
  const frontGeo = new THREE.BoxGeometry(frontDepth, ROW_H - gap, COL_W - gap);
  const frontMat = new THREE.MeshStandardMaterial({
    color: "#a09f9a",
    metalness: 0.35,
    roughness: 0.45,
  });
  const labelGeo = new THREE.BoxGeometry(0.008, 0.058, 0.2);
  const labelMat = new THREE.MeshStandardMaterial({
    color: "#cfd1d2",
    roughness: 0.6,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0.08,
  });
  const frameGeo = new THREE.BoxGeometry(0.012, 0.076, 0.222);
  const frameMat = new THREE.MeshStandardMaterial({
    color: "#b9bcbf",
    metalness: 0.7,
    roughness: 0.3,
  });
  const handleGeo = new THREE.BoxGeometry(0.03, 0.013, 0.3);
  const handleMat = new THREE.MeshStandardMaterial({
    color: "#c4c7ca",
    metalness: 0.85,
    roughness: 0.22,
  });
  disposables.push(
    frontGeo,
    frontMat,
    labelGeo,
    labelMat,
    frameGeo,
    frameMat,
    handleGeo,
    handleMat,
  );

  const count = COLUMNS * ROWS * 2;
  const fronts = new THREE.InstancedMesh(frontGeo, frontMat, count);
  const frames = new THREE.InstancedMesh(frameGeo, frameMat, count);
  const labels = new THREE.InstancedMesh(labelGeo, labelMat, count);
  const handles = new THREE.InstancedMesh(handleGeo, handleMat, count);
  const m = new THREE.Matrix4();
  let i = 0;
  for (const side of [-1, 1]) {
    for (let col = 0; col < COLUMNS; col++) {
      const z = Z_START - col * COL_W - COL_W / 2;
      for (let row = 0; row < ROWS; row++) {
        const y = row * ROW_H + ROW_H / 2;
        const xFace = side * (HALF_W - frontDepth); // inner face of drawer front
        m.makeTranslation(side * (HALF_W - frontDepth / 2), y, z);
        fronts.setMatrixAt(i, m);
        m.makeTranslation(xFace - side * 0.004, y + 0.05, z);
        frames.setMatrixAt(i, m);
        m.makeTranslation(xFace - side * 0.009, y + 0.05, z);
        labels.setMatrixAt(i, m);
        m.makeTranslation(xFace - side * 0.03, y - 0.056, z);
        handles.setMatrixAt(i, m);
        i++;
      }
    }
  }
  for (const mesh of [fronts, frames, labels, handles]) {
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  const camera = new THREE.PerspectiveCamera(74, width / height, 0.05, 200);

  return {
    renderer,
    scene,
    camera,
    dispose: () => {
      for (const d of disposables) d.dispose();
      renderer.dispose();
    },
  };
};
