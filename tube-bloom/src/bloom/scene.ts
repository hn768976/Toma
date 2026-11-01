import * as THREE from "three";
import { BODY_FRAG, BODY_VERT, POST_FRAG, POST_VERT, TUBE_FRAG, TUBE_VERT } from "./shaders";
import type { BloomState } from "./timeline";

export type Look = {
  bg: [number, number, number];
  white: [number, number, number];
  pink: [number, number, number];
  pinkLight: [number, number, number];
  shade: [number, number, number];
};

export type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  fov: number;
  focus: number; // focus distance in world units
  aperture: number;
  edgeBlur: number; // extra defocus towards the frame edges (lens field curvature)
};

const TUBES_PER_FLOWER = 36;
const SEG_ALONG = 140;
const SEG_AROUND = 8;
const DEPTH_RANGE = 12; // world units mapped to [0,1] in the depth channel

// Flowers sit on a square lattice rotated so that two of them occupy the
// upper-right and lower-left of frame, like the reference.
const LATTICE = 2.4;
const LATTICE_ANGLE = (42.6 * Math.PI) / 180;

const flowerCentres = (): [number, number, number][] => {
  const e1 = new THREE.Vector2(Math.cos(LATTICE_ANGLE), Math.sin(LATTICE_ANGLE));
  const e2 = new THREE.Vector2(-e1.y, e1.x);
  const out: [number, number, number][] = [];
  for (let i = -2; i <= 1; i++) {
    for (let j = -2; j <= 2; j++) {
      const x = (e1.x * (i + 0.5) + e2.x * j) * LATTICE;
      const y = (e1.y * (i + 0.5) + e2.y * j) * LATTICE;
      if (Math.hypot(x, y) > 4.6) continue;
      // tiny per-flower height offset keeps crossings between neighbours
      // deterministic (no z-fighting) while still reading as woven
      const zb = ((i + j) & 1) === 0 ? 0.012 : -0.012;
      out.push([x, y, zb]);
    }
  }
  return out;
};

const buildBodyGeometry = () => {
  const U = 48;
  const W = 96;
  const verts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= U; i++) {
    for (let j = 0; j <= W; j++) {
      verts.push((i / U) * Math.PI * 2, (j / W) * Math.PI * 2, 0);
    }
  }
  const row = W + 1;
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < W; j++) {
      const a = i * row + j;
      const b = a + row;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  const centres = flowerCentres();
  g.setAttribute("aFlower", new THREE.InstancedBufferAttribute(new Float32Array(centres.reduce<number[]>((acc, c) => acc.concat(c), [])), 3));
  g.instanceCount = centres.length;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
  return g;
};

const buildTubeGeometry = () => {
  const verts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= SEG_ALONG; i++) {
    const s = i / SEG_ALONG;
    for (let j = 0; j <= SEG_AROUND; j++) {
      verts.push(s, (j / SEG_AROUND) * Math.PI * 2, 0);
    }
  }
  const row = SEG_AROUND + 1;
  for (let i = 0; i < SEG_ALONG; i++) {
    for (let j = 0; j < SEG_AROUND; j++) {
      const a = i * row + j;
      const b = a + row;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);

  const centres = flowerCentres();
  const flowers: number[] = [];
  const tubes: number[] = [];
  for (const c of centres) {
    for (let t = 0; t < TUBES_PER_FLOWER; t++) {
      flowers.push(c[0], c[1], c[2]);
      tubes.push(t);
    }
  }
  g.setAttribute("aFlower", new THREE.InstancedBufferAttribute(new Float32Array(flowers), 3));
  g.setAttribute("aTube", new THREE.InstancedBufferAttribute(new Float32Array(tubes), 1));
  g.instanceCount = tubes.length;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
  return g;
};

