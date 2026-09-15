// Shader for the hero circuitry panel.
//
// The GLB carries no materials, just position/normal/uv on a shallow relief, so
// the look is derived entirely from the surface itself: the near-vertical walls
// of the raised traces catch the light while the flat top and floor stay dark.
// That single trick is what turns a grey mesh into glowing circuitry, and every
// version drives it with different uniforms rather than a different shader.

export const HERO_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vLocal;
  varying vec2 vUv;

  void main() {
    vLocal = position;
    vUv = uv;
    // View-space normal: its z component is how squarely a face points at the
    // camera, which is exactly the trace-wall vs. trace-top discriminator.
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const HERO_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3  uPrimary;
  uniform vec3  uAccent;
  uniform vec3  uCore;
  uniform float uTime;
  uniform float uGlow;      // overall emissive gain
  uniform float uReveal;    // 0..1 radial wipe-in of the panel
  uniform float uScan;      // y position of the scan sweep, in local units
  uniform float uScanGain;  // strength of the scan sweep
  uniform float uPulse;     // strength of the travelling energy pulse
  uniform float uCoreHeat;  // extra brightness at the centre of the panel
  uniform float uFill;      // how much the flat trace tops are lit
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vLocal;
  varying vec2 vUv;

  void main() {
    vec3 n = normalize(vNormal);

    // Faces square-on to camera are trace tops and the board floor; faces
    // turned away are the extruded walls that outline every trace.
    float facing = abs(n.z);
    float edge   = 1.0 - facing;
    float rim    = pow(edge, 2.0);

    // The relief is only ~0.02 units deep, so this threshold is tight.
    float raised = smoothstep(-0.004, 0.011, vLocal.z);

    float radius = length(vLocal.xy) / 1.15;
    float coreHot = 1.0 - smoothstep(0.0, 0.8, radius);

    // Energy travelling up the panel, wrapping every ~8 seconds.
    float head  = fract(uTime * 0.125) * 2.8 - 1.4;
    float pulse = exp(-pow((vLocal.y - head) * 5.0, 2.0));

    // Tight horizontal sweep used for the reveal and for periodic scans.
    float scan = exp(-pow((vLocal.y - uScan) * 20.0, 2.0));

    float energy =
        edge * 1.15
      + raised * uFill
      + rim * 0.5
      + pulse * uPulse
      + scan * uScanGain;

    energy *= uGlow;
    energy += coreHot * uCoreHeat;

    // Radial wipe: the panel resolves from the centre outward.
    float reveal = 1.0 - smoothstep(uReveal * 1.45 - 0.22, uReveal * 1.45, radius);

    // Saturation discipline: scaling a colour by an energy above 1 clips the
    // green and blue channels and everything drifts to white, so the body of
    // the trace is kept inside gamut and only genuinely hot pixels get a white
    // core added on top. That white is also what the bloom threshold catches.
    float e = clamp(energy, 0.0, 1.0);
    vec3 colour = mix(uPrimary, uAccent, e * 0.65) * e;

    float hot = max(energy - 1.35, 0.0);
    colour += uCore * hot * hot * 0.55;

    float alpha = clamp(energy * 0.9, 0.0, 1.0) * reveal * uOpacity;
    if (alpha < 0.003) discard;

    gl_FragColor = vec4(colour * reveal, alpha);
  }
`;
