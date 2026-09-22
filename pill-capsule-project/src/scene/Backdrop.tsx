import { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { preToneMap } from "../lib/tonemap";
import { replaceOnce } from "../lib/shader-patch";

/**
 * Look 1's seamless cyclorama: a floor that curves up into a back wall, as a
 * real product-photography sweep does. It is lit geometry rather than a
 * painted gradient, so the floor-to-wall falloff and the contact shadow come
 * out of the same light rig as the pill.
 */
export type CycOptions = {
  /** Albedo at the floor and at the top of the wall; the sweep lerps between
   *  them by world height. Two colours rather than one plus a brightness
   *  ramp, because a real sweep's floor is both brighter AND less saturated
   *  than its wall — bounce light does that, and a scalar cannot. */
  floorColor: THREE.ColorRepresentation;
  wallColor: THREE.ColorRepresentation;
  /** World Y of the floor. */
  floorY: number;
  /** World Z where the floor starts curving up. */
  curveZ: number;
  /** Radius of the floor-to-wall curve. */
  curveRadius: number;
  width: number;
  /** How far the floor extends toward the camera from `curveZ`. */
  floorDepth: number;
  /** How far the wall extends above the top of the curve. */
  wallHeight: number;
  /** How much of the studio environment the sweep picks up. Dropping it below
   *  1 is how a saturated backdrop stays saturated: a rough surface under
   *  bright white cards gathers a lot of broad white specular, and that washes
   *  a strong colour out toward grey. */
  envMapIntensity?: number;
  /** Brightness multiplier at the left and right edges of the sweep. A real
   *  seamless has a hot side where the key lands and falls away across the
   *  frame; a perfectly even backdrop reads as a flat gradient, not a set. */
  sideFalloff?: [number, number];
};

const buildCyc = (o: CycOptions): THREE.BufferGeometry => {
  // Path through (z, y), from the front of the floor, back, and up the wall.
  const path: { z: number; y: number; ny: number; nz: number }[] = [];
  const steps = 64;

  path.push({ z: o.curveZ + o.floorDepth, y: o.floorY, ny: 1, nz: 0 });
  path.push({ z: o.curveZ, y: o.floorY, ny: 1, nz: 0 });
  for (let i = 1; i <= steps; i++) {
    const a = (Math.PI / 2) * (i / steps);
    path.push({
      z: o.curveZ - Math.sin(a) * o.curveRadius,
      y: o.floorY + (1 - Math.cos(a)) * o.curveRadius,
      ny: Math.cos(a),
      nz: Math.sin(a),
    });
  }
  const last = path[path.length - 1];
  path.push({ z: last.z, y: last.y + o.wallHeight, ny: 0, nz: 1 });

  const cols = 2;
  const rows = path.length;
  const position = new Float32Array(rows * cols * 3);
  const normal = new Float32Array(rows * cols * 3);
  const uv = new Float32Array(rows * cols * 2);
  const yMin = o.floorY;
  const yMax = last.y + o.wallHeight;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * 3;
      position[i] = (c - 0.5) * o.width;
      position[i + 1] = path[r].y;
      position[i + 2] = path[r].z;
      normal[i] = 0;
      normal[i + 1] = path[r].ny;
      normal[i + 2] = path[r].nz;
      const j = (r * cols + c) * 2;
      uv[j] = c;
      uv[j + 1] = (path[r].y - yMin) / (yMax - yMin);
    }
  }

  // Wind counter-clockwise seen from above/in front, so the floor faces up
  // and the wall faces the camera. Reversed, the sweep is backface-culled and
  // the whole frame goes black.
  const index: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    const a = r * cols;
    index.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geom.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geom.setIndex(index);
  geom.computeBoundingSphere();
  return geom;
};

/**
 * Standard material with a subtle vertical tint ramp and 1-LSB dither mixed
 * into the shading. A 4K sweep is almost entirely gradient, which is exactly
 * what bands in 8-bit H.264.
 */
class CycMaterial extends THREE.MeshStandardMaterial {
  private readonly floor: THREE.Color;
  private readonly wall: THREE.Color;
  private readonly span: [number, number];
  private readonly sides: [number, number];
  private readonly halfWidth: number;

  constructor(
    floorColor: THREE.ColorRepresentation,
    wallColor: THREE.ColorRepresentation,
    span: [number, number],
    envMapIntensity: number,
    sides: [number, number],
    halfWidth: number,
  ) {
    super({
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0,
      dithering: true,
      envMapIntensity,
    });
    this.floor = new THREE.Color(floorColor);
    this.wall = new THREE.Color(wallColor);
    this.span = span;
    this.sides = sides;
    this.halfWidth = halfWidth;
  }

  override onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    // Drive the ramp off world height through our own varying. `vUv` is only
    // declared when the material carries a texture, and this one does not.
    shader.vertexShader = replaceOnce(
      replaceOnce(
        shader.vertexShader,
        "#include <common>",
        "#include <common>\nvarying float vCycY;\nvarying float vCycX;",
        "cyc varying declaration (vertex)",
      ),
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvCycY = ( modelMatrix * vec4( position, 1.0 ) ).y;",
      "cyc world height",
    );

