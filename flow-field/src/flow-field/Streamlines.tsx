import { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

import { buildFrame, createTrailBuffers } from "./build-frame";
import { CAMERA } from "./camera";
import { createField } from "./field";
import { buildRampLut, PALETTES, type PaletteName } from "./palette";
import { createParticles } from "./particles";

// Colours in this clip are authored and blended in plain sRGB, and the shader
// writes exactly what it computes. Turning off three's colour management keeps
// it that way instead of silently round-tripping through linear space.
THREE.ColorManagement.enabled = false;

const VERTEX_SHADER = /* glsl */ `
attribute float aCross;
attribute float aAlong;
attribute vec3 aColor;
varying float vCross;
varying float vAlong;
varying vec3 vColor;
void main() {
  vCross = aCross;
  vAlong = aAlong;
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Every quad is three sigma across and carries a Gaussian falloff, so a line
// lands on the frame as a soft-edged filament rather than a hard-edged quad.
// This is also what antialiases hairlines thinner than a pixel. Ribbons fall off
// across their width only (aAlong is zero along their length); glow billboards
// set aAlong too and so come out round.
const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying float vCross;
varying float vAlong;
varying vec3 vColor;
void main() {
  float g = exp(-4.5 * (vCross * vCross + vAlong * vAlong));
  gl_FragColor = vec4(vColor * g, 1.0);
}
`;

/** Keeps the three.js camera exactly in step with the CPU-side projection. */
const CameraRig: React.FC = () => {
  const camera = useThree((s) => s.camera);
  const { width, height } = useVideoConfig();

  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.fov = CAMERA.fovDeg;
    c.aspect = width / height;
    c.near = 1;
    c.far = 2200;
    c.position.set(CAMERA.px, CAMERA.py, CAMERA.pz);
    c.rotation.set((-CAMERA.pitchDeg * Math.PI) / 180, 0, 0, "YXZ");
    c.updateProjectionMatrix();
    c.updateMatrixWorld(true);
  }, [camera, width, height]);

  return null;
};

export const Streamlines: React.FC<{
  palette: PaletteName;
  fieldSeed: number;
}> = ({ palette, fieldSeed }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, height } = useVideoConfig();
  const gl = useThree((s) => s.gl);

  const scene = useMemo(() => {
    const particles = createParticles(fieldSeed + 991);
    const field = createField(fieldSeed);
    const rampLut = buildRampLut(PALETTES[palette]);

    // Room for every trail segment plus the wider bloom and halo quads the
    // brightest of them add on top.
    const capacity = Math.ceil(particles.maxSegments * 1.3);
    const buffers = createTrailBuffers(capacity);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(buffers.position, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    geometry.setAttribute(
      "aCross",
      new THREE.BufferAttribute(buffers.cross, 1).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    geometry.setAttribute(
      "aAlong",
      new THREE.BufferAttribute(buffers.along, 1).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    geometry.setAttribute(
      "aColor",
      new THREE.BufferAttribute(buffers.color, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    geometry.setIndex(new THREE.BufferAttribute(buffers.index, 1));
    geometry.setDrawRange(0, 0);

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      // Straight additive accumulation: overlapping filaments build up, and the
      // draw order of the quads cannot matter.
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;

    return { particles, field, rampLut, buffers, geometry, mesh };
  }, [palette, fieldSeed]);

  // How many device pixels one composition pixel is worth. At --scale=0.5 this
  // is 0.5, and the sigma floor below stops hairlines from falling between the
  // sample points of the smaller grid.
  const pixelScale =
    typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const sigmaFloor = 0.72 / pixelScale;

  const quadsRef = useRef(0);

  useLayoutEffect(() => {
    gl.setClearColor(new THREE.Color(PALETTES[palette].background), 1);
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
  }, [gl, palette]);

  // Runs before @remotion/three advances the renderer for this frame, so the
  // buffers three uploads are always the ones built for the frame on screen.
  useLayoutEffect(() => {
    const quads = buildFrame({
      frame,
      durationInFrames,
      compHeight: height,
      sigmaFloor,
      field: scene.field,
      particles: scene.particles,
      rampLut: scene.rampLut,
      buffers: scene.buffers,
    });
    quadsRef.current = quads;

    const geometry = scene.geometry;
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    const cross = geometry.getAttribute("aCross") as THREE.BufferAttribute;
    const along = geometry.getAttribute("aAlong") as THREE.BufferAttribute;
    const col = geometry.getAttribute("aColor") as THREE.BufferAttribute;

    // Upload only the slice that was written this frame — the buffers are
    // sized for the worst case and are mostly stale on a typical frame.
    pos.clearUpdateRanges();
    pos.addUpdateRange(0, quads * 12);
    cross.clearUpdateRanges();
    cross.addUpdateRange(0, quads * 4);
    along.clearUpdateRanges();
    along.addUpdateRange(0, quads * 4);
    col.clearUpdateRanges();
    col.addUpdateRange(0, quads * 12);
    pos.needsUpdate = true;
    cross.needsUpdate = true;
    along.needsUpdate = true;
    col.needsUpdate = true;
    geometry.setDrawRange(0, quads * 6);
  }, [frame, durationInFrames, height, sigmaFloor, scene]);

  return (
    <>
      <CameraRig />
      <primitive object={scene.mesh} />
    </>
  );
};
