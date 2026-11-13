import * as THREE from "three";
import { clamp, makeRng, sampleSeries, smoothstep, wrap } from "../engine/math";
import { PostPipeline, defaultPostParams } from "../engine/post";
import type { StageArgs, StageController } from "../engine/ThreeStage";
import type { BloodPalette } from "./palettes";
import { PathFrame, VesselPath } from "./path";
import { TUNNEL_END_TRACK } from "./refTrack";
import {
  CELL_FRAG,
  CELL_VERT,
  FULLSCREEN_VERT,
  TISSUE_BAKE_FRAG,
  WALL_FRAG,
  WALL_VERT,
} from "./shaders";

// ---------------------------------------------------------------------------
// Scene constants (world unit = vessel radius)
// ---------------------------------------------------------------------------
const VESSEL_RADIUS = 1;
const CAMERA_START = 3;
const CAMERA_SPEED = 3.9; // radii per second
const VIEW_AHEAD = 46; // how much vessel exists in front of the camera
const LOOK_AHEAD = 19; // distance of the glowing "end" that the camera frames
const FOV = 37;
const TISSUE_V_LENGTH = 6.5; // world length of one tissue-map period along the vessel
const CELL_COUNT = 112;
const CELL_RANGE_NEAR = -2;
const CELL_RANGE_FAR = 43;
const CELL_RADIUS = 0.205;

const TRACK_X = TUNNEL_END_TRACK.map((p) => p[0]);
const TRACK_Y = TUNNEL_END_TRACK.map((p) => p[1]);

/** Gentle, never-repeating bends of the vessel. */
const curvature = (s: number): [number, number] => {
  const kn =
    0.0085 * Math.sin(s * 0.13 + 0.6) +
    0.005 * Math.sin(s * 0.29 + 2.1) +
    0.002 * Math.sin(s * 0.6 + 4.0);
  const kb =
    0.0075 * Math.sin(s * 0.16 + 3.9) +
    0.0045 * Math.sin(s * 0.25 + 1.2) +
    0.002 * Math.sin(s * 0.7 + 0.4);
  return [kn, kb];
};

/** Biconcave disc (Evans & Fung profile), radius 1, revolved around Y. */
const makeCellGeometry = (): THREE.BufferGeometry => {
  const pts: THREE.Vector2[] = [];
  const N = 30;
  const halfThickness = (r: number) => {
    const r2 = r * r;
    return (
      0.5 *
      Math.sqrt(Math.max(1 - r2, 0)) *
      (0.4 + 1.5 * r2 - 0.85 * r2 * r2) *
      0.86
    );
  };
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI;
    const r = Math.sin(a);
    const z = halfThickness(r) * (i <= N / 2 ? 1 : -1);
    pts.push(new THREE.Vector2(Math.max(r, 1e-4), i === N / 2 ? 0 : z));
  }
  const geo = new THREE.LatheGeometry(pts, 36);
  geo.computeVertexNormals();
  return geo;
};

type Cell = {
  s0: number;
  speed: number;
  rho: number;
  phi: number;
  phiRate: number;
  wobble: number;
  wobblePhase: number;
  scale: number;
  thick: number;
  axis: THREE.Vector3;
  rot0: THREE.Quaternion;
  rate: number;
};

