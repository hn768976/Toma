import React, {useCallback} from 'react';
import * as THREE from 'three/webgpu';
import {Built, SceneContext, Stage} from '../core/Stage';
import {addContactShadow, addCyclorama, attachOverlays} from '../core/studio';
import {beamTexture} from '../core/textures';

/**
 * V4 - Edge-lit glass disc under a visible spotlight cone.
 * Ref D (istock 1487257611, 20.033s).
 *
 * The signature is the beam: the reference reads 93/255 at top-centre against
 * 31 at the top-left corner, i.e. a hard, narrow shaft of light entering frame
 * from above. Below it sits a very thin disc whose only bright feature is a
 * crisp elliptical rim highlight.
 */

const RADIUS = 2.0;
const HEIGHT = 0.075;
const WALL_Z = -1.6;

export const V4GlassBeam: React.FC = () => {
  const build = useCallback((ctx: SceneContext): Built => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070809');

    const camera = new THREE.PerspectiveCamera(30, ctx.width / ctx.height, 0.1, 200);
    scene.add(camera);

    addCyclorama(scene, {
      wall: {
        top: '#2b2e35',
        mid: '#30343e',
        bottom: '#26292f',
        hotspot: 'rgba(168,178,198,0.30)',
        hotY: 0.34,
        hotR: 0.34,
      },
      wallSize: [22, 12],
      wallY: 3.4,
      wallZ: WALL_Z,
      floorBase: '#0e1013',
      floorSize: [44, 38],
      pool: {
        stops: [
          [0, 0.34],
          [0.3, 0.18],
          [0.62, 0.05],
          [1, 0],
        ],
        color: '128,136,150',
        scaleX: 16,
        scaleZ: 8,
        z: -0.3,
        opacity: 0.55,
      },
    });

    // --- Thin glass disc --------------------------------------------------
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT, 176),
      new THREE.MeshStandardMaterial({
        color: '#262b33',
        roughness: 0.26,
        metalness: 0.42,
      }),
    );
    disc.position.y = HEIGHT / 2;
    scene.add(disc);

    // The crisp elliptical rim - the brightest thing in the lower frame.
    const rimTop = new THREE.Mesh(
      new THREE.TorusGeometry(RADIUS, 0.0052, 8, 220),
      new THREE.MeshBasicMaterial({color: '#6e7684', toneMapped: false}),
    );
    rimTop.rotation.x = -Math.PI / 2;
    rimTop.position.y = HEIGHT;
    scene.add(rimTop);

    const rimBottom = new THREE.Mesh(
      new THREE.TorusGeometry(RADIUS, 0.005, 8, 220),
      new THREE.MeshBasicMaterial({
        color: '#6f7887',
        toneMapped: false,
        transparent: true,
        opacity: 0.75,
      }),
    );
    rimBottom.rotation.x = -Math.PI / 2;
    scene.add(rimBottom);

    addContactShadow(scene, {
      width: RADIUS * 2.6,
      depth: RADIUS * 1.4,
      y: 0.004,
      z: 0.05,
      opacity: 0.6,
    });

    // --- Visible light shaft ----------------------------------------------
    // A camera-facing billboard rather than a cone mesh: once a cone is bright
    // enough to read, its far wall shows through its near wall and draws a hard
    // arch through the middle of the beam. A gaussian-falloff billboard behaves
    // like the scattering it stands in for.
    const BEAM_H = 7.0;
    const beam = new THREE.Mesh(
      new THREE.PlaneGeometry(4.0, BEAM_H),
      new THREE.MeshBasicMaterial({
        map: beamTexture(512),
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        color: new THREE.Color('#c9d6ea'),
      }),
    );
    beam.position.set(0, BEAM_H / 2 + 0.05, -0.9);
    scene.add(beam);

    // --- Light ------------------------------------------------------------
    const key = new THREE.SpotLight('#e2e8f2', 90, 26, Math.PI / 7, 0.85, 1.7);
    key.position.set(0, 6.4, -0.5);
    key.target.position.set(0, 0, 0);
    scene.add(key, key.target);

    const fill = new THREE.DirectionalLight('#5d6470', 0.4);
    fill.position.set(1.4, 1.0, 5.5);
    scene.add(fill);

    scene.add(new THREE.AmbientLight('#2a2f38', 0.6));

    attachOverlays(camera, {
      vignette: 0.40,
      grain: 3,
      aspect: ctx.width / ctx.height,
    });

    const update = (frame: number) => {
      const t = frame / ctx.durationInFrames;
      const loop = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);

      // Slow push-in and a barely-there beam flutter, both loop-closed.
      camera.position.set(0, 1.78 + 0.06 * loop, 7.2 - 0.28 * loop);
      camera.lookAt(0, 0.62, 0);

      const breathe = 1.0 + 0.05 * Math.sin(t * Math.PI * 4);
      (beam.material as THREE.MeshBasicMaterial).opacity = breathe;
      disc.rotation.y = t * 0.16;
      rimTop.rotation.z = -t * 0.16;
    };

    return {scene, camera, update};
  }, []);

  return <Stage build={build} background="#070809" />;
};
