import * as THREE from "three";
import { BACKGROUNDS, BackgroundSpec, VersionRow } from "../data";
import {
  buildPhoneGroup,
  buildPhoneParts,
  DEFAULT_FRAME_COLOR,
  PHONE,
  phoneCorners,
} from "../phone/buildPhone";
import {
  CameraSpec,
  DROP_IN,
  GRID,
  MODEL_CHECK_MOTION,
  Pose,
  SWAY,
  TUMBLE,
} from "../motions/motions";
import { buildEnvironment } from "./environment";
import { buildPostPass } from "./post";
import {
  contactShadowTexture,
  GRID_SHADOW_PAD,
  roundedRectShadowTexture,
} from "./shadows";

/**
 * Everything for one composition: built once, then `render(frame)` draws a
 * frame purely from the frame number.
 *
 * Passes per frame:
 *  1. beauty  -> HalfFloat MSAA target (phone + floor shadow on transparent black)
 *  2. mask    -> MSAA target, screens white / everything else black
 *  3. post    -> canvas: tone map, background, vignette, dither, grain,
 *                then #00FF00 mixed in through the mask (and on the green
 *                backgrounds, through the inverse phone alpha).
 */
export type World = {
  render: (frame: number) => void;
  dispose: () => void;
};

const MSAA = 4;

const makeCamera = (spec: CameraSpec, aspect: number): THREE.Camera => {
  if (spec.kind === "orthographic") {
    const hh = spec.viewHeight / 2;
    const cam = new THREE.OrthographicCamera(-hh * aspect, hh * aspect, hh, -hh, 0.1, 20);
    cam.position.set(0, 0, 10);
    cam.lookAt(0, 0, 0);
    return cam;
  }
  const cam = new THREE.PerspectiveCamera(spec.fov, aspect, 0.5, 40);
  cam.position.set(...spec.position);
  cam.lookAt(new THREE.Vector3(...spec.target));
  return cam;
};

const applyPose = (obj: THREE.Object3D, pose: Pose) => {
  obj.position.set(...pose.position);
  obj.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2], "YXZ");
  obj.updateMatrixWorld(true);
};

