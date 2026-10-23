import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { NIGHT, Palette, PINK } from "./palettes";
import {
  batteryLevel,
  bulbFlashMix,
  bulbPhase,
  floorLit,
  FLOORS,
  glowAmount,
  ledState,
  turbineAngle,
} from "./timeline";

export type DioramaVariant = "match" | "night";

const CAMERA = {
  azimuth: 44.4,
  elevation: 18.1,
  distance: 30,
  fov: 22,
  target: new THREE.Vector3(-0.52, 1.7, -0.81),
};

const CameraRig: React.FC = () => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    const az = THREE.MathUtils.degToRad(CAMERA.azimuth);
    const el = THREE.MathUtils.degToRad(CAMERA.elevation);
    const t = CAMERA.target;
    camera.position.set(
      t.x + CAMERA.distance * Math.cos(el) * Math.sin(az),
      t.y + CAMERA.distance * Math.sin(el),
      t.z + CAMERA.distance * Math.cos(el) * Math.cos(az),
    );
    camera.fov = CAMERA.fov;
    camera.near = 0.5;
    camera.far = 200;
    camera.lookAt(t);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
};

const Mat: React.FC<{
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  roughness?: number;
}> = ({ color, emissive = "#000000", emissiveIntensity = 1, roughness = 0.85 }) => (
  <meshStandardMaterial
    color={color}
    emissive={emissive}
    emissiveIntensity={emissiveIntensity}
    roughness={roughness}
    metalness={0}
  />
);

const Box: React.FC<{
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  rotation?: [number, number, number];
  emissive?: string;
  emissiveIntensity?: number;
  castShadow?: boolean;
}> = ({ size, position, color, rotation, emissive, emissiveIntensity, castShadow = true }) => (
  <mesh position={position} rotation={rotation} castShadow={castShadow} receiveShadow>
    <boxGeometry args={size} />
    <Mat color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} />
  </mesh>
);

// Rounded slab used for the platform, battery tile and controller.
const RoundedSlab: React.FC<{
  size: [number, number, number];
  position: [number, number, number];
  radius: number;
  color: string;
}> = ({ size, position, radius, color }) => {
  const geometry = useMemo(() => {
    const [w, h, d] = size;
    const shape = new THREE.Shape();
    const x = -w / 2;
    const y = -d / 2;
    shape.moveTo(x + radius, y);
    shape.lineTo(x + w - radius, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + radius);
    shape.lineTo(x + w, y + d - radius);
    shape.quadraticCurveTo(x + w, y + d, x + w - radius, y + d);
    shape.lineTo(x + radius, y + d);
    shape.quadraticCurveTo(x, y + d, x, y + d - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);
    const bevel = Math.min(0.06, h / 3);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: h - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 8,
    });
    geo.translate(0, 0, bevel);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [size, radius]);
  return (
    <mesh geometry={geometry} position={position} castShadow receiveShadow>
      <Mat color={color} emissive={color} emissiveIntensity={0.12} />
    </mesh>
  );
};

