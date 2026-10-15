import React, { useCallback } from "react";
import * as THREE from "three";
import { hexToLinear } from "../../lib/color";
import { grainFrame, loopPhase, TAU } from "../../lib/loop";
import { PostPipeline } from "../../lib/post";
import { mulberry32, pick, range } from "../../lib/rng";
import { ThreeLook, ThreeLookFactory } from "../../lib/ThreeLook";
import { BackgroundKind, renderBackground } from "./background";

export type GlassKnotVariant = {
  id: string;
  background: BackgroundKind;
  /** background base, cloud/arm colour A, colour B, core */
  bgBase: string;
  bgA: string;
  bgB: string;
  bgCore: string;
  /** deep tint of the volume inside the glass */
  inner: string;
  starColors: string[];
};

// ---- knot geometry (matches THREE.TorusKnotGeometry's curve) ----
const P = 2;
const Q = 3;
const KNOT_R = 1;
const TUBE_R = 0.52;

const curve = (u: number, out: THREE.Vector3) => {
  const qu = (Q / P) * u;
  const cs = Math.cos(qu);
  return out.set(KNOT_R * (2 + cs) * 0.5 * Math.cos(u), KNOT_R * (2 + cs) * 0.5 * Math.sin(u), KNOT_R * Math.sin(qu) * 0.5);
};

/** Point inside (rho < 1) or on (rho = 1) the tube, plus its outward normal. */
const tubePoint = (u: number, rho: number, ang: number) => {
  const p0 = curve(u, new THREE.Vector3());
  const p1 = curve(u + 0.001, new THREE.Vector3());
  const t = p1.clone().sub(p0).normalize();
  const nRef = p1.clone().add(p0);
  const b = t.clone().cross(nRef).normalize();
  const n = b.clone().cross(t).normalize();
  const dir = n.multiplyScalar(Math.cos(ang)).add(b.multiplyScalar(Math.sin(ang))).normalize();
  return { pos: p0.add(dir.clone().multiplyScalar(rho * TUBE_R)), normal: dir };
};

// The trefoil maps onto itself under a 120 deg turn about z, so everything inside it is
// generated once and replicated three times: frame 600 then reproduces frame 0 exactly.
const rotZ = (v: THREE.Vector3, k: number) => v.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), (k * TAU) / 3);

type Star = { pos: THREE.Vector3; size: number; color: THREE.Color; gain: number; cycles: number; phase: number };

const buildStars = (colors: string[]): Star[] => {
  const rng = mulberry32(0x6c055);
  const base: Star[] = [];
  for (let i = 0; i < 200; i++) {
    const u = rng() * TAU * P;
    const rho = 0.75 * Math.sqrt(rng());
    const { pos } = tubePoint(u, rho, rng() * TAU);
    const big = rng() < 0.12;
    base.push({
      pos,
      size: big ? range(rng, 0.022, 0.036) : range(rng, 0.007, 0.018),
      color: new THREE.Color(pick(rng, colors)),
      gain: big ? range(rng, 8, 16) : range(rng, 2, 7),
      cycles: 1 + Math.floor(rng() * 4),
      phase: rng(),
    });
  }
  const out: Star[] = [];
  for (let k = 0; k < 3; k++) for (const s of base) out.push({ ...s, pos: rotZ(s.pos, k) });
  return out;
};

const buildGlints = () => {
  const rng = mulberry32(0x911);
  const base: { pos: THREE.Vector3; normal: THREE.Vector3 }[] = [];
  for (let i = 0; i < 6; i++) {
    base.push(tubePoint(rng() * TAU * P, 1.0, rng() * TAU));
  }
  const out: { pos: THREE.Vector3; normal: THREE.Vector3 }[] = [];
  for (let k = 0; k < 3; k++) for (const g of base) out.push({ pos: rotZ(g.pos, k), normal: rotZ(g.normal, k) });
  return out;
};

