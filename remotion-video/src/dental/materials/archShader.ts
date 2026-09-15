// The one material every version of the arch uses.
//
// Rather than authoring nine materials, the arch has a single shader whose
// pathology and treatment layers are all driven by uniforms: stain, plaque,
// calculus, gingival inflammation, a carious lesion, enamel polish and a
// fluoride shield. A version is then just a set of uniform curves over time,
// which is what keeps the nine looks consistent with each other.
//
// Two ideas do most of the work:
//
//  * The gum line is not baked. `aGumT` is each vertex's signed height above
//    the gum margin, so moving `uGumLine` negative retreats the gingiva and
//    uncovers root — real recession, not a texture cross-fade.
//  * Disease accumulates where it would in life. Every deposit layer is
//    masked by baked ambient occlusion and by proximity to the gum margin,
//    so stain and plaque settle into fissures and interproximal spaces
//    instead of coating the tooth evenly.

import { GLSL_NOISE } from "./noise";

export const ARCH_VERTEX_SHADER = /* glsl */ `
${GLSL_NOISE}

attribute float aGumT;
attribute float aTheta;
attribute float aBand;
attribute float aAo;
attribute float aTid;

uniform float uTime;
uniform float uGumLine;
uniform float uGumBlend;
uniform float uSwell;
uniform float uSwellCenter;
uniform float uSwellWidth;
uniform float uCavity;
uniform vec3 uCavityCenter;
uniform float uCavityRadius;
uniform float uCavityDepth;

varying vec3 vModelPos;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vGumT;
varying float vTheta;
varying float vBand;
varying float vAo;
varying float vTid;
varying float vTooth;

void main() {
  vec3 pos = position;
  vec3 nrm = normal;

  float tooth = smoothstep(uGumLine, uGumLine + uGumBlend, aGumT) * aBand;
  float gum = 1.0 - tooth;

  // Oedema: inflamed gingiva swells hardest at the margin and the papillae,
  // fading out into the attached tissue further down.
  if (uSwell > 0.0001) {
    float focus = exp(-pow((aTheta - uSwellCenter) / max(uSwellWidth, 0.001), 2.0));
    float margin = exp(-pow(aGumT / 0.028, 2.0));
    float lumps = 0.7 + 0.3 * gnoise(position * 26.0);
    pos += nrm * (uSwell * gum * focus * (0.35 + 0.65 * margin) * lumps);
  }

  // The lesion is carved into the surface rather than painted on, so the
  // cavity still reads as a hole from a grazing camera angle.
  if (uCavity > 0.0001) {
    float d = distance(position, uCavityCenter);
    float pit = 1.0 - smoothstep(uCavityRadius * 0.15, uCavityRadius, d);
    pit *= 0.7 + 0.3 * gnoise(position * 60.0);
    pos -= nrm * (pit * uCavityDepth * uCavity * tooth);
  }

  vModelPos = position;
  vGumT = aGumT;
  vTheta = aTheta;
  vBand = aBand;
  vAo = aAo;
  vTid = aTid;
  vTooth = tooth;

  vec4 world = modelMatrix * vec4(pos, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * nrm);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const ARCH_FRAGMENT_SHADER = /* glsl */ `
${GLSL_NOISE}

// Height of an average crown above the gum margin, in the model's own
// units (the arch is normalised to 1.0 wide). Every band below is written
// as a fraction of this, so re-baking the mesh at a different scale does
// not silently move the stain line halfway up the tooth.
const float CROWN = 0.146;

uniform float uTime;
uniform float uGumLine;
uniform float uGumBlend;

uniform vec3 uEnamelColor;
uniform vec3 uDentinColor;
uniform vec3 uRootColor;
uniform vec3 uGumColor;
uniform vec3 uGumDeepColor;
uniform vec3 uInflamColor;
uniform vec3 uStainColor;
uniform vec3 uPlaqueColor;
uniform vec3 uTartarColor;
uniform vec3 uCariesColor;

uniform float uStain;
uniform float uPlaque;
uniform float uTartar;
uniform float uInflammation;
uniform float uInflamCenter;
uniform float uInflamWidth;
uniform float uPolish;
uniform float uWetness;

uniform float uCavity;
uniform vec3 uCavityCenter;
uniform float uCavityRadius;

uniform float uShield;
uniform vec3 uShieldColor;

// A cleaning pass sweeping around the arch. x = position in theta,
// y = half-width of the leading edge, z = strength.
uniform vec3 uSweep;
uniform float uSweepSign;