export const buildWorld = (gl: THREE.WebGLRenderer, row: VersionRow): World => {
  const bg: BackgroundSpec = BACKGROUNDS[row.background];
  const parts = buildPhoneParts({ frameColor: row.frameColor ?? DEFAULT_FRAME_COLOR });
  const env = buildEnvironment(gl);

  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 1.0;

  // key from the upper left, rim from the right
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-3, 4, 4);
  const rim = new THREE.DirectionalLight(0xffffff, 2.4);
  rim.position.set(5, 1.5, -2.5);
  scene.add(key, rim);

  const disposables: { dispose: () => void }[] = [env];
  const roleMeshes: THREE.Mesh[] = [];
  const shadowMeshes: THREE.Object3D[] = [];
  let update: (frame: number) => void;

  const isGrid = row.motion === "Grid";
  const camSpec: CameraSpec = isGrid
    ? GRID.camera
    : row.motion === "DropIn"
      ? DROP_IN.camera
      : row.motion === "Sway"
        ? SWAY.camera
        : row.motion === "TumbleLand"
          ? TUMBLE.camera
          : MODEL_CHECK_MOTION.camera;
  const camera = makeCamera(camSpec, 16 / 9);

  if (isGrid) {
    // ---- instanced grid of phones lying flat, screens up (towards the camera) ----
    const grid = new THREE.Group();
    scene.add(grid);
    const viewW = (GRID.camera as { viewHeight: number }).viewHeight * (16 / 9);
    const pitch = viewW / GRID.columns;
    const matrices: THREE.Matrix4[] = [];
    for (let c = 0; c < GRID.columns; c++) {
      const x = (c - (GRID.columns - 1) / 2) * pitch;
      const colShift = (c % 2) * (GRID.rowPeriod / 2); // alternate columns: half a row
      for (const r of GRID.rows) {
        matrices.push(new THREE.Matrix4().makeTranslation(x, r * GRID.rowPeriod + colShift, 0));
      }
    }
    for (const p of parts) {
      const im = new THREE.InstancedMesh(p.geometry, p.material, matrices.length);
      matrices.forEach((m, i) => im.setMatrixAt(i, m));
      im.userData.role = p.role;
      im.frustumCulled = false;
      grid.add(im);
      roleMeshes.push(im);
    }
    // soft drop shadows, down and to the right
    const tex = roundedRectShadowTexture(0.085);
    const sg = new THREE.PlaneGeometry(PHONE.W + 2 * GRID_SHADOW_PAD, PHONE.H + 2 * GRID_SHADOW_PAD);
    sg.translate(0.045, -0.07, -PHONE.D / 2 - 0.004);
    const sm = new THREE.MeshBasicMaterial({
      color: 0x000000,
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: bg.shadowOpacity ?? 0.3,
    });
    const shadows = new THREE.InstancedMesh(sg, sm, matrices.length);
    matrices.forEach((m, i) => shadows.setMatrixAt(i, m));
    shadows.frustumCulled = false;
    shadows.renderOrder = -1;
    shadows.visible = bg.shadow;
    grid.add(shadows);
    shadowMeshes.push(shadows);
    disposables.push(tex, sg, sm);

    update = (f) => {
      grid.position.y = GRID.offset(f, row.durationInFrames);
      grid.updateMatrixWorld(true);
    };
  } else {
    // ---- a single phone ----
    const phone = buildPhoneGroup(parts);
    scene.add(phone);
    phone.traverse((o) => {
      if (o instanceof THREE.Mesh) roleMeshes.push(o);
    });

    const floorY =
      row.motion === "DropIn" ? DROP_IN.floorY : row.motion === "TumbleLand" ? TUMBLE.floorY : -1.2;
    const tex = contactShadowTexture();
    const sg = new THREE.PlaneGeometry(1, 1);
    sg.rotateX(-Math.PI / 2);
    const sm = new THREE.MeshBasicMaterial({
      color: 0x000000,
      map: tex,
      transparent: true,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(sg, sm);
    shadow.renderOrder = -1;
    shadow.visible = bg.shadow;
    scene.add(shadow);
    shadowMeshes.push(shadow);
    disposables.push(tex, sg, sm);

    const corners = phoneCorners();
    const tmp = new THREE.Vector3();
    const poseAt = (f: number): Pose => {
      switch (row.motion) {
        case "DropIn":
          return DROP_IN.pose(f);
        case "Sway":
          return SWAY.pose(f, row.durationInFrames);
        case "TumbleLand":
          return TUMBLE.pose(f);
        default:
          return MODEL_CHECK_MOTION.pose(f);
      }
    };

    update = (f) => {
      applyPose(phone, poseAt(f));
      // contact shadow follows the phone's footprint, and softens / fades with height
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity;
      for (const c of corners) {
        tmp.copy(c).applyMatrix4(phone.matrixWorld);
        minX = Math.min(minX, tmp.x);
        maxX = Math.max(maxX, tmp.x);
        minZ = Math.min(minZ, tmp.z);
        maxZ = Math.max(maxZ, tmp.z);
        minY = Math.min(minY, tmp.y);
      }
      const gap = Math.max(0, minY - floorY);
      shadow.position.set((minX + maxX) / 2, floorY, (minZ + maxZ) / 2);
      shadow.scale.set((maxX - minX) * 1.25 + 0.5 + gap * 0.6, 1, maxZ - minZ + 0.6 + gap * 0.5);
      sm.opacity = (bg.shadowOpacity ?? 0.4) * Math.exp(-gap * 2.2);
      shadow.updateMatrixWorld(true);
    };
  }

  // ---- render targets + post ----
  const post = buildPostPass(bg);
  const maskWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const maskBlack = new THREE.MeshBasicMaterial({ color: 0x000000 });
  let rtScene: THREE.WebGLRenderTarget | null = null;
  let rtMask: THREE.WebGLRenderTarget | null = null;
  const size = new THREE.Vector2();

  const ensureTargets = () => {
    gl.getDrawingBufferSize(size);
    if (rtScene && rtScene.width === size.x && rtScene.height === size.y) return;
    rtScene?.dispose();
    rtMask?.dispose();
    rtScene = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: MSAA,
      colorSpace: THREE.NoColorSpace,
    });
    rtMask = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.UnsignedByteType,
      samples: MSAA,
      colorSpace: THREE.NoColorSpace,
    });
    post.material.uniforms.uRes.value.set(size.x, size.y);
  };

  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const render = (frame: number) => {
    ensureTargets();
    update(frame);
    const loopFrame = row.loop
      ? ((frame % row.durationInFrames) + row.durationInFrames) % row.durationInFrames
      : frame;

    gl.autoClear = true;
    gl.toneMapping = THREE.NoToneMapping;

    // 1. beauty
    gl.setRenderTarget(rtScene);
    gl.setClearColor(0x000000, 0);
    gl.render(scene, camera);

    // 2. mask
    for (const m of roleMeshes) {
      originals.set(m, m.material);
      m.material = m.userData.role === "screen" ? maskWhite : maskBlack;
    }
    const shadowVis = shadowMeshes.map((s) => s.visible);
    shadowMeshes.forEach((s) => (s.visible = false));
    const envBackup = scene.environment;
    scene.environment = null;
    gl.setRenderTarget(rtMask);
    gl.setClearColor(0x000000, 1);
    gl.render(scene, camera);
    scene.environment = envBackup;
    shadowMeshes.forEach((s, i) => (s.visible = shadowVis[i]));
    for (const m of roleMeshes) m.material = originals.get(m)!;

    // 3. post -> canvas
    post.material.uniforms.tScene.value = rtScene!.texture;
    post.material.uniforms.tMask.value = rtMask!.texture;
    post.material.uniforms.uFrame.value = loopFrame;
    gl.setRenderTarget(null);
    gl.setClearColor(0x000000, 1);
    gl.render(post.scene, post.camera);
  };

  return {
    render,
    dispose: () => {
      rtScene?.dispose();
      rtMask?.dispose();
      post.material.dispose();
      maskWhite.dispose();
      maskBlack.dispose();
      for (const p of parts) {
        p.geometry.dispose();
        p.material.dispose();
      }
      disposables.forEach((d) => d.dispose());
    },
  };
};
