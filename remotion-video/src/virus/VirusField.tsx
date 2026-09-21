// The shared rig. Camera, lighting, instancing, motion and the post chain are
// fixed here; everything that differs between looks arrives as a data row.

import React, { useMemo, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { EffectComposer, DepthOfField, Bloom, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { buildField, frustumHalfHeight } from "./lib/field";
import { buildCoreGeometry, buildSpikeParts } from "./lib/geometry";
import { Background } from "./Background";
import { Specks, BokehDiscs } from "./Sprites";
import { Grain } from "./Grain";
import type { LookSpec } from "./data/types";

export const CAMERA_Z = 14;
export const CAMERA_FOV = 35;

/**
 * MeshStandardMaterial with the core's `aMottle` attribute ramped into a
 * brightness multiplier. One mechanism covers both the fine speckle of looks
 * 6/8/10 and the heavy black-and-white marbling of look 5 — the difference is
 * the width of the ramp, which is a data-row value.
 */
const useCoreMaterial = (look: LookSpec) =>
  useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      roughness: look.core.roughness,
      metalness: look.core.metalness,
      color: "#ffffff",
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uMottleDark = { value: look.core.mottleDark };
      shader.uniforms.uMottleLight = { value: look.core.mottleLight };
      shader.uniforms.uMottleContrast = { value: look.core.mottleContrast };

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute float aMottle;\nvarying float vMottle;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvMottle = aMottle;",
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying float vMottle;
uniform float uMottleDark;
uniform float uMottleLight;
uniform float uMottleContrast;`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
{
  float m = clamp((vMottle - 0.5) * uMottleContrast + 0.5, 0.0, 1.0);
  diffuseColor.rgb *= mix(vec3(uMottleDark), vec3(uMottleLight), m);
}`,
        );
    };
    // Force a recompile key so two looks with different ramps don't share a
    // cached program.
    mat.customProgramCacheKey = () =>
      `core-${look.core.mottleDark}-${look.core.mottleLight}-${look.core.mottleContrast}`;
    return mat;
  }, [look]);

/** Additive halo behind each core — look 9's blue rim glow. */
const RimGlow: React.FC<{
  look: LookSpec;
  positions: THREE.Vector3[];
  radii: number[];
}> = ({ look, positions, radii }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const glow = look.rimGlow!;

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * length(vec3(instanceMatrix[0]));
  gl_Position = projectionMatrix * mv;
}`,
        fragmentShader: /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uColour;
uniform float uIntensity;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  // The gaussian alone still had visible alpha where the quad ends, which
  // showed up as a hard square around every particle. The smoothstep forces
  // it to zero before the edge.
  float a = exp(-pow(d * 2.6, 2.0)) * (1.0 - smoothstep(0.62, 1.0, d));
  gl_FragColor = vec4(uColour * uIntensity, a);
}`,
        uniforms: {
          uColour: { value: new THREE.Color(glow.colour) },
          uIntensity: { value: glow.intensity },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [glow],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    positions.forEach((p, i) => {
      const size = radii[i] * glow.size;
      s.set(size, size, size);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = positions.length;
  }, [positions, radii, glow]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, positions.length]}
      material={material}
      frustumCulled={false}
      renderOrder={-100}
    >
      <planeGeometry args={[2, 2]} />
    </instancedMesh>
  );
};