const starTexture = () => {
  const N = 128;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (x + 0.5) / N - 0.5;
      const dy = (y + 0.5) / N - 0.5;
      const r = Math.hypot(dx, dy);
      const core = Math.exp(-(r * r) / 0.0012);
      const halo = Math.exp(-r / 0.06) * 0.35;
      const spikeX = Math.exp(-Math.abs(dy) / 0.006) * Math.max(0, 1 - Math.abs(dx) * 2.1);
      const spikeY = Math.exp(-Math.abs(dx) / 0.006) * Math.max(0, 1 - Math.abs(dy) * 2.1);
      const v = Math.min(1, core + halo + 0.8 * (spikeX * spikeX + spikeY * spikeY));
      const i = (y * N + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(v * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
};

const buildEnvironment = (gl: THREE.WebGLRenderer) => {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.SphereGeometry(20, 32, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.012, 0.014, 0.025), side: THREE.BackSide }),
  );
  env.add(room);
  const box = (w: number, h: number, pos: [number, number, number], intensity: number, tint: [number, number, number] = [1, 1, 1]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(tint[0] * intensity, tint[1] * intensity, tint[2] * intensity), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  box(9, 5, [-7, 7, 7], 16);
  box(2, 6, [8, 1, 3], 6, [0.9, 0.95, 1.1]);
  box(2, 1.5, [1, 8, -2], 20);
  box(8, 1.2, [0, -7, 4], 1.5, [0.7, 0.8, 1.2]);
  box(1.4, 1.4, [-3, 1, 9], 12, [1.1, 1.0, 0.9]);
  const pmrem = new THREE.PMREMGenerator(gl);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  return rt;
};

