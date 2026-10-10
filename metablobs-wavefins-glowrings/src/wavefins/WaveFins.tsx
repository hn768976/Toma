import React, { useCallback } from "react";
import * as THREE from "three";
import { hexToLinear } from "../common/color";
import { LOOP_FRAMES, loopPhase } from "../common/constants";
import { BloomChain, FullscreenPass, makeTarget, passMaterial } from "../common/gl";
import { FrameRenderer, Stage } from "../common/Stage";
import { buildEnvironment, Panel } from "./env";
import {
  DOF_FRAG,
  FIN_BEGIN_VERTEX,
  FIN_BEGINNORMAL,
  FIN_DEPTH_OUT,
  FIN_EMISSIVE,
  FIN_FRAGMENT_PARS,
  FIN_VERTEX_PARS,
  FINS_FINAL_FRAG,
} from "./shaders";

export type WaveFinsProps = {
  metal: string; // base metal colour
  highlight: string; // edge highlight colour
  panelA: string; // main light-panel colour
  panelB: string; // secondary (whiter) panel colour
  keyLight: string;
  background: string;
  envIntensity: number;
  edgeStrength: number;
  bloom: number;
  grain: number;
};

const FIN_COUNT = 20;
const FIN_W = 1.2;
const FIN_H = 6;
const FIN_SPACING = 0.55;
const FIN_TURN = (60 * Math.PI) / 180;
const TAU = Math.PI * 2;

