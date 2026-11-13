import * as THREE from "three";
import { loadFonts } from "../engine/fonts";
import { PostChain, PostSettings } from "../engine/post";
import { hash, lerp, smoothstep } from "../engine/random";
import type { StageFactory } from "../engine/ThreeStage";
import { createHudMaterial, HudPalette } from "./hudMaterial";
import { DigitReadout, Gauge, GlowBar, makeBarTexture, makeGlintTexture, TextBlock } from "./overlays";

export type HudVariant = "reference" | "craneMove";

export const HUD_FONTS = [
  { family: "Orbitron", file: "orbitron-latin-400-normal.woff2", weight: "400" },
  { family: "Orbitron", file: "orbitron-latin-500-normal.woff2", weight: "500" },
  { family: "Orbitron", file: "orbitron-latin-600-normal.woff2", weight: "600" },
  { family: "Share Tech Mono", file: "share-tech-mono-latin-400-normal.woff2", weight: "400" },
];

export const PALETTE: HudPalette = {
  bg: [0.0, 0.026, 0.07],
  bgFar: [0.0, 0.006, 0.02],
  ink: [0.62, 0.86, 1.02],
  hot: [0.7, 0.86, 1.0],
  accent: [1.0, 0.52, 0.12],
};

type Rig = {
  target: THREE.Vector3;
  distance: number;
  elevation: number; // degrees above the floor
  azimuth: number; // degrees, rotation around the vertical axis
  roll: number; // degrees
  fov: number;
  focus: THREE.Vector3;
  /** When set, the focal plane is tilted so that it contains this floor direction (tilt-shift look). */
  focusAxis?: THREE.Vector3;
  /** 0 = focal plane perpendicular to the lens axis, 1 = fully tilted to contain focusAxis */
  focusTilt?: number;
  nearBlur: number;
  farBlur: number;
  field?: PostSettings["fieldFocus"];
};

/**
 * Locked-off camera matching the reference framing. The values were solved
 * numerically from line slopes / feature positions measured on the reference:
 * a long (~11 deg) lens looking down ~30 deg, with a tilted focal plane that
 * keeps the band of data rows through the hero readout sharp.
 */
const referenceRig = (): Rig => ({
  target: new THREE.Vector3(-2.165, 0, 1.055),
  distance: 37,
  elevation: 30.5,
  azimuth: 46.5,
  roll: -3.5,
  fov: 11.15,
  focus: new THREE.Vector3(0.0, 0, 0.6),
  // focal plane tilted along the data rows; the radial field falloff below
  // keeps the sharp zone on the readout + gauges and softens the far ends
  focusAxis: new THREE.Vector3(1, 0, 0),
  focusTilt: 1,
  field: { center: [0.62, 0.42], radius: 0.36, gain: 40 },
  nearBlur: 88,
  farBlur: 76,
});

/**
 * Alternative version: a slow motion-control "crane + orbit" move instead of
 * the locked-off shot. It starts low and wide across the data plane, then over
 * 20 s rises, pushes in and swings ~38 degrees around the hero readout, while
 * the tilted focal plane travels with the camera so the readout stays sharp.
 */
const craneRig = (t: number, dur: number): Rig => {
  const ref = referenceRig();
  const k = smoothstep(0, 1, t / dur);
  // a touch of hand-held float on top of the programmed move
  const wob = Math.sin(t * 0.7) * 0.15 + Math.sin(t * 1.9 + 1.3) * 0.06;
  return {
    target: new THREE.Vector3(lerp(-4.6, -1.2, k), 0, lerp(2.4, 0.5, k)),
    distance: lerp(47, 31, k),
    elevation: lerp(21, 43, k) + wob,
    azimuth: lerp(22, 60, k),
    roll: lerp(4, -6, k),
    fov: lerp(12.5, 13.5, k),
    focus: new THREE.Vector3(lerp(-3.6, 0.2, k), 0, lerp(0.6, -0.2, k)),
    focusAxis: new THREE.Vector3(1, 0, 0.22).normalize(),
    focusTilt: 1,
    nearBlur: ref.nearBlur,
    farBlur: ref.farBlur,
  };
};

const applyRig = (cam: THREE.PerspectiveCamera, rig: Rig) => {
  const el = THREE.MathUtils.degToRad(rig.elevation);
  const az = THREE.MathUtils.degToRad(rig.azimuth);
  const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  cam.position.copy(rig.target).addScaledVector(dir, rig.distance);
  cam.up.set(0, 1, 0);
  cam.lookAt(rig.target);
  cam.rotateZ(THREE.MathUtils.degToRad(rig.roll));
  cam.fov = rig.fov;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  // view-space depth of the focus point
  const v = rig.focus.clone().applyMatrix4(cam.matrixWorldInverse);
  let focalPlane: PostSettings["focalPlane"];
  if (rig.focusAxis) {
    const camUp = new THREE.Vector3(0, 1, 0).transformDirection(cam.matrixWorld);
    const fwd = new THREE.Vector3(0, 0, -1).transformDirection(cam.matrixWorld);
    const tilted = new THREE.Vector3().crossVectors(rig.focusAxis, camUp).normalize();
    if (tilted.dot(fwd) < 0) tilted.negate();
    focalPlane = {
      point: rig.focus.clone(),
      normal: fwd.lerp(tilted, rig.focusTilt ?? 1).normalize(),
    };
  }
  return { focusZ: -v.z, focalPlane };
};

