import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { Matrix4, Uniform } from "three";

/**
 * Camera motion blur for a static scene.
 *
 * Each pixel is put back into the world from the depth buffer, then projected
 * with the camera as it was half a shutter earlier and half a shutter later.
 * The picture is averaged along that screen-space path. Both cameras are pure
 * functions of the frame number, so the blur is fully deterministic.
 */
const fragment = /* glsl */ `
uniform mat4 uInvViewProj;
uniform mat4 uPrevViewProj;
uniform mat4 uNextViewProj;
uniform float uFrame;

uint mbHashU(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v.x ^ v.y ^ v.z;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec4 world = uInvViewProj * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  world /= world.w;
  vec4 a = uPrevViewProj * world;
  vec4 b = uNextViewProj * world;
  vec2 path = (b.xy / b.w - a.xy / a.w) * 0.5;
  // per-pixel offset of the tap positions hides the steps between taps
  float j = float(mbHashU(uvec3(uint(gl_FragCoord.x), uint(gl_FragCoord.y), uint(uFrame) + 977u)) >> 8u) / 16777216.0;
  vec4 acc = vec4(0.0);
  for (int i = 0; i < MB_TAPS; i++) {
    float t = (float(i) + j) / float(MB_TAPS) - 0.5;
    acc += texture2D(inputBuffer, uv + path * t);
  }
  outputColor = acc / float(MB_TAPS);
}
`;

export class MotionBlurEffect extends Effect {
  constructor(taps: number) {
    super("MotionBlurEffect", fragment, {
      blendFunction: BlendFunction.SET,
      attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
      defines: new Map([["MB_TAPS", String(Math.max(1, Math.round(taps)))]]),
      uniforms: new Map<string, Uniform>([
        ["uInvViewProj", new Uniform(new Matrix4())],
        ["uPrevViewProj", new Uniform(new Matrix4())],
        ["uNextViewProj", new Uniform(new Matrix4())],
        ["uFrame", new Uniform(0)],
      ]),
    });
  }

  setMatrices(invViewProj: Matrix4, prevViewProj: Matrix4, nextViewProj: Matrix4, frame: number) {
    (this.uniforms.get("uInvViewProj")!.value as Matrix4).copy(invViewProj);
    (this.uniforms.get("uPrevViewProj")!.value as Matrix4).copy(prevViewProj);
    (this.uniforms.get("uNextViewProj")!.value as Matrix4).copy(nextViewProj);
    this.uniforms.get("uFrame")!.value = frame;
  }
}
