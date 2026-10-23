import { COLS, ROWS } from "./lights";

export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// Wall units: 1.0 = frame height of the reference framing. Cells are
// (16/9)/8 wide and 1/4 high, so the centre 8 x 4 block fills a 16:9 frame.
export const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec4 uA[${COLS * ROWS}]; // intensity, beam angle, beam strength, beam spread
uniform vec4 uB[${COLS * ROWS}]; // ambient spill, seed, -, -
uniform vec4 uLit[${COLS * ROWS}];  // lit lamps: centre.xy, intensity, beam angle
uniform vec4 uLit2[${COLS * ROWS}]; // lit lamps: beam strength, spread, seed, -
uniform int uLitCount;
uniform vec3 uCamPos;
uniform vec3 uCamFwd;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform float uTanHalf;
uniform float uHaze;
out vec4 outColor;

const int COLS = ${COLS};
const int ROWS = ${ROWS};
const float CW = 0.2222222;
const float CH = 0.25;
const float R = 0.066;

float hash(float n){ return fract(sin(n)*43758.5453123); }
float vnoise(float x){
  float i = floor(x); float f = fract(x);
  f = f*f*(3.0 - 2.0*f);
  return mix(hash(i), hash(i + 1.0), f);
}
// Value noise around a circle: k cells per turn, wraps seamlessly at +-pi.
float pnoise(float a, float k, float seed){
  float x = (a/6.2831853 + 0.5)*k;
  float i = floor(x); float f = fract(x);
  f = f*f*(3.0 - 2.0*f);
  return mix(hash(mod(i, k) + seed*17.0), hash(mod(i + 1.0, k) + seed*17.0), f);
}
float ring(float r, float c, float w, float aa){
  return 1.0 - smoothstep(w, w + aa, abs(r - c));
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  vec3 dir = normalize(uCamFwd + uv.x*2.0*uTanHalf*uCamRight + uv.y*2.0*uTanHalf*uCamUp);
  float tHit = -uCamPos.z/dir.z;
  vec2 p = (uCamPos + dir*tHit).xy;
  float px = max(fwidth(p.x), fwidth(p.y)); // wall units per pixel

  float x = 0.0;

  // Housing + lit face: lamps sit at cell centres and the housing radius is
  // smaller than half a cell, so only the lamp of this pixel's cell matters.
  ivec2 cell = ivec2(floor(vec2(p.x/CW, p.y/CH) + vec2(float(COLS), float(ROWS))*0.5));
  if (cell.x >= 0 && cell.x < COLS && cell.y >= 0 && cell.y < ROWS){
    int i = cell.y*COLS + cell.x;
    vec4 A = uA[i];
    vec4 B = uB[i];
    vec2 cen = (vec2(cell) - vec2(float(COLS), float(ROWS))*0.5 + 0.5)*vec2(CW, CH);
    vec2 d = p - cen;
    float dist = length(d);
    float I = A.x;
    if (dist < R*1.3){
      float rr = dist/R;
      float aa = 1.5*px/R + 0.02;
      float ang = atan(d.y, d.x);
      float rough = 0.85 + 0.3*pnoise(ang, 38.0, B.y*40.0);
      float housing = ring(rr, 0.9, 0.05, aa)*1.3*rough
                    + ring(rr, 0.62, 0.03, aa)*0.5
                    + ring(rr, 0.36, 0.04, aa)*0.8*step(0.22, fract(ang/6.2831853 + B.y))
                    + ring(rr, 0.12, 0.04, aa)*0.7
                    + (1.0 - smoothstep(0.98, 0.98 + aa, rr))*0.02;
      float grime = 0.55 + 0.7*pnoise(ang, 19.0, B.y*23.0 + floor(rr*3.0));
      x += housing*grime*B.x*0.6*(1.0 - 0.6*I);
      // Lit face: hot white disc with a slightly ragged edge.
      float edge = 0.95 + 0.04*pnoise(ang, 23.0, B.y*17.0);
      x += I*8.0*(1.0 - smoothstep(edge - 0.1 - aa, edge + aa, rr))*(1.0 - 0.22*clamp(housing, 0.0, 1.0));
    }
  }

  // Bloom and beams: only lamps that are currently lit (packed on the CPU).
  for (int k = 0; k < uLitCount; k++){
    vec4 L = uLit[k];  // centre.xy, intensity, beam angle
    vec4 M = uLit2[k]; // beam strength, beam spread, seed, -
    vec2 d = p - L.xy;
    float dist = length(d);
    if (dist > 1.3) continue; // beam and bloom have faded to nothing
    float I = L.z;
    // Bloom around the lens + wide soft halo.
    x += I*(1.2*exp(-max(dist - R*0.9, 0.0)/(R*0.45)) + 0.03*exp(-dist/(R*1.8)));
    // Light beam: soft cone with fine radial streaks.
    vec2 bd = vec2(cos(L.w), sin(L.w));
    float al = dot(d, bd);
    if (al > 0.0){
      float pe = d.x*bd.y - d.y*bd.x;
      float w = R*0.9 + al*M.y;
      float prof = exp(-pe*pe/(w*w)*2.5);
      float fall = exp(-al/0.18);
      float rays = atan(pe, al + R*1.2);
      float streak = 0.5 + 0.4*vnoise(rays*30.0 + M.z*31.0) + 0.35*vnoise(rays*8.0 - M.z*7.0 + 3.0) - 0.2;
      x += I*M.x*2.0*prof*fall*streak*smoothstep(0.0, R*0.8, al);
    }
  }
  x = max(x + uHaze - 0.04, 0.0);

  // Cool tone curve: blue-tinted midtones, highlights clip to white.
  vec3 col = 1.0 - exp(-x*vec3(0.45, 0.64, 1.05));
  col = pow(col, vec3(0.92));
  // Deep navy stage darkness instead of neutral black.
  col += vec3(0.004, 0.02, 0.07)*(1.0 - col);
  col += (hash(dot(gl_FragCoord.xy, vec2(1.0, 157.0))) - 0.5)/255.0;
  outColor = vec4(col, 1.0);
}
`;
