/**
 * Look 2 — Card Rain (20s loop).
 * ~70 generic bank cards tumble down through space. Every card's fall is
 * periodic with a period dividing 600 and re-enters from above the frame;
 * tumbling uses whole turns per loop. Nothing is stored between frames.
 */
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { hexToSrgb01 } from "../lib/color";
import { loadFonts } from "../lib/fonts";
import { PostSettings } from "../lib/Post";
import { mulberry32 } from "../lib/random";
import { Stage, useAssets } from "../lib/Stage";
import { Colourway, drawBack, drawFace, toTexture } from "./cardTextures";

export type CardRainProps = {
  /** background (display sRGB). With chromaKey it is the exact key colour. */
  background: string;
  chromaKey: boolean;
  colourways: Colourway[];
  exposure: number;
  grain: number;
};

const LOOP = 600;
const FOV = 40;
const PITCH = (8 * Math.PI) / 180; // camera looks slightly up
const CARD_W = 1;
const CARD_H = 54 / 85.6;
const CARD_T = 0.8 / 85.6;
const CARD_R = 3.18 / 85.6;
const COUNT = 70;
const NEAR_D = 2.4;
const FAR_D = 9;
const ASPECT = 16 / 9;
const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);
const FOCUS = 4.5;

/** Card geometry with three groups: 0 = front face, 1 = back face, 2 = edge. */
const makeCardGeometry = () => {
  const s = new THREE.Shape();
  const w = CARD_W / 2;
  const h = CARD_H / 2;
  const r = CARD_R;
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h);
  s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h);
  s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r);
  s.quadraticCurveTo(-w, -h, -w + r, -h);
  const bevel = 0.0022;
  const ex = new THREE.ExtrudeGeometry(s, {
    depth: CARD_T - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 6,
  });
  ex.translate(0, 0, -(CARD_T - 2 * bevel) / 2);
  const src = ex.toNonIndexed();
  ex.dispose();
  src.computeVertexNormals();
  const pos = src.getAttribute("position");
  const nrm = src.getAttribute("normal");
  const buckets: { p: number[]; n: number[]; uv: number[] }[] = [0, 1, 2].map(() => ({ p: [], n: [], uv: [] }));
  const zf = CARD_T / 2 - 1e-5;
  for (let t = 0; t < pos.count; t += 3) {
    // classify by the triangle's z: flat caps at ±T/2 are faces, the rest is edge
    let zmin = Infinity;
    let zmax = -Infinity;
    for (let k = 0; k < 3; k++) {
      zmin = Math.min(zmin, pos.getZ(t + k));
      zmax = Math.max(zmax, pos.getZ(t + k));
    }
    const cat = zmin >= zf ? 0 : zmax <= -zf ? 1 : 2;
    const b = buckets[cat];
    for (let k = 0; k < 3; k++) {
      const x = pos.getX(t + k);
      const y = pos.getY(t + k);
      b.p.push(x, y, pos.getZ(t + k));
      b.n.push(nrm.getX(t + k), nrm.getY(t + k), nrm.getZ(t + k));
      let u = (x + w) / CARD_W;
      const v = (y + h) / CARD_H;
      if (cat === 1) u = 1 - u; // back reads correctly when the card is flipped
      b.uv.push(u, v);
    }
  }
  src.dispose();
  const g = new THREE.BufferGeometry();
  const P: number[] = [];
  const N: number[] = [];
  const U: number[] = [];
  let start = 0;
  buckets.forEach((b, i) => {
    P.push(...b.p);
    N.push(...b.n);
    U.push(...b.uv);
    g.addGroup(start, b.p.length / 3, i);
    start += b.p.length / 3;
  });
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  g.computeBoundingSphere();
  return g;
};

type Card = {
  depth: number;
  x: number;
  period: number;
  phase: number;
  drift: number;
  driftK: number;
  driftPh: number;
  rx0: number;
  ry0: number;
  rz0: number;
  kx: number;
  ky: number;
  kz: number;
  colour: number;
};

const PERIODS = [60, 75, 100, 120, 150, 200, 300];
// colourway weights: the first four (cool) colourways appear most often
const pickColour = (r: number, n: number) => {
  const w = Array.from({ length: n }, (_, i) => (i < 4 ? 2.2 : 1));
  const total = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += w[i] / total;
    if (r < acc) return i;
  }
  return n - 1;
};

const buildCards = (seed: number, colours: number): Card[] => {
  const rng = mulberry32(seed);
  const cards: Card[] = [];
  for (let i = 0; i < COUNT; i++) {
    // biased toward far: only a handful of cards pass close to the lens
    const u = Math.pow(rng(), 0.75);
    const depth = NEAR_D * Math.pow(FAR_D / NEAR_D, u);
    const halfH = depth * TAN;
    const margin = 0.62 + 0.06 * (FAR_D / depth);
    // frames to cross one screen height ≈ 120; choose a divisor of 600
    const want = 125 * ((halfH + margin) / halfH) * (0.8 + 0.4 * rng());
    let period = PERIODS[0];
    for (const p of PERIODS) if (Math.abs(p - want) < Math.abs(period - want)) period = p;
    const sgn = () => (rng() < 0.5 ? -1 : 1);
    cards.push({
      depth,
      x: (rng() * 2.9 - 1.45) * halfH * ASPECT,
      period,
      phase: rng(),
      drift: (0.05 + 0.1 * rng()) * halfH,
      driftK: 1 + Math.floor(rng() * 2),
      driftPh: rng() * Math.PI * 2,
      rx0: rng() * Math.PI * 2,
      ry0: rng() * Math.PI * 2,
      rz0: rng() * Math.PI * 2,
      kx: sgn() * (1 + Math.floor(rng() * 3)),
      ky: sgn() * (1 + Math.floor(rng() * 2)),
      kz: sgn() * Math.floor(rng() * 2),
      colour: pickColour(rng(), colours),
    });
  }
  // far cards first, so transparent-free sorting is irrelevant but stable
  return cards.sort((a, b) => b.depth - a.depth);
};

