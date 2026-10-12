import * as THREE from "three";

/**
 * Procedural studio environment: a dim graded room with a few soft boxes.
 * Rendered once through PMREM. Only used for reflections / IBL; the
 * visible backgrounds are drawn in the post shader.
 */
const buildEnvScene = (): THREE.Scene => {
  const scene = new THREE.Scene();

  // graded room: brighter ceiling, darker floor
  const room = new THREE.SphereGeometry(20, 64, 32);
  const colors: number[] = [];
  const pos = room.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 20; // -1..1
    const v = THREE.MathUtils.lerp(0.04, 0.22, THREE.MathUtils.smoothstep(y, -0.6, 0.9));
    colors.push(v, v, v * 1.04);
  }
  room.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  scene.add(
    new THREE.Mesh(
      room,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }),
    ),
  );

  const box = (
    w: number,
    h: number,
    intensity: number,
    position: [number, number, number],
    tint: [number, number, number] = [1, 1, 1],
  ) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(tint[0] * intensity, tint[1] * intensity, tint[2] * intensity),
        side: THREE.DoubleSide,
      }),
    );
    m.position.set(...position);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };

  box(5, 6, 3.2, [-7, 5, 6]); // key: big soft box, upper left front
  box(1.4, 12, 6.0, [9, 1, -3]); // rim: tall strip, right
  box(1.0, 10, 2.5, [-9, 0, -4]); // left back strip
  box(8, 3, 1.6, [0, 10, 1]); // overhead
  box(4, 1.2, 0.7, [2, -4, 8]); // low front fill (keeps the black glass from going dead)
  box(1.6, 8, 2.2, [6, 2, 8], [1, 1, 1.03]); // right front strip, frame glints when turning

  return scene;
};

export const buildEnvironment = (gl: THREE.WebGLRenderer): THREE.Texture => {
  const pmrem = new THREE.PMREMGenerator(gl);
  const envScene = buildEnvScene();
  const rt = pmrem.fromScene(envScene, 0.03);
  pmrem.dispose();
  envScene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  return rt.texture;
};