export const createBloodScene =
  (palette: BloodPalette) =>
  (args: StageArgs): StageController => {
    const { renderer, bufferWidth, bufferHeight, fps, durationInFrames } = args;
    const duration = durationInFrames / fps;

    const post = new PostPipeline(renderer, bufferWidth, bufferHeight);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      FOV,
      bufferWidth / bufferHeight,
      0.03,
      80,
    );

    // -- Vessel path -------------------------------------------------------
    const pathLength = CAMERA_START + CAMERA_SPEED * duration + VIEW_AHEAD + 2;
    const path = new VesselPath(curvature, pathLength);

    // -- Bake the tissue map -----------------------------------------------
    const TISSUE_SIZE = 1024;
    const tissueRT = new THREE.WebGLRenderTarget(TISSUE_SIZE, TISSUE_SIZE, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true,
      depthBuffer: false,
      colorSpace: THREE.LinearSRGBColorSpace,
    });
    {
      const bakeMat = new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: TISSUE_BAKE_FRAG,
        depthTest: false,
        depthWrite: false,
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bakeMat);
      quad.frustumCulled = false;
      const bakeScene = new THREE.Scene();
      bakeScene.add(quad);
      renderer.setRenderTarget(tissueRT);
      renderer.render(bakeScene, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
      renderer.setRenderTarget(null);
      bakeMat.dispose();
      quad.geometry.dispose();
    }

    // -- Vessel wall geometry ----------------------------------------------
    const RADIAL = 96;
    const RING_STEP = 0.11;
    const rings = Math.ceil(pathLength / RING_STEP);
    const vcount = (RADIAL + 1) * (rings + 1);
    const pos = new Float32Array(vcount * 3);
    const nor = new Float32Array(vcount * 3);
    const tanU = new Float32Array(vcount * 3);
    const tanV = new Float32Array(vcount * 3);
    const uvs = new Float32Array(vcount * 2);
    const frame: PathFrame = path.sample(0);
    const radial = new THREE.Vector3();
    const circ = new THREE.Vector3();
    for (let j = 0; j <= rings; j++) {
      const s = j * RING_STEP;
      path.sample(s, frame);
      for (let i = 0; i <= RADIAL; i++) {
        const th = (i / RADIAL) * Math.PI * 2;
        const cs = Math.cos(th);
        const sn = Math.sin(th);
        radial.set(0, 0, 0).addScaledVector(frame.n, cs).addScaledVector(frame.b, sn);
        circ.set(0, 0, 0).addScaledVector(frame.n, -sn).addScaledVector(frame.b, cs);
        // Low-frequency bulges so the lumen is not a perfect cylinder.
        const bulge =
          0.07 * Math.sin(th * 2 + s * 0.55) +
          0.05 * Math.sin(th * 3 - s * 0.9 + 1.3) +
          0.04 * Math.sin(th * 5 + s * 1.7 + 0.5) +
          0.05 * Math.sin(s * 1.15 + 2.0);
        const r = VESSEL_RADIUS * (1 + bulge);
        const k = (j * (RADIAL + 1) + i) * 3;
        pos[k] = frame.p.x + radial.x * r;
        pos[k + 1] = frame.p.y + radial.y * r;
        pos[k + 2] = frame.p.z + radial.z * r;
        nor[k] = -radial.x;
        nor[k + 1] = -radial.y;
        nor[k + 2] = -radial.z;
        tanU[k] = circ.x;
        tanU[k + 1] = circ.y;
        tanU[k + 2] = circ.z;
        tanV[k] = frame.t.x;
        tanV[k + 1] = frame.t.y;
        tanV[k + 2] = frame.t.z;
        const k2 = (j * (RADIAL + 1) + i) * 2;
        uvs[k2] = i / RADIAL;
        uvs[k2 + 1] = s / TISSUE_V_LENGTH;
      }
    }
    const idx = new Uint32Array(RADIAL * rings * 6);
    let q = 0;
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < RADIAL; i++) {
        const a = j * (RADIAL + 1) + i;
        const b = a + 1;
        const c = a + RADIAL + 1;
        const d = c + 1;
        idx[q++] = a;
        idx[q++] = b;
        idx[q++] = c;
        idx[q++] = b;
        idx[q++] = d;
        idx[q++] = c;
      }
    }
    const wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    wallGeo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    wallGeo.setAttribute("aTanU", new THREE.BufferAttribute(tanU, 3));
    wallGeo.setAttribute("aTanV", new THREE.BufferAttribute(tanV, 3));
    wallGeo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    wallGeo.setIndex(new THREE.BufferAttribute(idx, 1));

    const GLOW0 = 3.9;
    const GLOW1 = 11.5;
    const lightPos = new THREE.Vector3();
    const wallMat = new THREE.ShaderMaterial({
      vertexShader: WALL_VERT,
      fragmentShader: WALL_FRAG,
      side: THREE.DoubleSide,
      uniforms: {
        tTissue: { value: tissueRT.texture },
        uTexel: { value: new THREE.Vector2(1 / TISSUE_SIZE, 1 / TISSUE_SIZE) },
        uWorldPerUv: {
          value: new THREE.Vector2(Math.PI * 2 * VESSEL_RADIUS, TISSUE_V_LENGTH),
        },
        uBump: { value: 0.3 },
        uLightPos: { value: lightPos },
        uColLow: { value: palette.wallLow },
        uColHigh: { value: palette.wallHigh },
        uSpecCol: { value: palette.wallSpec },
        uKeyCol: { value: palette.keyLight },
        uHeadCol: { value: palette.headLight },
        uAmbient: { value: palette.ambient },
        uGlowCol: { value: palette.glow },
        uGlow0: { value: GLOW0 },
        uGlow1: { value: GLOW1 },
      },
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.frustumCulled = false;
    scene.add(wall);

    // -- Red blood cells ---------------------------------------------------
    const rng = makeRng(20240611);
    const cellGeo = makeCellGeometry();
    const shade = new Float32Array(CELL_COUNT);
    const cells: Cell[] = [];
    for (let i = 0; i < CELL_COUNT; i++) {
      const axis = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
      const rot0 = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
        rng() * Math.PI * 2,
      );
      cells.push({
        s0: rng() * (CELL_RANGE_FAR - CELL_RANGE_NEAR),
        speed: -(0.4 + rng() * 1.3),
        rho: 0.62 * Math.pow(rng(), 0.6),
        phi: rng() * Math.PI * 2,
        phiRate: (rng() - 0.5) * 0.22,
        wobble: 0.03 + rng() * 0.07,
        wobblePhase: rng() * Math.PI * 2,
        scale: CELL_RADIUS * (0.86 + rng() * 0.3),
        thick: 0.92 + rng() * 0.3,
        axis,
        rot0,
        rate: (0.35 + rng() * 1.05) * (rng() < 0.5 ? -1 : 1),
      });
      shade[i] = rng();
    }
    cellGeo.setAttribute("aShade", new THREE.InstancedBufferAttribute(shade, 1));
    const cellMat = new THREE.ShaderMaterial({
      vertexShader: CELL_VERT,
      fragmentShader: CELL_FRAG,
      uniforms: {
        tTissue: { value: tissueRT.texture },
        uLightPos: { value: lightPos },
        uCellCol: { value: palette.cell },
        uCellFar: { value: palette.cellFar },
        uKeyCol: { value: palette.keyLight },
        uGlow0: { value: GLOW0 },
        uGlow1: { value: GLOW1 },
      },
    });
    const cellMesh = new THREE.InstancedMesh(cellGeo, cellMat, CELL_COUNT);
    cellMesh.frustumCulled = false;
    scene.add(cellMesh);

    // -- Per-frame state ---------------------------------------------------
    const camFrame = path.sample(0);
    const farFrame = path.sample(0);
    const tmpFrame = path.sample(0);
    const m4 = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const spin = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const p3 = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const dCam = new THREE.Vector3();
    const qLook = new THREE.Quaternion();
    const qRel = new THREE.Quaternion();
    const lookM = new THREE.Matrix4();
    const FORWARD = new THREE.Vector3(0, 0, -1);
    const tanV2 = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const tanH2 = tanV2 * (bufferWidth / bufferHeight);
    const params = defaultPostParams();

    const render = (frameIndex: number) => {
      const t = frameIndex / fps;
      const camS = CAMERA_START + CAMERA_SPEED * t;

      // Camera rides the centre line with a slow organic sway.
      path.sample(camS, camFrame);
      const swayX = 0.1 * Math.sin(t * 0.83 + 0.4) + 0.05 * Math.sin(t * 1.9 + 2.0);
      const swayY = 0.09 * Math.sin(t * 0.67 + 1.9) + 0.04 * Math.sin(t * 2.3 + 0.3);
      camera.position
        .copy(camFrame.p)
        .addScaledVector(camFrame.n, swayX)
        .addScaledVector(camFrame.b, swayY);

      // Aim so the glowing far end of the vessel sits where it sits in the
      // reference at this moment.
      path.sample(camS + LOOK_AHEAD, farFrame);
      dir.copy(farFrame.p).sub(camera.position).normalize();
      lookM.lookAt(camera.position, farFrame.p, camFrame.b);
      qLook.setFromRotationMatrix(lookM);
      const trackIndex = (t * 30 * (TRACK_X.length - 1)) / (duration * 30 - 1);
      const sx = clamp(sampleSeries(TRACK_X, trackIndex), 0.12, 0.88);
      const sy = clamp(sampleSeries(TRACK_Y, trackIndex), 0.12, 0.88);
      dCam.set((2 * sx - 1) * tanH2, (1 - 2 * sy) * tanV2, -1).normalize();
      qRel.setFromUnitVectors(FORWARD, dCam);
      camera.quaternion.copy(qLook).multiply(qRel.invert());
      // A touch of roll.
      spin.setFromAxisAngle(FORWARD, 0.05 * Math.sin(t * 0.5 + 1.0));
      camera.quaternion.multiply(spin);
      camera.updateMatrixWorld(true);

      // Key light further down the vessel.
      path.sample(camS + 9.5, tmpFrame);
      lightPos.copy(tmpFrame.p);

      // Cells.
      for (let i = 0; i < CELL_COUNT; i++) {
        const c = cells[i];
        const rel = wrap(
          c.s0 + (c.speed - CAMERA_SPEED) * t,
          CELL_RANGE_NEAR,
          CELL_RANGE_FAR,
        );
        // Unwrapped distance travelled, used so spin stays continuous.
        const s = camS + rel;
        path.sample(s, tmpFrame);
        const phi = c.phi + c.phiRate * t;
        let rho =
          c.rho + c.wobble * Math.sin(t * 0.9 + c.wobblePhase);
        // Keep a clear corridor around the lens so nothing clips the near plane.
        const corridor = 0.5 * smoothstep(6.0, 1.5, rel);
        rho = Math.max(rho, corridor);
        rho = Math.min(rho, 0.64);
        p3.copy(tmpFrame.p)
          .addScaledVector(tmpFrame.n, Math.cos(phi) * rho)
          .addScaledVector(tmpFrame.b, Math.sin(phi) * rho);
        spin.setFromAxisAngle(c.axis, c.rate * t);
        quat.copy(spin).multiply(c.rot0);
        const fade =
          smoothstep(CELL_RANGE_FAR, CELL_RANGE_FAR - 6, rel) *
          smoothstep(CELL_RANGE_NEAR, CELL_RANGE_NEAR + 0.4, rel);
        const k = c.scale * fade;
        scl.set(k, k * c.thick, k);
        m4.compose(p3, quat, scl);
        cellMesh.setMatrixAt(i, m4);
      }
      cellMesh.instanceMatrix.needsUpdate = true;

      // Look
      params.frame = frameIndex;
      params.focus = 9;
      params.aperture = 0.0075;
      params.maxCoc = 0.022;
      params.bloomStrength = 0.22;
      params.bloomThreshold = 0.75;
      params.exposure = 1.0;
      params.tint.copy(palette.tint);
      params.lift.copy(palette.lift);
      params.contrast = 1.06;
      params.saturation = palette.saturation;
      params.vignette = 0.9;
      params.vignetteColor.copy(palette.vignetteColor);
      params.grain = 0.022;
      post.render(scene, camera, params);
    };

    return {
      render,
      dispose: () => {
        post.dispose();
        wallGeo.dispose();
        wallMat.dispose();
        cellGeo.dispose();
        cellMat.dispose();
        cellMesh.dispose();
        tissueRT.dispose();
      },
    };
  };
