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
  buildRings,
  buildShell,
  buildSpace,
  buildSpikes,
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
      land: { geo: buildLand(SEED, P), mat: makePointMaterial({ mode: 0, facing: true, minPx: 1.4, opacity: 1.35 }) },
      ocean: { geo: buildOceanGrid(SEED, P), mat: makePointMaterial({ mode: 0, facing: true, minPx: 1.2 }) },
      spikes: { geo: buildSpikes(SEED, P), mat: makePointMaterial({ mode: 3, minPx: 1.4 }) },
      rings: { geo: buildRings(SEED, P), mat: makePointMaterial({ mode: 1, minPx: 1.6 }) },
      arcs: { geo: buildArcs(SEED, P), mat: makePointMaterial({ mode: 2, minPx: 1.8 }) },
      haze: { geo: buildHaze(SEED, P), mat: makePointMaterial({ mode: 0, facing: true, minPx: 1.3, opacity: 0.8 }) },
      sparks: { geo: buildRedSparks(SEED, P), mat: makePointMaterial({ mode: 0, minPx: 2 }) },
      shell: { geo: buildShell(SEED, P), mat: makePointMaterial({ mode: 0, rimBoost: 5, opacity: 0.22, minPx: 1.4 }) },
      dust: { geo: space.dust, mat: makePointMaterial({ mode: 0, minPx: 1.6 }) },
      triangles: { geo: space.triangles, mat: makePointMaterial({ mode: 0, minPx: 1.4, opacity: 0.8 }) },
      rays: { geo: space.rays, mat: makePointMaterial({ mode: 0, minPx: 1.4 }) },
      icons: { geo: buildIcons(SEED), mat: makeIconMaterial(atlas) },
      oceanMat: new THREE.MeshBasicMaterial({ color: PALETTE.ocean }),
      innerRim: makeAtmosphereMaterial(PALETTE.rim, 4.0, 1.35, THREE.FrontSide),
      outerGlow: makeAtmosphereMaterial(PALETTE.rim, 6.0, 0.7, THREE.BackSide),
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
        <mesh geometry={assets.sphereGeo} material={assets.innerRim} scale={1.0} renderOrder={1} />
        <points geometry={assets.ocean.geo} material={assets.ocean.mat} renderOrder={2} />
        <points geometry={assets.land.geo} material={assets.land.mat} renderOrder={3} />
        <points geometry={assets.haze.geo} material={assets.haze.mat} renderOrder={4} />
        <points geometry={assets.spikes.geo} material={assets.spikes.mat} renderOrder={4} />
        <points geometry={assets.arcs.geo} material={assets.arcs.mat} renderOrder={5} />
        <points geometry={assets.icons.geo} material={assets.icons.mat} renderOrder={6} />
      </group>
      <mesh geometry={assets.sphereGeo} material={assets.outerGlow} scale={1.14} renderOrder={1} />
      {/* Orbital rings, slightly tilted, rotating slowly on their own */}
      <group rotation={[0.06, t * 0.05, -0.07]}>
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
