import * as THREE from "three";
import type { StageFactory } from "../lib/ThreeStage";
import { createDrift, orbitAt, REF_WIDTH_PX } from "./camera";
import type { TogglePalette } from "./palette";
import {
  buildWorld,
  KNOB_R,
  KNOB_T,
  knobPosition,
  pieceTurn,
  knobTravel,
  TRACK_T,
  TRACK_W,
} from "./world";

export type ToggleSceneOptions = {
  palette: TogglePalette;
  camera: "top-down" | "orbit";
  seed: number;
};

const BEVEL = 0.03;

const roundedRectShape = (length: number, width: number, radius: number) => {
  const l = length / 2 - BEVEL;
  const w = width / 2 - BEVEL;
  const r = Math.max(0.01, Math.min(radius - BEVEL, l, w));
  const s = new THREE.Shape();
  s.moveTo(-l + r, -w);
  s.lineTo(l - r, -w);
  s.absarc(l - r, -w + r, r, -Math.PI / 2, 0, false);
  s.lineTo(l, w - r);
  s.absarc(l - r, w - r, r, 0, Math.PI / 2, false);
  s.lineTo(-l + r, w);
  s.absarc(-l + r, w - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-l, -w + r);
  s.absarc(-l + r, -w + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
};

const knobGeometry = () => {
  const b = 0.018;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0), new THREE.Vector2(KNOB_R, 0)];
  pts.push(new THREE.Vector2(KNOB_R, KNOB_T - b));
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(KNOB_R - b + Math.cos(a) * b, KNOB_T - b + Math.sin(a) * b));
  }
  pts.push(new THREE.Vector2(0, KNOB_T));
  const g = new THREE.LatheGeometry(pts, 96);
  g.rotateX(Math.PI / 2); // lathe axis (y) -> world z
  return g;
};

