// Final pass for the fibre-optic look: reads the half-float scene target,
// adds the background gradient and bundle glow in float, tone-maps, then
// applies ±1/255 TPDF dither and ~2% grain from a fixed hash of
// (pixel, frame). Runs as a custom Pixi Filter with a uFrame uniform.
import {
  Filter,
  FilterSystem,
  GlProgram,
  RenderSurface,
  Texture,
  UniformGroup,
} from "pixi.js";
import { HASH_GLSL } from "../lib/glsl";

// Both stages must contain "#version 300 es": without it Pixi compiles them
// as GLSL ES 1.00, where the integer hash below is not available.
const vertex = /* glsl */ `#version 300 es
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`;

const fragment = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uFrame;
uniform float uExposure;
uniform float uGrain;
uniform vec3 uBgTop;
uniform vec3 uBgBottom;
uniform vec3 uGlow;
${HASH_GLSL}
void main(void) {
  vec2 uv = vTextureCoord; // 0..1, y down
  vec3 scene = texture(uTexture, uv).rgb * uExposure;

  // background: deep navy at the top-left falling to black, in float
  float gy = smoothstep(0.0, 1.0, 1.0 - uv.y * 0.85 - uv.x * 0.25);
  vec3 bg = mix(uBgBottom, uBgTop, gy);
  // light from the bundle below frame (soft, wide)
  vec2 q = (uv - vec2(0.68, 1.1)) * vec2(1.0, 1.55);
  float glow = exp(-dot(q, q) / 0.11);
  vec3 c = bg + scene + uGlow * glow;

  // per-channel exponential shoulder: saturated blue in the body of the
  // glow, rolling through the palette colour to cyan-white in the hottest
  // overlaps (as on the reference)
  vec3 mapped = 1.0 - exp(-c);

  uvec2 p = uvec2(gl_FragCoord.xy);
  uint f = uint(uFrame + 0.5);
  float luma = dot(mapped, vec3(0.2126, 0.7152, 0.0722));
  // grain ~2% of full scale, slightly weaker in the deepest blacks
  mapped += grainRGB(p, f, uGrain) * (0.35 + 0.65 * smoothstep(0.0, 0.25, luma));
  mapped += ditherTPDF(p, f);
  finalColor = vec4(clamp(mapped, 0.0, 1.0), 1.0);
}
`;

export class FibrePostFilter extends Filter {
  public source: Texture | null = null;
  public uniformsGroup: UniformGroup;

  constructor() {
    const uniformsGroup = new UniformGroup({
      uFrame: { value: 0, type: "f32" },
      uExposure: { value: 1, type: "f32" },
      uGrain: { value: 0.02, type: "f32" },
      uBgTop: { value: new Float32Array([0, 0, 0]), type: "vec3<f32>" },
      uBgBottom: { value: new Float32Array([0, 0, 0]), type: "vec3<f32>" },
      uGlow: { value: new Float32Array([0, 0, 0]), type: "vec3<f32>" },
    });
    super({
      glProgram: GlProgram.from({ vertex, fragment, name: "fibre-post" }),
      resources: { postUniforms: uniformsGroup },
    });
    this.uniformsGroup = uniformsGroup;
  }

  // Read the half-float scene target directly instead of the 8-bit copy the
  // filter system would otherwise make of the host sprite.
  apply(
    filterManager: FilterSystem,
    input: Texture,
    output: RenderSurface,
    clearMode: boolean,
  ) {
    filterManager.applyFilter(this, this.source ?? input, output, clearMode);
  }
}