const useGridTexture = (cell: string, line: string) =>
  useMemo(() => {
    const cols = 8;
    const rows = 6;
    const W = 1024;
    const H = 768;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = cell;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = line;
    ctx.lineWidth = 14;
    for (let i = 0; i <= cols; i++) {
      const x = (i / cols) * W;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let j = 0; j <= rows; j++) {
      const y = (j / rows) * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [cell, line]);

const SolarPanel: React.FC<{ p: Palette }> = ({ p }) => {
  const tex = useGridTexture(p.panelCell, p.panelLine);
  const moduleW = 2.3; // along z
  const moduleH = 1.75; // along tilt
  const gap = 0.12;
  return (
    <group position={[-3.52, 0, 2.45]}>
      {/* support legs */}
      <Box size={[0.14, 2.1, 0.14]} position={[-0.75, 1.05, 1.8]} color={p.panelFrame} />
      <Box size={[0.14, 2.1, 0.14]} position={[-0.75, 1.05, -1.8]} color={p.panelFrame} />
      <group position={[-0.1, 1.45, 0]} rotation={[0, 0, -0.98]}>
        {[0, 1].map((r) =>
          [0, 1].map((c) => (
            <mesh
              key={`${r}${c}`}
              position={[
                (r - 0.5) * (moduleH + gap),
                0,
                (c - 0.5) * (moduleW + gap),
              ]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[moduleH, 0.08, moduleW]} />
              <meshStandardMaterial
                attach="material-0"
                color={p.panelFrame}
                roughness={0.8}
              />
              <meshStandardMaterial
                attach="material-1"
                color={p.panelFrame}
                roughness={0.8}
              />
              <meshStandardMaterial
                attach="material-2"
                map={tex}
                roughness={0.5}
                emissive={p.panelCell}
                emissiveIntensity={0.12}
              />
              <meshStandardMaterial
                attach="material-3"
                color={p.panelFrame}
                roughness={0.8}
              />
              <meshStandardMaterial
                attach="material-4"
                color={p.panelFrame}
                roughness={0.8}
              />
              <meshStandardMaterial
                attach="material-5"
                color={p.panelFrame}
                roughness={0.8}
              />
            </mesh>
          )),
        )}
      </group>
    </group>
  );
};

const bladeGeometry = (() => {
  // Tapered aerofoil-like blade lying along +y.
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.34, 0.3, 0.26, 1.0, 0.04, 1.75);
  shape.lineTo(-0.03, 1.75);
  shape.bezierCurveTo(-0.14, 1.0, -0.2, 0.3, 0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.translate(0, 0.12, -0.02);
  return geo;
})();

const Turbine: React.FC<{ p: Palette; angle: number }> = ({ p, angle }) => {
  const height = 5.0;
  return (
    <group position={[-2.43, 0, -1.49]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.07, 0.1, height, 16]} />
        <Mat color={p.turbine} emissive={p.turbine} emissiveIntensity={0.35} roughness={0.6} />
      </mesh>
      {/* nacelle + rotor face the camera (diagonal view direction) */}
      <group position={[0, height, 0]} rotation={[0, Math.PI / 4, 0]}>
        <mesh position={[0, 0, -0.05]} castShadow>
          <capsuleGeometry args={[0.11, 0.3, 6, 16]} />
          <Mat color={p.turbine} emissive={p.turbine} emissiveIntensity={0.35} roughness={0.6} />
        </mesh>
        <group position={[0, 0, 0.2]} rotation={[0, 0, angle]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <sphereGeometry args={[0.12, 16, 16]} />
            <Mat color={p.turbine} emissive={p.turbine} emissiveIntensity={0.35} roughness={0.6} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              geometry={bladeGeometry}
              rotation={[0, 0, (i * Math.PI * 2) / 3]}
              castShadow
            >
              <Mat color={p.turbine} emissive={p.turbine} emissiveIntensity={0.35} roughness={0.6} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
};

const Controller: React.FC<{ p: Palette; frame: number }> = ({ p, frame }) => (
  <group position={[-0.5, 0, 1.54]}>
    <RoundedSlab size={[2.0, 0.7, 3.1]} position={[0, 0, 0]} radius={0.12} color={p.controller} />
    {[0, 1, 2, 3].map((i) => {
      const on = ledState(frame, i);
      return (
        <mesh key={i} position={[-0.42, 0.7, 0.9 - i * 0.6]} castShadow>
          <sphereGeometry args={[0.13, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Mat
            color={on ? p.ledOn : p.ledOff}
            emissive={on ? p.ledOn : "#000000"}
            emissiveIntensity={on ? 0.55 : 0}
            roughness={0.35}
          />
        </mesh>
      );
    })}
    {[0, 1, 2, 3, 4].map((i) => (
      <Box
        key={i}
        size={[0.3, 0.1, 0.24]}
        position={[0.48, 0.75, 1.16 - i * 0.58]}
        color={p.controller}
      />
    ))}
  </group>
);

const Battery: React.FC<{ p: Palette; level: number }> = ({ p, level }) => {
  const bodyLen = 2.0; // along z
  const bodyH = 0.8; // along x
  const t = 0.09; // outline thickness
  const y = 0.42;
  const fillLen = Math.max(0.0001, (bodyLen - 0.32) * level);
  return (
    <group position={[3.17, 0, 2.63]} scale={[1.25, 1, 1.25]}>
      <RoundedSlab size={[2.8, 0.3, 3.8]} position={[0, 0, 0]} radius={0.12} color={p.batterySlab} />
      <mesh position={[-0.05, 0.31, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.25, 3.25]} />
        <Mat color={p.screen} roughness={0.6} />
      </mesh>
      <group position={[-0.05, y - 0.1, 0.1]}>
        {/* outline: two long sides, two short sides, terminal */}
        <Box size={[t, 0.02, bodyLen]} position={[-bodyH / 2, 0, 0]} color={p.icon} emissive={p.icon} emissiveIntensity={0.25} castShadow={false} />
        <Box size={[t, 0.02, bodyLen]} position={[bodyH / 2, 0, 0]} color={p.icon} emissive={p.icon} emissiveIntensity={0.25} castShadow={false} />
        <Box size={[bodyH + t, 0.02, t]} position={[0, 0, bodyLen / 2]} color={p.icon} emissive={p.icon} emissiveIntensity={0.25} castShadow={false} />
        <Box size={[bodyH + t, 0.02, t]} position={[0, 0, -bodyLen / 2]} color={p.icon} emissive={p.icon} emissiveIntensity={0.25} castShadow={false} />
        <Box size={[t, 0.02, 0.22]} position={[-0.17, 0, -bodyLen / 2 - 0.11]} color={p.icon} emissive={p.icon} emissiveIntensity={0.25} castShadow={false} />
        <Box size={[t, 0.02, 0.22]} position={[0.17, 0, -bodyLen / 2 - 0.11]} color={p.icon} emissive={p.icon} emissiveIntensity={0.25} castShadow={false} />
        <Box size={[0.34 + t, 0.02, t]} position={[0, 0, -bodyLen / 2 - 0.22]} color={p.icon} emissive={p.icon} emissiveIntensity={0.25} castShadow={false} />
        {/* inner baseline bar that is always visible, then the charge fill */}
        <Box size={[0.07, 0.02, bodyLen - 0.32]} position={[0.22, 0, 0]} color={p.icon} emissive={p.icon} emissiveIntensity={0.25} castShadow={false} />
        <Box
          size={[0.5, 0.021, fillLen]}
          position={[0, 0, (bodyLen - 0.32) / 2 - fillLen / 2]}
          color={p.icon}
          emissive={p.icon}
          emissiveIntensity={0.25}
          castShadow={false}
        />
      </group>
    </group>
  );
};

// Box whose +x face (the side facing the bulb) blends towards the lit colour.
const LitBox: React.FC<{
  size: [number, number, number];
  position: [number, number, number];
  base: string;
  lit: string;
  amount: number;
  glow: string;
  glowIntensity: number;
}> = ({ size, position, base, lit, amount, glow, glowIntensity }) => {
  const litColor = new THREE.Color(base).lerp(new THREE.Color(lit), amount).getStyle();
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <meshStandardMaterial
          key={i}
          attach={`material-${i}`}
          color={i === 0 ? litColor : base}
          emissive={glow}
          emissiveIntensity={i === 0 ? glowIntensity * 1.5 : glowIntensity * 0.4}
          roughness={0.85}
        />
      ))}
    </mesh>
  );
};

// Soft pool of bulb light painted onto the board.
const LightPool: React.FC<{ color: string; opacity: number }> = ({ color, opacity }) => {
  const texture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    // alphaMap reads the green channel, so paint an opaque grey ramp.
    g.addColorStop(0, "rgb(255,255,255)");
    g.addColorStop(0.45, "rgb(190,190,190)");
    g.addColorStop(1, "rgb(0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);
  return (
    <mesh position={[2.4, 0.03, -1.9]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[5.2, 6.2]} />
      <meshStandardMaterial
        color={color}
        alphaMap={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        roughness={0.9}
        emissive={color}
        emissiveIntensity={0.25}
      />
    </mesh>
  );
};

const Building: React.FC<{ p: Palette; glow: number; frame: number }> = ({
  p,
  glow,
  frame,
}) => {
  const floorH = 0.9;
  const core = 2.0;
  const windows = useMemo(() => {
    const out: { pos: [number, number, number]; rotY: number; floor: number }[] = [];
    for (let f = 0; f < FLOORS; f++) {
      const y = f * floorH + 0.42;
      // Only the two camera-facing sides (+x, +z) are ever visible.
      for (let side = 0; side < 4; side++) {
        const rotY = (side * Math.PI) / 2;
        for (let k = 0; k < 6; k++) {
          const u = -0.72 + k * 0.288;
          const n = core / 2 + 0.02;
          const x = Math.sin(rotY) * n + Math.cos(rotY) * u;
          const z = Math.cos(rotY) * n - Math.sin(rotY) * u;
          out.push({ pos: [x, y, z], rotY, floor: f });
        }
      }
    }
    return out;
  }, []);
  return (
    <group position={[0.15, 0, -3.7]}>
      {Array.from({ length: FLOORS }).map((_, f) => {
        const floorGlow = glow * THREE.MathUtils.lerp(1, 0.55, f / (FLOORS - 1));
        return (
          <group key={f} position={[0, f * floorH, 0]}>
            <LitBox
              size={[core, floorH - 0.12, core]}
              position={[0, (floorH - 0.12) / 2, 0]}
              base={p.building}
              lit={p.litSurface}
              amount={floorGlow}
              glow={p.buildingGlow}
              glowIntensity={floorGlow * 0.12 * p.glowStrength}
            />
            <LitBox
              size={[core + 0.3, 0.12, core + 0.3]}
              position={[0, floorH - 0.06, 0]}
              base={p.building}
              lit={p.litSurface}
              amount={floorGlow}
              glow={p.buildingGlow}
              glowIntensity={floorGlow * 0.1 * p.glowStrength}
            />
          </group>
        );
      })}
      <Box
        size={[core + 0.05, 0.22, core + 0.05]}
        position={[0, FLOORS * floorH + 0.11, 0]}
        color={p.building}
      />
      {windows.map((w, i) => {
        const on = floorLit(frame, w.floor);
        // Lit windows are pure white; the bulb's warm light tints them while on.
        const base = new THREE.Color(on ? p.windowOn : p.window).lerp(
          new THREE.Color(p.windowLit),
          glow * 0.7,
        );
        return (
          <mesh key={i} position={w.pos} rotation={[0, w.rotY, 0]} castShadow>
            <boxGeometry args={[0.17, 0.4, 0.09]} />
            <Mat
              color={base.getStyle()}
              emissive={base.getStyle()}
              emissiveIntensity={on ? 0.9 : 0.12}
              roughness={0.5}
            />
          </mesh>
        );
      })}
    </group>
  );
};

const bulbProfile = (() => {
  const pts: THREE.Vector2[] = [];
  // Neck from the screw base up into the sphere.
  pts.push(new THREE.Vector2(0.001, 0.95));
  pts.push(new THREE.Vector2(0.36, 0.95));
  pts.push(new THREE.Vector2(0.4, 1.15));
  pts.push(new THREE.Vector2(0.5, 1.4));
  const r = 0.78;
  const cy = 2.0;
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 + 0.55 + (i / 24) * (Math.PI - 0.55);
    pts.push(new THREE.Vector2(Math.max(0.001, Math.cos(a) * r), cy + Math.sin(a) * r));
  }
  return pts;
})();

const Bulb: React.FC<{ p: Palette; frame: number }> = ({ p, frame }) => {
  const phase = bulbPhase(frame);
  const mix = bulbFlashMix(frame);
  let color = new THREE.Color(p.bulbGlass);
  let emissive = new THREE.Color(p.bulbGlass);
  let emissiveIntensity = p.bulbGlassGlow;
  if (phase === "flash") {
    color = new THREE.Color(p.bulbGlass).lerp(new THREE.Color(p.bulbFlash), mix);
    emissive = new THREE.Color(p.bulbFlash);
    emissiveIntensity = mix;
  } else if (phase === "on") {
    const c = new THREE.Color(p.bulbFlash).lerp(new THREE.Color(p.bulbOn), mix);
    color = c;
    emissive = c;
    emissiveIntensity = 0.95;
  } else if (frame === 241 || frame === 329) {
    color = new THREE.Color(p.bulbGlass).lerp(new THREE.Color(p.bulbFlash), 0.25);
  }
  return (
    <group position={[3.88, 0, -3.55]} scale={1.15}>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[bulbProfile, 48]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.36, 0.3, 0.7, 32]} />
        <Mat color={p.bulbBase} roughness={0.45} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.36 + i * 0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.35, 0.045, 10, 40]} />
          <Mat color={p.bulbBase} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.2, 0.26, 0.3, 24]} />
        <Mat color={p.bulbBase} roughness={0.45} />
      </mesh>
    </group>
  );
};

