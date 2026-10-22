import { useFrame, useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { pieceCom, pieceGeometry } from "./geometry";
import { Palette } from "./palettes";
import { cameraAt, kingY, lerp, PIECES, piecePose, simTime, smooth, T_KING_LAND } from "./sim";
import { BOARD_SQUARES, checkerTexture, glowTexture, SQUARE, studioEnvironment } from "./textures";
import { Effects } from "./Effects";

type TimeRef = React.MutableRefObject<number>;

const CameraRig: React.FC<{ time: TimeRef }> = ({ time }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  useFrame(() => {
    // Thick haze hides the board while the camera descends with the king,
    // then clears as we reach board level.
    if (scene.fog instanceof THREE.Fog) {
      const clear = smooth((time.current - 0.32) / 0.3);
      scene.fog.near = lerp(3, 11, clear);
      scene.fog.far = lerp(8.5, 24, clear);
    }
    const { pos, target } = cameraAt(time.current);
    camera.position.set(...pos);
    camera.lookAt(...target);
    camera.updateMatrixWorld();
  });
  return null;
};

const Environment: React.FC<{ palette: Palette }> = ({ palette }) => {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    const env = studioEnvironment(gl, palette.keyLight);
    scene.environment = env;
    scene.environmentIntensity = 0.85;
    // Fog fades the far stage into the backdrop's haze tone.
    const haze = new THREE.Color(palette.backdropBottom).lerp(new THREE.Color(palette.backdropTop), 0.55);
    scene.fog = new THREE.Fog(haze, 11, 24);
    return () => {
      env.dispose();
      scene.environment = null;
      scene.fog = null;
    };
  }, [gl, scene, palette]);
  return null;
};

const backdropVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Stage backdrop: vertical gradient, top-down light shafts and a soft glow
// behind the king, with a little grain so it never bands.
const backdropFragment = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uBeam;
uniform float uTime;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float beam(vec2 uv, float x, float w, float s) {
  float spread = w * (1.0 + (1.0 - uv.y) * 2.6);
  float d = (uv.x - x) / spread;
  float fall = smoothstep(0.18, 1.0, uv.y);
  return exp(-d * d) * fall * s;
}
void main() {
  vec2 uv = vUv;
  vec3 col = mix(uBottom, uTop, smoothstep(0.0, 0.85, uv.y));
  float b = 0.0;
  b += beam(uv, 0.405, 0.012, 0.55);
  b += beam(uv, 0.47, 0.016, 0.95);
  b += beam(uv, 0.535, 0.014, 0.8);
  b += beam(uv, 0.6, 0.012, 0.5);
  b += beam(uv, 0.33, 0.01, 0.25);
  b += beam(uv, 0.675, 0.01, 0.28);
  float flicker = 0.97 + 0.03 * sin(uTime * 2.3);
  col += uBeam * b * 0.2 * flicker;
  vec2 c = (uv - vec2(0.5, 0.36)) * vec2(1.6, 2.4);
  col += uBeam * 0.03 * exp(-dot(c, c) * 3.0);
  float edge = smoothstep(0.0, 0.42, uv.x) * smoothstep(1.0, 0.58, uv.x);
  col *= mix(0.45, 1.0, edge);
  col += (hash(uv * 1024.0 + uTime) - 0.5) * 0.01;
  gl_FragColor = vec4(col, 1.0);
}`;

const Backdrop: React.FC<{ palette: Palette; time: TimeRef }> = ({ palette, time }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: backdropVertex,
        fragmentShader: backdropFragment,
        uniforms: {
          uTop: { value: new THREE.Color(palette.backdropTop) },
          uBottom: { value: new THREE.Color(palette.backdropBottom) },
          uBeam: { value: new THREE.Color(palette.beam) },
          uTime: { value: 0 },
        },
        fog: false,
      }),
    [palette],
  );
  useFrame(() => {
    mat.uniforms.uTime.value = time.current;
  });
  return (
    <mesh position={[0, 7, -16]} material={mat} renderOrder={-10}>
      <planeGeometry args={[78, 36]} />
    </mesh>
  );
};

const reflectorShader = {
  name: "BoardReflection",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uStrength: { value: 1 },
    uSquare: { value: SQUARE },
    uCam: { value: new THREE.Vector3() },
    uLimit: { value: (BOARD_SQUARES * SQUARE) / 2 },
    uFogNear: { value: 11 },
    uFogFar: { value: 24 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uSquare;
    uniform vec3 uCam;
    uniform float uLimit;
    uniform float uFogNear;
    uniform float uFogFar;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vec2 uv = vUv.xy / vUv.w;
      float b = 0.0022;
      vec3 c = texture2D(tDiffuse, uv).rgb * 0.36;
      c += texture2D(tDiffuse, uv + vec2(b, 0.0)).rgb * 0.16;
      c += texture2D(tDiffuse, uv - vec2(b, 0.0)).rgb * 0.16;
      c += texture2D(tDiffuse, uv + vec2(0.0, b * 1.8)).rgb * 0.16;
      c += texture2D(tDiffuse, uv - vec2(0.0, b * 1.8)).rgb * 0.16;
      vec2 cell = floor(vWorld.xz / uSquare);
      float dark = mod(cell.x + cell.y, 2.0);
      float k = mix(0.2, 0.32, dark);
      vec3 V = normalize(uCam - vWorld);
      float fres = 0.25 + 0.35 * pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0);
      vec2 a = abs(vWorld.xz);
      float inBoard = step(max(a.x, a.y), uLimit);
      float fogFade = 1.0 - smoothstep(uFogNear, uFogFar, length(uCam - vWorld));
      gl_FragColor = vec4(c * k * fres * uStrength * inBoard * fogFade, 1.0);
    }`,
};

