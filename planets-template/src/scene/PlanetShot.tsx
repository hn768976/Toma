import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame,
  useRemotionEnvironment, useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { BODIES, BodyMeta } from "../data/bodies";
import { VersionRow } from "../data/versions";
import { frameState, FOV_DEG } from "./motion";
import { Post } from "./post";
import {
  atmFrag, atmVert, planetFrag, planetVert, ringFrag, ringVert, starFrag, starVert,
} from "./shaders";
import { makeStarGeometry } from "./stars";

type Maps = { color: THREE.Texture; normal: THREE.Texture; rings: THREE.Texture | null };

const SPHERE_SEGMENTS: [number, number] = [512, 256];

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve, undefined, () => reject(new Error(`Failed to load ${url}`)));
  });
}

// Ellipsoid geometry: unit sphere with the polar axis scaled by (1 - f).
function ellipsoid(radius: number, flat: number, seg: [number, number]) {
  const g = new THREE.SphereGeometry(radius, seg[0], seg[1]);
  g.scale(1, flat, 1);
  return g;
}

const Scene: React.FC<{ row: VersionRow; meta: BodyMeta; maps: Maps }> = ({ row, meta, maps }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame; // read by the render callback below
  const gl = useThree((s) => s.gl);
  const advance = useThree((s) => s.advance);
  const { isRendering } = useRemotionEnvironment();

  const built = useMemo(() => {
    const flat = 1 - meta.flattening;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV_DEG, 16 / 9, 0.05, 4000);
    const body = new THREE.Group();
    scene.add(body);

    const aniso = gl.capabilities.getMaxAnisotropy();
    for (const t of [maps.color, maps.normal]) {
      t.anisotropy = aniso;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = true;
      t.needsUpdate = true;
    }
    maps.color.colorSpace = THREE.SRGBColorSpace;
    maps.normal.colorSpace = THREE.NoColorSpace;
    if (maps.rings) {
      maps.rings.colorSpace = THREE.SRGBColorSpace;
      maps.rings.wrapS = maps.rings.wrapT = THREE.ClampToEdgeWrapping;
      maps.rings.minFilter = THREE.LinearMipmapLinearFilter;
      maps.rings.anisotropy = 1; // isotropic footprint set in the shader
      maps.rings.magFilter = THREE.LinearFilter;
      maps.rings.needsUpdate = true;
    }

    const atm = row.atmosphere;
    const metaAtm = meta.atmosphere;
    const shared = {
      uFlat: { value: flat },
      uLight: { value: new THREE.Vector3() },
      uCam: { value: new THREE.Vector3() },
      uRingTex: { value: maps.rings ?? maps.color },
      uRingRange: { value: new THREE.Vector2(meta.rings?.inner ?? 1, meta.rings?.outer ?? 2) },
      uHasRings: { value: row.rings && maps.rings ? 1 : 0 },
      uSun: { value: row.exposure },
      uAtmColor: { value: new THREE.Vector3(...(atm?.color ?? [0, 0, 0])) },
      uAtmStrength: { value: (atm?.strength ?? 0) * row.atmosphereScale },
      uSunColor: { value: new THREE.Vector3(...row.sunColor) },
      uFill: { value: row.fill },
    };

    // Star field (behind everything; additive, depth-tested against the body).
    const stars = new THREE.Points(
      makeStarGeometry(),
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3, vertexShader: starVert, fragmentShader: starFrag,
        uniforms: { uPxScale: { value: 1 }, uStarGain: { value: row.starBrightness } },
        transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, toneMapped: false,
      }),
    );
    stars.frustumCulled = false;
    scene.add(stars);

    const planet = new THREE.Mesh(
      ellipsoid(1, flat, SPHERE_SEGMENTS),
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3, vertexShader: planetVert, fragmentShader: planetFrag,
        uniforms: {
          ...shared,
          uColor: { value: maps.color },
          uNormal: { value: maps.normal },
          // The Crescent relief boost applies to solid bodies only (gas giants
          // and cloud decks keep their gentle baked normals).
          uNormalStrength: { value: meta.surface.normalStrength <= 0 ? 0 : meta.surface.normalStrength >= 0.5 ? row.reliefBoost : 1 },
          // Crescent shots cap the wrap so most of the disc stays in shadow.
          uWrap: { value: row.shot === "crescent" ? Math.min(meta.surface.wrap, 0.1) : meta.surface.wrap + row.wrapBoost },
          uSaturation: { value: meta.surface.saturation * row.saturationBoost },
          uLimb: { value: (meta.surface.limbDarkening ?? (atm ? 0.35 : 0.2)) * row.limbScale },
        },
        toneMapped: false,
      }),
    );
    body.add(planet);

    let rings: THREE.Mesh | null = null;
    if (row.rings && maps.rings && meta.rings) {
      const g = new THREE.RingGeometry(meta.rings.inner, meta.rings.outer, 720, 1);
      g.rotateX(-Math.PI / 2);
      rings = new THREE.Mesh(
        g,
        new THREE.ShaderMaterial({
          glslVersion: THREE.GLSL3, vertexShader: ringVert, fragmentShader: ringFrag,
          uniforms: shared, side: THREE.DoubleSide, transparent: true, depthWrite: false,
          blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
          toneMapped: false,
        }),
      );
      body.add(rings);
    }

    let shell: THREE.Mesh | null = null;
    if (atm && metaAtm) {
      shell = new THREE.Mesh(
        ellipsoid(1 + metaAtm.thickness * 6, flat, [256, 128]),
        new THREE.ShaderMaterial({
          glslVersion: THREE.GLSL3, vertexShader: atmVert, fragmentShader: atmFrag,
          uniforms: {
            ...shared,
            uAtmThickness: { value: metaAtm.thickness },
            uForward: { value: row.shot === "crescent" ? metaAtm.crescent * 6 : 0.0 },
          },
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        }),
      );
      body.add(shell);
    }
    // Draw order: stars, planet, rings, atmosphere.
    stars.renderOrder = 0;
    planet.renderOrder = 1;
    if (rings) rings.renderOrder = 2;
    if (shell) shell.renderOrder = 3;

    return { scene, camera, body, stars, shared };
  }, [gl, maps, meta, row]);

  const postRef = useRef<Post | null>(null);
  useEffect(() => () => postRef.current?.dispose(), []);

  useFrame(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    let post = postRef.current;
    if (!post || post.width !== size.x || post.height !== size.y) {
      post?.dispose();
      post = postRef.current = new Post(size.x, size.y);
    }
    const st = frameState(row, frameRef.current);
    const { camera, body, shared, stars } = built;
    camera.aspect = size.x / size.y;
    camera.position.copy(st.camPos);
    camera.quaternion.copy(st.camQuat);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    // Lens shift: move the frame without perspective skew.
    camera.projectionMatrix.elements[8] = -st.shiftX;
    camera.projectionMatrix.elements[9] = -st.shiftY;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    body.quaternion.copy(st.bodyQuat);
    body.updateMatrixWorld(true);
    const inv = st.bodyQuat.clone().invert();
    shared.uLight.value.copy(st.light).applyQuaternion(inv);
    shared.uCam.value.copy(st.camPos).applyQuaternion(inv);
    (stars.material as THREE.ShaderMaterial).uniforms.uPxScale.value = size.y / 2160;
    post.render(gl, built.scene, camera, { exposure: 1.0, frame: st.loopFrame, bloom: 0.05, grain: 0.015 });
  }, 1);

  // Textures are ready when this component mounts; render once now so the
  // first frame is never captured without them.
  useEffect(() => {
    if (isRendering) advance(performance.now());
  }, [advance, isRendering, built]);

  return null;
};

