import { Mesh, PerspectiveCamera, Scene, ShaderMaterial } from "three";
import { cortexGeometry } from "../engine/geometry";
import { Post } from "../engine/post";
import type { LookFactory } from "../engine/Stage";

// Neutral grey render of the normalised GLB for the model check (no look
// styling): plain diffuse + AO so the anatomy is judged on its own.

export type ModelView = "side" | "top" | "threeQuarter";

const VIEWS: Record<ModelView, { pos: [number, number, number]; up: [number, number, number] }> = {
  side: { pos: [0, 0.0, 6.2], up: [0, 1, 0] }, // looking at the left hemisphere, front to the right
  top: { pos: [0, 6.2, 0.001], up: [1, 0, 0] }, // from above, front up
  threeQuarter: { pos: [3.9, 2.0, 4.5], up: [0, 1, 0] },
};

export const modelCheckLook =
  (view: ModelView): LookFactory =>
  ({ gl, assets, width, height }) => {
    const post = new Post(
      gl,
      { msaa: 4, bloom: null, background: "return vec3(0.5);", key: null, exposure: 1 },
      assets.blueNoise,
    );
    const scene = new Scene();
    const mat = new ShaderMaterial({
      glslVersion: "300 es" as never,
      vertexShader: /* glsl */ `
        in float ao;
        out vec3 vN; out float vAo; out vec3 vV;
        void main() {
          vN = normalize(normalMatrix * normal);
          vAo = ao;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        in vec3 vN; in float vAo; in vec3 vV;
        out vec4 o;
        void main() {
          vec3 n = normalize(vN);
          vec3 l = normalize(vec3(0.4, 0.7, 0.6));
          float d = max(dot(n, l), 0.0) * 0.75 + 0.25;
          vec3 c = vec3(0.62) * d * mix(0.55, 1.0, vAo);
          o = vec4(c, 1.0);
        }`,
    });
    scene.add(new Mesh(cortexGeometry(assets), mat));
    const cam = new PerspectiveCamera(22, width / height, 0.1, 50);
    const v = VIEWS[view];
    cam.position.set(...v.pos);
    cam.up.set(...v.up);
    cam.lookAt(0, 0, 0);
    return {
      render(frame) {
        post.begin();
        gl.render(scene, cam);
        post.end(frame);
      },
      dispose() {
        post.dispose();
        mat.dispose();
      },
    };
  };
