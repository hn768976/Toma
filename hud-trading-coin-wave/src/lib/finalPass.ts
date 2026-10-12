// Final full-screen pass for the WebGL looks: ±1/255 dither and ~1.5% grain,
// a fixed hash of (pixel, frame % 600). Runs after tone mapping / sRGB, on
// half-float input, so the dither breaks up 8-bit steps in gradients.
export const GRAIN_GLSL = /* glsl */ `
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 ditherGrain(vec3 col, vec2 fc, float frame, float grain){
  float n1 = hash13(vec3(fc, frame));
  float n2 = hash13(vec3(fc + 17.0, frame + 101.0));
  float tri = n1 + n2 - 1.0;                 // triangular, [-1,1]
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col += tri * grain * smoothstep(0.0, 0.12, lum);   // film grain
  col += (n1 - 0.5) * (2.0 / 255.0);         // ±1/255 dither
  return col;
}`;

export const FINAL_PASS = {
  uniforms: { tDiffuse: { value: null }, uFrame: { value: 0 }, uGrain: { value: 0.015 }, uVignette: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform float uFrame; uniform float uGrain; uniform float uVignette; varying vec2 vUv;
${GRAIN_GLSL}
void main(){ vec4 c = texture2D(tDiffuse, vUv);
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.75); c.rgb *= 1.0 - uVignette * smoothstep(0.12, 0.62, dot(q, q) * 2.2);
  gl_FragColor = vec4(ditherGrain(c.rgb, gl_FragCoord.xy, uFrame, uGrain), 1.0); }`,
};
