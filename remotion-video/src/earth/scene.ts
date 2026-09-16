import { anamorphic } from "three/addons/tsl/display/AnamorphicNode.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { float, pass } from "three/tsl";
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  Color,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  NoColorSpace,
  PerspectiveCamera,
  PostProcessing,
  RenderTarget,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  UnsignedByteType,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";
import { placeCamera, sunDirection } from "./camera";
import { ATMOSPHERE_RADIUS, CLOUD_RADIUS, SHOTS, type ShotId } from "./config";
import { createAtmosphereMaterial } from "./tsl/atmosphereMaterial";
import { createCloudMaterial } from "./tsl/cloudMaterial";
import { createEarthMaterial, type EarthMaps } from "./tsl/earthMaterial";
import { createHaloMaterial } from "./tsl/haloMaterial";
import { createMeteorMaterial } from "./tsl/meteorMaterial";
import { createStarfieldMaterial } from "./tsl/starfieldMaterial";
import { applyGrade } from "./tsl/grade";
import { createUniforms } from "./tsl/uniforms";

const DEG = Math.PI / 180;
const SUN_DISTANCE = 60;
const STAR_SPHERE = 90;
const HALO_SHELL = 4;

export type SceneOptions = {
  /** The 2D canvas the finished frame is painted into. */
  canvas: HTMLCanvasElement;
  shot: ShotId;
  width: number;
  height: number;
  durationInFrames: number;
  textureUrls: Record<keyof EarthMaps, string>;
  /** Renders larger than the canvas and lets the browser filter it down. */
  superSample: number;
  /** MSAA samples on the scene pass. */
  samples: number;
};

export type EarthScene = {
  update: (frame: number) => void;
  render: () => Promise<void>;
  dispose: () => void;
  backend: "WebGPU" | "WebGL2";
};

const loadTextures = async (urls: Record<keyof EarthMaps, string>): Promise<EarthMaps> => {
  const loader = new TextureLoader();
  const load = async (url: string, srgb: boolean) => {
    const texture: Texture = await loader.loadAsync(url);
    texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.anisotropy = 16;
    return texture;
  };

  const [day, night, bump, water, clouds] = await Promise.all([
    load(urls.day, true),
    load(urls.night, true),
    load(urls.bump, false),
    load(urls.water, false),
    load(urls.clouds, true),
  ]);

  return { day, night, bump, water, clouds };
};