export const createHudFactory =
  (variant: HudVariant, debug = false): StageFactory =>
  async ({ renderer, pixelWidth, pixelHeight, fps, durationInFrames }) => {
    await loadFonts(HUD_FONTS);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(...PALETTE.bgFar);
    const camera = new THREE.PerspectiveCamera(38, pixelWidth / pixelHeight, 1, 400);

    // fog distances follow the lens: the crane move starts much farther away
    const fogNear = variant === "reference" ? 34 : 32;
    const fogFar = variant === "reference" ? 60 : 92;
    const floorMat = createHudMaterial(PALETTE, fogNear, fogFar, 0.78, [
      [0.9, 1.1, 0.55, 0.55],
      [2.65, 1.05, 0.55, 0.55],
      [-3.3, -0.3, 2.65, 0.2],
    ]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const ink = new THREE.Color(0.75, 0.88, 1.0).multiplyScalar(1.15);
    const dim = new THREE.Color(0.45, 0.6, 0.8);

    const digits = [
      new DigitReadout(11, 6.3, -3.09, -0.3, ink, fps),
      new DigitReadout(29, 2.6, -7.6, 3.1, dim.clone().multiplyScalar(0.8), fps),
      new DigitReadout(47, 2.4, 4.3, -4.6, dim.clone().multiplyScalar(0.8), fps),
    ];
    const gauges = [
      // rotated about the floor normal so the numbers read upright through the lens
      new Gauge(3, 0.95, 0.9, 1.1, ink.clone().multiplyScalar(1.5), fps, "#ff9a3c", 0.62),
      new Gauge(8, 0.95, 2.65, 1.05, ink.clone().multiplyScalar(1.5), fps, "#ff9a3c", 0.62),
      new Gauge(15, 0.55, -5.2, -3.7, dim, fps, "#ff9a3c"),
    ];
    const texts = [
      new TextBlock(5, 1.5, 2.3, -0.55, dim, fps, 5),
      new TextBlock(9, 1.3, -4.2, 1.35, dim, fps, 4),
      new TextBlock(21, 1.5, 4.9, 2.1, dim, fps, 6),
      new TextBlock(33, 1.2, -1.2, 3.6, dim, fps, 5),
    ];
    [...digits, ...gauges, ...texts].forEach((o) => scene.add(o.mesh));

    // orange status lamps + bright streaks in the near foreground (become bokeh)
    const barTex = makeBarTexture();
    const amber = new THREE.Color(1.0, 0.5, 0.12).multiplyScalar(2.2);
    const glowBars: GlowBar[] = [
      [-3.67, -4.77],
      [-2.66, -4.93],
      [-1.72, -5.04],
      [-0.19, -5.24],
      [0.9, -5.4],
    ].map(([x, y], i) => new GlowBar(barTex, amber, 0.95, x, y, 0.12, 50 + i, fps, 0.18));
    for (let i = 0; i < 12; i++) {
      const x = lerp(-13, -6, hash(i, 31));
      const y = lerp(-8.5, -4.5, hash(i, 32));
      const col = new THREE.Color(0.55, 0.75, 1.0).multiplyScalar(lerp(0.5, 1.0, hash(i, 33)));
      glowBars.push(new GlowBar(barTex, col, lerp(0.7, 1.6, hash(i, 34)), x, y, 0.1, 80 + i, fps, 0.12));
    }
    glowBars.forEach((b) => scene.add(b.mesh));

    // distant glints
    const glintTex = makeGlintTexture();
    const glints = Array.from({ length: 7 }, (_, i) => {
      const mat = new THREE.SpriteMaterial({
        map: glintTex,
        color: new THREE.Color(0.8, 0.9, 1.0),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const s = new THREE.Sprite(mat);
      const px = lerp(-12, -3, hash(i, 1));
      const py = lerp(3, 9, hash(i, 2));
      s.position.set(px, 0.15, -py);
      s.renderOrder = 3;
      scene.add(s);
      return { s, mat, t0: hash(i, 3) * (durationInFrames / fps), period: 3 + hash(i, 4) * 4 };
    });

    const post = new PostChain(renderer, pixelWidth, pixelHeight);
    const dur = durationInFrames / fps;

    return {
      render(frame: number) {
        const t = frame / fps;
        floorMat.uniforms.uTime.value = t;
        digits.forEach((d) => d.update(frame));
        gauges.forEach((g) => g.update(frame));
        glowBars.forEach((b) => b.update(frame));
        texts.forEach((tb) => tb.update(frame));
        for (const g of glints) {
          const ph = ((t - g.t0) % g.period + g.period) % g.period;
          const life = 0.9;
          const e = ph < life ? Math.sin((ph / life) * Math.PI) : 0;
          g.mat.opacity = e * 1.4;
          const sc = 0.35 + 0.5 * e;
          g.s.scale.set(sc, sc, 1);
        }
        const rig = variant === "reference" ? referenceRig() : craneRig(t, dur);
        const { focusZ, focalPlane } = applyRig(camera, rig);
        const settings: PostSettings = {
          focusDistance: focusZ,
          focalPlane,
          fieldFocus: rig.field,
          nearBlur: rig.nearBlur,
          farBlur: rig.farBlur,
          maxCoc: 30,
          bloomStrength: 1.0,
          bloomThreshold: 0.32,
          exposure: 1.05,
          vignette: 0.76,
          grain: 0.018,
          saturation: 1.05,
          gain: [0.84, 1.0, 1.02],
          lift: [-0.014, -0.01, -0.004],
          aberration: 1.2,
        };
        if (debug) {
          renderer.setRenderTarget(null);
          renderer.clear();
          renderer.render(scene, camera);
        } else post.render(scene, camera, settings, frame);
      },
      dispose() {
        post.dispose();
        floorMat.dispose();
        scene.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            const m = o.material as THREE.MeshBasicMaterial;
            m.map?.dispose();
            m.dispose();
          }
        });
        glintTex.dispose();
      },
    };
  };
