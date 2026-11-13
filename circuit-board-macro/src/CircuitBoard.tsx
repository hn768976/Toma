import React from "react";
import * as THREE from "three";
import { SceneFactory, Stage } from "./engine/Stage";
import { PostFX, rng } from "./engine/post";
import { AZ, W, buildBoard } from "./scene/board";
import { COLOR, MONO, Palette } from "./scene/palette";

// ---- shot description (all distances in board units; QFP lid = 4 x 4) ----
const FOV = 27; // vertical field of view, degrees
const DIST = 9.8; // camera distance to the look-at point
const ELEV = (26 * Math.PI) / 180; // camera elevation above the board
const TRUCK_FROM = -1.85; // lateral camera offset at t = 0 s
const TRUCK_TO = 1.85; // lateral camera offset at t = 10 s
const LOOK_S = -0.75; // look-at point, slightly in front of the chip centre
const APERTURE = 0.024;
const MAX_COC = 0.034;

function softbox(color: THREE.Color, w: number, h: number, pos: THREE.Vector3) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  m.position.copy(pos);
  m.lookAt(0, 0, 0);
  return m;
}

function buildEnvironment(renderer: THREE.WebGLRenderer, p: Palette) {
  const env = new THREE.Scene();
  env.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(90, 32, 16),
      new THREE.MeshBasicMaterial({ color: p.envBase, side: THREE.BackSide }),
    ),
  );
  const at = (r: number, s: number, y: number) => {
    const [x, z] = W(r, s);
    return new THREE.Vector3(x, y, z);
  };
  // low, bright softbox behind-left: mirrored by the glossy board -> blown-out top-left
  env.add(softbox(p.envBack, 46, 9, at(-34, 48, 8.5)));
  // big overhead softbox: lights lid, block tops, capacitor tops
  env.add(softbox(p.envTop, 44, 34, at(-4, 8, 46)));
  // soft fill from behind the camera so camera-facing sides keep some detail
  env.add(softbox(p.envFill, 50, 30, at(10, -50, 30)));
  // dim rim from the right
  env.add(softbox(p.envRim, 30, 16, at(50, 16, 14)));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.03, 1, 200);
  pmrem.dispose();
  env.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  });
  return rt;
}

type Speck = {
  r: number;
  s: number;
  y: number;
  vr: number;
  vs: number;
  vy: number;
  size: number;
  ph: number;
};

