import { Color, ShaderMaterial, Texture } from "three";
import { GlassTextureSet } from "./glass-textures";

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Base interior + LEDs. A share of the LEDs flicker (server activity),
// driven only by uTime so every frame is deterministic.
const fragmentShader = /* glsl */ `
uniform sampler2D uBase;
uniform sampler2D uLeds;
uniform float uTime;
uniform float uLedBoost;
uniform vec3 uLed0;
uniform vec3 uLed1;
uniform vec3 uLed2;
varying vec2 vUv;

void main() {
  vec3 base = texture2D(uBase, vUv).rgb;
  vec3 led = texture2D(uLeds, vUv).rgb;
  float phase = led.g;
  float kind = fract(phase * 13.73);
  float on = 1.0;
  if (kind < 0.35) {
    float speed = 0.8 + kind * 9.0;
    on = mix(0.18, 1.0, step(0.32, fract(uTime * speed + phase * 7.1)));
  } else if (kind < 0.5) {
    on = 0.75 + 0.25 * sin(uTime * 3.0 + phase * 40.0);
  }
  vec3 ledColor = led.b < 0.25 ? uLed0 : (led.b < 0.75 ? uLed1 : uLed2);
  vec3 col = base + ledColor * led.r * on * uLedBoost;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export const makeGlassMaterial = (
  set: GlassTextureSet,
  ledColors: [string, string, string],
  ledBoost: number,
) =>
  new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uBase: { value: set.base as Texture },
      uLeds: { value: set.leds as Texture },
      uTime: { value: 0 },
      uLedBoost: { value: ledBoost },
      uLed0: { value: new Color(ledColors[0]) },
      uLed1: { value: new Color(ledColors[1]) },
      uLed2: { value: new Color(ledColors[2]) },
    },
  });
