import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LookFactory } from '../../lib/ThreeStage';
import { GrowthVersion } from '../../versions';
import { clamp, easeInOutCubic, easeInOutSine, easeOutCubic, hexToLinear, hexToRgb, lerp, smoothstep } from '../../lib/math';
import { displayToScene, toneForward } from '../../lib/tone';
import { makeLandTexture } from './landTexture';
import { buildArrowBand, buildArrowHead, Polyline2, V2 } from './arrow';

export const GROWTH_FRAMES = 360;

const N_BARS = 11;
const PITCH = 1.0;
const BAR_W = 0.9;
const H = 8.5; // tallest bar
const EXPOSURE = 1.0;

// Display colours sampled from the reference, converted to linear scene values
// through the inverse of the final tone curve.
const OCEAN = displayToScene('#869ecd', EXPOSURE);
const LAND = displayToScene('#afc2e4', EXPOSURE);
const HAZE = displayToScene('#a9bbdd', EXPOSURE);
const SKY_TOP = displayToScene('#bccae3', EXPOSURE);
const SKY_MID = displayToScene('#9fb3da', EXPOSURE);

const barX = (i: number) => (i - (N_BARS - 1) / 2) * PITCH;
const ramp = (i: number) => Math.pow(i / (N_BARS - 1), 1.1);
const finalHeight = (dir: 'up' | 'down', i: number) =>
  dir === 'up' ? H * (0.1 + 0.9 * ramp(i)) : H * (1 - 0.88 * ramp(i));

// Zigzag paths in (bar index, fraction of H), relative to the bar row.
const ARROW_UP: V2[] = [
  [-1.0, 0.03],
  [2.7, 0.4],
  [3.7, 0.22],
  [6.0, 0.52],
  [6.9, 0.37],
  [9.0, 0.68],
];
const ARROW_DOWN: V2[] = [
  [-1.0, 0.95],
  [2.7, 0.6],
  [3.7, 0.76],
  [6.0, 0.44],
  [6.9, 0.56],
  [9.0, 0.18],
];

const FLOOR_VERT = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FLOOR_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tLand;
uniform vec3 uOcean, uLand, uHaze, uLine;
uniform vec4 uBars[${N_BARS}]; // x, z, half width, visible height
uniform vec2 uMapSize, uMapCenter;
uniform float uFogNear, uFogFar;
in vec3 vWorld;
out vec4 outColor;

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
vec2 node(vec2 c, float cell) { return (c + 0.44 + 0.12 * hash22(c)) * cell; }

