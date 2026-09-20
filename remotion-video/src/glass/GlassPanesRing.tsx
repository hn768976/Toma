import React, { useMemo } from "react";
import * as THREE from "three";
import { z } from "zod";
import { TAU } from "./constants";
import { createEnvironmentTexture } from "./environment";
import { bendGeometry, createPaneGeometry } from "./geometry";
import { createPhysicalMaterial } from "./materials";
import { sampleRamp } from "./ramp";
import { pivotWave, placeOnRing, radiusForGap, ringAngle } from "./ring";
import { ThreeStage, type SceneApi, type SceneContext } from "./ThreeStage";

export const glassPanesRingSchema = z.object({
  paneCount: z.number().int().min(6).max(48),
  /** Clear arc left between neighbouring panes, in world units. */
  paneGap: z.number().min(0).max(3),
  /** Resting pivot of each pane away from tangent, in degrees. */
  baseAngleDegrees: z.number().min(-89).max(89),
  /** Amplitude of the synchronised pivot, in degrees. */
  swingDegrees: z.number().min(0).max(60),
  /** Whole cycles of the pivot wave around the ring. Integer keeps it seamless. */
  waveCycles: z.number().int().min(0).max(12),
  /** Whole cycles of the pivot wave over the loop. Integer keeps it seamless. */
  waveSpeed: z.number().int().min(0).max(4),
  /** Amplitude of the ring's own rotation, in degrees. */
  ringSwingDegrees: z.number().min(0).max(180),
  /**
   * How many times the colour ramp cycles around the ring. Integer, so the
   * ring stays seamless. Only a handful of panels are ever in shot, so a
   * ramp stretched once around a 40-panel ring would advance a few percent
   * across the whole frame and read as flat; repeating it puts a full
   * light-to-dark run inside the visible arc, as in the reference.
   */
  rampRepeats: z.number().int().min(1).max(12),
  /** Rotates the colour assignment around the ring, 0..1 of one cycle. */
  rampOffset: z.number().min(0).max(1),
  /** Camera distance from the ring centre, on the +Z axis. */
  cameraZ: z.number(),
  /** Lateral shift of the ring, to keep clear space on one side of frame. */
  ringOffsetX: z.number(),
  exposure: z.number().min(0.2).max(3),
});

export type GlassPanesRingProps = z.infer<typeof glassPanesRingSchema>;

export const glassPanesRingDefaults: GlassPanesRingProps = {
  paneCount: 42,
  paneGap: 0.18,
  baseAngleDegrees: 58,
  swingDegrees: 9,
  waveCycles: 3,
  waveSpeed: 1,
  ringSwingDegrees: 13,
  rampRepeats: 6,
  rampOffset: 0.5,
  cameraZ: 15.5,
  ringOffsetX: -1.5,
  exposure: 1,
};

/**
 * Cyclic: the last stop equals the first, so the ring has no colour seam at
 * the wrap-around. Sampled at `i / count` rather than `i / (count - 1)`.
 */
const PANE_RAMP = [
  "#f2f3f6",
  "#dcdee5",
  "#b6bacb",
  "#8287a8",
  "#474d8c",
  "#232878",
  "#121682",
  "#3b3f96",
  "#8d91b4",
  "#d3d5df",
  "#f2f3f6",
] as const;

const PANE_WIDTH = 1.55;
const PANE_HEIGHT = 5.2;
const PANE_DEPTH = 0.09;
const PANE_RADIUS = 0.32;
/** Reciprocal bend radius — barely there, but enough to graduate the faces. */
const PANE_CURVATURE = 0.13;

type Built = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  panes: THREE.Mesh[];
  disposables: { dispose: () => void }[];
};

