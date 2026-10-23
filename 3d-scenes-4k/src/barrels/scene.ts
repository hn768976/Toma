import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createPost } from "../lib/post";
import { mulberry32, easeInOutSine } from "../lib/random";
import type { StageSetup } from "../lib/ThreeStage";

export type BarrelVariant = "v1" | "v2";

const R = 1; // drum radius
const PITCH_X = 2.1; // spacing between drum centres in a row
const PITCH_Z = PITCH_X * 0.866; // hex packing row spacing

/**
 * Warm studio environment: dark everywhere except a broad sepia softbox that
 * sits low on the horizon in front of the camera (-Z). Lids reflect it at
 * grazing angles, which yields the bright-far / dark-near falloff of the
 * reference.
 */
const makeEnvTexture = (variant: BarrelVariant) => {
  const w = 1024;
  const h = 512;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  // Warm sepia studio sky: a wide luminous band hugging the horizon, brightest
  // ahead of the camera (-Z) and falling off to near-black overhead.
  // V2 looks down from higher up, so its band extends higher in elevation.
  const bandTop = variant === "v2" ? 75 : 40; // degrees
  for (let y = 0; y < h; y++) {
    const elev = 90 - (y / (h - 1)) * 180; // +90 top, -90 bottom
    let v = 0;
    if (elev > -4) {
      const k = Math.max(0, 1 - Math.max(0, elev) / bandTop);
      v = Math.pow(k, 1.6) * (elev < 0 ? Math.max(0, 1 + elev / 4) : 1);
    }
    for (let x = 0; x < w; x++) {
      // three.js equirect: u = atan2(dir.z, dir.x) / 2pi + 0.5, so -Z is u = 0.25.
      const phi = (x / w - 0.5) * Math.PI * 2;
      // Key direction sits slightly to the left of straight ahead.
      const dx = Math.cos(phi);
      const dz = Math.sin(phi);
      const facing = Math.max(0, dx * -0.74 + dz * -0.67);
      const front = 0.35 + 0.65 * Math.pow(facing, 1.4);
      // Soft-clip so the horizon never blows out into a hotspot.
      const lum = Math.min(0.85, v * front);
      const i = (y * w + x) * 4;
      img.data[i] = Math.min(255, 12 + 243 * lum);
      img.data[i + 1] = Math.min(255, 9 + 221 * lum);
      img.data[i + 2] = Math.min(255, 6 + 174 * Math.pow(lum, 1.15));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

// Two levels of detail: full detail near the camera paths, a light version
// (no bungs or seam, coarser chime) for the distant, defocused drums.
const buildGeometries = (detail: "high" | "low") => {
  const hi = detail === "high";
  // Body shell (open cylinder); only its top lip is ever visible.
  const bodyGeo = new THREE.CylinderGeometry(R, R, 3.2, hi ? 64 : 32, 1, true);
  bodyGeo.translate(0, -1.66, 0);

  // Rolled chime at the top edge and the seam just inside it.
  const chime = new THREE.TorusGeometry(R - 0.025, 0.022, hi ? 10 : 6, hi ? 72 : 36);
  chime.rotateX(Math.PI / 2);
  const rimParts: THREE.BufferGeometry[] = [chime];
  if (hi) {
    const seam = new THREE.TorusGeometry(R - 0.1, 0.014, 4, 64);
    seam.rotateX(Math.PI / 2);
    seam.translate(0, -0.055, 0);
    rimParts.push(seam);
  }
  const rimGeo = mergeGeometries(rimParts)!;

  // Lid: slightly recessed disk.
  const lid = new THREE.CircleGeometry(R - 0.075, hi ? 64 : 32);
  lid.rotateX(-Math.PI / 2);
  lid.translate(0, -0.06, 0);

  // Two bungs (2" and 3/4") with raised collars.
  const bung = (r: number, x: number, z: number, seg: number) => {
    const collar = new THREE.TorusGeometry(r, r * 0.17, hi ? 10 : 4, seg);
    collar.rotateX(Math.PI / 2);
    collar.translate(x, -0.025, z);
    const cap = new THREE.CircleGeometry(r * 0.85, seg);
    cap.rotateX(-Math.PI / 2);
    cap.translate(x, -0.04, z);
    const parts: THREE.BufferGeometry[] = [collar, cap];
    if (hi) {
      const wall = new THREE.CylinderGeometry(r * 1.1, r * 1.2, 0.035, seg, 1, true);
      wall.translate(x, -0.045, z);
      const nub = new THREE.TorusGeometry(r * 0.45, r * 0.12, 6, 16);
      nub.rotateX(Math.PI / 2);
      nub.translate(x, -0.035, z);
      parts.push(wall, nub);
    }
    return parts;
  };
  const a1 = -0.35;
  const a2 = 0.65;
  const seg = hi ? 28 : 12;
  const bungGeo = mergeGeometries([
    ...bung(0.14, Math.cos(a1) * 0.68, Math.sin(a1) * 0.68, seg),
    ...bung(0.1, Math.cos(a2) * 0.72, Math.sin(a2) * 0.72, seg),
  ])!;
  return { bodyGeo, rimGeo, lid, bungGeo };
};

// Drums within this region are seen sharp by one of the camera paths.
const isNear = (x: number, z: number) => Math.abs(x) < 20 && z > -26 && z < 10;

type CamPose = { pos: THREE.Vector3; target: THREE.Vector3; fov: number; focus: number };

const cameraPose = (variant: BarrelVariant, t: number): CamPose => {
  // t in [0,1]
  if (variant === "v1") {
    // Low, steady forward dolly with a gentle sideways drift (as in reference).
    const z = 3.6 - t * 3.9;
    const x = 0.1 + t * 0.85;
    const y = 0.9;
    const pos = new THREE.Vector3(x, y, z);
    const target = new THREE.Vector3(x - 0.1, -0.6, z - 8.4);
    return { pos, target, fov: 15.5, focus: 5.2 };
  }
  // V2: high-angle orbiting crane — rises and arcs around a pivot while
  // looking down onto the lids.
  const e = easeInOutSine(t);
  const pivot = new THREE.Vector3(0.5, 0, -6);
  const ang = THREE.MathUtils.degToRad(-28 + 56 * e);
  const radius = 8.2 - 1.2 * e;
  const height = 4.2 + 3.6 * e;
  const pos = new THREE.Vector3(
    pivot.x + Math.sin(ang) * radius,
    height,
    pivot.z + Math.cos(ang) * radius,
  );
  return { pos, target: pivot.clone(), fov: 36, focus: pos.distanceTo(pivot) };
};

export const createBarrelSetup =
  (variant: BarrelVariant, durationInFrames: number): StageSetup =>
  (renderer, width, height) => {
    const scene = new THREE.Scene();
    const bg = new THREE.Color("#120d07");
    scene.background = bg;
    scene.fog = new THREE.FogExp2(bg.getHex(), 0.03);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = makeEnvTexture(variant);
    const env = pmrem.fromEquirectangular(envTex).texture;
    scene.environment = env;
    envTex.dispose();

    // A weak warm key from far ahead to lift the rims a touch.
    const key = new THREE.DirectionalLight("#ffe2b0", 0.6);
    key.position.set(0, 3, -20);
    scene.add(key);

    const geoHi = buildGeometries("high");
    const geoLo = buildGeometries("low");
    const lidMat = new THREE.MeshStandardMaterial({
      color: "#b49c76",
      metalness: 1,
      roughness: 0.42,
      envMapIntensity: 1.3,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: "#c4a87e",
      metalness: 1,
      roughness: 0.2,
      envMapIntensity: 1.5,
    });
    const bodyMat = new THREE.MeshStandardMaterial({
      color: "#0d0906",
      metalness: 0.6,
      roughness: 0.55,
      envMapIntensity: 0.35,
    });
    const bungMat = new THREE.MeshStandardMaterial({
      color: "#d6c4a0",
      metalness: 1,
      roughness: 0.12,
      envMapIntensity: 2.0,
    });

    // Hex-packed field large enough for both camera paths.
    const rand = mulberry32(1460517248);
    const positions: { x: number; z: number; rot: number; dy: number }[] = [];
    for (let row = -6; row < 44; row++) {
      const z = 6 - row * PITCH_Z;
      const off = (row & 1) * PITCH_X * 0.5;
      for (let col = -14; col <= 15; col++) {
        positions.push({
          x: col * PITCH_X + off,
          z,
          rot: rand() * Math.PI * 2,
          dy: (rand() - 0.5) * 0.03,
        });
      }
    }
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    const meshes: THREE.InstancedMesh[] = [];
    const addSet = (geos: ReturnType<typeof buildGeometries>, list: typeof positions) => {
      const set = [
        new THREE.InstancedMesh(geos.bodyGeo, bodyMat, list.length),
        new THREE.InstancedMesh(geos.rimGeo, rimMat, list.length),
        new THREE.InstancedMesh(geos.lid, lidMat, list.length),
        new THREE.InstancedMesh(geos.bungGeo, bungMat, list.length),
      ];
      list.forEach((p, i) => {
        q.setFromAxisAngle(up, p.rot);
        m4.compose(new THREE.Vector3(p.x, p.dy, p.z), q, one);
        set.forEach((m) => m.setMatrixAt(i, m4));
      });
      set.forEach((m) => {
        m.instanceMatrix.needsUpdate = true;
        m.computeBoundingSphere();
        scene.add(m);
        meshes.push(m);
      });
    };
    addSet(geoHi, positions.filter((p) => isNear(p.x, p.z)));
    addSet(geoLo, positions.filter((p) => !isNear(p.x, p.z)));

    // Black fill just below the lids so the gaps between drums stay dark and
  // sit at a depth close to the lids (keeps the DOF gather from leaking).
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshBasicMaterial({ color: "#000000" }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.45;
    scene.add(floor);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 200);
    const post = createPost(renderer, scene, camera, width, height, {
      focus: 6,
      cocScale: variant === "v1" ? 300 : 420,
      nearScale: 0.45,
      maxCoc: 40,
      taps: 128,
      fireflyClamp: 3,
      fillScale: 0.3,
      exposure: 2.8,
      vignette: 0.3,
      lift: [0.0, 0.0, 0.0],
      gain: [1.03, 1.0, 0.9],
      saturation: 0.62,
    });

    return {
      render: (frame) => {
        const t = frame / (durationInFrames - 1);
        const pose = cameraPose(variant, t);
        camera.fov = pose.fov;
        camera.position.copy(pose.pos);
        camera.lookAt(pose.target);
        camera.updateProjectionMatrix();
        post.setFocus(pose.focus);
        post.render();
      },
      dispose: () => {
        post.dispose();
        pmrem.dispose();
        env.dispose();
        meshes.forEach((m) => m.dispose());
        [geoHi, geoLo].forEach((g) =>
          [g.bodyGeo, g.rimGeo, g.lid, g.bungGeo].forEach((x) => x.dispose()),
        );
        [lidMat, rimMat, bodyMat, bungMat].forEach((m) => m.dispose());
      },
    };
  };
