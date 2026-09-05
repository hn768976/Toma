import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { z } from "zod";
import {
  BASE_HEIGHT,
  BASE_STRENGTH,
  BLOOM_BLUR_PX_4K,
  BLOOM_BRIGHTNESS,
  BLOOM_CONTRAST,
  BLOOM_OPACITY,
  CAMERA_FAR,
  CAMERA_HEIGHT,
  CAMERA_NEAR,
  CAMERA_PITCH_DEG,
  COC_K,
  DURATION_IN_FRAMES,
  EXPOSURE,
  FOCUS_DISTANCE,
  FOG_END,
  FOG_START,
  FOV_Y,
  GRAIN_AMOUNT,
  LIGHT_DIR,
  PALETTES,
  type PaletteName,
} from "./constants";
import { buildOccluderGeometry, getDuneParticles } from "./sampling";
import {
  BACKGROUND_FRAGMENT,
  BACKGROUND_VERTEX,
  OCCLUDER_FRAGMENT,
  OCCLUDER_VERTEX,
  PARTICLE_FRAGMENT,
  PARTICLE_VERTEX,
} from "./shaders";

// Colours are authored as plain sRGB triples and blended additively in that
// same space, so the brightest crests clip the way film does. Letting three
// manage colour would silently linearise them and undo that.
THREE.ColorManagement.enabled = false;

const OCCLUDER_SEGMENTS_X = 330;
const OCCLUDER_SEGMENTS_Z = 250;

export const particleDunesSchema = z.object({
  palette: z.enum(["cyan", "sand"]),
});

export type ParticleDunesProps = z.infer<typeof particleDunesSchema>;

const vec3 = (c: readonly [number, number, number]) =>
  new THREE.Vector3(c[0], c[1], c[2]);

const Scene: React.FC<{ palette: PaletteName }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const colors = PALETTES[palette];

  // Loop phase. Every periodic term in the shader is a whole number of cycles
  // over this, so frame 450 would land exactly on frame 0.
  const t = frame / DURATION_IN_FRAMES;

  const particles = getDuneParticles();

  const pointsGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(particles.positions, 3),
    );
    g.setAttribute("aRand", new THREE.BufferAttribute(particles.rand, 4));
    return g;
  }, [particles]);

  const occluderGeometry = useMemo(
    () => buildOccluderGeometry(OCCLUDER_SEGMENTS_X, OCCLUDER_SEGMENTS_Z),
    [],
  );

  const backgroundGeometry = useMemo(() => {
    // A clip-space triangle pair; the vertex shader passes it straight through.
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(
        // prettier-ignore
        new Float32Array([
          -1, -1, 0,  3, -1, 0,  -1, 3, 0,
        ]),
        3,
      ),
    );
    return g;
  }, []);

  const materials = useMemo(() => {
    const points = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      uniforms: {
        uT: { value: 0 },
        uPixel: { value: 1 },
        uLightDir: { value: new THREE.Vector3() },
        uFocusDist: { value: FOCUS_DISTANCE },
        uCocK: { value: COC_K },
        uFogStart: { value: FOG_START },
        uFogEnd: { value: FOG_END },
        uColShadow: { value: new THREE.Vector3() },
        uColMid: { value: new THREE.Vector3() },
        uColLit: { value: new THREE.Vector3() },
        uExposure: { value: EXPOSURE },
      },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    const occluder = new THREE.ShaderMaterial({
      vertexShader: OCCLUDER_VERTEX,
      fragmentShader: OCCLUDER_FRAGMENT,
      uniforms: {
        uT: { value: 0 },
        uLightDir: { value: new THREE.Vector3() },
        uFogStart: { value: FOG_START },
        uFogEnd: { value: FOG_END },
        uColShadow: { value: new THREE.Vector3() },
        uColMid: { value: new THREE.Vector3() },
        uColLit: { value: new THREE.Vector3() },
        uBaseStrength: { value: BASE_STRENGTH },
        ...grainUniforms(),
      },
    });
    const background = new THREE.ShaderMaterial({
      vertexShader: BACKGROUND_VERTEX,
      fragmentShader: BACKGROUND_FRAGMENT,
      uniforms: grainUniforms(),
      depthTest: false,
      depthWrite: false,
    });
    return { points, occluder, background };
  }, []);

  // --- per-frame uniform updates -----------------------------------------
  // Driven entirely by useCurrentFrame(), never by a clock or accumulated
  // delta: Remotion renders frames out of order across worker threads.
  const dpr = gl.getPixelRatio();
  const pixel = (gl.domElement.height || BASE_HEIGHT * dpr) / BASE_HEIGHT;

  camera.position.set(0, CAMERA_HEIGHT, 0);
  camera.rotation.set((CAMERA_PITCH_DEG * Math.PI) / 180, 0, 0, "YXZ");

  const grains = materials.points.uniforms;
  grains.uT.value = t;
  grains.uPixel.value = pixel;
  grains.uLightDir.value.set(...LIGHT_DIR).normalize();
  grains.uColShadow.value.copy(vec3(colors.shadow));
  grains.uColMid.value.copy(vec3(colors.mid));
  grains.uColLit.value.copy(vec3(colors.lit));

  for (const m of [materials.occluder, materials.background]) {
    m.uniforms.uGrainSeed.value = frame * 0.017 + 1.0;
    m.uniforms.uBackground.value.copy(vec3(colors.background));
  }
  // The shell is lit exactly like the grains, so it shares their values.
  const shell = materials.occluder.uniforms;
  shell.uT.value = t;
  shell.uLightDir.value.copy(grains.uLightDir.value);
  shell.uColShadow.value.copy(grains.uColShadow.value);
  shell.uColMid.value.copy(grains.uColMid.value);
  shell.uColLit.value.copy(grains.uColLit.value);

  return (
    <>
      <mesh
        geometry={backgroundGeometry}
        material={materials.background}
        renderOrder={-2}
        frustumCulled={false}
      />
      <mesh
        geometry={occluderGeometry}
        material={materials.occluder}
        renderOrder={-1}
        frustumCulled={false}
      />
      <points
        geometry={pointsGeometry}
        material={materials.points}
        renderOrder={1}
        frustumCulled={false}
      />
    </>
  );
};