const makeFactory =
  (palette: Palette): SceneFactory =>
  ({ renderer, pixelWidth, pixelHeight, fps, durationInFrames }) => {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const post = new PostFX(renderer, pixelWidth, pixelHeight);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.fog);
    scene.fog = new THREE.Fog(palette.fog, 30, 160);
    const envRT = buildEnvironment(renderer, palette);
    scene.environment = envRT.texture;

    const board = buildBoard(palette);
    scene.add(board);

    const key = new THREE.DirectionalLight(
      palette.keyColor,
      palette.keyIntensity,
    );
    const [kx, kz] = W(-7, 9);
    key.position.set(kx, 13, kz);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    const sc = key.shadow.camera;
    sc.left = -17;
    sc.right = 17;
    sc.top = 17;
    sc.bottom = -17;
    sc.near = 1;
    sc.far = 50;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.015;
    key.shadow.radius = 5;
    scene.add(key, key.target);

    // Low back light: grazing specular glare on the board (the blown-out top-left of
    // the reference), bright rims on every part and long soft shadows towards camera.
    const back = new THREE.DirectionalLight(
      palette.backColor,
      palette.backIntensity,
    );
    const [bx, bz] = W(-22, 40);
    back.position.set(bx, 9.5, bz);
    back.target.position.set(0, 0, 0);
    back.castShadow = true;
    back.shadow.mapSize.set(4096, 4096);
    const bc = back.shadow.camera;
    bc.left = -24;
    bc.right = 24;
    bc.top = 12;
    bc.bottom = -12;
    bc.near = 5;
    bc.far = 110;
    back.shadow.bias = -0.0006;
    back.shadow.normalBias = 0.03;
    back.shadow.radius = 6;
    scene.add(back, back.target);

    // ---- floating dust -------------------------------------------------------
    const rand = rng(4242);
    const specks: Speck[] = [];
    for (let i = 0; i < 36; i++) {
      specks.push({
        r: (rand() - 0.5) * 15,
        s: -3.2 + rand() * 7.5,
        y: 0.9 + rand() * 3.6,
        vr: (rand() - 0.5) * 0.09,
        vs: (rand() - 0.5) * 0.06,
        vy: 0.015 + rand() * 0.05,
        size: 0.005 + rand() * rand() * 0.009,
        ph: rand() * Math.PI * 2,
      });
    }
    // Each speck is a camera-facing disc whose radius already includes its own
    // circle of confusion, so tiny bright points turn into clean bokeh discs.
    const dustGeo = new THREE.InstancedBufferGeometry();
    dustGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
        3,
      ),
    );
    dustGeo.setIndex([0, 1, 2, 0, 2, 3]);
    const dustData = new THREE.InstancedBufferAttribute(
      new Float32Array(specks.length * 4),
      4,
    );
    dustGeo.setAttribute("aSpeck", dustData);
    const dustMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: palette.dust },
        uFocus: { value: 8 },
        uAperture: { value: APERTURE },
        uMaxCoc: { value: MAX_COC },
        uTanHalfFov: { value: Math.tan((FOV * Math.PI) / 360) },
        tDepth: { value: post.depthTexture },
        uResolution: { value: new THREE.Vector2(pixelWidth, pixelHeight) },
        uNear: { value: 2 },
        uFar: { value: 220 },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aSpeck; // xyz = world position, w = radius
        uniform float uFocus, uAperture, uMaxCoc, uTanHalfFov;
        varying vec2 vP;
        varying float vI;
        varying float vZ;
        void main() {
          vec4 mv = viewMatrix * vec4(aSpeck.xyz, 1.0);
          float z = max(-mv.z, 0.01);
          float coc = min(abs(uAperture * (z - uFocus) / z), uMaxCoc * 0.3); // fraction of frame height
          float blurR = coc * 2.0 * z * uTanHalfFov;
          float r = aSpeck.w + blurR;
          vP = position.xy;
          vZ = z;
          vI = (aSpeck.w * aSpeck.w) / (r * r); // conserve energy when defocused
          mv.xy += position.xy * r;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform sampler2D tDepth;
        uniform vec2 uResolution;
        uniform float uNear, uFar;
        varying vec2 vP;
        varying float vI;
        varying float vZ;
        void main() {
          float d = length(vP);
          float a = 1.0 - smoothstep(0.6, 1.0, d);
          // soft occlusion against the rendered scene
          float sd = texture2D(tDepth, gl_FragCoord.xy / uResolution).r;
          float sceneZ = (uNear * uFar) / (uFar - sd * (uFar - uNear));
          a *= smoothstep(-0.05, 0.25, sceneZ - vZ);
          gl_FragColor = vec4(uColor * a * (0.1 + 0.9 * vI), 1.0);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const dust = new THREE.Mesh(dustGeo, dustMat);
    dust.frustumCulled = false;
    dust.renderOrder = 10;
    const overlay = new THREE.Scene();
    overlay.add(dust);

    const camera = new THREE.PerspectiveCamera(
      FOV,
      pixelWidth / pixelHeight,
      2,
      220,
    );
    const look = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const chipCentre = new THREE.Vector3(0, 0.7, 0);

    return {
      render: (frame) => {
        const t = frame / fps;
        const u = frame / durationInFrames; // 0..1 over the 10 s shot
        // constant-speed truck to the right, exactly like the reference
        const truck = TRUCK_FROM + (TRUCK_TO - TRUCK_FROM) * u;
        const [lx, lz] = W(truck, LOOK_S);
        look.set(lx, 0.25, lz);
        const backDist = DIST * Math.cos(ELEV);
        camera.position.set(
          lx + Math.sin(AZ) * backDist,
          0.25 + DIST * Math.sin(ELEV),
          lz + Math.cos(AZ) * backDist,
        );
        camera.lookAt(look);
        camera.updateMatrixWorld();
        camera.getWorldDirection(dir);
        const focus = tmp.copy(chipCentre).sub(camera.position).dot(dir);
        dustMat.uniforms.uFocus.value = focus;

        for (let i = 0; i < specks.length; i++) {
          const k = specks[i];
          const [x, z] = W(
            k.r + k.vr * t + Math.sin(t * 0.5 + k.ph) * 0.05,
            k.s + k.vs * t + Math.cos(t * 0.37 + k.ph * 1.7) * 0.04,
          );
          const y = k.y + k.vy * t + Math.sin(t * 0.6 + k.ph * 2.3) * 0.03;
          dustData.setXYZW(i, x, y, z, k.size);
        }
        dustData.needsUpdate = true;

        post.render(
          scene,
          camera,
          {
            focus,
            aperture: APERTURE,
            maxCoc: MAX_COC,
            bloomStrength: 0.35,
            bloomThreshold: 0.85,
            vignette: 0.3,
            grain: 0.022,
            seed: frame,
            exposure: palette.post.exposure,
            contrast: palette.post.contrast,
            saturation: palette.post.saturation,
            tint: palette.post.tint,
            lift: palette.post.lift,
          },
          overlay,
        );
      },
      dispose: () => {
        post.dispose();
        dustGeo.dispose();
        dustMat.dispose();
        envRT.dispose();
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
          }
        });
        key.shadow.map?.dispose();
        back.shadow.map?.dispose();
      },
    };
  };

const monoFactory = makeFactory(MONO);
const colorFactory = makeFactory(COLOR);

/** V1 – monochrome reference match. */
export const CircuitBoardV1: React.FC = () => (
  <Stage factory={monoFactory} background="#000" />
);
/** V2 – same shot, midnight-teal / gold colour palette. */
export const CircuitBoardV2: React.FC = () => (
  <Stage factory={colorFactory} background="#000" />
);
