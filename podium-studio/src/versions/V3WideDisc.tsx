import React, {useCallback} from 'react';
import * as THREE from 'three/webgpu';
import {Built, SceneContext, Stage} from '../core/Stage';
import {addContactShadow, attachOverlays} from '../core/studio';

/**
 * V3 - Wide low disc in void.  Ref C (istock 1138641437, 40.040s).
 *
 * The odd one out: the reference background reads pure #000 in every corner,
 * so there is no cyclorama at all - the disc floats in black, lit only by a
 * soft top light that leaves a cool steel-teal sheen across its top face.
 *
 * Measured: disc spans 0.260 to 0.742 of frame width, top face at 0.638 and
 * front-bottom at 0.810. Forty seconds of near-stillness, so the motion is a
 * single very slow orbit that never repeats a position - the plate has to hold
 * up as a long, calm backdrop rather than read as a loop.
 */

const RADIUS = 1.9;
const HEIGHT = 0.273;

export const V3WideDisc: React.FC = () => {
  const build = useCallback((ctx: SceneContext): Built => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#000000');

    const camera = new THREE.PerspectiveCamera(30, ctx.width / ctx.height, 0.1, 200);
    scene.add(camera);

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(RADIUS, RADIUS * 0.995, HEIGHT, 160),
      new THREE.MeshStandardMaterial({
        // Very dark body; the teal only shows up where the light grazes it.
        color: '#28333a',
        roughness: 0.42,
        metalness: 0.28,
      }),
    );
    scene.add(disc);

    // Barely-there contact shading so the disc does not look pasted on black.
    const shadow = addContactShadow(scene, {
      width: RADIUS * 3.0,
      depth: RADIUS * 1.5,
      y: -HEIGHT / 2 + 0.004,
      z: 0.1,
      opacity: 0.5,
      color: '0,0,0',
    });
    shadow.visible = false; // pure black ground - nothing to darken

    // Cool key from high and slightly behind: this is what paints the teal
    // sheen across the top face and leaves the front edge nearly black.
    const key = new THREE.SpotLight('#8fb9c4', 30, 30, Math.PI / 4.0, 1, 1.5);
    key.position.set(-1.2, 3.6, -3.1);
    key.target.position.set(0, 0, 0);
    scene.add(key, key.target);

    const sheen = new THREE.DirectionalLight('#5d848e', 0.15);
    sheen.position.set(-2.0, 2.0, -3.8);
    scene.add(sheen);

    const frontFill = new THREE.DirectionalLight('#263238', 0.06);
    frontFill.position.set(0.8, 0.6, 5);
    scene.add(frontFill);

    scene.add(new THREE.AmbientLight('#0d1518', 0.3));

    attachOverlays(camera, {
      vignette: 0.55,
      grain: 2,
      aspect: ctx.width / ctx.height,
    });

    const update = (frame: number) => {
      const t = frame / ctx.durationInFrames; // 0..1 across the full 40s

      // One slow quarter-orbit plus a gentle rise - never returns to start, so
      // there is no visible loop seam to fight over a 40 second plate.
      // Solved against the reference: far top edge at 0.638 of frame height,
      // near bottom edge at 0.810, widest span 0.257 -> 0.754. That fixes the
      // camera at ~4.22R back and ~0.55R high, essentially level (0.35 deg down).
      const ang = (-9 + 18 * t) * (Math.PI / 180);
      const dist = 8.24 - 0.3 * Math.sin(t * Math.PI);
      camera.position.set(
        Math.sin(ang) * dist,
        1.3 + 0.06 * Math.sin(t * Math.PI),
        Math.cos(ang) * dist,
      );
      camera.lookAt(0, 1.112, 0);

      disc.rotation.y = t * 0.22;
    };

    return {scene, camera, update};
  }, []);

  return <Stage build={build} background="#000000" />;
};
