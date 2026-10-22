import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  InstancedMesh,
  Matrix4,
  PerspectiveCamera,
  Shape as ThreeShape,
  TubeGeometry,
  Vector3,
} from "three";
import {
  ARROW_LEN,
  EDGES,
  EdgeDef,
  edgePath,
  layoutTiming,
  NodeDef,
  NODES,
  PERIOD,
  Shape,
  SIZE,
  T,
  WIRE_Y,
} from "./graph";
import {
  FONT,
  makeFaceTexture,
  makeGridTexture,
  makeLabelTexture,
  makeShadowTexture,
} from "./textures";
import { Theme } from "./theme";

export type CameraRig = {
  azimuth: number; // degrees, rotation around the vertical axis
  elevation: number; // degrees above the ground plane
  distance: number;
  fov: number;
  lead: number; // how far (u) the look-at point trails the build front
  lateral: number; // v of the look-at point
  sway: number; // gentle looping sway amplitude (degrees)
};

export type WorkflowGraphProps = {
  theme: Theme;
  rig: CameraRig;
};

const DEPTH = 0.15;
const BEVEL = 0.03;
const TOP_Y = DEPTH + BEVEL;
const HOVER = 1.7;
const COPIES = [-1, 0, 1];

const ease = Easing.bezier(0.45, 0, 0.2, 1);
const easeOut = Easing.bezier(0.2, 0.7, 0.3, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ---------- shared geometry ----------

const bodyGeometry = (shape: Shape) => {
  const { w, h } = SIZE[shape];
  if (shape === "circle") {
    const g = new CylinderGeometry(w / 2, w / 2, DEPTH + BEVEL * 2, 72);
    g.translate(0, (DEPTH + BEVEL * 2) / 2 - BEVEL, 0);
    return g;
  }
  const r = shape === "small" ? 0.1 : 0.2;
  const iw = w - BEVEL * 2;
  const ih = h - BEVEL * 2;
  const s = new ThreeShape();
  const x = -iw / 2;
  const y = -ih / 2;
  const rr = r - BEVEL;
  s.moveTo(x + rr, y);
  s.lineTo(x + iw - rr, y);
  s.quadraticCurveTo(x + iw, y, x + iw, y + rr);
  s.lineTo(x + iw, y + ih - rr);
  s.quadraticCurveTo(x + iw, y + ih, x + iw - rr, y + ih);
  s.lineTo(x + rr, y + ih);
  s.quadraticCurveTo(x, y + ih, x, y + ih - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  const g = new ExtrudeGeometry(s, {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 3,
    curveSegments: 10,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, 0);
  return g;
};

// ---------- camera ----------

const CameraRigController: React.FC<{ rig: CameraRig; front: number }> = ({
  rig,
  front,
}) => {
  const { camera, size } = useThree();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera;
    const phase = (frame / durationInFrames) * Math.PI * 2;
    const az = ((rig.azimuth + Math.sin(phase) * rig.sway) * Math.PI) / 180;
    const el = ((rig.elevation + Math.cos(phase) * rig.sway * 0.4) * Math.PI) / 180;
    const target = new Vector3(front - rig.lead, 0, -rig.lateral);
    const offset = new Vector3(
      -Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az),
    ).multiplyScalar(rig.distance);
    cam.fov = rig.fov;
    cam.aspect = size.width / size.height;
    cam.near = 0.1;
    cam.far = 400;
    cam.position.copy(target.clone().add(offset));
    cam.lookAt(target);
    cam.updateProjectionMatrix();
  }, [camera, frame, durationInFrames, front, rig, size]);
  return null;
};

// ---------- pieces ----------

type Assets = ReturnType<typeof useAssets>;

const useAssets = (theme: Theme, ready: boolean) =>
  useMemo(() => {
    if (!ready) return null;
    const shapes: Shape[] = ["tile", "small", "wide", "circle"];
    return {
      bodies: Object.fromEntries(shapes.map((s) => [s, bodyGeometry(s)])) as Record<
        Shape,
        ReturnType<typeof bodyGeometry>
      >,
      ghostFaces: Object.fromEntries(
        shapes.map((s) => [s, makeFaceTexture(s, theme, null)]),
      ) as Record<Shape, ReturnType<typeof makeFaceTexture>>,
      faces: Object.fromEntries(
        NODES.map((n) => [n.id, makeFaceTexture(n.shape, theme, n.icon)]),
      ) as Record<string, ReturnType<typeof makeFaceTexture>>,
      shadow: makeShadowTexture(theme),
      grid: makeGridTexture(theme),
      labels: [0, 1, 2, 3, 4, 5].map((i) => makeLabelTexture(theme, i + 3)),
      paths: Object.fromEntries(
        EDGES.map((e, i) => [String(i), edgePath(e)]),
      ) as Record<string, ReturnType<typeof edgePath>>,
      dot: new CircleGeometry(0.035, 12).rotateX(-Math.PI / 2),
      arrow: new ConeGeometry(0.1, ARROW_LEN, 3)
        .rotateZ(-Math.PI / 2)
        .scale(1, 0.25, 1)
        .translate(-ARROW_LEN / 2, 0, 0),
    };
  }, [theme, ready]);