class WaveFinsRenderer implements FrameRenderer {
  private pass = new FullscreenPass();
  private bloom = new BloomChain(this.pass);
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 60);
  private material: THREE.MeshStandardMaterial;
  private finUniforms = {
    uAmp: { value: 0.5 },
    uAmp2: { value: 0.1 },
    uK: { value: 1.0 },
    uPhi: { value: 0 },
    uPhi2: { value: 0 },
    uDelta: { value: 0.2 },
    uCurve: { value: 0.25 },
    uHighlight: { value: new THREE.Vector3() },
    uEdgeStrength: { value: 1 },
    uFinWidth: { value: FIN_W },
    uPhase: { value: 0 },
  };
  private key: THREE.PointLight;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private sceneRT: THREE.WebGLRenderTarget | null = null;
  private dofRT: THREE.WebGLRenderTarget | null = null;
  private dof = passMaterial(DOF_FRAG, {
    uSrc: { value: null },
    uRes: { value: new THREE.Vector2() },
    uFocus: { value: 6 },
    uCocScale: { value: 0.3 },
    uMaxCoc: { value: 0.02 },
  });
  private final: THREE.RawShaderMaterial;
  private group = new THREE.Group();
  private target = new THREE.Vector3();

  constructor(private readonly p: WaveFinsProps) {
    this.finUniforms.uHighlight.value = hexToLinear(p.highlight);
    this.finUniforms.uEdgeStrength.value = p.edgeStrength;
    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(p.metal),
      metalness: 1,
      roughness: 0.28,
      side: THREE.DoubleSide,
      envMapIntensity: p.envIntensity,
    });
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.finUniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\n" + FIN_VERTEX_PARS)
        .replace("#include <beginnormal_vertex>", FIN_BEGINNORMAL)
        .replace("#include <begin_vertex>", FIN_BEGIN_VERTEX);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\n" + FIN_FRAGMENT_PARS)
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + FIN_EMISSIVE)
        .replace("#include <dithering_fragment>", FIN_DEPTH_OUT);
    };
    this.material.customProgramCacheKey = () => "wave-fin-v1";

    const geo = new THREE.PlaneGeometry(FIN_W, FIN_H, 64, 256);
    const fins = new THREE.InstancedMesh(geo, this.material, FIN_COUNT);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), FIN_TURN);
    for (let i = 0; i < FIN_COUNT; i++) {
      m.compose(
        new THREE.Vector3((i - (FIN_COUNT - 1) / 2) * FIN_SPACING, 0, 0),
        q,
        new THREE.Vector3(1, 1, 1),
      );
      fins.setMatrixAt(i, m);
    }
    fins.frustumCulled = false;
    this.group.add(fins);
    this.group.rotation.z = -0.38; // fins lean, like the reference
    this.scene.add(this.group);

    this.key = new THREE.PointLight(new THREE.Color(p.keyLight), 3, 0, 0);
    this.scene.add(this.key);
    this.scene.background = null;

    this.final = passMaterial(FINS_FINAL_FRAG, {
      uScene: { value: null },
      uBloom: { value: null },
      uBloomStrength: { value: 0 },
      uGrain: { value: p.grain },
      uRes: { value: new THREE.Vector2() },
      uFrameMod: { value: 0 },
    });
  }

  private panels(): Panel[] {
    return [
      { u: 0.42, v: 0.38, w: 0.2, h: 0.36, color: this.p.panelA, alpha: 0.6 },
      { u: 0.47, v: 0.34, w: 0.09, h: 0.3, color: this.p.panelB, alpha: 1 },
      { u: 0.9, v: 0.5, w: 0.08, h: 0.25, color: this.p.panelA, alpha: 0.5 },
    ];
  }

  render(gl: THREE.WebGLRenderer, frame: number, w: number, h: number) {
    if (!this.envRT) {
      this.envRT = buildEnvironment(gl, this.panels());
      this.material.envMap = this.envRT.texture;
    }
    if (!this.sceneRT || this.sceneRT.width !== w || this.sceneRT.height !== h) {
      this.sceneRT?.dispose();
      this.dofRT?.dispose();
      this.sceneRT = makeTarget(w, h, {
        samples: 4,
        depthBuffer: true,
        generateMipmaps: true, // the DoF gather reads pre-blurred mips
        minFilter: THREE.LinearMipmapLinearFilter,
      });
      this.dofRT = makeTarget(w, h);
    }
    const ph = loopPhase(frame);
    const tp = TAU * ph;
    const u = this.finUniforms;
    // Wave flex: amplitude, phase and per-fin offset all run whole cycles.
    u.uAmp.value = 0.8 + 0.25 * Math.sin(tp + 0.4);
    u.uAmp2.value = 0.1 + 0.06 * Math.sin(2 * tp + 1.1);
    u.uK.value = 0.95;
    u.uPhi.value = tp + 0.8 * Math.sin(tp);
    u.uPhi2.value = -2 * tp + 0.6;
    u.uDelta.value = 0.16 + 0.07 * Math.sin(tp + 2.0);
    u.uPhase.value = ph;

    // Environment panels sweep (closed oscillation), key light on a closed loop.
    this.material.envMapRotation.set(0.18 * Math.sin(tp + 0.5), 0.9 * Math.sin(tp) + 0.2, 0);
    this.key.position.set(3.2 * Math.cos(tp), 1.8 * Math.sin(tp), 2.6 + 0.8 * Math.sin(2 * tp));

    // Camera: one closed lap. Sideways drift +-1.2, orbit +-8 deg, slight push.
    const drift = 1.2 * Math.sin(tp);
    const orbit = ((8 * Math.PI) / 180) * Math.sin(tp + 0.9);
    const dist = 3.7 + 0.3 * Math.sin(2 * tp + 0.3);
    this.target.set(drift * 0.6, 0.15 * Math.sin(tp + 2.1), 0);
    this.camera.position.set(
      this.target.x + Math.sin(orbit) * dist + drift * 0.4,
      this.target.y + 0.25 * Math.cos(tp),
      Math.cos(orbit) * dist,
    );
    this.camera.lookAt(this.target);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    gl.setRenderTarget(this.sceneRT);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, true, false);
    gl.render(this.scene, this.camera);

    const d = this.dof.uniforms;
    d.uSrc.value = this.sceneRT.texture;
    d.uRes.value.set(w, h);
    d.uFocus.value = this.camera.position.distanceTo(this.target);
    this.pass.render(gl, this.dof, this.dofRT);

    const f = this.final.uniforms;
    f.uScene.value = this.dofRT!.texture;
    f.uBloom.value = this.bloom.render(gl, this.dofRT!.texture, w, h, 0.6, 0.3);
    f.uBloomStrength.value = this.p.bloom / this.bloom.levelCount;
    f.uRes.value.set(w, h);
    f.uFrameMod.value = frame % LOOP_FRAMES;
    this.pass.render(gl, this.final, null);
  }

  dispose() {
    this.envRT?.dispose();
    this.sceneRT?.dispose();
    this.dofRT?.dispose();
    this.bloom.dispose();
    this.material.dispose();
    this.dof.dispose();
    this.final.dispose();
    this.pass.dispose();
  }
}

export const WaveFins: React.FC<WaveFinsProps> = (props) => {
  const create = useCallback(() => new WaveFinsRenderer(props), [props]);
  return <Stage create={create} background={props.background} />;
};
