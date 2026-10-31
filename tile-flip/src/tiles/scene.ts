import * as THREE from "three";
import type { StageFactory } from "../lib/ThreeStage";
import { clamp, lerp, smoothstep } from "../lib/math";
import { GRID, allEvents, type FlipEvent, type Hinge } from "./choreography";

export type CameraMode = "front" | "orbit";

export type TileLook = {
  wall: [number, number, number];
  cavity: [number, number, number];
  ambient: [number, number, number];
  sky: [number, number, number];
  sun: [number, number, number];
};

// Warm paper-grey wall, navy cavities, cool shadows (sampled from reference).
export const LOOK: TileLook = {
  wall: [0.735, 0.72, 0.69],
  cavity: [0.15, 0.19, 0.31],
  ambient: [0.42, 0.435, 0.49],
  sky: [0.07, 0.07, 0.08],
  sun: [0.43, 0.4, 0.355],
};

const TILE = 1;
const DEPTH = 0.55; // cavity depth
const THICK = 0.035; // flap thickness
const MAX_GAP = 0.005; // seam half-width revealed while a tile is "live"

const cellCenter = (row: number, col: number) =>
  new THREE.Vector2((col - (GRID - 1) / 2) * TILE, ((GRID - 1) / 2 - row) * TILE);

/** Flap opening angle (degrees) for an event at time t. */
const flapAngle = (ev: FlipEvent, t: number) => {
  const u = (t - ev.start) / ev.dur;
  if (u <= 0) return 0;
  if (u < 1) {
    // Quick lift, a short hang, then a slightly faster fall.
    const shaped = u < 0.45 ? smoothstep(0, 0.45, u) : 1 - Math.pow(smoothstep(0.45, 1, u), 1.6);
    return ev.peak * shaped;
  }
  // Small damped settle after the flap slaps shut.
  const a = t - (ev.start + ev.dur);
  if (a > 0.45) return 0;
  return 7 * Math.exp(-a * 9) * Math.abs(Math.sin(a * 22));
};

/** 0..1 visibility of the seam around a tile (fades in before, out after). */
const seamAmount = (ev: FlipEvent, t: number) =>
  smoothstep(ev.start - 0.42, ev.start - 0.02, t) *
  (1 - smoothstep(ev.start + ev.dur + 0.1, ev.start + ev.dur + 0.75, t));

