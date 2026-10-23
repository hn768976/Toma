import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Palette } from "./palettes";
import { bgFragment, bgVertex, blobFragment, blobVertex } from "./shaders";

type Props = { palette: Palette };

type Ctx = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pivot: THREE.Group;
  uniforms: Record<string, THREE.IUniform>;
  bgUniforms: Record<string, THREE.IUniform>;
};

const v3 = (c: [number, number, number]) => new THREE.Vector3(...c);

export const GlassBlob: React.FC<Props> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctx = useRef<Ctx | null>(null);

  // The composition is authored at 4K. The backing store follows the
  // render scale (--scale), so a 0.5 scale render draws natively at 1080p.
  const dpr = Math.min(
    typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
    1,
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    renderer.autoClear = false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(24, width / height, 0.1, 50);
    camera.position.set(0, 0, 7.0);
    camera.lookAt(0, 0, 0);

    const bgUniforms = {
      uInner: { value: v3(palette.bgInner) },
      uOuter: { value: v3(palette.bgOuter) },
      uRes: { value: new THREE.Vector2(width, height) },
    };
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: bgVertex,
        fragmentShader: bgFragment,
        uniforms: bgUniforms,
        depthTest: false,
        depthWrite: false,
      }),
    );
    bg.frustumCulled = false;
    bg.renderOrder = -1;
    scene.add(bg);

    const uniforms: Record<string, THREE.IUniform> = {
      uPhase: { value: 0 },
      uRidge: { value: 0 },
      uAxis: { value: new THREE.Vector3(0, 1, 0) },
      uSweep: { value: new THREE.Vector3(1, 0, 0) },
      uFlow: { value: new THREE.Vector3() },
      uTint: { value: v3(palette.tint) },
      uKey: { value: v3(palette.key) },
      uFilmPhase: { value: v3(palette.filmPhase) },
      uFilmBias: { value: v3(palette.filmBias) },
      uFilmGain: { value: v3(palette.filmGain) },
      uFilmSpan: { value: palette.filmSpan },
      uIrid: { value: palette.irid },
      uPass: { value: 1 },
    };
    const geo = new THREE.SphereGeometry(1, 768, 512);
    const pivot = new THREE.Group();
    // Inner wall first (seen through the glass), then the outer skin.
    const back = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: blobVertex,
        fragmentShader: blobFragment,
        uniforms: { ...uniforms, uPass: { value: 0 } },
        side: THREE.BackSide,
      }),
    );
    back.renderOrder = 0;
    const front = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: blobVertex,
        fragmentShader: blobFragment,
        uniforms,
        side: THREE.FrontSide,
        transparent: true,
        depthWrite: false,
      }),
    );
    front.renderOrder = 1;
    pivot.add(back, front);
    scene.add(pivot);

    ctx.current = { renderer, scene, camera, pivot, uniforms, bgUniforms };
    return () => {
      geo.dispose();
      renderer.dispose();
      ctx.current = null;
    };
  }, [width, height, dpr, palette]);

  useLayoutEffect(() => {
    const c = ctx.current;
    if (!c) return;
    // Normalised loop position: the clip ends where it started.
    const u = frame / durationInFrames;
    const TAU = Math.PI * 2;

    const u0 = c.uniforms;
    u0.uPhase.value = TAU * u;
    // Ridges build up, dominate mid-clip and relax back to a soft bulb.
    u0.uRidge.value = 0.3 + 0.7 * Math.pow(Math.sin(Math.PI * u), 1.4);
    u0.uAxis.value
      .set(0.25 * Math.sin(TAU * u), 1, 0.35 * Math.cos(TAU * u))
      .normalize();
    u0.uSweep.value
      .set(
        Math.cos(2 * TAU * u + 2.4),
        0.55 * Math.sin(TAU * u),
        Math.sin(2 * TAU * u + 2.4),
      )
      .normalize();
    u0.uFlow.value.set(
      0.6 * Math.cos(TAU * u),
      0.6 * Math.sin(TAU * u),
      0.4 * Math.sin(TAU * u * 2),
    );

    // Tumble: two full turns around a tilted axis + wobble (whole cycles,
    // so the last frame flows straight back into the first).
    c.pivot.rotation.set(
      0.35 + 0.3 * Math.sin(TAU * u),
      -2 * TAU * u,
      -0.28 + 0.22 * Math.cos(TAU * u),
    );

    c.renderer.clear();
    c.renderer.render(c.scene, c.camera);
  }, [frame, durationInFrames]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
