import React, { useMemo, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useCurrentFrame, useVideoConfig } from 'remotion';

import { glassVertexShader, glassFragmentShader } from './glass-shader';
import {
  quadVertexShader,
  backgroundFragmentShader,
  blurFragmentShader,
  gradeFragmentShader,
  brightPassFragmentShader,
  copyFragmentShader,
} from './post-shaders';
import { buildField, bubbleTransform, type Bubble } from '../lib/field';
import { smoothstep } from '../lib/random';
import { cameraDistance } from '../lib/camera';
import type { VersionConfig } from '../versions';

const MID_SLICES = 3;

const v3 = (c: [number, number, number]) => new THREE.Vector3(c[0], c[1], c[2]);

const makeTarget = (w: number, h: number, alpha = false) => {
  const t = new THREE.WebGLRenderTarget(Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)), {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: alpha ? THREE.RGBAFormat : THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false,
  });
  t.texture.colorSpace = THREE.NoColorSpace;
  t.texture.generateMipmaps = false;
  return t;
};

/**
 * Renders one version.
 *
 * Six ordered passes per frame:
 *   1  backdrop gradient
 *   2  far bubbles, refracting the backdrop
 *   3  gaussian defocus of that whole rear plate
 *   4  mid bubbles in two sub-layers so they refract each other
 *   5  near bubbles, defocused and composited as foreground bokeh
 *   6  grade — bloom, lens chroma, vignette, grain
 */
