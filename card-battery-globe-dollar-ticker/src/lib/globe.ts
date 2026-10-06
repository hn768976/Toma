import { CustomBlending, OneFactor, BackSide, Color, Group, Mesh, ShaderMaterial, SphereGeometry } from "three";
import { Assets } from "./assets";
import { coastSegments, lonLatToVec } from "./geo";
import { attr, makeDots, makeSegments } from "./materials";
import { GLSL_COMMON, Shared } from "./shared";

/**
 * Holographic globe: latitude rows of dots (land bright, ocean faint),
 * coastline segments and a fresnel rim shell. Rotate the returned `spin`
 * group about Y; tilt the outer `group`.
 */
export interface GlobeOptions {
  radius: number;
  color: Color; // land dots / coast
  oceanColor?: Color;
  rowStepDeg: number; // latitude spacing between dot rows
  dotStepDeg: number; // longitude spacing at the equator
  dotSize: number; // world diameter
  landGain?: number;
  oceanGain?: number;
  coastGain?: number;
  coastWidth?: number;
  /** Brightness of the far hemisphere (seen through the hologram). */
  backFace?: number;
  rim?: Color;
  rimGain?: number;
  /** Fill of the sphere body (faint haze). */
  bodyGain?: number;
}

export const makeGlobe = (assets: Assets, shared: Shared, o: GlobeOptions) => {
  const group = new Group();
  const spin = new Group();
  group.add(spin);
  const R = o.radius;

  // Dot rows
  const pos: number[] = [];
  const kind: number[] = [];
  for (let lat = 82; lat >= -82; lat -= o.rowStepDeg) {
    const n = Math.max(1, Math.round((360 / o.dotStepDeg) * Math.cos((lat * Math.PI) / 180)));
    for (let i = 0; i < n; i++) {
      const lon = -180 + (i + 0.5) * (360 / n);
      const land = assets.isLand(lon, lat);
      pos.push(...lonLatToVec(lon, lat, R));
      kind.push(land ? 1 : 0);
    }
  }
  const dots = makeDots({
    count: pos.length / 3,
    attrs: { iPos: attr(3, pos), iKind: attr(1, kind) },
    shared,
    uniforms: {
      uLand: { value: o.color },
      uOcean: { value: o.oceanColor ?? o.color },
      uLandGain: { value: o.landGain ?? 1.6 },
      uOceanGain: { value: o.oceanGain ?? 0.18 },
      uBack: { value: o.backFace ?? 0.12 },
      uAlpha: { value: 1 },
    },
    hook: /* glsl */ `
      vec3 wp = (modelMatrix * vec4(pos, 1.0)).xyz;
      vec3 wc = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      vec3 nrm = normalize(wp - wc);
      float facing = dot(nrm, normalize(cameraPosition - wp));
      float front = smoothstep(-0.1, 0.15, facing);
      float vis = mix(uBack, 1.0, front);
      col = iKind > 0.5 ? uLand * uLandGain : uOcean * uOceanGain;
      // limb brightening (holographic edge)
      col *= 1.0 + 1.2 * pow(1.0 - abs(facing), 3.0);
      alpha = vis * uAlpha;
      sizeW = ${o.dotSize.toFixed(4)} * (iKind > 0.5 ? 1.0 : 0.8);
      minPx = 1.0;
    `,
  });
  dots.name = "globe";
  spin.add(dots);

  // Coastlines
  const cs = coastSegments(assets, 0.6);
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < cs.length; i += 4) {
    a.push(...lonLatToVec(cs[i], cs[i + 1], R * 1.001));
    b.push(...lonLatToVec(cs[i + 2], cs[i + 3], R * 1.001));
  }
  const coast = makeSegments({
    count: a.length / 3,
    attrs: { iA: attr(3, a), iB: attr(3, b) },
    shared,
    uniforms: { uC: { value: o.color }, uGain: { value: o.coastGain ?? 1.2 }, uBack: { value: o.backFace ?? 0.12 }, uAlpha: { value: 1 } },
    hook: /* glsl */ `
      vec3 wp = (modelMatrix * vec4(a, 1.0)).xyz;
      vec3 wc = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float facing = dot(normalize(wp - wc), normalize(cameraPosition - wp));
      alpha = mix(uBack, 1.0, smoothstep(-0.1, 0.15, facing)) * uAlpha;
      col = uC * uGain;
      widthW = ${(o.coastWidth ?? R * 0.004).toFixed(4)};
      minPx = 0.9;
    `,
  });
  coast.name = "globe";
  spin.add(coast);

  // Rim / body shell (back faces → glow around the limb, holographic haze)
  const rimMat = new ShaderMaterial({
    uniforms: {
      ...shared,
      uRim: { value: o.rim ?? o.color },
      uRimGain: { value: o.rimGain ?? 1.0 },
      uBody: { value: o.bodyGain ?? 0.04 },
      uAlpha: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform vec3 uRim;
      uniform float uRimGain;
      uniform float uBody;
      uniform float uAlpha;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        vec3 c = uRim * (pow(f, 4.0) * uRimGain + uBody);
        gl_FragColor = vec4(c * uAlpha, 0.0);
      }`,
    transparent: true,
    depthWrite: false,
    side: BackSide,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneFactor,
  });
  const rim = new Mesh(new SphereGeometry(R * 1.004, 96, 64), rimMat);
  rim.name = "globe";
  group.add(rim);

  const setAlpha = (v: number) => {
    for (const m of [dots, coast, rim]) (m.material as ShaderMaterial).uniforms.uAlpha.value = v;
  };
  return { group, spin, dots, coast, rim, setAlpha };
};
