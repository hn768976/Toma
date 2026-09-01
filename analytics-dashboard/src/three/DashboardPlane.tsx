/**
 * The dashboard, mapped onto a single tilted plane.
 *
 * No new dashboard content is authored here. `useDashboardBuffer` gives back the
 * very same offscreen canvas version 1 blits to the screen; this wraps it in a
 * THREE.CanvasTexture and re-uploads it every frame.
 *
 * The material is a MeshBasicMaterial and the scene has NO lights — the
 * dashboard is already lit by its own design, and a lit material here would
 * either grey it out or (with no lights at all) render the plane black.
 */

import { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { DESIGN_ASPECT } from "../dashboard/layout";
import { PLANE_HEIGHT, PLANE_ROTATION, PLANE_WIDTH } from "./scene";

/** Corner radius as a fraction of the plane's height. */
const CORNER_RADIUS = 0.045;
/**
 * Lens fringe strength. The per-channel UV offset grows with the square of the
 * distance from the plane's centre, so it is invisible in the middle and about
 * four pixels at the edges of a 4K frame — where a real lens puts it.
 */
const CHROMATIC_STRENGTH = 0.0065;

/**
 * Rounded-corner mask, built once. Used as the plane's alphaMap so the panel
 * reads as a physical display with an edge rather than a floating rectangle.
 */
const buildCornerMask = (): THREE.CanvasTexture => {
  const width = 1024;
  const height = Math.round(width / DESIGN_ASPECT);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not build the plane's corner mask");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  const radius = height * CORNER_RADIUS;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.arcTo(width, 0, width, height, radius);
  ctx.arcTo(width, height, 0, height, radius);
  ctx.arcTo(0, height, 0, 0, radius);
  ctx.arcTo(0, 0, width, 0, radius);
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
};

const SHEEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * A wide, very low opacity light band raked across the panel and drifting
 * slowly, plus a tighter secondary streak. Masked to the same rounded rectangle
 * as the plane so it never spills past the corners.
 */
const SHEEN_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform float uOffset;
  uniform float uAspect;
  uniform float uRadius;
  uniform vec3 uColor;

  void main() {
    vec2 p = abs(vUv - 0.5) * vec2(uAspect, 1.0);
    vec2 b = vec2(uAspect * 0.5, 0.5) - vec2(uRadius);
    float sd = length(max(p - b, 0.0)) - uRadius;
    float mask = 1.0 - smoothstep(-0.004, 0.004, sd);

    float d = (vUv.x * 0.85 + vUv.y * 0.55) - uOffset;
    float wide = exp(-pow(d / 0.19, 2.0)) * 0.075;
    float streak = exp(-pow((d - 0.26) / 0.045, 2.0)) * 0.045;

    float a = (wide + streak) * mask;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export type DashboardPlaneProps = {
  /** The dashboard's own offscreen canvas, repainted for the current frame. */
  buffer: HTMLCanvasElement;
  sheenColor: string;
};

export const DashboardPlane: React.FC<DashboardPlaneProps> = ({ buffer, sheenColor }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const texture = useMemo(() => {
    const created = new THREE.CanvasTexture(buffer);
    created.colorSpace = THREE.SRGBColorSpace;
    created.minFilter = THREE.LinearFilter;
    created.magFilter = THREE.LinearFilter;
    created.generateMipmaps = false;
    created.anisotropy = 8;
    return created;
  }, [buffer]);

  const cornerMask = useMemo(buildCornerMask, []);

  const material = useMemo(() => {
    const created = new THREE.MeshBasicMaterial({
      map: texture,
      alphaMap: cornerMask,
      transparent: true,
      toneMapped: false,
      side: THREE.FrontSide,
    });
    // Patch the map lookup into a three-tap, per-channel one. This keeps the
    // material a plain unlit MeshBasicMaterial while giving the plane the
    // colour fringe a lens would produce towards its edges.
    created.onBeforeCompile = (shader) => {
      shader.uniforms.uChromatic = { value: CHROMATIC_STRENGTH };
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "uniform float uChromatic;\nvoid main() {")
        .replace(
          "#include <map_fragment>",
          /* glsl */ `
          #ifdef USE_MAP
            vec2 caCentered = vMapUv - 0.5;
            vec2 caOffset = caCentered * dot(caCentered, caCentered) * uChromatic;
            vec4 caR = texture2D(map, vMapUv + caOffset);
            vec4 caG = texture2D(map, vMapUv);
            vec4 caB = texture2D(map, vMapUv - caOffset);
            vec4 sampledDiffuseColor = vec4(caR.r, caG.g, caB.b, caG.a);
            diffuseColor *= sampledDiffuseColor;
          #endif
        `,
        );
    };
    return created;
  }, [texture, cornerMask]);

  const sheenMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SHEEN_VERTEX,
        fragmentShader: SHEEN_FRAGMENT,
        uniforms: {
          uOffset: { value: 0 },
          uAspect: { value: DESIGN_ASPECT },
          uRadius: { value: CORNER_RADIUS },
          uColor: { value: new THREE.Color(sheenColor) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [sheenColor],
  );

  // Both updates run in a layout effect, which is guaranteed to complete before
  // @remotion/three's ManualFrameRenderer calls `advance()` in its passive
  // effect. Doing either in a passive effect would upload one frame late.
  useLayoutEffect(() => {
    texture.needsUpdate = true;
    // A slow drift across the panel over the shot; not a loop, so it does not
    // need to return to where it started.
    sheenMaterial.uniforms.uOffset.value = -0.35 + (frame / durationInFrames) * 1.9;
  }, [frame, durationInFrames, texture, sheenMaterial]);

  return (
    <group rotation={PLANE_ROTATION}>
      <mesh material={material}>
        <planeGeometry args={[PLANE_WIDTH, PLANE_HEIGHT]} />
      </mesh>
      <mesh material={sheenMaterial} position={[0, 0, 0.012]}>
        <planeGeometry args={[PLANE_WIDTH, PLANE_HEIGHT]} />
      </mesh>
    </group>
  );
};
