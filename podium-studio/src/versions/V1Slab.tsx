import React, {useCallback} from 'react';
import * as THREE from 'three/webgpu';
import {Built, SceneContext, Stage} from '../core/Stage';
import {addContactShadow, addCyclorama, attachOverlays} from '../core/studio';
import {clamp, easeInOutCubic, easeOutQuint, lerp, span} from '../core/easing';

/**
 * V1 - Rectangular slab riser.  Ref A (istock 2199961880, 12.000s).
 *
 * Seamless loop: the slab emerges from a flush floor, settles at full height,
 * then retracts back into the floor so frame 0 and frame 360 match exactly.
 *
 * Camera and set proportions were solved from landmark positions measured off
 * the reference (wall/floor seam at 0.630 of frame height, slab top-front edge
 * at 0.632, top-back at 0.551, front-bottom at ~0.764, slab spanning 0.169 to
 * 0.828 horizontally). That solve gives a deliberately tight box set: the back
 * wall sits just behind the podium, which is what creates the halo.
 */

// Solved slab proportions, W : H : D = 3.72 : 0.463 : 1.0
const W = 3.72;
const H = 0.463;
const D = 1.0;

const WALL_Z = -0.965;

export const V1Slab: React.FC = () => {
  const build = useCallback((ctx: SceneContext): Built => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050505');

    const camera = new THREE.PerspectiveCamera(30, ctx.width / ctx.height, 0.1, 200);
    scene.add(camera);

    addCyclorama(scene, {
      wall: {
        top: '#131313',
        mid: '#171717',
        bottom: '#1a1a1a',
        hotspot: 'rgba(178,178,178,0.30)',
        hotY: 0.575,
        hotR: 0.47,
      },
      wallSize: [18, 8],
      wallY: 1.6,
      wallZ: WALL_Z,
      floorBase: '#1a1a1a',
      floorSize: [40, 34],
      pool: {
        stops: [
          [0, 0.40],
          [0.34, 0.22],
          [0.66, 0.055],
          [1, 0],
        ],
        color: '146,146,146',
        scaleX: 27,
        scaleZ: 15,
        // Centred behind the podium so the slab occludes the hot core and the
        // floor in front of it only catches the gentle outer falloff.
        z: -0.5,
        opacity: 0.33,
      },
    });

    // --- Slab -------------------------------------------------------------
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(W, H, D),
      new THREE.MeshStandardMaterial({
        color: '#343434',
        roughness: 0.44,
        metalness: 0.28,
      }),
    );
    scene.add(slab);

    // Specular catch along the top-front edge: the main cue separating the lit
    // top face from the much darker front face.
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.999, 0.006, 0.006),
      new THREE.MeshBasicMaterial({color: '#5e5e5e', toneMapped: false, transparent: true}),
    );
    scene.add(edge);

    const shadow = addContactShadow(scene, {
      width: W * 1.5,
      depth: D * 3.4,
      y: 0.005,
      z: D * 0.15,
      opacity: 0.8,
    });

    // --- Light ------------------------------------------------------------
    const key = new THREE.SpotLight('#ffffff', 145, 34, Math.PI / 4.4, 1, 1.5);
    key.position.set(0.25, 7.2, 2.2);
    key.target.position.set(0, 0, 0);
    scene.add(key, key.target);

    const rim = new THREE.PointLight('#a0a0a0', 7, 16, 2);
    rim.position.set(-3.2, 1.7, -0.6);
    scene.add(rim);

    const fill = new THREE.DirectionalLight('#707070', 0.6);
    fill.position.set(1.6, 1.2, 6);
    scene.add(fill);

    scene.add(new THREE.AmbientLight('#3a3a3a', 0.75));

    attachOverlays(camera, {
      vignette: 0.42,
      grain: 3,
      aspect: ctx.width / ctx.height,
    });

    const update = (frame: number) => {
      const f = ctx.fps;

      // Rise 0 -> 6.0s, hold to 6.6s, retract to 11.2s, flush 11.2 -> 12s.
      const rise = easeOutQuint(span(frame, 0, 6.0 * f));
      const fall = easeInOutCubic(span(frame, 6.6 * f, 11.2 * f));
      const reveal = clamp(rise - fall);

      // Buried: top face flush with the floor. Revealed: bottom face on it.
      slab.position.y = lerp(-H / 2, H / 2, reveal);
      edge.position.set(0, slab.position.y + H / 2, D / 2);

      const edgeMat = edge.material as THREE.MeshBasicMaterial;
      edgeMat.opacity = reveal;
      edge.visible = reveal > 0.02;
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.8 * reveal;

      // Slow symmetric breathing push so the loop closes without a jump.
      const loop = 0.5 - 0.5 * Math.cos((frame / ctx.durationInFrames) * Math.PI * 2);
      camera.position.set(0, lerp(2.42, 2.30, loop), lerp(6.55, 6.28, loop));
      camera.lookAt(0, lerp(0.80, 0.76, loop), 0);
    };

    return {scene, camera, update};
  }, []);

  return <Stage build={build} background="#050505" />;
};
