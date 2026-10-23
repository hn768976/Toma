import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RACK_HEIGHT, RACK_PITCH, RACK_UNIT } from "./constants";
import {
  makeDoorTexture,
  makeGrilleTexture,
  makeSlimTrayTexture,
  makeVentTexture,
} from "./textures";

// Deterministic PRNG so every frame and every render builds the same room.
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const hash01 = (i: number, j: number) => {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

// Collects box instances per material and turns them into InstancedMeshes.
class BoxBatch {
  private items: THREE.Matrix4[] = [];
  constructor(
    readonly material: THREE.Material,
    readonly geometry: THREE.BufferGeometry = new THREE.BoxGeometry(1, 1, 1),
  ) {}

  // (x0, y0, z0) is the min corner, size in cm.
  box(x0: number, y0: number, z0: number, w: number, h: number, d: number) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x0 + w / 2, y0 + h / 2, z0 + d / 2),
      new THREE.Quaternion(),
      new THREE.Vector3(w, h, d),
    );
    this.items.push(m);
    return this.items.length - 1;
  }

  matrix(m: THREE.Matrix4) {
    this.items.push(m);
    return this.items.length - 1;
  }

  get count() {
    return this.items.length;
  }

  build() {
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, Math.max(1, this.items.length));
    this.items.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.count = this.items.length;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }
}

export type LedInfo = {
  mesh: THREE.InstancedMesh;
  base: THREE.Color;
  blink: number[]; // per-instance blink style: 0 steady, >0 activity rate
  gain: number[]; // per-instance brightness (neighbouring racks are dimmer)
};

export type Palette = {
  background: THREE.Color;
  ledBlue: THREE.Color;
  ledGreen: THREE.Color;
  strip: THREE.Color;
  keyLight: THREE.Color;
  fill: THREE.Color;
};

export const defaultPalette: Palette = {
  background: new THREE.Color("#05070b"),
  ledBlue: new THREE.Color(0.2, 0.45, 2.6),
  ledGreen: new THREE.Color(0.2, 1.4, 0.55),
  strip: new THREE.Color(0.04, 0.22, 2.6),
  keyLight: new THREE.Color("#dfe8ff"),
  fill: new THREE.Color("#2a4c9a"),
};