const buildScene = (ctx: SceneContext, props: GlassPanesRingProps): Built => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#ffffff");

  const environment = createEnvironmentTexture({
    // A white cyclorama: bright everywhere, with only a gentle floor
    // darkening. Frosted glass in a white room has almost no contrast of its
    // own, so the tonal range has to come from panes stacking up behind each
    // other rather than from shading.
    stops: [
      { at: 0, color: "#ffffff" },
      { at: 0.45, color: "#fbfbfe" },
      { at: 0.62, color: "#eaeaf2" },
      { at: 0.85, color: "#d3d4e0" },
      { at: 1, color: "#c4c6d6" },
    ],
    lights: [
      { u: 0.3, v: 0.2, w: 0.16, h: 0.32, color: "#ffffff", intensity: 0.8, blur: 90 },
      { u: 0.72, v: 0.3, w: 0.17, h: 0.3, color: "#ffffff", intensity: 0.5, blur: 100 },
      // Darker pockets between the softboxes. Without them the room is a
      // uniform white ball and the curved faces have nothing to graduate
      // across, which reads as flat vinyl rather than frosted glass.
      { u: 0.51, v: 0.42, w: 0.14, h: 0.24, color: "#2c3050", intensity: 0.28, blur: 100 },
      { u: 0.05, v: 0.45, w: 0.13, h: 0.24, color: "#3a3f60", intensity: 0.22, blur: 100 },
      // A cool pocket low and right, which is what tints the far panes.
      { u: 0.9, v: 0.72, w: 0.2, h: 0.24, color: "#4b53d8", intensity: 0.32, blur: 110 },
    ],
  });
  scene.environment = environment;
  scene.environmentIntensity = 1;

  // Kept low on purpose. With a white cyclorama behind them, any real amount
  // of direct light flattens the deep panes to pale blue; the depth in this
  // piece comes from translucent panes stacking, not from shading.
  const key = new THREE.DirectionalLight("#ffffff", 0.75);
  key.position.set(-2.5, 4, 6);
  const fill = new THREE.DirectionalLight("#dfe3ff", 0.3);
  fill.position.set(5, -1.5, 3.5);
  const ambient = new THREE.AmbientLight("#ffffff", 0.28);
  scene.add(key, fill, ambient);

  const camera = new THREE.PerspectiveCamera(30, ctx.aspect, 0.1, 100);

  const root = new THREE.Group();
  scene.add(root);

  const geometry = bendGeometry(
    createPaneGeometry({
      width: PANE_WIDTH,
      height: PANE_HEIGHT,
      depth: PANE_DEPTH,
      radius: PANE_RADIUS,
    }),
    PANE_CURVATURE,
  );

  const disposables: { dispose: () => void }[] = [geometry, environment];
  const panes: THREE.Mesh[] = [];

  for (let i = 0; i < props.paneCount; i++) {
    const color = sampleRamp(
      PANE_RAMP,
      ((i * props.rampRepeats) / props.paneCount + props.rampOffset) % 1,
    );

    const face = createPhysicalMaterial(ctx.useNodeMaterials, {
      color,
      metalness: 0,
      // Rough enough to smear the room into a wash rather than a mirror, but
      // not so rough that the gentle bend stops graduating the face.
      roughness: 0.3,
      clearcoat: 0.35,
      clearcoatRoughness: 0.5,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
      envMapIntensity: 0.9,
    });

    // The rim is where a real sheet of glass concentrates its colour. Keeping
    // it a separate, far more saturated material reproduces the thin blue
    // line that outlines every pane in the reference.
    // Saturate the rim without darkening it much: taking lightness down far
    // enough to read as an outline turns the already-deep panes' edges into
    // black lines, which no sheet of glass has.
    const edgeColor = color.clone().offsetHSL(0, 0.32, -0.03);
    const edge = createPhysicalMaterial(ctx.useNodeMaterials, {
      color: edgeColor,
      metalness: 0.25,
      roughness: 0.25,
      emissive: edgeColor.clone().multiplyScalar(0.3),
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      envMapIntensity: 1.1,
    });
    disposables.push(face, edge);

    const mesh = new THREE.Mesh(geometry, [face, edge]);
    root.add(mesh);
    panes.push(mesh);
  }

  return { scene, camera, root, panes, disposables };
};

const makeSceneFactory =
  (props: GlassPanesRingProps) =>
  (ctx: SceneContext): SceneApi => {
    const built = buildScene(ctx, props);
    const { scene, camera, root, panes } = built;
    const swing = THREE.MathUtils.degToRad(props.swingDegrees);
    const baseAngle = THREE.MathUtils.degToRad(props.baseAngleDegrees);
    const ringSwing = THREE.MathUtils.degToRad(props.ringSwingDegrees);
    // Clearance is checked at the widest pivot the swing reaches, so the
    // gaps never close up at the extremes of the animation.
    const radius = radiusForGap(
      props.paneCount,
      PANE_WIDTH,
      PANE_DEPTH,
      Math.abs(baseAngle) + swing,
      props.paneGap,
    );

    const update = (progress: number) => {
      const phase = TAU * progress;
      const spin = ringSwing * Math.sin(phase);

      for (let i = 0; i < panes.length; i++) {
        const angle = ringAngle(i, panes.length, spin);
        // Synchronised, with a shallow wave running around the ring so the
        // group breathes instead of moving as one rigid object.
        const pivot =
          baseAngle +
          pivotWave(angle, phase, swing, props.waveCycles, props.waveSpeed);
        placeOnRing(panes[i], angle, radius, pivot);
      }

      root.position.set(props.ringOffsetX, 0, 0);

      // Dead front, dead level: on the +Z axis, at the ring's own height,
      // looking straight down -Z with no yaw, pitch or roll. Composition is
      // shifted by moving the ring, never by tilting the camera.
      camera.position.set(0, 0, props.cameraZ);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    };

    return {
      scene,
      camera,
      update,
      resize: (width, height) => {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      },
      dispose: () => {
        for (const item of built.disposables) {
          item.dispose();
        }
      },
    };
  };

export const GlassPanesRing: React.FC<GlassPanesRingProps> = (props) => {
  const build = useMemo(
    () => makeSceneFactory(props),
    // Rebuild the scene graph only when a prop that changes it actually
    // changes; `props` itself is a fresh object on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(props)],
  );

  return (
    <ThreeStage
      build={build}
      exposure={props.exposure}
      background="#ffffff"
      toneMapping="none"
    />
  );
};
