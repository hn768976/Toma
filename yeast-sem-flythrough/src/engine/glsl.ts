// Shared GLSL building blocks (hash-based noise; fully deterministic).

export const NOISE = /* glsl */ `
float hash13(vec3 p){
  p = fract(p * .1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
vec3 hash33(vec3 p){
  p = fract(p * vec3(.1031, .1030, .0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x),
        mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
        mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}
float fbm3(vec3 p){
  float a = .5, s = 0.;
  for (int i = 0; i < 3; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; }
  return s / .875;
}
// Worley / cellular noise: x = F1, y = F2
vec2 worley(vec3 p){
  vec3 i = floor(p), f = fract(p);
  float f1 = 9., f2 = 9.;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++){
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = g + hash33(i + g) - f;
    float d = dot(o, o);
    if (d < f1){ f2 = f1; f1 = d; } else if (d < f2){ f2 = d; }
  }
  return sqrt(vec2(f1, f2));
}
`;

export const BUMP = /* glsl */ `
// Bump mapping from screen-space derivatives of a height value.
vec3 bumpNormal(vec3 pos, vec3 nrm, float h, float scale){
  vec3 sx = dFdx(pos), sy = dFdy(pos);
  vec2 dh = vec2(dFdx(h), dFdy(h)) * scale;
  vec3 r1 = cross(sy, nrm), r2 = cross(nrm, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * nrm - grad);
}
`;
