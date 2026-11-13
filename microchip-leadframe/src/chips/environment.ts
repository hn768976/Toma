import * as THREE from "three";

/**
 * Procedural studio environment, baked once into a mip-mapped HDR cube map.
 * The metal shader reads a blurry mip of it, which is a cheap and stable
 * stand-in for a roughness-prefiltered reflection.
 *
 * The dome is brightest (and bluest) around -Z and falls off to a neutral,
 * darker grey towards +X / -X. Because the stamped sheet is flat and seen
 * through a very long lens, its overall tone is simply "the part of the dome
 * the camera sees mirrored in it" - so an orbiting camera takes the sheet
 * from a bright, blue-ish look to a darker steel look on its own.
 */
export const buildEnvironment = (
  renderer: THREE.WebGLRenderer,
  look: { cool: THREE.Color; neutral: THREE.Color; ground: THREE.Color },
): { texture: THREE.CubeTexture; dispose: () => void } => {
  const scene = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(40, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uCool: { value: look.cool },
        uNeutral: { value: look.neutral },
        uGround: { value: look.ground },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vDir;
        uniform vec3 uCool;
        uniform vec3 uNeutral;
        uniform vec3 uGround;
        void main() {
          vec3 d = normalize(vDir);
          float az = atan(d.x, -d.z);            // 0 towards -Z
          float el = asin(clamp(d.y, -1.0, 1.0));
          // key side of the room
          float key = exp(-az * az / 0.62);
          vec3 sky = mix(uNeutral, uCool, key);
          // brighter band a little above the horizon, soft roll-off upward
          float band = exp(-pow((el - 0.42) / 0.5, 2.0));
          vec3 col = sky * (0.38 + 0.95 * band);
          // large overhead soft box
          float top = smoothstep(0.86, 0.985, d.y);
          col += vec3(1.9, 2.0, 2.15) * top;
          // strip lights
          float s1 = smoothstep(0.16, 0.0, abs(az + 0.25)) * smoothstep(0.2, 0.0, abs(el - 0.95));
          float s2 = smoothstep(0.1, 0.0, abs(az - 1.9)) * smoothstep(0.35, 0.0, abs(el - 0.55));
          float s3 = smoothstep(0.12, 0.0, abs(az + 2.3)) * smoothstep(0.3, 0.0, abs(el - 0.6));
          col += vec3(5.0, 5.2, 5.6) * s1 + vec3(3.4) * s2 + vec3(2.6, 2.7, 2.9) * s3;
          // below the horizon: light bounced off the metal sheet itself
          float below = smoothstep(0.06, -0.18, d.y);
          col = mix(col, uGround * (0.4 + 0.6 * key), below);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  scene.add(dome);
  const cubeRT = new THREE.WebGLCubeRenderTarget(256, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    colorSpace: THREE.LinearSRGBColorSpace,
  });
  const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);
  cubeCam.update(renderer, scene);
  renderer.setRenderTarget(null);
  dome.geometry.dispose();
  (dome.material as THREE.Material).dispose();
  return { texture: cubeRT.texture, dispose: () => cubeRT.dispose() };
};
