import type { Font } from "opentype.js";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ACCENT_COLOR, ICON_COLOR, type AcronymRow } from "../data/acronyms";
import { buildIconAtlas } from "../icons/atlas";
import {
  CUBE,
  CUBE_RADIUS,
  ICON_SIZE,
  LOOP,
  PLATE_D,
  PLATE_H,
  PLATE_TOP,
  PLATE_W,
  buildLayout,
  cubeHeight,
} from "./layout";
import { buildLetters } from "./letters";
import {
  makeCubeMaterial,
  makeIconMaterial,
  makeIridescentMaterial,
  makeLetterFaceMaterial,
  makePlateMaterial,
} from "./materials";
import { PostPipeline, type PostParams } from "./post";

/** Look parameters shared by every version (tuned against the reference). */
export const LOOK = {
  fov: 30,
  pitchDeg: 40,
  /** plate width as a share of the frame width */
  plateFrameShare: 0.55,
  pushIn: 0.04,
  yawDeg: 3,
  cubeBrightness: 0.3,
  bgDarken: 0.05,
  post: {
    aperture: 2.4,
    focusRange: 2.6,
    nearScale: 2.6,
    maxBlur: 0.013,
    bloomStrength: 0.9,
    bloomThreshold: 0.9,
    exposure: 0.85,
    vignette: 0.45,
    grain: 0.015,
  },
};

const lin = (hex: string) => new THREE.Color(hex); // hex → linear working space

export type World = {
  update: (frame: number) => void;
  render: (frame: number, width: number, height: number) => void;
  dispose: () => void;
};

