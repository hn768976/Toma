// The 3D scene: floor, extruded map tile, shadow, label, light, and a custom
// render loop (scene -> HDR multisampled target -> final pass to screen).
// All per-frame values are derived from the frame passed in props and applied
// inside the render callback, right before drawing.
import {useFrame, useThree} from '@react-three/fiber';
import React, {useEffect, useMemo, useRef} from 'react';
import {cancelRender} from 'remotion';
import * as THREE from 'three';
import type {Row} from '../data/rows';
import type {ShapeData} from '../geo/buildShape';
import {animate, cameraPose, computeLayout, LOOK} from './layout';
import {addGlint, floorFragment, floorVertex, postFragment, postVertex} from './shaders';
import {makeDotsTexture, makeLabelTexture, makeTopTexture, sideColor} from './textures';
import type {Dots} from './assets';

// Floor look (display sRGB). Albedo #E6E9EE under a cool studio light.
const FLOOR_ALBEDO = new THREE.Color('#E6E9EE');
const FLOOR_LIGHT = [0.845, 0.862, 0.895];
const HAZE = new THREE.Color('#D3D8E1');

const srgbArr = (c: THREE.Color) => {
  const o = {r: 0, g: 0, b: 0};
  c.getRGB(o, THREE.SRGBColorSpace);
  return o;
};

export type SceneProps = {
  row: Row;
  shape: ShapeData;
  flagImg: HTMLImageElement | null;
  hdri: THREE.Texture;
  dots: Dots;
  frame: number;
};

const buildGeometry = (shape: ShapeData, depth: number) => {
  const shapes = shape.polygons.map((poly) => {
    const s = new THREE.Shape(poly[0].map(([x, y]) => new THREE.Vector2(x, y)));
    for (const hole of poly.slice(1)) s.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
    return s;
  });
  const minX = -shape.w / 2;
  const minY = -shape.h / 2;
  const uv = {
    generateTopUV: (g: THREE.ExtrudeGeometry, v: number[], a: number, b: number, c: number) =>
      [a, b, c].map((i) => new THREE.Vector2((v[i * 3] - minX) / shape.w, (v[i * 3 + 1] - minY) / shape.h)),
    generateSideWallUV: () => [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()],
  };
  // No geometric bevel: three's bevel offsets explode into spikes at the very
  // sharp concave vertices real coastlines have (fjords, narrow straits). The
  // bevel's catch-light is painted into the top texture instead (textures.ts).
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth,
    steps: 1,
    curveSegments: 1,
    bevelEnabled: false,
    UVGenerator: uv as unknown as THREE.UVGenerator,
  });
  geo.computeBoundingBox();
  return {geo, bevelThickness: 0};
};

