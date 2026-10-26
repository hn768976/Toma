import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { buildCluster } from "./cluster";
import { createCocTileMaterial, createDofMaterial, createTileDilateMaterial } from "./dof";
import { SCENES, type SceneId } from "./scenes";
import type { SceneSpec, Shot } from "./types";

type Ctx = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rings: THREE.Mesh[];
  flow: THREE.Group;
  tilt: THREE.Group;
  rt: THREE.WebGLRenderTarget;
  post: THREE.Scene;
  postQuad: THREE.Mesh;
  postCam: THREE.Camera;
  dof: THREE.ShaderMaterial;
  tileMat: THREE.ShaderMaterial;
  dilateMat: THREE.ShaderMaterial;
  tileRt: THREE.WebGLRenderTarget;
  dilateRt: THREE.WebGLRenderTarget;
  tileSize: number;
  dispose: () => void;
};

const hexColor = (hex: string) => new THREE.Color(hex); // sRGB hex -> linear

const makeGradientTexture = (top: string, bottom: string) => {
  const size = 256;
  const data = new Uint8Array(size * 4);
  const a = new THREE.Color().setStyle(top, THREE.SRGBColorSpace);
  const b = new THREE.Color().setStyle(bottom, THREE.SRGBColorSpace);
  const c = new THREE.Color();
  for (let i = 0; i < size; i++) {
    // Row 0 is the bottom of the frame.
    c.copy(b).lerp(a, i / (size - 1));
    const rgb = c.getRGB(new THREE.Color(), THREE.SRGBColorSpace);
    data[i * 4] = Math.round(rgb.r * 255);
    data[i * 4 + 1] = Math.round(rgb.g * 255);
    data[i * 4 + 2] = Math.round(rgb.b * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, 1, size);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
};

const setup = (canvas: HTMLCanvasElement, spec: SceneSpec, width: number, height: number): Ctx => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.NoToneMapping;

  const { look } = spec;
  const scene = new THREE.Scene();
  scene.background = makeGradientTexture(look.background.top, look.background.bottom);
  if (look.fog) scene.fog = new THREE.Fog(hexColor(look.fog.color), look.fog.near, look.fog.far);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  if (look.envTint) {
    // Tint the studio's walls and light panels so reflections (and Fresnel
    // rims) take the look's colour instead of neutral white.
    const tint = hexColor(look.envTint);
    room.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      mat.color?.multiply(tint);
      mat.emissive?.multiply(tint);
      mesh.material = mat;
    });
  }
  const envTex = pmrem.fromScene(room, 0.04).texture;
  // A zero-intensity look gets no environment at all (Fresnel would still
  // pick up its colour at grazing angles).
  if (look.material.envIntensity > 0) scene.environment = envTex;
  scene.environmentRotation.set(...look.envRotation);
  pmrem.dispose();

  const colors = {
    start: hexColor(look.colors.start),
    mid: hexColor(look.colors.mid),
    end: hexColor(look.colors.end),
    cap: hexColor(look.colors.cap),
    startCap: hexColor(look.colors.startCap),
    shade: hexColor(look.colors.shade),
    gradient: look.colors.gradient,
  };
  const geometries = buildCluster(spec.cluster, colors);
  const m = look.material;
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: m.roughness,
    metalness: m.metalness,
    clearcoat: m.clearcoat,
    clearcoatRoughness: m.clearcoatRoughness,
    iridescence: m.iridescence,
    iridescenceIOR: m.iridescenceIOR,
    iridescenceThicknessRange: [200, 600],
    envMapIntensity: m.envIntensity,
  });
  if (m.specularColor) material.specularColor = hexColor(m.specularColor);
  const fogMax = (look.fog?.max ?? 1).toFixed(4);
  const [fadeA, fadeB] = (look.fog?.nearFade ?? [-2, -1]).map((v) => v.toFixed(4));
  const shade = hexColor(look.colors.shade);
  const glslColor = (c: THREE.Color) =>
    `vec3(${c.r.toFixed(5)}, ${c.g.toFixed(5)}, ${c.b.toFixed(5)})`;
  const shadeGlsl = glslColor(shade);
  // Rings fade in from the backdrop colour, so they appear out of nothing.
  const backdropGlsl = glslColor(hexColor(look.background.bottom));
  // Each ring gets its own material so the flow can fade it in from the
  // backdrop (uRing.x) and sink it into the shade colour (uRing.y) as a
  // function of its flow index.
  const ringMaterial = () => {
    const mat = material.clone();
    const ring = { value: new THREE.Vector2(1, 0) };
    mat.userData.ring = ring;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uRing = ring;
      shader.fragmentShader =
        "uniform vec2 uRing;\n" +
        shader.fragmentShader.replace(
          "#include <fog_fragment>",
          `gl_FragColor.rgb = mix(
            ${backdropGlsl},
            mix(gl_FragColor.rgb, ${shadeGlsl}, uRing.y),
            uRing.x
          );
          #ifdef USE_FOG
            float fogFactor = ${fogMax} * smoothstep(fogNear, fogFar, vFogDepth);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
            // Near fade goes to pure black (the background), not the fog tint.
            gl_FragColor.rgb *= smoothstep(${fadeA}, ${fadeB}, vFogDepth);
          #endif`,
        );
    };
    return mat;
  };
  const ringMaterials = geometries.map(() => {
    const mat = ringMaterial();
    if (spec.motion.flow?.ringFade) mat.transparent = true;
    return mat;
  });
  const rings = geometries.map((g, i) => new THREE.Mesh(g, ringMaterials[i]));

  const tilt = new THREE.Group();
  // Rings share one group so a helical flow can move them together.
  const flow = new THREE.Group();
  flow.add(...rings);
  tilt.add(flow);
  // Hook clusters grow out of a core sphere that hides the tubes' roots.
  let core: THREE.Mesh | null = null;
  if (spec.cluster.kind === "hook" && spec.cluster.coreVisible !== false) {
    core = new THREE.Mesh(
      new THREE.SphereGeometry(spec.cluster.coreRadius, 96, 64),
      new THREE.MeshPhysicalMaterial({
        color: colors.start,
        roughness: spec.cluster.coreMatte ? 1 : m.roughness,
        metalness: spec.cluster.coreMatte ? 0 : m.metalness,
        clearcoat: spec.cluster.coreMatte ? 0 : m.clearcoat,
        clearcoatRoughness: m.clearcoatRoughness,
        iridescence: m.iridescence,
        iridescenceIOR: m.iridescenceIOR,
        envMapIntensity: m.envIntensity,
      }),
    );
    tilt.add(core);
  }
  const root = new THREE.Group();
  root.position.set(...spec.motion.center);
  root.rotation.set(...spec.motion.orientation);
  root.add(tilt);
  scene.add(root);

  scene.add(new THREE.AmbientLight(hexColor(look.lights.ambient.color), look.lights.ambient.intensity));
  for (const l of look.lights.directional) {
    const d = new THREE.DirectionalLight(hexColor(l.color), l.intensity);
    d.position.set(...l.direction);
    scene.add(d);
  }
  if (look.lights.area?.length) {
    RectAreaLightUniformsLib.init();
    for (const l of look.lights.area) {
      const a = new THREE.RectAreaLight(hexColor(l.color), l.intensity, l.size[0], l.size[1]);
      a.position.set(...l.position);
      a.lookAt(...l.lookAt);
      scene.add(a);
    }
  }

  const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 200);

  const depthTexture = new THREE.DepthTexture(width, height);
  depthTexture.type = THREE.UnsignedIntType;
  const rt = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    samples: 4,
    depthTexture,
    depthBuffer: true,
  });
  rt.texture.minFilter = THREE.LinearFilter;
  rt.texture.magFilter = THREE.LinearFilter;

  const dof = createDofMaterial();
  dof.uniforms.texel.value.set(1 / width, 1 / height);
  const post = new THREE.Scene();
  const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dof);
  post.add(postQuad);
  const postCam = new THREE.Camera();

  // Tile buffers bounding how far the bokeh gather has to reach per pixel.
  const tileSize = Math.max(8, Math.round((16 * height) / 1080));
  const tw = Math.ceil(width / tileSize);
  const th = Math.ceil(height / tileSize);
  const makeTileRt = () => {
    const t = new THREE.WebGLRenderTarget(tw, th, { type: THREE.HalfFloatType, depthBuffer: false });
    t.texture.minFilter = THREE.NearestFilter;
    t.texture.magFilter = THREE.NearestFilter;
    return t;
  };
  const tileRt = makeTileRt();
  const dilateRt = makeTileRt();
  const tileMat = createCocTileMaterial();
  tileMat.uniforms.srcSize.value.set(width, height);
  tileMat.uniforms.tile.value = tileSize;
  const dilateMat = createTileDilateMaterial();
  dilateMat.uniforms.tileTexel.value.set(1 / tw, 1 / th);

  return {
    renderer,
    scene,
    camera,
    rings,
    flow,
    tilt,
    rt,
    post,
    postQuad,
    postCam,
    dof,
    tileMat,
    dilateMat,
    tileRt,
    dilateRt,
    tileSize,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      core?.geometry.dispose();
      material.dispose();
      ringMaterials.forEach((r) => r.dispose());
      envTex.dispose();
      rt.dispose();
      dof.dispose();
      tileMat.dispose();
      dilateMat.dispose();
      tileRt.dispose();
      dilateRt.dispose();
      renderer.dispose();
    },
  };
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Remotion's --scale sets the page's devicePixelRatio. The WebGL backing store
// follows it, so a 4K composition renders natively at 4K (scale 1) or at
// 1080p (scale 0.5) with identical framing, blur and timing.
const renderScale = () =>
  typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);

