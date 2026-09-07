import { useMemo } from "react";
import * as THREE from "three";
import { TRAVELLERS } from "./geometry";
import { rgb, type Palette } from "./palette";
import { usePixelSize } from "./usePixelSize";

/**
 * A few dots running along chords. Kept rare on purpose - the reference is calm
 * and this is not a data-traffic clip.
 *
 * Position is derived in the vertex shader from a single loop-time uniform, so
 * there is no per-frame CPU work and no accumulated state to drift out of sync
 * when Remotion renders frames out of order.
 */

const vertexShader = /* glsl */ `
  uniform float uPixelHeight;
  uniform float uBaseSize;
  uniform float uLimb;
  uniform float uCamDist;
  uniform float uLoopT;
  attribute vec3 aEnd;
  attribute float aPhase;
  attribute float aTrips;
  varying float vT;
  varying float vSize;
  varying float vRadiusPx;
  varying float vFade;

  void main() {
    float s = fract(uLoopT * aTrips + aPhase);
    vec3 p = mix(position, aEnd, s);
    // Fade in and out at the endpoints so a wrap never pops.
    vFade = sin(3.14159265 * s);

    vec4 w = modelMatrix * vec4(p, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * p);
    float facing = dot(n, normalize(cameraPosition - w.xyz));
    vT = smoothstep(-uLimb, uLimb, facing);

    vec4 mv = viewMatrix * w;
    gl_Position = projectionMatrix * mv;

    float persp = uCamDist / max(0.001, -mv.z);
    float diameter = uBaseSize * uPixelHeight * persp;
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
  varying float vFade;

  void main() {
    // Distance from the sprite centre, in device pixels. The one-pixel ramp is
    // centred on the true disc edge, so coverage stays correct all the way down
    // to sub-pixel dots near the limb - they fade rather than crawl.
    float rpx = length(gl_PointCoord - vec2(0.5)) * vSize;
    float mask = 1.0 - smoothstep(vRadiusPx - 0.5, vRadiusPx + 0.5, rpx);

    float hemi = uSide > 0.0 ? vT : 1.0 - vT;
    float a = uAlpha * mask * hemi * vFade;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export const Travellers: React.FC<{
  palette: Palette;
  sizePx: number;
  nearAlpha: number;
  farAlpha: number;
  camDist: number;
  loopT: number;
}> = ({ palette, sizePx, nearAlpha, farAlpha, camDist, loopT }) => {
  const { height } = usePixelSize();

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(TRAVELLERS.start, 3));
    g.setAttribute("aEnd", new THREE.BufferAttribute(TRAVELLERS.end, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(TRAVELLERS.phase, 1));
    g.setAttribute("aTrips", new THREE.BufferAttribute(TRAVELLERS.trips, 1));
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
        renderOrder={4}
        dispose={null}
        frustumCulled={false}
      />
      <points
        geometry={geometry}
        material={nearMat}
        renderOrder={24}
        dispose={null}
        frustumCulled={false}
      />
    </>
  );
};