const Board: React.FC<{ palette: Palette }> = ({ palette }) => {
  const { size, gl, camera } = useThree();
  const tex = useMemo(() => checkerTexture(palette.boardLight, palette.boardDark), [palette]);
  const half = (BOARD_SQUARES * SQUARE) / 2;
  const reflector = useMemo(() => {
    const dpr = gl.getPixelRatio();
    const r = new Reflector(new THREE.PlaneGeometry(BOARD_SQUARES * SQUARE, BOARD_SQUARES * SQUARE), {
      textureWidth: Math.round(size.width * dpr * 0.5),
      textureHeight: Math.round(size.height * dpr * 0.5),
      clipBias: 0.0,
      multisample: 4,
      shader: reflectorShader,
    });
    const mat = r.material as THREE.ShaderMaterial;
    mat.transparent = true;
    mat.blending = THREE.AdditiveBlending;
    mat.depthWrite = false;
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.002;
    // Skip the extra mirror render during depth-only passes (depth of field).
    const original = r.onBeforeRender;
    r.onBeforeRender = (renderer, scene, cam, ...rest) => {
      if (scene.overrideMaterial) return;
      original.call(r, renderer, scene, cam, ...rest);
    };
    return r;
  }, [gl, size.width, size.height]);
  const scene = useThree((s) => s.scene);
  useFrame(() => {
    const u = (reflector.material as THREE.ShaderMaterial).uniforms;
    u.uCam.value.copy(camera.position);
    if (scene.fog instanceof THREE.Fog) {
      u.uFogNear.value = scene.fog.near;
      u.uFogFar.value = scene.fog.far;
    }
  });
  return (
    <group>
      {/* Board slab */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[BOARD_SQUARES * SQUARE, 0.12, BOARD_SQUARES * SQUARE]} />
        <meshStandardMaterial color="#0b0b0b" roughness={0.4} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.0005, 0]} receiveShadow>
        <planeGeometry args={[half * 2, half * 2]} />
        <meshPhysicalMaterial map={tex} roughness={0.32} metalness={0} clearcoat={0.1} clearcoatRoughness={0.3} envMapIntensity={0.08} />
      </mesh>
      <primitive object={reflector} />
      {/* Stage floor beyond the board */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.12, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshBasicMaterial color={new THREE.Color(palette.backdropBottom).lerp(new THREE.Color(palette.backdropTop), 0.9)} fog={false} />
      </mesh>
    </group>
  );
};

