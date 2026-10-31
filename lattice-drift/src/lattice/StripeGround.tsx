import React, { useMemo } from "react";
import * as THREE from "three";
import { FIELD_RADIUS, Palette } from "./constants";

const STRIPE_PERIOD = 0.2; // world units per light+dark stripe pair

// Floor with fine pinstripes, generated procedurally (no external assets).
export const StripeGround: React.FC<{ palette: Palette; angle: number }> = ({
  palette,
  angle,
}) => {
  const size = FIELD_RADIUS * 2 + 16;

  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const a = new THREE.Color(palette.groundA);
    const b = new THREE.Color(palette.groundB);
    for (let y = 0; y < canvas.height; y++) {
      // Soft-edged square wave so stripes stay clean when minified.
      const s = Math.sin((y / canvas.height) * Math.PI * 2);
      const m = THREE.MathUtils.smoothstep(s, -0.35, 0.35);
      const c = b.clone().lerp(a, m);
      ctx.fillStyle = `#${c.getHexString()}`;
      ctx.fillRect(0, y, canvas.width, 1);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(size / STRIPE_PERIOD, size / STRIPE_PERIOD);
    tex.center.set(0.5, 0.5);
    tex.rotation = angle;
    tex.anisotropy = 16;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }, [palette.groundA, palette.groundB, size, angle]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.95}
        metalness={0}
        dithering
      />
    </mesh>
  );
};