export const PlanetShot: React.FC<{ row: VersionRow }> = ({ row }) => {
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  const meta = BODIES[row.body];
  const [maps, setMaps] = useState<Maps | null>(null);
  const [handle] = useState(() => delayRender(`Loading maps for ${row.body}`, { timeoutInMilliseconds: 300000 }));

  useEffect(() => {
    let cancelled = false;
    const base = `bodies/${row.body}/`;
    Promise.all([
      loadTexture(staticFile(base + meta.maps.color)),
      loadTexture(staticFile(base + meta.maps.normal)),
      row.rings && meta.rings ? loadTexture(staticFile(base + meta.rings.texture)) : Promise.resolve(null),
    ]).then(([color, normal, rings]) => {
      if (!cancelled) setMaps({ color, normal, rings });
    });
    return () => {
      cancelled = true;
    };
  }, [row.body, row.rings, meta]);

  useEffect(() => {
    if (maps) {
      // Allow the canvas to draw with the maps before releasing the frame.
      requestAnimationFrame(() => requestAnimationFrame(() => continueRender(handle)));
    }
  }, [maps, handle]);

  // While rendering, the canvas resolution follows Remotion's --scale
  // (devicePixelRatio). In the Studio, cap it for interactive speed.
  const dpr = isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 0.5);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {maps ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          flat
          linear
          gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        >
          <Scene row={row} meta={meta} maps={maps} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