// Shallow raised "wires" connecting the components, as on the reference board.
const CABLES: [number, number][][] = [
  [[-2.2, 2.6], [-1.2, 2.6], [-1.2, 1.6], [-0.5, 1.6]],
  [[-1.35, -1.55], [-0.3, -1.55], [-0.3, 0.0]],
  [[0.35, 2.6], [0.35, 3.6], [1.55, 3.6]],
  [[1.2, 1.25], [1.6, 1.25]],
  [[1.25, -1.2], [1.25, -0.4], [2.6, -0.4], [2.6, -0.15]],
  [[2.3, -2.45], [3.75, -2.45], [3.75, -2.7]],
  [[-4.4, 4.2], [-4.4, 3.2], [-3.2, 3.2]],
];

const Cables: React.FC<{ p: Palette }> = ({ p }) => {
  const segments = useMemo(() => {
    const out: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    for (const path of CABLES) {
      for (let i = 0; i < path.length - 1; i++) {
        const [x1, z1] = path[i];
        const [x2, z2] = path[i + 1];
        const w = 0.05;
        out.push({
          pos: [(x1 + x2) / 2, 0.012, (z1 + z2) / 2],
          size: [Math.abs(x2 - x1) + w, 0.024, Math.abs(z2 - z1) + w],
        });
      }
    }
    return out;
  }, []);
  return (
    <>
      {segments.map((s, i) => (
        <Box key={i} size={s.size} position={s.pos} color={p.cable} castShadow={false} />
      ))}
    </>
  );
};