export class BloomScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 60);
  tubeMat: THREE.ShaderMaterial;
  bodyMat: THREE.ShaderMaterial;
  bodyMesh: THREE.Mesh;
  postMat: THREE.ShaderMaterial;
  postScene = new THREE.Scene();
  postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  target: THREE.WebGLRenderTarget;

  constructor(canvas: HTMLCanvasElement, width: number, height: number, look: Look) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(new THREE.Color(...look.bg), 1);

    this.target = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: 4,
      depthBuffer: true,
    });

    this.tubeMat = new THREE.ShaderMaterial({
      vertexShader: TUBE_VERT,
      fragmentShader: TUBE_FRAG,
      side: THREE.DoubleSide,
      uniforms: {
        uRt: { value: 0.55 },
        uRr: { value: 0.42 },
        uRz: { value: 0.42 },
        uTwist: { value: 0.9 },
        uRot: { value: 0 },
        uPhi0: { value: (130 * Math.PI) / 180 },
        uSpan: { value: (310 * Math.PI) / 180 },
        uTubeR: { value: 0.026 },
        uCount: { value: TUBES_PER_FLOWER },
        uTaper: { value: 0 },
        uFlatten: { value: 0 },
        uWhite: { value: new THREE.Vector3(...look.white) },
        uPink: { value: new THREE.Vector3(...look.pink) },
        uPinkLight: { value: new THREE.Vector3(...look.pinkLight) },
        uShade: { value: new THREE.Vector3(...look.shade) },
        uPinkAmt: { value: 1 },
        uPinkS: { value: 0.13 },
        uDepthScale: { value: 1 / DEPTH_RANGE },
        uLightDir: { value: new THREE.Vector3(-0.45, 0.55, 0.85) },
        uCamPos: { value: new THREE.Vector3() },
      },
    });
    const mesh = new THREE.Mesh(buildTubeGeometry(), this.tubeMat);
    mesh.frustumCulled = false;
    this.scene.add(mesh);

    this.bodyMat = new THREE.ShaderMaterial({
      vertexShader: BODY_VERT,
      fragmentShader: BODY_FRAG,
      side: THREE.DoubleSide,
      uniforms: {
        uRt: { value: 0.55 },
        uRr: { value: 0.42 },
        uRz: { value: 0.42 },
        uK: { value: 1 },
        uSink: { value: 0 },
        uWhite: { value: new THREE.Vector3(...look.white) },
        uPink: { value: new THREE.Vector3(...look.pink) },
        uPinkAmt: { value: 1 },
        uDepthScale: { value: 1 / DEPTH_RANGE },
        uLightDir: this.tubeMat.uniforms.uLightDir,
        uCamPos: this.tubeMat.uniforms.uCamPos,
        uTone: { value: 0.98 },
      },
    });
    this.bodyMesh = new THREE.Mesh(buildBodyGeometry(), this.bodyMat);
    this.bodyMesh.frustumCulled = false;
    this.scene.add(this.bodyMesh);

    this.postMat = new THREE.ShaderMaterial({
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.target.texture },
        uRes: { value: new THREE.Vector2(width, height) },
        uFocus: { value: 0.3 },
        uAperture: { value: 20 },
        uMaxCoC: { value: 0.026 },
        uEdgeBlur: { value: 0.6 },
        uSeed: { value: 0 },
        uBg: { value: new THREE.Vector3(...look.bg) },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
    quad.frustumCulled = false;
    this.postScene.add(quad);
  }

  render(state: BloomState, pose: CameraPose, frame: number) {
    const u = this.tubeMat.uniforms;
    u.uRt.value = state.rt;
    u.uRr.value = state.rr;
    u.uRz.value = state.rz;
    u.uTwist.value = state.twist;
    u.uRot.value = state.rot;
    u.uTubeR.value = state.tubeR;
    u.uPinkAmt.value = state.pinkAmt;
    u.uPinkS.value = state.pinkS;
    u.uPhi0.value = state.phi0;
    u.uTaper.value = state.bloom;
    u.uFlatten.value = 0.72 * Math.max(0, 1 - state.bloom / 0.6);
    u.uSpan.value = state.span;

    const bu = this.bodyMat.uniforms;
    bu.uRt.value = state.rt;
    // body sits almost flush with the tube tops: the wrapped torus reads as a
    // solid dome carved with grooves rather than an open coil spring
    bu.uRr.value = Math.max(0, state.rr + state.tubeR * 0.35);
    bu.uRz.value = Math.max(0, state.rz + state.tubeR * 0.35);
    bu.uK.value = state.bodyK;
    bu.uSink.value = state.bodySink;
    this.bodyMesh.visible = state.bodyK > 0.001;

    const cam = this.camera;
    cam.fov = pose.fov;
    cam.aspect = this.postMat.uniforms.uRes.value.x / this.postMat.uniforms.uRes.value.y;
    cam.position.set(...pose.position);
    cam.up.set(...pose.up);
    cam.lookAt(new THREE.Vector3(...pose.target));
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    u.uCamPos.value.copy(cam.position);

    const p = this.postMat.uniforms;
    p.uFocus.value = pose.focus / DEPTH_RANGE;
    p.uAperture.value = pose.aperture;
    p.uEdgeBlur.value = pose.edgeBlur;
    p.uSeed.value = frame % 97;

    this.renderer.setRenderTarget(this.target);
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, cam);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);
    this.renderer.getContext().finish();
  }

  dispose() {
    this.target.dispose();
    this.renderer.dispose();
  }
}