type Assets = { faces: THREE.Texture[]; backs: THREE.Texture[] };

const Scene: React.FC<CardRainProps & { assets: Assets }> = ({ assets, colourways }) => {
  const frame = useCurrentFrame();
  const { camera, gl, scene } = useThree();
  const cards = useMemo(() => buildCards(3756657915, colourways.length), [colourways.length]);
  const geo = useMemo(makeCardGeometry, []);

  const env = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const rt = pm.fromScene(new RoomEnvironment(), 0.03);
    pm.dispose();
    return rt;
  }, [gl]);
  useLayoutEffect(() => {
    scene.environment = env.texture;
    scene.environmentIntensity = 0.5;
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [scene, env]);

  const materials = useMemo(
    () =>
      colourways.map((cw, i) => {
        const common = {
          roughness: cw.metal ? 0.3 : 0.25,
          metalness: cw.metal ? 0.55 : 0.0,
          clearcoat: 1,
          clearcoatRoughness: 0.06,
        };
        return [
          new THREE.MeshPhysicalMaterial({ ...common, map: assets.faces[i] }),
          new THREE.MeshPhysicalMaterial({ ...common, map: assets.backs[i] }),
          new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(cw.a).lerp(new THREE.Color("#ffffff"), 0.45),
            roughness: 0.2,
            metalness: 0,
            clearcoat: 1,
          }),
        ];
      }),
    [colourways, assets],
  );

  const { group, meshes } = useMemo(() => {
    const group = new THREE.Group();
    const meshes = cards.map((c) => {
      const m = new THREE.Mesh(geo, materials[c.colour]);
      m.frustumCulled = false;
      group.add(m);
      return m;
    });
    // lights for glints across the glossy faces
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(-3, 5, 4);
    const fill = new THREE.DirectionalLight(0xbfd6ff, 0.8);
    fill.position.set(4, -2, 3);
    group.add(key, fill);
    return { group, meshes };
  }, [cards, geo, materials]);

  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = FOV;
    cam.near = 0.5;
    cam.far = 60;
    cam.position.set(0, 0, 0);
    cam.rotation.set(PITCH, 0, 0);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    // the card field lives in camera space (x right, y up, -z forward)
    group.quaternion.copy(cam.quaternion);
    const T = (2 * Math.PI * frame) / LOOP;
    cards.forEach((c, i) => {
      const halfH = c.depth * TAN;
      const margin = 0.62 + 0.06 * (FAR_D / c.depth);
      const top = halfH + margin;
      const f = (((frame / c.period + c.phase) % 1) + 1) % 1;
      const y = top - f * 2 * top;
      const x = c.x + c.drift * Math.sin(c.driftK * T + c.driftPh);
      const m = meshes[i];
      m.position.set(x, y, -c.depth);
      // tumble on two axes: whole turns in the card plane plus a wide periodic tilt
      m.rotation.set(1.35 * Math.sin(c.kx * T + c.rx0), 0.8 * Math.sin(c.ky * T + c.ry0), c.rz0 + (c.kz === 0 ? Math.sign(c.kx) : c.kz) * T, "YXZ");
    });
  }, [frame, cards, meshes, camera, group]);

  return <primitive object={group} />;
};

export const CardRain: React.FC<CardRainProps> = (props) => {
  const assets = useAssets<Assets>("card textures", async () => {
    await loadFonts();
    return {
      faces: props.colourways.map((c) => toTexture(drawFace(c))),
      backs: props.colourways.map((c) => toTexture(drawBack(c))),
    };
  });
  const post: PostSettings = useMemo(
    () => ({
      exposure: props.exposure,
      toneMap: "aces",
      dof: { focus: FOCUS, aperture: 0.24, maxBlur: 0.02, nearScale: 2.0 },
      bloom: { strength: 0.08, threshold: 2.5, knee: 0.4, radius: 0.85 },
      grain: props.grain,
      grainFloor: 0.03,
      dither: true,
      vignette: 0,
      key: props.chromaKey ? hexToSrgb01(props.background) : undefined,
      clear: [0, 0, 0],
      noisePeriod: LOOP,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.exposure, props.grain, props.chromaKey, props.background],
  );
  if (!assets) return <AbsoluteFill style={{ backgroundColor: props.background }} />;
  return (
    <Stage background={props.background} post={post} camera={{ fov: FOV, near: 0.5, far: 60 }}>
      <Scene {...props} assets={assets} />
    </Stage>
  );
};