type Props = {
  scene: SceneId;
  debug?: "raw" | "depth";
  // Look-development only: JSON overrides merged over the scene spec.
  tweak?: {
    motion?: Partial<SceneSpec["motion"]>;
    shot?: Partial<Shot>;
    cluster?: Partial<SceneSpec["cluster"]>;
  };
};

export const TubeBloom: React.FC<Props> = ({ scene, debug, tweak }) => {
  const spec = useMemo<SceneSpec>(() => {
    const base = SCENES[scene];
    if (!tweak) return base;
    return {
      ...base,
      motion: { ...base.motion, ...tweak.motion, flow: tweak.motion && "flow" in tweak.motion ? tweak.motion.flow ?? undefined : base.motion.flow },
      cluster: { ...base.cluster, ...tweak.cluster },
      shot: (f, fps) => ({ ...base.shot(f, fps), ...tweak.shot }),
    };
  }, [scene, tweak]);
  const frame = useCurrentFrame();
  const { width: compWidth, height: compHeight, fps } = useVideoConfig();
  const [scale] = useState(renderScale);
  const width = Math.round(compWidth * scale);
  const height = Math.round(compHeight * scale);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<Ctx | null>(null);
  const [handle] = useState(() => delayRender("Initialising Three.js scene"));

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ctxRef.current = setup(canvas, spec, width, height);
    continueRender(handle);
    return () => {
      ctxRef.current?.dispose();
      ctxRef.current = null;
    };
  }, [spec, width, height, handle]);

  useLayoutEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { motion } = spec;
    const cycle = (frame / motion.loopFrames) * Math.PI * 2;
    if (motion.flow) {
      const { spacing, phaseStep, count, extraTurns, spacingsPerLoop, scaleRatio, frontRings } =
        motion.flow;
      const cycles = frame / motion.loopFrames;
      const shifts = cycles * spacingsPerLoop;
      const frac = shifts - Math.floor(shifts);
      const step = (Math.PI * 2) / count;
      // Exponential horn: a ring at continuous index u sits at depth
      // -spacing * (1 - g^u) / (1 - g) and is scaled by g^u. Rings slide
      // inward one index per shift while shrinking; at frac -> 1 every ring
      // lands exactly on its neighbour's frac = 0 pose, so the wrap is
      // invisible. Front rings (u < 0) are large and outside the frame.
      const g = scaleRatio;
      ctx.rings.forEach((ring, i) => {
        const u = i - frontRings + frac;
        const k = Math.pow(g, u);
        ring.scale.setScalar(k);
        ring.position.y = g === 1 ? -spacing * u : (-spacing * (1 - k)) / (1 - g);
        // rotation.y = +θ maps azimuth φ to φ - θ, hence the minus: ring i
        // turns onto ring i+1's helix phase as it slides into its place.
        ring.rotation.y = -step * phaseStep * frac;
        if (motion.flow?.ringFade) {
          const { fadeIn, sink, sinkMax } = motion.flow.ringFade;
          const mat = ring.material as THREE.Material;
          const uniform = mat.userData.ring.value as THREE.Vector2;
          const fade = smooth(fadeIn[0], fadeIn[1], u);
          uniform.set(1, sinkMax * smooth(sink[0], sink[1], u));
          // Fade in with real transparency: a ring mixed towards the backdrop
          // would still occlude the bright rings behind it and read as a
          // dark flash.
          // (Flow ring materials are permanently `transparent`: toggling that
          // flag per frame would not recompile the shader, which keeps
          // writing opaque alpha.)
          // Blending happens in linear light, so ramp alpha on a gamma curve
          // to make the fade read as even once encoded to sRGB.
          ring.visible = fade > 0.002;
          mat.opacity = Math.pow(fade, 2.4);
          mat.depthWrite = fade >= 0.999;
        }
      });
      // Whole extra tube spacings of spin per loop are free to go either way.
      ctx.flow.rotation.y = motion.spinDirection * step * extraTurns * cycles;
    } else {
      // Each ring advances a whole number of its tube spacings per loop.
      ctx.rings.forEach((ring, i) => {
        ring.rotation.y =
          (motion.spinDirection * cycle * (motion.spins ?? 1)) / spec.cluster.rings[i].count;
      });
    }
    ctx.tilt.rotation.x = motion.wobble[0] * Math.sin(cycle);
    ctx.tilt.rotation.z = motion.wobble[1] * Math.cos(cycle);

    const shot = spec.shot(frame, fps);
    const cam = ctx.camera;
    cam.fov = shot.fov;
    cam.position.set(...shot.position);
    cam.up.set(...(shot.up ?? [0, 1, 0]));
    cam.lookAt(new THREE.Vector3(...shot.target));
    cam.updateProjectionMatrix();

    ctx.renderer.setRenderTarget(ctx.rt);
    ctx.renderer.render(ctx.scene, cam);
    ctx.renderer.setRenderTarget(null);

    // Blur sizes are authored relative to frame height so 4K and 1080p match.
    const cocParams = {
      cameraNear: cam.near,
      cameraFar: cam.far,
      focusDistance: shot.focusDistance,
      cocScale: shot.aperture * height,
      maxBlur: shot.maxBlur * height,
    };
    const setCoc = (mat: THREE.ShaderMaterial) => {
      for (const [k, v] of Object.entries(cocParams)) mat.uniforms[k].value = v;
    };
    const runPass = (mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      ctx.postQuad.material = mat;
      ctx.renderer.setRenderTarget(target);
      ctx.renderer.render(ctx.post, ctx.postCam);
    };
    setCoc(ctx.tileMat);
    ctx.tileMat.uniforms.tDepth.value = ctx.rt.depthTexture;
    runPass(ctx.tileMat, ctx.tileRt);
    ctx.dilateMat.uniforms.tTile.value = ctx.tileRt.texture;
    ctx.dilateMat.uniforms.reach.value = Math.min(8, Math.ceil(cocParams.maxBlur / ctx.tileSize));
    runPass(ctx.dilateMat, ctx.dilateRt);

    const u = ctx.dof.uniforms;
    const { look } = spec;
    setCoc(ctx.dof);
    u.tColor.value = ctx.rt.texture;
    u.tDepth.value = ctx.rt.depthTexture;
    u.tTile.value = ctx.dilateRt.texture;
    u.radScale.value = Math.max(1, (height / 1080) * spec.quality.radScale1080);
    u.exposure.value = look.exposure;
    u.knee.value = look.knee;
    u.vignette.value = look.vignette;
    u.grain.value = look.grain;
    u.frame.value = frame;
    u.debugMode.value = debug === "raw" ? 1 : debug === "depth" ? 2 : 0;
    runPass(ctx.dof, null);
    ctx.renderer.getContext().finish();
  }, [frame, fps, spec, height, debug]);

  return (
    <AbsoluteFill style={{ backgroundColor: spec.look.background.bottom }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
