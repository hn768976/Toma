import "./three/pcss"; // must load before any material compiles
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  DepthOfField,
  EffectComposer,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import * as THREE from "three";
import { columnColors } from "./lib/colors";
import {
  bottomFor,
  CANYON,
  COLUMN_COUNT,
  columnX,
  columnZ,
  floatingCubes,
  floatingCubeState,
  GRID_OFFSET_X,
  GRID_OFFSET_Z,
  GRID_X,
  GRID_Z,
  heightsFor,
  loopPhase,
  LOOP_FRAMES,
  neighbourTops,
} from "./lib/fields";
import { PALETTES, type Palette } from "./lib/palettes";
import { GrainEffect } from "./three/GrainEffect";
import { makeVoxelMaterial } from "./three/voxelMaterial";
import { CAM, cameraFrame } from "./lib/camera";
import { inDrawArea } from "./lib/frameArea";

const TAU = Math.PI * 2;
// Profiling switches (render-time benchmarking only): REMOTION_VF_PROFILE=nodof,nomsaa,...
const PROFILE = String(process.env.REMOTION_VF_PROFILE ?? "");
const SHADOW_MAP = PROFILE.includes("shadow2k") ? 2048 : 4096;
// Verification mode: draw scene depth only (no colour, no post) so the palette
// variants of one look can be compared for identical geometry.
const DEPTH_ONLY = PROFILE.includes("depth");

const Rig: React.FC = () => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    const { position, target } = cameraFrame(frame);
    camera.filmGauge = 35;
    camera.aspect = size.width / size.height;
    camera.setFocalLength(CAM.focalLength);
    camera.near = 5;
    camera.far = 260;
    camera.position.copy(position);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, [camera, frame, size.width, size.height]);
  return null;
};

const Lights: React.FC<{ palette: Palette }> = ({ palette }) => {
  const light = useRef<THREE.DirectionalLight>(null);
  useLayoutEffect(() => {
    const l = light.current!;
    l.target.position.set(GRID_OFFSET_X, 0, GRID_OFFSET_Z);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera as THREE.OrthographicCamera;
    cam.left = -48;
    cam.right = 48;
    cam.top = 48;
    cam.bottom = -48;
    cam.near = 1;
    cam.far = 260;
    cam.updateProjectionMatrix();
  }, []);
  return (
    <>
      {/* Bright soft key from the upper left of frame. */}
      <directionalLight
        ref={light}
        position={[GRID_OFFSET_X - 55, 80, GRID_OFFSET_Z + 20]}
        intensity={2.6}
        color="#fffaf2"
        castShadow
        shadow-mapSize-width={SHADOW_MAP}
        shadow-mapSize-height={SHADOW_MAP}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {/* Cool sky fill. */}
      <hemisphereLight args={[palette.sky, "#9aa3ad", 1.15]} />
    </>
  );
};

// The columns that are drawn: those within the camera's footprint (+ margin).
const DRAWN: number[] = [];
for (let j = 0; j < GRID_Z; j++)
  for (let i = 0; i < GRID_X; i++)
    if (inDrawArea(columnX(i), columnZ(j))) DRAWN.push(j * GRID_X + i);

const Columns: React.FC<{ palette: Palette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const bottom = bottomFor(palette.look);

  const { geometry, material, info } = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0); // unit column from y = 0 to 1, stretched per instance
    const infoArr = new Float32Array(DRAWN.length * 2);
    const infoAttr = new THREE.InstancedBufferAttribute(infoArr, 2);
    infoAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aInfo", infoAttr);
    const m = makeVoxelMaterial({
      tint: palette.tint,
      deep: palette.deep,
      aoDepth: palette.look === "canyon" ? 3.2 : 2.2,
      aoFloor: palette.look === "canyon" ? 0.5 : 0.78,
      voidStart: CANYON.voidTop + 4,
      voidEnd: CANYON.voidTop - 16,
      rimStart: 3,
      rimEnd: 14,
      rimAmount: palette.look === "canyon" ? 0.9 : 0,
    });
    return { geometry: g, material: m, info: infoAttr };
  }, [palette]);

  const heights = useMemo(() => new Float32Array(COLUMN_COUNT), []);
  const rims = useMemo(() => new Float32Array(COLUMN_COUNT), []);
  const lows = useMemo(() => new Float32Array(COLUMN_COUNT), []);

  // Colours: chosen once per palette.
  useLayoutEffect(() => {
    const m = mesh.current!;
    const cols = columnColors(palette);
    const drawnCols = new Float32Array(DRAWN.length * 3);
    DRAWN.forEach((k, n) => drawnCols.set(cols.subarray(k * 3, k * 3 + 3), n * 3));
    m.instanceColor = new THREE.InstancedBufferAttribute(drawnCols, 3);
    m.instanceColor.needsUpdate = true;
  }, [palette]);

  // Heights: recomputed from the frame number alone, every frame.
  useLayoutEffect(() => {
    const m = mesh.current!;
    heightsFor(palette.look, frame, heights);
    neighbourTops(heights, rims, lows);
    const mat = new THREE.Matrix4();
    const arr = info.array as Float32Array;
    for (let n = 0; n < DRAWN.length; n++) {
      {
        const k = DRAWN[n];
        const i = k % GRID_X;
        const j = (k - i) / GRID_X;
        const top = Math.max(heights[k], bottom + 0.5);
        // Only the part above the lowest neighbour can be seen or cast shadow.
        const base = Math.max(bottom, Math.min(lows[k], top) - 1);
        mat.makeScale(1, top - base, 1);
        mat.setPosition(columnX(i), base, columnZ(j));
        m.setMatrixAt(n, mat);
        arr[n * 2] = top;
        arr[n * 2 + 1] = rims[k];
      }
    }
    m.instanceMatrix.needsUpdate = true;
    info.needsUpdate = true;
  }, [frame, palette.look, bottom, heights, rims, lows, info]);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, DRAWN.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  );
};

