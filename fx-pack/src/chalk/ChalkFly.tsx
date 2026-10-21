import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { useBacking } from "../lib/backing";
import { mulberry32, smoothstep, TAU } from "../lib/random";
import { renderCard } from "./card";
import { getItems } from "./items";
import { DIAGRAM_NAMES } from "./content";

/**
 * 2.5D flythrough: ~90 flat chalk cards in a repeating depth tile. The camera
 * looks down -z; cards move towards it by exactly one tile (DEPTH) in 600
 * frames, so frame 600 equals frame 0.
 */
const LOOP = 600;
const N_CARDS = 90;
const DEPTH = 24; // depth tile (world units)
const FOV = 55;
const PX_TO_WORLD = 1 / 215; // 4K px -> world units (native size at distance ~8)
const BOX_X = 15;
const BOX_Y = 8.5;

type CardSpec = { item: string; x: number; y: number; z0: number; scale: number; rx: number; ry: number; rz: number };

const CARDS: CardSpec[] = (() => {
  const rand = mulberry32(0xf1ea);
  const ids = Object.keys(getItemsIds());
  // shuffled round-robin so repeats are spread out
  const order = [...ids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const out: CardSpec[] = [];
  for (let i = 0; i < N_CARDS; i++) {
    const hero = i % 15 === 0;
    let x = (rand() * 2 - 1) * BOX_X;
    let y = (rand() * 2 - 1) * BOX_Y;
    if (hero) {
      // heroes pass fairly close, off-centre
      x = (rand() < 0.5 ? -1 : 1) * (4 + rand() * 4);
      y = (rand() * 2 - 1) * 3;
    }
    // keep a clear corridor so nothing passes through the lens
    if (Math.abs(x) < 4 && Math.abs(y) < 2.5) x = Math.sign(x || 1) * (4 + rand() * 2);
    out.push({
      item: order[i % order.length], // even spread: every item ~4 times
      x,
      y,
      z0: ((i + rand() * 0.8) / N_CARDS) * DEPTH, // stratified depth
      scale: hero ? 1.25 + rand() * 0.25 : 0.7 + rand() * 0.55,
      rx: (rand() - 0.5) * 0.35,
      ry: (rand() - 0.5) * 0.5,
      rz: (rand() - 0.5) * 0.12,
    });
  }
  return out;
})();

function getItemsIds() {
  // ids only (cheap: layout is cached and shared with the write-on clip)
  return getItems();
}

type Scene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  meshes: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[];
};

const build = (canvas: HTMLCanvasElement, bw: number, bh: number, k: number): Scene => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(bw, bh, false);
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, bw / bh, 0.05, 200);

  // one texture per distinct item, sized for the biggest it gets on screen
  const items = getItems();
  const textures: Record<string, { tex: THREE.Texture; w: number; h: number }> = {};
  Object.values(items).forEach((item, i) => {
    const card = renderCard(item, 2.2 * k, i + 1);
    const tex = new THREE.CanvasTexture(card.canvas);
    tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    textures[item.id] = { tex, w: card.w, h: card.h };
  });

  const meshes = CARDS.map((c) => {
    const t = textures[c.item];
    // diagrams are authored smaller than formulas; show them larger, as on a real board
    const sc = c.scale * ((DIAGRAM_NAMES as string[]).includes(c.item) ? 1.9 : 1);
    const geo = new THREE.PlaneGeometry(t.w * PX_TO_WORLD * sc, t.h * PX_TO_WORLD * sc);
    const mat = new THREE.MeshBasicMaterial({
      map: t.tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      color: 0xffffff,
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.set(c.rx, c.ry, c.rz);
    scene.add(m);
    return m;
  });
  return { renderer, scene, camera, meshes };
};

export const ChalkMath_Flythrough: React.FC = () => {
  const frame = useCurrentFrame();
  const { bw, bh, k } = useBacking();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);

  useLayoutEffect(() => {
    if (!sceneRef.current) sceneRef.current = build(canvasRef.current!, bw, bh, k);
    const { renderer, scene, camera, meshes } = sceneRef.current;
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const phase = f / LOOP;
    // slight periodic drift
    camera.position.set(0.9 * Math.sin(TAU * phase), 0.5 * Math.sin(TAU * 2 * phase + 1), 0);
    camera.rotation.set(0.02 * Math.sin(TAU * phase + 2), 0.03 * Math.sin(TAU * phase + 0.5), 0.01 * Math.sin(TAU * phase));
    meshes.forEach((m, i) => {
      const c = CARDS[i];
      // distance ahead of the camera, decreasing, wrapping every tile
      const d = (((c.z0 - DEPTH * phase) % DEPTH) + DEPTH) % DEPTH;
      m.position.set(c.x, c.y, -d);
      const fadeIn = smoothstep(DEPTH, DEPTH * 0.78, d);
      const fadeOut = smoothstep(4.5, 8, d); // gone before it gets huge
      const dim = 1 - 0.85 * smoothstep(10, DEPTH * 0.9, d); // far tier very dim
      const v = fadeIn * fadeOut * dim;
      m.visible = v > 0.002;
      m.material.color.setScalar(v);
      m.renderOrder = -d;
    });
    renderer.render(scene, camera);
    renderer.getContext().finish();
  }, [frame, bw, bh, k]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} width={bw} height={bh} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
