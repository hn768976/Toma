// Look 3 — Data Montage (three.js). ~80 Canvas-2D infographic planes in five
// depth layers. Each layer renders into its own half-float target and gets its
// own blur (depth of field, focus on the middle layer); a bloom pass and a
// violet flare are added in the final composite.
import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { landSync, loadFonts, loadLand, useAssets } from "../../lib/assets";
import { HEIGHT, WIDTH } from "../../lib/constants";
import { GLSL_HEADER } from "../../lib/glsl";
import { GLStage, type GLFactory } from "../../lib/three/GLStage";
import { FullscreenPass, GaussianBlur, halfFloatTarget, makeFinalPass, srgb } from "../../lib/three/pipeline";
import type { DataMontagePalette } from "../../versions";
import { drawElement, ELEMENTS, LAYER_COUNTS } from "./elements";

const FOV = 38;
const ASPECT = WIDTH / HEIGHT;
/** near → far */
const DEPTH = [5, 7.5, 10, 13.5, 18];
/** wrap-strip width / visible width, and whole wraps per loop (parallax: near layers faster) */
const WRAP = [1.7, 1.6, 1.5, 1.45, 1.4];
const WRAPS_PER_LOOP = [2, 2, 1, 1, 1];
/** depth-of-field blur, sigma in 4K pixels; the middle layer is in focus */
const DOF_SIGMA_4K = [30, 9, 0, 6, 15];
/** texture resolution relative to on-screen size (blurred layers need less) */
const TEX_RES = [0.5, 0.8, 1.0, 0.8, 0.6];
const BRIGHT = [0.75, 0.9, 1.0, 0.75, 0.55];

const visibleH = (d: number) => 2 * d * Math.tan(((FOV / 2) * Math.PI) / 180);

const COMPOSITE_DECL = /* glsl */ `
uniform sampler2D uL0, uL1, uL3, uL4, uBloom;
uniform vec3 cTop, cBot, cFlare;
`;
const COMPOSITE = /* glsl */ `
  vec3 layers = c;   // uSrc = the in-focus layer
  layers += texture(uL0, uv).rgb + texture(uL1, uv).rgb + texture(uL3, uv).rgb + texture(uL4, uv).rgb;
  vec3 bg = mix(cBot, cTop, smoothstep(0.0, 1.0, uv.y));
  float vig = length((uv - 0.5) * vec2(1.0, 0.8));
  bg *= 1.0 - 0.45 * smoothstep(0.3, 0.8, vig);
  vec3 bloom = texture(uBloom, uv).rgb;
  // violet lens flare, top-left corner
  float asp = uRes.x / uRes.y;
  vec2 fp = vec2(0.015, 0.95);
  vec2 d = (uv - fp) * vec2(asp, 1.0);
  float r = length(d);
  float flare = 0.85 * exp(-r / 0.06) + 0.45 * exp(-r / 0.22) + 0.12 * exp(-r / 0.6);
  flare += 0.35 * exp(-abs(d.y) / 0.012) * exp(-abs(d.x) / 0.45);  // anamorphic streak
  vec2 ghost = (uv - mix(fp, vec2(0.5), 1.35)) * vec2(asp, 1.0);
  flare += 0.06 * smoothstep(0.09, 0.07, length(ghost)) * smoothstep(0.04, 0.08, length(ghost));
  c = bg + layers * 1.0 + bloom * 0.7 + cFlare * flare;
  // soft shoulder so stacked additive glows never clip hard
  c = mix(c, vec3(1.0) - exp(-c), smoothstep(0.6, 1.4, max(c.r, max(c.g, c.b))));
`;

