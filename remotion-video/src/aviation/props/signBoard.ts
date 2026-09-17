import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
} from "three/webgpu";
import { positionLocal, smoothstep, texture, vec2, vec3 } from "three/tsl";
import { bakeAirportSign } from "../three/canvas-textures";
import type { TSL } from "../three/tsl";

/**
 * The motorway-style airport direction sign from reference 6.
 *
 * A real one is an aluminium extrusion panel on two galvanised posts, seen from
 * below and slightly to one side. The face carries the artwork; the back is
 * plain unpainted metal with the post channels showing, which matters because
 * the camera drifts far enough to catch its edge.
 */

export type SignBoard = {
  readonly object: Group;
  readonly width: number;
  readonly height: number;
  dispose(): void;
};

export const createSignBoard = (anisotropy: number): SignBoard => {
  const width = 6.4;
  const height = 1.87;
  const thickness = 0.12;

  const face = bakeAirportSign(anisotropy);

  const panelMaterial = new MeshStandardNodeMaterial();
  const local = positionLocal as unknown as TSL;
  const u = local.x.div(width).add(0.5);
  const v = local.y.div(height).add(0.5).oneMinus();
  const art = texture(face, vec2(u, v));
  // Only the front face carries artwork. Everywhere else — edges, back — is
  // the mill finish of the extrusion. The mask rises towards +Z, which is the
  // face: falling the other way leaves the artwork masked out exactly where it
  // is meant to show, and the sign renders as a blank panel.
  const onFace = smoothstep(thickness * 0.3, thickness * 0.5, local.z as TSL);
  const shell = vec3(0.42, 0.43, 0.45);
  panelMaterial.colorNode = art.rgb.mul(onFace).add(shell.mul(onFace.oneMinus())) as TSL;
  panelMaterial.roughnessNode = onFace.mul(0.32).add(0.5) as TSL;
  panelMaterial.metalnessNode = onFace.oneMinus().mul(0.55).add(0.06) as TSL;

  const panel = new Mesh(new BoxGeometry(width, height, thickness), panelMaterial);
  panel.castShadow = true;

  const postMaterial = new MeshStandardNodeMaterial();
  postMaterial.color.setRGB(0.3, 0.31, 0.32);
  postMaterial.roughness = 0.52;
  postMaterial.metalness = 0.75;

  const object = new Group();
  object.add(panel);

  const postGeometry = new CylinderGeometry(0.075, 0.085, 6.2, 12);
  for (const side of [-1, 1]) {
    const post = new Mesh(postGeometry, postMaterial);
    post.position.set(side * width * 0.31, -height / 2 - 3.1, -thickness * 0.9);
    post.castShadow = true;
    object.add(post);
  }

  return {
    object,
    width,
    height,
    dispose() {
      panel.geometry.dispose();
      postGeometry.dispose();
      panelMaterial.dispose();
      postMaterial.dispose();
      face.dispose();
    },
  };
};
