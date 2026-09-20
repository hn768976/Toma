import * as THREE from 'three/webgpu';
import type { Theme } from '../themes';
import type { FrameState } from '../timeline';
import { createPadGridTexture, createRingTexture } from './textures';

export const SOCKET_OUTER = 12.2;
export const SOCKET_INNER = 8.9;
export const SOCKET_HEIGHT = 0.62;

export interface SocketResult {
  group: THREE.Group;
  update: (s: FrameState) => void;
  dispose: () => void;
}

/**
 * The LGA socket: a machined retention frame around a contact-pad floor,
 * plus a lip glow that comes up as the package seats. In V3 this frame is
 * the brightest object in the opening shot, which is why its metalness and
 * colour are theme-driven rather than shared.
 */
export const createSocket = (theme: Theme, textureSize: number): SocketResult => {
  const group = new THREE.Group();
  const padTex = createPadGridTexture(theme, Math.min(1024, textureSize / 2), 44);
  const ringTex = createRingTexture(512, 0.58, 0.99);

  const frameMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(theme.socket.frameColor),
    metalness: theme.socket.metalness,
    roughness: theme.socket.roughness,
  });

  // Four rails rather than an extruded shape with a hole — cheaper, and the
  // mitred corners are hidden under the package anyway.
  const railLong = new THREE.BoxGeometry(SOCKET_OUTER, SOCKET_HEIGHT, (SOCKET_OUTER - SOCKET_INNER) / 2);
  const railShort = new THREE.BoxGeometry((SOCKET_OUTER - SOCKET_INNER) / 2, SOCKET_HEIGHT, SOCKET_INNER);
  const edge = (SOCKET_INNER + (SOCKET_OUTER - SOCKET_INNER) / 2) / 2;

  const rails: THREE.Mesh[] = [
    new THREE.Mesh(railLong, frameMat),
    new THREE.Mesh(railLong, frameMat),
    new THREE.Mesh(railShort, frameMat),
    new THREE.Mesh(railShort, frameMat),
  ];
  rails[0].position.set(0, SOCKET_HEIGHT / 2, edge);
  rails[1].position.set(0, SOCKET_HEIGHT / 2, -edge);
  rails[2].position.set(edge, SOCKET_HEIGHT / 2, 0);
  rails[3].position.set(-edge, SOCKET_HEIGHT / 2, 0);
  rails.forEach((r) => group.add(r));

  // Chamfered inner lip, slightly brighter than the rails.
  const lipMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(theme.socket.frameColor).multiplyScalar(1.25),
    metalness: theme.socket.metalness,
    roughness: Math.max(0.08, theme.socket.roughness - 0.1),
  });
  const lipGeo = new THREE.BoxGeometry(SOCKET_INNER + 0.45, 0.14, SOCKET_INNER + 0.45);
  const lip = new THREE.Mesh(lipGeo, lipMat);
  lip.position.y = SOCKET_HEIGHT - 0.05;
  group.add(lip);

  // Contact-pad floor.
  const floorMat = new THREE.MeshStandardNodeMaterial({
    map: padTex,
    metalness: 0.88,
    roughness: 0.3,
  });
  const floorGeo = new THREE.PlaneGeometry(SOCKET_INNER, SOCKET_INNER);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.1;
  group.add(floor);

  // Glow that runs around the socket once the package is in.
  const glowMat = new THREE.MeshBasicNodeMaterial({
    map: ringTex,
    color: new THREE.Color(theme.socket.glowColor),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0,
  });
  const glowGeo = new THREE.PlaneGeometry(SOCKET_OUTER * 2.1, SOCKET_OUTER * 2.1);
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = SOCKET_HEIGHT * 0.55;
  glow.renderOrder = 6;
  group.add(glow);

  return {
    group,
    update: (s) => {
      glowMat.opacity = Math.min(1, s.energy * 0.13 + s.flash * 0.3);
      const sc = 1 + s.flash * 0.1;
      glow.scale.setScalar(sc);
    },
    dispose: () => {
      padTex.dispose();
      ringTex.dispose();
      railLong.dispose();
      railShort.dispose();
      lipGeo.dispose();
      floorGeo.dispose();
      glowGeo.dispose();
      frameMat.dispose();
      lipMat.dispose();
      floorMat.dispose();
      glowMat.dispose();
    },
  };
};