export const FlagMapScene: React.FC<SceneProps> = ({row, shape, flagImg, hdri, dots, frame}) => {
  const {gl, scene, camera, size} = useThree();
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const layout = useMemo(() => computeLayout(shape, size.width / size.height), [shape, size.width, size.height]);

  // ---------------------------------------------------------------- objects (built once)
  const objs = useMemo(() => {
    const {geo, bevelThickness} = buildGeometry(shape, layout.depth);
    const glint = {uGlintPos: {value: -1}, uGlintStrength: {value: 0}};
    const topMat = new THREE.MeshPhysicalMaterial({
      map: makeTopTexture(row, shape, flagImg),
      roughness: 0.5,
      metalness: 0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.6,
    });
    addGlint(topMat, glint);
    // Sides: matte, darker shade of the main colour. A self-lit term keeps them a
    // rich dark colour (as in the reference) instead of falling into ACES' toe.
    const sideMat = new THREE.MeshStandardMaterial({color: sideColor(row), emissive: sideColor(row), emissiveIntensity: 1.3, roughness: 1, metalness: 0, envMapIntensity: 0.25});
    const mesh = new THREE.Mesh(geo, [topMat, sideMat]);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.position.z = bevelThickness;
    const lift = new THREE.Group(); // scaled on local z for the rise
    lift.rotation.x = -Math.PI / 2;
    lift.add(mesh);
    const shapeGroup = new THREE.Group();
    shapeGroup.scale.setScalar(layout.scale);
    shapeGroup.add(lift);

    // floor
    const base = srgbArr(FLOOR_ALBEDO);
    const haze = srgbArr(HAZE);
    const visW = 2 * LOOK.distance * Math.tan(THREE.MathUtils.degToRad(LOOK.fov / 2)) * (size.width / size.height);
    const unitsPerDeg = visW / (95 * dots.step); // ~95 dots across the frame
    const floorUniforms = {
      uBase: {value: new THREE.Vector3(base.r * FLOOR_LIGHT[0], base.g * FLOOR_LIGHT[1], base.b * FLOOR_LIGHT[2])},
      uHaze: {value: new THREE.Vector3(haze.r, haze.g, haze.b)},
      uCamPos: {value: new THREE.Vector3()},
      uHazeStart: {value: LOOK.distance * 1.5},
      uHazeEnd: {value: LOOK.distance * 5},
      uFade: {value: 0},
      uDots: {value: makeDotsTexture(dots.cols, dots.rows, dots.mask)},
      uDotsSize: {value: new THREE.Vector2(dots.cols, dots.rows)},
      uDegStep: {value: dots.step},
      // the far floor (top of frame) shows latitudes north of the origin: keep land there
      uMapOrigin: {value: new THREE.Vector2(shape.center[0], Math.max(-35, Math.min(22, shape.center[1])))},
      uUnitsPerDeg: {value: unitsPerDeg},
      uDotRadius: {value: dots.step * unitsPerDeg * 0.3},
      uDotDarken: {value: 0.075},
      uMajor: {value: visW / 9.5},
      uMinor: {value: visW / 9.5 / 4},
      uMajorWidth: {value: visW * 0.0019},
      uMinorWidth: {value: visW * 0.0008},
      uMajorAlpha: {value: 0.24},
      uMinorAlpha: {value: 0.06},
      uDepthDim: {value: 0.025},
    };
    const floorMat = new THREE.ShaderMaterial({
      vertexShader: floorVertex,
      fragmentShader: floorFragment,
      uniforms: floorUniforms,
      glslVersion: THREE.GLSL3,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.renderOrder = -2;

    // Blending that keeps the destination alpha (the "display-referred" mask).
    const keepAlpha = (m: THREE.Material) => {
      m.transparent = true;
      m.depthWrite = false;
      m.blending = THREE.CustomBlending;
      m.blendEquation = THREE.AddEquation;
      m.blendSrc = THREE.SrcAlphaFactor;
      m.blendDst = THREE.OneMinusSrcAlphaFactor;
      m.blendSrcAlpha = THREE.ZeroFactor;
      m.blendDstAlpha = THREE.OneFactor;
    };
    const shadowMat = new THREE.ShadowMaterial({color: new THREE.Color('#101a30'), opacity: 0.55});
    keepAlpha(shadowMat);
    shadowMat.polygonOffset = true;
    shadowMat.polygonOffsetFactor = -4;
    shadowMat.polygonOffsetUnits = -4;
    const shadowSize = layout.scale * 3;
    const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(shadowSize, shadowSize), shadowMat);
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = 0.0005;
    shadowCatcher.receiveShadow = true;
    shadowCatcher.renderOrder = -1;

    // label
    const lab = makeLabelTexture(row.label);
    let em = layout.labelHeight;
    if (lab.inkWidthPerEm * em > layout.labelMaxWidth) em = layout.labelMaxWidth / lab.inkWidthPerEm;
    const labelMat = new THREE.MeshBasicMaterial({map: lab.tex, color: '#ffffff', opacity: 0});
    keepAlpha(labelMat);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(lab.widthPerEm * em, lab.heightPerEm * em), labelMat);
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, 0.002, layout.labelZ);
    label.renderOrder = 1;

    // key light from the upper left (behind-left of the shape)
    const key = new THREE.DirectionalLight('#ffffff', 0.55);
    const lightDir = new THREE.Vector3(-0.42, 1.0, -0.36).normalize();
    key.position.copy(lightDir.clone().multiplyScalar(layout.scale * 4));
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.left = -layout.scale * 0.8;
    sc.right = layout.scale * 0.8;
    sc.top = layout.scale * 0.8;
    sc.bottom = -layout.scale * 0.8;
    sc.near = layout.scale * 1;
    sc.far = layout.scale * 8;
    sc.updateProjectionMatrix();
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.0;

    const root = new THREE.Group();
    root.add(floor, shadowCatcher, shapeGroup, label, key, key.target);
    return {root, lift, glint, floorUniforms, labelMat, label, labelEm: em, topMat};
  }, [row, shape, flagImg, dots, layout, size.width, size.height]);

  // ---------------------------------------------------------------- scene setup
  useMemo(() => {
    scene.environment = hdri;
    scene.environmentIntensity = 0.55;
    scene.environmentRotation.set(0, THREE.MathUtils.degToRad(200), 0);
    scene.background = null;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.BasicShadowMap; // PCSS needs the raw depth sampler
    gl.shadowMap.autoUpdate = true;
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
  // Add synchronously as well, so the very first render already contains it.
  if (!objs.root.parent) scene.add(objs.root);

  // ---------------------------------------------------------------- render targets + post
  const post = useMemo(() => {
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(1, Math.round(buf.x));
    const h = Math.max(1, Math.round(buf.y));
    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.FloatType;
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      samples: 4,
      depthTexture,
      depthBuffer: true,
    });
    const uniforms = {
      tColor: {value: rt.texture},
      tDepth: {value: depthTexture},
      uRes: {value: new THREE.Vector2(w, h)},
      uNear: {value: 1},
      uFar: {value: 500},
      uFocusNear: {value: layout.focusNear},
      uFocusFar: {value: layout.focusFar},
      uFarRange: {value: LOOK.distance * 0.07},
      uNearRange: {value: LOOK.distance * 0.04},
      uMaxCoc: {value: h * 0.0095},
      uExposure: {value: 0.27},
      uFrame: {value: 0},
      uFlare: {value: 0},
      uFlarePos: {value: new THREE.Vector2(0.5, 1.02)},
      uGrain: {value: 0.0075}, // ±0.75% = 1.5% peak to peak
      uVignette: {value: 0.06},
    };
    const mat = new THREE.ShaderMaterial({vertexShader: postVertex, fragmentShader: postFragment, uniforms, glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false});
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const quad = new THREE.Mesh(tri, mat);
    quad.frustumCulled = false;
    const postScene = new THREE.Scene();
    postScene.add(quad);
    const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return {rt, uniforms, postScene, postCam};
  }, [gl, layout, size.width, size.height]);

  useEffect(() => () => post.rt.dispose(), [post]);

  // ---------------------------------------------------------------- per-frame
  // R3F swallows exceptions thrown inside the frame loop; fail the render loudly instead.
  useFrame(() => {
    try {
      renderFrame();
    } catch (e) {
      cancelRender(e);
    }
  }, 1);
  const renderFrame = () => {
    const f = frameRef.current;
    const a = animate(f);
    const cam = camera as THREE.PerspectiveCamera;
    const {pos, target} = cameraPose(f, layout.targetZ);
    cam.fov = LOOK.fov;
    cam.near = 1;
    cam.far = 500;
    cam.aspect = size.width / size.height;
    cam.position.copy(pos);
    cam.lookAt(target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);

    objs.lift.scale.set(1, 1, a.rise);
    objs.glint.uGlintPos.value = a.glintPos;
    objs.glint.uGlintStrength.value = a.glintStrength;
    objs.floorUniforms.uFade.value = a.fade;
    objs.floorUniforms.uCamPos.value.copy(pos);
    objs.labelMat.opacity = a.label;
    objs.label.position.z = layout.labelZ + (1 - a.label) * objs.labelEm * 0.9;

    post.uniforms.uFrame.value = f;
    post.uniforms.uFlare.value = a.flare;

    gl.setRenderTarget(post.rt);
    gl.setClearColor(HAZE, 0);
    gl.clear(true, true, true);
    gl.render(scene, cam);
    gl.setRenderTarget(null);
    gl.render(post.postScene, post.postCam);
  };

  return null;
};
