import {
  BackSide,
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  type Texture,
  type WebGPURenderer,
} from 'three/webgpu';

const addPanel = (
  scene: Scene,
  hex: string,
  size: [number, number],
  position: [number, number, number],
  rotation: [number, number, number],
) => {
  const mesh = new Mesh(
    new PlaneGeometry(size[0], size[1]),
    new MeshBasicNodeMaterial({color: new Color(hex), side: BackSide}),
  );
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  scene.add(mesh);
};

/**
 * A miniature lighting room, convolved into a PMREM cube map.
 *
 * The glass has no transmission, so these panels *are* its reflections: the
 * tall bright panel on the -x side is what draws the long streaked highlights
 * running down each band in the reference.
 */
export const createEnvironment = async (
  renderer: WebGPURenderer,
  top: string,
  bottom: string,
): Promise<Texture> => {
  const scene = new Scene();

  const room = new Mesh(
    new BoxGeometry(12, 12, 12),
    new MeshBasicNodeMaterial({color: new Color(top), side: BackSide}),
  );
  scene.add(room);

  // Tall key panel on the lit side — the long streaks down each bar.
  addPanel(scene, bottom, [6, 11], [-5.9, 0.5, 0], [0, -Math.PI / 2, 0]);
  // Bounce from below.
  addPanel(scene, bottom, [11, 5], [0, -5.9, 0], [-Math.PI / 2, 0, 0]);
  // Overhead strip, so the top edge of every slab catches a line.
  addPanel(scene, bottom, [11, 2.4], [0, 5.9, 0], [Math.PI / 2, 0, 0]);
  // Narrow kicker behind, for a second highlight on the far edges.
  addPanel(scene, bottom, [2.2, 11], [2.6, 0, -5.9], [0, 0, 0]);

  const pmrem = new PMREMGenerator(renderer);
  const target = await pmrem.fromSceneAsync(scene, 0.04);
  pmrem.dispose();
  room.geometry.dispose();
  return target.texture;
};
