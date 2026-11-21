import * as THREE from "three";
import { BARREL, CAMERA, LAYOUT, type Palette } from "../config";
import { ATMOSPHERE, LIGHT, SURFACE } from "../look";
import { mulberry32, range } from "../lib/random";
import type { World } from "../three/Stage";
import { buildBarrelTextures } from "./barrelTextures";

const deg = THREE.MathUtils.degToRad;

/** Drum silhouette (radius, height), revolved into a lathe: rims, two rolling hoops. */
const barrelProfile = () => {
  const { radius: R, height: H } = BARREL;
  const pts: THREE.Vector2[] = [];
  const add = (r: number, y: number) => pts.push(new THREE.Vector2(r, y));
  const rim = (y0: number, dir: 1 | -1) => {
    // rolled chime: a small bead standing proud of the body
    const beadR = 0.011;
    const cy = y0 + dir * beadR;
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (i / steps) * Math.PI;
      const yy = cy + dir * Math.sin(a) * beadR;
      add(R + 0.004 + Math.cos(a) * beadR * 0.9, yy);
    }
  };
  const hoop = (yc: number) => {
    const half = 0.02;
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      add(R + 0.011 * 0.5 * (1 - Math.cos(t * Math.PI * 2)), yc - half + t * half * 2);
    }
  };
  const body = (y0: number, y1: number) => {
    const steps = 6;
    for (let i = 1; i < steps; i++) add(R, y0 + ((y1 - y0) * i) / steps);
  };
  const hoops = [...BARREL.hoopsFromTop].map((f) => H * (1 - f)).sort((a, b) => a - b);
  add(R - 0.02, 0.001);
  rim(0, 1);
  add(R, 0.03);
  body(0.03, hoops[0] - 0.02);
  hoop(hoops[0]);
  body(hoops[0] + 0.02, hoops[1] - 0.02);
  hoop(hoops[1]);
  body(hoops[1] + 0.02, H - 0.03);
  add(R, H - 0.03);
  const top: THREE.Vector2[] = [];
  const mark = pts.length;
  rim(H, -1);
  // rim() for the top was generated top-down; reverse that part so y keeps rising
  top.push(...pts.splice(mark));
  pts.push(...top.reverse());
  add(R - 0.02, H - 0.001);
  return pts;
};

const buildBarrelGeometry = () => {
  const geo = new THREE.LatheGeometry(barrelProfile(), BARREL.radialSegments);
  // v follows physical height, so markings land where config.ts puts them
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setY(i, pos.getY(i) / BARREL.height);
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  // weld the seam normals (first and last column share positions)
  const n = geo.attributes.normal;
  const cols = BARREL.radialSegments + 1;
  const rows = pos.count / cols;
  for (let j = 0; j < rows; j++) {
    const a = j;
    const b = BARREL.radialSegments * rows + j;
    const nx = n.getX(a) + n.getX(b);
    const ny = n.getY(a) + n.getY(b);
    const nz = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(a, nx / l, ny / l, nz / l);
    n.setXYZ(b, nx / l, ny / l, nz / l);
  }
  n.needsUpdate = true;
  return geo;
};

export type Stack = { x: number; z: number; hero: boolean; levels: number; row: number };

/** Hex-packed block of stacks; the hero stack sits on the corner nearest the camera. */
export const buildLayout = (): Stack[] => {
  const s = LAYOUT.spacing;
  const aL = [Math.cos(deg(LAYOUT.leftAngleDeg)) * s, -Math.sin(deg(LAYOUT.leftAngleDeg)) * s];
  const aR = [Math.cos(deg(LAYOUT.rightAngleDeg)) * s, -Math.sin(deg(LAYOUT.rightAngleDeg)) * s];
  const stacks: Stack[] = [];
  for (let i = 0; i < LAYOUT.rowLeft; i++) {
    for (let j = 0; j < LAYOUT.rowRight; j++) {
      stacks.push({
        x: i * aL[0] + j * aR[0],
        z: i * aL[1] + j * aR[1],
        hero: i === 0 && j === 0,
        row: i,
        levels: i === LAYOUT.rowLeft - 1 && LAYOUT.rowLeft > 2 ? LAYOUT.outerLeftLevels : LAYOUT.levels,
      });
    }
  }
  return stacks;
};