void main() {
  vec2 p = vWorld.xz;
  float dist = length(vWorld - cameraPosition);

  // world map (equirectangular, north = -z)
  vec2 m = (vec2(p.x, -p.y) - uMapCenter) / uMapSize + 0.5;
  float land = texture(tLand, m).r;
  vec3 col = mix(uOcean, uLand, smoothstep(0.15, 0.85, land));

  // faint network of thin lines and dots on a jittered grid
  float cell = 7.5;
  vec2 g = floor(p / cell);
  float aa = length(fwidth(p));
  float lw = 0.018;
  float lines = 0.0, dots = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = g + vec2(float(i), float(j));
      vec2 a = node(c, cell);
      vec2 h = hash22(c + 17.0);
      vec2 nb[3];
      nb[0] = c + vec2(1.0, 0.0); nb[1] = c + vec2(0.0, 1.0); nb[2] = c + vec2(1.0, 1.0);
      for (int k = 0; k < 3; k++) {
        float keep = k == 2 ? step(0.9, fract(h.x * 7.13)) : 1.0;
        if (keep < 0.5) continue;
        float d = segDist(p, a, node(nb[k], cell));
        float ew = max(lw, aa);
        lines = max(lines, (1.0 - smoothstep(0.0, ew, d)) * (lw / ew));
      }
      float dd = length(p - a);
      float ew = max(0.06, aa);
      dots = max(dots, (1.0 - smoothstep(0.0, ew, dd)) * (0.06 / ew) + exp(-dd * dd / 0.04) * 0.28);
    }
  }
  float netFade = 1.0 - smoothstep(25.0, 90.0, dist);
  col = mix(col, uLine, clamp(lines * 0.36 * netFade, 0.0, 1.0));
  col += uLine * dots * 0.75 * netFade;

  // contact shadows / AO from the bars (analytic, from their current heights)
  float occ = 0.0;
  for (int b = 0; b < ${N_BARS}; b++) {
    vec4 bar = uBars[b];
    if (bar.w <= 0.001) continue;
    float d = sdBox(p - bar.xy, vec2(bar.z));
    float ao = 1.0 - smoothstep(-0.05, 0.25 + 0.06 * bar.w, d);
    // soft cast shadow falling back and to the right
    vec2 sh = vec2(0.18, -0.35) * bar.w;
    float ds = sdBox(p - bar.xy - sh * 0.5, vec2(bar.z) + abs(sh) * 0.5);
    float castSh = (1.0 - smoothstep(-0.1, 0.6 + 0.1 * bar.w, ds)) * 0.45;
    occ = max(occ, max(ao, castSh));
  }
  col *= 1.0 - 0.38 * occ;

  // haze toward the horizon
  float f = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, uHaze, f);
  outColor = vec4(col, 1.0);
}`;

const SKY_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uHaze, uMid, uTop;
in vec3 vWorld;
out vec4 outColor;
void main() {
  vec3 d = normalize(vWorld - cameraPosition);
  float e = d.y;
  vec3 col = mix(uHaze, uMid, smoothstep(0.0, 0.08, e));
  col = mix(col, uTop, smoothstep(0.06, 0.4, e));
  // slightly darker grey-blue haze band just above the horizon
  col *= 1.0 - 0.14 * exp(-pow((e - 0.06) / 0.05, 2.0));
  // soft brighter haze band just above the horizon
  col += uHaze * 0.12 * exp(-pow((e - 0.015) / 0.03, 2.0));
  // misty light from the upper left
  col += uTop * 0.22 * pow(max(dot(d, normalize(vec3(-0.75, 0.45, -0.5))), 0.0), 4.0);
  outColor = vec4(col, 1.0);
}`;

