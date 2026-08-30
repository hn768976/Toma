import {
  Bloom,
  DepthOfField,
  EffectComposer,
  EffectComposerContext,
} from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { DURATION_IN_FRAMES, HEIGHT, WIDTH } from "./constants";
import { createDashboardRenderer, type DashboardRenderer } from "./dashboard";
import { useHudFonts } from "./fonts";
import { useWorld } from "./map/geo";
import type { Ctx2D } from "./paint";
import {
  TEXTURE_SOURCE_VARIANT,
  VARIANTS,
  type Palette,
  type VariantName,
} from "./variants";

/**
 * v3 "tilted": v1's dashboard, re-rendered into an offscreen canvas each frame
 * and mapped onto a tilted plane, with a camera moving across it.
 *
 * No dashboard content is rebuilt here. The plane's texture is exactly what
 * GeoHudBlue draws - same renderer, same frame number, same 900-frame loop.
 */

/** Plane size in world units, matching the dashboard's 16:9 aspect. */
export const PLANE_W = 16;
export const PLANE_H = (PLANE_W * HEIGHT) / WIDTH;
export const PLANE_ROT_X = THREE.MathUtils.degToRad(8);
export const PLANE_ROT_Y = THREE.MathUtils.degToRad(-22);
export const CORNER_RADIUS = 0.3;

export const FOV = 38;
export const NEAR = 0.1;
export const FAR = 100;

/** Camera distance at frame 0, and how much closer it gets at the midpoint. */
export const CAM_DIST = 11.8;
export const CAM_PUSH = 1.5;
export const CAM_SWEEP_X = 2.2;
export const CAM_SWEEP_Y = 0.45;

/**
 * The dashboard texture. 1920x1080 rather than 3840x2160: at this tilt, with
 * depth-of-field over most of the plane, the difference is invisible and it
 * roughly quarters the per-frame texture cost - which is the single most
 * expensive thing this composition does.
 */
export const TEXTURE_SCALE = 0.5;

export const DOF_FOCAL_LENGTH = 0.055;
export const DOF_BOKEH_SCALE = 3.4;
export const BLOOM_INTENSITY = 0.32;
export const BLOOM_THRESHOLD = 0.62;
export const SHEEN_OPACITY = 0.075;

/**
 * A closed camera path. Every term returns to its frame-0 value at frame 900:
 * sin() completes whole cycles and the push-in uses (1 - cos)/2, so the move
 * eases in, pushes in, and eases back out to exactly where it started.
 */
export const cameraAt = (frame: number) => {
  const t = ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) %
    DURATION_IN_FRAMES /
    DURATION_IN_FRAMES;
  const tau = Math.PI * 2 * t;

  // Handheld wobble on sines whose periods (225, 150, 180, 300 frames) all
  // divide 900.
  const wobbleX = 0.05 * Math.sin(tau * 4) + 0.03 * Math.sin(tau * 6);
  const wobbleY = 0.04 * Math.sin(tau * 5) + 0.025 * Math.cos(tau * 3);

  const sweep = Math.sin(tau);
  const push = (1 - Math.cos(tau)) / 2;

  const x = sweep * CAM_SWEEP_X + wobbleX;
  const y = Math.sin(tau * 2) * CAM_SWEEP_Y + wobbleY + 0.3;
  const z = CAM_DIST - CAM_PUSH * push;

  return {
    position: [x, y, z] as [number, number, number],
    // The look-at point trails the camera, so the move reads as a truck across
    // the surface rather than an orbit around its centre.
    target: [x * 0.45, y * 0.3, 0] as [number, number, number],
  };
};

/** A plane with rounded corners, so it reads as a physical panel with an edge.
 *  ShapeGeometry derives UVs from raw vertex positions, so they are remapped to
 *  0..1 across the bounding box or the texture will not sit on the plane. */
const roundedPlane = (w: number, h: number, r: number) => {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);

  const geometry = new THREE.ShapeGeometry(shape, 10);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox as THREE.Box3;
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const sx = box.max.x - box.min.x;
  const sy = box.max.y - box.min.y;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(
      i,
      (position.getX(i) - box.min.x) / sx,
      (position.getY(i) - box.min.y) / sy,
    );
  }
  uv.needsUpdate = true;
  return geometry;
};

/** A wide, very low-opacity light band angled across the plane, drifting on a
 *  cycle that closes at frame 900. Additive and unlit - no lights anywhere in
 *  this scene. */
