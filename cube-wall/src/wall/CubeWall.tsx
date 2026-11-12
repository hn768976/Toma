import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { COLS, Palette, ROWS, TILE_GAP } from "./constants";
import { makeTileParams, tileDepth } from "./depth";

export type CubeWallProps = {
  palette: Palette;
  seed: number;
};

// Straight-on camera at the centre of the wall, like the reference.
const CAMERA_DISTANCE = 22;
const VISIBLE_ROWS = 10.05; // ~10 rows tall, ~18 columns wide at 16:9

const Camera: React.FC = () => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(0, 0, CAMERA_DISTANCE);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.fov =
      2 * Math.atan(VISIBLE_ROWS / 2 / CAMERA_DISTANCE) * (180 / Math.PI);
    camera.near = 1;
    camera.far = 100;
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
};

const Lights: React.FC<{ palette: Palette }> = ({ palette }) => {
  const key = useMemo(() => {
    const l = new THREE.DirectionalLight(
      palette.keyLight,
      palette.keyIntensity,
    );
    // Raking key from the upper left: lit tops/left walls, shaded
    // right/bottom walls and soft shadows down-right of raised tiles.
    l.position.set(-10, 9, 16);
    l.target.position.set(0, 0, 0);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    const cam = l.shadow.camera;
    cam.left = -COLS / 2 - 1;
    cam.right = COLS / 2 + 1;
    cam.top = ROWS / 2 + 1;
    cam.bottom = -ROWS / 2 - 1;
    cam.near = 1;
    cam.far = 60;
    l.shadow.bias = -0.0005;
    l.shadow.radius = 7;
    l.shadow.blurSamples = 16;
    l.shadow.intensity = palette.shadowIntensity;
    return l;
  }, [palette.keyLight, palette.keyIntensity, palette.shadowIntensity]);

  return (
    <>
      <primitive object={key} />
      <primitive object={key.target} />
      {/* Broad light near the camera: bright centre, natural fall-off. */}
      <pointLight
        position={[-1.6, -1.8, 9]}
        color={palette.fillLight}
        intensity={palette.fillIntensity}
        decay={2}
        distance={0}
      />
      <hemisphereLight
        args={[palette.hemiSky, palette.hemiGround, palette.hemiIntensity]}
      />
      <ambientLight
        color={palette.ambient}
        intensity={palette.ambientIntensity}
      />
    </>
  );
};

// Screen-space-free ambient occlusion for a height-field of tiles. Every
// frame each tile receives how far its 4 edge neighbours and 4 diagonal
// neighbours stand proud of it; the fragment shader turns that into a soft,
// tinted occlusion gradient along the occluded edges/corners of the front
// face, and darkens side walls the deeper they go into the wall. This is
// what gives the recesses their soft blue depth, as in the reference.
const AO_VERTEX_HEAD = /* glsl */ `
attribute vec4 aNb;
attribute vec4 aNd;
varying vec4 vNb;
varying vec4 vNd;
varying vec3 vLocal;
`;

const AO_FRAGMENT_HEAD = /* glsl */ `
uniform vec3 uAoColor;
uniform float uAoStrength;
uniform float uSideDepthShade;
varying vec4 vNb;
varying vec4 vNd;
varying vec3 vLocal;
float occ(float h, float d) {
  float w = 0.09 + 0.45 * h;
  float s = smoothstep(0.0, 0.45, h);
  float f = 1.0 - smoothstep(0.0, w, d);
  return s * f * f;
}
`;

const FRONT_AO = /* glsl */ `
  float ao = 1.0;
  ao *= 1.0 - uAoStrength * occ(vNb.x, vLocal.x + 0.5);
  ao *= 1.0 - uAoStrength * occ(vNb.y, 0.5 - vLocal.x);
  ao *= 1.0 - uAoStrength * occ(vNb.z, vLocal.y + 0.5);
  ao *= 1.0 - uAoStrength * occ(vNb.w, 0.5 - vLocal.y);
  ao *= 1.0 - 0.7 * uAoStrength * occ(vNd.x, length(vLocal.xy - vec2(-0.5, -0.5)));
  ao *= 1.0 - 0.7 * uAoStrength * occ(vNd.y, length(vLocal.xy - vec2(0.5, -0.5)));
  ao *= 1.0 - 0.7 * uAoStrength * occ(vNd.z, length(vLocal.xy - vec2(-0.5, 0.5)));
  ao *= 1.0 - 0.7 * uAoStrength * occ(vNd.w, length(vLocal.xy - vec2(0.5, 0.5)));
  gl_FragColor.rgb *= mix(uAoColor, vec3(1.0), ao);
`;