export const Diorama: React.FC<{ variant: DioramaVariant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = variant === "night" ? NIGHT : PINK;
  const glow = glowAmount(frame);
  const level = batteryLevel(frame);
  const angle = turbineAngle(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: p.background }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows="soft"
        flat
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ fov: CAMERA.fov, position: [20, 20, 20] }}
      >
        <CameraRig />
        <color attach="background" args={[p.background]} />
        {/* infinite backdrop matching the background colour */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.21, 0]} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <meshBasicMaterial color={p.background} />
        </mesh>
        <hemisphereLight args={[p.sky, p.ground, p.ambient]} />
        <directionalLight
          position={[-7, 14, 9]}
          intensity={p.keyLight}
          castShadow
          shadow-mapSize-width={4096}
          shadow-mapSize-height={4096}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={9}
          shadow-camera-bottom={-9}
          shadow-radius={6}
          shadow-bias={-0.0005}
          shadow-normalBias={0.02}
        />
        {/* warm light thrown by the bulb onto the board and the building */}
        <pointLight
          position={[3.88, 2.3, -3.55]}
          color={p.glowLight}
          intensity={glow * 16 * p.glowStrength}
          distance={8}
          decay={1.5}
        />
        <pointLight
          position={[2.4, 0.8, -2.2]}
          color={p.glowLight}
          intensity={glow * 5 * p.glowStrength}
          distance={4.5}
          decay={1.5}
        />
        <RoundedSlab size={[10, 0.2, 10]} position={[0, -0.2, 0]} radius={0.15} color={p.platform} />
        <Cables p={p} />
        <LightPool color={p.litSurface} opacity={glow * p.litDecalOpacity} />
        <SolarPanel p={p} />
        <Turbine p={p} angle={angle} />
        <Controller p={p} frame={frame} />
        <Battery p={p} level={level} />
        <Building p={p} glow={glow} frame={frame} />
        <Bulb p={p} frame={frame} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