export const createToggleStage =
  (opts: ToggleSceneOptions): StageFactory =>
  (renderer, { width, height, fps, durationInFrames }) => {
    const orbit = opts.camera === "orbit";
    const aspect = width / height;

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.toneMapping = THREE.NoToneMapping;

    const scene = new THREE.Scene();
    const bg = new THREE.Color(opts.palette.background);
    scene.background = bg;
    if (orbit) scene.fog = new THREE.Fog(bg, 16, 34);

    // Visible ground width so a track is ~10.9 % of the frame width (reference).
    const viewWidth = TRACK_W / (84 / REF_WIDTH_PX);
    const worldPerRefPx = viewWidth / REF_WIDTH_PX;

    const fov = orbit ? 34 : 20;
    const camera = new THREE.PerspectiveCamera(fov, aspect, 0.5, 120);
    const topDownHeight = viewWidth / aspect / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));

    const half = orbit ? { x: 26, y: 24 } : { x: 11, y: 9 };
    const pieces = buildWorld({
      palette: opts.palette,
      seed: opts.seed,
      halfX: half.x,
      halfY: half.y,
      totalFrames: durationInFrames,
      fps,
    });

    // --- lights (calibrated so a top face renders at its palette colour) ---
    const ambient = new THREE.AmbientLight(0xffffff, Math.PI * 0.5);
    scene.add(ambient);
    const lightDir = new THREE.Vector3(-0.36, 0.42, 0.833).normalize();
    const sun = new THREE.DirectionalLight(0xffffff, (Math.PI * 0.5) / lightDir.z);
    sun.castShadow = true;
    const shadowHalf = orbit ? 17 : 9.5;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, {
      left: -shadowHalf,
      right: shadowHalf,
      top: shadowHalf,
      bottom: -shadowHalf,
      near: 1,
      far: 60,
    });
    sun.shadow.radius = orbit ? 7 : 8;
    sun.shadow.blurSamples = 20;
    sun.shadow.bias = -0.0004;
    scene.add(sun, sun.target);

    // --- ground ---
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshLambertMaterial({ color: opts.palette.background }),
    );
    ground.position.z = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- pieces ---
    const materials = new Map<string, THREE.MeshLambertMaterial>();
    const mat = (c: string) => {
      let m = materials.get(c);
      if (!m) {
        m = new THREE.MeshLambertMaterial({ color: c });
        materials.set(c, m);
      }
      return m;
    };
    const geoms = new Map<string, THREE.BufferGeometry>();
    const trackGeom = (l: number, w: number, r: number) => {
      const key = `${l.toFixed(3)}|${w.toFixed(3)}|${r.toFixed(3)}`;
      let g = geoms.get(key);
      if (!g) {
        g = new THREE.ExtrudeGeometry(roundedRectShape(l, w, r), {
          depth: TRACK_T - BEVEL * 2,
          bevelEnabled: true,
          bevelSize: BEVEL,
          bevelThickness: BEVEL,
          bevelSegments: 3,
          curveSegments: 28,
        });
        g.translate(0, 0, BEVEL);
        geoms.set(key, g);
      }
      return g;
    };
    const knobGeom = knobGeometry();

    const live = pieces.map((p) => {
      const group = new THREE.Group();
      const track = new THREE.Mesh(trackGeom(p.length, p.width, p.radius), mat(p.color));
      track.castShadow = true;
      track.receiveShadow = true;
      group.add(track);
      let knob: THREE.Mesh | null = null;
      if (p.knob) {
        knob = new THREE.Mesh(knobGeom, mat(p.knob.color));
        knob.castShadow = true;
        knob.receiveShadow = true;
        knob.position.z = TRACK_T;
        group.add(knob);
      }
      group.position.set(p.x, p.y, p.z);
      group.rotation.z = p.angle;
      scene.add(group);
      const travel = knobTravel(p);
      return { p, group, knob, travel };
    });

    const drift = createDrift(durationInFrames);
    const target = new THREE.Vector3();
    const texel = (shadowHalf * 2) / 4096;
    const lightRight = new THREE.Vector3();
    const lightUp = new THREE.Vector3();
    {
      const helper = new THREE.Matrix4().lookAt(lightDir, new THREE.Vector3(), new THREE.Vector3(0, 0, 1));
      lightRight.setFromMatrixColumn(helper, 0);
      lightUp.setFromMatrixColumn(helper, 1);
    }

    return {
      render: (frame: number) => {
        // Content drifts up-right on screen => camera travels down-left.
        const { dx, dy } = drift(frame);
        target.set(-dx * worldPerRefPx, dy * worldPerRefPx, 0);

        if (orbit) {
          const o = orbitAt(frame, durationInFrames);
          camera.position.set(
            target.x + Math.cos(o.azimuth) * Math.sin(o.tilt) * o.distance,
            target.y + Math.sin(o.azimuth) * Math.sin(o.tilt) * o.distance,
            Math.cos(o.tilt) * o.distance,
          );
          camera.up.set(0, 0, 1);
          camera.lookAt(target);
        } else {
          camera.position.set(target.x, target.y, topDownHeight);
          camera.up.set(0, 1, 0);
          camera.lookAt(target.x, target.y, 0);
        }

        // Shadow camera follows the view, snapped to shadow-map texels to
        // avoid shimmering edges.
        const r = Math.round(target.dot(lightRight) / texel) * texel;
        const u = Math.round(target.dot(lightUp) / texel) * texel;
        const snapped = lightRight.clone().multiplyScalar(r).addScaledVector(lightUp, u);
        snapped.addScaledVector(lightDir, target.dot(lightDir));
        if (orbit) {
          // centre shadows a little ahead of the camera (towards the view)
          const fwd = new THREE.Vector3().subVectors(target, camera.position).setZ(0).normalize();
          const ahead = fwd.multiplyScalar(5);
          const rr = Math.round(ahead.dot(lightRight) / texel) * texel;
          const uu = Math.round(ahead.dot(lightUp) / texel) * texel;
          snapped.addScaledVector(lightRight, rr).addScaledVector(lightUp, uu);
        }
        sun.target.position.copy(snapped);
        sun.position.copy(snapped).addScaledVector(lightDir, 25);
        sun.target.updateMatrixWorld();

        for (const l of live) {
          const turn = pieceTurn(l.p, frame);
          l.group.rotation.z = turn.angle;
          l.group.position.set(l.p.x + turn.ox, l.p.y + turn.oy, l.p.z + turn.lift);
          if (l.knob && l.p.knob) {
            l.knob.position.x = knobPosition(l.p.knob, frame) * l.travel;
          }
        }
        renderer.render(scene, camera);
      },
      dispose: () => {
        geoms.forEach((g) => g.dispose());
        knobGeom.dispose();
        materials.forEach((m) => m.dispose());
        renderer.shadowMap.enabled = false;
      },
    };
  };
