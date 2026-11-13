import * as THREE from "three";

/**
 * The whole floor is one analytic fragment shader: scrolling grid with
 * glowing intersections, lane markings, expanding sensor rings and the
 * rotating radar sweep. Analytic anti-aliasing keeps it clean at 4K.
 */
export const makeGround = (palette: {
  grid: THREE.Color;
  lane: THREE.Color;
  ring: THREE.Color;
  sweep: THREE.Color;
}) => {
  const material = new THREE.ShaderMaterial({
    transparent: false,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uGrid: { value: palette.grid },
      uLane: { value: palette.lane },
      uRing: { value: palette.ring },
      uSweep: { value: palette.sweep },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vWorld;
      uniform float uTime;
      uniform float uScroll;
      uniform vec3 uGrid;
      uniform vec3 uLane;
      uniform vec3 uRing;
      uniform vec3 uSweep;

      const float PI = 3.14159265359;

      // anti-aliased line: d = distance to the line centre, w = half width
      float aaLine(float d, float w, float fw) {
        return 1.0 - smoothstep(w - fw * 0.5, w + fw, d);
      }

      void main() {
        vec2 q = vWorld.xz;                    // ego-centred
        vec2 p = vec2(q.x, q.y - uScroll);     // road-fixed (scrolls)
        float dist = length(q - cameraPosition.xz);
        float fwx = fwidth(p.x);
        float fwz = fwidth(p.y);
        float fw = max(fwx, fwz);

        // distance fog for everything on the floor
        float fog = exp(-dist * 0.085);
        float dotFog = exp(-dist * 0.042);

        vec3 col = vec3(0.0);

        // ---- grid --------------------------------------------------------
        vec2 g = abs(fract(p - 0.5) - 0.5);
        float lx = aaLine(g.x, 0.008, fwx) * clamp(0.22 / fwx, 0.0, 1.0);
        float lz = aaLine(g.y, 0.008, fwz) * clamp(0.22 / fwz, 0.0, 1.0);
        float gridLine = max(lx, lz);
        float dotR = length(g);
        float dots = (1.0 - smoothstep(0.027, 0.027 + fw * 1.2, dotR))
                   * clamp(0.5 / fw, 0.0, 1.0);
        float halo = exp(-dotR * dotR * 160.0) * 0.5;
        col += uGrid * (gridLine * 0.36 + halo * 0.22) * fog;
        col += vec3(0.8, 0.92, 1.0) * dots * 0.85 * dotFog;

        // ---- lane markings ----------------------------------------------
        float laneFade = exp(-dist * 0.012);
        // dashed lane boundaries
        float bx = abs(abs(abs(p.x) - 3.5) - 1.75);       // x = +-1.75, +-5.25
        float dz = fract(p.y / 6.0) * 6.0;
        float dashMask = smoothstep(0.0, fwz, dz) * (1.0 - smoothstep(1.5, 1.5 + fwz, dz));
        float dash = aaLine(bx, 0.07, fwx) * dashMask;
        col += vec3(0.82, 0.92, 1.0) * dash * 1.0 * laneFade;
        // long solid guide lines
        float e1 = aaLine(abs(abs(p.x) - 8.75), 0.03, fwx);
        float e2 = aaLine(abs(abs(p.x) - 12.25), 0.022, fwx);
        float c1 = aaLine(abs(abs(abs(p.x) - 3.5) - 3.5), 0.014, fwx);  // 0, +-7
        float c2 = aaLine(abs(abs(p.x) - 3.5), 0.014, fwx);
        col += uLane * (e1 * 1.1 + e2 * 0.7 + (c1 + c2) * 0.4) * laneFade;

        // ---- planned path in front of the ego car ------------------------
        float path = (1.0 - smoothstep(0.85, 0.95, abs(q.x)))
                   * smoothstep(-2.0, -3.5, q.y) * smoothstep(-26.0, -8.0, q.y);
        col += uSweep * path * 0.13;

        // ---- expanding sensor rings --------------------------------------
        float r = length(q);
        float fr = fwidth(r);
        for (int i = 0; i < 3; i++) {
          float ph = fract(uTime / 3.0 + float(i) * 0.3333 + (i == 1 ? 0.06 : 0.0));
          float R = mix(1.4, 15.5, ph);
          float a = smoothstep(0.0, 0.08, ph) * (1.0 - smoothstep(0.75, 1.0, ph));
          float d = abs(r - R);
          float core = aaLine(d, 0.024, fr);
          float glow = exp(-d * d * 45.0) * 0.22;
          col += uRing * (core * 0.95 + glow) * a;
        }
        // static range ring close to the car
        {
          float d = abs(length(q - vec2(0.0, 1.1)) - 2.25);
          col += uRing * (aaLine(d, 0.022, fr) * 0.9 + exp(-d * d * 60.0) * 0.25);
        }

        // ---- rotating radar sweep ----------------------------------------
        float ang = atan(q.y, q.x);
        float lead = -uTime * 2.0 * PI - 0.25;             // 1 turn / second
        float da = mod(ang - lead + PI, 2.0 * PI) - PI;      // 0 at leading edge
        float aaA = fr / max(r, 0.001) * 1.5;
        float beam = smoothstep(0.0, aaA, da) * (1.0 - smoothstep(0.44, 0.44 + aaA, da));
        float trail = smoothstep(0.6, 0.6 + aaA, da) * (1.0 - smoothstep(0.8, 1.25, da));
        float radial = smoothstep(1.2, 2.2, r) * (1.0 - smoothstep(30.0, 60.0, r));
        col += uSweep * beam * radial * 0.8;
        col += uSweep * trail * radial * 0.2;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, material };
};