export const createEarthScene = async (options: SceneOptions): Promise<EarthScene> => {
  const shot = SHOTS[options.shot];
  const maps = await loadTextures(options.textureUrls);

  // Headless Chrome here cannot back a WebGPU swap chain at delivery
  // resolutions, so nothing is ever presented to a canvas: the frame is
  // rendered into an offscreen target, read back and painted into a 2D
  // canvas. It also makes the output bit-for-bit reproducible.
  const gpuCanvas = document.createElement("canvas");
  gpuCanvas.width = options.width;
  gpuCanvas.height = options.height;

  const renderer = new WebGPURenderer({
    canvas: gpuCanvas,
    antialias: false,
    alpha: false,
  });
  renderer.setPixelRatio(options.superSample);
  renderer.setSize(options.width, options.height, false);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = shot.exposure;
  await renderer.init();

  const uniforms = createUniforms();
  uniforms.nightIntensity.value = shot.nightIntensity;
  uniforms.sunIntensity.value = shot.sunIntensity;
  uniforms.rayleigh.value = shot.atmosphere.rayleigh;
  uniforms.mie.value = shot.atmosphere.mie;
  uniforms.atmosphereDensity.value = shot.atmosphere.density;
  uniforms.extinction.value = shot.atmosphere.extinction;
  uniforms.haloStrength.value = shot.halo.strength;
  uniforms.surfaceHaze.value = shot.surfaceHaze;
  uniforms.procedural.value = shot.procedural;
  uniforms.motionBlur.value = shot.motionBlur.span;
  uniforms.nebula.value = shot.sky.nebula;
  uniforms.dust.value = shot.sky.dust;

  const scene = new Scene();

  const starfield = new Mesh(
    new SphereGeometry(STAR_SPHERE, 48, 24),
    createStarfieldMaterial(uniforms),
  );
  starfield.renderOrder = -100;
  scene.add(starfield);

  const blurTaps = shot.motionBlur.taps;
  const earth = new Mesh(
    new SphereGeometry(1, 384, 192),
    createEarthMaterial(maps, uniforms, { blurTaps }),
  );
  earth.renderOrder = 0;
  scene.add(earth);

  const cloudDeck = new Mesh(
    new SphereGeometry(CLOUD_RADIUS, 256, 128),
    createCloudMaterial(maps.clouds, uniforms, { blurTaps }),
  );
  cloudDeck.renderOrder = 1;
  scene.add(cloudDeck);

  const sunDiscMaterial = new MeshBasicNodeMaterial();
  sunDiscMaterial.color = new Color(0, 0, 0);
  sunDiscMaterial.blending = AdditiveBlending;
  sunDiscMaterial.transparent = true;
  const sunDisc = new Mesh(new SphereGeometry(0.3, 32, 16), sunDiscMaterial);
  sunDisc.renderOrder = 2;
  sunDisc.visible = shot.sunDisc;
  scene.add(sunDisc);

  // Depth testing stays on here, so the planet occludes the glow and it only
  // shows outside the silhouette. It has to come after the Earth has written
  // depth, hence the render order.
  // The shell is deliberately much larger than the glow it draws: its only
  // job is to cover the screen, while `halo.radius` sets how far the glow
  // actually reaches. Decoupling them means the falloff can be tightened
  // right down without the camera ending up inside the geometry.
  const halo = new Mesh(
    new SphereGeometry(HALO_SHELL, 64, 32),
    createHaloMaterial(uniforms, { radius: shot.halo.radius, falloff: shot.halo.falloff }),
  );
  halo.renderOrder = 5;
  scene.add(halo);

  const air = new Mesh(
    new SphereGeometry(ATMOSPHERE_RADIUS + 0.002, 160, 80),
    createAtmosphereMaterial(uniforms),
  );
  air.renderOrder = 10;
  scene.add(air);

  const camera = new PerspectiveCamera(shot.fov[0], options.width / options.height, 0.01, 300);
  scene.add(camera);

  const sun = sunDirection(shot);
  uniforms.sunDirection.value.copy(sun);

  const meteorMaterial = createMeteorMaterial(uniforms);
  const meteor = new Mesh(new PlaneGeometry(1, 1), meteorMaterial);
  meteor.renderOrder = 20;
  meteor.frustumCulled = false;
  meteor.visible = shot.meteor !== null;
  if (shot.meteor) {
    meteor.scale.set(shot.meteor.length, shot.meteor.width, 1);
    camera.add(meteor);
  }

  const scenePass = pass(scene, camera);
  if (options.samples > 1) {
    scenePass.renderTarget.samples = options.samples;
  }
  const bloomPass = bloom(scenePass, shot.bloom.strength, shot.bloom.radius, shot.bloom.threshold);

  const lit = scenePass.add(bloomPass);
  const flared =
    shot.anamorphic > 0
      ? lit.add(
          anamorphic(scenePass, float(0.82), float(shot.anamorphic * 4.5), 24).mul(
            shot.anamorphic * 0.9,
          ),
        )
      : lit;

  const postProcessing = new PostProcessing(renderer);
  postProcessing.outputNode = applyGrade(flared, {
    width: options.width,
    height: options.height,
    vignette: 0.3,
    grainSeed: uniforms.grainSeed,
  });

  // The post stack already bakes tone mapping and the sRGB transfer into the
  // node graph, so the target itself must not convert again.
  const output = new RenderTarget(options.width, options.height, {
    format: RGBAFormat,
    type: UnsignedByteType,
    colorSpace: NoColorSpace,
    depthBuffer: false,
    stencilBuffer: false,
  });

  const context = options.canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not get a 2D context to present the render into");
  }
  options.canvas.width = options.width;
  options.canvas.height = options.height;
  const frameBuffer = context.createImageData(options.width, options.height);

  const zenith = new Vector3();
  const sunColor = new Color();

  const update = (frame: number) => {
    const progress = options.durationInFrames > 1 ? frame / (options.durationInFrames - 1) : 0;

    placeCamera(camera, shot, progress);
    camera.aspect = options.width / options.height;
    camera.updateProjectionMatrix();

    uniforms.grainSeed.value = frame * 0.017;
    uniforms.cloudDrift.value = progress * 0.0014;
    uniforms.cloudEvolve.value = progress * 0.85;
    uniforms.surfaceSpin.value =
      (shot.spin[0] + (shot.spin[1] - shot.spin[0]) * progress) / 360;
    uniforms.dustDrift.value = progress * shot.sky.dustDrift;

    if (shot.meteor) {
      const pass = shot.meteor;
      const span = Math.max(1, pass.leave - pass.enter);
      const travel = (frame - pass.enter) / span;
      const inside = travel >= 0 && travel <= 1;
      meteor.visible = inside;

      if (inside) {
        const x = pass.from[0] + (pass.to[0] - pass.from[0]) * travel;
        const y = pass.from[1] + (pass.to[1] - pass.from[1]) * travel;
        meteor.position.set(x, y, -pass.depth);
        meteor.rotation.z = Math.atan2(
          pass.to[1] - pass.from[1],
          pass.to[0] - pass.from[0],
        );
        // Ease in and out so it never pops on or off at frame edges.
        const fade = Math.sin(Math.min(1, Math.max(0, travel)) * Math.PI);
        uniforms.meteorIntensity.value = Math.pow(fade, 0.55) * pass.intensity;
      }
    }

    sunDisc.position.copy(sun).multiplyScalar(SUN_DISTANCE);

    if (shot.sunDisc) {
      // How far the disc has climbed above the limb, in degrees. Below the
      // limb it is simply occluded by the planet; just above it, it is seen
      // through a very long slant of air, so it stays red and dim until it
      // has properly cleared.
      zenith.copy(camera.position).normalize();
      const radius = camera.position.length();
      const elevation = 90 - Math.acos(Math.min(1, Math.max(-1, zenith.dot(sun)))) / DEG;
      const limbDepression = 90 - Math.asin(1 / radius) / DEG;
      const aboveLimb = elevation + limbDepression;

      const clear = Math.min(1, Math.max(0, (aboveLimb - 0.2) / 5.5));
      const brightness = Math.min(1, Math.max(0, (aboveLimb + 0.4) / 1.6)) * (0.5 + clear * 2.6);
      sunColor.setRGB(1, 0.24 + clear * 0.6, 0.06 + clear * 0.72).multiplyScalar(brightness);
      sunDiscMaterial.color.copy(sunColor);
    }
  };

  update(0);

  return {
    update,
    render: async () => {
      renderer.setRenderTarget(output);
      postProcessing.render();
      renderer.setRenderTarget(null);

      const pixels = await renderer.readRenderTargetPixelsAsync(
        output,
        0,
        0,
        options.width,
        options.height,
      );
      frameBuffer.data.set(pixels as Uint8Array);
      context.putImageData(frameBuffer, 0, 0);
    },
    dispose: () => {
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          object.material.dispose();
        }
      });
      Object.values(maps).forEach((texture) => texture.dispose());
      output.dispose();
      renderer.dispose();
    },
    backend: (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend
      ? "WebGPU"
      : "WebGL2",
  };
};
