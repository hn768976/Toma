import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  DoubleSide,
  ShaderMaterial,
  Vector2,
  Vector3,
  type Texture,
} from "three";
import { GLSL_NOISE } from "../lib/glsl";
import { c3, type Theme } from "../theme";
import { BINARY_ROWS, getPlaneTextures } from "./textures";

/** World-space extent of the plane, and how the two tiles map onto it. */
export const PLANE = {
  width: 1400,
  depth: 560,
  /** Far edge sits at -depth + zNear. */
  zNear: 60,
  /** One repeat of the detail/flow tile, in world units. */
  detailTile: 70,
  /** One repeat of the binary tile: 256 columns x 64 rows. */
  binaryTile: new Vector2(200, 70),
  fadeNear: 250,
  fadeFar: 570,
} as const;

const vertexShader = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uDetail;
uniform sampler2D uFlow;
uniform sampler2D uBinary;
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uContact;
uniform float uDetailTile;
uniform vec2 uBinaryTile;
uniform float uFadeNear;
uniform float uFadeFar;
uniform float uGlowRadius;
uniform float uGlowStrength;
uniform vec3 uTraceColor;
uniform vec3 uPadColor;
uniform vec3 uBlockColor;
uniform vec3 uBinaryColor;
uniform vec3 uPulseColor;
uniform vec3 uGlowColor;
uniform float uBinaryRows;

varying vec3 vWorld;

${GLSL_NOISE}