export const BubbleScene: React.FC<{ config: VersionConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { gl, size, scene, camera } = useThree();

  const t = frame / fps;
  const p = durationInFrames <= 1 ? 0 : frame / (durationInFrames - 1);

  const layers = useMemo(() => buildField(config), [config]);

  // ---- Render targets -------------------------------------------------
  const rt = useMemo(() => {
    const w = size.width;
    const h = size.height;
    const hw = w / 2;
    const hh = h / 2;
    const qw = w / 4;
    const qh = h / 4;
    return {
      bg: makeTarget(hw, hh),
      far: makeTarget(hw, hh),
      blurA: makeTarget(hw, hh),
      blurB: makeTarget(hw, hh),
      mid: makeTarget(w, h),
      midCopy: makeTarget(w, h),
      near: makeTarget(w, h, true),
      nearA: makeTarget(w, h, true),
      nearB: makeTarget(w, h, true),
      bloomA: makeTarget(qw, qh),
      bloomB: makeTarget(qw, qh),
    };
  }, [size.width, size.height]);

  useLayoutEffect(() => () => Object.values(rt).forEach((target) => target.dispose()), [rt]);

  // ---- Fullscreen quad rig -------------------------------------------
  const quad = useMemo(() => {
    const geo = new THREE.PlaneGeometry(2, 2);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const scn = new THREE.Scene();
    const mesh = new THREE.Mesh<THREE.PlaneGeometry, THREE.Material>(geo, new THREE.MeshBasicMaterial());
    mesh.frustumCulled = false;
    scn.add(mesh);
    return { scn, cam, mesh };
  }, []);

  const passes = useMemo(() => {
    const mk = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        vertexShader: quadVertexShader,
        fragmentShader,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });

    return {
      background: mk(backgroundFragmentShader, {
        uInner: { value: new THREE.Vector3() },
        uOuter: { value: new THREE.Vector3() },
        uCenter: { value: new THREE.Vector2() },
        uRadius: { value: 1 },
        uFalloff: { value: 1 },
        uRampColor: { value: new THREE.Vector3() },
        uRampAmount: { value: 0 },
        uRampAngle: { value: 0 },
        uPanel: { value: 0 },
        uAspect: { value: 1 },
      }),
      blur: mk(blurFragmentShader, {
        uTex: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uDirection: { value: new THREE.Vector2(1, 0) },
        uRadius: { value: 1 },
      }),
      copy: mk(copyFragmentShader, { uTex: { value: null } }),
      bright: mk(brightPassFragmentShader, {
        uTex: { value: null },
        uThreshold: { value: 0.7 },
      }),
      grade: mk(gradeFragmentShader, {
        uScene: { value: null },
        uForeground: { value: null },
        uBloom: { value: null },
        uBloomAmount: { value: 0 },
        uChroma: { value: 0 },
        uVignette: { value: 0 },
        uGrain: { value: 0 },
        uExposure: { value: 1 },
        uContrast: { value: 1 },
        uSaturation: { value: 1 },
        uFrame: { value: 0 },
      }),
    };
  }, []);

  // ---- Bubble meshes --------------------------------------------------
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 128, 80), []);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  const build = useMemo(() => {
    const g = config.glass;

    const makeMesh = (b: Bubble, premultiplied: boolean) => {
      const material = new THREE.ShaderMaterial({
        vertexShader: glassVertexShader,
        fragmentShader: premultiplied
          ? glassFragmentShader.replace(
              'gl_FragColor = vec4(color, alpha);',
              'gl_FragColor = vec4(color * alpha, alpha);',
            )
          : glassFragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        premultipliedAlpha: premultiplied,
        uniforms: {
          uBackdrop: { value: null },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uTint: { value: v3(g.tint) },
          uRimColor: { value: v3(g.rimColor) },
          uSpecColor: { value: v3(g.specColor) },
          uLightA: { value: new THREE.Vector3(-0.45, 0.8, 0.4) },
          uLightB: { value: new THREE.Vector3(0.7, -0.3, 0.65) },
          uIor: { value: g.ior },
          uRefract: { value: g.refract },
          uAbsorb: { value: g.absorb },
          uFresnelPower: { value: g.fresnelPower },
          uFresnelStrength: { value: g.fresnelStrength },
          uDispersion: { value: g.dispersion },
          uSpecPower: { value: g.specPower },
          uSpecStrength: { value: g.specStrength },
          uInnerAmount: { value: g.innerAmount },
          uInnerScale: { value: g.innerScale },
          uInnerDensity: { value: g.innerDensity },
          uIridescence: { value: g.iridescence },
          uEdgeDark: { value: g.edgeDark },
          uSpecAniso: { value: g.specAniso },
          uRimWidth: { value: g.rimWidth },
          uOpacity: { value: g.opacity },
          uSeed: { value: b.seed },
          uShellGap: { value: g.shellGap },
          uTime: { value: 0 },
          uSheen: { value: g.sheen },
        },
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.userData.bubble = b;
      return mesh;
    };

    const group = (list: Bubble[], premultiplied: boolean) => {
      const grp = new THREE.Group();
      list.forEach((b) => grp.add(makeMesh(b, premultiplied)));
      return grp;
    };

    // The mid layer is split into depth slices. Each slice refracts a snapshot
    // of everything already drawn behind it, so overlapping bubbles distort one
    // another instead of every one of them bending the same flat rear plate.
    // Three slices is the point where added passes stop being visible.
    const midSorted = [...layers.mid].sort((a, b) => a.home[2] - b.home[2]);
    const sliceSize = Math.ceil(midSorted.length / MID_SLICES) || 1;
    const mid: THREE.Group[] = [];
    for (let i = 0; i < midSorted.length; i += sliceSize) {
      mid.push(group(midSorted.slice(i, i + sliceSize), false));
    }

    return { far: group(layers.far, false), mid, near: group(layers.near, true) };
  }, [layers, config, geometry]);

  const allGroups = useMemo(
    () => [build.far, ...build.mid, build.near],
    [build],
  );

  useLayoutEffect(
    () => () => {
      allGroups.forEach((grp) =>
        grp.children.forEach((c) =>
          ((c as THREE.Mesh).material as THREE.Material)?.dispose(),
        ),
      );
    },
    [allGroups],
  );

  const groupsRef = useRef(build);
  groupsRef.current = build;

  // ---- Per-frame pipeline --------------------------------------------
  const drawingBuffer = useMemo(() => new THREE.Vector2(), []);

  useFrame(() => {
    const groups = groupsRef.current;
    gl.getDrawingBufferSize(drawingBuffer);
    const w = drawingBuffer.x;
    const h = drawingBuffer.y;

    // Keep every target matched to the real drawing buffer.
    if (rt.mid.width !== w || rt.mid.height !== h) {
      rt.bg.setSize(w / 2, h / 2);
      rt.far.setSize(w / 2, h / 2);
      rt.blurA.setSize(w / 2, h / 2);
      rt.blurB.setSize(w / 2, h / 2);
      rt.mid.setSize(w, h);
      rt.midCopy.setSize(w, h);
      rt.near.setSize(w, h);
      rt.nearA.setSize(w, h);
      rt.nearB.setSize(w, h);
      rt.bloomA.setSize(w / 4, h / 4);
      rt.bloomB.setSize(w / 4, h / 4);
    }

    // Camera move
    const cam = camera as THREE.PerspectiveCamera;
    const push = config.camera.pushIn * smoothstep(0, 1, p);
    cam.fov = config.camera.fov;
    cam.position.set(
      Math.sin(t * 0.12) * config.camera.driftX,
      Math.cos(t * 0.1) * config.camera.driftY,
      cameraDistance(config) - push,
    );
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();

    // Place every bubble for this frame.
    const place = (grp: THREE.Group) => {
      grp.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        const b = mesh.userData.bubble as Bubble;
        const { pos, rot, scale } = bubbleTransform(b, config, t, p);
        mesh.position.set(pos[0], pos[1], pos[2]);
        mesh.rotation.set(rot[0], rot[1], rot[2]);
        // Uniform on every axis. Bubbles differ by size alone; any squash
        // turns them into ellipsoids, which is exactly the shape change the
        // brief rules out.
        const s = b.radius * scale;
        mesh.scale.set(s, s, s);
        mesh.visible = scale > 0.005;
        const u = (mesh.material as THREE.ShaderMaterial).uniforms;
        u.uTime.value = t;
        u.uResolution.value.set(w, h);
      });
    };

    place(groups.far);
    groups.mid.forEach(place);
    place(groups.near);

    const setBackdrop = (grp: THREE.Group, tex: THREE.Texture) => {
      grp.children.forEach((c) => {
        ((c as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uBackdrop.value = tex;
      });
    };

    const everything = [groups.far, ...groups.mid, groups.near];
    const only = (visible: THREE.Group[]) => {
      everything.forEach((g) => {
        g.visible = visible.includes(g);
      });
    };

    const drawQuad = (material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      quad.mesh.material = material;
      gl.setRenderTarget(target);
      gl.render(quad.scn, quad.cam);
    };

    const blur = (
      src: THREE.WebGLRenderTarget,
      tmp: THREE.WebGLRenderTarget,
      dst: THREE.WebGLRenderTarget,
      radius: number,
    ) => {
      const u = passes.blur.uniforms;
      u.uRadius.value = radius;
      u.uTex.value = src.texture;
      u.uTexel.value.set(1 / src.width, 1 / src.height);
      u.uDirection.value.set(1, 0);
      drawQuad(passes.blur, tmp);
      u.uTex.value = tmp.texture;
      u.uDirection.value.set(0, 1);
      drawQuad(passes.blur, dst);
    };

    const copyInto = (src: THREE.Texture, dst: THREE.WebGLRenderTarget | null) => {
      passes.copy.uniforms.uTex.value = src;
      drawQuad(passes.copy, dst);
    };

    const prevAutoClear = gl.autoClear;

    // Pass 1 — backdrop gradient.
    const bgU = passes.background.uniforms;
    const bg = config.background;
    bgU.uInner.value.set(bg.inner[0], bg.inner[1], bg.inner[2]);
    bgU.uOuter.value.set(bg.outer[0], bg.outer[1], bg.outer[2]);
    bgU.uCenter.value.set(bg.center[0], bg.center[1]);
    bgU.uRadius.value = bg.radius;
    bgU.uFalloff.value = bg.falloff;
    bgU.uRampColor.value.set(bg.rampColor[0], bg.rampColor[1], bg.rampColor[2]);
    bgU.uRampAmount.value = bg.rampAmount;
    bgU.uRampAngle.value = bg.rampAngle;
    bgU.uPanel.value = bg.panel;
    bgU.uAspect.value = w / h;
    drawQuad(passes.background, rt.bg);

    // Pass 2 — far bubbles over a copy of the backdrop.
    copyInto(rt.bg.texture, rt.far);
    setBackdrop(groups.far, rt.bg.texture);
    only([groups.far]);
    gl.autoClear = false;
    gl.setRenderTarget(rt.far);
    gl.render(scene, cam);

    // Pass 3 — defocus the whole rear plate.
    gl.autoClear = prevAutoClear;
    blur(rt.far, rt.blurA, rt.blurB, config.grade.farBlur);

    // Pass 4 — mid slices at full resolution, back to front, each one
    // refracting a snapshot of the slices already composited behind it.
    copyInto(rt.blurB.texture, rt.mid);
    groups.mid.forEach((slice, i) => {
      if (i > 0) copyInto(rt.mid.texture, rt.midCopy);
      setBackdrop(slice, i === 0 ? rt.blurB.texture : rt.midCopy.texture);
      only([slice]);
      gl.autoClear = false;
      gl.setRenderTarget(rt.mid);
      gl.render(scene, cam);
      gl.autoClear = prevAutoClear;
    });

    // Pass 5 — foreground bokeh on a transparent plate.
    copyInto(rt.mid.texture, rt.midCopy);
    setBackdrop(groups.near, rt.midCopy.texture);
    only([groups.near]);
    gl.setRenderTarget(rt.near);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, false);
    gl.autoClear = false;
    gl.render(scene, cam);
    gl.autoClear = prevAutoClear;
    blur(rt.near, rt.nearA, rt.nearB, config.grade.nearBlur);

    // Bloom from the sharp plate.
    passes.bright.uniforms.uTex.value = rt.mid.texture;
    passes.bright.uniforms.uThreshold.value = config.grade.bloomThreshold;
    drawQuad(passes.bright, rt.bloomA);
    blur(rt.bloomA, rt.bloomB, rt.bloomA, 2.4);
    blur(rt.bloomA, rt.bloomB, rt.bloomA, 4.8);

    // Pass 6 — grade to screen.
    const gu = passes.grade.uniforms;
    gu.uScene.value = rt.mid.texture;
    gu.uForeground.value = rt.nearB.texture;
    gu.uBloom.value = rt.bloomA.texture;
    gu.uBloomAmount.value = config.grade.bloom;
    gu.uChroma.value = config.grade.chroma;
    gu.uVignette.value = config.grade.vignette;
    gu.uGrain.value = config.grade.grain;
    gu.uExposure.value = config.grade.exposure;
    gu.uContrast.value = config.grade.contrast;
    gu.uSaturation.value = config.grade.saturation;
    gu.uFrame.value = frame;
    drawQuad(passes.grade, null);

    only([]);
  }, 1);

  return (
    <>
      <primitive object={build.far} />
      {build.mid.map((grp, i) => (
        <primitive key={i} object={grp} />
      ))}
      <primitive object={build.near} />
    </>
  );
};
