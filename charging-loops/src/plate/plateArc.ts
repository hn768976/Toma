import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { makeStripEnv } from "../blade/bladeRing";
import { DEG, TAU } from "../common/random";
import { LookFactory } from "../three/ThreeLook";
import { PlateArcRow } from "../versions";

// Look 2: 48 rounded-square plates stacked round a circle (like torus
// slices), twisted so the stack fans. Only the upper arc is in frame.
// The ring turns 3 plate pitches (22.5 deg) per 600 frames.

const RING_R = 2.4;
const CORNER = 0.22;

// Framing parameters (camera at origin looking down -Z).
export const PLATE_FRAMING = {
  fov: 42,
  cx: 0.9, // ring centre; the camera sits at the origin looking down -Z
  cy: -1.48,
  cz: -5.5,
  yaw: 35, // left side of the ring swings toward the camera
  pitch: 0,
  roll: 0,
  twist: -35, // about each plate's radial axis: the stack fans
  spin: 45, // about each plate's own normal: square reads as a diamond
  count: 30, // the reference shows ~14 plates over half a turn (12 deg pitch)
  size: 1.7,
  thick: 0.22,
  bevel: 0.08,
  key: 6,
  kx: -2,
  ky: 6,
  kz: 1,
  face: 14, // broad upper-left strip: satin faces
  edge: 16, // thin far strip: edge highlights
  exposure: 1.0,
  focus: 4.4,
};

const roundedSquare = (s: number, r: number) => {
  const h = s / 2;
  const sh = new THREE.Shape();
  sh.moveTo(-h + r, -h);
  sh.lineTo(h - r, -h);
  sh.quadraticCurveTo(h, -h, h, -h + r);
  sh.lineTo(h, h - r);
  sh.quadraticCurveTo(h, h, h - r, h);
  sh.lineTo(-h + r, h);
  sh.quadraticCurveTo(-h, h, -h, h - r);
  sh.lineTo(-h, -h + r);
  sh.quadraticCurveTo(-h, -h, -h + r, -h);
  return sh;
};

export const makePlateArc =
  (row: PlateArcRow, tune: Partial<typeof PLATE_FRAMING> = {}): LookFactory =>
  (gl, aspect) => {
    RectAreaLightUniformsLib.init();
    const F = { ...PLATE_FRAMING, ...tune };
    const center: [number, number, number] = [F.cx, F.cy, F.cz];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0, 0, 0);
    const strip = new THREE.Color(row.strip);

    const envRT = makeStripEnv(gl, [
      // broad soft strip upper left: lights the near plate faces (satin)
      { color: strip, intensity: F.face, pos: [-5, 5, 1], size: [3, 14], lookAt: center },
      // thin strip far right: thin bright highlight on each rounded edge
      { color: strip, intensity: F.edge, pos: [6, 1, -4], size: [0.5, 14], lookAt: center },
      { color: strip, intensity: 2, pos: [0, -6, 1], size: [14, 2], lookAt: center },
    ]);
    scene.environment = envRT.texture;

    const geo = new THREE.ExtrudeGeometry(roundedSquare(F.size - 2 * F.bevel, CORNER * F.size - F.bevel), {
      depth: Math.max(0.005, F.thick - 2 * F.bevel),
      bevelEnabled: true,
      bevelThickness: F.bevel,
      bevelSize: F.bevel,
      bevelSegments: 10,
      curveSegments: 12,
    });
    geo.center();
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(row.base),
      metalness: 0.75,
      roughness: 0.3,
      clearcoat: 0.3,
      clearcoatRoughness: 0.25,
    });
    const PLATES = F.count;
    const plates = new THREE.InstancedMesh(geo, mat, PLATES);
    plates.frustumCulled = false;

    const ring = new THREE.Group();
    ring.position.set(...center);
    ring.rotation.set(F.pitch * DEG, F.yaw * DEG, F.roll * DEG, "YXZ");
    ring.add(plates);
    scene.add(ring);

    const key = new THREE.DirectionalLight(new THREE.Color(row.key), F.key);
    key.position.set(F.kx, F.ky, F.kz);
    scene.add(key);
    const rim = new THREE.RectAreaLight(new THREE.Color(row.rim), 18, 6, 1.2);
    rim.position.set(2, 3, -7);
    rim.lookAt(...center);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(F.fov, aspect, 0.1, 50);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld();

    // local plate: XY face, thickness Z. Twist about radial (X), spin about
    // the normal (Z), then map X -> radial, Y -> ring axis, Z -> tangent.
    const localRot = new THREE.Matrix4()
      .makeRotationX(F.twist * DEG)
      .multiply(new THREE.Matrix4().makeRotationZ(F.spin * DEG));
    const basis = new THREE.Matrix4();
    const m = new THREE.Matrix4();
    const rr = new THREE.Vector3();
    const ax = new THREE.Vector3(0, 0, 1);
    const tg = new THREE.Vector3();

    return {
      scene,
      camera,
      update: (frame) => {
        // Turn exactly 3 plate pitches per 600 frames. Integer maths, so
        // frame 600 is bit-identical to frame 0 with the plates relabelled.
        const period = 600 * PLATES;
        for (let i = 0; i < PLATES; i++) {
          const a = (TAU * ((i * 600 + 3 * frame) % period)) / period;
          rr.set(Math.cos(a), Math.sin(a), 0);
          tg.set(Math.sin(a), -Math.cos(a), 0); // right-handed basis
          basis.makeBasis(rr, ax, tg);
          basis.setPosition(rr.x * RING_R, rr.y * RING_R, 0);
          m.multiplyMatrices(basis, localRot);
          plates.setMatrixAt(i, m);
        }
        plates.instanceMatrix.needsUpdate = true;
        ring.updateMatrixWorld(true);
        return {
          focusDist: F.focus,
          focusDead: 0.4,
          focusRange: 2.5,
          maxBlur: 0.007,
          exposure: F.exposure,
          vignette: 0.2,
          grain: 0.015,
          blackCut: 1,
        };
      },
      dispose: () => {
        envRT.dispose();
        geo.dispose();
        mat.dispose();
      },
    };
  };
