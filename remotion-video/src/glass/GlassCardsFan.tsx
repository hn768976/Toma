import React, { useMemo } from "react";
import * as THREE from "three";
import { z } from "zod";
import { TAU } from "./constants";
import { createEnvironmentTexture } from "./environment";
import { bendGeometry, createSlabGeometry } from "./geometry";
import { createPhysicalMaterial } from "./materials";
import { sampleRamp } from "./ramp";
import { ThreeStage, type SceneApi, type SceneContext } from "./ThreeStage";

export const glassCardsFanSchema = z.object({
  cardCount: z.number().int().min(4).max(20),
  /** Peak splay between neighbouring cards, in degrees. */
  fanDegrees: z.number().min(0).max(40),
  exposure: z.number().min(0.2).max(3),
});

export type GlassCardsFanProps = z.infer<typeof glassCardsFanSchema>;

export const glassCardsFanDefaults: GlassCardsFanProps = {
  cardCount: 13,
  fanDegrees: 9.5,
  exposure: 0.82,
};

/** Front (hot magenta) through to back (icy lavender), matching the reference. */
const CARD_RAMP = [
  "#e6179f",
  "#c00fbe",
  "#8e18cf",
  "#6229d9",
  "#4f4ae4",
  "#8b8fe8",
  "#cfd0ea",
  "#f4f4fb",
] as const;

const CARD_WIDTH = 3.0;
const CARD_HEIGHT = 3.7;
const CARD_DEPTH = 0.26;
const CARD_RADIUS = 0.95;
/** Gap between neighbouring cards when the fan is at rest. */
const STACK_GAP = 0.34;
/** Reciprocal of the bend radius. Small: a very gentle wrap, not a tube. */
const CARD_CURVATURE = 0.115;
/** Diagonal stagger per card, so the resting stack reads as many panels. */
const STAGGER = new THREE.Vector2(0.09, 0.115);

type Built = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  hinges: THREE.Group[];
  disposables: { dispose: () => void }[];
};

const buildScene = (ctx: SceneContext, props: GlassCardsFanProps): Built => {
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
    lights: [
      // Narrow hot strip camera-right — the travelling glint on the rims.
      { u: 0.34, v: 0.2, w: 0.045, h: 0.26, color: "#ffffff", intensity: 1, blur: 26 },
      // Broad cool fill camera-left.
      { u: 0.76, v: 0.3, w: 0.15, h: 0.3, color: "#cfd8ff", intensity: 0.55, blur: 80 },
      // Magenta bounce from low and left — the hot core inside the fan.
      { u: 0.08, v: 0.72, w: 0.24, h: 0.26, color: "#ff1f9e", intensity: 0.85, blur: 90 },
      // Violet kicker from behind, which separates the back cards from black.
      { u: 0.92, v: 0.58, w: 0.17, h: 0.22, color: "#6b3dff", intensity: 0.42, blur: 80 },
      // Second white strip so rims get a double highlight as they rotate.
      { u: 0.56, v: 0.12, w: 0.028, h: 0.18, color: "#ffffff", intensity: 0.85, blur: 18 },
    ],
  });
  scene.environment = environment;
  scene.environmentIntensity = 1.05;

  // The environment does nearly all the work on a metallic surface; these
  // only exist to put a crisp specular dot on the rims that the blurred
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
    }),
    CARD_CURVATURE,
  );

  const disposables: { dispose: () => void }[] = [geometry, environment];
  const hinges: THREE.Group[] = [];

  for (let i = 0; i < props.cardCount; i++) {
    const t = props.cardCount === 1 ? 0 : i / (props.cardCount - 1);
    const color = sampleRamp(CARD_RAMP, t);

    const material = createPhysicalMaterial(ctx.useNodeMaterials, {
      color,
      // Close to a pure coloured metal: the face colour becomes
      // environment x base colour, which is what gives the reference its
      // deep, almost-black shadow side and blown-out highlight side on the
      // same panel. A diffuse material just reads as a flat sticker.
      // Saturated cards behave like polished anodised metal; the pale ones
      // are dialled back towards a pearl lacquer, otherwise they mirror the
      // violet kicker and come back indigo instead of white.
      metalness: 0.92 - t * 0.5,
      roughness: 0.085 + t * 0.03,
      // Clear lacquer over the metal adds the tight white streak that rides
      // the rounded rim independently of the body colour.
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      iridescence: 0.22,
      iridescenceIOR: 1.36,
      // Just enough self-emission to keep the deepest crevices from crushing
      // to pure black between the cards.
      emissive: color.clone().multiplyScalar(0.03),
      envMapIntensity: 1.15,
    });
    disposables.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    // Hinge sits on the card's left edge, so the stack opens like a book
    // rather than pinwheeling around its middle.
    mesh.position.set(CARD_WIDTH / 2, 0, 0);

    const hinge = new THREE.Group();
    hinge.add(mesh);
    root.add(hinge);
    hinges.push(hinge);
  }

  return { scene, camera, root, hinges, disposables };
};

const makeSceneFactory =
  (props: GlassCardsFanProps) =>
  (ctx: SceneContext): SceneApi => {
    const built = buildScene(ctx, props);
    const { scene, camera, root, hinges } = built;
    const fanPeak = THREE.MathUtils.degToRad(props.fanDegrees);

    const update = (progress: number) => {
      const phase = TAU * progress;

      // Shut -> fully fanned -> shut. Raised-cosine, so both the value and
      // its derivative match at the loop point.
      const openness = 0.5 - 0.5 * Math.cos(phase);
      const fan = THREE.MathUtils.degToRad(5.5) + fanPeak * openness;

      for (let i = 0; i < hinges.length; i++) {
        const hinge = hinges[i];
        const centred = i - (hinges.length - 1) / 2;
        hinge.rotation.y = centred * fan;
        // Cards slide diagonally as well as back, so even at rest the stack
        // reads as a spread deck rather than a single front panel.
        const spread = 1 - 0.3 * openness;
        hinge.position.set(
          -CARD_WIDTH / 2 + centred * STAGGER.x * spread,
          centred * STAGGER.y * spread,
          -i * STACK_GAP * (1 - 0.34 * openness),
        );
      }

      // Bounded, not a full revolution. The reference never lets the stack
      // swing away from its corner of frame, which is what keeps the right
      // third reliably empty for a lockup; a continuous spin would drag the
      // subject through the clear area twice per loop.
      root.rotation.z = -0.5 + 0.3 * Math.sin(phase);
      root.rotation.x = -0.12 + 0.17 * Math.sin(phase + 1.3);
      root.rotation.y = -0.28 + 0.22 * Math.sin(phase * 2 + 0.5);

      // Subject sits left of centre and overruns the frame, as in the
      // reference: the right third stays black, which leaves room for a
      // title or logo lockup.
      root.position.set(-1.5, -0.2, 0);

      camera.position.set(0, 0, 6.2 + 0.4 * Math.sin(phase - 0.5));
      camera.lookAt(-1.15, -0.12, 0);
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

export const GlassCardsFan: React.FC<GlassCardsFanProps> = (props) => {
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
      background="#000000"
      supersample={1.5}
    />
  );
};
