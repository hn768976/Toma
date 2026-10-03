import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Pipeline } from "../../lib/three/Pipeline";
import { SceneFactory, ThreeStage } from "../../lib/three/ThreeStage";
import { mulberry32, TAU } from "../../lib/rng";
import type { GlassColors } from "../../versions";

const LOOP = 600;
const N_FRONT = 40;
const N_BACK = 26;
const SPACING = 0.44;
const WAVE_SLATS = 15; // wavelength in slats
const WAVE_CYCLES = 2; // whole wavelengths travelled per 600-frame loop

type Slat = { mesh: THREE.Mesh; i: number; row: 0 | 1; base: number; phase: number };

const factory: SceneFactory<{ colors: GlassColors }> = ({ gl, assets, props }) => {
  const { colors } = props;
  const rand = mulberry32(0x91a55);
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const bg = new THREE.Color(colors.background).multiplyScalar(1.6);
  scene.background = bg;
  const pmrem = new THREE.PMREMGenerator(gl);
  const env = pmrem.fromEquirectangular(assets.hdr!).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);

  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(-4, 7, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -7;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0005;
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(colors.tintA), 0.15));

  // pale backdrop that catches soft shadows
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 30),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.white), roughness: 1 }),
  );
  wall.position.set(0, 0, -5.5);
  wall.receiveShadow = true;
  scene.add(wall);
  // soft white folds (draped cloth) the slats stand in
  const clothGeo = new THREE.PlaneGeometry(30, 10, 160, 60);
  const cp = clothGeo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i);
    cp.setZ(i, 0.35 * Math.sin(x * 1.3 + Math.sin(y * 0.9) * 1.5) * Math.sin(y * 0.8 + x * 0.3) + 0.15 * Math.sin(x * 3.1 + y * 2.2));
  }
  clothGeo.computeVertexNormals();
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.white), roughness: 0.9 }));
  cloth.rotation.x = -Math.PI / 2 + 0.25;
  cloth.position.set(0, -2.3, -1.5);
  cloth.receiveShadow = true;
  scene.add(cloth);

  const geo = new RoundedBoxGeometry(0.95, 3.3, 0.25, 5, 0.09);
  const slatMats = (kind: number, irid: string) => {
    const tint = new THREE.Color(kind === 0 ? colors.tintA : kind === 1 ? colors.tintB : kind === 3 ? colors.iridescence[0] : colors.white);
    const pw = kind === 0 ? 2.4 : kind === 1 ? 2.1 : 1;
    if (kind === 3) tint.lerp(new THREE.Color(colors.white), 0.45);
    tint.setRGB(Math.pow(tint.r, pw), Math.pow(tint.g, pw), Math.pow(tint.b, pw));
    return new THREE.MeshPhysicalMaterial({
      color: tint,
      roughness: kind === 2 ? 0.35 : 0.18,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: kind === 2 ? 0.96 : kind === 0 ? 0.86 : 0.9,
      sheen: 0.8,
      sheenColor: new THREE.Color(irid),
      sheenRoughness: 0.35,
      iridescence: 0.35,
      iridescenceIOR: 1.35,
      envMapIntensity: 1.1,
      ior: 1.5,
      specularIntensity: 1,
    });
  };

  const slats: Slat[] = [];
  const row = new THREE.Group();
  scene.add(row);
  const mk = (i: number, r: 0 | 1, n: number) => {
    const u = rand();
    const kind = r === 1 ? (u < 0.6 ? 2 : 1) : u < 0.42 ? 0 : u < 0.84 ? 1 : u < 0.93 ? 3 : 2;
    const m = new THREE.Mesh(geo, slatMats(kind, colors.iridescence[i % 2]));
    m.castShadow = true;
    m.receiveShadow = true;
    m.position.set((i - (n - 1) / 2) * SPACING * (r === 1 ? 1.25 : 1), 0, r === 1 ? -1.7 : 0);
    row.add(m);
    slats.push({ mesh: m, i, row: r, base: 0.85 + (rand() - 0.5) * 0.08, phase: r === 1 ? 1.7 : 0 });
  };
  for (let i = 0; i < N_FRONT; i++) mk(i, 0, N_FRONT);
  for (let i = 0; i < N_BACK; i++) mk(i, 1, N_BACK);
  row.rotation.z = 0;

  const pipe = new Pipeline(gl, scene, camera, {
    bloom: { strength: 0.22, radius: 0.5, threshold: 1.05 },
    grain: 0.015,
    exposure: 1.0,
  });

  return {
    render(frame) {
      const { w, h } = pipe.ensureSize();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const t = (frame % LOOP) / LOOP;
      for (const s of slats) {
        const k = s.i / WAVE_SLATS - WAVE_CYCLES * t;
        const wv = Math.sin(TAU * k + s.phase);
        // turn about the vertical axis (travelling sine) + a lean about the row axis a quarter
        // wave behind it, so the row reads as a twisting ribbon
        const lean = Math.sin(TAU * k + s.phase + Math.PI / 2);
        s.mesh.rotation.set(0.5 * lean, s.base + 0.42 * wv, 0, "YXZ");
        s.mesh.position.y = (s.row === 1 ? 0.7 : 0) + 0.12 * Math.sin(TAU * k + s.phase + 1.2);
      }
      // closed camera drift
      const a = TAU * t;
      camera.position.set(0.5 + 0.3 * Math.sin(a), 0.7 + 0.1 * Math.sin(2 * a), 7.4 + 0.2 * Math.cos(a));
      camera.lookAt(0.1 + 0.15 * Math.sin(a), 0.2, 0);
      pipe.render(frame % LOOP);
    },
    dispose() {
      pipe.dispose();
      pmrem.dispose();
    },
  };
};

export const GlassTwist: React.FC<{ colors: GlassColors }> = ({ colors }) => (
  <ThreeStage factory={factory} props={{ colors }} needHDR background={colors.background} />
);
