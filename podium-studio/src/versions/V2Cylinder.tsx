import React, {useCallback} from 'react';
import * as THREE from 'three/webgpu';
import {Built, SceneContext, Stage} from '../core/Stage';
import {addContactShadow, addCyclorama, attachOverlays} from '../core/studio';
import {clamp, easeInOutCubic, easeOutQuint, lerp, span} from '../core/easing';

/**
 * V2 - Cylinder riser.  Ref B (istock 2199961442, 12.000s).
 *
 * Same studio series as ref A, so it shares V1's solved camera and cyclorama;
 * only the podium form and its timing differ. Measured off the reference: the
 * cylinder spans 0.300 to 0.689 of frame width (vs the slab's 0.169 to 0.828),
 * which sets the radius directly against V1's solved slab width.
 */

const RADIUS = 1.24; // solved from ref width 0.302-0.695 vs V1's slab
const HEIGHT = 0.5;
const WALL_Z = -0.965;

export const V2Cylinder: React.FC = () => {
  const build = useCallback((ctx: SceneContext): Built => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050505');

    const camera = new THREE.PerspectiveCamera(30, ctx.width / ctx.height, 0.1, 200);
    scene.add(camera);

    addCyclorama(scene, {
      wall: {
        top: '#121212',
        mid: '#161616',
        bottom: '#191919',
        hotspot: 'rgba(174,174,174,0.30)',
        hotY: 0.575,
        hotR: 0.45,
      },
      wallSize: [18, 8],
      wallY: 1.6,
      wallZ: WALL_Z,
      floorBase: '#191919',
      floorSize: [40, 34],
      pool: {
        stops: [
          [0, 0.4],
          [0.34, 0.22],
          [0.66, 0.055],
          [1, 0],
        ],
        color: '144,144,144',
        scaleX: 22,
        scaleZ: 13,
        z: -0.5,
        opacity: 0.34,
      },
    });

    const podium = new THREE.Mesh(
      new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT, 128),
      new THREE.MeshStandardMaterial({
        color: '#333333',
        roughness: 0.44,
        metalness: 0.24,
      }),
    );
    scene.add(podium);

    // Bright specular line where the top face rolls over into the side.
    const rimRing = new THREE.Mesh(
      new THREE.CylinderGeometry(RADIUS * 0.999, RADIUS * 0.999, 0.014, 160, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#4d4d4d',
        toneMapped: false,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    scene.add(rimRing);

    const shadow = addContactShadow(scene, {
      width: RADIUS * 4.4,
      depth: RADIUS * 3.0,
      y: 0.005,
      z: 0.12,
      opacity: 0.78,
    });

    const key = new THREE.SpotLight('#ffffff', 108, 34, Math.PI / 4.4, 1, 1.4);
    key.position.set(0.25, 7.2, 2.2);
    key.target.position.set(0, 0, 0);
    scene.add(key, key.target);

    const rim = new THREE.PointLight('#a0a0a0', 7, 16, 2);
    rim.position.set(-3.0, 1.7, -0.6);
    scene.add(rim);

    const fill = new THREE.DirectionalLight('#7a7a7a', 0.95);
    fill.position.set(1.6, 1.2, 6);
    scene.add(fill);

    scene.add(new THREE.AmbientLight('#393939', 0.7));

    attachOverlays(camera, {
      vignette: 0.46,
      grain: 3,
      aspect: ctx.width / ctx.height,
    });

    const update = (frame: number) => {
      const f = ctx.fps;
      // Reference reads empty at 0s, low at 2s, full at 8s, empty again by 10s.
      const rise = easeOutQuint(span(frame, 0, 7.0 * f));
      const fall = easeInOutCubic(span(frame, 7.6 * f, 10.4 * f));
      const reveal = clamp(rise - fall);

      // Buried below the floor rather than flush with it, so the retracted
      // state is a clean floor (a coplanar top face stays visible).
      podium.position.y = lerp(-HEIGHT / 2 - 0.03, HEIGHT / 2, reveal);
      rimRing.position.y = podium.position.y + HEIGHT / 2 - 0.007;
      const rimMat = rimRing.material as THREE.MeshBasicMaterial;
      rimMat.opacity = reveal;
      rimRing.visible = reveal > 0.02;
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.78 * reveal;

      const loop = 0.5 - 0.5 * Math.cos((frame / ctx.durationInFrames) * Math.PI * 2);
      // Pitched ~2.7deg further down than V1 to lift the podium in frame to the
      // measured reference position (top face at 0.578 of frame height).
      camera.position.set(0, lerp(2.42, 2.31, loop), lerp(6.5, 6.25, loop));
      camera.lookAt(0, lerp(0.47, 0.43, loop), 0);
    };

    return {scene, camera, update};
  }, []);

  return <Stage build={build} background="#050505" />;
};
