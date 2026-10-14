// Look 5 — Light Tunnel. A corridor of bevelled slats (instanced, one module
// every 0.6 units), light strips along the floor and ceiling edges, a bright
// end panel, glossy floor with a planar reflection, fixed-pattern SSAO.
// The camera glides exactly 10 modules per 600 frames: the slat field is
// offset by 0.6 * fract(10 t), which wraps invisibly because every module is
// identical.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { LOOP, fract, osc } from "../lib/rng";
import type { BuildCtx, LookHandle } from "../lib/types";

export type TunnelParams = {
  slat: string;
  backing: string;
  floor: string;
  strip: string;
  stripIntensity: number;
  endLight: string;
  endIntensity: number;
  fog: string;
  ambientSky: string;
  ambientGround: string;
  ambient: number;
  areaIntensity: number;
  /** Self-illumination of the slats (high-key look). */
  slatGlow: number;
  /** Linear RGB multiplier in the composite (cool cast). */
  tint: [number, number, number];
  reflect: number;
  exposure: number;
};

const MODULE = 0.6;
const MODULES = 62;
const WF = 2.4; // half-width at floor
const WC = 3.1; // half-width at ceiling (wider: walls lean outward)
const HC = 2.45; // ceiling height
const FOG_FAR = 27;

export function buildTunnel(ctx: BuildCtx, p: TunnelParams): LookHandle {
  RectAreaLightUniformsLib.init();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(new THREE.Color(p.fog), 5, FOG_FAR);
  const camera = new THREE.PerspectiveCamera(66, ctx.width / ctx.height, 0.05, 120);

  const slatMat = new THREE.MeshStandardMaterial({ color: p.slat, roughness: 0.5, metalness: 0, emissive: new THREE.Color(p.slat).multiplyScalar(p.slatGlow) });
  const backMat = new THREE.MeshStandardMaterial({ color: p.backing, roughness: 0.6, metalness: 0, emissive: new THREE.Color(p.backing).multiplyScalar(p.slatGlow * 0.6) });

  // ---- slats (instanced) ---------------------------------------------------
  const slats = new THREE.Group();
  scene.add(slats);
  const count = MODULES + 6;
  const zOf = (i: number) => -(i - 4) * MODULE;

  const ceilGeo = new RoundedBoxGeometry(2 * WC + 0.3, 0.12, 0.085, 2, 0.025);
  // two ceiling ribs per module (the 0.6-unit module still repeats exactly)
  const ceil = new THREE.InstancedMesh(ceilGeo, slatMat, count * 2);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 2; k++) {
      m4.makeTranslation(0, HC + 0.08, zOf(i) - k * MODULE * 0.5);
      ceil.setMatrixAt(i * 2 + k, m4);
    }
  }
  slats.add(ceil);

  const wallLen = Math.hypot(WF - WC, HC);
  const tilt = THREE.MathUtils.degToRad(38);
  const slatLen = wallLen / Math.cos(tilt) + 0.3;
  const wallGeo = new RoundedBoxGeometry(0.14, slatLen, 0.1, 2, 0.025);
  for (const side of [-1, 1]) {
    const B = new THREE.Vector2(side * WF, 0);
    const T = new THREE.Vector2(side * WC, HC);
    const u = T.clone().sub(B).normalize(); // along wall, upward
    const n = new THREE.Vector2(-side * u.y, side * u.x); // inward
    // basis: X = outward normal-ish (thickness), Y = along wall, Z = corridor
    const X = new THREE.Vector3(-n.x, -n.y, 0);
    const Y = new THREE.Vector3(u.x, u.y, 0);
    const Z = new THREE.Vector3(0, 0, 1);
    const basis = new THREE.Matrix4().makeBasis(X, Y, Z);
    // lean: rotate about the thickness axis so the top sits further down the corridor
    const lean = new THREE.Matrix4().makeRotationAxis(X, -side * tilt);
    const mid = B.clone().add(T).multiplyScalar(0.5).sub(n.clone().multiplyScalar(-0.08));
    const inst = new THREE.InstancedMesh(wallGeo, slatMat, count);
    for (let i = 0; i < count; i++) {
      m4.copy(lean).multiply(basis);
      m4.setPosition(mid.x, mid.y, zOf(i));
      inst.setMatrixAt(i, m4);
    }
    slats.add(inst);

    // backing panel behind the slats
    const back = new THREE.Mesh(new THREE.PlaneGeometry(wallLen + 1, 90), backMat);
    const bmid = B.clone().add(T).multiplyScalar(0.5).add(n.clone().multiplyScalar(-0.42));
    back.position.set(bmid.x, bmid.y, -35);
    // plane local X -> along the wall, local Y -> down the corridor
    const bz = new THREE.Vector3(0, 0, -1);
    back.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(Y, bz, Y.clone().cross(bz)));
    scene.add(back);

    // strips: floor/wall and ceiling/wall edges
    const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.strip).multiplyScalar(p.stripIntensity), fog: false });
    const stripGeo = new THREE.CylinderGeometry(0.012, 0.012, 90, 8, 1);
    stripGeo.rotateX(Math.PI / 2);
    const s1 = new THREE.Mesh(stripGeo, stripMat);
    s1.position.set(B.x + n.x * 0.36, 0.03, -35);
    scene.add(s1);
    const s2 = new THREE.Mesh(stripGeo, stripMat);
    s2.position.set(T.x + n.x * 0.55, HC - 0.32, -35);
    scene.add(s2);

  }
  // broad soft fill from the strips' direction: one panel along the floor
  // centre shining up, one along the ceiling shining down (static, uniform in z)
  const fillUp = new THREE.RectAreaLight(new THREE.Color(p.strip), p.areaIntensity, 70, 2 * WF - 0.6);
  fillUp.position.set(0, 0.02, -30);
  fillUp.lookAt(0, 5, -30);
  scene.add(fillUp);
  const fillDown = new THREE.RectAreaLight(new THREE.Color(p.strip), p.areaIntensity * 0.6, 70, 2 * WC - 0.6);
  fillDown.position.set(0, HC - 0.05, -30);
  fillDown.lookAt(0, -5, -30);
  scene.add(fillDown);
  const ceilBack = new THREE.Mesh(new THREE.PlaneGeometry(2 * WC + 1.2, 90), backMat);
  ceilBack.rotation.x = Math.PI / 2;
  ceilBack.position.set(0, HC + 0.45, -35);
  scene.add(ceilBack);

  backMat.side = THREE.DoubleSide;

  // end light panel (moves with the camera: it is "infinitely" far)
  const endMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.endLight).multiplyScalar(p.endIntensity), fog: false });
  const end = new THREE.Mesh(new THREE.CircleGeometry(1.35, 6), endMat);
  end.position.set(0, HC / 2, -FOG_FAR - 3);
  scene.add(end);
  // large soft round bloom around the end light (haze around the source)
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(p.endLight).multiplyScalar(p.endIntensity * 0.4) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 uColor;
      void main(){ float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(uColor * (exp(-r*r/0.05) + 0.35*exp(-r*r/0.25)) * (1.0 - smoothstep(0.85, 1.0, r)), 1.0); }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), glowMat);
  glow.position.set(0, HC * 0.42, -FOG_FAR + 1);
  glow.renderOrder = 10;
  scene.add(glow);
  const endArea = new THREE.RectAreaLight(new THREE.Color(p.endLight), p.areaIntensity * 1.5, 2 * WC, HC);
  endArea.position.set(0, HC / 2, -FOG_FAR + 6);
  endArea.lookAt(0, HC / 2, 0);
  scene.add(endArea);

  scene.add(new THREE.HemisphereLight(new THREE.Color(p.ambientSky), new THREE.Color(p.ambientGround), p.ambient));

  // ---- glossy floor with planar reflection ----------------------------------
  const rw = Math.ceil(ctx.width / 2), rh = Math.ceil(ctx.height / 2);
  const reflRT = new THREE.WebGLRenderTarget(rw, rh, { type: THREE.HalfFloatType, samples: 4 });
  const texMatrix = new THREE.Matrix4();
  const floorMat = new THREE.ShaderMaterial({
    uniforms: {
      tRefl: { value: reflRT.texture },
      uTexMatrix: { value: texMatrix },
      uBase: { value: new THREE.Color(p.floor) },
      uReflect: { value: p.reflect },
      uTexel: { value: new THREE.Vector2(1 / rw, 1 / rh) },
      uBlur: { value: 3.0 * (ctx.height / 720) * 0.5 },
      uCamPos: { value: new THREE.Vector3() },
      uFogColor: { value: new THREE.Color(p.fog) },
      uFog: { value: new THREE.Vector2(3, FOG_FAR) },
      uLight: { value: new THREE.Color(p.strip).multiplyScalar(0.35 * p.stripIntensity) },
    },
    vertexShader: /* glsl */ `
      uniform mat4 uTexMatrix;
      out vec4 vProj; out vec3 vWorld;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vProj = uTexMatrix * w;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tRefl; uniform vec3 uBase, uCamPos, uFogColor, uLight; uniform float uReflect, uBlur;
      uniform vec2 uTexel, uFog;
      in vec4 vProj; in vec3 vWorld;
      void main(){
        vec2 uv = vProj.xy / vProj.w;
        vec3 r = vec3(0.0); float wsum = 0.0;
        for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
          float w = exp(-float(x*x + y*y) / 3.0);
          r += texture(tRefl, uv + vec2(x, y) * uTexel * uBlur).rgb * w; wsum += w;
        }
        r /= wsum;
        vec3 V = normalize(uCamPos - vWorld);
        float F = 0.18 + 0.82 * pow(1.0 - max(V.y, 0.0), 5.0);
        // floor lit by the edge strips: brighter near the walls
        float edge = smoothstep(${(WF - 0.9).toFixed(2)}, ${WF.toFixed(2)}, abs(vWorld.x));
        vec3 base = uBase * (0.55 + 0.2 * edge) + uLight * edge * 0.1;
        vec3 c = mix(base, r, clamp(F * uReflect, 0.0, 1.0));
        float d = length(uCamPos - vWorld);
        c = mix(c, uFogColor, smoothstep(uFog.x, uFog.y, d) * 1.0);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * WF + 0.4, 90), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -35);
  scene.add(floor);

  const virtualCam = camera.clone();
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

  const preRender = (gl: THREE.WebGLRenderer) => {
    // mirror the camera about the floor plane y = 0 (Reflector-style)
    camera.updateMatrixWorld();
    const pos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const target = pos.clone().add(fwd);
    virtualCam.position.set(pos.x, -pos.y, pos.z);
    virtualCam.up.set(up.x, -up.y, up.z);
    virtualCam.lookAt(target.x, -target.y, target.z);
    virtualCam.projectionMatrix.copy(camera.projectionMatrix);
    virtualCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    virtualCam.updateMatrixWorld();
    texMatrix.copy(bias).multiply(virtualCam.projectionMatrix).multiply(virtualCam.matrixWorldInverse);
    floor.visible = false;
    gl.setRenderTarget(reflRT);
    gl.setClearColor(new THREE.Color(p.fog), 1);
    gl.clear(true, true, true);
    gl.render(scene, virtualCam);
    floor.visible = true;
  };

  const post = {
    exposure: p.exposure,
    bloomStrength: 0.22,
    bloomThreshold: 1.1,
    bloomKnee: 0.6,
    bloomRadius: 0.85,
    ao: { radius: 0.24, strength: 0.7, bias: 0.015 },
    dof: { focus: 6, aperture: 0.0015, maxCoc: 0.003, nearScale: 1 },
    vignette: 0.0,
    grain: 0.015,
    grainFadeLum: 0,
    tint: new THREE.Color(p.tint[0], p.tint[1], p.tint[2]),
  };

  const update = (f: number) => {
    // exactly 10 modules per loop; the wrap is invisible (identical modules)
    slats.position.z = MODULE * fract((10 * f) / LOOP);
    camera.position.set(0, 0.5, 0);
    camera.rotation.set(THREE.MathUtils.degToRad(16.5), 0, THREE.MathUtils.degToRad(1) * osc(f, 1), "YXZ");
    camera.updateMatrixWorld();
    floorMat.uniforms.uCamPos.value.copy(camera.position);
  };

  return {
    scene,
    camera,
    post,
    update,
    preRender,
    dispose: () => reflRT.dispose(),
  };
}