export const makeGrowthFactory =
  (v: GrowthVersion): LookFactory =>
  (assets, gl) => {
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromEquirectangular(assets.hdri!).texture;
    pm.dispose();
    // env map is set per material (envMapIntensity is ignored for scene.environment)

    const camera = new THREE.PerspectiveCamera(33, 16 / 9, 0.5, 2000);

    // ---- floor
    const landTex = makeLandTexture(assets.land!, 2048, 1.5);
    const barsUniform = Array.from({ length: N_BARS }, () => new THREE.Vector4());
    const floorMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      uniforms: {
        tLand: { value: landTex },
        uOcean: { value: new THREE.Vector3(...OCEAN) },
        uLand: { value: new THREE.Vector3(...LAND) },
        uHaze: { value: new THREE.Vector3(...HAZE) },
        uLine: { value: new THREE.Vector3(...displayToScene('#d4e0f4', EXPOSURE)) },
        uBars: { value: barsUniform },
        uMapSize: { value: new THREE.Vector2(200, 100) },
        uMapCenter: { value: new THREE.Vector2(5.6, -11.1) },
        uFogNear: { value: 30 },
        uFogFar: { value: 140 },
      },
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200, 200, 200), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 48, 24),
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: FLOOR_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: true,
        uniforms: {
          uHaze: { value: new THREE.Vector3(...HAZE) },
          uMid: { value: new THREE.Vector3(...SKY_MID) },
          uTop: { value: new THREE.Vector3(...SKY_TOP) },
        },
      }),
    );
    scene.add(sky);

    // ---- bars (brushed silver), they rise out of / sink into the floor
    const glint = { value: -100 };
    const barMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color().setRGB(...hexToLinear('#d3d9e4')),
      metalness: 0.55,
      roughness: 0.4,
      anisotropy: 0.2,
      anisotropyRotation: Math.PI / 2,
      envMapIntensity: 0.55,
    });
    barMat.onBeforeCompile = (sh) => {
      sh.uniforms.uGlint = glint;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGW;\nuniform float uGlint;')
        .replace('#include <color_fragment>', `#include <color_fragment>\n diffuseColor.rgb *= mix(0.62, 1.05, clamp(vGW.y / ${H.toFixed(2)}, 0.0, 1.0));`)
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float gx = vGW.x + vGW.y * 0.45 - uGlint;
          totalEmissiveRadiance += vec3(0.95, 0.98, 1.0) * 0.55 * exp(-gx * gx / 0.18);`,
        );
    };
    barMat.customProgramCacheKey = () => 'growth-bar';

    const startHeights: number[] = [];
    const endHeights: number[] = [];
    const bars: THREE.Mesh[] = [];
    for (let i = 0; i < N_BARS; i++) {
      const hEnd = finalHeight(v.direction, i);
      const hStart = v.direction === 'up' ? 0 : H;
      startHeights.push(hStart);
      endHeights.push(hEnd);
      const geoH = Math.max(hStart, hEnd);
      const geo = new RoundedBoxGeometry(BAR_W, geoH, BAR_W, 3, 0.035);
      geo.translate(0, -geoH / 2, 0); // top of the bar at local y = 0
      // shorter bars read darker (gunmetal), tall ones bright silver, as in the reference
      const k = Math.pow(hEnd / H, 0.8);
      const mat = barMat.clone();
      mat.onBeforeCompile = barMat.onBeforeCompile;
      mat.customProgramCacheKey = barMat.customProgramCacheKey;
      mat.color.setRGB(...hexToLinear('#4c4a69')).lerp(new THREE.Color().setRGB(...hexToLinear('#f0f2f6')), k);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(barX(i), 0, 0);
      bars.push(m);
      scene.add(m);
    }

    // ---- arrow
    const arrowPts0 = (v.direction === 'up' ? ARROW_UP : ARROW_DOWN).map(
      ([i, y]) => [barX(0) + i * PITCH, y * H] as V2,
    );
    // tapered tail: an extra vertex 1.4 units in, the first vertex has ~zero width
    const a0 = arrowPts0[0];
    const a1 = arrowPts0[1];
    const l01 = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
    const tail: V2 = [a0[0] + ((a1[0] - a0[0]) * 1.4) / l01, a0[1] + ((a1[1] - a0[1]) * 1.4) / l01];
    const arrowPts = [a0, tail, ...arrowPts0.slice(1)];
    const path = new Polyline2(arrowPts);
    const DEPTH = 0.3;
    const BEVEL = 0.07;
    const HEAD_LEN = 1.5;
    const bandGeo = buildArrowBand(path, 0.23, DEPTH, BEVEL, 0.08);
    const headGeo = buildArrowHead(1.0, HEAD_LEN, DEPTH + 0.012, BEVEL);
    const arrowColor = new THREE.Color().setRGB(...hexToLinear(v.arrow)).multiplyScalar(0.1);
    // Emissive picked through the inverse tone curve, capped where ACES still
    // keeps a saturated hue (brighter greens desaturate toward white).
    const e = displayToScene(v.arrow, EXPOSURE);
    const want = hexToRgb(v.arrow);
    let best = 1;
    let bestErr = Infinity;
    for (let k = 0.3; k <= 1.0001; k += 0.01) {
      const o = toneForward([e[0] * k, e[1] * k, e[2] * k], EXPOSURE);
      // weight saturation (channel differences) over raw lightness
      const err = (o[0] - want[0]) ** 2 + (o[1] - want[1]) ** 2 + (o[2] - want[2]) ** 2 + 2 * ((o[0] - o[1]) - (want[0] - want[1])) ** 2 + 2 * ((o[2] - o[1]) - (want[2] - want[1])) ** 2;
      if (err < bestErr) {
        bestErr = err;
        best = k;
      }
    }
    const arrowEmissive = new THREE.Color().setRGB(...e).multiplyScalar(best);
    const drawU = { value: 0 };
    const arrowMat = new THREE.MeshPhysicalMaterial({
      color: arrowColor,
      emissive: arrowEmissive,
      emissiveIntensity: 1.0,
      roughness: 0.7,
      metalness: 0.0,
      specularIntensity: 0.1,
      clearcoat: 0.0,
      envMapIntensity: 0.08,
    });
    const bandMat = arrowMat.clone();
    bandMat.onBeforeCompile = (sh) => {
      sh.uniforms.uDraw = drawU;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aS;\nvarying float vS;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvS = aS;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vS;\nuniform float uDraw;')
        .replace('void main() {', 'void main() {\nif (vS > uDraw) discard;');
    };
    bandMat.customProgramCacheKey = () => 'growth-arrow-band';
    const arrow = new THREE.Group();
    const band = new THREE.Mesh(bandGeo, bandMat);
    const head = new THREE.Mesh(headGeo, arrowMat);
    arrow.add(band, head);
    arrow.position.set(0, 0, BAR_W / 2 + 0.28);
    scene.add(arrow);
    // the arrow sheds a little coloured light on the bars behind it
    const spill = new THREE.PointLight(new THREE.Color().setRGB(...hexToLinear(v.arrow)), 0, 8, 1.2);
    spill.position.set(-0.4, 0, -0.75); // behind the arrow: lights the bars, not the arrow face
    head.add(spill);

    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(-6, 12, 10);
    scene.add(key);

    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && m.isMeshStandardMaterial) m.envMap = env;
    });
    const target = new THREE.Vector3(0.3, H * 0.34, 0);
    const tan = new THREE.Vector2();

    return {
      scene,
      camera,
      update: (frame, aspect) => {
        // bars: 0-90 staggered rise (Up) or sink (Down)
        for (let i = 0; i < N_BARS; i++) {
          const t0 = (i / (N_BARS - 1)) * 45;
          const k = easeOutCubic((frame - t0) / 45);
          const vis = lerp(startHeights[i], endHeights[i], easeInOutCubic(k));
          bars[i].position.y = vis;
          bars[i].visible = vis > 0.05; // hide the rounded cap until it clears the floor
          barsUniform[i].set(barX(i), 0, BAR_W / 2, vis);
        }
        // arrow: 60-210 draws along its path, head leading
        const dk = easeInOutSine((frame - 60) / 150);
        const s = path.length * dk;
        drawU.value = frame < 60 ? -1 : s + 0.04;
        const p = path.at(s);
        const q = path.at(s - 0.7);
        tan.set(p[0] - q[0], p[1] - q[1]);
        if (tan.lengthSq() < 1e-6) {
          const a = path.pts[0];
          const b = path.pts[1];
          tan.set(b[0] - a[0], b[1] - a[1]);
        }
        head.position.set(p[0], p[1], 0);
        head.rotation.z = Math.atan2(tan.y, tan.x);
        const hs = smoothstep(58, 70, frame);
        head.scale.setScalar(Math.max(1e-4, hs));
        head.visible = frame >= 58;
        spill.intensity = 40 * hs;
        // glint 210-360
        glint.value = lerp(-14, 16, clamp((frame - 215) / 120, 0, 1));

        // camera: orbit ~40 deg from the left while rising
        const t = easeInOutSine(frame / (GROWTH_FRAMES - 1));
        const az = THREE.MathUtils.degToRad(lerp(-25, 15, t));
        const el = THREE.MathUtils.degToRad(lerp(10, 15, t));
        const R = lerp(33, 30, t);
        camera.position.set(
          target.x + R * Math.sin(az) * Math.cos(el),
          target.y + R * Math.sin(el),
          target.z + R * Math.cos(az) * Math.cos(el),
        );
        camera.lookAt(target);
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
      },
      post: () => ({
        exposure: EXPOSURE,
        bloomStrength: 0.12,
        bloomRadius: 0.75,
        bloomThreshold: 2.2,
        dof: { enabled: true, focusDistance: camera.position.distanceTo(target), farBlur: 0.014, nearBlur: 0.007, sharpZone: 0.05 },
        grain: 0.02,
        vignette: 0.12,
      }),
    };
  };
