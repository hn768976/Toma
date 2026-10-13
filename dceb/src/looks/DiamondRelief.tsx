/**
 * Look 1 — Diamond Relief (20s loop).
 * A plane of 45°-rotated square tiles seen from ~35° above. In one lower
 * corner the tiles rise and sink (periodic over 600 frames); the relief fades
 * to a flush surface toward the opposite corner, leaving copy space.
 */
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { PostSettings } from "../lib/Post";
import { mulberry32 } from "../lib/random";
import { Stage } from "../lib/Stage";

export type DiamondReliefProps = {
  /** surface colour (display sRGB hex) */
  surface: string;
  /** colour of the ambient fill, tints the shadows */
  shadowTint: string;
  /** relief corner: lower right (false) or lower left (true, mirrored) */
  mirror: boolean;
  /** rim light strength for the dark version */
  rim: number;
  keyIntensity: number;
  areaIntensity: number;
  ambient: number;
  exposure: number;
  /** brightness at the far end of the copy-space gradient */
  gradientLow: number;
  grain: number;
  background: string;
};

const LOOP = 600;
const TILE = 1; // tile side, world units
const THICK = 0.06 * TILE; // max rise ~ slab thickness scale
const BEVEL_INSET = 0.035;
const BEVEL_DEPTH = 0.012;
const COLUMN = 0.4; // wall depth below the top
const SIDE_INSET = 0.992;
const WALL_DROP = 0.004; // wall tops sit just under the top faces: no coplanar z-fight

// camera framing (before mirroring)
const TARGET = new THREE.Vector3(0, 0, 0);
const ELEV = (30 * Math.PI) / 180; // brief: ~35°; 30° matches the reference's flatter diamonds
const DIST = 13.2;
const FOV = 30;

