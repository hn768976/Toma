import * as THREE from "three";
import { Palette } from "./palette";
import { Timeline } from "./timeline";
import { HAIR_COMMON } from "./glsl";

// The strand is a circular arc in the XY plane passing through the origin.
const ARC_RADIUS = 30;
const HALF_LENGTH = 17;
export const HAIR_RADIUS = 1;
/** screen-space direction of the strand at the contact point (60° from horizontal) */
export const HAIR_TILT = THREE.MathUtils.degToRad(62);

const LENGTH_SEGMENTS = 900;
const RADIAL_SEGMENTS = 144;

const buildGeometry = () => {
  const vertexCount = (LENGTH_SEGMENTS + 1) * (RADIAL_SEGMENTS + 1);
  const axis = new Float32Array(vertexCount * 3);
  const e1 = new Float32Array(vertexCount * 3);
  const sa = new Float32Array(vertexCount * 2);

  // arc centre lies to the lower right of the strand
  const cx = ARC_RADIUS * Math.sin(HAIR_TILT);
  const cy = -ARC_RADIUS * Math.cos(HAIR_TILT);
  const phi0 = Math.PI / 2 + HAIR_TILT;

  let v = 0;
  for (let i = 0; i <= LENGTH_SEGMENTS; i++) {
    const s = (i / LENGTH_SEGMENTS - 0.5) * 2 * HALF_LENGTH;
    const phi = phi0 - s / ARC_RADIUS;
    const ex = Math.cos(phi);
    const ey = Math.sin(phi);
    for (let j = 0; j <= RADIAL_SEGMENTS; j++) {
      // seam at the back of the strand (a = -PI/2), away from the camera
      const a = -Math.PI / 2 + (j / RADIAL_SEGMENTS) * Math.PI * 2;
      axis[v * 3] = cx + ARC_RADIUS * ex;
      axis[v * 3 + 1] = cy + ARC_RADIUS * ey;
      axis[v * 3 + 2] = 0;
      e1[v * 3] = ex;
      e1[v * 3 + 1] = ey;
      e1[v * 3 + 2] = 0;
      sa[v * 2] = s;
      sa[v * 2 + 1] = a;
      v++;
    }
  }

  const indices: number[] = [];
  const row = RADIAL_SEGMENTS + 1;
  for (let i = 0; i < LENGTH_SEGMENTS; i++) {
    for (let j = 0; j < RADIAL_SEGMENTS; j++) {
      const a = i * row + j;
      const b = a + row;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(axis, 3));
  geometry.setAttribute("aE1", new THREE.BufferAttribute(e1, 3));
  geometry.setAttribute("aSA", new THREE.BufferAttribute(sa, 2));
  geometry.setIndex(indices);
  return geometry;
};

export const createHair = (palette: Palette) => {
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uRepairFront: { value: 0 },
      uContactS: { value: 0.15 },
      uRadius: { value: HAIR_RADIUS },
      uBump: { value: 0.11 },
      uGridStrength: { value: 0 },
      uGridFront: { value: 0 },
      uExposure: { value: 1 },
      uCuticleLight: { value: 1 },
      uCameraPos: { value: new THREE.Vector3() },
      uDropPos: { value: new THREE.Vector3() },
      uDropGlow: { value: 0 },
      uCuticleA: { value: new THREE.Color(palette.cuticleA) },
      uCuticleB: { value: new THREE.Color(palette.cuticleB) },
      uSmoothBase: { value: new THREE.Color(palette.smoothBase) },
      uSheen: { value: new THREE.Color(palette.sheen) },
      uGlow: { value: new THREE.Color(palette.glow) },
      uGlowHot: { value: new THREE.Color(palette.glowHot) },
    },
    vertexShader: /* glsl */ `
      ${HAIR_COMMON}
      uniform float uRadius;
      uniform float uBump;
      attribute vec3 aE1;
      attribute vec2 aSA;
      varying vec3 vWorld;
      varying vec3 vE1;
      varying vec2 vSA;

      void main() {
        float s = aSA.x;
        float a = aSA.y;
        vec3 n = cos(a) * aE1 + sin(a) * vec3(0.0, 0.0, 1.0);
        float damaged = 1.0 - repairMask(s, a);
        // repaired hair is very slightly slimmer: the cuticle lies flat again
        float r = uRadius * (0.97 + 0.03 * damaged) + uBump * cuticleHeight(s, a) * damaged;
        vec3 p = position + n * r;
        vWorld = p;
        vE1 = aE1;
        vSA = aSA;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${HAIR_COMMON}
      uniform float uBump;
      uniform float uGridStrength;
      uniform float uGridFront;
      uniform float uExposure;
      uniform float uCuticleLight;
      uniform vec3 uCameraPos;
      uniform vec3 uDropPos;
      uniform float uDropGlow;
      uniform vec3 uCuticleA;
      uniform vec3 uCuticleB;
      uniform vec3 uSmoothBase;
      uniform vec3 uSheen;
      uniform vec3 uGlow;
      uniform vec3 uGlowHot;
      varying vec3 vWorld;
      varying vec3 vE1;
      varying vec2 vSA;

      float gridLine(float x, float width) {
        float d = abs(fract(x - 0.5) - 0.5);
        float w = fwidth(x);
        return 1.0 - smoothstep(width * w, (width + 1.6) * w, d);
      }

      void main() {
        float s = vSA.x;
        float a = vSA.y;
        vec3 e1 = normalize(vE1);
        vec3 ez = vec3(0.0, 0.0, 1.0);
        vec3 N = cos(a) * e1 + sin(a) * ez;        // radial normal
        vec3 B = -sin(a) * e1 + cos(a) * ez;       // around the strand
        vec3 T = vec3(e1.y, -e1.x, 0.0);           // along the strand
        vec3 V = normalize(uCameraPos - vWorld);

        vec3 L1 = normalize(vec3(-0.62, 0.42, 0.66)); // key, upper left
        vec3 L2 = normalize(vec3(0.85, -0.25, 0.25)); // rim, right
        vec3 H1 = normalize(L1 + V);
        vec3 H2 = normalize(L2 + V);

        float dist = repairDistance(s, a);
        float repaired = repairMask(s, a);

        // ---------------- damaged cuticle ----------------
        float e = 0.012;
        float h0 = cuticleHeight(s, a);
        float hs = cuticleHeight(s + e, a);
        float ha = cuticleHeight(s, a + e);
        vec3 Nd = normalize(N - uBump * 4.2 * ((hs - h0) / e * T + (ha - h0) / e * B));
        float grain = vnoise(vec3(cos(a) * 6.0, sin(a) * 6.0, s * 3.0));
        float fibre = vnoise(vec3(cos(a) * 34.0, sin(a) * 34.0, s * 1.4));
        vec3 albedo = mix(uCuticleB, uCuticleA, clamp(0.15 * grain + 0.85 * smoothstep(0.08, 0.6, h0), 0.0, 1.0));
        albedo *= 0.8 + 0.4 * fibre;
        float crevice = 0.3 + 0.7 * smoothstep(0.0, 0.45, h0);
        float diff = max(dot(Nd, L1), 0.0);
        vec3 damaged = albedo * crevice * (0.18 + 1.0 * diff);
        damaged += albedo * 0.35 * pow(max(dot(Nd, H1), 0.0), 18.0);
        damaged += albedo * 0.25 * pow(max(dot(Nd, L2), 0.0), 2.0);

        // ---------------- repaired, glossy strand ----------------
        float nh1 = max(dot(N, H1), 0.0);
        float nh2 = max(dot(N, H2), 0.0);
        float streak = 0.75 + 0.25 * vnoise(vec3(s * 0.9, a * 9.0, 1.0));
        vec3 glossy = uSmoothBase;
        glossy += uSheen * 0.06 * pow(nh1, 16.0);
        glossy += uSheen * 0.16 * pow(nh1, 130.0);
        glossy += uSheen * 1.15 * pow(nh1, 420.0) * streak;
        glossy += uSheen * 0.5 * pow(nh2, 160.0);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        glossy += uSheen * 0.1 * fres;

        damaged *= uCuticleLight;
        vec3 col = mix(damaged, glossy, repaired);

        // ---------------- serum glow on the strand ----------------
        float dd = distance(vWorld, uDropPos);
        col += uGlow * uDropGlow * 0.22 * exp(-dd * dd * 0.3) * (0.1 + 0.9 * (1.0 - repaired));

        // ---------------- energy line at the repair front ----------------
        if (uRepairFront > 0.0) {
          float lineCore = exp(-pow(dist / 0.02, 2.0));
          float lineHalo = exp(-pow(dist / 0.14, 2.0));
          float flicker = 0.75 + 0.5 * vnoise(vec3(cos(a) * 3.0, sin(a) * 3.0, uRepairFront * 3.0));
          col += mix(uGlow, uGlowHot, 0.6) * lineCore * 1.05 * flicker;
          col += uGlow * lineHalo * 0.16;
          // warm afterglow just behind the front
          col += uGlow * 0.07 * repaired * exp(-pow((dist + 0.3) / 0.9, 2.0));
        }

        // ---------------- analysis grid ----------------
        if (uGridStrength > 0.0) {
          float behind = smoothstep(0.0, 1.6, uGridFront - abs(s - uContactS)) * repaired;
          float g = max(gridLine(s / 0.25, 1.0), gridLine(a / 6.28318530718 * 28.0, 1.0));
          float lit = 0.95 + 1.3 * pow(nh1, 8.0) + 2.4 * pow(nh1, 220.0);
          vec3 gridCol = mix(uGlow, uGlowHot, clamp(0.45 + pow(nh1, 30.0) * 1.3, 0.0, 1.0));
          col += gridCol * g * lit * behind * uGridStrength;
          // golden haze inside the cells and a hot rim on the silhouette
          col += uGlow * 0.012 * (0.4 + pow(nh1, 3.0)) * behind * uGridStrength;
          col += uGlow * 0.8 * pow(fres, 3.0) * behind * uGridStrength;
        }

        gl_FragColor = vec4(col * uExposure, 1.0);
      }
    `,
  });

  const geometry = buildGeometry();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;

  return {
    mesh,
    update: (
      tl: Timeline,
      dropPosition: THREE.Vector3,
      cameraPosition: THREE.Vector3,
    ) => {
      const u = material.uniforms;
      u.uRepairFront.value = tl.repairFront;
      u.uGridStrength.value = tl.gridStrength;
      u.uGridFront.value = tl.gridFront;
      u.uExposure.value = tl.exposure;
      u.uCuticleLight.value = tl.cuticleLight;
      u.uCameraPos.value.copy(cameraPosition);
      u.uDropPos.value.copy(dropPosition);
      u.uDropGlow.value = tl.haloStrength;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
};
