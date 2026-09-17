import {
  AmbientLight,
  BackSide,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicNodeMaterial,
  Scene,
  SphereGeometry,
  Vector3,
  type Camera,
} from "three/webgpu";
import { cameraPosition, float, mix } from "three/tsl";
import { viewRayDirection } from "./view-ray";
import { bakeSkyEnvironment, createSkyRig, type SkyParams, type SkyRig } from "./sky";
import type { CloudLayer } from "../post/clouds";
import type { TSL } from "./tsl";

/**
 * Sky, sun and ambient fill, wired so all three agree with each other.
 *
 * The dome, the image-based lighting and the key light are all derived from one
 * {@link SkyParams}: the dome shades the analytic model directly, the
 * environment map is a baked copy of it, and the sun's colour and direction are
 * read straight off it. Change the sky and the lighting follows — which is what
 * lets six very different times of day share one rig.
 *
 * The dome lives in its own scene rather than in the main one. Clouds are
 * marched in the dome's own fragment shader, and marching them at full
 * resolution is by far the most expensive thing in the frame, so the pipeline
 * renders this scene into a half-size target and feeds it back as the main
 * scene's background. Keeping the dome separate is what makes that possible —
 * and because the dome is drawn before any geometry, solid objects occlude
 * cloud for free, with no depth buffer sampling anywhere.
 */

export type WorldOptions = {
  readonly skyParams: SkyParams;
  /** Dome radius in metres. Must sit inside the camera's far plane. */
  readonly radius: number;
  /** Key light intensity. */
  readonly sunIntensity: number;
  /** Sky/ground bounce intensity. */
  readonly fillIntensity: number;
  /** Colour bounced up off the ground. */
  readonly groundColor?: Vector3;
  /** Multiplier on the image-based specular. */
  readonly environmentIntensity?: number;
  /** Composited into the dome when present. */
  readonly clouds?: CloudLayer;
  readonly castShadows?: boolean;
  /** Half-width of the shadow frustum, in metres. */
  readonly shadowExtent?: number;
  readonly shadowMapSize?: number;
};

export type World = {
  /** Everything except the sky. */
  readonly scene: Scene;
  /** The dome alone, rendered first and at reduced resolution. */
  readonly skyScene: Scene;
  readonly sky: SkyRig;
  readonly sun: DirectionalLight;
  readonly dome: Mesh;
  /** Keeps the dome and the key light centred on the camera. */
  follow(camera: Camera): void;
  dispose(): void;
};

export const createWorld = (options: WorldOptions): World => {
  const {
    skyParams,
    radius,
    sunIntensity,
    fillIntensity,
    groundColor = new Vector3(0.22, 0.2, 0.18),
    environmentIntensity = 1,
    clouds,
    castShadows = false,
    shadowExtent = 120,
    shadowMapSize = 2048,
  } = options;

  const scene = new Scene();
  const skyScene = new Scene();
  const sky = createSkyRig(skyParams);

  const environment = bakeSkyEnvironment(skyParams);
  scene.environment = environment;
  scene.environmentIntensity = environmentIntensity;

  // The dome is inside-out and unlit: it *is* the light source, so shading it
  // would double-count.
  const domeMaterial = new MeshBasicNodeMaterial();
  domeMaterial.side = BackSide;
  domeMaterial.depthWrite = false;
  domeMaterial.depthTest = false;
  domeMaterial.fog = false;

  const rayDirection = viewRayDirection();
  const skyColor = sky.radiance(rayDirection);
  if (clouds) {
    // Nothing in these scenes is further away than cloud, so the march runs to
    // its own horizon limit rather than to a depth-buffer distance.
    const marched = clouds.march(cameraPosition as unknown as TSL, rayDirection, float(1e9));
    domeMaterial.colorNode = mix(skyColor, marched.rgb as TSL, marched.a) as unknown as typeof skyColor;
  } else {
    domeMaterial.colorNode = skyColor;
  }

  const dome = new Mesh(new SphereGeometry(radius, 48, 32), domeMaterial);
  dome.frustumCulled = false;
  skyScene.add(dome);

  const sun = new DirectionalLight();
  sun.color.setRGB(skyParams.sunColor.x, skyParams.sunColor.y, skyParams.sunColor.z);
  sun.intensity = sunIntensity;
  sun.castShadow = castShadows;
  if (castShadows) {
    sun.shadow.mapSize.setScalar(shadowMapSize);
    sun.shadow.camera.left = -shadowExtent;
    sun.shadow.camera.right = shadowExtent;
    sun.shadow.camera.top = shadowExtent;
    sun.shadow.camera.bottom = -shadowExtent;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = shadowExtent * 6;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.08;
  }
  scene.add(sun);
  scene.add(sun.target);

  // Hemisphere fill stands in for the dome's diffuse contribution, which the
  // baked environment map only really covers for specular.
  const zenith = skyParams.zenithColor;
  const hemisphere = new HemisphereLight();
  hemisphere.color.setRGB(zenith.x, zenith.y, zenith.z);
  hemisphere.groundColor.setRGB(groundColor.x, groundColor.y, groundColor.z);
  hemisphere.intensity = fillIntensity;
  scene.add(hemisphere);

  // A trace of uniform ambient keeps deep corrugation valleys off pure black,
  // the way real skylight wraps into them.
  const ambient = new AmbientLight();
  ambient.color.setRGB(zenith.x + 0.1, zenith.y + 0.1, zenith.z + 0.12);
  ambient.intensity = fillIntensity * 0.22;
  scene.add(ambient);

  const shadowDistance = Math.min(radius * 0.4, shadowExtent * 3);

  return {
    scene,
    skyScene,
    sky,
    sun,
    dome,
    follow(camera) {
      dome.position.copy(camera.position);
      sun.position.copy(camera.position).addScaledVector(skyParams.sunDirection, shadowDistance);
      sun.target.position.copy(camera.position);
      sun.target.updateMatrixWorld();
    },
    dispose() {
      dome.geometry.dispose();
      domeMaterial.dispose();
      environment.dispose();
    },
  };
};
