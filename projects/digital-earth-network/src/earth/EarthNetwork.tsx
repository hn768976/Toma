import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { smoothstep } from "../lib/spline";
import { cameraAt, Variant } from "./camera";
import { buildLabels, labelText } from "./labels";
import { buildScene, PALETTE, SUN, Textures } from "./scene";

export type EarthNetworkProps = { variant: Variant };

const TEXTURES = {
  day: "textures/earth_day_4096.jpg",
  lights: "textures/earth_lights_2048.png",
  clouds: "textures/earth_clouds_2048_soft.png",
  ocean: "textures/earth_specular_2048.jpg",
} as const;

const useTextures = () => {
  const [handle] = useState(() => delayRender("Loading earth textures"));
  const [textures, setTextures] = useState<Textures | null>(null);
  useLayoutEffect(() => {
    const loader = new THREE.TextureLoader();
    const entries = Object.entries(TEXTURES) as [keyof Textures, string][];
    Promise.all(
      entries.map(
        ([key, file]) =>
          new Promise<[keyof Textures, THREE.Texture]>((resolve, reject) => {
            loader.load(
              staticFile(file),
              (t) => {
                t.colorSpace = key === "day" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
                t.anisotropy = 8;
                t.wrapS = THREE.RepeatWrapping;
                t.generateMipmaps = true;
                t.minFilter = THREE.LinearMipmapLinearFilter;
                resolve([key, t]);
              },
              undefined,
              reject,
            );
          }),
      ),
    )
      .then((list) => {
        setTextures(Object.fromEntries(list) as Textures);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle]);
  return textures;
};

const tmp = new THREE.Vector3();
const toCam = new THREE.Vector3();

/** True if the segment camera->point is blocked by the unit sphere. */
const occluded = (cam: THREE.Vector3, p: THREE.Vector3) => {
  toCam.copy(p).sub(cam);
  const len = toCam.length();
  toCam.divideScalar(len);
  const b = cam.dot(toCam);
  const c = cam.lengthSq() - 1;
  const disc = b * b - c;
  if (disc < 0) return false;
  const tHit = -b - Math.sqrt(disc);
  return tHit > 0 && tHit < len;
};

export const EarthNetwork: React.FC<EarthNetworkProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const textures = useTextures();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render the WebGL layer at the real output resolution: with --scale=0.5
  // the 3840x2160 composition is rasterised natively at 1920x1080.
  const pixelRatio =
    typeof window === "undefined" ? 1 : Math.min(1, Math.max(0.25, window.devicePixelRatio || 1));

  const built = useMemo(() => (textures ? buildScene(textures, PALETTE) : null), [textures]);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  useLayoutEffect(() => {
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  const camera = useMemo(() => new THREE.PerspectiveCamera(40, width / height, 0.02, 60), [width, height]);

  const cam = cameraAt(variant, t);
  camera.position.copy(cam.position);
  camera.quaternion.copy(cam.quaternion);
  camera.fov = cam.fov;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const labels = useMemo(() => {
    const hints: THREE.Vector3[] = [];
    for (const ht of [0, 0.5, 1.0, 1.6, 2.4]) {
      const c = cameraAt(variant, ht);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
      hints.push(c.position.clone().add(fwd.multiplyScalar(0.9 + ht * 0.25)));
    }
    for (const ht of [3.5, 5, 6.5, 8]) {
      hints.push(cameraAt(variant, ht).position.clone().multiplyScalar(0.97));
    }
    return buildLabels(hints);
  }, [variant]);

  // Shell network turns slowly in the opposite direction for parallax.
  const shellSpin = -0.012 * t;

  useLayoutEffect(() => {
    if (!built || !canvasRef.current) return;
    let r = rendererRef.current;
    if (!r) {
      r = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
      r.outputColorSpace = THREE.SRGBColorSpace;
      rendererRef.current = r;
    }
    r.setPixelRatio(pixelRatio);
    r.setSize(width, height, false);

    built.earthGroup.rotation.set(0, cam.earthSpin, 0);
    built.shellGroup.rotation.set(0, shellSpin, 0);
    built.earthMat.uniforms.uCity.value = cam.cityGlow;
    built.earthMat.uniforms.uCloudShift.value = t * 0.0006;
    for (const m of built.pointMats) {
      m.uniforms.uPixelRatio.value = pixelRatio * (height / 1080);
      m.uniforms.uTime.value = t;
    }
    // Haze billboard: behind the globe, nudged toward the sun.
    const camDir = cam.position.clone().normalize();
    const sunSide = SUN.clone().sub(camDir.clone().multiplyScalar(SUN.dot(camDir))).normalize();
    built.haze.position.copy(camDir.clone().multiplyScalar(-1.6).add(sunSide.multiplyScalar(0.9)));
    built.haze.quaternion.copy(camera.quaternion);
    const camDist = cam.position.length();
    built.haze.scale.setScalar(1.5 * camDist + 1);
    (built.haze.material as THREE.ShaderMaterial).uniforms.uColor.value
      .set(...PALETTE.haze)
      .multiplyScalar(0.25 + 0.75 * smoothstep(1.8, 4.2, camDist));

    r.render(built.scene, camera);
  });

  // ----- HTML overlay: data read-outs projected from 3D -------------------
  const shellRot = new THREE.Matrix4().makeRotationY(shellSpin);
  const focusDist = cam.focus;
  const overlay = labels.map((l) => {
    const life = smoothstep(l.appear, l.appear + 0.6, t) * (1 - smoothstep(l.vanish, l.vanish + 0.8, t));
    if (life <= 0) return null;
    const world = tmp.copy(l.pos).applyMatrix4(shellRot);
    if (occluded(cam.position, world)) return null;
    const viewP = world.clone().applyMatrix4(camera.matrixWorldInverse);
    const depth = -viewP.z;
    if (depth < 0.08) return null;
    const ndc = world.clone().project(camera);
    if (Math.abs(ndc.x) > 1.2 || Math.abs(ndc.y) > 1.2) return null;
    const x = (ndc.x * 0.5 + 0.5) * width;
    const y = (-ndc.y * 0.5 + 0.5) * height;
    const scale = Math.min(9, (1.6 / depth) * l.size);
    const blur = Math.min(22, Math.abs(1 / depth - 1 / focusDist) * 9 * (height / 2160) * 2);
    const far = 1 - smoothstep(5.5, 8.5, depth);
    // flicker-in like a HUD element
    const flick = (life < 1 && t < l.vanish && Math.floor(t * 30 + l.id) % 3 === 0 ? 0.3 : 1) * life;
    const opacity = Math.min(1, flick * far * (0.55 + 0.45 * smoothstep(0.25, 1.2, depth)));
    if (opacity < 0.02) return null;
    const text = labelText(l, t);
    const fontPx = 30 * scale * (height / 2160);
    const style: React.CSSProperties = {
      position: "absolute",
      left: x,
      top: y,
      transform: "translate(-50%, -50%)",
      fontFamily: "'Roboto Mono', monospace",
      fontSize: fontPx,
      fontWeight: l.kind === "box" ? 500 : 400,
      whiteSpace: "nowrap",
      opacity,
      filter: blur > 0.6 ? `blur(${blur.toFixed(2)}px)` : undefined,
      zIndex: Math.round(1000 - depth * 100),
      letterSpacing: "0.04em",
    };
    if (l.kind === "box") {
      Object.assign(style, {
        color: "#0a1220",
        background: "rgba(235,242,255,0.92)",
        padding: `${fontPx * 0.08}px ${fontPx * 0.32}px`,
        borderRadius: fontPx * 0.08,
        boxShadow: `0 0 ${fontPx * 0.6}px rgba(150,190,255,0.45)`,
      });
    } else if (l.kind === "caption") {
      Object.assign(style, {
        color: "rgba(170,195,235,0.75)",
        fontSize: fontPx * 0.62,
        letterSpacing: "0.18em",
      });
    } else {
      Object.assign(style, {
        color: "#eef4ff",
        textShadow: `0 0 ${fontPx * 0.4}px rgba(140,185,255,0.8)`,
      });
    }
    return (
      <div key={l.id} style={style}>
        {text}
      </div>
    );
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width, height, position: "absolute" }} />
      <AbsoluteFill style={{ overflow: "hidden" }}>{overlay}</AbsoluteFill>
      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 75% 75% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