/** Gradient sky with a soft sun glow, used only to light the scene (PMREM). */
const buildEnvScene = (palette: Palette, sunDir: THREE.Vector3) => {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new THREE.Color(palette.fillSky) },
      uHorizon: { value: new THREE.Color(palette.fillHorizon) },
      uGround: { value: new THREE.Color(palette.ground) },
      uSun: { value: new THREE.Color(LIGHT.key.color) },
      uSunDir: { value: sunDir.clone().normalize() },
      uSunGlow: { value: LIGHT.env.sunGlow },
      uStrip: { value: new THREE.Vector2(deg(LIGHT.env.stripWidthDeg), deg(LIGHT.env.stripHeightDeg)) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround; uniform vec3 uSun;
      uniform vec3 uSunDir; uniform float uSunGlow; uniform vec2 uStrip;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 sky = mix(uHorizon, uZenith, pow(clamp(d.y, 0.0, 1.0), 0.45));
        vec3 gnd = mix(uHorizon * 0.6, uGround, pow(clamp(-d.y * 2.5, 0.0, 1.0), 0.6));
        vec3 col = d.y >= 0.0 ? sky : gnd;
        // tall, narrow glow around the key light: the strip the drums mirror
        float dAz = atan(d.x, d.z) - atan(uSunDir.x, uSunDir.z);
        dAz = atan(sin(dAz), cos(dAz));
        float dEl = asin(clamp(d.y, -1.0, 1.0)) - asin(clamp(uSunDir.y, -1.0, 1.0));
        float strip = exp(-pow(dAz / uStrip.x, 2.0)) * exp(-pow(dEl / uStrip.y, 2.0));
        float s = max(dot(d, uSunDir), 0.0);
        col += uSun * uSunGlow * (strip * 3.0 + pow(s, 6.0) * 0.25);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), mat));
  return { scene, dispose: () => mat.dispose() };
};

