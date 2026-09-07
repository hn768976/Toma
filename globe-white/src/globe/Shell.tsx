import { useMemo } from "react";
import * as THREE from "three";
import { overWhite, type Palette } from "./palette";

/**
 * The translucent glass shell.
 *
 * Front faces only and no depth write, so everything behind it shows through at
 * whatever opacity its own shader decided. The shell is drawn between the far
 * and near passes, which is what puts the back of the network *behind* glass.
 */
export const Shell: React.FC<{ palette: Palette; opacity: number }> = ({
  palette,
  opacity,
}) => {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.NormalBlending,
      uniforms: {
        uLight: { value: new THREE.Vector3(...overWhite(palette.shellLight, opacity)) },
        uDark: { value: new THREE.Vector3(...overWhite(palette.shellDark, opacity)) },
        uEdge: { value: new THREE.Vector3(...overWhite(palette.shellEdge, opacity)) },
        uAlpha: { value: opacity },
      },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uLight;
        uniform vec3 uDark;
        uniform vec3 uEdge;
        uniform float uAlpha;
        varying vec3 vN;
        varying vec3 vW;

        void main() {
          vec3 n = normalize(vN);
          vec3 toCam = normalize(cameraPosition - vW);
          // 0 at the sub-camera point, 1 at the silhouette.
          float fres = 1.0 - clamp(dot(n, toCam), 0.0, 1.0);

          // Broad shading gradient: lighter to the upper left, darker to the
          // lower right. Not a specular model, just a lean.
          float lean = clamp(dot(n, normalize(vec3(-0.55, 0.62, 0.56))), 0.0, 1.0);
          vec3 col = mix(uDark, uLight, smoothstep(0.05, 0.95, lean));

          // The subtle darker line right at the silhouette. This is the single
          // detail that makes the sphere read as glass and not a flat disc.
          col = mix(col, uEdge, smoothstep(0.80, 0.995, fres));

          // Faint brighter rim along the upper left only.
          float ul = clamp(dot(n, normalize(vec3(-0.7, 0.66, 0.28))), 0.0, 1.0);
          col = mix(col, vec3(1.0), smoothstep(0.45, 0.92, fres) * ul * 0.5);

          gl_FragColor = vec4(col, uAlpha);
        }
      `,
    });
  }, [palette, opacity]);

  return (
    <mesh renderOrder={10} material={material}>
      {/* Dense enough that the silhouette shows no facets at 4K. */}
      <sphereGeometry args={[1, 320, 200]} />
    </mesh>
  );
};