export const buildWorld = (renderer: THREE.WebGLRenderer, palette: Palette) => {
  const scene = new THREE.Scene();
  scene.background = palette.background;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.4;

  const vent = makeVentTexture();
  const slim = makeSlimTrayTexture();
  const grille = makeGrilleTexture();
  const door = makeDoorTexture();

  const mat = {
    chassis: new THREE.MeshStandardMaterial({ color: "#121419", metalness: 0.7, roughness: 0.42 }),
    post: new THREE.MeshStandardMaterial({ color: "#0a0b0e", metalness: 0.6, roughness: 0.5 }),
    tray: new THREE.MeshStandardMaterial({ color: "#8a94a3", map: vent, metalness: 0.55, roughness: 0.4 }),
    slim: new THREE.MeshStandardMaterial({ color: "#7d8796", map: slim, metalness: 0.55, roughness: 0.4 }),
    teal: new THREE.MeshStandardMaterial({ color: "#1f7a70", metalness: 0.3, roughness: 0.35 }),
    grille: new THREE.MeshStandardMaterial({ color: "#ffffff", map: grille, metalness: 0.6, roughness: 0.45 }),
    handle: new THREE.MeshStandardMaterial({ color: "#9ea7b2", metalness: 0.8, roughness: 0.35 }),
    latch: new THREE.MeshStandardMaterial({ color: "#9aa3ae", metalness: 0.8, roughness: 0.35 }),
    door: new THREE.MeshStandardMaterial({ color: "#ffffff", map: door, metalness: 0.65, roughness: 0.45 }),
    floor: new THREE.MeshStandardMaterial({ color: "#1a1d23", metalness: 0.3, roughness: 0.35 }),
    led: new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: true }),
    strip: new THREE.MeshBasicMaterial({ color: palette.strip, toneMapped: true }),
  };

  const B = {
    chassis: new BoxBatch(mat.chassis),
    post: new BoxBatch(mat.post),
    tray: new BoxBatch(mat.tray),
    slim: new BoxBatch(mat.slim),
    grille: new BoxBatch(mat.grille),
    handle: new BoxBatch(mat.handle),
    latch: new BoxBatch(mat.latch),
    teal: new BoxBatch(mat.teal),
    door: new BoxBatch(mat.door),
    strip: new BoxBatch(mat.strip),
    hoop: new BoxBatch(mat.handle, new THREE.TorusGeometry(1, 0.11, 10, 24, Math.PI)),
  };
  const blue = new BoxBatch(mat.led, new THREE.SphereGeometry(0.32, 12, 8));
  const green = new BoxBatch(mat.led, new THREE.BoxGeometry(1, 1, 1));
  const blueGain: number[] = [];
  const greenGain: number[] = [];
  // Racks other than the hero rack (index 0) get dimmer LEDs.
  let ledGain = 1;
  const addBlue = (rate: number) => {
    blueBlink.push(rate);
    blueGain.push(ledGain);
  };
  const addGreen = (rate: number) => {
    greenBlink.push(rate);
    greenGain.push(ledGain);
  };
  const blueBlink: number[] = [];
  const greenBlink: number[] = [];

  const rnd = mulberry32(2024);
  const X0 = 5.5; // inner left edge of the 19" opening
  const X1 = 54.5;

  const server2UBays = (ox: number, y: number) => {
    const h = RACK_UNIT * 2;
    B.chassis.box(ox + X0, y, -1.2, X1 - X0, h - 0.12, 1.2);
    // Rack ears with status LEDs.
    blue.box(ox + X0 + 1.1, y + h - 2.2, 0.0, 0.55, 0.55, 0.55);
    addBlue(0);
    blue.box(ox + X0 + 1.1, y + h - 4.0, 0.0, 0.55, 0.55, 0.55);
    addBlue(rnd() < 0.5 ? 1.5 + rnd() * 3 : 0);
    const cols = 4;
    const rows = 3;
    const left = ox + X0 + 3.4;
    const right = ox + X1 - 1.4;
    const bw = (right - left) / cols;
    const bh = (h - 1.0) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = left + c * bw + 0.15;
        const by = y + 0.5 + r * bh + 0.12;
        const w = bw - 0.3;
        const hh = bh - 0.24;
        B.tray.box(bx, by, -0.2, w - 1.5, hh, 0.55);
        // Silver latch handle at the right end of each tray.
        // Small silver pull-handle at the right end of each tray.
        B.handle.box(bx + w - 1.5, by + hh * 0.18, -0.2, 1.4, hh * 0.64, 0.95);
        blue.box(bx + 0.35, by + hh / 2 - 0.25, 0.32, 0.5, 0.5, 0.5);
        addBlue(rnd() < 0.35 ? 1.5 + rnd() * 3.5 : 0);
      }
    }
    return h;
  };

  const server2USlim = (ox: number, y: number) => {
    const h = RACK_UNIT * 2;
    B.chassis.box(ox + X0, y, -1.2, X1 - X0, h - 0.12, 1.2);
    blue.box(ox + X0 + 1.1, y + h - 2.4, 0.0, 0.55, 0.55, 0.55);
    addBlue(0);
    const left = ox + X0 + 3.2;
    const right = ox + X1 - 1.2;
    const n = 24;
    const pitch = (right - left) / n;
    for (let i = 0; i < n; i++) {
      const bx = left + i * pitch + 0.1;
      const w = pitch - 0.2;
      const by = y + 0.45;
      const th = h - 1.5;
      // Dark tray body, a silver vertical pull-handle and a teal latch tab.
      B.slim.box(bx, by, -0.2, w, th * 0.84, 0.6);
      B.latch.box(bx + w * 0.3, by + th * 0.16, 0.4, w * 0.4, th * 0.58, 0.5);
      B.teal.box(bx + w * 0.18, by + th * 0.86, -0.2, w * 0.64, th * 0.12, 0.95);
      green.box(bx + w / 2 - 0.22, by + th + 0.08, 0.25, 0.44, 0.32, 0.35);
      addGreen(rnd() < 0.3 ? 1.5 + rnd() * 3.5 : 0);
    }
    return h;
  };

  const server1U = (ox: number, y: number) => {
    const h = RACK_UNIT;
    B.chassis.box(ox + X0, y, -1.2, X1 - X0, h - 0.12, 1.2);
    B.grille.box(ox + X0 + 4, y + 0.6, 0.0, X1 - X0 - 10, h - 1.3, 0.2);
    B.handle.box(ox + X1 - 5.2, y + 0.9, 0.0, 3.6, h - 1.9, 0.9);
    blue.box(ox + X0 + 1.4, y + h / 2 - 0.25, 0.1, 0.5, 0.5, 0.5);
    addBlue(0);
    green.box(ox + X0 + 2.4, y + h / 2 - 0.2, 0.1, 0.45, 0.4, 0.3);
    addGreen(1.5 + rnd() * 3);
    return h;
  };

  const openRack = (ox: number) => {
    B.post.box(ox, -2, -6, X0, RACK_HEIGHT, 8);
    B.post.box(ox + X1, -2, -6, 60 - X1, RACK_HEIGHT, 8);
    B.post.box(ox, RACK_HEIGHT - 8, -6, 60, 8, 8);
    // Blue LED strip and cable-management hoops on the right post.
    B.strip.box(ox + X1 + 1.6, -2, 2.0, 1.4, RACK_HEIGHT - 8, 0.4);
    for (let y = 6; y < RACK_HEIGHT - 12; y += 11) {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(ox + X1 + 2.3, y, 2.4),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, Math.PI / 2)),
        new THREE.Vector3(2.4, 2.4, 2.4),
      );
      B.hoop.matrix(m);
    }
    // Mostly alternating blocks of bay servers and slim-drive arrays, as in
    // the reference, with the occasional 1U box for variety.
    const pattern = ["bays", "bays", "slim", "slim", "bays", "slim", "bays", "bays", "slim", "slim"];
    let y = 2;
    let i = Math.floor(rnd() * pattern.length);
    while (y < RACK_HEIGHT - 14) {
      const kind = pattern[i++ % pattern.length];
      if (kind === "bays") y += server2UBays(ox, y);
      else if (kind === "slim") y += server2USlim(ox, y);
      else y += server1U(ox, y);
      y += 0.06;
    }
  };

  const doorRack = (ox: number) => {
    B.post.box(ox, -2, -6, 60, RACK_HEIGHT, 5);
    B.door.box(ox + 1.2, 1, -1, 57.6, RACK_HEIGHT - 4, 0.8);
    B.handle.box(ox + 52, 90, -0.2, 1.4, 28, 1.6);
    B.strip.box(ox + 58.5, -2, 0.2, 1.2, RACK_HEIGHT - 6, 0.4);
  };

  for (let i = -5; i <= 6; i++) {
    const ox = i * RACK_PITCH;
    ledGain = i === 0 ? 1 : 0.4;
    if (i === 4 || i === -4) doorRack(ox);
    else openRack(ox);
  }

  // Floor, ceiling and a bright far wall at the end of the aisle.
  const room = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 600), mat.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(200, -2, 100);
  room.add(floor);
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 600),
    new THREE.MeshStandardMaterial({ color: "#0d0f13", roughness: 0.9 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(200, 260, 100);
  room.add(ceiling);
  const farWall = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 400),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.8, 0.9) }),
  );
  farWall.position.set(700, 120, 80);
  farWall.rotation.y = -Math.PI / 2;
  room.add(farWall);
  // Opposite row of racks (only seen as soft reflections / far background).
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 260),
    new THREE.MeshStandardMaterial({ color: "#0a0c10", metalness: 0.4, roughness: 0.6 }),
  );
  backdrop.position.set(200, 120, 220);
  backdrop.rotation.y = Math.PI;
  room.add(backdrop);
  scene.add(room);

  for (const k of Object.keys(B) as (keyof typeof B)[]) scene.add(B[k].build());
  const blueMesh = blue.build();
  const greenMesh = green.build();
  scene.add(blueMesh, greenMesh);

  // Lighting: cool key from upper right, blue fill near the LED strips.
  scene.add(new THREE.HemisphereLight(palette.fill, "#000000", 0.35));
  const key = new THREE.DirectionalLight(palette.keyLight, 2.2);
  key.position.set(260, 220, 180);
  scene.add(key);
  const rim = new THREE.DirectionalLight(palette.fill, 0.9);
  rim.position.set(-200, 80, 120);
  scene.add(rim);
  for (let i = -4; i <= 2; i++) {
    for (const y of [60, 130, 200]) {
      const p = new THREE.PointLight(palette.strip.clone().multiplyScalar(0.3), 350, 45, 2);
      p.position.set(i * RACK_PITCH + 58, y, 10);
      scene.add(p);
    }
  }

  const leds: LedInfo[] = [
    { mesh: blueMesh, base: palette.ledBlue, blink: blueBlink, gain: blueGain },
    { mesh: greenMesh, base: palette.ledGreen, blink: greenBlink, gain: greenGain },
  ];
  return { scene, leds, env };
};

const tmpColor = new THREE.Color();

// Activity lights: most are steady, some flicker on deterministic patterns.
export const updateLeds = (leds: LedInfo[], t: number) => {
  for (const led of leds) {
    led.blink.forEach((rate, i) => {
      let k = 1;
      if (rate > 0) {
        const step = Math.floor(t * rate);
        k = hash01(i, step) < 0.55 ? 1 : 0.18;
      }
      tmpColor.copy(led.base).multiplyScalar(k * led.gain[i]);
      led.mesh.setColorAt(i, tmpColor);
    });
    if (led.mesh.instanceColor) led.mesh.instanceColor.needsUpdate = true;
  }
};
