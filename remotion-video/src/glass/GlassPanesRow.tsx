import React, { useMemo } from "react";
import * as THREE from "three";
import { z } from "zod";
import { TAU } from "./constants";
import { createEnvironmentTexture } from "./environment";
import { bendGeometry, createPaneGeometry } from "./geometry";
import { createPhysicalMaterial } from "./materials";
import { sampleRamp } from "./ramp";
import { ThreeStage, type SceneApi, type SceneContext } from "./ThreeStage";

export const glassPanesRowSchema = z.object({
  paneCount: z.number().int().min(4).max(32),
  /** Resting pivot away from face-on, in degrees. */
  baseAngleDegrees: z.number().min(0).max(89),
  /** Amplitude of the synchronised pivot, in degrees. */
  swingDegrees: z.number().min(0).max(80),
  /** Phase lag per pane down the row, in radians. */
  waveLag: z.number().min(0).max(1.5),
  stepX: z.number().min(0.2).max(3),
  stepZ: z.number().min(-3).max(0),
  /** Bias on the colour ramp; >1 keeps the near panes neutral for longer. */
  rampGamma: z.number().min(0.3).max(4),
  cameraX: z.number(),
  cameraZ: z.number(),
  targetX: z.number(),
  exposure: z.number().min(0.2).max(3),
});

export type GlassPanesRowProps = z.infer<typeof glassPanesRowSchema>;

export const glassPanesRowDefaults: GlassPanesRowProps = {
  paneCount: 22,
  baseAngleDegrees: 66,
  swingDegrees: 11,
  waveLag: 0.14,
  stepX: 0.9,
  stepZ: -0.35,
  rampGamma: 1.9,
  cameraX: -7.2,
  cameraZ: 6.6,
  targetX: 2.2,
  exposure: 1,
};

/** Near/left (silvery grey) through to far/right (deep indigo blue). */
const PANE_RAMP = [
  "#f2f3f6",
  "#dcdee5",
  "#b6bacb",
  "#8287a8",
  "#474d8c",
  "#232878",
  "#121682",
  "#0d1192",
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
  panes: THREE.Mesh[];
  disposables: { dispose: () => void }[];
};

const buildScene = (ctx: SceneContext, props: GlassPanesRowProps): Built => {
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
      { u: 0.3, v: 0.2, w: 0.1, h: 0.3, color: "#ffffff", intensity: 0.8, blur: 55 },
      { u: 0.72, v: 0.3, w: 0.13, h: 0.28, color: "#ffffff", intensity: 0.5, blur: 70 },
      // Darker pockets between the softboxes. Without them the room is a
      // uniform white ball and the curved faces have nothing to graduate
      // across, which reads as flat vinyl rather than frosted glass.
      { u: 0.51, v: 0.42, w: 0.09, h: 0.2, color: "#2c3050", intensity: 0.28, blur: 60 },
      { u: 0.05, v: 0.45, w: 0.08, h: 0.2, color: "#3a3f60", intensity: 0.22, blur: 60 },
      // A cool pocket low and right, which is what tints the far panes.
      { u: 0.9, v: 0.72, w: 0.18, h: 0.22, color: "#4b53d8", intensity: 0.32, blur: 90 },
    ],
  });
  scene.environment = environment;
  scene.environmentIntensity = 1;

  // Kept low on purpose. With a white cyclorama behind them, any real amount
  // of direct light flattens the deep panes at the far end to pale blue; the
  // depth in this piece comes from translucent panes stacking, not shading.
  const key = new THREE.DirectionalLight("#ffffff", 0.75);
  key.position.set(-2.5, 4, 6);
  const fill = new THREE.DirectionalLight("#dfe3ff", 0.3);
  fill.position.set(5, -1.5, 3.5);
  const ambient = new THREE.AmbientLight("#ffffff", 0.28);
  scene.add(key, fill, ambient);

  const camera = new THREE.PerspectiveCamera(30, ctx.aspect, 0.1, 100);

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
    const linear = props.paneCount === 1 ? 0 : i / (props.paneCount - 1);
    // Biased so the near half of the row stays near-neutral silver and the
    // colour only arrives in the last few panes, as it does in the reference.
    const t = Math.pow(linear, props.rampGamma);
    const color = sampleRamp(PANE_RAMP, t);

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
      // Off, so overlapping panes blend instead of punching holes in each
      // other; three still sorts them back to front for us.
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 0.9,
    });

    // The rim is where a real sheet of glass concentrates its colour. Keeping
    // it a separate, far more saturated material reproduces the thin blue
    // line that outlines every pane in the reference.
    const edgeColor = sampleRamp(PANE_RAMP, Math.min(1, 0.45 + t * 0.6));
    const edge = createPhysicalMaterial(ctx.useNodeMaterials, {
      color: edgeColor,
      metalness: 0.25,
      roughness: 0.25,
      emissive: edgeColor.clone().multiplyScalar(0.3),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 1.1,
    });
    disposables.push(face, edge);

    const mesh = new THREE.Mesh(geometry, [face, edge]);
    mesh.position.set(i * props.stepX, 0, i * props.stepZ);
    // Explicit ordering: the far right of the row is drawn first.
    mesh.renderOrder = -i;
    scene.add(mesh);
    panes.push(mesh);
  }

  return { scene, camera, panes, disposables };
};

const makeSceneFactory =
  (props: GlassPanesRowProps) =>
  (ctx: SceneContext): SceneApi => {
    const built = buildScene(ctx, props);
    const { scene, camera, panes } = built;
    const swing = THREE.MathUtils.degToRad(props.swingDegrees);

    // The row is laid out from the origin outwards, so shift it back by half
    // its own length to keep the pivot in the middle of the group.
    const centreX = ((props.paneCount - 1) * props.stepX) / 2;
    const centreZ = ((props.paneCount - 1) * props.stepZ) / 2;
    const baseAngle = THREE.MathUtils.degToRad(props.baseAngleDegrees);

    const update = (progress: number) => {
      const phase = TAU * progress;

      for (let i = 0; i < panes.length; i++) {
        const pane = panes[i];
        // Synchronised, with a small progressive lag down the row so the
        // group breathes instead of moving as one rigid object.
        const lag = i * props.waveLag;
        pane.rotation.y = baseAngle + swing * Math.sin(phase + lag);
        // A shallow travelling wave in the spacing: the reference's gaps
        // visibly open and close as the panes pivot.
        pane.position.x =
          i * props.stepX - centreX + 0.07 * Math.sin(phase * 2 + i * 0.5);
        pane.position.z = i * props.stepZ - centreZ;
      }

      // Row sits left of centre with the far end trailing into clear white
      // on the right.
      // Close enough that the panes run off the top and bottom of frame, as
      // in the reference, and pushed right so the row trails into clear
      // white on that side.
      camera.position.set(
        props.cameraX + 0.16 * Math.sin(phase),
        0,
        props.cameraZ + 0.25 * Math.sin(phase + 1.8),
      );
      camera.lookAt(props.targetX, 0, 0);
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

export const GlassPanesRow: React.FC<GlassPanesRowProps> = (props) => {
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
      supersample={1.5}
    />
  );
};
