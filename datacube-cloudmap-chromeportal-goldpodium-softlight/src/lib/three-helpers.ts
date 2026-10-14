import {
  BackSide,
  Color,
  IcosahedronGeometry,
  Material,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Texture,
  WebGLRenderer,
} from "three";

/** Build a PMREM environment map from a throwaway scene (once, deterministic). */
export const envFromScene = (renderer: WebGLRenderer, scene: Scene): Texture => {
  const pmrem = new PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0, 0.1, 100);
  pmrem.dispose();
  return rt.texture;
};

/** Inside-facing sphere whose colour is a shader of the view direction. */
export const envDome = (fragmentBody: string, uniforms: Record<string, { value: unknown }> = {}) => {
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      ${Object.keys(uniforms).map((k) => `uniform ${uniformType(uniforms[k].value)} ${k};`).join("\n")}
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = vec3(0.0);
        ${fragmentBody}
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return new Mesh(new IcosahedronGeometry(50, 6), mat);
};

const uniformType = (v: unknown) => {
  if (v instanceof Color) return "vec3";
  if (typeof v === "number") return "float";
  return "vec3";
};

/** Emissive rectangle panel (softbox) for env scenes. */
export const panel = (w: number, h: number, color: Color, intensity: number) => {
  const m = new Mesh(
    new PlaneGeometry(w, h),
    new MeshBasicMaterial({ color: color.clone().multiplyScalar(intensity), side: 2 }),
  );
  return m;
};

export const disposeMaterial = (m: Material | Material[]) => {
  (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
};