const SIDE_AO = /* glsl */ `
  // Side walls: bright at the lip, sinking into soft shade deeper in.
  float sd = smoothstep(-0.85, 0.0, vLocal.z);
  gl_FragColor.rgb *= mix(uAoColor, vec3(1.0), mix(uSideDepthShade, 1.0, sd));
`;

const makeTileMaterial = (face: number, palette: Palette) => {
  const front = face === 4;
  const m = new THREE.MeshStandardMaterial({
    color: front ? palette.tile : palette.side,
    emissive: front ? "#000000" : palette.sideEmissive,
    emissiveIntensity: front ? 0 : palette.sideEmissiveIntensity,
    roughness: palette.roughness,
    metalness: palette.metalness,
    dithering: true,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uAoColor = { value: new THREE.Color(palette.aoColor) };
    shader.uniforms.uAoStrength = { value: palette.aoStrength };
    shader.uniforms.uSideDepthShade = { value: palette.sideDepthShade };
    shader.vertexShader =
      AO_VERTEX_HEAD +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n  vNb = aNb;\n  vNd = aNd;\n  vLocal = position;",
      );
    shader.fragmentShader =
      AO_FRAGMENT_HEAD +
      shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "#include <opaque_fragment>\n" + (front ? FRONT_AO : SIDE_AO),
      );
  };
  m.customProgramCacheKey = () => (front ? "tile-front-ao" : "tile-side-ao");
  return m;
};

const Tiles: React.FC<{ palette: Palette; seed: number; time: number }> = ({
  palette,
  seed,
  time,
}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const params = useMemo(() => makeTileParams(seed), [seed]);
  const count = COLS * ROWS;
  const geometry = useMemo(() => {
    // Deep boxes: their back half always stays buried inside the wall.
    const g = new THREE.BoxGeometry(1 - TILE_GAP, 1 - TILE_GAP, 2);
    g.translate(0, 0, -1);
    g.setAttribute(
      "aNb",
      new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4),
    );
    g.setAttribute(
      "aNd",
      new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4),
    );
    return g;
  }, [count]);
  const materials = useMemo(
    () => [0, 1, 2, 3, 4, 5].map((face) => makeTileMaterial(face, palette)),
    [palette],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const depth = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      depth[i] = tileDepth(i % COLS, Math.floor(i / COLS), time, params[i]);
    }
    const at = (c: number, r: number, own: number) =>
      c < 0 || r < 0 || c >= COLS || r >= ROWS
        ? 0
        : Math.max(0, depth[r * COLS + c] - own);
    const nb = geometry.getAttribute("aNb") as THREE.InstancedBufferAttribute;
    const nd = geometry.getAttribute("aNd") as THREE.InstancedBufferAttribute;
    const m = new THREE.Matrix4();
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const i = row * COLS + col;
        const d = depth[i];
        m.makeTranslation(col - COLS / 2 + 0.5, row - ROWS / 2 + 0.5, d);
        mesh.setMatrixAt(i, m);
        nb.setXYZW(
          i,
          at(col - 1, row, d),
          at(col + 1, row, d),
          at(col, row - 1, d),
          at(col, row + 1, d),
        );
        nd.setXYZW(
          i,
          at(col - 1, row - 1, d),
          at(col + 1, row - 1, d),
          at(col - 1, row + 1, d),
          at(col + 1, row + 1, d),
        );
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    nb.needsUpdate = true;
    nd.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [params, time, geometry, count]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, materials, count]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  );
};

export const CubeWall: React.FC<CubeWallProps> = ({ palette, seed }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const time = frame / fps;

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows="variance"
        flat
        dpr={1}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <color attach="background" args={[palette.background]} />
        <Camera />
        <Lights palette={palette} />
        {/* Back plate so the hairline seams read as shadowed cracks. */}
        <mesh position={[0, 0, -1.2]} receiveShadow>
          <planeGeometry args={[COLS + 4, ROWS + 4]} />
          <meshStandardMaterial color={palette.tile} roughness={1} dithering />
        </mesh>
        <Tiles palette={palette} seed={seed} time={time} />
      </ThreeCanvas>
      {/* Lens-style vignette, as in the reference's darker corners. */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: `radial-gradient(ellipse 75% 75% at 44% 58%, transparent 45%, ${palette.vignetteColor} 140%)`,
          opacity: palette.vignette,
        }}
      />
    </AbsoluteFill>
  );
};
