import React, { useCallback } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { lin } from "../../lib/color";
import { LOOP_FRAMES } from "../../lib/loop";
import { mulberry32 } from "../../lib/random";
import { PostFX } from "../../lib/three/post";
import { ThreeStage } from "../../lib/three/ThreeStage";

export type GlassVersion = {
  id: string;
  tint: string; // glass body
  edge: string; // edge glow
  strips: [string, string]; // env strip lights: key (cool) and rim
  iridescence: [number, number]; // thin-film thickness range, nm
  sheen: string; // colour of the broad reflection sheen
  bodyGlow: number;
  edgeGlow: number;
};

// Geometry, in spiral units.
const PLATE_LEN = 1.0; // radial
const PLATE_WID = 0.75; // tangential (3:4)
const PLATE_THK = PLATE_LEN * 0.028;
const HOLE_R = 0.0; // blades converge to a point
const D_THETA = THREE.MathUtils.degToRad(14);
const D_AXIAL = 0.045;
const TILT = THREE.MathUtils.degToRad(30);
const K_ADVANCE = 8; // plates advanced per loop (screw motion)
const SLOTS = 60;
const SEED = 1103459371;

// Fade by position along the spiral; zero outside [K_ADVANCE, SLOTS - 1] so the
// set of visible plates maps onto itself when every plate has moved K slots.
const fadeAt = (s: number) => {
  const a = THREE.MathUtils.smoothstep(s, K_ADVANCE, K_ADVANCE + 5);
  // the far end of the spiral dissolves into the dark hole after ~1 turn
  const b = 1 - THREE.MathUtils.smoothstep(s, 17, 36);
  return a * b;
};

// Thin-film thickness and dust textures, seeded and built once.
const makeTextures = () => {
  const rng = mulberry32(SEED);
  const N = 256;
  // smooth value noise for the film thickness (green channel)
  const film = new Uint8Array(N * N * 4);
  const G = 9;
  const grid = Array.from({ length: (G + 1) * (G + 1) }, () => rng());
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const fx = (x / N) * G;
      const fy = (y / N) * G;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const g = (i: number, j: number) => grid[j * (G + 1) + i];
      const v =
        g(ix, iy) * (1 - sx) * (1 - sy) + g(ix + 1, iy) * sx * (1 - sy) + g(ix, iy + 1) * (1 - sx) * sy + g(ix + 1, iy + 1) * sx * sy;
      // diagonal banding like stress lines in a thin film
      const band = 0.5 + 0.5 * Math.sin((x * 0.7 + y * 0.35) / N * 18 + v * 5);
      const k = (y * N + x) * 4;
      const val = Math.round(255 * Math.min(1, Math.max(0, v * 0.65 + band * 0.35)));
      film[k] = val;
      film[k + 1] = val;
      film[k + 2] = val;
      film[k + 3] = 255;
    }
  }
  const filmTex = new THREE.DataTexture(film, N, N);
  filmTex.wrapS = filmTex.wrapT = THREE.RepeatWrapping;
  filmTex.magFilter = THREE.LinearFilter;
  filmTex.minFilter = THREE.LinearFilter;
  filmTex.needsUpdate = true;

  const D = 512;
  const dust = new Float32Array(D * D);
  for (let i = 0; i < 160; i++) {
    const cx = rng() * D;
    const cy = rng() * D;
    const r = 0.6 + rng() * 1.6;
    const b = 0.3 + rng() * 0.7;
    for (let y = Math.floor(cy - 4); y <= cy + 4; y++) {
      for (let x = Math.floor(cx - 4); x <= cx + 4; x++) {
        if (x < 0 || y < 0 || x >= D || y >= D) continue;
        const d2 = ((x - cx) ** 2 + (y - cy) ** 2) / (r * r);
        dust[y * D + x] += b * Math.exp(-d2 * 1.5);
      }
    }
  }
  const dustBytes = new Uint8Array(D * D * 4);
  for (let i = 0; i < D * D; i++) {
    const v = Math.round(255 * Math.min(1, dust[i]));
    dustBytes[i * 4] = v;
    dustBytes[i * 4 + 1] = v;
    dustBytes[i * 4 + 2] = v;
    dustBytes[i * 4 + 3] = 255;
  }
  const dustTex = new THREE.DataTexture(dustBytes, D, D);
  dustTex.wrapS = dustTex.wrapT = THREE.RepeatWrapping;
  dustTex.magFilter = THREE.LinearFilter;
  dustTex.minFilter = THREE.LinearFilter;
  dustTex.needsUpdate = true;
  return { filmTex, dustTex };
};

