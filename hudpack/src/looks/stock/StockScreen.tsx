import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LOOP } from "../../lib/loop";
import { PostChain } from "../../lib/three/PostChain";
import { ThreeLook, ThreeRender } from "../../lib/three/ThreeLook";
import type { StockPalette } from "../../versions";
import { BOARD_H, BOARD_W, drawBoard } from "./drawBoard";

const PLANE_W = 30;
const PLANE_H = 10;

const VERT = /* glsl */ `
out vec2 vUv;
out float vDepth;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

// Screen gradient computed in float (no 8-bit steps); the board texture is
// premultiplied and laid over it. The far side fades into the dark.
const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vDepth;
out vec4 outColor;
uniform sampler2D tBoard;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform float uFadeNear;
uniform float uFadeFar;
void main() {
  vec3 base = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
  // a soft lift in the middle band where the price line runs
  base *= 1.0 + 0.25 * exp(-pow((vUv.y - 0.45) / 0.22, 2.0));
  vec4 t = texture(tBoard, vUv);
  vec3 c = base * (1.0 - t.a) + t.rgb;
  float fade = smoothstep(uFadeNear, uFadeFar, vDepth);
  c *= mix(1.0, 0.28, fade);
  outColor = vec4(c, 1.0);
}
`;

const hex = (h: string) => new THREE.Color().setStyle(h, THREE.LinearSRGBColorSpace);

export const StockScreen: React.FC<{ palette: StockPalette }> = ({ palette }) => {
  const chain = useRef<PostChain | null>(null);

  const world = useMemo(() => {
    const scene = new THREE.Scene();
    // background beyond the board: the darkest screen tone
    scene.background = hex(palette.screenTop).multiplyScalar(0.35);
    const canvas = document.createElement("canvas");
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    tex.premultiplyAlpha = true;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        tBoard: { value: tex },
        uTop: { value: hex(palette.screenTop) },
        uBottom: { value: hex(palette.screenBottom) },
        uFadeNear: { value: 22 },
        uFadeFar: { value: 34 },
      },
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_W, PLANE_H), mat);
    // ~35 degrees away, tilted down a little
    plane.rotation.order = "YXZ";
    plane.rotation.y = 0.84;
    plane.rotation.x = 0.05;
    plane.position.set(2.6, 0, 0);
    scene.add(plane);
    // long lens: steep angle with gentle convergence, as in the reference
    const camera = new THREE.PerspectiveCamera(21, 16 / 9, 1, 200);
    return { scene, canvas, tex, plane, camera, raycaster: new THREE.Raycaster() };
  }, [palette]);

  useEffect(
    () => () => {
      chain.current?.dispose();
      world.tex.dispose();
    },
    [world],
  );

  const render = useCallback<ThreeRender>(
    (gl, frame, size) => {
      const f = frame % LOOP;
      const { scene, canvas, tex, plane, camera, raycaster } = world;

      // texture size follows the output size (3x width, up to 8192)
      const tw = Math.min(8192, Math.max(1024, 3 * size.w));
      if (canvas.width !== tw) {
        canvas.width = tw;
        canvas.height = Math.round((tw * BOARD_H) / BOARD_W);
        tex.anisotropy = gl.capabilities.getMaxAnisotropy();
        tex.dispose();
      }
      const ctx = canvas.getContext("2d")!;
      drawBoard(ctx, tw, f, palette);
      tex.needsUpdate = true;

      // camera: one slow sideways cosine drift per loop
      const ph = (2 * Math.PI * f) / LOOP;
      camera.aspect = size.w / size.h;
      camera.position.set(0.5 * Math.cos(ph), 0.1 + 0.08 * Math.sin(ph), 25);
      camera.lookAt(camera.position.x + 0.4, 0.0, 0.0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      plane.updateMatrixWorld();

      // focus a third of the way in: where the board meets the screen's
      // left-third line
      raycaster.setFromCamera(new THREE.Vector2(-1 / 3, 0), camera);
      const hit = raycaster.intersectObject(plane)[0];
      const focus = hit ? hit.point.clone().applyMatrix4(camera.matrixWorldInverse).z * -1 : 8;

      if (!chain.current || chain.current.w !== size.w || chain.current.h !== size.h) {
        chain.current?.dispose();
        chain.current = new PostChain(size.w, size.h);
      }
      chain.current.render(gl, scene, camera, f, { focus, aperture: 36, maxCoc: 9 }, 0.01, 1);
    },
    [palette, world],
  );

  return <ThreeLook render={render} />;
};

