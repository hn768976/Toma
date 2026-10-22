import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { z } from "zod";
import { poseToWorld, referenceCamera, sampleCamera } from "./camera";
import type { CameraKey } from "./camera";
import {
  BOARD_H,
  BOARD_W,
  TEXELS_PER_UNIT,
  UNITS_PER_WORLD,
} from "./constants";
import { drawDashboard } from "./draw";
import { palettes } from "./palettes";
import type { Palette } from "./palettes";

export const financeDashboardSchema = z.object({
  palette: z.enum(["ocean", "ember"]),
  camera: z.enum(["reference"]),
});

export type FinanceDashboardProps = z.infer<typeof financeDashboardSchema>;

const cameras: Record<FinanceDashboardProps["camera"], CameraKey[]> = {
  reference: referenceCamera,
};

// The board plane is far larger than the dashboard so its edge never shows.
const PLANE_SIZE = 160;

const hexToVec3 = (hex: string) => {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
};

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// Board shader:
//  - procedural, anti-aliased grid (lines + dots) that extends forever
//  - widget texture composited on top (premultiplied alpha)
//  - depth of field: mip-level bias / grid softening by distance from focus
//  - cheap bloom from coarse mips, plus a soft light pool and shaded falloff
const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 camPos;
  uniform float focusDist;
  uniform float blurScale;
  uniform vec2 resolution;
  uniform vec3 lightColor;
  uniform vec3 shadeColor;
  uniform vec3 bgColor;
  uniform vec3 gridColor;
  uniform vec2 boardHalf;
  varying vec3 vWorld;

  float gridLine(float coord, float spacing, float halfWidth, float fw) {
    float d = abs(fract(coord / spacing - 0.5) - 0.5) * spacing;
    float a = 1.0 - smoothstep(halfWidth - fw * 0.5, halfWidth + fw * 0.5, d);
    return a * clamp(2.0 * halfWidth / max(fw, 1e-4), 0.0, 1.0);
  }

  void main() {
    float dist = distance(vWorld, camPos);
    float bias = clamp(abs(dist - focusDist) * blurScale, 0.0, 3.5);

    // Board units (+v downwards), matching the canvas layout.
    vec2 bu = vec2(vWorld.x * 100.0 + boardHalf.x, boardHalf.y - vWorld.y * 100.0);
    vec2 fwv = fwidth(bu) * exp2(bias);
    float fw = max(fwv.x, fwv.y);
    float fade = 1.0 - smoothstep(6.0, 16.0, fw);

    float lines = max(gridLine(bu.x, 42.0, 0.8, fwv.x), gridLine(bu.y, 42.0, 0.8, fwv.y));
    vec2 dq = abs(fract(bu / 21.0 - 0.5) - 0.5) * 21.0;
    vec2 cellIdx = mod(floor(bu / 21.0 + 0.5), 2.0);
    float dotMask = cellIdx.x * cellIdx.y;
    float dots = (1.0 - smoothstep(1.6 - fw * 0.5, 1.6 + fw * 0.5, max(dq.x, dq.y)))
      * clamp(3.2 / max(fw, 1e-4), 0.0, 1.0);
    // Dots only at cell centres (odd/odd half-grid positions).
    dots *= dotMask;

    vec3 col = bgColor;
    col += gridColor * (lines * 0.3 + dots * 0.75) * fade;
    col += gridColor * 0.06 * (1.0 - fade);

    vec2 uv = vec2(bu.x / (boardHalf.x * 2.0), 1.0 - bu.y / (boardHalf.y * 2.0));
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    vec4 tex = texture2D(map, uv, bias) * inside;
    // Bloom from coarse mips; fade it out softly past the board edge so the
    // glow never shows a hard border.
    vec2 outside = max(-uv, uv - 1.0);
    float glowMask = 1.0 - smoothstep(0.0, 0.35, max(outside.x, outside.y));
    vec2 uvc = clamp(uv, 0.0, 1.0);
    // Fixed bloom radii (the DOF bias would push these into blocky mips).
    float gBias = min(bias, 1.0);
    vec3 glowA = texture2D(map, uvc, gBias + 3.0).rgb * glowMask;
    vec3 glowB = texture2D(map, uvc, gBias + 4.5).rgb * glowMask;
    col = col * (1.0 - tex.a) + tex.rgb;

    // Screen-space light pool towards the upper right, as if the board were
    // lit by a soft key light; the lower corners fall off into shade.
    vec2 sp = gl_FragCoord.xy / resolution;
    vec2 d = (sp - vec2(0.86, 0.92)) / vec2(0.5, 0.55);
    float light = exp(-dot(d, d));
    // Secondary, cooler glow pooling in the lower left.
    vec2 d2 = (sp - vec2(0.08, 0.1)) / vec2(0.55, 0.5);
    float fill = exp(-dot(d2, d2));

    col *= mix(0.85, 1.15, light);
    col += glowA * 0.7 + glowB * 0.6;
    col += lightColor * light * 0.6 + lightColor * fill * 1.3;
    col = mix(shadeColor, col, 0.5 + 0.5 * smoothstep(0.0, 0.5, light + fill + 0.2));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const Board: React.FC<FinanceDashboardProps> = ({ palette, camera }) => {
  const frame = useCurrentFrame();
  const { camera: cam, size, gl } = useThree();
  const p: Palette = palettes[palette];

  const { ctx, texture } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = Math.round(BOARD_W * TEXELS_PER_UNIT);
    c.height = Math.round(BOARD_H * TEXELS_PER_UNIT);
    const cctx = c.getContext("2d")!;
    cctx.scale(TEXELS_PER_UNIT, TEXELS_PER_UNIT);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    tex.premultiplyAlpha = true;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 16;
    return { ctx: cctx, texture: tex };
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        extensions: { derivatives: true } as never,
        uniforms: {
          map: { value: texture },
          camPos: { value: new THREE.Vector3() },
          focusDist: { value: 20 },
          blurScale: { value: 0.3 },
          resolution: { value: new THREE.Vector2(1, 1) },
          lightColor: { value: new THREE.Vector3(...p.light) },
          shadeColor: { value: new THREE.Vector3(...p.shade) },
          bgColor: { value: hexToVec3(p.bg) },
          gridColor: { value: hexToVec3(p.grid) },
          boardHalf: { value: new THREE.Vector2(BOARD_W / 2, BOARD_H / 2) },
        },
      }),
    [texture, p],
  );

  // Draw this frame's widgets and pose the camera before R3F renders.
  drawDashboard(ctx, p, frame);
  texture.needsUpdate = true;

  const pose = sampleCamera(cameras[camera], frame);
  const { target, position } = poseToWorld(pose);
  const [tx, ty] = target;
  const pc = cam as THREE.PerspectiveCamera;
  pc.fov = pose.fov;
  pc.aspect = size.width / size.height;
  pc.near = 0.1;
  pc.far = 400;
  // Board normal as "up": the far side of the board reads as the top of
  // frame, and roll is measured from that natural horizon.
  pc.up.set(0, 0, 1);
  pc.position.set(...position);
  pc.lookAt(tx, ty, 0);
  pc.rotateZ((pose.roll * Math.PI) / 180);
  pc.updateProjectionMatrix();
  pc.updateMatrixWorld();

  const u = material.uniforms;
  (u.camPos.value as THREE.Vector3).copy(pc.position);
  u.focusDist.value = pose.dist / UNITS_PER_WORLD;
  const buf = gl.getDrawingBufferSize(new THREE.Vector2());
  (u.resolution.value as THREE.Vector2).copy(buf);

  return (
    <mesh material={material}>
      <planeGeometry args={[PLANE_SIZE, PLANE_SIZE]} />
    </mesh>
  );
};

export const FinanceDashboard: React.FC<FinanceDashboardProps> = (props) => {
  const { width, height } = useVideoConfig();
  const p = palettes[props.palette];
  return (
    <AbsoluteFill style={{ backgroundColor: p.bg }}>
      <ThreeCanvas
        width={width}
        height={height}
        linear
        flat
        gl={{ antialias: true }}
      >
        <Board {...props} />
      </ThreeCanvas>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 120% 110% at 80% 10%, transparent 60%, ${p.vignette} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