// Dark room with two soft strip lights, prefiltered once with PMREM.
const makeEnv = (renderer: THREE.WebGLRenderer, v: GlassVersion) => {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0, 0, 0);
  const strip = (color: string, intensity: number, w: number, h: number, pos: [number, number, number]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: lin(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
    return m;
  };
  strip(v.strips[0], 16, 3.0, 0.12, [3.2, 2.8, -0.5]); // key strip, cool, upper right (glints on the edge-on blades)
  strip(v.strips[1], 12, 0.35, 8, [4.0, 0.5, 1.5]); // rim strip, right
  strip(v.sheen, 6.0, 4, 0.5, [3.0, -2.0, 1.0]); // sheen strip low right: rainbow glints on the blades
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.035);
  pmrem.dispose();
  return rt;
};

const createGlassScene = (v: GlassVersion) => (renderer: THREE.WebGLRenderer) => {
  const { filmTex, dustTex } = makeTextures();
  const envRT = makeEnv(renderer, v);
  const scene = new THREE.Scene();
  scene.environment = envRT.texture;

  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 40);
  const post = new PostFX(renderer, {
    bloomStrength: 0.1,
    bloomRadius: 0.6,
    bloomThreshold: 0,
    bloomKnee: 0,
    bloomTint: "#FFFFFF",
    exposure: 1,
    grain: 0.01,
    dither: true,
    whiteBurn: 0.6,
    levels: 6,
    dof: { focus: 1.0, range: 2.4, maxRadiusPx: 2.0 },
  });

  const bgTex: { value: THREE.Texture | null } = { value: null };
  const res = { value: new THREE.Vector2(1280, 720) };
  const geo = new RoundedBoxGeometry(PLATE_LEN, PLATE_WID, PLATE_THK, 2, PLATE_THK * 0.45);
  const edgeCol = lin(v.edge);
  const tintCol = lin(v.tint);

  const spiral = new THREE.Group();
  scene.add(spiral);

  type Plate = { mesh: THREE.Mesh; mat: THREE.MeshPhysicalMaterial; fade: { value: number }; j: number };
  const plates: Plate[] = [];
  const rngP = mulberry32(SEED ^ 0x51a7e);
  // per-plate variety repeats with period K_ADVANCE, so plate j and plate
  // j+K look identical and the loop closes
  const variety = Array.from({ length: K_ADVANCE }, () => ({
    dust: rngP() < 0.45 ? 0.5 + rngP() * 0.5 : 0,
    filmOffset: new THREE.Vector2(rngP(), rngP()),
    film: 0.7 + rngP() * 0.3,
  }));

  for (let j = 0; j < SLOTS; j++) {
    const vty = variety[j % K_ADVANCE];
    const fade = { value: 0 };
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0, 0, 0), // no diffuse: glass only reflects and transmits
      metalness: 0,
      roughness: 0.03,
      ior: 1.5,
      // Transmission is done in screen space below (each plate refracts the
      // image of everything already drawn behind it), so three's own
      // transmission pass, which only sees opaque objects, stays off.
      transmission: 0,
      envMap: envRT.texture,
      iridescence: vty.film,
      iridescenceIOR: 1.33,
      iridescenceThicknessRange: v.iridescence,
      iridescenceThicknessMap: filmTex,
      envMapIntensity: 2.2,
      specularIntensity: 1,
      transparent: false,
      depthWrite: false,
      depthTest: false,
      side: THREE.FrontSide,
      blending: THREE.NoBlending,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uFade = fade;
      shader.uniforms.uEdge = { value: edgeCol.clone().multiplyScalar(v.edgeGlow) };
      shader.uniforms.uEdgeBase = { value: tintCol.clone().multiplyScalar(v.edgeGlow * 0.22) };
      shader.uniforms.uKeyDir = { value: new THREE.Vector3(-0.45, 0.75, 0.5).normalize() };
      shader.uniforms.uBody = { value: tintCol.clone().multiplyScalar(v.bodyGlow) };
      shader.uniforms.uDust = { value: vty.dust };
      shader.uniforms.uDustTex = { value: dustTex };
      shader.uniforms.uDustOff = { value: vty.filmOffset.clone().multiplyScalar(3.7) };
      shader.uniforms.uHalf = { value: new THREE.Vector3(PLATE_LEN / 2, PLATE_WID / 2, PLATE_THK / 2) };
      shader.uniforms.uFilmOff = { value: vty.filmOffset };
      shader.uniforms.tBg = bgTex;
      shader.uniforms.uRes = res;
      shader.uniforms.uTint = { value: tintCol.clone().lerp(new THREE.Color(1, 1, 1), 0.68) };
      shader.uniforms.uRefract = { value: 0.012 };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vObj;\nuniform vec2 uFilmOff;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;")
        .replace(
          "#include <uv_vertex>",
          "#include <uv_vertex>\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\nvIridescenceThicknessMapUv = position.xy * 0.9 + uFilmOff;\n#endif",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vObj;
          uniform float uFade;
          uniform vec3 uEdge;
          uniform vec3 uEdgeBase;
          uniform vec3 uKeyDir;
          uniform vec3 uBody;
          uniform float uDust;
          uniform sampler2D uDustTex;
          uniform vec2 uDustOff;
          uniform vec3 uHalf;
          uniform sampler2D tBg;
          uniform vec2 uRes;
          uniform vec3 uTint;
          uniform float uRefract;`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          {
            // light trapped in the glass leaves through the edges
            vec3 ap = abs(vObj);
            float dx = uHalf.x - ap.x;
            float dy = uHalf.y - ap.y;
            float d = min(dx, dy);
            float rim = 1.0 - smoothstep(0.0, uHalf.z * 1.6, d);
            float inner = exp(-d / 0.05);
            float side = step(ap.z, uHalf.z * 0.6) * 0.6; // the thin side faces
            vec3 V = normalize(vViewPosition);
            float fres = pow(1.0 - abs(dot(normalize(vNormal), V)), 2.0);
            // doubled edge: bright outer rim, a dark gap, then the faint
            // internal reflection of the far edge
            float inner2 = exp(-pow((d - uHalf.z * 6.0) / (uHalf.z * 0.9), 2.0)) * 0.14 * fres;
            float edge = max(rim, side) * (0.3 + 0.7 * fres) + inner2 + inner * 0.03;
            // edges facing the key light flare cyan; the rest glow deep blue
            vec3 nW = inverseTransformDirection(normalize(vNormal), viewMatrix);
            float catchL = pow(max(dot(nW, uKeyDir) * 0.8 + 0.2, 0.0), 1.5);
            totalEmissiveRadiance += mix(uEdgeBase, uEdge * 1.6, catchL) * edge;
            // faint body glow, stronger toward the edges
            totalEmissiveRadiance += uBody * (0.35 + 0.65 * exp(-d / 0.18));
            if (uDust > 0.0) {
              float dust = texture2D(uDustTex, vObj.xy * 0.8 + 0.5 + uDustOff).r;
              totalEmissiveRadiance += vec3(1.0) * dust * uDust * 0.45;
            }
          }`,
        )
        .replace(
          "#include <opaque_fragment>",
          `#include <opaque_fragment>
          {
            // Screen-space refraction of everything already behind this
            // plate. Flat faces shift the image slightly; the rounded bevels
            // bend it hard, which gives the bright/dark banding of thick
            // glass edges. A little dispersion splits the channels.
            vec2 suv = gl_FragCoord.xy / uRes;
            vec3 nV = normalize(vNormal);
            float cosI = clamp(abs(dot(nV, normalize(vViewPosition))), 0.0, 1.0);
            vec2 off = nV.xy * uRefract * (1.0 + 6.0 * pow(1.0 - cosI, 2.0)) * vec2(uRes.y / uRes.x, 1.0);
            vec3 behind;
            behind.r = texture2D(tBg, suv + off * 0.94).r;
            behind.g = texture2D(tBg, suv + off).g;
            behind.b = texture2D(tBg, suv + off * 1.06).b;
            float F = 0.04 + 0.96 * pow(1.0 - cosI, 5.0);
            // absorption grows with the path length through the slab
            vec3 transmit = behind * pow(uTint, vec3(1.0 / max(cosI, 0.35))) * (1.0 - F);
            vec3 untouched = texture2D(tBg, suv).rgb;
            // Guard against NaN/Inf from the thin-film term at grazing angles:
            // one bad fragment would poison the half-float buffer that every
            // later plate (and the bloom) reads.
            vec3 lit = gl_FragColor.rgb;
            if (any(isnan(lit)) || any(isinf(lit))) lit = vec3(0.0);
            if (any(isnan(transmit)) || any(isinf(transmit))) transmit = untouched * 0.5;
            vec3 glass = clamp(transmit + lit, 0.0, 64.0);
            gl_FragColor = vec4(mix(untouched, glass, uFade), 1.0);
          }`,
        );
    };
    mat.customProgramCacheKey = () => "glass-plate";
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    spiral.add(mesh);
    plates.push({ mesh, mat, fade, j });
  }

  // Plates are drawn one at a time, farthest first. Each draw reads the
  // resolved scene target (what is already behind it) and writes the
  // refracted, tinted result over it: no blending, so the order matters and is
  // fixed by position along the helix.
  const drawPlates = (r: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget) => {
    res.value.set(target.width, target.height);
    bgTex.value = target.texture;
    // Draw order follows the helix: plates deeper along the spiral first.
    // Ordering by view depth would swap neighbours as they turn, and since
    // each plate composites over what is behind it, a swap shows as a pop.
    // The slot order never changes, so the motion stays continuous.
    const vis = plates.filter((p) => p.mesh.visible);
    vis.sort((a, b) => b.j - a.j);
    for (const p of vis) r.render(p.mesh, camera);
  };

  // depth-only prepass for depth of field (the glass itself doesn't depth-test)
  const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const prepass = (r: THREE.WebGLRenderer) => {
    scene.overrideMaterial = depthMat;
    r.render(scene, camera);
    scene.overrideMaterial = null;
  };

  // Spiral placement in the world (axis = local +z, toward the camera side).
  spiral.position.set(0, 0, 0);
  // Camera in the spiral's frame: oblique to the axis so plates on one side
  // face the lens and the other side stacks edge-on; the view offset puts the
  // hole at ~62 % of the frame width, leaving the left third black.
  const CAM = { az: 48, el: 10, dist: 1.3, roll: -20, targetZ: -0.45, shiftX: 0.2, shiftY: -0.18 };

  const q = new THREE.Quaternion();
  const qTilt = new THREE.Quaternion();
  const qSpin = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const xAxis = new THREE.Vector3(1, 0, 0);

  return {
    render: (loopFrame: number) => {
      const t = loopFrame / LOOP_FRAMES;
      const w = post.pixelWidth;
      const h = post.pixelHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      for (const p of plates) {
        // screw motion: every plate slides K_ADVANCE slots along the helix per loop
        const s = p.j + K_ADVANCE * t;
        const f = fadeAt(s);
        p.fade.value = f;
        p.mesh.visible = f > 0.002;
        const theta = s * D_THETA;
        const rc = HOLE_R + PLATE_LEN / 2;
        qTilt.setFromAxisAngle(xAxis, TILT);
        qSpin.setFromAxisAngle(zAxis, theta);
        q.copy(qSpin).multiply(qTilt);
        p.mesh.quaternion.copy(q);
        p.mesh.position.set(Math.cos(theta) * rc, Math.sin(theta) * rc, -s * D_AXIAL);
      }

      const az = THREE.MathUtils.degToRad(CAM.az);
      const el = THREE.MathUtils.degToRad(CAM.el);
      camera.position.set(
        Math.sin(az) * Math.cos(el) * CAM.dist,
        Math.sin(el) * CAM.dist,
        CAM.targetZ + Math.cos(az) * Math.cos(el) * CAM.dist,
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, CAM.targetZ);
      camera.rotateZ(THREE.MathUtils.degToRad(CAM.roll));
      camera.setViewOffset(w, h, -CAM.shiftX * w, CAM.shiftY * h, w, h);
      camera.updateMatrixWorld();
      post.render(scene, camera, loopFrame, prepass, drawPlates);
    },
    dispose: () => {
      post.dispose();
      geo.dispose();
      envRT.dispose();
      filmTex.dispose();
      dustTex.dispose();
      plates.forEach((p) => p.mat.dispose());
    },
  };
};

export const GlassSpiral: React.FC<{ version: GlassVersion }> = ({ version }) => {
  const factory = useCallback((r: THREE.WebGLRenderer) => createGlassScene(version)(r), [version]);
  return <ThreeStage factory={factory} />;
};
