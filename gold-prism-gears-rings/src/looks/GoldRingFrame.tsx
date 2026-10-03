import React, { useLayoutEffect, useMemo } from "react";
import { staticFile, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { LookCanvas, StudioEnvironment } from "../lib/LookCanvas";
import { ASPECT, TAU, loopPhase } from "../lib/constants";
import { PostConfig } from "../lib/post";
import { mulberry32 } from "../lib/random";
import { RingRow } from "../versions";

/**
 * Look 4 — Gold Ring Frame.
 *
 * World units: the frame is 2 units tall at the frame plane. Flat annular
 * plates at stepped heights build the dark frame (centre disc recessed); gold rings are tori in the
 * gaps. Dots and sparkles are procedural in the plate shader (polar grid with
 * an integer number of dots per row). Glints orbit each ring a whole number
 * of turns per loop; sparkles twinkle 1–4 times per loop.
 */

// [inner radius, outer radius, height, dotted]
const BANDS: [number, number, number, number][] = [
  [0.0, 0.925, -0.05, 0], // recessed centre disc
  [0.975, 1.265, 0.03, 1],
  [1.305, 1.525, 0.0, 1],
  [1.565, 1.71, 0.022, 1],
  [1.75, 1.9, 0.0, 1],
  [1.94, 2.6, 0.018, 1],
];
// gold rings sit between bands: [radius, tube radius, z, base glow, glint laps]
const RINGS: [number, number, number, number, number[]][] = [
  [0.95, 0.0075, 0.02, 0.12, [1, -2]],
  [1.285, 0.0045, 0.035, 0.015, [-1, 1]],
  [1.545, 0.0045, 0.025, 0.015, [2, -1]],
  [1.73, 0.004, 0.03, 0.012, [-2]],
  [1.92, 0.0045, 0.025, 0.012, [1, 3]],
];

const rngG = mulberry32(0x60_1d_f);
const GLINTS = RINGS.flatMap((r, ri) => r[4].map((laps) => ({ ring: ri, laps, a0: rngG() * TAU })));

const BAND_GLSL = /* glsl */ `
uniform float uPhase;
uniform vec3 uDotColor;
uniform vec3 uSparkle;
varying vec3 vLathe;
uint hh(uint x) { x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
float h1(uint x) { return float(hh(x)) / 4294967295.0; }
`;

const ringPatternGlsl = () => `
void ringPattern(vec3 P, out float dotMask, out float spark, out float ao) {
  float r = length(P.xy);
  float th = atan(P.y, P.x);
  int band = -1; float rIn = 0.0; float rOut = 0.0; float dotted = 0.0;
  ${ringBandsGlsl()}
  dotMask = 0.0; spark = 0.0;
  if (dotted > 0.5) {
    float dr = 0.027;
    float rr = (r - rIn) / dr;
    float row = floor(rr);
    float rc = rIn + (row + 0.5) * dr;
    float nPer = floor(6.2831853 * rc / 0.027 + 0.5);
    float off = mod(row, 2.0) * 0.5;
    float a = (th / 6.2831853 + 0.5) * nPer + off;
    float cell = floor(a);
    vec2 dd = vec2((fract(a) - 0.5) * 6.2831853 * rc / nPer, (fract(rr) - 0.5) * dr);
    float d = length(dd);
    float aa = max(fwidth(r) * 0.75, 1e-5);
    uint id0 = hh(uint(row + 1.0) * 92821u + uint(mod(cell, nPer)) * 7919u + uint(band) * 104729u + 5u);
    float rad = 0.0021 + 0.0022 * float(id0 & 0xffu) / 255.0;
    // keep the outermost rows of each band empty near the edges
    float edgeOk = step(rIn + 0.6 * dr, rc) * step(rc, rOut - 0.6 * dr);
    dotMask = (1.0 - smoothstep(rad - aa, rad + aa, d)) * edgeOk;
    uint id = hh(uint(row + 1.0) * 92821u + uint(mod(cell, nPer)) * 7919u + uint(band) * 104729u);
    float hr = float(id & 0xffffu) / 65535.0;
    float hp = float(id >> 16u) / 65535.0;
    float laps = floor(1.0 + hr * 3.999);
    float tw = pow(max(sin(6.2831853 * (laps * uPhase + hp)), 0.0), 18.0);
    spark = tw * step(0.72, hr) * dotMask;
  }
  float w = 0.035;
  ao = (1.0 - 0.6 * exp(-(r - rIn) / w)) * (1.0 - 0.45 * exp(-(rOut - r) / w));
  if (band == 0) ao = (1.0 - 0.75 * exp(-(rOut - r) / 0.06)) * (0.85 + 0.15 * smoothstep(0.0, 0.9, r));
  ao = clamp(ao, 0.0, 1.0);
}
`;

const ringBandsGlsl = () =>
  BANDS.map(([r0, r1, , d], i) => `if (r >= ${(r0 - 0.015).toFixed(4)} && r < ${(r1 + 0.015).toFixed(4)}) { band = ${i}; rIn = ${r0.toFixed(4)}; rOut = ${r1.toFixed(4)}; dotted = ${d.toFixed(1)}; }`).join("\n");

const CAM_D_FOCUS = 3.85;

const POST: PostConfig = {
  exposure: 1.0,
  bloom: { strength: 0.22, threshold: 1.0, knee: 0.6, spread: 0.75 },
  dof: { focus: CAM_D_FOCUS, farBlur: 12, nearBlur: 0.5, maxCoc: 6 },
  vignette: 0.75,
  grain: 0.02,
  msaa: 4,
};

const CAM_D = 1 / Math.tan((15 * Math.PI) / 180);

const Scene: React.FC<{ row: RingRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const objs = useMemo(() => {
    const root = new THREE.Group();
    const metal = new THREE.Color(row.metal);
    const edge = new THREE.Color(row.edge);
    const phaseU = { value: 0 };

    // ---- plates
    const bandMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(row.band).multiplyScalar(2.6),
      roughness: 0.55,
      metalness: 0.1,
      envMapIntensity: 0.22,
    });
    bandMat.userData.ownEnvIntensity = true;
    const wallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(row.band).multiplyScalar(0.8),
      roughness: 0.75,
      metalness: 0.0,
      envMapIntensity: 0.05,
      side: THREE.DoubleSide,
    });
    wallMat.userData.ownEnvIntensity = true;
    bandMat.onBeforeCompile = (sh) => {
      sh.uniforms.uPhase = phaseU;
      sh.uniforms.uDotColor = { value: metal };
      sh.uniforms.uSparkle = { value: edge };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vLathe;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvLathe = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>\n${BAND_GLSL}\n${ringPatternGlsl()}`)
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
  float gDot, gSpark, gAo;
  ringPattern(vLathe, gDot, gSpark, gAo);
  diffuseColor.rgb = mix(diffuseColor.rgb * gAo, uDotColor * (0.6 + 0.4 * gAo), gDot);
  roughnessFactor = mix(roughnessFactor, 0.45, gDot);`,
        )
        .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n  metalnessFactor = mix(metalnessFactor, 1.0, gDot);")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += uSparkle * gSpark * 7.0 + uDotColor * gDot * 0.18;");
    };
    // flat annular plates (normals +z) plus open cylinders for the step walls
    BANDS.forEach(([r0, r1, z]) => {
      const top = new THREE.Mesh(new THREE.RingGeometry(Math.max(r0, 0.0001), r1, 384, 6), bandMat);
      top.position.z = z;
      root.add(top);
      for (const rw of r0 > 0 ? [r0, r1] : [r1]) {
        const wall = new THREE.Mesh(new THREE.CylinderGeometry(rw, rw, z + 0.08, 384, 1, true), wallMat);
        wall.rotation.x = Math.PI / 2;
        wall.position.z = (z - 0.08) / 2;
        root.add(wall);
      }
    });

    // ---- gold rings with orbiting glints (emissive in the ring shader)
    const glintUniform = { value: GLINTS.map(() => new THREE.Vector4()) };
    RINGS.forEach(([R, tube, z, glow], ri) => {
      const mat = new THREE.MeshStandardMaterial({ color: metal, metalness: 1, roughness: 0.28, envMapIntensity: 0.7 });
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uGl = glintUniform;
        sh.uniforms.uEdge = { value: edge };
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vRingPos;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRingPos = position;");
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", `#include <common>\nvarying vec3 vRingPos;\nuniform vec4 uGl[${GLINTS.length}];\nuniform vec3 uEdge;`)
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
  float th = atan(vRingPos.y, vRingPos.x);
  float g = 0.0;
  for (int i = 0; i < ${GLINTS.length}; i++) {
    if (abs(uGl[i].y - ${ri}.0) < 0.5) {
      float d = atan(sin(th - uGl[i].x), cos(th - uGl[i].x));
      g += exp(-d * d / 0.01) * 3.0 + exp(-d * d / 0.12) * 0.5;
    }
  }
  float facing = 0.5 + 0.5 * normalize(vRingPos - vec3(normalize(vRingPos.xy) * ${R.toFixed(4)}, 0.0)).z;
  totalEmissiveRadiance += uEdge * (${glow.toFixed(3)} * (0.6 + 0.4 * facing) + g * facing);`,
          );
      };
      // the shader text above depends on ri/R/glow: give each ring its own program
      mat.customProgramCacheKey = () => `ring-${ri}`;
      const torus = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 20, 768), mat);
      torus.position.z = z;
      root.add(torus);
    });

    return { root, phaseU, glintUniform };
  }, [row]);

  useLayoutEffect(() => {
    const t = loopPhase(frame);
    objs.phaseU.value = t;
    GLINTS.forEach((g, i) => {
      // glints orbit their ring a whole number of laps per loop
      objs.glintUniform.value[i].set(g.a0 + g.laps * TAU * t, g.ring, 0, 0);
    });
  }, [frame, objs]);

  return <primitive object={objs.root} />;
};

export const GoldRingFrame: React.FC<{ row: RingRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const camera = useMemo(() => new THREE.PerspectiveCamera(30, ASPECT, 0.5, 20), []);
  useLayoutEffect(() => {
    const t = loopPhase(frame);
    // very slow push in/out and a slight tilt, one closed cycle per loop
    const push = 0.5 - 0.5 * Math.cos(TAU * t);
    const d = CAM_D * (1.03 - 0.05 * push);
    const tx = 0.03 * Math.sin(TAU * t);
    const ty = 0.02 * Math.cos(TAU * t) - 0.02;
    camera.position.set(tx * d * 0.5, ty * d * 0.5, d);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  }, [frame, camera]);
  const envRot = useMemo(() => new THREE.Euler(0.3, 2.4, 0), []);
  return (
    <LookCanvas post={POST} camera={camera}>
      <StudioEnvironment url={staticFile("hdri/studio.exr")} intensity={0.8} rotation={envRot} />
      <Scene row={row} />
    </LookCanvas>
  );
};
