import { useCallback } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { interpolate, Easing } from "remotion";
import { ThreeStage, StageInfo } from "../lib/ThreeStage";
import { buildBrain } from "./geometry";
import {
  linesFragment,
  linesVertex,
  occluderFragment,
  occluderVertex,
  pointsFragment,
  pointsVertex,
} from "./shaders";
import { BrainPalette } from "./palettes";

export type BrainSceneProps = {
  palette: BrainPalette;
};

const FPS = 30;

// Timeline (frames @30fps, 300 total) — measured from the reference clip.
const CHAOS_HOLD_END = 84; // 0–2.8s: writhing crumpled particle sheets
const CHAOS_SETTLE_END = 188; // 2.8–6.27s: sheets contract and fold into the brain
const WAVE_START = 118; // ~3.9s: colour wave (red → green) sweeps back-to-front
const WAVE_END = 182;

const vignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uStrength: { value: 0.5 },
    uAspect: { value: 16 / 9 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uStrength; uniform float uAspect; varying vec2 vUv;
    void main(){
      vec4 c=texture2D(tDiffuse,vUv);
      vec2 d=(vUv-0.5)*vec2(uAspect,1.0);
      float v=1.0-uStrength*smoothstep(0.35,1.15,length(d));
      gl_FragColor=vec4(c.rgb*v,1.0);
    }`,
};

export const BrainScene: React.FC<BrainSceneProps> = ({ palette }) => {
  const create = useCallback(
    (info: StageInfo) => {
      const { renderer, width, height, bufferWidth, bufferHeight, pixelScale } = info;
      renderer.setClearColor(new THREE.Color(palette.background), 1);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(palette.background);
      const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
      camera.position.set(0, 1.0, 5.7);
      camera.lookAt(0, -0.05, 0);

      const brain = buildBrain(600_000);
      const lin = (hex: string) => new THREE.Color(hex);
      const shared = {
        uTime: { value: 0 },
        uChaos: { value: 1 },
        uWave: { value: 2 },
        uWaveAmt: { value: 0 },
        uColAnterior: { value: lin(palette.anterior) },
        uColTop: { value: lin(palette.top) },
        uColLow: { value: lin(palette.low) },
        uWaveCol1: { value: lin(palette.wave1) },
        uWaveCol2: { value: lin(palette.wave2) },
        uLightDir: { value: new THREE.Vector3(-0.35, 0.75, 0.6) },
      };

      const additive = {
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
      } as const;
      const makePointsMat = (depthTest: boolean, brightness: number) =>
        new THREE.ShaderMaterial({
          uniforms: {
            ...shared,
            uSize: { value: 4.2 },
            uPixelScale: { value: pixelScale },
            uFocal: { value: 5.0 },
            uBrightness: { value: brightness },
            uWeight: { value: 1 },
          },
          vertexShader: pointsVertex,
          fragmentShader: pointsFragment,
          depthTest,
          ...additive,
        });
      const makeLinesMat = (depthTest: boolean, alpha: number) =>
        new THREE.ShaderMaterial({
          uniforms: {
            ...shared,
            // A 1px line at 4K covers half the area of a 1px line at 1080p.
            uLineAlpha: { value: alpha * 2 * pixelScale },
            uWeight: { value: 1 },
          },
          vertexShader: linesVertex,
          fragmentShader: linesFragment,
          depthTest,
          ...additive,
        });

      // Two looks are cross-faded: while scrambled, the sheets are see-through
      // (no depth test); once the brain is formed, an invisible depth-only
      // occluder hides the far hemisphere so it reads as a solid object.
      const pointsFree = makePointsMat(false, 0.27);
      const pointsSolid = makePointsMat(true, 1.3);
      const linesFree = makeLinesMat(false, 0.04);
      const linesSolid = makeLinesMat(true, 0.022);
      const occluderMat = new THREE.ShaderMaterial({
        uniforms: { ...shared, uBody: { value: 0 } },
        vertexShader: occluderVertex,
        fragmentShader: occluderFragment,
        depthWrite: true,
        depthTest: true,
        side: THREE.DoubleSide,
      });

      const group = new THREE.Group();
      const occluder = new THREE.Mesh(brain.occluder, occluderMat);
      occluder.renderOrder = 0;
      const objs = [
        new THREE.LineSegments(brain.lines, linesFree),
        new THREE.LineSegments(brain.lines, linesSolid),
        new THREE.Points(brain.points, pointsFree),
        new THREE.Points(brain.points, pointsSolid),
      ];
      objs.forEach((o, i) => {
        o.renderOrder = i + 1;
        o.frustumCulled = false;
        group.add(o);
      });
      occluder.frustumCulled = false;
      group.add(occluder);
      scene.add(group);
      const [linesFreeObj, linesSolidObj, pointsFreeObj, pointsSolidObj] = objs;

      const composer = new EffectComposer(renderer);
      composer.setPixelRatio(1);
      composer.setSize(bufferWidth, bufferHeight);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(bufferWidth, bufferHeight), 0.22, 0.3, 0.45);
      composer.addPass(bloom);
      const vignette = new ShaderPass(vignetteShader);
      vignette.uniforms.uStrength.value = palette.vignette;
      vignette.uniforms.uAspect.value = width / height;
      composer.addPass(vignette);
      composer.addPass(new OutputPass());

      return {
        renderFrame: (frame: number) => {
          const t = frame / FPS;
          shared.uTime.value = t;
          shared.uChaos.value = interpolate(frame, [CHAOS_HOLD_END, CHAOS_SETTLE_END], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.cubic),
          });
          shared.uWave.value = interpolate(frame, [WAVE_START, WAVE_END], [1.4, -2.4], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.sin),
          });
          shared.uWaveAmt.value = interpolate(
            frame,
            [WAVE_START - 6, WAVE_START + 4, WAVE_END - 8, WAVE_END + 6],
            [0, 1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          // Slow continuous turn: frontal lobe swings from 3/4-front to a near-lateral view.
          // Extra tumble while the sheets are scrambled.
          const tumble = shared.uChaos.value;
          group.rotation.y = interpolate(frame, [0, 299], [0.85, 0.48]) + tumble * 0.35 * Math.sin(t * 0.55 + 0.4);
          group.rotation.x = 0.06 + tumble * 0.12 * Math.sin(t * 0.4);
          group.rotation.z = interpolate(frame, [0, 299], [0.04, -0.02]);
          group.position.y = 0.04;

          const solid = interpolate(shared.uChaos.value, [0.0, 0.45], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          pointsFree.uniforms.uWeight.value = 1 - solid;
          linesFree.uniforms.uWeight.value = 1 - solid;
          pointsSolid.uniforms.uWeight.value = solid;
          linesSolid.uniforms.uWeight.value = solid;
          occluderMat.uniforms.uBody.value = 0.3 * solid * solid;
          pointsFreeObj.visible = linesFreeObj.visible = solid < 1;
          pointsSolidObj.visible = linesSolidObj.visible = occluder.visible = solid > 0;
          composer.render();
        },
        dispose: () => {
          brain.points.dispose();
          brain.lines.dispose();
          brain.occluder.dispose();
          [pointsFree, pointsSolid, linesFree, linesSolid, occluderMat].forEach((m) => m.dispose());
          composer.dispose();
        },
      };
    },
    [palette],
  );
  return <ThreeStage create={create} />;
};
