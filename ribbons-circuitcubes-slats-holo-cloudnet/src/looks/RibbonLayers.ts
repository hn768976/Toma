import * as THREE from "three";
import { defaultPost } from "../engine/post";
import { FULLSCREEN_VERT, fullscreenMesh, lin } from "../engine/fullscreen";
import { LookFactory } from "../engine/Stage";
import { TAU, phaseOf } from "../engine/rng";

// Look 1 — thick satin ribbons stacked in layers. Each ribbon is a rounded
// (stadium) profile swept along a wavy centre line; the centre lines are sums
// of sines with whole cycles per 600 frames, so the loop is exact.

export type RibbonParams = {
  ribbon: string;
  shadow: string;
  /** Colour of the key light (slightly warm/cool per version). */
  key: string;
  sheen: string;
};

const RIBBONS = 9;
const SEG = 180; // samples along each ribbon
const X0 = -13;
const X1 = 13;
const WIDTH = 1.8; // ≈18% of the frame height (frame ≈ 10 units tall at the stack)
const THICK = 0.3; // ≈3%
const DZ = THICK * 1.15; // each ribbon sits a little in front of the one below
const SPACING = 1.55;

// stadium profile: (a across the ribbon, b through its thickness) + normals
const profile: { a: number; b: number; na: number; nb: number }[] = (() => {
  const pts: { a: number; b: number; na: number; nb: number }[] = [];
  const half = (WIDTH - THICK) / 2;
  const r = THICK / 2;
  const FLAT = 10;
  const ARC = 14;
  // top (front) face, a: -half → +half
  // front face carries a soft crown so light grades across each band
  const CROWN = 0.04;
  for (let i = 0; i <= FLAT; i++) {
    const a = -half + (2 * half * i) / FLAT;
    const u = a / half;
    const slope = (-2 * CROWN * u) / half;
    const l = Math.hypot(slope, 1);
    pts.push({ a, b: r + CROWN * (1 - u * u), na: -slope / l, nb: 1 / l });
  }
  // right rounded edge, from front to back
  for (let i = 1; i < ARC; i++) {
    const t = Math.PI / 2 - (Math.PI * i) / ARC;
    pts.push({ a: half + r * Math.cos(t), b: r * Math.sin(t), na: Math.cos(t), nb: Math.sin(t) });
  }
  for (let i = 0; i <= FLAT; i++) pts.push({ a: half - (2 * half * i) / FLAT, b: -r, na: 0, nb: -1 });
  for (let i = 1; i < ARC; i++) {
    const t = -Math.PI / 2 - (Math.PI * i) / ARC;
    pts.push({ a: -half + r * Math.cos(t), b: r * Math.sin(t), na: Math.cos(t), nb: Math.sin(t) });
  }
  pts.push(pts[0]);
  return pts;
})();
const PN = profile.length;

/** Centre line of ribbon i at x for loop phase t (whole-cycle sines only). */
const centre = (i: number, x: number, t: number) => {
  const w = TAU * t;
  // shared flow: nearly level on the left, bowing up toward the right;
  // phase and amplitude drift with whole cycles per loop
  // level on the left, a gentle rise, then a hard sweep down at the right edge
  const g =
    (1.3 + 0.2 * Math.sin(w + 0.6)) * Math.sin(0.36 * x + 0.35 + 0.35 * Math.sin(w)) +
    0.12 * Math.sin(0.6 * x - w + 0.4) +
    0.08 * Math.sin(1.1 * x + w * 2 + 1.7 + i * 0.35);
  // layers converge toward the lower right
  const sp = SPACING * (1 - 0.15 * Math.max(0, Math.tanh((x - 1) / 4))) * (1 + 0.05 * Math.sin(w + i * 0.9 + 0.2 * x));
  const local = 0.08 * Math.sin(0.8 * x + i * 1.3 + w) * (1 + 0.4 * Math.cos(w + i));
  return 6.6 - i * sp + g + local;
};

