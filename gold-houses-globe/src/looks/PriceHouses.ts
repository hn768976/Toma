import * as THREE from "three";
import { mulberry32, TAU } from "../lib/random";
import { GlossyReflector, REFLECT_GLSL } from "../lib/reflector";
import type { Look } from "../lib/look";

export type HousesParams = { symbol: string; glow: string; dark: string };

// ---- layout -------------------------------------------------------------
const S = 1.8; // house spacing (front row)
const N = 3; // camera slides exactly N*S per loop
const FOV = 30;
const CAM_Y = 1.35, CAM_Z = 6.25, LOOK_Y = 1.0;

// house silhouette, width 1, base at y = 0, chimney on the right
const houseShape = () => {
  const s = new THREE.Shape();
  const pts: [number, number][] = [
    [-0.5, 0], [0.5, 0], [0.5, 0.8], [0.34, 0.909], [0.34, 1.12], [0.19, 1.12], [0.19, 1.011], [0, 1.14], [-0.5, 0.8],
  ];
  s.moveTo(...pts[0]);
  pts.slice(1).forEach((p) => s.lineTo(...p));
  s.closePath();
  return s;
};
const H_TOTAL = 1.14;

type Row = { z: number; spacing: number; offset: number; scale: number; pattern: number[]; lift: number };
const rng = mulberry32(0x40e5);
const pat = (n: number, a: number, b: number) => Array.from({ length: n }, () => a + rng() * (b - a));
// spacing * pattern length must divide N*S so every row repeats over the loop
const ROWS: Row[] = [
  { z: 0, spacing: S, offset: 0, scale: 1, pattern: [1, 1, 1], lift: 0 },
  { z: -1.4, spacing: S, offset: S * 0.5, scale: 1.3, pattern: pat(3, 0.96, 1.08), lift: 0 },
  { z: -3.0, spacing: S * 0.75, offset: S * 0.2, scale: 1.45, pattern: pat(4, 0.9, 1.15), lift: 0.02 },
  { z: -4.8, spacing: S * 0.6, offset: S * 0.45, scale: 1.6, pattern: pat(5, 0.85, 1.2), lift: 0.04 },
  { z: -6.8, spacing: S * 0.5, offset: S * 0.1, scale: 1.6, pattern: pat(6, 0.85, 1.25), lift: 0.06 },
];