const King: React.FC<{ palette: Palette; time: TimeRef }> = ({ palette, time }) => {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: palette.hero.color,
        metalness: palette.hero.metalness,
        roughness: palette.hero.roughness,
        clearcoat: 0.35,
        clearcoatRoughness: 0.12,
        envMapIntensity: 2.1,
        fog: false,
      }),
    [palette],
  );
  useFrame(() => {
    const t = time.current;
    const m = ref.current!;
    m.position.set(0, kingY(t), 0);
    m.rotation.y = lerp(0.9, 0.0, Math.min(1, t / T_KING_LAND)) + 0.25;
  });
  return <mesh ref={ref} geometry={pieceGeometry("king")} material={mat} castShadow receiveShadow />;
};

const Army: React.FC<{ palette: Palette; time: TimeRef }> = ({ palette, time }) => {
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: palette.army.color,
        metalness: 0.0,
        roughness: palette.army.roughness,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        sheen: 0.4,
        sheenColor: new THREE.Color(palette.army.sheen),
        sheenRoughness: 0.4,
        envMapIntensity: 1.3,
      }),
    [palette],
  );
  const groups = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const tau = simTime(time.current);
    PIECES.forEach((p, i) => {
      const g = groups.current[i];
      if (!g) return;
      piecePose(p, tau, g.position, g.quaternion);
    });
  });
  return (
    <>
      {PIECES.map((p, i) => {
        const com = pieceCom(p.type);
        return (
          <group key={i} ref={(el) => void (groups.current[i] = el)}>
            <mesh
              geometry={pieceGeometry(p.type)}
              material={mat}
              position={[0, -com.y, 0]}
              castShadow
              receiveShadow
            />
          </group>
        );
      })}
    </>
  );
};

const flashCurve = (t: number) => {
  const s = t - T_KING_LAND;
  if (s < 0) return 0;
  const attack = Math.min(1, s / 0.05);
  return attack * Math.exp(-s * 1.6);
};

const ImpactFlash: React.FC<{ palette: Palette; time: TimeRef }> = ({ palette, time }) => {
  const glow = useMemo(() => glowTexture(), []);
  const sprite = useRef<THREE.Sprite>(null);
  const ring = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const t = time.current;
    const f = flashCurve(t);
    const s = Math.max(0, t - T_KING_LAND);
    sprite.current!.scale.set(1.6 + 8.5 * f, 0.3 + 0.9 * f, 1);
    (sprite.current!.material as THREE.SpriteMaterial).opacity = Math.min(1, f * 1.4);
    const r = ring.current!;
    const grow = 1 - Math.exp(-s * 2.2);
    r.scale.setScalar(0.3 + grow * 7);
    (r.material as THREE.MeshBasicMaterial).opacity = s > 0 ? 0.55 * Math.exp(-s * 2.4) : 0;
    light.current!.intensity = 14 * f;
  });
  return (
    <group>
      <sprite ref={sprite} position={[0, 0.12, 0.25]} renderOrder={5}>
        <spriteMaterial
          map={glow}
          color={new THREE.Color(palette.flash).multiplyScalar(2.2)}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          fog={false}
        />
      </sprite>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.01, 0]} renderOrder={4}>
        <ringGeometry args={[0.85, 1, 96]} />
        <meshBasicMaterial
          color={new THREE.Color(palette.flash).multiplyScalar(1.4)}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
          alphaMap={glow}
          fog={false}
        />
      </mesh>
      <pointLight ref={light} position={[0, 0.35, 0.7]} color={palette.flash} distance={7} decay={1.4} />
    </group>
  );
};

