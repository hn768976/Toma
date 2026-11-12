import * as THREE from "three";

/**
 * Additive point-sprite material that fakes physically based depth of field.
 * Each point is a light emitter; its on-screen diameter grows with the circle
 * of confusion (thin-lens model) while its per-pixel intensity drops so the
 * total emitted energy is conserved. Heavily blurred points are stochastically
 * thinned (with energy compensation) to keep fill-rate manageable at 4K.
 */
export const createBokehMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      uProj: { value: 1000 }, // pixels per world unit at distance 1
      uFocus: { value: 10 },
      uAperture: { value: 0.1 },
      uMinSize: { value: 2 },
      uMaxSize: { value: 900 },
      uLod: { value: 4 }, // keep enough samples that kept spacing <= diameter / uLod
      uDisc: { value: 0 }, // 0 = gaussian blur, 1 = hard-ish bokeh disc
      uGain: { value: 1 },
      uStretch: { value: 1 }, // >1 squeezes sprites horizontally (vertical streaks)
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float size;
      attribute float rnd;
      attribute float energy;
      attribute float spacing; // world-space distance to neighbouring sample (0 = isolated)
      attribute float shape; // 0 = gaussian blur, 1 = lens-shaped bokeh disc (scaled by uDisc)
      uniform float uProj, uFocus, uAperture, uMinSize, uMaxSize, uLod, uGain;
      varying vec3 vColor;
      varying float vBlur;
      varying float vShape;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float z = -mv.z;
        if (z < 0.05 || energy <= 0.0) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          gl_PointSize = 0.0;
          return;
        }
        gl_Position = projectionMatrix * mv;
        float s = size * uProj / z;
        float coc = uAperture * uProj * abs(z - uFocus) / (z * uFocus);
        float d = max(sqrt(s * s + coc * coc), uMinSize);
        float s0 = max(s, uMinSize);
        float e = (s0 / d) * (s0 / d);
        d = min(d, uMaxSize);
        float sp = spacing * uProj / z;
        float p = spacing > 0.0 ? clamp(uLod * sp / d, 0.02, 1.0) : 1.0;
        // keep ~p of the samples (soft edge avoids popping); p = 1 keeps all of them
        float w = clamp((1.25 * p - rnd) / max(0.25 * p, 1e-4), 0.0, 1.0);
        if (w <= 0.0) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          gl_PointSize = 0.0;
          return;
        }
        vColor = color * energy * e * w / min(1.125 * p, 1.0) * uGain;
        vBlur = clamp(coc / d, 0.0, 1.0);
        vShape = shape;
        gl_PointSize = d;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uDisc;
      uniform float uStretch;
      varying vec3 vColor;
      varying float vBlur;
      varying float vShape;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0;
        q.x *= uStretch;
        float r2 = dot(q, q);
        if (r2 > 1.0) discard;
        float r = sqrt(r2);
        float g = exp(-r2 * 3.2) * (1.0 - smoothstep(0.8, 1.0, r2)) / 0.9;
        float disc = (1.0 - smoothstep(0.72, 1.0, r)) * (0.85 + 0.15 * r2) / 2.3;
        float k = smoothstep(0.35, 0.9, vBlur) * uDisc * vShape;
        float a = mix(g, disc, k);
        gl_FragColor = vec4(vColor * a * uStretch, 1.0);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

export type BokehGeometry = {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  energies: Float32Array;
  rnds: Float32Array;
  spacings: Float32Array;
  shapes: Float32Array;
  count: number;
};

export const createBokehGeometry = (count: number, rng: () => number): BokehGeometry => {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const energies = new Float32Array(count);
  const rnds = new Float32Array(count);
  const spacings = new Float32Array(count);
  const shapes = new Float32Array(count);
  for (let i = 0; i < count; i++) rnds[i] = rng();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("energy", new THREE.BufferAttribute(energies, 1));
  geometry.setAttribute("rnd", new THREE.BufferAttribute(rnds, 1));
  geometry.setAttribute("spacing", new THREE.BufferAttribute(spacings, 1));
  geometry.setAttribute("shape", new THREE.BufferAttribute(shapes, 1));
  return { geometry, positions, colors, sizes, energies, rnds, spacings, shapes, count };
};

export const markDirty = (g: BokehGeometry) => {
  for (const name of ["position", "color", "size", "energy", "spacing", "shape"]) {
    (g.geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
  }
  g.geometry.computeBoundingSphere();
};