const sheenMaterial = (palette: Palette) =>
  new THREE.ShaderMaterial({
    uniforms: {
      uShift: { value: 0 },
      uColor: { value: new THREE.Color(palette.mapOutline) },
      uOpacity: { value: SHEEN_OPACITY },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uShift;
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        float d = (vUv.x * 0.74 + vUv.y * 0.26) * 0.6;
        float band = fract(d - uShift);
        float mask = smoothstep(0.0, 0.18, band) * (1.0 - smoothstep(0.18, 0.46, band));
        gl_FragColor = vec4(uColor, mask * uOpacity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

/**
 * <EffectComposer /> publishes its composer through a setState inside an
 * effect, and only renders its children once that state exists. @remotion/three
 * advances the r3f loop from its own effect in the same commit - at which point
 * the composer's useFrame callback still sees a null composer, skips the render,
 * and (because the composer holds render priority) r3f does not draw either.
 * The frame lands black.
 *
 * Mounting this inside <EffectComposer /> fixes it: it mounts in the commit
 * where the composer first exists, and advances the loop once more so the
 * frame is actually drawn. Later frames are driven by @remotion/three as usual.
 */
const ComposerReadySync: React.FC = () => {
  const advance = useThree((s) => s.advance);
  const context = useContext(EffectComposerContext);
  const composer = context?.composer ?? null;
  const [settled, setSettled] = useState(0);

  // <EffectComposer /> needs three commits before it is ready to draw: one to
  // create the composer, one to scan its children, and one to attach the built
  // passes. Re-render until they have all happened.
  useEffect(() => {
    if (settled < 2) setSettled((s) => s + 1);
  });

  useEffect(() => {
    if (!composer) return;
    // performance.now() is only the r3f loop's timestamp argument - the same
    // one @remotion/three passes. Nothing in this scene reads a delta; the
    // camera, the texture and the sheen are all driven by useCurrentFrame().
    advance(performance.now());
  }, [advance, composer, settled]);

  return null;
};

/** Drives the default camera from useCurrentFrame(). Never useFrame/delta -
 *  the camera must be a pure function of the frame number. */
const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    const { position, target } = cameraAt(frame);
    camera.fov = FOV;
    camera.near = NEAR;
    camera.far = FAR;
    camera.aspect = size.width / size.height;
    camera.up.set(0, 1, 0);
    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(target[0], target[1], target[2]);
    camera.updateProjectionMatrix();
  });

  return null;
};

const DashboardPlane: React.FC<{
  renderer: DashboardRenderer;
  palette: Palette;
}> = ({ renderer, palette }) => {
  const frame = useCurrentFrame();
  const invalidate = useThree((s) => s.invalidate);

  const { texture, ctx } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(WIDTH * TEXTURE_SCALE);
    canvas.height = Math.round(HEIGHT * TEXTURE_SCALE);
    const context = canvas.getContext("2d") as Ctx2D;
    const canvasTexture = new THREE.CanvasTexture(canvas);
    canvasTexture.colorSpace = THREE.SRGBColorSpace;
    canvasTexture.minFilter = THREE.LinearFilter;
    canvasTexture.magFilter = THREE.LinearFilter;
    canvasTexture.generateMipmaps = false;
    return { texture: canvasTexture, ctx: context };
  }, []);

  const geometry = useMemo(
    () => roundedPlane(PLANE_W, PLANE_H, CORNER_RADIUS),
    [],
  );
  const sheen = useMemo(() => sheenMaterial(palette), [palette]);

  // Redraw the dashboard for THIS frame and upload it before three renders.
  // A layout effect in a child runs before the ThreeCanvas parent's effects,
  // so the texture is always the frame the scene is about to be drawn with.
  useLayoutEffect(() => {
    ctx.save();
    ctx.setTransform(TEXTURE_SCALE, 0, 0, TEXTURE_SCALE, 0, 0);
    renderer.render(ctx, frame);
    ctx.restore();
    texture.needsUpdate = true;
    sheen.uniforms.uShift.value =
      (((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) %
        DURATION_IN_FRAMES) /
      DURATION_IN_FRAMES;
    invalidate();
  });

  return (
    <group rotation={[PLANE_ROT_X, PLANE_ROT_Y, 0]}>
      <mesh geometry={geometry}>
        {/* No lights: the dashboard is already lit by its own design. */}
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh geometry={geometry} material={sheen} position={[0, 0, 0.004]} />
    </group>
  );
};

export const GeoHudTilted: React.FC<{ variant: VariantName }> = ({
  variant,
}) => {
  const { width, height, fps } = useVideoConfig();
  const world = useWorld();
  const fonts = useHudFonts();
  const shell = VARIANTS[variant];
  // The texture is v1's dashboard, unchanged.
  const source = VARIANTS[TEXTURE_SOURCE_VARIANT];

  const renderer = useMemo(
    () =>
      world && fonts
        ? createDashboardRenderer({ variant: source, world, fonts, fps })
        : null,
    [world, fonts, source, fps],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: shell.palette.background }}>
      {renderer ? (
        <ThreeCanvas
          width={width}
          height={height}
          camera={{ fov: FOV, near: NEAR, far: FAR, position: [0, 0, CAM_DIST] }}
        >
          <CameraRig />
          <DashboardPlane renderer={renderer} palette={source.palette} />
          {/* multisampling 0: the texture is already antialiased and the DOF
              pass softens the plane's edges, so MSAA only costs render time. */}
          <EffectComposer multisampling={0}>
            {/* Focused on the plane's mid-distance, so the near and far edges
                of the tilt both soften - the reason this is 3D and not a skew. */}
            <DepthOfField
              target={[0, 0, 0]}
              focalLength={DOF_FOCAL_LENGTH}
              bokehScale={DOF_BOKEH_SCALE}
            />
            <Bloom
              intensity={BLOOM_INTENSITY}
              luminanceThreshold={BLOOM_THRESHOLD}
              luminanceSmoothing={0.25}
              mipmapBlur
            />
            <ComposerReadySync />
          </EffectComposer>
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