export const VirusField: React.FC<{
  look: LookSpec;
  frame: number;
  /**
   * Length of one motion cycle. Deliberately a fixed constant rather than the
   * composition's `durationInFrames`: the loop-closure check extends the
   * composition to 601 frames and compares frame 0 with frame 600, and that
   * only means anything if frame 600 still lands on t = 1.
   */
  loopFrames: number;
}> = ({ look, frame, loopFrames }) => {
  const { invalidate } = useThree();

  // Everything below is built once per look, at module-equivalent scope, and
  // reused for all 600 frames.
  const field = useMemo(() => buildField(look, CAMERA_Z, CAMERA_FOV), [look]);
  const coreGeo = useMemo(
    () =>
      buildCoreGeometry({
        detail: look.core.detail,
        displace: look.core.displace,
        displaceFreq: look.core.displaceFreq,
        mottleFreq: look.core.mottleFreq,
        seed: look.seed,
      }),
    [look],
  );
  const spikeParts = useMemo(
    () =>
      buildSpikeParts(
        look.spike.archetype,
        look.spike.stalkScale,
        look.spike.capScale,
      ),
    [look],
  );
  const coreMaterial = useCoreMaterial(look);

  const stalkMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: look.spike.roughness,
        metalness: look.spike.metalness,
        color: "#ffffff",
      }),
    [look],
  );
  const capMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: look.spike.roughness,
        metalness: look.spike.metalness,
        color: "#ffffff",
      }),
    [look],
  );

  const coreRef = useRef<THREE.InstancedMesh>(null);
  const stalkRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);

  const t = frame / loopFrames;

  /**
   * Particle world transforms for this frame. Recomputed from `frame` alone —
   * never advanced from the previous frame's values, so rendering frame 300 on
   * its own gives the same answer as reaching it in sequence.
   */
  const transforms = useMemo(() => {
    const tau = Math.PI * 2;
    const q = new THREE.Quaternion();
    return field.particles.map((p) => {
      const pos = new THREE.Vector3(
        p.base.x + p.amp.x * Math.sin(tau * p.freq.x * t + p.drift.x),
        p.base.y + p.amp.y * Math.sin(tau * p.freq.y * t + p.drift.y),
        p.base.z + p.amp.z * Math.sin(tau * p.freq.z * t + p.drift.z),
      );
      // Integer turns over the clip: the rotation lands exactly back on its
      // start at t = 1.
      const angle = p.phase + tau * p.turns * t;
      q.setFromAxisAngle(p.axis, angle);
      const matrix = new THREE.Matrix4().compose(
        pos,
        q,
        new THREE.Vector3(p.radius, p.radius, p.radius),
      );
      return { pos, matrix };
    });
  }, [field, t]);

  // Fill the instance buffers.
  useLayoutEffect(() => {
    const core = coreRef.current;
    const stalk = stalkRef.current;
    const cap = capRef.current;
    if (!core || !cap) return;

    const tmp = new THREE.Matrix4();
    const colour = new THREE.Color();

    let s = 0;
    field.particles.forEach((p, i) => {
      const { matrix } = transforms[i];
      core.setMatrixAt(i, matrix);
      colour.set(look.colorways[p.colorway].core);
      core.setColorAt(i, colour);

      for (const spike of p.spikes) {
        tmp.multiplyMatrices(matrix, spike.matrix);
        if (stalk) {
          stalk.setMatrixAt(s, tmp);
          colour.set(look.colorways[spike.colorway].stalk);
          stalk.setColorAt(s, colour);
        }
        cap.setMatrixAt(s, tmp);
        colour.set(
          spike.accent && look.capAccent
            ? look.capAccent.colour
            : look.colorways[spike.colorway].cap,
        );
        cap.setColorAt(s, colour);
        s++;
      }
    });

    core.count = field.particles.length;
    core.instanceMatrix.needsUpdate = true;
    if (core.instanceColor) core.instanceColor.needsUpdate = true;
    cap.count = s;
    cap.instanceMatrix.needsUpdate = true;
    if (cap.instanceColor) cap.instanceColor.needsUpdate = true;
    if (stalk) {
      stalk.count = s;
      stalk.instanceMatrix.needsUpdate = true;
      if (stalk.instanceColor) stalk.instanceColor.needsUpdate = true;
    }
    invalidate();
  }, [field, transforms, look, invalidate]);

  // Background plane sized to cover the frustum at its depth.
  const bgZ = -34;
  const bgHalfH = frustumHalfHeight(bgZ, CAMERA_Z, CAMERA_FOV) * 1.05;

  const heroIndex = Math.min(look.heroIndex, field.particles.length - 1);
  const focusDistance =
    look.post.focusDistance > 0
      ? look.post.focusDistance
      : CAMERA_Z - transforms[heroIndex].pos.z;


  const { lighting: L } = look;

  return (
    <>
      <ambientLight intensity={L.ambient} />
      <directionalLight
        position={L.keyPosition}
        intensity={L.keyIntensity}
        color={L.keyColour}
      />
      <directionalLight
        position={L.fillPosition}
        intensity={L.fillIntensity}
        color={L.fillColour}
      />
      <directionalLight
        position={L.rimPosition}
        intensity={L.rimIntensity}
        color={L.rimColour}
      />

      <Background
        look={look}
        z={bgZ}
        width={bgHalfH * 2 * (16 / 9)}
        height={bgHalfH * 2}
      />

      {look.bokeh ? (
        <BokehDiscs
          spec={look.bokeh}
          seed={look.seed}
          cameraZ={CAMERA_Z}
          fov={CAMERA_FOV}
          t={t}
        />
      ) : null}

      {look.rimGlow ? (
        <RimGlow
          look={look}
          positions={transforms.map((tr) => tr.pos)}
          radii={field.particles.map((p) => p.radius)}
        />
      ) : null}

      <instancedMesh
        ref={coreRef}
        args={[coreGeo, coreMaterial, field.particles.length]}
        frustumCulled={false}
      />

      {spikeParts.stalk ? (
        <instancedMesh
          ref={stalkRef}
          args={[spikeParts.stalk, stalkMaterial, field.spikeTotal]}
          frustumCulled={false}
        />
      ) : null}

      <instancedMesh
        ref={capRef}
        args={[spikeParts.cap, capMaterial, field.spikeTotal]}
        frustumCulled={false}
      />

      {look.specks ? (
        <Specks
          spec={look.specks}
          seed={look.seed}
          cameraZ={CAMERA_Z}
          fov={CAMERA_FOV}
          t={t}
        />
      ) : null}

      <EffectComposer enableNormalPass={false} multisampling={4}>
        <DepthOfField
          worldFocusDistance={focusDistance}
          worldFocusRange={look.post.focusRange}
          bokehScale={look.post.bokehScale}
          // The bokeh buffer is blur by definition, so computing it at half
          // resolution is invisible in the result and roughly halves the cost
          // of the single most expensive pass in the chain.
          resolutionScale={0.5}
        />
        <Bloom
          intensity={look.post.bloomIntensity}
          luminanceThreshold={look.post.bloomThreshold}
          luminanceSmoothing={0.3}
          mipmapBlur
          resolutionScale={0.5}
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        {/* Fed frame % loopFrames so frame 600 gets frame 0's grain. */}
        <Grain intensity={look.post.grain} frame={frame % loopFrames} />
      </EffectComposer>
    </>
  );
};