    const lo = this.span[0].toFixed(4);
    const hi = this.span[1].toFixed(4);
    const v = (c: THREE.Color) => `vec3(${c.r.toFixed(5)}, ${c.g.toFixed(5)}, ${c.b.toFixed(5)})`;
    shader.fragmentShader = replaceOnce(
      replaceOnce(
        shader.fragmentShader,
        "#include <common>",
        "#include <common>\nvarying float vCycY;\nvarying float vCycX;",
        "cyc varying declaration (fragment)",
      ),
      "#include <color_fragment>",
      `#include <color_fragment>
      {
        float cycT = clamp( ( vCycY - ${lo} ) / ( ${hi} - ${lo} ), 0.0, 1.0 );
        diffuseColor.rgb *= mix( ${v(this.floor)}, ${v(this.wall)}, sqrt( cycT ) );
        float cycS = clamp( vCycX / ${(this.halfWidth * 0.9).toFixed(4)} + 0.5, 0.0, 1.0 );
        diffuseColor.rgb *= mix( ${this.sides[0].toFixed(4)}, ${this.sides[1].toFixed(4)}, cycS );
      }`,
      "cyc vertical ramp",
    );
  };

  override customProgramCacheKey = () =>
    `cyc-${this.floor.getHexString()}-${this.wall.getHexString()}-${this.span[0]}-${this.span[1]}` +
    `-${this.sides[0]}-${this.sides[1]}-${this.halfWidth}`;
}

export const Cyclorama: React.FC<CycOptions> = (props) => {
  const scene = useThree((s) => s.scene);
  const geom = useMemo(() => buildCyc(props), [props]);
  const mat = useMemo(
    () =>
      new CycMaterial(
        props.floorColor,
        props.wallColor,
        // Ramp over the floor-to-wall curve, not the whole sweep: on a real
        // cyclorama the falloff lives in the curve and the wall above it is
        // flat.
        [props.floorY, props.floorY + props.curveRadius * 0.8],
        props.envMapIntensity ?? 1,
        props.sideFalloff ?? [1, 1],
        props.width * 0.5,
      ),
    [
      props.floorColor,
      props.wallColor,
      props.floorY,
      props.curveRadius,
      props.wallHeight,
      props.envMapIntensity,
      props.sideFalloff,
      props.width,
    ],
  );
  // three ignores a material's own envMapIntensity whenever the material has
  // no envMap and the scene does (WebGLRenderer overwrites the uniform with
  // scene.environmentIntensity). Pointing the material at the scene's own
  // environment is what makes the per-sweep value take effect. <LightRig />
  // is mounted before this, so its environment is in place by the time this
  // effect runs.
  useLayoutEffect(() => {
    mat.envMap = scene.environment;
    mat.needsUpdate = true;
  }, [mat, scene]);

  return <mesh geometry={geom} material={mat} receiveShadow />;
};

/**
 * Look 3's backdrop: a flat unlit gradient plane far behind the field. Shader
 * generated, dithered, with a soft radial lift so the frame has a centre.
 */
export type GradientBackdropProps = {
  /** sRGB hex of the colour the FINISHED FILE should show at the darkest part
   *  of the field; solved back through AgX before it reaches the shader. */
  colorA: string;
  /** Likewise, at the bright centre. */
  colorB: string;
  /** Where the bright centre sits, in UV. */
  center: [number, number];
  /** Radius of the bright centre, in UV. */
  spread: number;
  /** Extra darkening toward the frame edges. */
  vignette: number;
  z: number;
  width: number;
  height: number;
};

export const GradientBackdrop: React.FC<GradientBackdropProps> = (p) => {
  const mat = useMemo(() => {
    // Authored as the colour the finished file should show; solved back
    // through AgX so the tone-mapping pass lands on it.
    const a = preToneMap(p.colorA);
    const b = preToneMap(p.colorB);
    return new THREE.ShaderMaterial({
      uniforms: {
        colorA: { value: a },
        colorB: { value: b },
        center: { value: new THREE.Vector2(...p.center) },
        spread: { value: p.spread },
        vignette: { value: p.vignette },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUvB;
        void main() {
          vUvB = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 colorA;
        uniform vec3 colorB;
        uniform vec2 center;
        uniform float spread;
        uniform float vignette;
        varying vec2 vUvB;

        void main() {
          vec2 d = (vUvB - center);
          d.x *= 1.35;
          float t = 1.0 - smoothstep(0.0, spread, length(d));

          // Geometric, not linear, blend. These two colours are pre-solved
          // through the inverse of AgX, which is logarithmic; a linear mix of
          // them lands well off the straight line between the two colours you
          // asked for. Blending in log space tracks it closely.
          vec3 c = exp(mix(log(colorA), log(colorB), t));

          vec2 e = abs(vUvB - 0.5) * 2.0;
          float edge = max(e.x, e.y);
          c *= 1.0 - vignette * smoothstep(0.35, 1.05, edge);

          // Dither before the output transform. Multiplicative, because this
          // value is pre-tone-map: an absolute +-1/255 here is a fifth of the
          // red channel after the log encode, which is noise, not dither.
          float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          c *= 1.0 + (n - 0.5) * 0.004;

          gl_FragColor = vec4(c, 1.0);
        }
      `,
      toneMapped: true,
      depthWrite: true,
    });
  }, [p.colorA, p.colorB, p.center, p.spread, p.vignette]);

  return (
    <mesh position={[0, 0, p.z]} material={mat}>
      <planeGeometry args={[p.width, p.height]} />
    </mesh>
  );
};
