import * as THREE from "three";
import type { MaterialSpec } from "./presets";
import { getDetailTexture } from "./detailTexture";

/**
 * The look of a single cell.
 *
 * The GLB ships with no material and no UVs, so every bit of surface
 * detail here is synthesised: nodular relief, ribosome speckle, a
 * fresnel edge and a wrap-lit translucent body. All eleven references
 * are reachable by moving these uniforms alone, which is what lets the
 * series run on one untouched mesh.
 *
 * Detail is sampled from a small baked tiling texture rather than
 * evaluated as noise per fragment -- see detailTexture.ts for why that
 * matters when the renderer is a software rasteriser.
 */

const vertexShader = /* glsl */ `
  attribute float aSeed;
  attribute float aShade;

  varying vec2 vDetailUv;
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  varying float vShade;

  uniform float uDetailRepeat;

  void main() {
    vShade = aShade;
    // The cylindrical UVs derived from the mesh positions, offset per
    // instance so a field of clones does not wear identical freckles.
    vDetailUv = uv * uDetailRepeat + vec2(aSeed * 7.31, aSeed * 3.17);

    vec4 instanced = instanceMatrix * vec4(position, 1.0);
    vec4 viewPos = modelViewMatrix * instanced;
    vViewPos = viewPos.xyz;

    // instanceMatrix carries uniform scale only, so the plain
    // upper-3x3 is a valid normal transform here.
    mat3 instanceNormal = mat3(instanceMatrix);
    vNormalView = normalize(normalMatrix * normalize(instanceNormal * normal));

    gl_Position = projectionMatrix * viewPos;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uDetail;

  uniform vec3 uBaseColor;
  uniform vec3 uDeepColor;
  uniform vec3 uRimColor;
  uniform vec3 uSpeckleColor;
  uniform vec3 uLightColor;
  uniform vec3 uAmbient;
  uniform vec3 uLightDir;

  uniform float uRimPower;
  uniform float uRimStrength;
  uniform float uSpecular;
  uniform float uShininess;
  uniform float uBumpAmount;
  uniform float uSpeckleAmount;
  uniform float uSpeckleRepeat;
  uniform float uTranslucency;
  uniform float uEmissive;
  uniform float uOpacity;
  uniform float uDarkField;

  varying vec2 vDetailUv;
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  varying float vShade;

  /**
   * Blinn's bump mapping via screen-space derivatives: perturb the
   * shading normal from the gradient of a height field without needing
   * a tangent basis on the mesh. Shading only -- the silhouette stays
   * exactly as modelled.
   */
  vec3 perturbNormal(vec3 normal, vec3 viewPos, vec2 uv, float height, float amount) {
    vec3 dPdx = dFdx(viewPos);
    vec3 dPdy = dFdy(viewPos);
    vec2 dUVdx = dFdx(uv);
    vec2 dUVdy = dFdy(uv);

    float dHdx = dFdx(height);
    float dHdy = dFdy(height);

    vec3 r1 = cross(dPdy, normal);
    vec3 r2 = cross(normal, dPdx);
    float det = dot(dPdx, r1);

    vec3 surfGrad = sign(det) * (dHdx * r1 + dHdy * r2);
    // Guard the degenerate case where a triangle is edge-on and the
    // determinant collapses, which otherwise flashes a black facet.
    if (abs(det) < 1e-12) {
      return normal;
    }
    return normalize(abs(det) * normal - amount * surfGrad);
  }

  void main() {
    vec4 detail = texture2D(uDetail, vDetailUv);
    float relief = detail.r;
    float wash = detail.b;

    vec3 normal = normalize(vNormalView);
    vec3 bumped = perturbNormal(normal, vViewPos, vDetailUv, relief, uBumpAmount * 9.0);

    vec3 lightDir = normalize(uLightDir);
    vec3 viewDir = normalize(-vViewPos);

    // Wrap lighting stands in for the subsurface scatter that makes
    // these cells read as translucent gel rather than plastic.
    float lambert = dot(bumped, lightDir);
    float wrapped = clamp((lambert + uTranslucency) / (1.0 + uTranslucency), 0.0, 1.0);

    float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), uRimPower);

    vec3 halfVec = normalize(lightDir + viewDir);
    float spec = pow(max(dot(bumped, halfVec), 0.0), uShininess) * uSpecular;

    vec3 body = mix(uDeepColor, uBaseColor, wrapped);
    body = mix(body, body * uLightColor, 0.35);
    body += uAmbient * 0.45;
    // Low-frequency mottling keeps large cells from looking injection-moulded.
    body *= 0.9 + 0.2 * wash;

    // Ribosome speckle: sparse bright pin-points across the membrane,
    // faded away from the light so they read as surface, not decal.
    float dots = texture2D(uDetail, vDetailUv * uSpeckleRepeat).g * uSpeckleAmount;
    body = mix(body, uSpeckleColor, dots * (0.25 + 0.75 * wrapped));

    body += uRimColor * fresnel * uRimStrength;
    body += uLightColor * spec;
    body += uBaseColor * uEmissive;

    // Bright-field mode: the cell absorbs light rather than catching it,
    // so it sits darker than the ground the way refs 07 and 09 do.
    vec3 absorbed = mix(uDeepColor, uBaseColor, 0.35 + 0.45 * wrapped);
    absorbed += uRimColor * fresnel * uRimStrength * 0.6;
    body = mix(body, absorbed, uDarkField);

    // Per-instance exposure jitter, so a field of clones stops reading
    // as a field of clones.
    body *= vShade;

    float alpha = uOpacity;
    // Thin grazing edges of a translucent cell let more light through.
    alpha *= mix(1.0, 0.82 + 0.18 * fresnel, uTranslucency);

    gl_FragColor = vec4(body, alpha);
    #include <colorspace_fragment>
  }
`;

const toColor = (hex: string) => new THREE.Color(hex);

export const createBacillusMaterial = (spec: MaterialSpec) =>
  new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: spec.opacity < 1,
    depthWrite: true,
    side: THREE.FrontSide,
    uniforms: {
      uDetail: { value: getDetailTexture() },
      uBaseColor: { value: toColor(spec.baseColor) },
      uDeepColor: { value: toColor(spec.deepColor) },
      uRimColor: { value: toColor(spec.rimColor) },
      uSpeckleColor: { value: toColor(spec.speckleColor) },
      uLightColor: { value: toColor(spec.lightColor) },
      uAmbient: { value: toColor(spec.ambient) },
      uLightDir: { value: new THREE.Vector3(...spec.lightDir).normalize() },
      uRimPower: { value: spec.rimPower },
      uRimStrength: { value: spec.rimStrength },
      uSpecular: { value: spec.specular },
      uShininess: { value: spec.shininess },
      uBumpAmount: { value: spec.bumpAmount },
      uDetailRepeat: { value: spec.bumpScale * 0.55 },
      uSpeckleAmount: { value: spec.speckleAmount },
      uSpeckleRepeat: { value: Math.max(1.5, spec.speckleScale / spec.bumpScale) },
      uTranslucency: { value: spec.translucency },
      uEmissive: { value: spec.emissive },
      uOpacity: { value: spec.opacity },
      uDarkField: { value: spec.darkField ? 1 : 0 },
    },
  });

/**
 * The matte pass: every cell rendered as flat white on black, with no
 * lighting, no defocus and no backdrop -- the alpha channel of the
 * colour pass, exactly as the reference clip carries it.
 */
export const createMatteMaterial = () =>
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    toneMapped: false,
    fog: false,
  });
