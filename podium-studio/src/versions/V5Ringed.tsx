import React, {useCallback} from 'react';
import * as THREE from 'three/webgpu';
import {Built, SceneContext, Stage} from '../core/Stage';
import {addContactShadow, addCyclorama, attachOverlays} from '../core/studio';
import {concentricRings, ringAlpha} from '../core/textures';

/**
 * V5 - Layered podium with radiating floor rings.
 * Ref E (istock 1487260677, 20.033s).
 *
 * Measured: podium top face at 0.669 of frame height, with concentric rings
 * crossing the floor out to the frame edge (picked up at x=0.066 on row 0.85).
 * The rings are the motion - they travel outward continuously and fade at the
 * rim, on a cycle that divides the 600 frame duration exactly so the plate
 * loops without a seam.
 */

const RADIUS = 1.5;
const HEIGHT = 0.46;
const BASE_R = RADIUS * 1.06;
const RING_COUNT = 6;
const RING_CYCLE = 200; // frames; 600 / 200 = 3 exact cycles

export const V5Ringed: React.FC = () => {
  const build = useCallback((ctx: SceneContext): Built => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030405');

    const camera = new THREE.PerspectiveCamera(30, ctx.width / ctx.height, 0.1, 200);
    scene.add(camera);

    addCyclorama(scene, {
      wall: {
        top: '#020304',
        mid: '#060809',
        bottom: '#090c0f',
        hotspot: 'rgba(58,74,96,0.30)',
        hotY: 0.6,
        hotR: 0.42,
      },
      wallSize: [30, 14],
      wallY: 4.0,
      wallZ: -7.5,
      floorBase: '#05070a',
      floorSize: [60, 50],
      pool: {
        stops: [
          [0, 0.26],
          [0.32, 0.13],
          [0.66, 0.035],
          [1, 0],
        ],
        color: '96,120,158',
        scaleX: 20,
        scaleZ: 12,
        z: -0.8,
        opacity: 0.5,
      },
    });

    // --- Podium: base plinth + main body + grooved top ---------------------
    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#23282e',
      roughness: 0.42,
      metalness: 0.42,
    });

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(BASE_R, BASE_R, 0.1, 128),
      bodyMat,
    );
    base.position.y = 0.05;
    scene.add(base);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT, 128),
      bodyMat,
    );
    body.position.y = 0.1 + HEIGHT / 2;
    scene.add(body);

    // Machined concentric grooves on the top face.
    const top = new THREE.Mesh(
      new THREE.CircleGeometry(RADIUS * 0.995, 128),
      new THREE.MeshStandardMaterial({
        color: '#2e343c',
        roughness: 0.33,
        metalness: 0.38,
        map: concentricRings(6, 'rgba(226,238,255,0.92)', 3.0, '#7d858f'),
      }),
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.1 + HEIGHT + 0.001;
    scene.add(top);

    // Cool rim highlights on both lips.
    const mkRim = (r: number, y: number, color: string, thick: number) => {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(r, thick, 8, 200),
        new THREE.MeshBasicMaterial({color, toneMapped: false}),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      scene.add(m);
      return m;
    };
    mkRim(RADIUS, 0.1 + HEIGHT, '#6c7f99', 0.0042);
    mkRim(BASE_R, 0.1, '#47566b', 0.0035);

    addContactShadow(scene, {
      width: BASE_R * 3.4,
      depth: BASE_R * 1.9,
      y: 0.004,
      z: 0.06,
      opacity: 0.66,
    });

    // --- Radiating floor rings -------------------------------------------
    const rings = Array.from({length: RING_COUNT}, () => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: ringAlpha(0.5, 0.012),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
          color: new THREE.Color('#7d97b8'),
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.003;
      scene.add(m);
      return m;
    });

    // --- Light ------------------------------------------------------------
    const key = new THREE.SpotLight('#d2dced', 120, 28, Math.PI / 4.4, 1, 1.4);
    key.position.set(0.4, 6.0, 2.0);
    key.target.position.set(0, 0, 0);
    scene.add(key, key.target);

    const rimL = new THREE.PointLight('#5f7ea6', 14, 14, 2);
    rimL.position.set(-2.6, 1.3, -1.6);
    scene.add(rimL);

    const rimR = new THREE.PointLight('#42566f', 9, 12, 2);
    rimR.position.set(2.8, 1.1, -1.2);
    scene.add(rimR);

    const sideFill = new THREE.DirectionalLight('#59677c', 0.5);
    sideFill.position.set(1.2, 0.8, 5.5);
    scene.add(sideFill);

    scene.add(new THREE.AmbientLight('#1c242e', 0.9));

    attachOverlays(camera, {
      vignette: 0.72,
      grain: 2,
      aspect: ctx.width / ctx.height,
    });

    const update = (frame: number) => {
      const t = frame / ctx.durationInFrames;

      rings.forEach((ring, i) => {
        // Evenly staggered phases; each ring travels out and fades at the rim.
        const phase = ((frame / RING_CYCLE) + i / RING_COUNT) % 1;
        const size = 4.0 + phase * 46;
        ring.scale.set(size, size, 1);
        const mat = ring.material as THREE.MeshBasicMaterial;
        // Fade in off the podium, fade out into the darkness at the edge.
        mat.opacity = Math.sin(phase * Math.PI) ** 1.2 * 0.3;
      });

      const loop = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
      camera.position.set(0, 1.92 + 0.06 * loop, 6.35 - 0.22 * loop);
      camera.lookAt(0, 0.74, 0);
      body.rotation.y = t * 0.1;
      top.rotation.z = -t * 0.1;
    };

    return {scene, camera, update};
  }, []);

  return <Stage build={build} background="#030405" />;
};