const NodeMesh: React.FC<{
  node: NodeDef;
  tau: number;
  wireDur: number;
  offsetU: number;
  assets: NonNullable<Assets>;
  theme: Theme;
}> = ({ node, tau, wireDur, offsetU, assets, theme }) => {
  const ghostOpacity = interpolate(tau, [0, T.ghostIn], [0, 1], clamp);
  const drop = interpolate(tau, [T.ghostIn * 0.4, T.descendEnd], [HOVER, 0], {
    ...clamp,
    easing: ease,
  });
  const actStart = T.wireStart + wireDur - 0.06;
  const a = interpolate(tau, [actStart, actStart + T.activate], [0, 1], clamp);
  const pop = 1 + 0.07 * Math.sin(Math.PI * a);
  const sideColor = useMemo(
    () => new Color(theme.ghostSide).lerp(new Color(theme.side), a),
    [theme, a],
  );
  const { w, h } = SIZE[node.shape];
  const spread = 0.9 + drop * 0.25;
  const shadowOpacity = ghostOpacity * interpolate(drop, [0, HOVER], [0.75, 0.25]);
  if (tau < 0) return null;
  const x = node.u + offsetU;
  const z = -node.v;
  return (
    <group>
      <mesh
        position={[x + 0.12, 0.002, z + 0.18]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1}
      >
        <planeGeometry args={[w * 1.25 + spread, h * 1.25 + spread]} />
        <meshBasicMaterial
          map={assets.shadow}
          transparent
          opacity={shadowOpacity}
          depthWrite={false}
        />
      </mesh>
      <group position={[x, drop, z]} scale={[pop, pop, pop]}>
        <mesh geometry={assets.bodies[node.shape]} renderOrder={3}>
          <meshLambertMaterial
            color={sideColor}
            transparent
            opacity={ghostOpacity * (0.7 + 0.3 * a)}
            emissive={sideColor}
            emissiveIntensity={0.35}
          />
        </mesh>
        <mesh position={[0, TOP_Y + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial
            map={assets.ghostFaces[node.shape]}
            transparent
            opacity={ghostOpacity}
            depthWrite={false}
          />
        </mesh>
        {a > 0 ? (
          <mesh position={[0, TOP_Y + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial
              map={assets.faces[node.id]}
              transparent
              opacity={a}
              depthWrite={false}
            />
          </mesh>
        ) : null}
      </group>
    </group>
  );
};

const tmpM = new Matrix4();

const EdgeMesh: React.FC<{
  edge: EdgeDef;
  index: number;
  progress: number;
  offsetU: number;
  assets: NonNullable<Assets>;
  theme: Theme;
}> = ({ edge, index, progress, offsetU, assets, theme }) => {
  const path = assets.paths[String(index)];
  const length = useMemo(() => path.getLength(), [path]);
  const tubular = Math.max(24, Math.round(length * 40));
  const radial = 6;
  const tube = useMemo(
    () => (edge.dotted ? null : new TubeGeometry(path, tubular, 0.026, radial, false)),
    [edge.dotted, path, tubular],
  );
  const halo = useMemo(
    () => (edge.dotted ? null : new TubeGeometry(path, tubular, 0.07, radial, false)),
    [edge.dotted, path, tubular],
  );
  const dots = useMemo(() => {
    if (!edge.dotted) return [];
    const n = Math.floor(length / 0.13);
    return new Array(n).fill(0).map((_, i) => path.getPointAt(i / n));
  }, [edge.dotted, length, path]);
  const inst = useRef<InstancedMesh>(null);

  const visibleSegs = Math.floor(progress * tubular);
  if (tube && halo) {
    tube.setDrawRange(0, visibleSegs * radial * 6);
    halo.setDrawRange(0, visibleSegs * radial * 6);
  }
  const visibleDots = Math.floor(progress * dots.length);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    dots.forEach((p, i) => {
      tmpM.makeTranslation(p.x, p.y + 0.004, p.z);
      m.setMatrixAt(i, tmpM);
    });
    m.count = visibleDots;
    m.instanceMatrix.needsUpdate = true;
  }, [dots, visibleDots]);

  if (progress <= 0) return null;
  const tip = path.getPointAt(Math.min(1, progress));
  const tangent = path.getTangentAt(Math.min(1, Math.max(0.001, progress)));
  const angle = Math.atan2(-tangent.z, tangent.x);
  const arrowTipOffset = ARROW_LEN;
  return (
    <group position={[offsetU, 0, 0]}>
      {tube && halo ? (
        <>
          <mesh geometry={halo} renderOrder={2}>
            <meshBasicMaterial color={theme.wire} transparent opacity={0.12} depthWrite={false} />
          </mesh>
          <mesh geometry={tube} renderOrder={2}>
            <meshBasicMaterial color={theme.wire} />
          </mesh>
        </>
      ) : (
        <instancedMesh
          ref={inst}
          args={[assets.dot, undefined, Math.max(1, dots.length)]}
          renderOrder={2}
        >
          <meshBasicMaterial color={theme.dotted} side={DoubleSide} />
        </instancedMesh>
      )}
      <mesh
        geometry={assets.arrow}
        position={[
          tip.x + tangent.x * arrowTipOffset,
          WIRE_Y,
          tip.z + tangent.z * arrowTipOffset,
        ]}
        rotation={[0, angle, 0]}
        renderOrder={2}
      >
        <meshBasicMaterial color={theme.wire} />
      </mesh>
    </group>
  );
};

const LABELS = [
  { u: 2.6, v: 2.2, w: 2.4, tex: 0 },
  { u: 6.8, v: 2.6, w: 2.2, tex: 1 },
  { u: 8.6, v: -1.2, w: 2.8, tex: 2 },
  { u: 14.5, v: 3.2, w: 2.4, tex: 3 },
  { u: 22.0, v: 4.2, w: 2.2, tex: 4 },
  { u: 10.0, v: -0.3, w: 1.6, tex: 5 },
];

// ---------- main scene ----------

const Scene: React.FC<{ theme: Theme; rig: CameraRig; assets: NonNullable<Assets> }> = ({
  theme,
  rig,
  assets,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const duration = durationInFrames / fps;
  const speed = PERIOD / duration;
  const timing = useMemo(() => layoutTiming(speed), [speed]);
  const t = frame / fps;
  const front = timing.get("sign")!.key + 1.2 + speed * t;

  return (
    <>
      <CameraRigController rig={rig} front={front} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[-3, 6, 4]} intensity={1.6} />
      <mesh position={[12, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
        <planeGeometry args={[240, 240]} />
        <meshBasicMaterial
          map={assets.grid}
          map-repeat={[120, 120]}
          transparent
          depthWrite={false}
        />
      </mesh>
      {COPIES.map((k) =>
        LABELS.map((l, i) => {
          const tau = (front - (l.u + k * PERIOD - l.w / 2)) / speed;
          const o = interpolate(tau, [0.3, 1.2], [0, 0.32], clamp);
          if (o <= 0) return null;
          return (
            <mesh
              key={`l${k}-${i}`}
              position={[l.u + k * PERIOD, 0.01, -l.v]}
              rotation={[-Math.PI / 2, 0, 0]}
              renderOrder={1}
            >
              <planeGeometry args={[l.w, l.w / 4]} />
              <meshBasicMaterial
                map={assets.labels[l.tex]}
                transparent
                opacity={o}
                depthWrite={false}
              />
            </mesh>
          );
        }),
      )}
      {COPIES.map((k) =>
        EDGES.map((e, i) => {
          const child = timing.get(e.to)!;
          const tau = (front - (child.key + k * PERIOD)) / speed;
          const progress = interpolate(
            tau,
            [T.wireStart, T.wireStart + child.wireDur],
            [0, 1],
            { ...clamp, easing: easeOut },
          );
          return (
            <EdgeMesh
              key={`e${k}-${i}`}
              edge={e}
              index={i}
              progress={progress}
              offsetU={k * PERIOD}
              assets={assets}
              theme={theme}
            />
          );
        }),
      )}
      {COPIES.map((k) =>
        NODES.map((n) => {
          const lt = timing.get(n.id)!;
          const tau = (front - (lt.key + k * PERIOD)) / speed;
          return (
            <NodeMesh
              key={`n${k}-${n.id}`}
              node={n}
              tau={tau}
              wireDur={lt.wireDur}
              offsetU={k * PERIOD}
              assets={assets}
              theme={theme}
            />
          );
        }),
      )}
    </>
  );
};

const useFont = () => {
  const [handle] = useState(() => delayRender("Loading font"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const face = new FontFace(FONT, `url(${staticFile("fonts/JetBrainsMono-Bold.ttf")})`, {
      weight: "700",
    });
    face
      .load()
      .then((f) => {
        document.fonts.add(f);
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [handle]);
  return ready;
};

export const WorkflowGraph: React.FC<WorkflowGraphProps> = ({ theme, rig }) => {
  const { width, height } = useVideoConfig();
  const ready = useFont();
  const assets = useAssets(theme, ready);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 75% 85% at 62% 78%, ${theme.bgInner} 0%, ${theme.bgMid} 55%, ${theme.bgOuter} 100%)`,
      }}
    >
      {assets ? (
        <ThreeCanvas width={width} height={height} flat gl={{ antialias: true }}>
          <Scene theme={theme} rig={rig} assets={assets} />
        </ThreeCanvas>
      ) : null}
      {/* atmospheric falloff toward the horizon and the corners */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(172deg, ${theme.fog} 0%, rgba(0,0,0,0) 42%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 95% 95% at 55% 60%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
