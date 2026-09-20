import React, { useMemo } from "react";
import * as THREE from "three";
import { z } from "zod";
import { TAU } from "./constants";
import { createEnvironmentTexture } from "./environment";
import { bendGeometry, createSlabGeometry } from "./geometry";
import { createPhysicalMaterial } from "./materials";
import { sampleRamp } from "./ramp";
import { pivotWave, placeOnRing, radiusForGap, ringAngle } from "./ring";
import { ThreeStage, type SceneApi, type SceneContext } from "./ThreeStage";

export const glassCardsRingSchema = z.object({
  cardCount: z.number().int().min(6).max(36),
  /** Clear arc left between neighbouring cards, in world units. */
  cardGap: z.number().min(0).max(3),
  /** Resting pivot of each card away from tangent, in degrees. */
  baseAngleDegrees: z.number().min(-89).max(89),
  /** Amplitude of the per-card pivot, in degrees. */
  swingDegrees: z.number().min(0).max(60),
  /** Whole cycles of the pivot wave around the ring. Integer keeps it seamless. */
  waveCycles: z.number().int().min(0).max(12),
  /** Whole cycles of the pivot wave over the loop. Integer keeps it seamless. */
  waveSpeed: z.number().int().min(0).max(4),
  /**
   * Revolutions of the ring over the loop.
   *
   * Seamless at any fraction that lands each card on another card's start
   * position *and* on a matching colour, i.e. any multiple of
   * `rampRepeats / cardCount` turns. With 16 cards and the ramp repeated
   * twice, a half turn qualifies and is half as fast as a whole one.
   */
  spinTurns: z.number().min(0).max(4),
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

export type GlassCardsRingProps = z.infer<typeof glassCardsRingSchema>;

export const glassCardsRingDefaults: GlassCardsRingProps = {
  cardCount: 16,
  cardGap: 0.3,
  baseAngleDegrees: 40,
  swingDegrees: 13,
  waveCycles: 2,
  waveSpeed: 1,
  spinTurns: 0.5,
  rampRepeats: 2,
  rampOffset: 0.25,
  cameraZ: 13.5,
  ringOffsetX: -1.3,
  exposure: 0.82,
};

/**
 * Cyclic: the last stop equals the first, so the ring has no colour seam at
 * the wrap-around. Sampled at `i / count` rather than `i / (count - 1)`.
 */
const CARD_RAMP = [
  "#e6179f",
  "#c614c6",
  "#9b20d4",
  "#7526dc",
  "#5733e2",
  "#4a46e8",
  "#7d81e6",
  "#cfd0ea",
  "#f2f0fb",
  "#dd9ada",
  "#e6179f",
] as const;

const CARD_WIDTH = 3;
const CARD_HEIGHT = 3.7;
const CARD_DEPTH = 0.26;
const CARD_RADIUS = 0.95;
/** Reciprocal of the bend radius. Small: a very gentle wrap, not a tube. */
const CARD_CURVATURE = 0.115;

type Built = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  cards: THREE.Mesh[];
  disposables: { dispose: () => void }[];
};

const buildScene = (ctx: SceneContext, props: GlassCardsRingProps): Built => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#000000");

  const environment = createEnvironmentTexture({
    // A bright overhead softbox falling off to near-black below. On a
    // near-metal card this ramp becomes the shading: every face picks up a
    // light-to-dark sweep whose angle changes as the card swings.
    stops: [
      { at: 0, color: "#ffffff" },
      { at: 0.13, color: "#f4f2ff" },
      { at: 0.26, color: "#a49ed4" },
      { at: 0.36, color: "#413a6b" },
      { at: 0.46, color: "#161230" },
      { at: 0.6, color: "#070613" },
      { at: 1, color: "#010103" },
    ],
    // Every source here is broad and heavily blurred on purpose. Small, hot
    // softboxes put a two-pixel specular dot on the rims that jumps several
    // pixels between frames and reads as sparkle; widening them turns the
    // same highlight into a streak that travels smoothly.
    lights: [
      { u: 0.34, v: 0.2, w: 0.11, h: 0.3, color: "#ffffff", intensity: 0.95, blur: 80 },
      { u: 0.76, v: 0.3, w: 0.16, h: 0.3, color: "#cfd8ff", intensity: 0.55, blur: 100 },
      { u: 0.08, v: 0.72, w: 0.24, h: 0.26, color: "#ff1f9e", intensity: 0.85, blur: 100 },
      { u: 0.92, v: 0.58, w: 0.19, h: 0.24, color: "#6b3dff", intensity: 0.42, blur: 95 },
      { u: 0.56, v: 0.12, w: 0.08, h: 0.2, color: "#ffffff", intensity: 0.8, blur: 60 },
    ],
  });
  scene.environment = environment;
  scene.environmentIntensity = 1.05;

  // The environment does nearly all the work on a metallic surface; these
  // only exist to put a broad specular sheen on the rims that the blurred
  // softboxes cannot provide on their own.
  const key = new THREE.DirectionalLight("#ffffff", 1.35);
  key.position.set(3.2, 5.4, 4.2);
  const magenta = new THREE.DirectionalLight("#ff3bb4", 0.75);
  magenta.position.set(-4.4, -2.8, 2.6);
  scene.add(key, magenta);

  const camera = new THREE.PerspectiveCamera(36, ctx.aspect, 0.1, 100);

  const root = new THREE.Group();
  scene.add(root);

  const geometry = bendGeometry(
    createSlabGeometry({
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      depth: CARD_DEPTH,
      radius: CARD_RADIUS,
      // A denser rim: the bevel is the brightest, fastest-moving part of the
      // frame, so it is the first thing to alias if it is under-tessellated.
      bevelSegments: 16,
      curveSegments: 40,
    }),
    CARD_CURVATURE,
  );

  const disposables: { dispose: () => void }[] = [geometry, environment];
  const cards: THREE.Mesh[] = [];

  for (let i = 0; i < props.cardCount; i++) {
    const t = ((i * props.rampRepeats) / props.cardCount + props.rampOffset) % 1;
    const color = sampleRamp(CARD_RAMP, t);
    // Saturation of the ramp, not ring position, decides how metallic a card
    // is: the pale ones mirror the violet kicker and come back indigo unless
    // they are dialled back towards a pearl lacquer.
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);

    const material = createPhysicalMaterial(ctx.useNodeMaterials, {
      color,
      // Close to a pure coloured metal: the face colour becomes
      // environment x base colour, which is what gives the reference its
      // deep, almost-black shadow side and blown-out highlight side on the
      // same panel. A diffuse material just reads as a flat sticker.
      metalness: 0.45 + hsl.s * 0.47,
      // Deliberately not mirror-smooth. Below about 0.1 the specular lobe is
      // narrower than a pixel on these curved rims and crawls frame to frame.
      roughness: 0.14,
      // Clear lacquer over the metal adds the white streak that rides the
      // rounded rim independently of the body colour.
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      iridescence: 0.22,
      iridescenceIOR: 1.36,
      // Just enough self-emission to keep the deepest crevices from crushing
      // to pure black between the cards.
      emissive: color.clone().multiplyScalar(0.03),
      envMapIntensity: 1.15,
    });
    disposables.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    root.add(mesh);
    cards.push(mesh);
  }

  return { scene, camera, root, cards, disposables };
};