void main() {
  vec2 wp = vWorld.xz;
  float dist = length(vWorld - uCamPos);
  // Fade on depth into the scene, not on distance from the camera: a spherical
  // falloff projects as an arc across the plane and reads as a dome edge,
  // whereas depth iso-lines are horizontal and read as ordinary aerial haze.
  float depth = uCamPos.z - vWorld.z;

  // Far edge dissolves into darkness. Squaring the ramp gives a long toe, and
  // the surface content is faded out well before the geometry ends -- without
  // that, the far mip levels average into a flat band that reads as a horizon.
  float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, depth);
  fade *= fade;
  fade *= smoothstep(0.0, 26.0, dist);
  if (fade <= 0.0004) discard;
  float detailFade = 1.0 - smoothstep(uFadeNear * 0.62, uFadeFar * 0.86, depth);
  detailFade *= detailFade;

  vec2 duv = wp / uDetailTile;
  vec4 det = texture2D(uDetail, duv);

  // Large-scale density from world position. This is what puts the surface
  // content in bands and, because it is not periodic, what stops the repeated
  // tile from reading as a pattern.
  float dens = vnoise(wp * 0.0062) * 0.62 + vnoise(wp * 0.0175 + 31.0) * 0.38;
  float traceBand = mix(0.18, 1.0, smoothstep(0.24, 0.62, dens));
  float blockBand = smoothstep(0.44, 0.74, vnoise(wp * 0.0115 + 7.0));
  float binBand = smoothstep(0.38, 0.66, vnoise(wp * 0.0092 + 19.0));

  float trace = det.r * traceBand * detailFade;
  float pad = det.b * mix(0.35, 1.0, traceBand) * detailFade;

  // Data blocks sit on a 16px grid in the tile, so a hash of the cell gives a
  // stable per-block id to flicker on.
  vec2 cell = floor(duv * 128.0);
  float ch = hash21(cell);
  float flick = mix(0.62, 1.16, 0.5 + 0.5 * sin(uTime * (0.8 + ch * 2.2) + ch * 41.0));
  flick *= fract(uTime * 0.31 + ch * 13.7) < 0.05 ? 0.28 : 1.0;
  float block = det.g * blockBand * flick * detailFade;

  // Travelling pulses. The flow texture carries arc-length along each trace
  // (R) and a per-trace id (G); the tile hash decorrelates repeats so the
  // whole plane never pulses in lockstep.
  vec4 flow = texture2D(uFlow, duv);
  float along = flow.r;
  float id = flow.g;
  float tileH = hash21(floor(duv));
  float head = fract(uTime * (0.09 + id * 0.13) + id * 7.31 + tileH);
  float comet = exp(-fract(head - along) * 26.0);
  float duty = fract(uTime * (0.05 + id * 0.06) + id * 3.7 + tileH * 2.13);
  float on = smoothstep(0.0, 0.06, duty) * smoothstep(0.46, 0.36, duty);
  // Pulses only carry in the near and mid field, where the trace is resolved.
  float pulse = comet * on * smoothstep(0.04, 0.2, det.r) * (1.0 - smoothstep(140.0, 340.0, dist));

  // Binary rows run across the surface in x and scroll along their own row,
  // each at its own speed and direction.
  vec2 buv = wp / uBinaryTile;
  float rowIdx = floor(buv.y * uBinaryRows);
  float rh = hash11(rowIdx);
  float speed = (0.0075 + rh * 0.02) * (rh > 0.5 ? 1.0 : -1.0);
  vec4 bin = texture2D(uBinary, vec2(buv.x + uTime * speed, buv.y));
  float binary = bin.r * (0.35 + 0.65 * bin.g) * binBand * detailFade;

  // Light spilling across the plane beneath the brain.
  float gd = length(vWorld.xz - uContact.xz);
  float glow = exp(-pow(gd / uGlowRadius, 2.0));
  float hot = exp(-pow(gd / (uGlowRadius * 0.22), 2.0));

  vec3 col = uTraceColor * trace * 2.1
           + uPadColor * pad * 1.5
           + uBlockColor * block * 1.15
           + uBinaryColor * binary * 0.85;
  // The spill lifts the detail it falls on rather than just sitting on top.
  col *= 1.0 + glow * 1.5;
  col += uPulseColor * pulse * 1.5;
  col += uGlowColor * (glow * uGlowStrength + hot * uGlowStrength * 0.7);

  col *= fade;

  // Ordered-ish dither before the 8-bit write. Without this the long falloff
  // into the far dark bands badly once it has been through H.264.
  col += (hash21(gl_FragCoord.xy) - 0.5) * 0.0035;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
  #include <colorspace_fragment>
}
`;

export const CircuitPlane: React.FC<{
  theme: Theme;
  time: number;
  camPos: Vector3;
  contact: Vector3;
  glowStrength: number;
}> = ({ theme, time, camPos, contact, glowStrength }) => {
  const gl = useThree((s) => s.gl);

  const material = useMemo(() => {
    const { detail, flow, binary } = getPlaneTextures();
    const aniso = gl.capabilities.getMaxAnisotropy();
    for (const t of [detail, flow, binary] as Texture[]) {
      if (t.anisotropy !== aniso) {
        t.anisotropy = aniso;
        t.needsUpdate = true;
      }
    }
    return new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      // The plane is emissive: it adds onto the backdrop, so its dark gaps
      // show the background gradient and the far edge simply stops existing.
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
      uniforms: {
        uDetail: { value: detail },
        uFlow: { value: flow },
        uBinary: { value: binary },
        uTime: { value: 0 },
        uCamPos: { value: new Vector3() },
        uContact: { value: new Vector3() },
        uDetailTile: { value: PLANE.detailTile },
        uBinaryTile: { value: PLANE.binaryTile.clone() },
        uFadeNear: { value: PLANE.fadeNear },
        uFadeFar: { value: PLANE.fadeFar },
        uGlowRadius: { value: 33 },
        uGlowStrength: { value: 0 },
        uBinaryRows: { value: BINARY_ROWS },
        uTraceColor: { value: c3(theme.trace).clone() },
        uPadColor: { value: c3(theme.pad).clone() },
        uBlockColor: { value: c3(theme.block).clone() },
        uBinaryColor: { value: c3(theme.binary).clone() },
        uPulseColor: { value: c3(theme.pulse).clone() },
        uGlowColor: { value: c3(theme.planeGlow).clone() },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, theme.id]);

  // Every uniform is written from the current frame's values; nothing
  // accumulates, so any frame can be rendered on its own.
  const u = material.uniforms;
  u.uTime.value = time;
  u.uCamPos.value.copy(camPos);
  u.uContact.value.copy(contact);
  u.uGlowStrength.value = glowStrength;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, PLANE.zNear - PLANE.depth / 2]}
    >
      <planeGeometry args={[PLANE.width, PLANE.depth, 8, 8]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};
