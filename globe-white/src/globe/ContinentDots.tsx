import { useMemo } from "react";
import * as THREE from "three";
import { CONTINENT_DOTS } from "./geometry";
import { rgb, type Palette } from "./palette";
import { usePixelSize } from "./usePixelSize";

/**
 * Continents as a dot matrix on a 1 degree lat/lon grid.
 *
 * Drawn twice from one buffer: once for the far hemisphere (before the shell,
 * pale) and once for the near one (after it). Each pass fades out across the
 * silhouette so the two sum smoothly instead of switching at a hard boundary.
 */

const vertexShader = /* glsl */ `
  uniform float uPixelHeight;
  uniform float uBaseSize;
  uniform float uLimb;
  uniform float uMinShrink;
  uniform float uCamDist;
  attribute float aSizeMul;
  attribute float aAccent;
  varying float vT;
  varying float vAccent;
  varying float vSize;
  varying float vRadiusPx;

  void main() {
    // On a unit sphere the position is its own normal.
    vec4 w = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * position);
    float facing = dot(n, normalize(cameraPosition - w.xyz));

    // Exactly 0 at the perspective silhouette, so the crossover sits on the rim.
    vT = smoothstep(-uLimb, uLimb, facing);
    vAccent = aAccent;

    vec4 mv = viewMatrix * w;
    gl_Position = projectionMatrix * mv;

    // Dots compress and shrink toward the limb as the surface turns edge-on.
    float shrink = mix(uMinShrink, 1.0, sqrt(clamp(abs(facing), 0.0, 1.0)));
    float persp = uCamDist / max(0.001, -mv.z);
    float diameter = uBaseSize * uPixelHeight * aSizeMul * shrink * persp;
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
  uniform vec3 uAccentColor;
  uniform float uAlpha;
  uniform float uSide;
  varying float vT;
  varying float vAccent;
  varying float vSize;
  varying float vRadiusPx;

  void main() {
    // Distance from the sprite centre, in device pixels. The one-pixel ramp is
    // centred on the true disc edge, so coverage stays correct all the way down
    // to sub-pixel dots near the limb - they fade rather than crawl.
    float rpx = length(gl_PointCoord - vec2(0.5)) * vSize;
    float mask = 1.0 - smoothstep(vRadiusPx - 0.5, vRadiusPx + 0.5, rpx);

    float hemi = uSide > 0.0 ? vT : 1.0 - vT;
    float a = uAlpha * mask * hemi;
    if (a < 0.004) discard;
    gl_FragColor = vec4(mix(uColor, uAccentColor, vAccent), a);
  }
`;

export const ContinentDots: React.FC<{
  palette: Palette;
  /** Near-side dot diameter at the sub-camera point, in px at 4K. */
  sizePx: number;
  nearAlpha: number;
  farAlpha: number;
  camDist: number;
}> = ({ palette, sizePx, nearAlpha, farAlpha, camDist }) => {
  const { height } = usePixelSize();

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(CONTINENT_DOTS.position, 3),
    );
    g.setAttribute(
      "aSizeMul",
      new THREE.BufferAttribute(CONTINENT_DOTS.sizeMul, 1),
    );
    g.setAttribute(
      "aAccent",
      new THREE.BufferAttribute(CONTINENT_DOTS.accent, 1),
    );
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
          uMinShrink: { value: 0.4 },
          uCamDist: { value: camDist },
          uColor: { value: new THREE.Vector3(...rgb(color)) },
          uAccentColor: {
            value: new THREE.Vector3(
              ...rgb(side > 0 ? palette.dotAccent : palette.dotFar),
            ),
          },
          uAlpha: { value: alpha },
          uSide: { value: side },
        },
      });
    return [
      make(1, palette.dotNear, nearAlpha),
      make(-1, palette.dotFar, farAlpha),
    ];
  }, [palette, nearAlpha, farAlpha, camDist]);

  for (const m of [nearMat, farMat]) {
    // Sizes are authored in px-at-4K; convert to device px for this render.
    m.uniforms.uBaseSize.value = sizePx / 2160;
    m.uniforms.uPixelHeight.value = height;
    m.uniforms.uCamDist.value = camDist;
  }

  return (
    <>
      <points
        geometry={geometry}
        material={farMat}
        renderOrder={2}
        dispose={null}
        frustumCulled={false}
      />
      <points
        geometry={geometry}
        material={nearMat}
        renderOrder={22}
        dispose={null}
        frustumCulled={false}
      />
    </>
  );
};