uniform float uHighlightTid;
uniform float uHighlightAmount;
uniform vec3 uHighlightColor;

uniform vec3 uKeyDir;
uniform vec3 uKeyColor;
uniform vec3 uFillDir;
uniform vec3 uFillColor;
uniform vec3 uRimDir;
uniform vec3 uRimColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform float uExposure;

// Angular radius of the key and fill sources. Real dental renders are lit
// with large softboxes; a pure directional light gives enamel a highlight
// only a couple of degrees wide, which reads as dry stone.
uniform float uLightSize;
uniform float uEnvStrength;

uniform vec3 uHazeColor;
uniform float uHazeNear;
uniform float uHazeFar;
uniform float uHazeStrength;

varying vec3 vModelPos;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vGumT;
varying float vTheta;
varying float vBand;
varying float vAo;
varying float vTid;
varying float vTooth;

float ggx(vec3 N, vec3 V, vec3 L, float rough) {
  vec3 H = normalize(V + L);
  float a = max(rough * rough, 1e-3);
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  float NdotV = max(dot(N, V), 1e-3);
  float d = NdotH * NdotH * (a2 - 1.0) + 1.0;
  float D = a2 / (3.14159265 * d * d);
  float k = a * 0.5;
  float G = (NdotL / (NdotL * (1.0 - k) + k)) * (NdotV / (NdotV * (1.0 - k) + k));
  return D * G / (4.0 * NdotV * max(NdotL, 1e-3)) * NdotL;
}

// Stand-in for a studio environment: a sky-to-floor ramp with two soft
// panels sitting where the key and rim lights are. Sampling it along the
// reflection vector is what gives enamel its wet, reflective surface and
// keeps the shadow side of a crown from going flat.
vec3 environment(vec3 R, float rough) {
  float up = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 base = mix(uGroundColor, uSkyColor, pow(up, 0.7)) * 1.2;
  float sharp = mix(26.0, 2.0, rough);
  float key = pow(max(dot(R, uKeyDir), 0.0), sharp);
  float rim = pow(max(dot(R, uRimDir), 0.0), sharp * 0.7);
  return base + uKeyColor * key * 1.1 + uRimColor * rim * 0.55;
}

// Nudges the shading normal by the gradient of an fbm field. Used for
// gingival stippling and for enamel micro-relief.
// The strength argument is frequency-independent: the raw gradient grows
// with the noise scale, so that factor is divided back out here.
vec3 perturbNormal(vec3 N, vec3 p, float scale, float strength) {
  float e = 0.45 / scale;
  float n0 = gnoise(p * scale);
  vec3 g = vec3(
    gnoise((p + vec3(e, 0.0, 0.0)) * scale) - n0,
    gnoise((p + vec3(0.0, e, 0.0)) * scale) - n0,
    gnoise((p + vec3(0.0, 0.0, e)) * scale) - n0) / e;
  g -= N * dot(N, g);
  return normalize(N - g * (strength / scale));
}

