import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

import { Aircraft } from "./Aircraft";
import { DepthLines } from "./DepthLines";
import { buildGraticule, buildRoutes } from "./lines";
import { circleOfConfusion } from "./dof";
import { computeRig, sampleKeyframes, type RigState } from "./rig";
import type { CompanionConfig, SceneConfig } from "./scene-config";
import { DEG } from "./sphere";
import {
  ASPECT,
  BACKGROUND_COLOR,
  BASE_HEIGHT,
  BASE_WIDTH,
  BOKEH_K,
  FOG_DENSITY,
  GLOBE_RADIUS,
  GRID_LINE_INTENSITY,
  GRID_LINE_WIDTH_PX,
  MAX_COC_PX,
  PLANE_WINGSPAN,
  ROUTE_LINE_INTENSITY,
  ROUTE_LINE_WIDTH_PX,
} from "./constants";

// The graticule is identical for every composition and costs a few ms to
// build, so it is cached across renders rather than rebuilt per frame.
let cachedGraticule: ReturnType<typeof buildGraticule> | null = null;
const getGraticule = () => {
  if (!cachedGraticule) cachedGraticule = buildGraticule();
  return cachedGraticule;
};

const CAM_FORWARD = new THREE.Vector3(0, 0, -1);
const CAM_RIGHT = new THREE.Vector3(1, 0, 0);
const CAM_UP = new THREE.Vector3(0, 1, 0);

// Places a companion at an explicit screen position and depth, by walking
// out along the camera's own basis. Returns its world transform.
const companionMatrix = (
  rig: RigState,
  companion: CompanionConfig,
  t: number,
  fovDeg: number,
): THREE.Matrix4 => {
  const distance = sampleKeyframes(companion.depthRatio, t) * rig.focusDistance;
  const halfHeight = Math.tan((fovDeg * DEG) / 2) * distance;

  const position = rig.camPosition
    .clone()
    .addScaledVector(
      CAM_FORWARD.clone().applyQuaternion(rig.camQuaternion),
      distance,
    )
    .addScaledVector(
      CAM_RIGHT.clone().applyQuaternion(rig.camQuaternion),
      sampleKeyframes(companion.screenX, t) * halfHeight * ASPECT,
    )
    .addScaledVector(
      CAM_UP.clone().applyQuaternion(rig.camQuaternion),
      sampleKeyframes(companion.screenY, t) * halfHeight,
    );

  // A steep placement low in frame can land under the surface; lift it
  // back to a plausible cruising altitude rather than letting it clip.
  const radius = position.length();
  const minRadius = GLOBE_RADIUS + 10;
  if (radius < minRadius) position.multiplyScalar(minRadius / radius);

  const up = position.clone().normalize();
  const forward = rig.planeForward
    .clone()
    .applyAxisAngle(up, sampleKeyframes(companion.headingOffsetDeg, t) * DEG)
    .projectOnPlane(up)
    .normalize();
  const right = new THREE.Vector3().crossVectors(up, forward).normalize();

  return new THREE.Matrix4()
    .makeBasis(right, up, forward)
    .setPosition(position);
};

type LayerProps = {
  config: SceneConfig;
  rig: RigState;
  t: number;
  width: number;
  height: number;
  resolutionScale: number;
};

// Grid, routes and the in-focus hero aircraft. Opaque, so the additive
// line blending resolves against a real black rather than against alpha.
const WorldLayer: React.FC<LayerProps> = ({
  config,
  rig,
  t,
  width,
  height,
  resolutionScale,
}) => {
  const graticule = getGraticule();
  const routes = useMemo(
    () => buildRoutes(config.routeSeed),
    [config.routeSeed],
  );

  const lineCommon = {
    resolution: [width, height] as [number, number],
    focus: rig.focusDistance,
    bokehK: BOKEH_K * resolutionScale,
    maxCocPx: MAX_COC_PX * resolutionScale,
    fogDensity: FOG_DENSITY,
    near: config.rig.near,
  };

  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={config.rig.fovDeg}
        near={config.rig.near}
        far={config.rig.far}
        position={[rig.camPosition.x, rig.camPosition.y, rig.camPosition.z]}
        quaternion={[
          rig.camQuaternion.x,
          rig.camQuaternion.y,
          rig.camQuaternion.z,
          rig.camQuaternion.w,
        ]}
      />
      <DepthLines
        {...lineCommon}
        batch={graticule}
        widthPx={GRID_LINE_WIDTH_PX * resolutionScale}
        opacity={GRID_LINE_INTENSITY * sampleKeyframes(config.gridOpacity, t)}
        renderOrder={0}
      />
      <DepthLines
        {...lineCommon}
        batch={routes}
        widthPx={ROUTE_LINE_WIDTH_PX * resolutionScale}
        opacity={ROUTE_LINE_INTENSITY * sampleKeyframes(config.routeOpacity, t)}
        renderOrder={1}
      />
      <Aircraft
        matrix={rig.planeMatrix}
        scale={(PLANE_WINGSPAN / 30) * config.heroScale}
      />
    </>
  );
};