const makeSceneFactory =
  (props: GlassCardsRingProps) =>
  (ctx: SceneContext): SceneApi => {
    const built = buildScene(ctx, props);
    const { scene, camera, root, cards } = built;
    const swing = THREE.MathUtils.degToRad(props.swingDegrees);
    const baseAngle = THREE.MathUtils.degToRad(props.baseAngleDegrees);
    // Clearance is checked at the widest pivot the swing reaches, so the
    // gaps never close up at the extremes of the animation.
    const radius = radiusForGap(
      props.cardCount,
      CARD_WIDTH,
      CARD_DEPTH,
      Math.abs(baseAngle) + swing,
      props.cardGap,
    );

    const update = (progress: number) => {
      const phase = TAU * progress;
      // See `spinTurns`: a half turn maps every card onto a neighbour that
      // carries the same colour, so the ring is indistinguishable from its
      // starting state at the wrap-around without spinning twice as fast.
      const spin = phase * props.spinTurns;

      for (let i = 0; i < cards.length; i++) {
        const angle = ringAngle(i, cards.length, spin);
        const pivot =
          baseAngle +
          pivotWave(angle, phase, swing, props.waveCycles, props.waveSpeed);
        placeOnRing(cards[i], angle, radius, pivot);
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

export const GlassCardsRing: React.FC<GlassCardsRingProps> = (props) => {
  const build = useMemo(
    () => makeSceneFactory(props),
    // Rebuild the scene graph only when a prop that changes it actually
    // changes; `props` itself is a fresh object on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(props)],
  );

  return <ThreeStage build={build} exposure={props.exposure} background="#000000" />;
};