export const DataMontage: React.FC<DataMontagePalette> = (p) => {
  const ready = useAssets([loadFonts, loadLand]);

  const factory = useCallback<GLFactory>(
    (gl, pw, ph) => {
      const land = landSync();
      const ink = { dim: p.elementDim, bright: p.elementBright };
      const s4k = ph / HEIGHT;
      const camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 100);
      camera.position.set(0, 0, 0);
      camera.lookAt(0, 0, -1);

      const maxAniso = gl.capabilities.getMaxAnisotropy();
      const scenes = LAYER_COUNTS.map(() => new THREE.Scene());
      const items = ELEMENTS.map((el) => {
        const d = DEPTH[el.layer];
        const hv = visibleH(d);
        const wv = hv * ASPECT;
        const ww = el.w * wv;
        const hh = ww * el.aspect;
        const cw = Math.max(64, Math.min(2048, Math.ceil(el.w * pw * TEX_RES[el.layer])));
        const ch = Math.max(32, Math.round(cw * el.aspect));
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d")!;
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.NoColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = Math.min(8, maxAniso);
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthTest: false,
          depthWrite: false,
          color: new THREE.Color(BRIGHT[el.layer], BRIGHT[el.layer], BRIGHT[el.layer]),
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), mat);
        mesh.position.set(0, el.y * hv, -d);
        mesh.frustumCulled = false;
        scenes[el.layer].add(mesh);
        if (!el.animated) {
          drawElement(ctx, cw, ch, 0, el, ink, land);
          tex.needsUpdate = true;
        }
        return { el, mesh, mat, tex, ctx, cw, ch, wv, ww };
      });

      const half = (n: number) => Math.max(1, Math.round(n / 2));
      const targets = LAYER_COUNTS.map((_, i) => (i === 2 ? halfFloatTarget(pw, ph) : halfFloatTarget(half(pw), half(ph))));
      const blurHalf = new GaussianBlur(half(pw), half(ph));
      const qw = Math.max(1, Math.round(pw / 4));
      const qh = Math.max(1, Math.round(ph / 4));
      const bloomRT = halfFloatTarget(qw, qh);
      const blurQ = new GaussianBlur(qw, qh);
      const sum = new FullscreenPass(
        GLSL_HEADER +
          /* glsl */ `
uniform sampler2D uL0, uL1, uL2, uL3, uL4;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 c = texture(uL0, vUv).rgb + texture(uL1, vUv).rgb + texture(uL2, vUv).rgb + texture(uL3, vUv).rgb + texture(uL4, vUv).rgb;
  outColor = vec4(c, 1.0);
}`,
        Object.fromEntries(targets.map((t, i) => [`uL${i}`, { value: t.texture }])),
      );
      const final = makeFinalPass(
        COMPOSITE,
        {
          uL0: { value: targets[0].texture },
          uL1: { value: targets[1].texture },
          uL3: { value: targets[3].texture },
          uL4: { value: targets[4].texture },
          uBloom: { value: bloomRT.texture },
          cTop: { value: srgb(p.bgTop) },
          cBot: { value: srgb(p.bgBottom) },
          cFlare: { value: srgb(p.flare) },
        },
        COMPOSITE_DECL,
      );
      final.uniforms.uSrc.value = targets[2].texture;
      final.uniforms.uRes.value.set(pw, ph);
      // sample, not texelFetch: the other layers are half resolution
      final.material.fragmentShader = final.material.fragmentShader.replace(
        "vec3 c = texelFetch(uSrc, px, 0).rgb;",
        "vec3 c = texture(uSrc, vUv).rgb;",
      );

      const render = (f: number) => {
        const t = f / 600;
        for (const it of items) {
          const { el, mesh, mat, tex, ctx, cw, ch, wv } = it;
          const wrapW = WRAP[el.layer] * wv;
          const u = (((el.x0 - WRAPS_PER_LOOP[el.layer] * t) % 1) + 1) % 1;
          mesh.position.x = u * wrapW - wrapW / 2;
          mat.opacity = el.base * (0.62 + 0.38 * Math.sin(2 * Math.PI * el.fm * t + el.fph));
          const onScreen = Math.abs(mesh.position.x) < wv / 2 + it.ww / 2;
          mesh.visible = onScreen;
          if (el.animated && onScreen) {
            drawElement(ctx, cw, ch, t, el, ink, land);
            tex.needsUpdate = true;
          }
        }
        gl.setClearColor(0x000000, 0);
        targets.forEach((rt, i) => {
          gl.setRenderTarget(rt);
          gl.clear(true, false, false);
          gl.render(scenes[i], camera);
          const sigma = DOF_SIGMA_4K[i] * s4k * (i === 2 ? 1 : 0.5);
          if (sigma > 0.3) blurHalf.apply(gl, rt, sigma);
        });
        sum.render(gl, bloomRT);
        blurQ.apply(gl, bloomRT, 40 * s4k * 0.25);
        final.uniforms.uFrame.value = f;
        final.render(gl, null);
      };

      return {
        render,
        dispose: () => {
          for (const it of items) {
            it.tex.dispose();
            it.mat.dispose();
            it.mesh.geometry.dispose();
          }
          targets.forEach((t) => t.dispose());
          bloomRT.dispose();
          blurHalf.dispose();
          blurQ.dispose();
          sum.dispose();
          final.dispose();
        },
      };
    },
    [p],
  );

  return <AbsoluteFill style={{ backgroundColor: "#000" }}>{ready ? <GLStage factory={factory} /> : null}</AbsoluteFill>;
};