export const buildBarrelWorld = (palette: Palette): World => {
  const rnd = mulberry32(LAYOUT.seed);
  const root = new THREE.Group();
  const stacks = buildLayout();
  const H = BARREL.height;

  // ---- drums ------------------------------------------------------------------
  const geometry = buildBarrelGeometry();
  const tex = buildBarrelTextures(palette);
  const material = new THREE.MeshPhysicalMaterial({
    ior: SURFACE.ior,
    clearcoat: SURFACE.clearcoat,
    clearcoatRoughness: SURFACE.clearcoatRoughness,
    map: tex.map,
    roughnessMap: tex.roughnessMap,
    roughness: 1,
    metalness: 0,
    normalMap: tex.normalMap,
    normalScale: new THREE.Vector2(SURFACE.normalScale, SURFACE.normalScale),
    envMapIntensity: SURFACE.envMapIntensity,
  });

  // Analytic sky-light occlusion: each drum knows the directions of its
  // touching neighbours and darkens the sides that face them.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uOccStrength = { value: LIGHT.occlusion.strength };
    shader.uniforms.uOccPower = { value: LIGHT.occlusion.power };
    shader.uniforms.uBounce = { value: LIGHT.bounce };
    shader.uniforms.uSunBounce = {
      value: new THREE.Color(palette.paint)
        .multiply(new THREE.Color(LIGHT.key.color))
        .multiplyScalar(LIGHT.sunBounce),
    };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         attribute vec4 aNbrA; attribute vec4 aNbrB; attribute vec4 aNbrC;
         attribute vec3 aLitA; attribute vec3 aLitB;
         uniform float uOccStrength; uniform float uOccPower;
         varying float vSkyAO; varying float vSunBounce;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         {
           vec3 wn = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
           vec2 nh = wn.xz / max(length(wn.xz), 1e-4);
           float ao = 1.0;
           ao *= 1.0 - uOccStrength * pow(max(dot(nh, aNbrA.xy), 0.0), uOccPower);
           ao *= 1.0 - uOccStrength * pow(max(dot(nh, aNbrA.zw), 0.0), uOccPower);
           ao *= 1.0 - uOccStrength * pow(max(dot(nh, aNbrB.xy), 0.0), uOccPower);
           ao *= 1.0 - uOccStrength * pow(max(dot(nh, aNbrB.zw), 0.0), uOccPower);
           ao *= 1.0 - uOccStrength * pow(max(dot(nh, aNbrC.xy), 0.0), uOccPower);
           ao *= 1.0 - uOccStrength * pow(max(dot(nh, aNbrC.zw), 0.0), uOccPower);
           vSkyAO = ao;
           float bn = 0.0;
           bn += aLitA.x * pow(max(dot(nh, aNbrA.xy), 0.0), 1.2);
           bn += aLitA.y * pow(max(dot(nh, aNbrA.zw), 0.0), 1.2);
           bn += aLitA.z * pow(max(dot(nh, aNbrB.xy), 0.0), 1.2);
           bn += aLitB.x * pow(max(dot(nh, aNbrB.zw), 0.0), 1.2);
           bn += aLitB.y * pow(max(dot(nh, aNbrC.xy), 0.0), 1.2);
           bn += aLitB.z * pow(max(dot(nh, aNbrC.zw), 0.0), 1.2);
           vSunBounce = bn;
         }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         varying float vSkyAO; varying float vSunBounce;
         uniform float uBounce; uniform vec3 uSunBounce;`,
      )
      .replace(
        "#include <aomap_fragment>",
        `{
           float skyAO = clamp(vSkyAO, 0.0, 1.0);
           reflectedLight.indirectDiffuse *= skyAO;
           reflectedLight.indirectSpecular *= skyAO * skyAO;
           // a little paint-coloured light bounced between neighbouring drums
           reflectedLight.indirectDiffuse += diffuseColor.rgb * uBounce * (1.0 - skyAO);
           // sunlit paint on a neighbouring drum throws coloured light back at us
           reflectedLight.indirectDiffuse += diffuseColor.rgb * uSunBounce * vSunBounce;
         }`,
      );
  };
  material.customProgramCacheKey = () => "barrel-sky-ao";

  const count = stacks.reduce((n, st) => n + st.levels, 0);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  const nbr = [new Float32Array(count * 4), new Float32Array(count * 4), new Float32Array(count * 4)];
  const litA = new Float32Array(count * 3);
  const litB = new Float32Array(count * 3);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const tint = new THREE.Color();
  let idx = 0;
  // Draw order = instance order. Nearest drums first, so the depth test rejects
  // hidden fragments before they are shaded (the scene is static, so one sort is enough).
  const camMidY = (CAMERA.yStart + CAMERA.yEnd) / 2;
  const levelOrder = Array.from({ length: LAYOUT.levels }, (_, l) => l).sort(
    (a, b) => Math.abs((a + 0.5) * H - camMidY) - Math.abs((b + 0.5) * H - camMidY),
  );
  const ordered = [...stacks].sort(
    (a, b) =>
      Math.hypot(a.x - CAMERA.x, a.z - CAMERA.z) - Math.hypot(b.x - CAMERA.x, b.z - CAMERA.z),
  );
  const sunH = new THREE.Vector2(-Math.sin(deg(LIGHT.key.azimuthDeg)), Math.cos(deg(LIGHT.key.azimuthDeg)));
  const sunReach = (LAYOUT.levels * H * 0.5) / Math.tan(deg(LIGHT.key.elevationDeg));
  for (const st of ordered) {
    // unit directions to every touching neighbour (up to six in a hex pack)
    const dirs: number[] = [];
    // ...and, for each neighbour, how much sunlit paint faces this drum
    // (0 when that side of the neighbour is turned away from the sun or shadowed)
    const lit: number[] = [];
    for (const o of stacks) {
      if (o === st) continue;
      const dx = o.x - st.x;
      const dz = o.z - st.z;
      const d = Math.hypot(dx, dz);
      if (d >= LAYOUT.spacing * 1.3) continue;
      dirs.push(dx / d, dz / d);
      const facing = Math.max(0, (-dx / d) * sunH.x + (-dz / d) * sunH.y);
      // point on the neighbour that faces us; walk towards the sun and look for blockers
      const px = o.x - (dx / d) * BARREL.radius;
      const pz = o.z - (dz / d) * BARREL.radius;
      let blocked = false;
      for (const b of stacks) {
        if (b === o) continue;
        const t = (b.x - px) * sunH.x + (b.z - pz) * sunH.y;
        if (t <= 0 || t > sunReach) continue;
        const perp = Math.abs((b.x - px) * sunH.y - (b.z - pz) * sunH.x);
        if (perp < BARREL.radius * 0.9) blocked = true;
      }
      lit.push(blocked ? 0 : facing);
    }
    while (dirs.length < 12) dirs.push(0);
    while (lit.length < 6) lit.push(0);
    // markings face the camera, give or take
    const toCam = Math.atan2(CAMERA.x - st.x, CAMERA.z - st.z);
    for (const level of levelOrder) {
      if (level >= st.levels) continue;
      const jitterDeg = st.hero
        ? LAYOUT.heroFacingDeg[level % LAYOUT.heroFacingDeg.length]
        : range(rnd, -LAYOUT.facingJitterDeg, LAYOUT.facingJitterDeg);
      // markings are centred at u = 0.25 (+x in drum space); see barrelTextures
      const rotY = toCam - Math.PI / 2 + deg(jitterDeg) + (rnd() < 0.5 ? Math.PI : 0);
      e.set(range(rnd, -0.004, 0.004), rotY, range(rnd, -0.004, 0.004));
      q.setFromEuler(e);
      m4.compose(
        new THREE.Vector3(st.x + range(rnd, -0.006, 0.006), level * H, st.z + range(rnd, -0.006, 0.006)),
        q,
        new THREE.Vector3(1, 1, 1),
      );
      mesh.setMatrixAt(idx, m4);
      // drums differ a little in shade; the rows behind the hero stack are an older, warmer batch
      const v = range(rnd, 0.9, 1.04) * (st.row > 0 ? LAYOUT.backRowShade : 1);
      const warm = st.row > 0 ? LAYOUT.backRowWarmth : 1;
      tint.setRGB(v * range(rnd, 0.98, 1.04), v * warm, v * warm * warm * range(rnd, 0.9, 1.0));
      mesh.setColorAt(idx, tint);
      for (let k = 0; k < 3; k++) nbr[k].set(dirs.slice(k * 4, k * 4 + 4), idx * 4);
      litA.set(lit.slice(0, 3), idx * 3);
      litB.set(lit.slice(3, 6), idx * 3);
      idx++;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  geometry.setAttribute("aNbrA", new THREE.InstancedBufferAttribute(nbr[0], 4));
  geometry.setAttribute("aNbrB", new THREE.InstancedBufferAttribute(nbr[1], 4));
  geometry.setAttribute("aNbrC", new THREE.InstancedBufferAttribute(nbr[2], 4));
  geometry.setAttribute("aLitA", new THREE.InstancedBufferAttribute(litA, 3));
  geometry.setAttribute("aLitB", new THREE.InstancedBufferAttribute(litB, 3));
  root.add(mesh);

  // ---- key light: a small cluster of suns gives soft-edged shadows ----------------
  const az = deg(LIGHT.key.azimuthDeg);
  const el = deg(LIGHT.key.elevationDeg);
  // camera looks along -z; camera-left is -x
  const sunDir = new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const centre = new THREE.Vector3(1.4, (LAYOUT.levels * H) / 2, -1.6);
  const n = LIGHT.key.samples;
  for (let i = 0; i < n; i++) {
    // The key is a tall strip (low sun through a slot): samples are stacked in
    // elevation, so every drum mirrors a full-height streak, and staggered a
    // little sideways for soft shadow edges.
    const eli = el + deg(LIGHT.key.elevationSpreadDeg) * ((2 * (i + 0.5)) / n - 1);
    const azi = az + deg(LIGHT.key.softnessDeg) * ((i % 2) * 2 - 1) * 0.5;
    const dir = new THREE.Vector3(
      -Math.sin(azi) * Math.cos(eli),
      Math.sin(eli),
      Math.cos(azi) * Math.cos(eli),
    );
    const light = new THREE.DirectionalLight(LIGHT.key.color, LIGHT.key.intensity / n);
    light.position.copy(centre).addScaledVector(dir, 14);
    light.target.position.copy(centre);
    light.castShadow = true;
    light.shadow.mapSize.set(LIGHT.key.shadowMapSize, LIGHT.key.shadowMapSize);
    const cam = light.shadow.camera;
    cam.left = -5.2;
    cam.right = 5.2;
    cam.top = 4.2;
    cam.bottom = -4.2;
    cam.near = 2;
    cam.far = 28;
    cam.updateProjectionMatrix();
    light.shadow.bias = -0.0006;
    light.shadow.normalBias = 0.012;
    light.shadow.radius = 2.5;
    root.add(light);
    root.add(light.target);
  }

  const env = buildEnvScene(palette, sunDir);
  const background = new THREE.Color(palette.skyZenith).multiplyScalar(LIGHT.skyBackdrop);
  const fog = new THREE.FogExp2(new THREE.Color(palette.haze).getHex(), ATMOSPHERE.fogDensity);

  return {
    root,
    background,
    fog,
    envScene: env.scene,
    envIntensity: LIGHT.env.intensity,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      tex.dispose();
      env.dispose();
      mesh.dispose();
    },
  };
};