const FloatingCubes: React.FC<{ palette: Palette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { geometry, material } = useMemo(
    () => ({
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material: makeVoxelMaterial({
        tint: palette.tint,
        deep: palette.deep,
        localGrid: true,
        aoDepth: 3.2,
        aoFloor: 0.5,
        voidStart: CANYON.voidTop + 4,
        voidEnd: CANYON.voidTop - 16,
        rimStart: 3,
        rimEnd: 14,
        rimAmount: 0.9,
      }),
    }),
    [palette],
  );
  useLayoutEffect(() => {
    const m = mesh.current!;
    const cols = columnColors(palette);
    const col = new THREE.Color();
    const q = new THREE.Quaternion();
    const mat = new THREE.Matrix4();
    floatingCubes.forEach((cube, n) => {
      const s = floatingCubeState(cube, frame);
      const wx = columnX(0) + s.x;
      const wz = columnZ(0) + s.z;
      q.setFromAxisAngle(new THREE.Vector3(...cube.axis), s.angle);
      mat.compose(
        new THREE.Vector3(wx, s.y, wz),
        q,
        new THREE.Vector3(1, 1, 1).multiplyScalar(Math.max(s.scale, 1e-4)),
      );
      m.setMatrixAt(n, mat);
      const k = cube.az * GRID_X + cube.ax;
      col.setRGB(cols[k * 3], cols[k * 3 + 1], cols[k * 3 + 2]);
      m.setColorAt(n, col);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [frame, palette]);
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, floatingCubes.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  );
};

const Post: React.FC = () => {
  const frame = useCurrentFrame();
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const grain = useMemo(() => new GrainEffect(), []);
  // Grain pattern repeats with the loop: frame 600 == frame 0.
  grain.setFrame(frame % LOOP_FRAMES);
  // Keep the blur the same fraction of the frame at any output size.
  const pxScale = (size.height * dpr) / 1080;
  return (
    <EffectComposer
      multisampling={PROFILE.includes("nomsaa") ? 0 : 4}
      frameBufferType={THREE.HalfFloatType}
    >
      {PROFILE.includes("nodof") ? <></> : <DepthOfField
        worldFocusDistance={CAM.distance}
        worldFocusRange={20}
        bokehScale={2.2 * pxScale}
        resolutionScale={0.5}
      />}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <primitive object={grain} />
    </EffectComposer>
  );
};

const DepthOnly: React.FC = () => {
  const scene = useThree((s) => s.scene);
  const material = useMemo(() => {
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    // 24-bit depth in RGB, opaque (alpha would mix with the page background).
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        "gl_FragColor = packDepthToRGBA( fragCoordZ );",
        "gl_FragColor = vec4( packDepthToRGBA( fragCoordZ ).rgb, 1.0 );",
      );
    };
    return m;
  }, []);
  useLayoutEffect(() => {
    scene.overrideMaterial = material;
    return () => {
      scene.overrideMaterial = null;
    };
  }, [scene, material]);
  useFrame(({ gl, camera }) => {
    gl.toneMapping = THREE.NoToneMapping;
    gl.render(scene, camera);
  }, 1);
  return null;
};

/**
 * Holds the frame until R3F has drawn it with this frame's data. Runs after the
 * EffectComposer (priority 1), so the screenshot always has the finished image.
 */
const RenderGate: React.FC = () => {
  const frame = useCurrentFrame();
  const { delayRender, continueRender } = useDelayRender();
  const pending = useRef<{ handle: number; frame: number } | null>(null);
  useLayoutEffect(() => {
    const handle = delayRender(`voxel-fields: draw frame ${frame}`);
    pending.current = { handle, frame };
    return () => {
      if (pending.current?.handle === handle) {
        continueRender(handle);
        pending.current = null;
      }
    };
  }, [frame, delayRender, continueRender]);
  useFrame(() => {
    const p = pending.current;
    if (p && p.frame === frame) {
      pending.current = null;
      continueRender(p.handle);
    }
  }, 2);
  return null;
};

export type VoxelFieldProps = { paletteId: string };

export const VoxelField: React.FC<VoxelFieldProps> = ({ paletteId }) => {
  const { width, height } = useVideoConfig();
  const palette = PALETTES.find((p) => p.id === paletteId);
  if (!palette) throw new Error(`Unknown palette ${paletteId}`);
  // Draw at the real output resolution (Remotion's --scale sets devicePixelRatio).
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      shadows={{ type: THREE.PCFShadowMap }}
      gl={{
        antialias: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      }}
      style={{ backgroundColor: palette.deep }}
    >
      <color attach="background" args={[palette.deep]} />
      <Rig />
      <Lights palette={palette} />
      <Columns palette={palette} />
      {palette.look === "canyon" && <FloatingCubes palette={palette} />}
      {DEPTH_ONLY ? <DepthOnly /> : <Post />}
      <RenderGate />
    </ThreeCanvas>
  );
};
