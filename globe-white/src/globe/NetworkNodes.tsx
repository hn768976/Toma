import { useMemo } from "react";
import * as THREE from "three";
import { NODES } from "./geometry";
import { rgb, type Palette } from "./palette";
import { usePixelSize } from "./usePixelSize";

/**
 * The network nodes: small filled circles over land, darker than the continent
 * dots. A minority of them pulse on staggered cycles - each completes a whole
 * number of cycles per loop, so frame 600 lands exactly on frame 0.
 */

const vertexShader = /* glsl */ `
  uniform float uPixelHeight;
  uniform float uBaseSize;
  uniform float uLimb;
  uniform float uCamDist;
  uniform float uLoopT;
  attribute float aPhase;
  attribute float aPulse;
  attribute float aCycles;
  varying float vT;
  varying float vSize;
  varying float vRadiusPx;
  varying float vPulse;

  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * position);
    float facing = dot(n, normalize(cameraPosition - w.xyz));
    vT = smoothstep(-uLimb, uLimb, facing);

    vec4 mv = viewMatrix * w;
    gl_Position = projectionMatrix * mv;

    // Integer cycles per loop keeps the pulse seamless.
    float pulse = aPulse * (0.5 - 0.5 * cos(6.2831853 * (uLoopT * aCycles + aPhase)));
    vPulse = pulse;

    float shrink = mix(0.45, 1.0, sqrt(clamp(abs(facing), 0.0, 1.0)));
    float persp = uCamDist / max(0.001, -mv.z);
    float diameter = uBaseSize * uPixelHeight * shrink * persp * (1.0 + 0.38 * pulse);
    vRadiusPx = diameter * 0.5;
    // Pad the sprite a pixel each side so the coverage ramp straddles the disc
    // edge instead of being clipped by the sprite bounds. Without the pad a
    // sub-3px dot loses most of its ink and the continents wash out.
    vSize = diameter + 2.0;
    gl_PointSize = vSize;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uSide;
  varying float vT;
  varying float vSize;
  varying float vRadiusPx;
  varying float vPulse;

  void main() {
    // Distance from the sprite centre, in device pixels. The one-pixel ramp is
    // centred on the true disc edge, so coverage stays correct all the way down
    // to sub-pixel dots near the limb - they fade rather than crawl.
    float rpx = length(gl_PointCoord - vec2(0.5)) * vSize;
    float mask = 1.0 - smoothstep(vRadiusPx - 0.5, vRadiusPx + 0.5, rpx);

    float hemi = uSide > 0.0 ? vT : 1.0 - vT;
    float a = uAlpha * mask * hemi * (1.0 + 0.45 * vPulse);
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, min(a, 1.0));
  }
`;

export const NetworkNodes: React.FC<{
  palette: Palette;
  /** Node diameter at the sub-camera point, in px at 4K. */
  sizePx: number;
  nearAlpha: number;
  farAlpha: number;
  camDist: number;
  loopT: number;
}> = ({ palette, sizePx, nearAlpha, farAlpha, camDist, loopT }) => {
  const { height } = usePixelSize();

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(NODES.position, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(NODES.phase, 1));
    g.setAttribute("aPulse", new THREE.BufferAttribute(NODES.pulses, 1));
    g.setAttribute("aCycles", new THREE.BufferAttribute(NODES.cycles, 1));
    return g;
  }, []);

  const [nearMat, farMat] = useMemo(() => {
    const make = (side: number, color: string, alpha: number) =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.NormalBlending,
        vertexShader,
        fragmentShader,
        uniforms: {
          uPixelHeight: { value: 1 },
          uBaseSize: { value: 0 },
          uLimb: { value: 0.1 },
          uCamDist: { value: camDist },
          uLoopT: { value: 0 },
          uColor: { value: new THREE.Vector3(...rgb(color)) },
          uAlpha: { value: alpha },
          uSide: { value: side },
        },
      });
    return [
      make(1, palette.nodeNear, nearAlpha),
      make(-1, palette.nodeFar, farAlpha),
    ];
  }, [palette, nearAlpha, farAlpha, camDist]);

  for (const m of [nearMat, farMat]) {
    m.uniforms.uBaseSize.value = sizePx / 2160;
    m.uniforms.uPixelHeight.value = height;
    m.uniforms.uCamDist.value = camDist;
    m.uniforms.uLoopT.value = loopT;
  }

  return (
    <>
      <points
        geometry={geometry}
        material={farMat}
        renderOrder={3}
        dispose={null}
        frustumCulled={false}
      />
      <points
        geometry={geometry}
        material={nearMat}
        renderOrder={23}
        dispose={null}
        frustumCulled={false}
      />
    </>
  );
};
