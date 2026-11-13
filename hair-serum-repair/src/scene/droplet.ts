import * as THREE from "three";
import { Palette } from "./palette";
import { Timeline } from "./timeline";

const DROP_RADIUS = 1.62;
const BUBBLES = 36;
const SETTLE_ANGLE = THREE.MathUtils.degToRad(42);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const qTilt = new THREE.Quaternion();
const qSettle = new THREE.Quaternion();

/** Translucent serum droplet with suspended micro-bubbles, plus its glow halo */
export const createDroplet = (palette: Palette) => {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uCore: { value: new THREE.Color(palette.dropCore) },
      uEdge: { value: new THREE.Color(palette.dropEdge) },
      uHot: { value: new THREE.Color(palette.dropHot) },
      uCameraPos: { value: new THREE.Vector3() },
      uOpacity: { value: 1 },
      uTime: { value: 0 },
      uExposure: { value: 1 },
      uEnergy: { value: 0 },
      uCrescent: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vLocal;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vLocal = position;
        vNormal = normalize(mat3(transpose(inverse(modelMatrix))) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uCore;
      uniform vec3 uEdge;
      uniform vec3 uHot;
      uniform vec3 uCameraPos;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uExposure;
      uniform float uEnergy;
      uniform float uCrescent;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vLocal;

      #define RADIUS ${DROP_RADIUS.toFixed(2)}
      #define BUBBLES ${BUBBLES}
      float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453); }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(uCameraPos - vWorld);
        float ndv = max(dot(N, V), 0.0);
        float fres = 1.0 - ndv;

        vec3 L = normalize(vec3(-0.55, 0.6, 0.58));
        vec3 H = normalize(L + V);

        // liquid body: clear amber glass, denser and deeper towards the limb
        vec3 col = mix(uCore, uEdge, smoothstep(0.1, 0.85, fres));
        float mottling = 0.5 + 0.5 * sin(vLocal.x * 5.0 + sin(vLocal.y * 4.0 + uTime * 0.02) * 1.5);
        col *= 0.66 + 0.2 * ndv + 0.08 * mottling;
        // dark refraction ring just inside the silhouette, bright meniscus on it
        col *= 1.0 - 0.42 * smoothstep(0.5, 0.8, fres) * smoothstep(0.98, 0.8, fres);
        col += uHot * 0.45 * pow(fres, 7.0);
        // light focused through the drop lands opposite the key light
        float caustic = pow(max(dot(N, normalize(vec3(0.35, -0.2, 0.9))), 0.0), 26.0);
        col += uHot * (0.4 + 0.12 * uEnergy) * caustic;
        // crescent window reflection hugging the upper-left limb
        float side = dot(N, normalize(vec3(-0.86, 0.22, 0.45)));
        float crescent = smoothstep(0.8, 0.93, side) * smoothstep(0.86, 0.7, fres) * smoothstep(0.3, 0.52, fres);
        col += vec3(1.0, 0.98, 0.9) * 0.8 * crescent * uCrescent;
        col += vec3(1.0) * 0.5 * pow(max(dot(N, H), 0.0), 220.0);

        // suspended micro-bubbles (seen through the front surface)
        vec2 q = vLocal.xy / RADIUS;
        float bubbles = 0.0;
        float sparkle = 0.0;
        for (int i = 0; i < BUBBLES; i++) {
          float fi = float(i);
          float ang = hash11(fi + 1.0) * 6.2831853;
          float rad = sqrt(hash11(fi + 21.0)) * 0.74;
          vec2 c = vec2(cos(ang), sin(ang)) * rad + vec2(0.06, -0.04);
          c.y += 0.03 * sin(uTime * 0.045 + fi * 1.7);
          c.x += 0.024 * cos(uTime * 0.035 + fi * 2.3);
          float r = 0.018 + 0.085 * pow(hash11(fi + 43.0), 2.0);
          vec2 e = (q - c) / r;
          float d = length(e);
          // bright rim, stronger on the lower-right where light exits
          float ring = smoothstep(1.0, 0.88, d) * smoothstep(0.55, 0.88, d);
          float lit = 0.45 + 0.55 * clamp(dot(normalize(e + 1e-4), vec2(0.6, -0.8)) * 0.5 + 0.5, 0.0, 1.0);
          bubbles += ring * lit;
          sparkle += smoothstep(0.32, 0.0, length(e - vec2(-0.35, 0.35)));
        }
        float front = smoothstep(0.2, 0.7, ndv);
        col += uHot * bubbles * 0.55 * front;
        col += vec3(1.0) * sparkle * 0.45 * front;

        float alpha = (0.7 + 0.3 * smoothstep(0.3, 0.9, fres)) * uOpacity;
        gl_FragColor = vec4(col * uExposure, alpha);
      }
    `,
  });

  const geometry = new THREE.SphereGeometry(DROP_RADIUS, 128, 96);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 3;

  // Soft additive glow that swells as the droplet meets the strand
  const haloMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(palette.halo) },
      uStrength: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float g = exp(-d * d * 5.5) * 0.85 + exp(-d * d * 22.0) * 0.35;
        g *= smoothstep(1.0, 0.75, d);
        gl_FragColor = vec4(uColor * g * uStrength, 1.0);
      }
    `,
  });
  const haloGeometry = new THREE.PlaneGeometry(1, 1);
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  halo.renderOrder = 2;

  return {
    mesh,
    halo,
    update: (
      frame: number,
      tl: Timeline,
      position: THREE.Vector3,
      cameraPosition: THREE.Vector3,
      hairTilt: number,
    ) => {
      // local X = hair normal (squash axis), local Y = along the strand
      qTilt.setFromAxisAngle(Z_AXIS, hairTilt - Math.PI / 2);
      qSettle.setFromAxisAngle(Y_AXIS, tl.dropSettle * SETTLE_ANGLE);
      mesh.quaternion.copy(qTilt).multiply(qSettle);
      mesh.position.copy(position);
      mesh.scale.set(
        tl.dropScaleNormal,
        tl.dropScaleTangent,
        Math.min(1, tl.dropScaleTangent),
      );
      mesh.visible = tl.dropOpacity > 0.001 && tl.dropScaleTangent > 0.001;
      material.uniforms.uOpacity.value = tl.dropOpacity;
      material.uniforms.uTime.value = frame;
      material.uniforms.uCrescent.value = 1 - 0.85 * tl.dropSettle;
      material.uniforms.uExposure.value = tl.exposure;
      material.uniforms.uEnergy.value = Math.max(0, tl.haloStrength);
      material.uniforms.uCameraPos.value.copy(cameraPosition);

      const size = DROP_RADIUS * 2 * (1.9 + 0.9 * Math.max(0, tl.haloStrength));
      halo.position.copy(position);
      halo.scale.set(size, size, 1);
      haloMaterial.uniforms.uStrength.value =
        Math.max(0, tl.haloStrength) * 0.1;
      halo.visible = tl.haloStrength > 0.001;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
    },
  };
};