const faceTexture = (symbol: string, font: string) => {
  const W = 512, Hh = Math.round(512 * H_TOTAL);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = Hh;
  const g = c.getContext("2d")!;
  // soft radial falloff on the glowing face (brighter in the middle)
  const grad = g.createRadialGradient(W / 2, Hh * 0.55, 10, W / 2, Hh * 0.55, W * 0.75);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, "#d9d2c8");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, Hh);
  g.fillStyle = "#4e3f33";
  g.font = `700 ${Math.round(W * 0.62)}px ${font}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  // canvas y is down; the body centre sits at y = 0.42 house units
  g.fillText(symbol, W / 2, Hh * (1 - 0.4 / H_TOTAL));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  // ExtrudeGeometry cap UVs are the raw shape x,y: map x -0.5..0.5, y 0..H to 0..1
  t.repeat.set(1, 1 / H_TOTAL);
  t.offset.set(0.5, 0);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
};

export const PriceHouses: Look<HousesParams> = {
  assets: ["font"],
  create: ({ width, height, assets, params, period }) => {
    const scene = new THREE.Scene();
    const dark = new THREE.Color(params.dark);
    const glow = new THREE.Color(params.glow);
    scene.background = dark.clone().multiplyScalar(0.25);
    const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.2, 100);

    // backdrop: faint warm haze behind the back rows, dark above
    const bdMat = new THREE.ShaderMaterial({
      uniforms: { dark: { value: dark } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 dark; varying vec3 vW;
        void main(){ float h = exp(-max(vW.y, 0.0) / 1.6); gl_FragColor = vec4(dark * (0.12 + 0.7 * h), 1.0); }`,
    });
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(200, 40), bdMat);
    backdrop.position.set(0, 10, -14);
    scene.add(backdrop);

    // lights for the unlit back rows (soft warm spill from the glowing row)
    scene.add(new THREE.HemisphereLight(glow, dark, 0.6));
    const spill = new THREE.DirectionalLight(glow, 0.9);
    spill.position.set(0, 1.2, 4);
    scene.add(spill);

    const geo = new THREE.ExtrudeGeometry(houseShape(), { depth: 0.07, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -0.07);
    const faceMat = new THREE.MeshBasicMaterial({
      map: faceTexture(params.symbol, assets.font!),
      color: glow.clone().multiplyScalar(4.5),
    });
    const sideMat = new THREE.MeshBasicMaterial({ color: glow.clone().multiplyScalar(0.5) });
    // unlit back rows: warm brown, lighter toward the roof, darker at the
    // base; deeper rows dimmer so the blurred silhouettes stay separate
    const backMats = ROWS.map((_, ri) =>
      new THREE.ShaderMaterial({
        uniforms: { col: { value: new THREE.Color("#a08068").multiplyScalar([1, 0.62, 0.42, 0.3, 0.2][ri]) } },
        vertexShader: `varying float vY; varying vec3 vN; void main(){ vY = position.y; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 col; varying float vY; varying vec3 vN;
          void main(){ float g = 0.3 + 0.7 * smoothstep(0.0, 1.15, vY); float side = abs(vN.z) > 0.5 ? 1.0 : 0.55;
            gl_FragColor = vec4(col * g * side, 1.0); }`,
      }),
    );

    const houses = new THREE.Group();
    scene.add(houses);
    const camTravel = N * S;
    ROWS.forEach((row, ri) => {
      const span0 = -9 - row.z * 1.2, span1 = camTravel + 9 - row.z * 1.2;
      const k0 = Math.floor((span0 - row.offset) / row.spacing), k1 = Math.ceil((span1 - row.offset) / row.spacing);
      for (let k = k0; k <= k1; k++) {
        const m = new THREE.Mesh(geo, ri === 0 ? [faceMat, sideMat] : backMats[ri]);
        const v = row.pattern[((k % row.pattern.length) + row.pattern.length) % row.pattern.length];
        m.position.set(row.offset + k * row.spacing, row.lift, row.z);
        m.scale.set(row.scale * (0.92 + 0.08 * v), row.scale * v, 1);
        houses.add(m);
      }
    });

    // floor
    const reflector = new GlossyReflector(width, height, 0.5, 0.06, 3);
    const floorMat = new THREE.ShaderMaterial({
      uniforms: {
        tReflect: { value: reflector.texture },
        textureMatrix: { value: reflector.textureMatrix },
        dark: { value: dark },
        glow: { value: glow },
      },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        ${REFLECT_GLSL}
        uniform vec3 dark; uniform vec3 glow; varying vec3 vW;
        void main() {
          vec3 r = sampleReflection(vW, vec2(0.0));
          // light pooling on the floor in front of the glowing row
          float pool = exp(-pow(max(vW.z, 0.0) / 1.4, 2.0)) * step(-0.05, vW.z);
          vec3 c = dark * 0.3 + glow * 0.05 * pool + r * 0.08;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -20;
    scene.add(floor);

    const update = (frame: number) => {
      const t = (frame % period) / period;
      const x = t * camTravel; // exactly N*S per loop
      camera.position.set(x, CAM_Y + 0.02 * Math.sin(TAU * t), CAM_Z);
      camera.lookAt(x + 0.05, LOOK_Y, 0);
    };

    return {
      scene,
      camera,
      update,
      beforeRender: (gl) => reflector.update(gl, scene, camera, floor, [backdrop]),
      post: {
        exposure: 1.0,
        tonemap: "aces",
        bloom: { strength: 2.6, threshold: 0.5, knee: 0.6, radius: 0.7 },
        dof: { focus: CAM_Z + 0.05, range: 3.0, nearRange: 3, maxBlur: 0.016, maxNearBlur: 0.006 },
        grain: 0.02,
        grainPeriod: period,
        grade: { saturation: 0.55, tint: [1.0, 0.94, 0.84], vignette: 0.25 },
      },
    };
  },
};