export function buildWorld(gl: THREE.WebGLRenderer, row: AcronymRow, font: Font, profile = false): World {
  gl.toneMapping = THREE.NoToneMapping;
  gl.autoClear = false;

  const scene = new THREE.Scene();
  const colA = lin(row.colorA);
  const colB = lin(row.colorB);
  const bg = colA.clone().lerp(colB, 0.35).multiplyScalar(LOOK.bgDarken);
  gl.setClearColor(bg, 1);

  // environment: RoomEnvironment through PMREM (built once)
  const pmrem = new THREE.PMREMGenerator(gl);
  const room = new RoomEnvironment();
  const envRT = pmrem.fromScene(room, 0.04);
  const env = envRT.texture;
  room.dispose();
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(-8, 16, -14);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.25);
  fill.position.set(10, 8, 12);
  scene.add(fill);

  // --- cube field ---------------------------------------------------------
  const cells = buildLayout(row.word, row.icons.length);
  const n = cells.length;
  const cubeGeo = new RoundedBoxGeometry(CUBE, CUBE, CUBE, 1, CUBE_RADIUS);
  const cube = makeCubeMaterial(env);
  const cubes = new THREE.InstancedMesh(cubeGeo, cube.material, n);
  cubes.frustumCulled = false;
  const tmp = new THREE.Color();
  cells.forEach((c, i) => {
    tmp.copy(colA).lerp(colB, c.gradientT).multiplyScalar(LOOK.cubeBrightness);
    cubes.setColorAt(i, tmp);
  });
  scene.add(cubes);

  // --- icons ----------------------------------------------------------------
  const atlasCanvas = buildIconAtlas([...row.icons, row.accentIcon], font);
  const atlas = new THREE.CanvasTexture(atlasCanvas);
  atlas.colorSpace = THREE.NoColorSpace;
  atlas.generateMipmaps = true;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.magFilter = THREE.LinearFilter;
  atlas.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
  atlas.needsUpdate = true;

  const iconGeo = new THREE.PlaneGeometry(ICON_SIZE, ICON_SIZE);
  iconGeo.rotateX(-Math.PI / 2);
  const slot = new Float32Array(n);
  const accent = new Float32Array(n);
  const flare = new Float32Array(n);
  const shimmer = new Float32Array(n);
  cells.forEach((c, i) => {
    slot[i] = c.slot;
    accent[i] = c.accent ? 1 : 0;
    flare[i] = c.flareStart;
    shimmer[i] = c.shimmer;
  });
  iconGeo.setAttribute("aSlot", new THREE.InstancedBufferAttribute(slot, 1));
  iconGeo.setAttribute("aAccent", new THREE.InstancedBufferAttribute(accent, 1));
  iconGeo.setAttribute("aFlare", new THREE.InstancedBufferAttribute(flare, 1));
  iconGeo.setAttribute("aShimmer", new THREE.InstancedBufferAttribute(shimmer, 1));
  const icon = makeIconMaterial(atlas, lin(row.iconColor ?? ICON_COLOR), lin(row.accentColor ?? ACCENT_COLOR));
  const icons = new THREE.InstancedMesh(iconGeo, icon.material, n);
  icons.frustumCulled = false;
  icons.renderOrder = 2;
  scene.add(icons);

  // identity matrices once; per frame only the translation is written
  const cm = cubes.instanceMatrix.array as Float32Array;
  const im = icons.instanceMatrix.array as Float32Array;
  const ident = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    ident.toArray(cm, i * 16);
    ident.toArray(im, i * 16);
  }

  // --- plate and letters ----------------------------------------------------
  const mid = colA.clone().lerp(colB, 0.5);
  const plateGeo = new RoundedBoxGeometry(PLATE_W, PLATE_H, PLATE_D, 4, 0.12);
  const plate = makePlateMaterial(env, mid.clone().multiplyScalar(0.16), mid.clone().lerp(new THREE.Color(1, 1, 1), 0.4).multiplyScalar(0.5));
  const plateMesh = new THREE.Mesh(plateGeo, plate.material);
  plateMesh.position.y = PLATE_TOP - PLATE_H / 2;
  scene.add(plateMesh);

  const letters = buildLetters(font, row.word, row.coinNotches);
  const face = makeLetterFaceMaterial(env, lin(row.letterFace), letters.capHeight);
  const iri = makeIridescentMaterial(env);
  const letterMesh = new THREE.Mesh(letters.geometry, [face.material, iri.material]);
  letterMesh.position.y = PLATE_TOP;
  scene.add(letterMesh);

  // --- camera ---------------------------------------------------------------
  const camera = new THREE.PerspectiveCamera(LOOK.fov, 16 / 9, 1, 160);
  const target = new THREE.Vector3(0, PLATE_TOP, 0);
  const halfH = Math.tan(THREE.MathUtils.degToRad(LOOK.fov / 2));
  // distance at which the plate spans plateFrameShare of the frame width
  const baseDist = PLATE_W / LOOK.plateFrameShare / (2 * halfH * (16 / 9));
  const pitch = THREE.MathUtils.degToRad(LOOK.pitchDeg);
  let focus = baseDist;

  const pipeline = new PostPipeline(gl);
  let stamp = 0;
  const sync = () => {
    // a 1-pixel read forces the GPU to finish (profiling only)
    const ctx = gl.getContext();
    if (gl.getRenderTarget()) ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.FLOAT, new Float32Array(4));
    else ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, new Uint8Array(4));
  };
  if (profile) {
    pipeline.mark = (stage) => {
      sync();
      const now = performance.now();
      console.log(`PROFILE ${stage} ${(now - stamp).toFixed(1)}ms`);
      stamp = now;
    };
  }

  const update = (frame: number) => {
    stamp = performance.now();
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const theta = (f / LOOP) * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const c = cells[i];
      const y = cubeHeight(c, f);
      const o = i * 16;
      cm[o + 12] = c.x;
      cm[o + 13] = y;
      cm[o + 14] = c.z;
      im[o + 12] = c.x;
      im[o + 13] = y + CUBE / 2 + 0.004;
      im[o + 14] = c.z;
    }
    cubes.instanceMatrix.needsUpdate = true;
    icons.instanceMatrix.needsUpdate = true;
    icon.uniforms.uFrame.value = f;

    // closed camera path: push in/out ±4 % and yaw ±3°, one lap per loop
    const dist = baseDist * (1 + LOOK.pushIn * Math.sin(theta));
    const yaw = THREE.MathUtils.degToRad(LOOK.yawDeg) * Math.cos(theta);
    camera.position.set(
      target.x + dist * Math.cos(pitch) * Math.sin(yaw),
      target.y + dist * Math.sin(pitch),
      target.z + dist * Math.cos(pitch) * Math.cos(yaw),
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
    focus = dist;
    iri.uniforms.uPhase.value = yaw * 5 + Math.sin(theta) * 0.25;
    if (profile) {
      const now = performance.now();
      console.log(`PROFILE update ${(now - stamp).toFixed(1)}ms`);
      stamp = now;
    }
  };

  const render = (frame: number, width: number, height: number) => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    pipeline.setSize(width, height);
    const params: PostParams = {
      frame: ((frame % LOOP) + LOOP) % LOOP,
      focusDistance: focus,
      ...LOOK.post,
    };
    pipeline.render(scene, camera, params);
  };

  const dispose = () => {
    pipeline.dispose();
    envRT.dispose();
    atlas.dispose();
    cubeGeo.dispose();
    iconGeo.dispose();
    plateGeo.dispose();
    letters.geometry.dispose();
    [cube.material, icon.material, plate.material, face.material, iri.material].forEach((m) => m.dispose());
  };

  return { update, render, dispose };
}