const dustVertex = /* glsl */ `
attribute float aSize;
attribute float aSeed;
uniform float uTime;
uniform float uScale;
varying float vAlpha;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.35 + aSeed * 6.28) * 0.25 + uTime * 0.05;
  p.y += cos(uTime * 0.27 + aSeed * 12.1) * 0.2 - uTime * 0.08;
  p.z += sin(uTime * 0.21 + aSeed * 3.7) * 0.2;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  float shaft = exp(-pow(p.x / 2.6, 2.0));
  vAlpha = (0.25 + 0.75 * shaft) * (0.4 + 0.6 * fract(aSeed * 91.7));
  gl_Position = projectionMatrix * mv;
}`;

const dustFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(d));
  gl_FragColor = vec4(uColor * a * vAlpha, 1.0);
}`;

const Dust: React.FC<{ palette: Palette; time: TimeRef }> = ({ palette, time }) => {
  const { size, gl } = useThree();
  const geo = useMemo(() => {
    let s = 12345;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    const n = 1400;
    const pos = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rnd() - 0.5) * 16;
      pos[i * 3 + 1] = rnd() * 9;
      pos[i * 3 + 2] = -9 + rnd() * 14;
      // Mostly fine specks, a few large out-of-focus motes.
      sizes[i] = rnd() < 0.012 ? 0.08 + rnd() * 0.1 : 0.008 + rnd() * 0.014;
      seeds[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: dustVertex,
        fragmentShader: dustFragment,
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: 1 },
          uColor: { value: new THREE.Color(palette.dust).multiplyScalar(0.4) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [palette],
  );
  useFrame(() => {
    mat.uniforms.uTime.value = time.current;
    mat.uniforms.uScale.value = size.height * gl.getPixelRatio() * 1.9;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={6} />;
};

const Lights: React.FC<{ palette: Palette }> = ({ palette }) => {
  const key = useMemo(() => {
    const l = new THREE.SpotLight(palette.keyLight, 3.0, 0, 0.36, 0.9, 0);
    l.position.set(0.6, 11, 4.5);
    l.target.position.set(0, 0.6, 0.2);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0002;
    l.shadow.normalBias = 0.02;
    l.shadow.radius = 6;
    l.shadow.camera.near = 4;
    l.shadow.camera.far = 20;
    return l;
  }, [palette]);
  const rimL = useMemo(() => {
    const l = new THREE.SpotLight(palette.rimLight, 3.2, 0, 0.5, 0.9, 0);
    l.position.set(-4, 7, -7);
    l.target.position.set(0, 1, 0);
    return l;
  }, [palette]);
  const rimR = useMemo(() => {
    const l = new THREE.SpotLight(palette.rimLight, 2.6, 0, 0.5, 0.9, 0);
    l.position.set(4.5, 6.5, -6);
    l.target.position.set(0, 1, 0);
    return l;
  }, [palette]);
  return (
    <>
      <primitive object={key} />
      <primitive object={key.target} />
      <primitive object={rimL} />
      <primitive object={rimL.target} />
      <primitive object={rimR} />
      <primitive object={rimR.target} />
      <hemisphereLight args={[palette.keyLight, "#000000", 0.08]} />
    </>
  );
};

export const World: React.FC<{ palette: Palette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = useRef(frame / fps);
  time.current = frame / fps;
  return (
    <>
      <Environment palette={palette} />
      <CameraRig time={time} />
      <Lights palette={palette} />
      <Backdrop palette={palette} time={time} />
      <Board palette={palette} />
      <King palette={palette} time={time} />
      <Army palette={palette} time={time} />
      <ImpactFlash palette={palette} time={time} />
      <Dust palette={palette} time={time} />
      <Effects time={time} />
    </>
  );
};