// One companion aircraft, alone on a transparent canvas so the whole layer
// can be blurred by its circle of confusion. Doing the defocus in CSS is
// exact for a single small object at a single depth, and avoids running a
// full-frame bokeh pass over a scene that is otherwise black.
const CompanionLayer: React.FC<LayerProps & { companion: CompanionConfig }> = ({
  config,
  rig,
  t,
  companion,
}) => {
  const matrix = companionMatrix(rig, companion, t, config.rig.fovDeg);

  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={config.rig.fovDeg}
        near={config.rig.near}
        far={config.rig.far}
        position={[rig.camPosition.x, rig.camPosition.y, rig.camPosition.z]}
        quaternion={[
          rig.camQuaternion.x,
          rig.camQuaternion.y,
          rig.camQuaternion.z,
          rig.camQuaternion.w,
        ]}
      />
      <Aircraft
        matrix={matrix}
        scale={(PLANE_WINGSPAN / 30) * companion.scale}
        opacity={sampleKeyframes(companion.opacity, t)}
      />
    </>
  );
};

export type FlightGridSceneProps = {
  config: SceneConfig;
  /** 1 = 1080p, 2 = 4K. Scales every px-denominated value. */
  resolutionScale: number;
};

export const FlightGridScene: React.FC<FlightGridSceneProps> = ({
  config,
  resolutionScale,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const timeSec = frame / fps;
  const t = timeSec / config.rig.durationSec;

  const rig = computeRig(config.rig, timeSec);

  const layerProps = {
    config,
    rig,
    t,
    width,
    height,
    resolutionScale,
  };

  const glOptions = {
    antialias: true,
    toneMapping: THREE.NoToneMapping,
    // Colours are authored directly in sRGB; nothing here is lit, so the
    // linear workflow would only round-trip the same values.
    outputColorSpace: THREE.SRGBColorSpace,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: BACKGROUND_COLOR }}>
      <ThreeCanvas
        width={width}
        height={height}
        gl={{ ...glOptions, alpha: false }}
        style={{ position: "absolute", inset: 0 }}
      >
        <color attach="background" args={[BACKGROUND_COLOR]} />
        <WorldLayer {...layerProps} />
      </ThreeCanvas>

      {config.companions.map((companion, index) => {
        const matrix = companionMatrix(rig, companion, t, config.rig.fovDeg);
        const distance = new THREE.Vector3()
          .setFromMatrixPosition(matrix)
          .distanceTo(rig.camPosition);
        const coc = circleOfConfusion(
          distance,
          rig.focusDistance,
          BOKEH_K * resolutionScale,
          MAX_COC_PX * resolutionScale * 2.4,
        );
        return (
          <AbsoluteFill
            key={index}
            style={{
              filter: `blur(${(coc * 0.5).toFixed(2)}px)`,
              mixBlendMode: "screen",
            }}
          >
            <ThreeCanvas
              width={width}
              height={height}
              gl={{ ...glOptions, alpha: true }}
              style={{ position: "absolute", inset: 0 }}
            >
              <CompanionLayer {...layerProps} companion={companion} />
            </ThreeCanvas>
          </AbsoluteFill>
        );
      })}

      {/* Lens falloff. Both references are noticeably darker into the
          corners than a plain fog curve would make them. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse ${
            (BASE_WIDTH / BASE_HEIGHT) * 62
          }% 72% at 50% 46%, rgba(0,0,0,0) 38%, rgba(0,0,0,${
            config.vignette * 0.55
          }) 72%, rgba(0,0,0,${config.vignette}) 100%)`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