/** Non-indexed tile geometry: top, 4 bevel faces (animated), 4 sides. */
const makeTileGeometry = () => {
  const pos: number[] = [];
  const nrm: number[] = [];
  const low: number[] = [];
  const dir: number[] = [];
  const h = TILE / 2;
  const i = h - BEVEL_INSET;
  const push = (
    v: [number, number, number][],
    n: [number, number, number],
    lows: number[],
    d: [number, number, number],
  ) => {
    // two triangles (0,1,2) (0,2,3), counter-clockwise seen from outside
    const idx = [0, 1, 2, 0, 2, 3];
    for (const k of idx) {
      pos.push(...v[k]);
      nrm.push(...n);
      low.push(lows[k]);
      dir.push(...d);
    }
  };
  // top (y = 0), CCW seen from +y
  push(
    [
      [-i, 0, i],
      [i, 0, i],
      [i, 0, -i],
      [-i, 0, -i],
    ],
    [0, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0],
  );
  const sides: { d: [number, number, number]; a: [number, number]; b: [number, number]; ia: [number, number]; ib: [number, number] }[] = [
    { d: [0, 0, 1], a: [-h, h], b: [h, h], ia: [-i, i], ib: [i, i] },
    { d: [1, 0, 0], a: [h, h], b: [h, -h], ia: [i, i], ib: [i, -i] },
    { d: [0, 0, -1], a: [h, -h], b: [-h, -h], ia: [i, -i], ib: [-i, -i] },
    { d: [-1, 0, 0], a: [-h, -h], b: [-h, h], ia: [-i, -i], ib: [-i, i] },
  ];
  for (const s of sides) {
    // bevel: outer edge (a,b) lowered in the shader, inner edge (ib, ia) at top
    push(
      [
        [s.a[0], 0, s.a[1]],
        [s.b[0], 0, s.b[1]],
        [s.ib[0], 0, s.ib[1]],
        [s.ia[0], 0, s.ia[1]],
      ],
      [0, 1, 0],
      [1, 1, 0, 0],
      s.d,
    );
    // side: from the (lowered) outer edge down the column. Walls sit a hair
    // inside the top's outline so a flush neighbour's top always hides them.
    const k = SIDE_INSET;
    push(
      [
        [s.a[0] * k, -COLUMN, s.a[1] * k],
        [s.b[0] * k, -COLUMN, s.b[1] * k],
        [s.b[0] * k, -WALL_DROP, s.b[1] * k],
        [s.a[0] * k, -WALL_DROP, s.a[1] * k],
      ],
      s.d,
      [0, 0, 1, 1],
      [0, 0, 0],
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("bevelLow", new THREE.Float32BufferAttribute(low, 1));
  g.setAttribute("bevelDir", new THREE.Float32BufferAttribute(dir, 3));
  g.computeBoundingSphere();
  return g;
};

/** Base camera (no drift); used for the projected corner mask so it is fixed in the world. */
const baseCamera = (mirror: boolean) => {
  const c = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 80);
  c.position.set(0, Math.sin(ELEV) * DIST, Math.cos(ELEV) * DIST);
  c.lookAt(TARGET);
  c.updateMatrixWorld();
  void mirror;
  return c;
};

type Tile = { a: number; b: number; x: number; z: number; mask: number; phase: number; rate: number; amp: number; sink: number };
const GRID = 60; // lattice indices a, b in [-GRID, GRID]

const buildTiles = (mirror: boolean): Tile[] => {
  const cam = baseCamera(mirror);
  const rng = mulberry32(27100648);
  const tiles: Tile[] = [];
  const s = TILE / Math.SQRT2; // rotated-grid lattice step along x/z
  const v = new THREE.Vector3();
  for (let a = -GRID; a <= GRID; a++) {
    for (let b = -GRID; b <= GRID; b++) {
      // centres of a 45°-rotated square lattice
      const x = (a - b) * s;
      const z = (a + b) * s;
      v.set(x, 0, z).project(cam);
      if (v.x < -1.35 || v.x > 1.35 || v.y < -1.4 || v.y > 1.3 || v.z > 1) continue;
      // screen uv; corner at lower right (or lower left when mirrored)
      const u = (v.x + 1) / 2;
      const w = (v.y + 1) / 2;
      const du = mirror ? u : 1 - u;
      const d = Math.hypot(du * 1.0, w * 1.25);
      const mask = 1 - smooth(0.18, 0.95, d);
      if (mask <= 0.06) continue; // outside the relief zone the ground plane is the surface
      tiles.push({
        a,
        b,
        x,
        z,
        mask,
        phase: rng(),
        rate: [1, 2, 2, 3][Math.floor(rng() * 4)],
        amp: 0.55 + 0.45 * rng(),
        sink: rng(),
      });
    }
  }
  return tiles;
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Slow drifting field, periodic over LOOP frames (integer temporal harmonics). */
const field = (x: number, z: number, t: number) => {
  const p = (2 * Math.PI * t) / LOOP;
  return (
    0.5 * Math.sin(0.55 * x + 0.3 * z + p) +
    0.3 * Math.sin(-0.35 * x + 0.62 * z - 2 * p + 1.7) +
    0.2 * Math.sin(0.8 * x - 0.5 * z + p + 4.1)
  );
};

const heightAt = (tile: Tile, t: number) => {
  if (tile.mask <= 0.001) return 0;
  const p = (2 * Math.PI * t) / LOOP;
  const own = Math.sin(tile.rate * p + tile.phase * 2 * Math.PI);
  const s = 0.55 * own + 0.45 * field(tile.x, tile.z, t);
  // about a third of the zone's tiles can also sink below the surface
  const rise = smooth(0.3, 0.8, s) * tile.amp;
  const sink = tile.sink > 0.45 ? smooth(0.15, 0.65, -s) : 0;
  return tile.mask * THICK * 1.6 * (rise - sink);
};

const Scene: React.FC<DiamondReliefProps> = (p) => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const sx = p.mirror ? -1 : 1;

  const tiles = useMemo(() => buildTiles(p.mirror), [p.mirror]);

  const { mesh, material, iBevel } = useMemo(() => {
    const geo = makeTileGeometry();
    const iBevel = new THREE.InstancedBufferAttribute(new Float32Array(tiles.length), 1);
    geo.setAttribute("iBevel", iBevel);
    const material = new THREE.MeshStandardMaterial({ color: p.surface, roughness: 0.8, metalness: 0 });
    material.onBeforeCompile = (sh) => {
      sh.uniforms.uBevelDepth = { value: BEVEL_DEPTH };
      sh.uniforms.uBevelInset = { value: BEVEL_INSET };
      sh.vertexShader = sh.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute float bevelLow;\nattribute vec3 bevelDir;\nattribute float iBevel;\nuniform float uBevelDepth;\nuniform float uBevelInset;",
        )
        .replace(
          "#include <beginnormal_vertex>",
          "#include <beginnormal_vertex>\nif (dot(bevelDir, bevelDir) > 0.5) objectNormal = normalize(vec3(0.0, uBevelInset, 0.0) + bevelDir * uBevelDepth * iBevel);",
        )
        .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.y -= bevelLow * uBevelDepth * iBevel;");
    };
    const mesh = new THREE.InstancedMesh(geo, material, tiles.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return { mesh, material, iBevel };
  }, [tiles, p.surface]);

  const lights = useMemo(() => {
    RectAreaLightUniformsLib.init();
    const g = new THREE.Group();
    const key = new THREE.DirectionalLight(0xffffff, p.keyIntensity);
    key.position.set(-8 * sx, 10, -2);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -16;
    key.shadow.camera.right = 16;
    key.shadow.camera.top = 16;
    key.shadow.camera.bottom = -16;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 60;
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.01;
    g.add(key, key.target);
    // large soft area light over the copy-space side
    const area = new THREE.RectAreaLight(0xffffff, p.areaIntensity, 60, 40);
    area.position.set(-16 * sx, 30, -40);
    area.lookAt(4 * sx, 0, 6);
    g.add(area);
    const hemi = new THREE.HemisphereLight(0xffffff, new THREE.Color(p.shadowTint), p.ambient);
    g.add(hemi);
    if (p.rim > 0) {
      // grazing light from behind: catches the bevels/edges on the dark version
      const rim = new THREE.DirectionalLight(0xdfe8ff, p.rim);
      rim.position.set(-6 * sx, 2.2, -14);
      g.add(rim);
    }
    return g;
  }, [p.keyIntensity, p.areaIntensity, p.ambient, p.shadowTint, p.rim, sx]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
    // tiles overlap by a hair so float error never opens cracks between flush tiles
    const scl = new THREE.Vector3(1.004, 1, 1.004);
    const pos = new THREE.Vector3();
    const arr = iBevel.array as Float32Array;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const hgt = heightAt(t, frame);
      pos.set(t.x, hgt, t.z);
      // seams open slightly where the relief is (dark joints), closed where flush
      const k = 1.004 - 0.011 * smooth(0.06, 0.5, t.mask);
      scl.set(k, 1, k);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
      // bevels (seams) show where the relief is, fading out with the mask
      arr[i] = Math.min(1, Math.max(smooth(0.06, 0.6, t.mask) * 0.5, Math.abs(hgt) / (THICK * 0.5)));
    }
    mesh.instanceMatrix.needsUpdate = true;
    iBevel.needsUpdate = true;

    // camera: fixed, slight closed drift (±1°)
    const ph = (2 * Math.PI * frame) / LOOP;
    const yaw = ((1 * Math.PI) / 180) * Math.sin(ph);
    const pitch = ((0.6 * Math.PI) / 180) * Math.sin(2 * ph + 0.7);
    const el = ELEV + pitch;
    camera.position.set(Math.sin(yaw) * Math.cos(el) * DIST, Math.sin(el) * DIST, Math.cos(yaw) * Math.cos(el) * DIST);
    camera.fov = FOV;
    camera.near = 0.5;
    camera.far = 80;
    camera.lookAt(TARGET);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, [frame, tiles, mesh, iBevel, camera]);

  // Flush surface everywhere. Pushed back in depth so flush tiles (same
  // material, same normal) win the depth test and merge seamlessly with it.
  const ground = useMemo(() => {
    const g = new THREE.PlaneGeometry(400, 400);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    return m;
  }, [material]);
  // The ground has a hole wherever a relief tile exists (looked up in a flag
  // texture indexed by lattice cell), so sunken tiles reveal their
  // neighbours' walls instead of being covered by the plane.
  const holeTex = useMemo(() => {
    const n = 2 * GRID + 1;
    const data = new Uint8Array(n * n * 4);
    for (const t of tiles) data[((t.b + GRID) * n + (t.a + GRID)) * 4] = 255;
    const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }, [tiles]);
  const groundMat = useMemo(() => {
    const m = material.clone();
    m.onBeforeCompile = (sh) => {
      sh.uniforms.tHoles = { value: holeTex };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vGroundW;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvGroundW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>\nvarying vec3 vGroundW;\nuniform sampler2D tHoles;`)
        .replace(
          "void main() {",
          `void main() {
  {
    // lattice cell of a 45°-rotated unit square grid: x=(a-b)s, z=(a+b)s, s=1/sqrt2
    float a = floor((vGroundW.x + vGroundW.z) * 0.70710678 + 0.5);
    float b = floor((vGroundW.z - vGroundW.x) * 0.70710678 + 0.5);
    float n = ${2 * GRID + 1}.0;
    if (abs(a) <= ${GRID}.0 && abs(b) <= ${GRID}.0) {
      if (texture2D(tHoles, (vec2(a, b) + ${GRID}.0 + 0.5) / n).r > 0.5) discard;
    }
  }`,
        );
    };
    m.polygonOffset = true;
    m.polygonOffsetFactor = 1;
    m.polygonOffsetUnits = 4;
    return m;
  }, [material, holeTex]);
  ground.material = groundMat;

  // dark bed under the relief zone: what the open seams look down into
  const underlay = useMemo(() => {
    const g = new THREE.PlaneGeometry(400, 400);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(p.surface).multiplyScalar(0.55) }));
    m.position.y = -COLUMN + 0.01;
    return m;
  }, [p.surface]);

  useLayoutEffect(() => () => material.dispose(), [material]);

  return (
    <>
      <primitive object={ground} />
      <primitive object={underlay} />
      <primitive object={mesh} />
      <primitive object={lights} />
    </>
  );
};

export const DiamondRelief: React.FC<DiamondReliefProps> = (props) => {
  const post: PostSettings = useMemo(
    () => ({
      exposure: props.exposure,
      toneMap: "linear",
      ssao: { radius: 0.22, intensity: 0.7, power: 1.0 },
      grain: props.grain,
      dither: true,
      vignette: 0,
      // brighter toward the copy space (upper left, or upper right when mirrored)
      gradient: { origin: [props.mirror ? 0.9 : 0.1, 1.05], radius: 1.9, low: props.gradientLow },
      clear: [0.8, 0.8, 0.8],
      noisePeriod: LOOP,
    }),
    [props.exposure, props.grain, props.mirror, props.gradientLow],
  );
  return (
    <Stage background={props.background} post={post} camera={{ fov: FOV, near: 0.5, far: 80 }} shadows="soft">
      <Scene {...props} />
    </Stage>
  );
};