float hexEdge(vec2 uv) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 ap = abs(gv);
  return max(dot(ap, normalize(vec2(1.0, 1.7320508))), ap.x);
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  if (!gl_FrontFacing) N = -N;

  float tooth = vTooth;
  float ao = mix(0.62, 1.0, vAo);
  float occluded = 1.0 - vAo;

  // How much of this spot the cleaning pass has already reached.
  float swept = uSweep.z * smoothstep(uSweep.x - uSweep.y, uSweep.x + uSweep.y, vTheta * uSweepSign);
  float dirty = clamp(1.0 - swept, 0.0, 1.0);

  // ---- enamel -------------------------------------------------------
  // Enamel thins towards the incisal edge, so warmer dentin shows through
  // near the neck while the tip turns translucent.
  float neck = smoothstep(CROWN * 0.24, 0.0, vGumT);
  float tip = smoothstep(CROWN * 0.20, CROWN * 0.85, vGumT);
  vec3 enamel = mix(uEnamelColor, uDentinColor, neck * 0.26);
  // Below the original margin the surface is root cementum, not enamel.
  float rootness = 1.0 - smoothstep(-CROWN * 0.03, CROWN * 0.10, vGumT);
  enamel = mix(enamel, uRootColor, rootness * 0.5);

  float enamelRough = mix(0.10, 0.26, rootness);
  enamelRough = mix(enamelRough, 0.04, uPolish);
  enamel = mix(enamel, enamel * 1.06 + 0.035, uPolish);

  // Stain settles into fissures and along the neck, never on exposed cusps.
  float stain = 0.0;
  if (uStain > 0.0001) {
    float stainField = clamp(0.16 + 0.95 * occluded + 0.85 * neck, 0.0, 1.35);
    stainField *= 0.72 + 0.56 * (fbm(vModelPos * 19.0, 2) * 0.5 + 0.5);
    stain = clamp(uStain * dirty * stainField, 0.0, 1.0);
    enamel = mix(enamel, uStainColor, stain * 0.72);
    enamelRough = mix(enamelRough, 0.34, stain * 0.6);
  }

  // ---- caries -------------------------------------------------------
  float caries = 0.0;
  if (uCavity > 0.0001) {
    float d = distance(vModelPos, uCavityCenter);
    float core = 1.0 - smoothstep(uCavityRadius * 0.35, uCavityRadius * 0.95, d);
    core *= 0.65 + 0.45 * (fbm(vModelPos * 45.0, 2) * 0.5 + 0.5);
    caries = clamp(core, 0.0, 1.0) * uCavity * tooth;
    // Chalky demineralisation ring around the lesion.
    float halo = (1.0 - smoothstep(uCavityRadius * 0.8, uCavityRadius * 1.9, d)) * uCavity * tooth;
    enamel = mix(enamel, vec3(0.86, 0.85, 0.80), clamp(halo - caries, 0.0, 1.0) * 0.55);
    enamel = mix(enamel, uCariesColor, caries);
    enamelRough = mix(enamelRough, 0.85, caries);
  }

  // ---- gingiva ------------------------------------------------------
  // Attached gingiva is stippled and matte; the free margin is smoother
  // and wetter, so roughness tracks the distance below the margin.
  float depth = smoothstep(0.0, -CROWN * 1.4, vGumT);
  vec3 gumCol = mix(uGumColor, uGumDeepColor, depth * 0.7);
  float gumRough = mix(0.28, 0.50, smoothstep(-CROWN * 0.14, -CROWN * 0.62, vGumT));

  float inflam = 0.0;
  if (uInflammation > 0.0001) {
    float inflamFocus = exp(-pow((vTheta - uInflamCenter) / max(uInflamWidth, 0.001), 2.0));
    float marginWeight = smoothstep(-CROWN * 0.5, CROWN * 0.03, vGumT);
    inflam = uInflammation * mix(0.30, 1.0, inflamFocus) * mix(0.25, 1.0, marginWeight);
    inflam *= 0.8 + 0.4 * (gnoise(vModelPos * 14.0) * 0.5 + 0.5);
    inflam = clamp(inflam, 0.0, 1.0);
    gumCol = mix(gumCol, uInflamColor, inflam);
    gumRough = mix(gumRough, 0.14, inflam * 0.85);
  }

  // ---- deposits at the margin ---------------------------------------
  float marginBand = smoothstep(CROWN * 0.19, CROWN * 0.01, vGumT)
                   * smoothstep(-CROWN * 0.07, CROWN * 0.01, vGumT);
  float plaque = 0.0;
  if (uPlaque > 0.0001) {
    float film = 0.45 + 0.55 * (fbm(vModelPos * 28.0, 2) * 0.5 + 0.5);
    plaque = clamp(uPlaque * dirty * marginBand * film * (0.45 + 0.9 * occluded), 0.0, 1.0);
  }
  float tartar = 0.0;
  if (uTartar > 0.0001) {
    vec2 w = worley(vModelPos * 52.0);
    float lump = smoothstep(0.55, 0.12, w.x);
    tartar = clamp(uTartar * dirty * marginBand * lump * (0.35 + 1.0 * occluded), 0.0, 1.0);
  }

  // ---- combine ------------------------------------------------------
  vec3 albedo = mix(gumCol, enamel, tooth);
  float rough = mix(gumRough, enamelRough, tooth);
  float f0 = mix(0.028, 0.055, tooth);

  albedo = mix(albedo, uPlaqueColor, plaque * 0.8);
  rough = mix(rough, 0.55, plaque * 0.7);
  albedo = mix(albedo, uTartarColor, tartar * 0.9);
  rough = mix(rough, 0.46, tartar * 0.8);

  // Micro-relief: coarse stipple on gingiva, much finer grain on enamel.
  N = perturbNormal(N, vModelPos, mix(96.0, 520.0, tooth), mix(0.048, 0.005, tooth));

  // A wet film flattens roughness and lifts the specular floor.
  rough = mix(rough, rough * 0.45, uWetness);
  f0 = mix(f0, 0.07, uWetness);
  rough = clamp(rough, 0.035, 0.95);

  // ---- lighting -----------------------------------------------------
  // Broadening the lobe by the source's angular radius is what turns the
  // point highlight into a softbox reflection.
  float specRough = clamp(rough + uLightSize, 0.04, 1.0);

  // Gingiva is translucent, so it gets wrapped diffuse plus a red
  // transmission term when a light sits behind it.
  float wrap = mix(0.55, 0.10, tooth);
  float d1 = max((dot(N, uKeyDir) + wrap) / (1.0 + wrap), 0.0);
  float d2 = max((dot(N, uFillDir) + wrap) / (1.0 + wrap), 0.0);
  float d3 = max((dot(N, uRimDir) + wrap) / (1.0 + wrap), 0.0);

  vec3 diffuse = uKeyColor * d1 + uFillColor * d2 + uRimColor * d3;
  diffuse += mix(uGroundColor, uSkyColor, N.y * 0.5 + 0.5);

  float sss = pow(clamp(dot(-N, uKeyDir) * 0.5 + 0.5, 0.0, 1.0), 2.5);
  vec3 transmission = uGumDeepColor * sss * (1.0 - tooth) * 0.55 * (1.0 + inflam);
  // Enamel picks up a softer version of the same effect at the thin incisal edge.
  transmission += uDentinColor * sss * tooth * tip * 0.22 * (1.0 - caries);

  vec3 color = albedo * diffuse * ao + transmission * ao;

  // Grazing fresnel is capped rather than allowed to reach 1. The gain
  // below is an art multiplier that makes enamel gleam, and multiplying a
  // full grazing term by it blows out every concavity -- most visibly the
  // inside of a carious lesion, where the dark albedo was being washed
  // back to the brightness of clean enamel.
  float specFres = f0 + (0.34 - f0) * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 spec = uKeyColor * ggx(N, V, uKeyDir, specRough)
            + uFillColor * ggx(N, V, uFillDir, specRough) * 0.5
            + uRimColor * ggx(N, V, uRimDir, specRough) * 0.7;
  // Caries is porous and matte; it must not catch the enamel highlight.
  float lesionMatte = 1.0 - caries * 0.92;
  color += spec * specFres * mix(3.4, 12.0, tooth) * mix(0.75, 1.0, ao) * lesionMatte;

  // Environment reflection. Occlusion gates it so it never lights the
  // inside of an interproximal gap, and the grazing term is held back or
  // every silhouette edge rims out to white.
  vec3 R = reflect(-V, N);
  float grazing = f0 + (0.24 - f0) * pow(1.0 - max(dot(N, V), 0.0), 4.0);
  color += environment(R, rough) * grazing * uEnvStrength
         * mix(0.3, 1.0, vAo) * mix(0.7, 1.0, tooth) * lesionMatte;

  // ---- fluoride shield ----------------------------------------------
  if (uShield > 0.0001) {
    vec2 hexUv = vec2(vTheta * 34.0, vGumT * 105.0 + vTheta * 6.0);
    float e = hexEdge(hexUv);
    float line = smoothstep(0.40, 0.49, e) * (1.0 - smoothstep(0.49, 0.52, e));
    float pulse = 0.65 + 0.35 * sin(uTime * 2.4 - vTheta * 5.0);
    float shield = uShield * tooth * (line * 0.9 + 0.10) * pulse;
    shield *= smoothstep(0.75, 0.25, abs(dot(N, V))) * 0.6 + 0.6;
    color += uShieldColor * shield;
  }

  // ---- single-tooth callout -----------------------------------------
  if (uHighlightAmount > 0.0001) {
    float isTarget = 1.0 - step(0.5, abs(vTid * 255.0 - uHighlightTid));
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.0);
    color += uHighlightColor * isTarget * tooth * uHighlightAmount * (0.18 + rim * 0.9);
  }

  color *= uExposure;

  if (uHazeStrength > 0.0001) {
    float dist = distance(cameraPosition, vWorldPos);
    float haze = smoothstep(uHazeNear, uHazeFar, dist) * uHazeStrength;
    color = mix(color, uHazeColor, haze);
  }

  vec4 diffuseColor = vec4(color, 1.0);
  gl_FragColor = diffuseColor;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
