// Look 4: renders the spiral bands into a multisampled half-float target,
// then the shared final pass (sRGB, dither, grain).
import * as THREE from "three";
import { getBlueNoiseTexture } from "../lib/blueNoise";
import { FINAL_FRAG, FULLSCREEN_VERT } from "../lib/glsl";
import { TAU } from "../lib/random";
import { buildSpiral, updateSpiral, type SpiralGeom } from "./spiralGeometry";
import type { BandColors } from "./types";

const geomCache = new Map<number, SpiralGeom>();

// Smooth studio for reflections: bright zenith, grey horizon, dark floor and
// a large soft key panel at the upper right. No hard-edged shapes, so the
// satin bands reflect only soft gradients.
const makeStudio = () => {
  const sc = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float up = d.y;
        vec3 c = mix(vec3(0.20, 0.21, 0.26), vec3(0.78, 0.80, 0.88), smoothstep(-0.3, 0.6, up));
        vec3 k = normalize(vec3(1.0, 1.1, -0.7));
        c += vec3(2.2) * smoothstep(0.82, 0.97, dot(d, k));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), mat));
  return sc;
};

export class BandsEngine {
  private gl: THREE.WebGLRenderer;
  private colors: BandColors;
  private loopFrames: number;
  private scene = new THREE.Scene();
  private group = new THREE.Group();
  private camera = new THREE.PerspectiveCamera(24, 16 / 9, 0.05, 50);
  private key: THREE.DirectionalLight;
  private sweep: THREE.DirectionalLight;
  private geom: SpiralGeom;
  private rt: THREE.WebGLRenderTarget | null = null;
  private size = new THREE.Vector2();
  private quadScene = new THREE.Scene();
  private orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private finalMat: THREE.RawShaderMaterial;
  private envRT: THREE.WebGLRenderTarget;

  constructor(gl: THREE.WebGLRenderer, colors: BandColors, seed: number, loopFrames: number) {
    this.gl = gl;
    this.colors = colors;
    this.loopFrames = loopFrames;
    let g = geomCache.get(seed);
    if (!g) {
      g = buildSpiral(seed);
      geomCache.set(seed, g);
    }
    this.geom = g;
    const ex = colors.exposure;
    const mat = new THREE.MeshStandardMaterial({
      color: colors.band,
      roughness: colors.roughness,
      metalness: 0,
      vertexColors: true,
      side: THREE.DoubleSide,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: colors.floor,
      roughness: Math.min(1, colors.roughness + 0.15),
      metalness: 0,
      vertexColors: true,
    });
    // Clamp each MSAA sample before the resolve: sub-pixel HDR specular on
    // the rounded tops would otherwise survive the average as sparkles.
    // Also: the key light (directional light 0) is scaled by the per-vertex
    // analytic soft shadow `ksh` (see spiralGeometry.ts).
    const clampOut = (m: THREE.Material) => {
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nattribute float ksh;\nvarying float vKsh;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvKsh = ksh;");
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying float vKsh;")
          .replace(
            "#include <lights_fragment_begin>",
            THREE.ShaderChunk.lights_fragment_begin.replace(
              "getDirectionalLightInfo( directionalLight, directLight );",
              "getDirectionalLightInfo( directionalLight, directLight );\n\t\t#if ( UNROLLED_LOOP_INDEX == 0 )\n\t\tdirectLight.color *= vKsh;\n\t\t#endif",
            ),
          )
          .replace(
            "#include <dithering_fragment>",
            "#include <dithering_fragment>\n gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(1.0));",
          );
      };
    };
    clampOut(mat);
    clampOut(floorMat);
    const walls = new THREE.Mesh(g.geometry, mat);

    walls.frustumCulled = false;
    const floor = new THREE.Mesh(g.floor, floorMat);
    floor.frustumCulled = false;
    this.group.add(walls, floor);
    this.scene.add(this.group);
    this.scene.background = new THREE.Color(colors.floor);
    const hemi = new THREE.HemisphereLight(colors.ambientSky, colors.ambientGround, colors.ambient * ex);
    this.scene.add(hemi);
    this.key = new THREE.DirectionalLight(colors.key.color, colors.key.intensity * ex);
    this.key.position.set(...colors.key.dir).multiplyScalar(4);
    // No shadow map: three's shadow pass made frames depend on the frames
    // rendered before them in the same tab. Shadows are analytic instead.
    this.scene.add(this.key, this.key.target);
    this.sweep = new THREE.DirectionalLight(colors.sweep.color, colors.sweep.intensity * ex);
    this.scene.add(this.sweep, this.sweep.target);
    // Soft studio reflections (deterministic PMREM of a procedural room).
    const pmrem = new THREE.PMREMGenerator(gl);
    this.envRT = pmrem.fromScene(makeStudio(), 0.04);
    pmrem.dispose();
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = colors.env * ex;

    gl.shadowMap.enabled = false;

    this.finalMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: FINAL_FRAG,
      uniforms: {
        tScene: { value: null },
        tBlue: { value: getBlueNoiseTexture() },
        uFrameMod: { value: 0 },
        uGrain: { value: colors.grain },
        uRes: { value: new THREE.Vector2() },
      },
      depthTest: false,
      depthWrite: false,
    });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.finalMat);
    q.frustumCulled = false;
    this.quadScene.add(q);
  }

  render(frame: number) {
    const gl = this.gl;
    gl.getDrawingBufferSize(this.size);
    const W = this.size.x;
    const H = this.size.y;
    if (!this.rt || this.rt.width !== W || this.rt.height !== H) {
      this.rt?.dispose();
      this.rt = new THREE.WebGLRenderTarget(W, H, {
        type: THREE.HalfFloatType,
        samples: 4,
        depthBuffer: true,
      });
    }
    const L = this.loopFrames;
    const u = (((frame % L) + L) % L) / L;
    // Spiral turns +-12 degrees, cosine over the loop.
    this.group.rotation.y = THREE.MathUtils.degToRad(12) * Math.cos(u * TAU);
    const keyLocal = new THREE.Vector3(...this.colors.key.dir)
      .normalize()
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.group.rotation.y);
    updateSpiral(this.geom, u, this.colors.aoStrength, keyLocal);
    // Sweep light: one full turn of azimuth per loop.
    const az = u * TAU + 0.6;
    const el = this.colors.sweep.elevation;
    this.sweep.position.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).multiplyScalar(5);
    const cam = this.camera;
    cam.aspect = W / H;
    const target = new THREE.Vector3(0.12, 0.1, 0.5);
    const elev = THREE.MathUtils.degToRad(27);
    const azc = THREE.MathUtils.degToRad(-14);
    const dist = 2.3;
    cam.position.set(
      target.x + Math.sin(azc) * Math.cos(elev) * dist,
      target.y + Math.sin(elev) * dist,
      target.z + Math.cos(azc) * Math.cos(elev) * dist,
    );
    cam.lookAt(target);
    cam.updateProjectionMatrix();
    gl.autoClear = true;
    gl.setRenderTarget(this.rt);
    gl.render(this.scene, cam);
    gl.setRenderTarget(null);
    const fu = this.finalMat.uniforms;
    fu.tScene.value = this.rt.texture;
    fu.uFrameMod.value = ((frame % L) + L) % L;
    gl.render(this.quadScene, this.orthoCam);
  }

  dispose() {
    this.rt?.dispose();
    this.envRT.dispose();
  }
}