const makeFactory =
  (v: GlassKnotVariant): ThreeLookFactory =>
  (gl, pxW, pxH) => {
    const aspect = pxW / pxH;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0, 0, 0);
    const cam = new THREE.PerspectiveCamera(35, aspect, 0.1, 100);
    cam.position.set(0, 0, 6.3);
    cam.lookAt(0, 0, 0);

    const envRT = buildEnvironment(gl);
    scene.environment = envRT.texture;

    // background plane, pre-blurred procedural galaxy / nebula
    const bgH = Math.min(pxH, 1080);
    const bgRT = renderBackground(
      gl,
      {
        kind: v.background,
        base: hexToLinear(v.bgBase),
        a: hexToLinear(v.bgA),
        b: hexToLinear(v.bgB),
        core: hexToLinear(v.bgCore),
      },
      Math.round(bgH * aspect),
      bgH,
    );
    const bgDist = 30;
    const bgHalfH = Math.tan(THREE.MathUtils.degToRad(35 / 2)) * (bgDist + 7) * 1.12;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(bgHalfH * 2 * aspect, bgHalfH * 2),
      new THREE.MeshBasicMaterial({ map: bgRT.texture, toneMapped: false, depthWrite: true }),
    );
    bg.position.z = -bgDist;
    scene.add(bg);

    const tilt = new THREE.Group();
    scene.add(tilt);
    const knot = new THREE.Group();
    tilt.add(knot);

    // the glass
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.02,
      transmission: 1,
      thickness: 0.5,
      ior: 1.5,
      dispersion: 0.25,
      envMapIntensity: 1.6,
      specularIntensity: 1,
      clearcoat: 0.3,
      clearcoatRoughness: 0.05,
      attenuationColor: new THREE.Color(v.inner),
      attenuationDistance: 0.6,
    });
    // Path length through a tube is long at its centre and short at its silhouette:
    // scale thickness by the facing ratio so the middle tints deep blue while the
    // edges stay clear and refract less (three.js otherwise uses one constant thickness).
    glass.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <transmission_fragment>",
        THREE.ShaderChunk.transmission_fragment.replace(
          "material.thickness = thickness;",
          "material.thickness = thickness * clamp(dot(normal, normalize(vViewPosition)) * 1.5, 0.12, 1.0);",
        ),
      );
    };
    const knotGeo = new THREE.TorusKnotGeometry(KNOT_R, TUBE_R, 600, 64, P, Q);
    knot.add(new THREE.Mesh(knotGeo, glass));

    // stars inside the tube (opaque, so the transmission pass refracts them)
    const stars = buildStars(v.starColors);
    const starMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: 0xffffff }), stars.length);
    const m4 = new THREE.Matrix4();
    stars.forEach((s, i) => {
      m4.makeScale(s.size, s.size, s.size).setPosition(s.pos);
      starMesh.setMatrixAt(i, m4);
      starMesh.setColorAt(i, s.color);
    });
    starMesh.frustumCulled = false;
    knot.add(starMesh);

    // specular glints: star sprites pinned to the glass, brightening when the surface
    // mirrors the key softbox toward the camera, so they slide as the knot turns
    const glints = buildGlints();
    const starTex = starTexture();
    const glintSprites = glints.map(() => {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: starTex, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true, toneMapped: false }),
      );
      scene.add(sp);
      return sp;
    });
    const keyDir = new THREE.Vector3(-6, 6, 6).normalize();

    const post = new PostPipeline(pxW, pxH, {
      msaa: 4,
      bloom: { strength: 0.55, threshold: 1.0, knee: 0.7 },
      streak: { strength: 0.5, length: 0.1 },
      vignette: { strength: 0.6, color: [0, 0, 0] },
      exposure: 1,
      grain: 0.015,
    });

    const tmpC = new THREE.Color();
    const wp = new THREE.Vector3();
    const wn = new THREE.Vector3();
    const view = new THREE.Vector3();
    const refl = new THREE.Vector3();
    const nm = new THREE.Matrix3();

    return {
      render: (g, frame) => {
        const t = loopPhase(frame);
        // exactly one third of a turn about the symmetry axis per loop, plus a gentle tilt
        knot.rotation.z = (-TAU / 3) * t;
        tilt.rotation.x = -0.7 + 0.08 * Math.sin(TAU * t);
        tilt.rotation.y = 0.22 + 0.05 * Math.sin(TAU * t + 1.3);
        bg.position.x = 0.35 * Math.sin(TAU * t);
        bg.position.y = 0.2 * Math.sin(TAU * 2 * t + 0.7);

        stars.forEach((s, i) => {
          const tw = 0.55 + 0.45 * Math.sin(TAU * (s.cycles * t + s.phase));
          tmpC.copy(s.color).multiplyScalar(s.gain * tw);
          starMesh.setColorAt(i, tmpC);
        });
        if (starMesh.instanceColor) starMesh.instanceColor.needsUpdate = true;

        scene.updateMatrixWorld(true);
        nm.getNormalMatrix(knot.matrixWorld);
        glints.forEach((gl8, i) => {
          wp.copy(gl8.pos).applyMatrix4(knot.matrixWorld);
          wn.copy(gl8.normal).applyMatrix3(nm).normalize();
          view.copy(cam.position).sub(wp).normalize();
          const facing = wn.dot(view);
          refl.copy(view).negate().reflect(wn);
          const spec = Math.pow(Math.max(refl.dot(keyDir), 0), 60);
          const k = facing > 0 ? spec * Math.min(1, facing * 4) : 0;
          const sp = glintSprites[i];
          sp.position.copy(wp).addScaledVector(view, 0.05);
          const size = 0.25 + 0.55 * k;
          sp.scale.set(size, size, 1);
          (sp.material as THREE.SpriteMaterial).color.setScalar(6 * k);
          sp.visible = k > 0.002;
        });

        post.render(g, scene, cam, grainFrame(frame));
      },
      dispose: () => {
        post.dispose();
        bgRT.dispose();
        envRT.dispose();
        knotGeo.dispose();
        glass.dispose();
        starTex.dispose();
      },
    };
  };

export const GlassKnot: React.FC<{ variant: GlassKnotVariant; loopCheck?: boolean }> = ({ variant }) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const create = useCallback(makeFactory(variant), [variant.id]);
  return <ThreeLook create={create} />;
};
