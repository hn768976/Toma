// The 3D scene and its render loop:
//   1. mirror pass: the card/bars/arrow mirrored in y, rendered from the same
//      camera into a half-res target (the floor samples it as its reflection);
//   2. main pass into a multisampled HDR target (with depth);
//   3. final pass: depth of field, ACES, dither, grain -> screen.
// All per-frame values come from the frame prop and are applied inside the
// render callback, right before drawing.
import {useFrame, useThree} from '@react-three/fiber';
import React, {useEffect, useMemo, useRef} from 'react';
import {cancelRender} from 'remotion';
import * as THREE from 'three';
import {DIRECTIONS, type Direction, type Row} from '../data/rows';
import {seeded} from '../lib/random';
import {arrowGeometry, barGeometry, cardGeometry} from './geometry';
import {animate, cameraPose, chartToWorld, computeLayout, focusBand, LOOK} from './layout';
import {addGlint, floorFragment, floorVertex, MAX_LINES, postFragment, postVertex, skyFragment, skyVertex} from './shaders';

const FLOOR_NEAR = new THREE.Color('#99B0D5');
const SKY_TOP = new THREE.Color('#D3E2F2');
const FLOOR_FAR = new THREE.Color('#B9CDE6');
/** Brightness of the (display-referred) arrow's lit colour. */
const ARROW_EXPOSURE = 0.3;

const srgb = (c: THREE.Color) => {
  const o = {r: 0, g: 0, b: 0};
  c.getRGB(o, THREE.SRGBColorSpace);
  return new THREE.Vector3(o.r, o.g, o.b);
};

// Faint network lines on the floor: fixed, from the module-level seed.
const FLOOR_LINES = (() => {
  const rand = seeded(0x11e5);
  return Array.from({length: MAX_LINES}, () => {
    const x = -34 + rand() * 68;
    const z = -48 + rand() * 78;
    const a = rand() * Math.PI;
    const len = 6 + rand() * 18;
    return new THREE.Vector4(x, z, x + Math.cos(a) * len, z + Math.sin(a) * len);
  });
})();

/** Horizontal soft band (alpha in v, soft ends in u) for the arrow's floor glow. */
const bandTexture = () => {
  const w = 256;
  const h = 64;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = (y + 0.5) / h - 0.5;
      const u = (x + 0.5) / w;
      const a = Math.exp(-(v * v) / 0.025) * Math.min(1, u / 0.08, (1 - u) / 0.08);
      data.set([255, 255, 255, Math.round(255 * a)], (y * w + x) * 4);
    }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  return tex;
};

/** Blending that keeps the destination alpha (the "display-referred" mask). */
const keepAlpha = (m: THREE.Material, additive = false) => {
  m.transparent = true;
  m.depthWrite = false;
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.SrcAlphaFactor;
  m.blendDst = additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
};

export type SceneProps = {row: Row; dir: Direction; flagImg: HTMLImageElement; hdri: THREE.Texture; frame: number};

