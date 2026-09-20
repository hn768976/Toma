import * as THREE from 'three/webgpu';
import {grain, radialAlpha, wallGradient} from './textures';

/**
 * Shared dark-studio construction kit.
 *
 * The cyclorama (wall + floor) is deliberately UNLIT - its falloff is baked into
 * a canvas gradient. That gives pixel-level control over the studio rolloff that
 * these plates live or die on, and costs one texture fetch instead of a
 * multi-light shading pass over two large planes. Only the podium itself is
 * actually lit, which is where the shading detail needs to be.
 */

export type CycloramaOpts = {
  wall: {
    top: string;
    mid: string;
    bottom: string;
    hotspot?: string;
    hotY?: number;
    hotR?: number;
  };
  /** Wall plane size in world units. Sized close to the visible area so the
   *  hot-spot gradient maps predictably instead of smearing over a huge plane. */
  wallSize: [number, number];
  /** Wall centre height, and its distance behind the origin. */
  wallY: number;
  wallZ: number;
  floorBase: string;
  floorSize?: [number, number];
  floorY?: number;
  /** Baked elliptical light pool on the floor. */
  pool?: {
    stops: [number, number][];
    color: string;
    scaleX: number;
    scaleZ: number;
    z: number;
    opacity?: number;
  };
};

/**
 * Shared dark-studio construction kit.
 *
 * The cyclorama (wall + floor) is deliberately UNLIT - its falloff is baked into
 * a canvas gradient. That gives pixel-level control over the studio rolloff that
 * these plates live or die on, and costs one texture fetch instead of a
 * multi-light shading pass over two large planes. Only the podium itself is
 * actually lit, which is where the shading detail needs to be.
 *
 * Measured off the references, these are TIGHT sets: the back wall sits barely
 * half a unit behind the podium, which is exactly what produces the signature
 * halo directly behind the subject.
 */
export const addCyclorama = (scene: THREE.Scene, opts: CycloramaOpts) => {
  const floorY = opts.floorY ?? 0;

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(opts.wallSize[0], opts.wallSize[1]),
    new THREE.MeshBasicMaterial({map: wallGradient(opts.wall), toneMapped: false}),
  );
  wall.position.set(0, opts.wallY, opts.wallZ);
  scene.add(wall);

  const [fw, fd] = opts.floorSize ?? [60, 60];
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(fw, fd),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(opts.floorBase),
      toneMapped: false,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, floorY, opts.wallZ + fd / 2);
  scene.add(floor);

  if (opts.pool) {
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: radialAlpha(opts.pool.stops, 512, opts.pool.color),
        transparent: true,
        opacity: opts.pool.opacity ?? 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set(opts.pool.scaleX, opts.pool.scaleZ, 1);
    pool.position.set(0, floorY + 0.004, opts.pool.z);
    scene.add(pool);
  }

  return {wall, floor};
};

/**
 * Soft elliptical contact shadow. Cheaper and far more art-directable than a
 * shadow map at this scale, and it is what the references actually show:
 * a tight dark core under the podium melting into the floor.
 */
export const addContactShadow = (
  scene: THREE.Scene,
  opts: {width: number; depth: number; y: number; z: number; opacity: number; color?: string},
) => {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: radialAlpha(
        [
          [0, 1],
          [0.35, 0.72],
          [0.62, 0.24],
          [1, 0],
        ],
        512,
        opts.color ?? '0,0,0',
      ),
      transparent: true,
      opacity: opts.opacity,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(opts.width, opts.depth, 1);
  mesh.position.set(0, opts.y, opts.z);
  scene.add(mesh);
  return mesh;
};

/**
 * Camera-parented full-frame overlays: vignette then grain.
 * Grain matters more than it looks - these plates are almost entirely smooth
 * dark gradients, which band hard once h264 gets hold of them.
 */
export const attachOverlays = (
  camera: THREE.PerspectiveCamera,
  /** `grain` is a dither amplitude in output levels (0-255), not an opacity. */
  opts: {vignette?: number; grain?: number; aspect: number},
) => {
  const dist = 1.2;
  const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const w = h * opts.aspect;

  if (opts.vignette) {
    const v = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.02, h * 1.02),
      new THREE.MeshBasicMaterial({
        map: radialAlpha(
          [
            [0, 0],
            [0.45, 0],
            [0.75, 0.35],
            [1, 1],
          ],
          512,
          '0,0,0',
        ),
        transparent: true,
        opacity: opts.vignette,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    );
    v.position.z = -dist;
    v.renderOrder = 998;
    camera.add(v);
  }

  if (opts.grain) {
    const tex = grain(opts.grain, 256, 7);
    tex.repeat.set(w * 24, h * 24);
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.02, h * 1.02),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    );
    g.position.z = -dist * 0.999;
    g.renderOrder = 999;
    camera.add(g);
  }
};
