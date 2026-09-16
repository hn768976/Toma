// Everything behind and below the chain: the dot-matrix world map, the
// scrolling wall of background digits, the floor of glowing data
// marks, the drifting particle haze and the small floating readouts.
//
// Every element is instanced, so the whole field costs about five draw
// calls. That matters because the render target here is a software
// (SwiftShader) WebGPU device with no real rasteriser behind it.
//
// Note on points: three's WebGPU backend can only draw 1-pixel point
// primitives, so THREE.Points is unusable for the map and the haze --
// both are InstancedMesh quads instead. The haze quads are billboarded
// on the CPU each frame; the map dots are coplanar with the map itself
// and need no billboarding.

import * as THREE from "three/webgpu";
import { texture, uv, vec2, uniform, float, attribute } from "three/tsl";
import {
  ACCENT_BLUE,
  ACCENT_CYAN,
  ACCENT_RED,
  ACCENT_WHITE,
  BASE_FLOOR_MARK_COUNT,
  BASE_NUMBER_LABEL_COUNT,
  BASE_PARTICLE_COUNT,
  WORLD_MAP_COLOR,
} from "../constants";
import {
  makeGlowTexture,
  makeNumberAtlasTexture,
  NUMBER_ATLAS_ROWS,
} from "../textures";
import { worldMapCells } from "../worldMap";
import type { LayoutConfig } from "../layouts";
import { makeRandom, range } from "../rng";

export type DataField = {
  group: THREE.Group;
  update: (
    frame: number,
    flow: number,
    cameraQuaternion: THREE.Quaternion,
    cameraPosition: THREE.Vector3,
  ) => void;
  dispose: () => void;
};

