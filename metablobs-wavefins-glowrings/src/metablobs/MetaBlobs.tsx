import React, { useCallback } from "react";
import * as THREE from "three";
import { hexToLinear } from "../common/color";
import { LOOP_FRAMES, loopPhase } from "../common/constants";
import { BloomChain, FullscreenPass, makeTarget, passMaterial } from "../common/gl";
import { FrameRenderer, Stage } from "../common/Stage";
import { BLOB_COUNT, blobsAt, CAM_Z, SMOOTH_K, TAN_HALF } from "./blobs";
import { BLOBS_FINAL_FRAG, BLOBS_FRAG } from "./shader";

export type MetaBlobsProps = {
  mode: "neon" | "white";
  colorA: string; // neon: left/upper light, rim, glow. white: lit-side white
  colorB: string; // neon: right light. white: shadow-side grey
  background: string;
  backgroundCentre: string; // white mode: slightly lighter centre
  glow: number; // neon glow-halo strength
  bloom: number; // bloom strength (0 = off)
  grain: number;
};

class MetaBlobsRenderer implements FrameRenderer {
  private pass = new FullscreenPass();
  private bloom = new BloomChain(this.pass);
  private scene: THREE.WebGLRenderTarget | null = null;
  private blobs = new Float32Array(BLOB_COUNT * 4);
  private blobVecs = Array.from({ length: BLOB_COUNT }, () => new THREE.Vector4());
  private march: THREE.RawShaderMaterial;
  private final: THREE.RawShaderMaterial;

  constructor(private readonly p: MetaBlobsProps) {
    this.march = passMaterial(BLOBS_FRAG, {
      uRes: { value: new THREE.Vector2() },
      uBlobs: { value: this.blobVecs },
      uCamZ: { value: CAM_Z },
      uTanHalf: { value: TAN_HALF },
      uK: { value: SMOOTH_K },
      uMode: { value: p.mode === "neon" ? 0 : 1 },
      uColA: { value: hexToLinear(p.colorA) },
      uColB: { value: hexToLinear(p.colorB) },
      uBg: { value: hexToLinear(p.background) },
      uBgCentre: { value: hexToLinear(p.backgroundCentre) },
      uGlow: { value: p.glow },
    });
    this.final = passMaterial(BLOBS_FINAL_FRAG, {
      uScene: { value: null },
      uBloom: { value: null },
      uBloomStrength: { value: 0 },
      uGrain: { value: p.grain },
      uFrameMod: { value: 0 },
    });
  }

  render(gl: THREE.WebGLRenderer, frame: number, w: number, h: number) {
    if (!this.scene || this.scene.width !== w || this.scene.height !== h) {
      this.scene?.dispose();
      this.scene = makeTarget(w, h);
    }
    blobsAt(loopPhase(frame), this.blobs);
    for (let i = 0; i < BLOB_COUNT; i++) {
      this.blobVecs[i].fromArray(this.blobs, i * 4);
    }
    this.march.uniforms.uRes.value.set(w, h);
    this.pass.render(gl, this.march, this.scene);

    const u = this.final.uniforms;
    u.uScene.value = this.scene.texture;
    if (this.p.bloom > 0) {
      u.uBloom.value = this.bloom.render(gl, this.scene.texture, w, h, 0.45, 0.35);
      u.uBloomStrength.value = this.p.bloom / this.bloom.levelCount;
    } else {
      u.uBloom.value = this.scene.texture;
      u.uBloomStrength.value = 0;
    }
    u.uFrameMod.value = frame % LOOP_FRAMES;
    this.pass.render(gl, this.final, null);
  }

  dispose() {
    this.scene?.dispose();
    this.bloom.dispose();
    this.march.dispose();
    this.final.dispose();
    this.pass.dispose();
  }
}

export const MetaBlobs: React.FC<MetaBlobsProps> = (props) => {
  const create = useCallback(() => new MetaBlobsRenderer(props), [props]);
  return <Stage create={create} background={props.background} />;
};