/** Fresh objects per material: three mutates uniform values in place, so two
 *  materials must never share the same uniform object. */
const grainUniforms = () => ({
  uGrainSeed: { value: 0 },
  uGrainAmount: { value: GRAIN_AMOUNT },
  uBackground: { value: new THREE.Vector3() },
});

export const ParticleDunes: React.FC<ParticleDunesProps> = ({ palette }) => {
  const { width, height } = useVideoConfig();
  const background = PALETTES[palette].background;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgb(${background.map((c) => Math.round(c * 255)).join(",")})`,
      }}
    >
      <ThreeCanvas
        width={width}
        height={height}
        // Match the drawing buffer to what Remotion will actually capture, so
        // a 1080p preview really does cost 1080p and the 4K render costs 4K.
        // Remotion renders at deviceScaleFactor = --scale; capped at 1 so a
        // HiDPI screen does not make the Studio allocate an 8K buffer for a
        // composition that is already 4K.
        dpr={
          typeof window === "undefined"
            ? 1
            : Math.min(window.devicePixelRatio, 1)
        }
        gl={{ antialias: false, alpha: false }}
        camera={{
          fov: FOV_Y,
          near: CAMERA_NEAR,
          far: CAMERA_FAR,
          position: [0, CAMERA_HEIGHT, 0],
        }}
      >
        <Scene palette={palette} />
      </ThreeCanvas>
      <AbsoluteFill
        style={{
          backdropFilter:
            `brightness(${BLOOM_BRIGHTNESS}) contrast(${BLOOM_CONTRAST}) ` +
            `blur(${BLOOM_BLUR_PX_4K}px)`,
          mixBlendMode: "plus-lighter",
          opacity: BLOOM_OPACITY,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export const particleDunesDefaults: ParticleDunesProps = { palette: "cyan" };