export const createRibbonLayers: LookFactory<RibbonParams> = (params, gl) => {
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 4, 60);

  const shadowTint = lin(params.shadow);
  // background (only visible at the extreme edges): deep shadow tone
  const bgMat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: `uniform vec3 c; varying vec2 vUv; void main(){ gl_FragColor = vec4(c * (0.6 + 0.4 * vUv.y), 1.0); }`,
    uniforms: { c: { value: lin(params.ribbon).multiplyScalar(0.35).lerp(shadowTint, 0.35) } },
    depthWrite: false,
  });
  scene.add(fullscreenMesh(bgMat));

  const group = new THREE.Group();
  group.rotation.set(-0.45, 0.06, THREE.MathUtils.degToRad(-8));
  scene.add(group);

  const mat = new THREE.MeshPhysicalMaterial({
    color: lin(params.ribbon),
    roughness: 0.45,
    metalness: 0,
    sheen: 0.25,
    sheenRoughness: 0.45,
    sheenColor: lin(params.sheen),
  });

  const index: number[] = [];
  for (let s = 0; s < SEG; s++)
    for (let k = 0; k < PN - 1; k++) {
      const a = s * PN + k;
      const b = (s + 1) * PN + k;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }

  const ribbons = Array.from({ length: RIBBONS }, (_, i) => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((SEG + 1) * PN * 3);
    const nor = new Float32Array((SEG + 1) * PN * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    geo.setIndex(index);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.position.z = -i * DZ;
    group.add(mesh);
    return { geo, pos, nor, i };
  });

  const key = new THREE.DirectionalLight(lin(params.key), 1.9);
  key.position.set(-2, 11, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -14;
  key.shadow.camera.right = 14;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  scene.add(key.target);
  const hemi = new THREE.HemisphereLight(lin(params.ribbon).lerp(lin(params.sheen), 0.45), shadowTint.clone().lerp(lin(params.ribbon), 0.7), 1.25);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(shadowTint.clone().lerp(new THREE.Color(1, 1, 1), 0.15), 0.3);
  fill.position.set(7, -4, 6);
  scene.add(fill);

  const update = (frame: number, w: number, h: number) => {
    const t = phaseOf(frame);
    for (const r of ribbons) {
      let o = 0;
      for (let s = 0; s <= SEG; s++) {
        const x = X0 + ((X1 - X0) * s) / SEG;
        const y = centre(r.i, x, t);
        const dx = 0.01;
        const dy = (centre(r.i, x + dx, t) - centre(r.i, x - dx, t)) / (2 * dx);
        const len = Math.hypot(1, dy);
        const nx = -dy / len;
        const ny = 1 / len;
        // a slight roll along the ribbon so the light rolls across the edges
        const roll = 0.08 * Math.sin(0.4 * x + r.i * 0.8 + TAU * t);
        // the whole stack also undulates in depth, so shading rolls along each ribbon
        const zw = 0.45 * Math.sin(0.33 * x + 0.8 + TAU * t) + 0.15 * Math.sin(0.7 * x - TAU * t * 2);
        const cr = Math.cos(roll);
        const sr = Math.sin(roll);
        for (let k = 0; k < PN; k++) {
          const p = profile[k];
          const a = p.a * cr - p.b * sr;
          const b = p.a * sr + p.b * cr;
          const na = p.na * cr - p.nb * sr;
          const nb = p.na * sr + p.nb * cr;
          r.pos[o] = x + nx * a;
          r.pos[o + 1] = y + ny * a;
          r.pos[o + 2] = b + zw;
          r.nor[o] = nx * na;
          r.nor[o + 1] = ny * na;
          r.nor[o + 2] = nb;
          o += 3;
        }
      }
      r.geo.attributes.position.needsUpdate = true;
      r.geo.attributes.normal.needsUpdate = true;
    }
    const w0 = TAU * t;
    camera.aspect = w / h;
    camera.position.set(0.35 * Math.sin(w0), 0.25 * Math.sin(w0 + 1.2), 10.6 + 0.25 * Math.cos(w0));
    camera.lookAt(0.1 * Math.sin(w0 + 0.5), 0, 0);
    camera.updateProjectionMatrix();
  };

  return {
    scene,
    camera,
    update,
    post: () => ({
      ...defaultPost(),
      ao: 0.35,
      aoRadius: 0.45,
      aoTint: lin(params.ribbon).multiplyScalar(0.35).lerp(shadowTint, 0.4),
      focus: 10.3,
      dofNear: 0.008,
      dofFar: 0.007,
      dofRange: 6,
      bloom: 0.08,
      bloomThreshold: 1.0,
      vignette: 0.3,
      exposure: 1.12,
      saturation: 1.25,
    }),
    dispose: () => {
      ribbons.forEach((r) => r.geo.dispose());
      mat.dispose();
      bgMat.dispose();
    },
  };
};