export const ChartScene: React.FC<SceneProps> = ({row, dir, flagImg, hdri, frame}) => {
  const {gl, scene, camera, size} = useThree();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const layout = useMemo(() => computeLayout(row, dir, size.width / size.height), [row, dir, size.width, size.height]);

  // ---------------------------------------------------------------- objects (built once)
  const objs = useMemo(() => {
    const preset = DIRECTIONS[dir];
    const glowHolderAo = new THREE.Group(); // floor decals under the chart (same transform, not mirrored)
    glowHolderAo.rotation.y = THREE.MathUtils.degToRad(LOOK.chartYaw);
    const mirrored = new THREE.Group(); // everything that reflects in the floor
    const chart = new THREE.Group(); // bars + arrow, turned by LOOK.chartYaw
    chart.rotation.y = THREE.MathUtils.degToRad(LOOK.chartYaw);
    mirrored.add(chart);

    // card
    const {geo: cardGeo} = cardGeometry(layout.cardW, layout.cardH);
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = Math.round(2048 / (layout.cardW / layout.cardH));
    canvas.getContext('2d')!.drawImage(flagImg, 0, 0, canvas.width, canvas.height);
    const flagTex = new THREE.CanvasTexture(canvas);
    flagTex.colorSpace = THREE.SRGBColorSpace;
    flagTex.anisotropy = 8;
    const glint = {uGlintPos: {value: -1}, uGlintStrength: {value: 0}};
    const faceMat = new THREE.MeshPhysicalMaterial({map: flagTex, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 1.3, emissiveMap: flagTex, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.62});
    addGlint(faceMat, glint);
    const rimMat = new THREE.MeshPhysicalMaterial({color: '#FFFFFF', roughness: 0.18, metalness: 0.25, clearcoat: 1, envMapIntensity: 1.8, emissive: new THREE.Color('#E8EEF6'), emissiveIntensity: 0.35});
    const card = new THREE.Mesh(cardGeo, [faceMat, rimMat]);
    card.position.copy(layout.cardCenter);
    card.castShadow = true;
    mirrored.add(card);

    // bars
    // glossy white, slightly cool in the shadows (a soft cool fill keeps the shaded sides from going grey)
    // short bars shade toward a cool slate, tall ones stay white (as in the references)
    const barMat = (h: number) =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#5E5878').lerp(new THREE.Color('#F4F6FA'), THREE.MathUtils.smoothstep(h, 0.08, 0.8)),
        roughness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 2.6,
        emissive: new THREE.Color('#C9D6E6'),
        emissiveIntensity: 0.16 + 0.12 * h * h,
      });
    const bars = layout.heights.map((h, i) => {
      const m = new THREE.Mesh(barGeometry(h * LOOK.chartHeight), barMat(h));
      m.position.set((i - (layout.heights.length - 1) / 2) * LOOK.barSpacing, 0, 0);
      m.castShadow = true;
      m.receiveShadow = true;
      chart.add(m);
      return m;
    });

    // arrow (body drawn on with a clipping plane, head pops in)
    const arrow = arrowGeometry(layout.arrowPath, preset.arrow, preset.arrowTop);
    const clip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -1000);
    const arrowMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
      envMapIntensity: 0.12,
      emissive: new THREE.Color(preset.arrow),
      emissiveIntensity: preset.glow, // bright green needs less self-light than red to stay saturated after ACES
      side: THREE.DoubleSide,
      clippingPlanes: [clip],
    });
    const body = new THREE.Mesh(arrow.body, arrowMat);
    body.position.z = layout.arrowZ;
    body.castShadow = true;
    const headMat = arrowMat.clone();
    headMat.clippingPlanes = [];
    // The arrow is display-referred (alpha 0 = skip ACES in the post pass):
    // ACES desaturates a bright, saturated green badly; lit shading and gloss
    // still apply, only the tone curve is skipped.
    for (const m of [arrowMat, headMat]) {
      m.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>\n  gl_FragColor.rgb *= ${ARROW_EXPOSURE.toFixed(3)};\n  gl_FragColor.a = 0.0;`);
      };
      m.customProgramCacheKey = () => 'arrow-display';
    }
    const head = new THREE.Mesh(arrow.head, headMat);
    head.position.set(arrow.headPos.x, arrow.headPos.y, layout.arrowZ);
    head.rotation.z = arrow.headAngle;
    head.castShadow = true;
    chart.add(body, head);

    // coloured glow on the floor under the arrow
    const glowMat = new THREE.MeshBasicMaterial({map: bandTexture(), color: new THREE.Color(preset.arrow), opacity: 0.035, clippingPlanes: [clip]});
    keepAlpha(glowMat, true);
    const glowLen = arrow.tipX - arrow.startX + 0.6;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(glowLen, 3.4), glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.set((arrow.tipX + arrow.startX) / 2, 0.004, layout.arrowZ + 0.5);
    glow.renderOrder = 2;

    // soft contact shadow under the whole chart (grounds the bars)
    const aoMat = new THREE.MeshBasicMaterial({map: bandTexture(), color: new THREE.Color('#0d1730'), opacity: 0.32});
    keepAlpha(aoMat);
    const ao = new THREE.Mesh(new THREE.PlaneGeometry(LOOK.barSpacing * layout.heights.length + 1.2, 3.2), aoMat);
    ao.rotation.x = -Math.PI / 2;
    ao.position.y = 0.003;
    ao.renderOrder = 1;
    glowHolderAo.add(ao);

    // floor
    const reflRt = new THREE.WebGLRenderTarget(1, 1, {type: THREE.HalfFloatType});
    const floorUniforms = {
      uNear: {value: srgb(FLOOR_NEAR)},
      uFar: {value: srgb(FLOOR_FAR)},
      uCamPos: {value: new THREE.Vector3()},
      uGradStart: {value: layout.distance * 1.7},
      uGradEnd: {value: layout.distance * 3.6},
      uFade: {value: 0},
      uRefl: {value: reflRt.texture},
      uRes: {value: new THREE.Vector2(1, 1)},
      uReflStrength: {value: 0.04},
      uReflBlur: {value: 2},
      uExposure: {value: 0.42},
      uLines: {value: FLOOR_LINES},
      uLineWidth: {value: 0.022},
      uSpeckCell: {value: 1.3},
    };
    const floorMat = new THREE.ShaderMaterial({vertexShader: floorVertex, fragmentShader: floorFragment, uniforms: floorUniforms, glslVersion: THREE.GLSL3});
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.renderOrder = -2;

    // contact / key-light shadow
    const shadowMat = new THREE.ShadowMaterial({color: new THREE.Color('#1a2a46'), opacity: 0.18});
    keepAlpha(shadowMat);
    shadowMat.polygonOffset = true;
    shadowMat.polygonOffsetFactor = -4;
    shadowMat.polygonOffsetUnits = -4;
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), shadowMat);
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = 0.002;
    catcher.receiveShadow = true;
    catcher.renderOrder = -1;

    // key light from the upper left
    const key = new THREE.DirectionalLight('#ffffff', 1.1);
    key.position.set(-9, 26, 15);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.left = -11;
    sc.right = 11;
    sc.top = 11;
    sc.bottom = -11;
    sc.near = 5;
    sc.far = 70;
    sc.updateProjectionMatrix();
    key.shadow.bias = -0.0004;

    // backdrop dome
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(300, 48, 24),
      new THREE.ShaderMaterial({vertexShader: skyVertex, fragmentShader: skyFragment, side: THREE.BackSide, glslVersion: THREE.GLSL3, depthWrite: false, uniforms: {uHorizon: {value: srgb(FLOOR_FAR)}, uTop: {value: srgb(SKY_TOP)}}}),
    );
    sky.renderOrder = -3;
    sky.frustumCulled = false;

    const root = new THREE.Group();
    const glowHolder = glowHolderAo; // same transform as the chart, but not mirrored
    glowHolder.add(glow);
    root.add(sky, floor, catcher, glowHolder, mirrored, key, key.target);
    return {root, sky, mirrored, floor, catcher, glow, bars, body, head, clip, arrow, glint, floorUniforms, reflRt, arrowMat, headMat};
  }, [row, dir, flagImg, layout]);

  useMemo(() => {
    scene.environment = hdri;
    scene.environmentIntensity = 0.75;
    scene.environmentRotation.set(0, THREE.MathUtils.degToRad(140), 0);
    scene.background = null;
    gl.localClippingEnabled = true;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.BasicShadowMap; // PCSS needs the raw depth sampler
    gl.debug.checkShaderErrors = true;
    gl.debug.onShaderError = (ctx, program, vs, fs) => {
      cancelRender(new Error(`Shader compile error: ${ctx.getProgramInfoLog(program)} ${ctx.getShaderInfoLog(vs)} ${ctx.getShaderInfoLog(fs)}`));
    };
  }, [scene, gl, hdri]);

  useEffect(() => {
    scene.add(objs.root);
    return () => {
      scene.remove(objs.root);
    };
  }, [scene, objs]);
  if (!objs.root.parent) scene.add(objs.root);

  // ---------------------------------------------------------------- render targets + post
  const post = useMemo(() => {
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(1, Math.round(buf.x));
    const h = Math.max(1, Math.round(buf.y));
    objs.reflRt.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    objs.floorUniforms.uRes.value.set(w, h);
    objs.floorUniforms.uReflBlur.value = h * 0.018;
    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.FloatType;
    const rt = new THREE.WebGLRenderTarget(w, h, {type: THREE.HalfFloatType, format: THREE.RGBAFormat, samples: 4, depthTexture, depthBuffer: true});
    const uniforms = {
      tColor: {value: rt.texture},
      tDepth: {value: depthTexture},
      uRes: {value: new THREE.Vector2(w, h)},
      uNear: {value: 0.5},
      uFar: {value: 500},
      uFocusNear: {value: 0},
      uFocusFar: {value: 0},
      uFarRange: {value: layout.distance * 0.35},
      uNearRange: {value: layout.distance * 0.15},
      uMaxCoc: {value: h * 0.003},
      uExposure: {value: 0.42},
      uFrame: {value: 0},
      uFlare: {value: 0},
      uFlarePos: {value: new THREE.Vector2(0.2, 1.06)},
      uGrain: {value: 0.0075}, // ±0.75% = 1.5% peak to peak
      uVignette: {value: 0.1},
      uFadeIn: {value: 0},
      uFadeColor: {value: srgb(FLOOR_FAR)},
    };
    const mat = new THREE.ShaderMaterial({vertexShader: postVertex, fragmentShader: postFragment, uniforms, glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false});
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const quad = new THREE.Mesh(tri, mat);
    quad.frustumCulled = false;
    const postScene = new THREE.Scene();
    postScene.add(quad);
    return {rt, uniforms, postScene, postCam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)};
  }, [gl, layout, objs, size.width, size.height]);

  useEffect(
    () => () => {
      post.rt.dispose();
      objs.reflRt.dispose();
    },
    [post, objs],
  );

  // ---------------------------------------------------------------- per-frame
  const renderFrame = () => {
    const f = frameRef.current;
    const a = animate(f);
    const cam = camera as THREE.PerspectiveCamera;
    const {pos, target} = cameraPose(f, layout.target, layout.distance);
    cam.fov = LOOK.fov;
    cam.near = 0.5;
    cam.far = 500;
    cam.aspect = size.width / size.height;
    cam.position.copy(pos);
    cam.lookAt(target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);

    objs.bars.forEach((b, i) => b.scale.set(1, Math.max(0.002, a.bars[i]), 1));
    const p = objs.arrow;
    // draw-on: keep the part of the arrow left of clipX (chart-local), as a world plane
    const clipX = p.startX + (p.headPos.x - p.startX) * a.draw;
    const along = chartToWorld(new THREE.Vector3(1, 0, 0));
    objs.clip.setFromNormalAndCoplanarPoint(along.clone().negate(), chartToWorld(new THREE.Vector3(clipX, 0, 0)));
    objs.body.visible = a.draw > 0;
    objs.glow.visible = a.draw > 0;
    objs.head.visible = a.head > 0;
    objs.head.scale.setScalar(Math.max(0.001, a.head));
    objs.glint.uGlintPos.value = a.glintPos;
    objs.glint.uGlintStrength.value = a.glintStrength;
    objs.floorUniforms.uFade.value = a.fade;
    objs.floorUniforms.uCamPos.value.copy(pos);
    const band = focusBand(layout, pos);
    post.uniforms.uFocusNear.value = band.near;
    post.uniforms.uFocusFar.value = band.far;
    post.uniforms.uFrame.value = f;
    post.uniforms.uFlare.value = 0.3;
    post.uniforms.uFadeIn.value = a.fade;

    // 1. mirror pass (no floor, no shadow update)
    objs.floor.visible = false;
    objs.catcher.visible = false;
    objs.sky.visible = false;
    const glowVis = objs.glow.visible;
    objs.glow.visible = false;
    objs.mirrored.scale.y = -1;
    gl.shadowMap.autoUpdate = false;
    gl.setRenderTarget(objs.reflRt);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, true);
    gl.render(scene, cam);
    objs.mirrored.scale.y = 1;
    objs.floor.visible = true;
    objs.catcher.visible = true;
    objs.sky.visible = true;
    objs.glow.visible = glowVis;
    gl.shadowMap.autoUpdate = true;
    gl.shadowMap.needsUpdate = true;

    // 2. main pass
    gl.setRenderTarget(post.rt);
    gl.setClearColor(FLOOR_FAR, 0);
    gl.clear(true, true, true);
    gl.render(scene, cam);
    // 3. final pass
    gl.setRenderTarget(null);
    gl.render(post.postScene, post.postCam);
  };

  // R3F swallows exceptions thrown inside the frame loop; fail the render loudly instead.
  useFrame(() => {
    try {
      renderFrame();
    } catch (e) {
      cancelRender(e);
    }
  }, 1);

  return null;
};