export const createTileStage =
  (mode: CameraMode, durationSec: number, look: TileLook = LOOK): StageFactory =>
  ({ renderer, width, height }) => {
    const aspect = width / height;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(...look.wall);

    // --- camera ------------------------------------------------------------
    const camera = new THREE.PerspectiveCamera(20, aspect, 0.5, 200);
    const frontDist = GRID * TILE / 0.8705 / (2 * Math.tan(THREE.MathUtils.degToRad(10)));

    // --- lights --------------------------------------------------------------
    // three.js' Lambert BRDF divides by PI, so intensities are scaled by PI to
    // keep the light colours above in plain 0..1 'paint' units.
    scene.add(new THREE.AmbientLight(new THREE.Color(...look.ambient), Math.PI));
    const hemi = new THREE.HemisphereLight(
      new THREE.Color(...look.sky),
      new THREE.Color(0, 0, 0),
      Math.PI,
    );
    hemi.position.set(0, 0, 1);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(new THREE.Color(...look.sun), Math.PI);
    sun.position.set(-3.2, 4.2, 6.5);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.left = -4.5;
    sun.shadow.camera.right = 4.5;
    sun.shadow.camera.top = 4.5;
    sun.shadow.camera.bottom = -4.5;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 20;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.01;
    sun.shadow.radius = 9;
    sun.shadow.blurSamples = 16;
    scene.add(sun, sun.target);
    // Soft warm hot-spot towards the upper-left, like the reference.
    const spot = new THREE.PointLight(new THREE.Color(0.1, 0.09, 0.08), Math.PI, 0, 0);
    spot.position.set(-6, 5, 4);
    scene.add(spot);
    // Soft bounce light from below-front: keeps lifted flaps light grey like
    // the reference instead of falling into deep shade.
    const fill = new THREE.DirectionalLight(new THREE.Color(0.17, 0.17, 0.18), Math.PI);
    fill.position.set(0.3, -3.5, 2.2);
    fill.target.position.set(0, 0, 0);
    scene.add(fill, fill.target);

    // --- materials -------------------------------------------------------------
    const wallMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(...look.wall),
      dithering: true, // avoids 8-bit banding in the soft light gradient
    });
    const cavityMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(...look.cavity),
      side: THREE.DoubleSide,
      dithering: true,
    });
    const flapMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(...look.wall),
      dithering: true,
    });

    // --- wall with a 4x4 opening -------------------------------------------------
    const half = (GRID * TILE) / 2;
    const BIG = 60;
    const addWall = (cx: number, cy: number, w: number, h: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
      m.position.set(cx, cy, 0);
      m.receiveShadow = true;
      scene.add(m);
    };
    addWall(-half - BIG / 2, 0, BIG, BIG * 2);
    addWall(half + BIG / 2, 0, BIG, BIG * 2);
    addWall(0, half + BIG / 2, GRID * TILE, BIG);
    addWall(0, -half - BIG / 2, GRID * TILE, BIG);

    // --- cells: cavity + hinged flap -------------------------------------------------
    type Cell = {
      row: number;
      col: number;
      pivot: THREE.Group;
      flap: THREE.Mesh;
      cover: THREE.Mesh;
      events: FlipEvent[];
    };
    const events = allEvents(durationSec);
    const cavityWall = new THREE.PlaneGeometry(TILE, DEPTH);
    const cavityFloor = new THREE.PlaneGeometry(TILE, TILE);
    const flapGeo = new THREE.BoxGeometry(TILE, TILE, THICK);
    const cells: Cell[] = [];
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const c = cellCenter(row, col);
        const box = new THREE.Group();
        box.position.set(c.x, c.y, 0);
        const floor = new THREE.Mesh(cavityFloor, cavityMat);
        floor.position.z = -DEPTH;
        floor.receiveShadow = true;
        box.add(floor);
        for (let k = 0; k < 4; k++) {
          const w = new THREE.Mesh(cavityWall, cavityMat);
          const ang = (k * Math.PI) / 2;
          w.position.set(Math.cos(ang) * TILE * 0.5, Math.sin(ang) * TILE * 0.5, -DEPTH / 2);
          w.rotation.set(Math.PI / 2, 0, ang - Math.PI / 2, "ZXY");
          w.receiveShadow = true;
          w.castShadow = true;
          box.add(w);
        }
        scene.add(box);

        // Wall-coloured cover just under an idle flap: hides sub-pixel
        // cracks between neighbouring flaps so idle cells are seamless.
        const cover = new THREE.Mesh(cavityFloor, wallMat);
        cover.position.set(c.x, c.y, -THICK - 0.004);
        scene.add(cover);

        const pivot = new THREE.Group();
        const flap = new THREE.Mesh(flapGeo, flapMat);
        flap.castShadow = true;
        flap.receiveShadow = true;
        pivot.add(flap);
        scene.add(pivot);
        cells.push({
          row,
          col,
          pivot,
          flap,
          cover,
          events: events
            .filter((ev) => ev.row === row && ev.col === col)
            .sort((a, b) => a.start - b.start),
        });
      }
    }

    const placeFlap = (cell: Cell, hinge: Hinge, angleDeg: number, gap: number) => {
      const c = cellCenter(cell.row, cell.col);
      const a = THREE.MathUtils.degToRad(angleDeg);
      // A 'live' tile shrinks very slightly to reveal its seam.
      const s = TILE - gap * 2;
      cell.flap.scale.set(s / TILE, s / TILE, 1);
      const hs = s / 2;
      cell.pivot.rotation.set(0, 0, 0);
      switch (hinge) {
        case "B":
          cell.pivot.position.set(c.x, c.y - hs, 0);
          cell.flap.position.set(0, hs, -THICK / 2);
          cell.pivot.rotation.x = a;
          break;
        case "T":
          cell.pivot.position.set(c.x, c.y + hs, 0);
          cell.flap.position.set(0, -hs, -THICK / 2);
          cell.pivot.rotation.x = -a;
          break;
        case "L":
          cell.pivot.position.set(c.x - hs, c.y, 0);
          cell.flap.position.set(hs, 0, -THICK / 2);
          cell.pivot.rotation.y = -a;
          break;
        case "R":
          cell.pivot.position.set(c.x + hs, c.y, 0);
          cell.flap.position.set(-hs, 0, -THICK / 2);
          cell.pivot.rotation.y = a;
          break;
      }
    };

    const updateCamera = (t: number) => {
      if (mode === "front") {
        camera.up.set(0, 1, 0);
        camera.position.set(0, 0, frontDist);
        camera.lookAt(0, 0, 0);
        return;
      }
      // Version 2: low three-quarter angle with a slow orbit + push-in that
      // reveals the depth of the cavities and the thickness of the flaps.
      const u = clamp(t / durationSec);
      const ease = u * u * (3 - 2 * u);
      const az = THREE.MathUtils.degToRad(lerp(-38, -14, ease)); // around the wall normal
      const el = THREE.MathUtils.degToRad(lerp(44, 52, ease)); // angle above the wall plane
      const dist = lerp(frontDist * 1.08, frontDist * 0.97, ease);
      const target = new THREE.Vector3(lerp(0.1, -0.05, ease), lerp(-0.25, -0.05, ease), 0);
      camera.up.set(0, 0, 1);
      camera.position.set(
        target.x + Math.sin(az) * Math.cos(el) * dist,
        target.y - Math.cos(az) * Math.cos(el) * dist,
        Math.sin(el) * dist,
      );
      camera.lookAt(target);
      camera.rotateZ(THREE.MathUtils.degToRad(lerp(-2, 1, ease)));
    };

    const render = (t: number) => {
      updateCamera(t);
      for (const cell of cells) {
        let gap = 0;
        let angle = 0;
        let hinge: Hinge = "B";
        let best = Infinity;
        for (const ev of cell.events) {
          gap = Math.max(gap, seamAmount(ev, t));
          const ang = flapAngle(ev, t);
          if (ang > angle) angle = ang;
          // The hinge of the closest event (past or upcoming) drives the pose.
          const d = Math.abs(t - (ev.start + ev.dur * 0.5));
          if (d < best) {
            best = d;
            hinge = ev.hinge;
          }
        }
        placeFlap(cell, hinge, angle, MAX_GAP * gap);
        cell.cover.visible = gap < 0.001 && angle < 0.01;
      }
      renderer.render(scene, camera);
    };

    return {
      render,
      dispose: () => {
        scene.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
        wallMat.dispose();
        cavityMat.dispose();
        flapMat.dispose();
      },
    };
  };
