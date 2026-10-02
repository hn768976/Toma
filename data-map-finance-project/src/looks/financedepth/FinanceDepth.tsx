import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useThree } from "@react-three/fiber";
import { ThreeStage } from "../../lib/ThreeStage";
import { THREE } from "../../lib/three-setup";
import { useFonts } from "../../lib/fonts";
import { TAU, mod, smoothstep } from "../../lib/loop";
import type { FinanceDepthPalette } from "../../versions";
import { BLOCK_L, LOOP, PLANES, TRAVEL_BLOCKS } from "./planes";
import { drawPlaneContent } from "./draw";

const FOV = 50;
const FOCUS = 15; // focus distance (world units)
const COC_K = 20; // circle of confusion scale, CSS px at 3840 wide
const NEAR_FADE: [number, number] = [1.2, 5];
const FAR_FADE: [number, number] = [74, 112];

const VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D map;
uniform float uFade;
in vec2 vUv;
out vec4 outColor;
void main() { outColor = vec4(texture(map, vUv).rgb * uFade, 1.0); }
`;

type Level = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; pad: number; scale: number };

const Scene: React.FC<{ palette: FinanceDepthPalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { camera, gl } = useThree();
  const cam = camera as THREE.PerspectiveCamera;

  const objs = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const meshes = PLANES.map((p) => {
      const mat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { map: { value: null }, uFade: { value: 0 } },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
      });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.set(p.rx, p.ry, 0);
      m.frustumCulled = false;
      return m;
    });
    const scratch = document.createElement("canvas");
    const levels = new Map<string, Level>();
    return { meshes, scratch, levels };
  }, []);

  // --- per-frame: everything from `frame` ---
  const t = frame / LOOP;
  cam.fov = FOV;
  cam.near = 0.1;
  cam.far = 300;
  cam.position.set(0.7 * Math.sin(TAU * t), 0.4 * Math.sin(TAU * 2 * t + 0.5), 0);
  cam.lookAt(0.9 * Math.sin(TAU * t + 1.0), 0.3 * Math.sin(TAU * t), -30);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();

  const dpr = gl.getPixelRatio();
  const buf = gl.getDrawingBufferSize(new THREE.Vector2());
  const fpx = buf.y / 2 / Math.tan((FOV * Math.PI) / 360);
  const travel = (frame * TRAVEL_BLOCKS * BLOCK_L) / LOOP;
  const maxScale = Math.max(1, dpr);

  PLANES.forEach((p, i) => {
    const mesh = objs.meshes[i];
    const mat = mesh.material as THREE.ShaderMaterial;
    const rel = mod(p.depth - travel, BLOCK_L);
    const fade = smoothstep(NEAR_FADE[0], NEAR_FADE[1], rel) * (1 - smoothstep(FAR_FADE[0], FAR_FADE[1], rel));
    if (fade < 0.002) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    const screenW = (p.w * fpx) / rel; // buffer px
    const ideal = screenW / p.designW;
    const scale = Math.min(maxScale, Math.max(1 / 32, Math.pow(2, Math.ceil(Math.log2(ideal)))));
    const key = `${i}:${scale}`;
    let lv = objs.levels.get(key);
    const texW = Math.round(p.designW * scale);
    const texH = Math.round(p.designH * scale);
    if (!lv) {
      const pad = Math.ceil(0.1 * texW) + 6;
      const canvas = document.createElement("canvas");
      canvas.width = texW + 2 * pad;
      canvas.height = texH + 2 * pad;
      const ctx = canvas.getContext("2d")!;
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      lv = { canvas, ctx, tex, pad, scale };
      objs.levels.set(key, lv);
    }
    // depth of field: blur radius in texture pixels
    const cocBuf = (COC_K * (buf.x / 3840) * Math.abs(rel - FOCUS)) / rel;
    const blurTex = Math.min(lv.pad / 2.6, (cocBuf * texW) / screenW);

    const sc = objs.scratch;
    if (sc.width !== lv.canvas.width || sc.height !== lv.canvas.height) {
      sc.width = lv.canvas.width;
      sc.height = lv.canvas.height;
    }
    const sctx = sc.getContext("2d")!;
    drawPlaneContent(sctx, p, frame, palette, scale, lv.pad);
    const ctx = lv.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, lv.canvas.width, lv.canvas.height);
    ctx.filter = blurTex > 0.35 ? `blur(${blurTex.toFixed(2)}px)` : "none";
    ctx.drawImage(sc, 0, 0);
    ctx.filter = "none";
    lv.tex.needsUpdate = true;

    mat.uniforms.map.value = lv.tex;
    mat.uniforms.uFade.value = fade;
    const sx = (p.w * lv.canvas.width) / texW;
    const sy = (p.w * lv.canvas.height) / texW;
    mesh.scale.set(sx, sy, 1);
    mesh.position.set(p.x, p.y, -rel);
  });

  return (
    <>
      {objs.meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
};

export const FinanceDepth: React.FC<{ palette: FinanceDepthPalette }> = ({ palette }) => {
  const fonts = useFonts();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {fonts ? (
        <ThreeStage post={{ grain: 0, blackSafe: true, loop: LOOP }}>
          <Scene palette={palette} />
        </ThreeStage>
      ) : null}
    </AbsoluteFill>
  );
};
