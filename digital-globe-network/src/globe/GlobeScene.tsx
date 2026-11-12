import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { cameraAt, facingLongitude, type CameraVariant } from "./cameraPaths";
import {
  buildArcs,
  buildHaze,
  buildIconAtlas,
  buildIcons,
  buildLand,
  buildOceanGrid,
  buildRedSparks,
  buildRimFuzz,
  buildRings,
  buildShell,
  buildSpace,
  buildSpikes,
  buildSurfaceMesh,
  PALETTE,
} from "./layers";
import { DEG, smoothstep } from "./math";
import { makeAtmosphereMaterial, makeIconMaterial, makePointMaterial } from "./shaders";

export const FOV = 35;
const SEED = 7331;

export const GlobeScene: React.FC<{ variant: CameraVariant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const { camera } = useThree();

  const assets = useMemo(() => {
    const P = PALETTE;
    const space = buildSpace(SEED, P);
    const atlas = buildIconAtlas();
    return {
      land: { geo: buildLand(SEED, P), mat: makePointMaterial({ mode: 0, facing: true, back: 0.12, minPx: 1.6, opacity: 2.05 }) },
      ocean: { geo: buildOceanGrid(SEED, P), mat: makePointMaterial({ mode: 0, facing: true, back: 0.05, minPx: 1.2, opacity: 0.9 }) },
      fuzz: { geo: buildRimFuzz(SEED, P), mat: makePointMaterial({ mode: 0, rimBoost: 22, minPx: 1.3, opacity: 0.25, occlusion: 0.3 }) },
      mesh: { geo: buildSurfaceMesh(SEED, P), mat: makePointMaterial({ mode: 0, facing: true, back: 0.12, minPx: 1.3, opacity: 1.2 }) },
      spikes: { geo: buildSpikes(SEED, P), mat: makePointMaterial({ mode: 3, minPx: 1.4 }) },
      rings: { geo: buildRings(SEED, P), mat: makePointMaterial({ mode: 1, minPx: 1.6, occlusion: 0.3 }) },
      arcs: { geo: buildArcs(SEED, P), mat: makePointMaterial({ mode: 2, minPx: 1.8, occlusion: 0.25 }) },
      haze: { geo: buildHaze(SEED, P), mat: makePointMaterial({ mode: 0, facing: true, minPx: 1.3, opacity: 0.8 }) },
      sparks: { geo: buildRedSparks(SEED, P), mat: makePointMaterial({ mode: 0, minPx: 2 }) },
      shell: { geo: buildShell(SEED, P), mat: makePointMaterial({ mode: 0, rimBoost: 7, opacity: 0.42, minPx: 1.4, occlusion: 0.25 }) },
      dust: { geo: space.dust, mat: makePointMaterial({ mode: 0, minPx: 1.6, occlusion: 0.3 }) },
      triangles: { geo: space.triangles, mat: makePointMaterial({ mode: 0, minPx: 1.4, opacity: 3.2, occlusion: 0.3 }) },
      rays: { geo: space.rays, mat: makePointMaterial({ mode: 0, minPx: 1.4, occlusion: 0.3 }) },
      icons: { geo: buildIcons(SEED), mat: makeIconMaterial(atlas) },
      // See-through hologram body: dark blue, partially transparent
      oceanMat: new THREE.MeshBasicMaterial({ color: PALETTE.ocean, transparent: true, opacity: 0.88, depthWrite: false }),
      innerHaze: makeAtmosphereMaterial(new THREE.Color("#2f6fd0"), 1.6, 0.02, THREE.FrontSide, true),
      innerRim: makeAtmosphereMaterial(PALETTE.rim, 3.2, 0.5, THREE.FrontSide),
      outerGlow: makeAtmosphereMaterial(PALETTE.rim, 3.0, 0.32, THREE.BackSide),
      sphereGeo: new THREE.SphereGeometry(1, 128, 96),
    };
  }, []);

  const t = frame / fps;
  const cam = cameraAt(variant, t);
  const spin = -facingLongitude(t) * DEG;

  useLayoutEffect(() => {
    const pc = camera as THREE.PerspectiveCamera;
    pc.fov = FOV;
    pc.near = 0.005;
    pc.far = 60;
    pc.position.copy(cam.position);
    pc.up.set(0, 1, 0);
    pc.lookAt(cam.target);
    pc.rotateZ(cam.roll);
    pc.updateProjectionMatrix();
    pc.updateMatrixWorld();

    const pixelScale = height / (2 * Math.tan((FOV * DEG) / 2));
    const pointLayers = [
      assets.land,
      assets.ocean,
      assets.spikes,
      assets.rings,
      assets.arcs,
      assets.sparks,
      assets.haze,
      assets.fuzz,
      assets.mesh,
      assets.shell,
      assets.dust,
      assets.triangles,
      assets.rays,
    ];
    for (const l of pointLayers) {
      l.mat.uniforms.uTime.value = t;
      l.mat.uniforms.uPixelScale.value = pixelScale;
      l.mat.uniforms.uFocus.value = cam.focus;
      l.mat.uniforms.uAperture.value = cam.aperture;
    }
    // Slightly lower exposure on the close-up intro (V1), easing to full by ~4 s.
    const introExposure = variant === "reference" ? 0.72 + 0.28 * smoothstep(1, 4.5, t) : 1;
    assets.land.mat.uniforms.uOpacity.value = 2.05 * introExposure;
    assets.ocean.mat.uniforms.uOpacity.value = 0.9 * introExposure;
    // The orange data arcs and padlock icons build up as the network "comes online".
    const reveal = variant === "reference" ? smoothstep(6.5, 11, t) : smoothstep(2, 7, t);
    assets.arcs.mat.uniforms.uReveal.value = variant === "reference" ? smoothstep(2.5, 5, t) : smoothstep(1, 3.5, t);
    const im = assets.icons.mat;
    im.uniforms.uTime.value = t;
    im.uniforms.uPixelScale.value = pixelScale;
    im.uniforms.uReveal.value = reveal;
    im.uniforms.uFocus.value = cam.focus;
    im.uniforms.uAperture.value = cam.aperture;
  }, [assets, cam, camera, height, t, variant]);

  return (
    <>
      {/* Globe: rotates about its axis */}
      <group rotation={[0, spin, 0]}>
        <mesh geometry={assets.sphereGeo} material={assets.oceanMat} scale={0.996} renderOrder={0} />
        <mesh geometry={assets.sphereGeo} material={assets.innerHaze} scale={0.998} renderOrder={1} />
        <mesh geometry={assets.sphereGeo} material={assets.innerRim} scale={1.0} renderOrder={1} />
        <points geometry={assets.mesh.geo} material={assets.mesh.mat} renderOrder={4} />
        <points geometry={assets.fuzz.geo} material={assets.fuzz.mat} renderOrder={4} />
        <points geometry={assets.ocean.geo} material={assets.ocean.mat} renderOrder={2} />
        <points geometry={assets.land.geo} material={assets.land.mat} renderOrder={3} />
        <points geometry={assets.haze.geo} material={assets.haze.mat} renderOrder={4} />
        <points geometry={assets.spikes.geo} material={assets.spikes.mat} renderOrder={4} />
        <points geometry={assets.arcs.geo} material={assets.arcs.mat} renderOrder={5} />
        <points geometry={assets.icons.geo} material={assets.icons.mat} renderOrder={6} />
      </group>
      <mesh geometry={assets.sphereGeo} material={assets.outerGlow} scale={1.22} renderOrder={1} />
      {/* Orbital rings, slightly tilted, rotating slowly on their own */}
      <group rotation={[0.1 + 0.05 * Math.sin(t * 0.17), t * 0.05, -0.12 + 0.04 * Math.sin(t * 0.11 + 1)]}>
        <points geometry={assets.rings.geo} material={assets.rings.mat} renderOrder={7} />
      </group>
      <group rotation={[0, spin * 0.6, 0]}>
        <points geometry={assets.sparks.geo} material={assets.sparks.mat} renderOrder={8} />
      </group>
      <group rotation={[0.3, -t * 0.02, 0.15]}>
        <points geometry={assets.shell.geo} material={assets.shell.mat} renderOrder={9} />
      </group>
      <group rotation={[0, t * 0.015, 0]}>
        <points geometry={assets.dust.geo} material={assets.dust.mat} renderOrder={10} />
        <points geometry={assets.triangles.geo} material={assets.triangles.mat} renderOrder={10} />
        <points geometry={assets.rays.geo} material={assets.rays.mat} renderOrder={10} />
      </group>
    </>
  );
};
