import * as THREE from "three";

export const SQUARE = 1.15;
export const BOARD_SQUARES = 10;

export const checkerTexture = (light: string, dark: string) => {
  const cells = BOARD_SQUARES;
  const px = 96;
  const c = document.createElement("canvas");
  c.width = cells * px;
  c.height = cells * px;
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? light : dark;
      ctx.fillRect(x * px, y * px, px, px);
    }
  }
  // Very faint polish streaks so the light squares do not read as flat paper.
  ctx.globalAlpha = 0.035;
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = i % 2 ? "#ffffff" : "#000000";
    ctx.fillRect(((i * 7919) % c.width), ((i * 104729) % c.height), 1 + (i % 5) * 40, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
};

export const glowTexture = () => {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.12, "rgba(255,255,255,0.65)");
  g.addColorStop(0.4, "rgba(255,255,255,0.16)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

/** Studio environment: dark room with soft-box strips for clean reflections. */
export const studioEnvironment = (renderer: THREE.WebGLRenderer, tint: string) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#050505");
  const panel = (w: number, h: number, intensity: number, pos: [number, number, number], look: [number, number, number]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.lookAt(...look);
    scene.add(m);
  };
  panel(6, 1.6, 7, [0, 6, 0], [0, 0, 0]);
  panel(5, 1.4, 4, [0, 5, 4], [0, 1, 0]);
  panel(1.2, 5, 3.2, [-5, 2, 1], [0, 1, 0]);
  panel(1.0, 5, 2.4, [5, 2, -1], [0, 1, 0]);
  panel(5, 2.6, 2.6, [0, 2, 6], [0, 1, 0]);
  panel(3, 1.4, 1.6, [0, 3, -6], [0, 1, 0]);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#1a1a1a") }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  scene.add(floor);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  return tex;
};