// Dense grid of dim digits used as the far wall. Kept separate from the
// cube skin so the two never scroll in lockstep.
const makeWallTexture = (seed: number, size = 1024) => {
  const random = makeRandom(seed);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.clearRect(0, 0, size, size);

  const cols = 104;
  const cell = size / cols;
  ctx.font = `500 ${Math.round(cell * 0.8)}px "Courier New", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let y = 0; y < cols; y++) {
    for (let x = 0; x < cols; x++) {
      const roll = random();
      // Sparse: the wall should suggest data, not form a solid block.
      if (roll < 0.72) continue;
      const bright = random();
      ctx.fillStyle =
        bright > 0.985
          ? "rgba(214, 62, 62, 0.42)"
          : bright > 0.93
            ? "rgba(188, 220, 244, 0.30)"
            : "rgba(44, 100, 164, 0.26)";
      ctx.fillText(random() < 0.5 ? "0" : "1", (x + 0.5) * cell, (y + 0.5) * cell);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
};

export const createDataField = (
  layout: LayoutConfig,
  seed: number,
  resolutionScale: number,
): DataField => {
  const random = makeRandom(seed);
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];

  // Density scales with resolution but is capped: past 2x the extra
  // marks are smaller than a pixel and only cost render time.
  const densityScale = Math.min(resolutionScale, 2);

  const glowTexture = makeGlowTexture(64);
  const numberAtlas = makeNumberAtlasTexture(seed + 313);
  disposables.push(glowTexture, numberAtlas);

  // Sideways vector in the ground plane, used to spread the field
  // across the chain rather than in an axis-aligned box.
  const acrossX = -layout.direction.z;
  const acrossZ = layout.direction.x;

  // --- Far wall of digits ------------------------------------------
  const wallTexture = makeWallTexture(seed + 77, 1024);
  wallTexture.repeat.set(5, 4);
  disposables.push(wallTexture);
  const wallScroll = uniform(0);
  const wallMaterial = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  {
    const sampled = texture(wallTexture, uv().add(vec2(float(0), wallScroll)));
    wallMaterial.colorNode = sampled.rgb;
    wallMaterial.opacityNode = sampled.a.mul(0.34);
  }
  const wallGeometry = new THREE.PlaneGeometry(
    layout.mapSize[0] * 2.6,
    layout.mapSize[1] * 2.6,
  );
  const wall = new THREE.Mesh(wallGeometry, wallMaterial);
  wall.position.copy(layout.mapCenter).setZ(layout.mapCenter.z - 6);
  wall.rotation.y = layout.mapYaw;
  wall.frustumCulled = false;
  group.add(wall);
  disposables.push(wallGeometry, wallMaterial);

  // --- Dot-matrix world map ----------------------------------------
  const cells = worldMapCells();
  const [mapW, mapH] = layout.mapSize;
  const dotGeometry = new THREE.PlaneGeometry(1, 1);
  const mapMaterial = new THREE.MeshBasicNodeMaterial({
    map: glowTexture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const mapDots = new THREE.InstancedMesh(dotGeometry, mapMaterial, cells.length);
  mapDots.frustumCulled = false;
  {
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    const base = new THREE.Color(WORLD_MAP_COLOR);
    const dot = (mapW / 96) * 0.62;
    cells.forEach((cell, i) => {
      p.set((cell.u - 0.5) * mapW, (0.5 - cell.v) * mapH, 0);
      s.set(dot, dot, 1);
      m.compose(p, q, s);
      mapDots.setMatrixAt(i, m);
      mapDots.setColorAt(i, c.copy(base).multiplyScalar(range(random, 0.16, 0.52)));
    });
  }
  mapDots.instanceMatrix.needsUpdate = true;
  mapDots.position.copy(layout.mapCenter);
  mapDots.rotation.y = layout.mapYaw;
  group.add(mapDots);
  disposables.push(dotGeometry, mapMaterial);

  // --- Floor of glowing data marks ---------------------------------
  const markCount = Math.round(BASE_FLOOR_MARK_COUNT * densityScale);
  const markGeometry = new THREE.PlaneGeometry(1, 1);
  const markMaterial = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  markMaterial.opacityNode = float(0.72);
  const marks = new THREE.InstancedMesh(markGeometry, markMaterial, markCount);
  marks.frustumCulled = false;
  const markPalette = [ACCENT_BLUE, ACCENT_BLUE, ACCENT_CYAN, ACCENT_WHITE, ACCENT_RED];
  {
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < markCount; i++) {
      const along = range(random, -14, 32);
      const across = range(random, -15, 15);
      p.set(
        layout.direction.x * along + acrossX * across,
        // Tight vertical band: these read as a floor, not a snowstorm.
        layout.floorY + range(random, -0.22, 0.22),
        layout.direction.z * along + acrossZ * across,
      );
      e.set(
        -Math.PI / 2 + range(random, -0.1, 0.1),
        range(random, -0.5, 0.5),
        range(random, 0, Math.PI),
      );
      q.setFromEuler(e);
      const w = range(random, 0.05, 0.19);
      s.set(w, w * range(random, 0.22, 0.55), 1);
      m.compose(p, q, s);
      marks.setMatrixAt(i, m);
      const roll = random();
      const pickIndex = roll > 0.93 ? 4 : Math.floor(roll * 4);
      c.set(markPalette[pickIndex]).multiplyScalar(range(random, 0.3, 1.15));
      marks.setColorAt(i, c);
    }
  }
  marks.instanceMatrix.needsUpdate = true;
  group.add(marks);
  disposables.push(markGeometry, markMaterial);

  // --- Drifting particle haze ---------------------------------------
  const particleCount = Math.round(BASE_PARTICLE_COUNT * densityScale);
  const hazeGeometry = new THREE.PlaneGeometry(1, 1);
  const hazeMaterial = new THREE.MeshBasicNodeMaterial({
    map: glowTexture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const haze = new THREE.InstancedMesh(hazeGeometry, hazeMaterial, particleCount);
  haze.frustumCulled = false;
  haze.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const hazeHome = new Float32Array(particleCount * 3);
  const hazeSize = new Float32Array(particleCount);
  const hazePhase = new Float32Array(particleCount);
  {
    const c = new THREE.Color();
    for (let i = 0; i < particleCount; i++) {
      const along = range(random, -14, 38);
      const across = range(random, -20, 20);
      hazeHome[i * 3] = layout.direction.x * along + acrossX * across;
      hazeHome[i * 3 + 1] = range(random, layout.floorY - 0.5, layout.floorY + 9);
      hazeHome[i * 3 + 2] = layout.direction.z * along + acrossZ * across;
      const roll = random();
      if (roll > 0.94) c.set(ACCENT_RED);
      else if (roll > 0.82) c.set(ACCENT_WHITE);
      else if (roll > 0.55) c.set(ACCENT_CYAN);
      else c.set(ACCENT_BLUE);
      haze.setColorAt(i, c.multiplyScalar(range(random, 0.18, 0.8)));
      hazeSize[i] = range(random, 0.035, 0.115);
      hazePhase[i] = random() * Math.PI * 2;
    }
  }
  group.add(haze);
  disposables.push(hazeGeometry, hazeMaterial);

  // --- Floating readouts --------------------------------------------
  const labelCount = Math.round(BASE_NUMBER_LABEL_COUNT * densityScale);
  const labelGeometry = new THREE.PlaneGeometry(1, 1);
  // Each instance samples one row of the atlas through a per-instance
  // UV offset, so the whole set is a single draw call.
  const rowOffsets = new Float32Array(labelCount);
  const labelMaterial = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  {
    const rowUv = uv()
      .mul(vec2(1, 1 / NUMBER_ATLAS_ROWS))
      .add(vec2(float(0), attribute("aRow", "float")));
    const sampled = texture(numberAtlas, rowUv);
    labelMaterial.colorNode = sampled.rgb;
    labelMaterial.opacityNode = sampled.a.mul(0.5);
  }
  const labels = new THREE.InstancedMesh(labelGeometry, labelMaterial, labelCount);
  labels.frustumCulled = false;
  {
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    for (let i = 0; i < labelCount; i++) {
      rowOffsets[i] = Math.floor(random() * NUMBER_ATLAS_ROWS) / NUMBER_ATLAS_ROWS;
      const along = range(random, -10, 32);
      const across = range(random, -16, 16);
      p.set(
        layout.direction.x * along + acrossX * across,
        range(random, layout.floorY, layout.floorY + 7),
        layout.direction.z * along + acrossZ * across,
      );
      e.set(0, layout.mapYaw + range(random, -0.3, 0.3), 0);
      q.setFromEuler(e);
      const w = range(random, 0.22, 0.5);
      s.set(w, w / 4, 1);
      m.compose(p, q, s);
      labels.setMatrixAt(i, m);
    }
  }
  labelGeometry.setAttribute(
    "aRow",
    new THREE.InstancedBufferAttribute(rowOffsets, 1),
  );
  labels.instanceMatrix.needsUpdate = true;
  group.add(labels);
  disposables.push(labelGeometry, labelMaterial);

  // --- Ground depth proxy ---------------------------------------------
  // Same trick as the chain's proxy: an invisible plane at floor level
  // gives the depth-of-field pass a real distance gradient across the
  // lower half of frame, so the foreground marks defocus and the ones
  // out by the chain stay tighter. Without it the whole floor would
  // sit at the far plane and blur uniformly.
  const proxyMaterial = new THREE.MeshBasicNodeMaterial({ colorWrite: false });
  const floorProxy = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), proxyMaterial);
  floorProxy.rotation.x = -Math.PI / 2;
  floorProxy.position.y = layout.floorY;
  floorProxy.frustumCulled = false;
  floorProxy.renderOrder = -1;
  group.add(floorProxy);
  disposables.push(floorProxy.geometry, proxyMaterial);

  // --- Per-frame -----------------------------------------------------
  const hazeMatrix = new THREE.Matrix4();
  const hazePosition = new THREE.Vector3();
  const hazeScale = new THREE.Vector3();

  // A haze particle right in front of the lens defocuses into a disc
  // tens of pixels across, which reads as a lens smudge rather than as
  // atmosphere. Fade them out before they get that close.
  const CULL_NEAR = 5;
  const CULL_FAR = 8.5;

  const update = (
    frame: number,
    flow: number,
    cameraQuaternion: THREE.Quaternion,
    cameraPosition: THREE.Vector3,
  ) => {
    wallScroll.value = (flow * 0.012) % 1;

    for (let i = 0; i < particleCount; i++) {
      // Slow vertical rise with a per-particle phase, wrapped so the
      // haze never thins out at either end.
      const drift =
        ((frame * 0.0016 * (0.4 + hazeSize[i] * 6) + hazePhase[i] / 12) % 1) * 1.8;
      hazePosition.set(
        hazeHome[i * 3],
        hazeHome[i * 3 + 1] + drift - 0.9,
        hazeHome[i * 3 + 2],
      );
      const nearFade = THREE.MathUtils.smoothstep(
        hazePosition.distanceTo(cameraPosition),
        CULL_NEAR,
        CULL_FAR,
      );
      hazeScale.setScalar(hazeSize[i] * nearFade);
      hazeMatrix.compose(hazePosition, cameraQuaternion, hazeScale);
      haze.setMatrixAt(i, hazeMatrix);
    }
    haze.instanceMatrix.needsUpdate = true;
  };

  const dispose = () => {
    for (const d of disposables) d.dispose();
  };

  return { group, update, dispose };
};
