import { useMemo } from "react";
import * as THREE from "three";
import { CHORDS } from "./geometry";
import { rgb, type Palette } from "./palette";
import { usePixelSize } from "./usePixelSize";

/**
 * Straight chords between nearby nodes, cutting through the sphere's interior
 * rather than following the surface - that interior crossing is what the
 * reference shows and what great-circle arcs would lose.
 *
 * Each chord is a screen-space ribbon (two triangles) rather than a GL line, so
 * the weight is a real pixel width that scales with the render resolution
 * instead of being pinned at 1px by the driver.
 *
 * The geometry is static in object space: the nodes are fixed to the sphere and
 * the whole globe spins as one group, so nothing here needs rebuilding per
 * frame. The depth-dependent fade lives in the shader instead.
 */

const vertexShader = /* glsl */ `
  uniform vec2 uResolution;
  uniform float uWidth;
  attribute vec3 aOther;
  attribute float aSide;
  attribute float aAlpha;
  varying float vT;
  varying float vDistPx;
  varying float vAlpha;

  void main() {
    vec4 mvA = modelViewMatrix * vec4(position, 1.0);
    vec4 mvB = modelViewMatrix * vec4(aOther, 1.0);
    vec4 clipA = projectionMatrix * mvA;
    vec4 clipB = projectionMatrix * mvB;

    vec2 sA = (clipA.xy / clipA.w) * uResolution * 0.5;
    vec2 sB = (clipB.xy / clipB.w) * uResolution * 0.5;
    vec2 dir = sB - sA;
    dir = length(dir) < 1e-6 ? vec2(1.0, 0.0) : normalize(dir);
    vec2 nrm = vec2(-dir.y, dir.x);

    // Half-extent includes a one-pixel pad so the coverage ramp below is not
    // clipped by the quad itself.
    float halfPx = uWidth * 0.5 + 1.0;
    vec2 offsetPx = nrm * aSide * halfPx;
    vec2 offsetNdc = offsetPx / (uResolution * 0.5);
    gl_Position = clipA + vec4(offsetNdc * clipA.w, 0.0, 0.0);
    vDistPx = aSide * halfPx;

    // Depth of this end relative to the sphere centre, in radii. Linear along a
    // straight chord, so the varying interpolates it exactly - a chord passing
    // from the near side to the far side grades across its own length.
    float zc = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).z;
    vT = smoothstep(-0.28, 0.28, mvA.z - zc);

    vAlpha = aAlpha;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uSide;
  uniform float uWidth;
  varying float vT;
  varying float vDistPx;
  varying float vAlpha;

  void main() {
    // Exact one-pixel coverage ramp centred on the ribbon edge. Hairline chords
    // therefore keep their ink instead of thinning away at preview scale.
    float mask = 1.0 - smoothstep(uWidth * 0.5 - 0.5, uWidth * 0.5 + 0.5, abs(vDistPx));

    float hemi = uSide > 0.0 ? vT : 1.0 - vT;
    float a = uAlpha * vAlpha * mask * hemi;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export const Chords: React.FC<{
  palette: Palette;
  /** Chord weight in px at 4K. */
  widthPx: number;
  nearAlpha: number;
  farAlpha: number;
}> = ({ palette, widthPx, nearAlpha, farAlpha }) => {
  const { width, height } = usePixelSize();

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(CHORDS.position, 3));
    g.setAttribute("aOther", new THREE.BufferAttribute(CHORDS.other, 3));
    g.setAttribute("aSide", new THREE.BufferAttribute(CHORDS.side, 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(CHORDS.alpha, 1));
    g.setIndex(new THREE.BufferAttribute(CHORDS.index, 1));
    return g;
  }, []);

  const [nearMat, farMat] = useMemo(() => {
    const make = (side: number, color: string, alpha: number) =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
        vertexShader,
        fragmentShader,
        uniforms: {
          uResolution: { value: new THREE.Vector2(1, 1) },
          uWidth: { value: 1 },
          uColor: { value: new THREE.Vector3(...rgb(color)) },
          uAlpha: { value: alpha },
          uSide: { value: side },
        },
      });
    return [
      make(1, palette.chordNear, nearAlpha),
      make(-1, palette.chordFar, farAlpha),
    ];
  }, [palette, nearAlpha, farAlpha]);

  for (const m of [nearMat, farMat]) {
    m.uniforms.uResolution.value.set(width, height);
    m.uniforms.uWidth.value = (widthPx / 2160) * height;
  }

  return (
    <>
      <mesh
        geometry={geometry}
        material={farMat}
        renderOrder={1}
        dispose={null}
        frustumCulled={false}
      />
      <mesh
        geometry={geometry}
        material={nearMat}
        renderOrder={21}
        dispose={null}
        frustumCulled={false}
      />
    </>
  );
};
