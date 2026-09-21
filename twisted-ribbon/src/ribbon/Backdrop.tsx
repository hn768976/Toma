import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import {
  DoubleSide,
  type PerspectiveCamera,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { BACKDROP_DISTANCE, type VersionConfig } from './versions';

/**
 * Backdrop is two coincident planes:
 *   1. an unlit, shader-authored, dithered gradient — full control over the
 *      high-key value range, which lighting maths would fight us on;
 *   2. a transparent shadow catcher in front of it, so the band's cast shadow
 *      multiplies over the gradient instead of being baked into it.
 *
 * The gradient is evaluated in screen space, so the plane can be made as large
 * as the shadow needs without stretching the ramp.
 */
const vert = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
uniform vec2 uResolution;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform float uCorner;
uniform float uCool;
uniform float uDitherRel;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  float t = smoothstep(0.0, 1.0, uv.y);
  vec3 c = mix(uBottom, uTop, t);

  // Cooler and darker toward the LOWER LEFT specifically. Sampling the
  // reference's corners gives top-left 0.71, top-right 0.73, bottom-right 0.67,
  // bottom-left 0.56 — the falloff is diagonal, not symmetric.
  float ll = smoothstep(0.95, 0.05, uv.x * 0.85 + uv.y);
  c *= 1.0 - uCorner * ll;
  c += vec3(-uCool, -uCool * 0.35, uCool * 0.5) * ll;

  // Dither the ramp before anything downstream can quantise it. Applied
  // MULTIPLICATIVELY: this shader writes linear values, so a fixed 1/255 would
  // be imperceptible on the light version and a ~30% swing on the dark one's
  // near-black backdrop. A relative perturbation is scale-correct for both.
  float n = hash12(gl_FragCoord.xy) + hash12(gl_FragCoord.xy + 19.0) - 1.0;
  c *= 1.0 + n * uDitherRel;

  gl_FragColor = vec4(max(c, 0.0), 1.0);
}
`;

export const Backdrop: React.FC<{ cfg: VersionConfig }> = ({ cfg }) => {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        side: DoubleSide,
        depthWrite: true,
        toneMapped: false,
        uniforms: {
          uResolution: { value: new Vector2(1, 1) },
          uTop: { value: new Vector3(...cfg.bgTop) },
          uBottom: { value: new Vector3(...cfg.bgBottom) },
          uCorner: { value: cfg.bgCornerFalloff },
          uCool: { value: cfg.bgCoolShift },
          uDitherRel: { value: 0.006 },
        },
      }),
    [cfg],
  );

  // Pure function of the canvas size — no per-frame mutation.
  material.uniforms.uResolution.value.set(size.width * dpr, size.height * dpr);

  // Placed square to the camera at a fixed distance and sized to overfill the
  // frustum, so it can never run out of frame however the shot is framed. The
  // camera is static, so this is still a fixed object in world space.
  const { position, quaternion, planeSize } = useMemo(() => {
    const dir = new Vector3();
    camera.getWorldDirection(dir);
    const pos = camera.position.clone().addScaledVector(dir, BACKDROP_DISTANCE);
    const q = camera.quaternion.clone();
    const h =
      2 * BACKDROP_DISTANCE * Math.tan(((camera.fov ?? 30) * Math.PI) / 360);
    const w = h * (size.width / size.height);
    // Generous margin: the shadow needs somewhere to land beyond the frame edge.
    return {
      position: pos,
      quaternion: q,
      planeSize: [w * 2.6, h * 2.6] as [number, number],
    };
  }, [camera, camera.fov, camera.position.x, camera.position.y, camera.position.z, size.width, size.height]);

  return (
    <group position={position} quaternion={quaternion}>
      <mesh material={material} renderOrder={-1}>
        <planeGeometry args={planeSize} />
      </mesh>
      <mesh position={[0, 0, 0.02]} receiveShadow>
        <planeGeometry args={planeSize} />
        <shadowMaterial
          transparent
          opacity={cfg.shadow.backdropOpacity}
          color="#000000"
        />
      </mesh>
    </group>
  );
};
