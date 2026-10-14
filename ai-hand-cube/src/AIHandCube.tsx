// One component for all four versions. Everything visible is derived from
// useCurrentFrame() through computeState(); objects are built once (seeded)
// and updated in a layout effect before Remotion asks R3F to draw the frame.
import { useThree } from "@react-three/fiber";
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { loadFonts } from "./lib/fonts";
import { computeState, SceneState } from "./lib/timeline";
import { buildBackground } from "./scene/background";
import { buildCube, CUBE_SIZE } from "./scene/cube";
import { buildEnvironment } from "./scene/environment";
import { buildHand } from "./scene/hand";
import { buildHud, buildPanelDefs } from "./scene/hud";
import { buildLights } from "./scene/lights";
import { buildHandMaterials } from "./scene/materials";
import { buildParticles } from "./scene/particles";
import { RenderRefs, Stage } from "./scene/Stage";
import { Version, VERSIONS } from "./versions";

const DEG = Math.PI / 180;
const SQUARE_LIFT = 0.07; // glow square height above the palm anchor (palm units)

// Scene constants (world units: palm width ~ 1)
export const SCENE = {
  fov: 26,
  camDist: 5.0,
  camDrop: 0.48, // camera sits slightly below the cube centre (underside visible)
  lookDrop: 0.26, // look slightly below the cube so the hand fits
  palmAnchor: new THREE.Vector3(-0.03, 0.1, 0.02), // where the cube sits (palm local)
  floatGap: 0.07, // gap between palm and cube bottom once floating
  handTilt: 36 * DEG, // palm tilted toward the camera
  handYaw: 2 * DEG, // fingers point toward the viewer
  handRoll: -4 * DEG,
  handScale: 1.0,
  wristBend: -54 * DEG, // forearm runs straight away from camera, hidden behind palm and cube
  cubeWorld: new THREE.Vector3(0, 0, 0),
  // CoC = K * max(0, |1 - focus/z| - band): the cube (+-0.4 around its centre) stays sharp
  dof: { nearK: 0.17, farK: 0.05, maxCoc: 0.02, band: 0.095 },
};

/** Camera placement shared by the frame update and the Mirrored panel filter. */
const placeCamera = (cam: THREE.PerspectiveCamera, st: SceneState, v: Version, W: number, H: number) => {
  const target = SCENE.cubeWorld.clone().add(new THREE.Vector3(0, -SCENE.lookDrop, 0));
  const dist = SCENE.camDist * (1 - 0.07 * st.camPush);
  const camY = SCENE.cubeWorld.y - SCENE.camDrop;
  const pitch = Math.atan2(camY - target.y, dist) + st.camPitch;
  cam.fov = SCENE.fov;
  cam.aspect = W / H;
  cam.position.set(
    target.x + dist * Math.cos(pitch) * Math.sin(st.camYaw),
    target.y + dist * Math.sin(pitch),
    target.z + dist * Math.cos(pitch) * Math.cos(st.camYaw),
  );
  cam.lookAt(target);
  // framing: shift the image so the cube lands at framing.cubeScreenX
  const dx = (v.framing.cubeScreenX - 0.5) * W;
  if (Math.abs(dx) > 0.5) cam.setViewOffset(W, H, -dx, 0, W, H);
  else cam.clearViewOffset();
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
};

const cocFn = (focus: number, heightPx: number) => (z: number) => {
  const { nearK, farK, maxCoc, band } = SCENE.dof;
  const d = Math.max(0, (z < focus ? focus / z - 1 : 1 - focus / z) - band);
  return Math.min((z < focus ? nearK : farK) * d, maxCoc) * heightPx;
};

const Scene: React.FC<{ v: Version; refs: RenderRefs }> = ({ v, refs }) => {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const frame = useCurrentFrame();
  const p = v.palette;

  const objs = useMemo(() => {
    const env = buildEnvironment(gl, p);
    const handMats = buildHandMaterials(p, env);
    // in the scene the hand is lit mostly by the cube: dimmer reflections
    (handMats.shell as THREE.MeshPhysicalMaterial).envMapIntensity = 1.0;
    (handMats.metal as THREE.MeshPhysicalMaterial).envMapIntensity = 0.6;
    const hand = buildHand(handMats);
    const bg = buildBackground();
    bg.material.uniforms.uBase.value.set(p.background);
    bg.material.uniforms.uGlow.value.set(p.glow);
    const lights = buildLights(p);
    lights.key.intensity *= 0.6; // the hand sits partly in shadow under the cube
    lights.rimL.intensity *= 0.7;
    lights.rimR.intensity *= 0.7;
    const cube = buildCube(p, env, v.cubeText);
    // the glowing square lies on the palm, so it moves with the hand
    cube.square.position.copy(SCENE.palmAnchor).add(new THREE.Vector3(0, SQUARE_LIFT, 0));
    cube.square.scale.setScalar(1 / SCENE.handScale); // palm group is scaled
    hand.root.children[0].add(cube.square);
    const main = new THREE.Group();
    main.add(bg.mesh, hand.root, lights.group, cube.group);

    // HUD + particles live in their own scene (self-blurred, depth-tested
    // against the main scene)
    let defs = buildPanelDefs();
    if (v.framing.clearLeft) {
      // keep the left half clear: drop panels that would land there, except a
      // few far, soft ones
      // project through the real camera of this version (frame 0)
      const probe = new THREE.PerspectiveCamera(SCENE.fov, 16 / 9, 0.1, 60);
      placeCamera(probe, computeState(0, v), v, 1920, 1080);
      let farKept = 0;
      defs = defs.filter((d) => {
        const left = new THREE.Vector3(d.pos[0] - d.size[0] / 2, d.pos[1], d.pos[2])
          .add(SCENE.cubeWorld)
          .project(probe);
        if (left.x * 0.5 + 0.5 >= 0.52) return true;
        if (d.pos[2] < -1.5 && farKept < 3) {
          farKept++;
          d.opacity *= 0.35;
          return true;
        }
        return false;
      });
    }
    const hud = buildHud(defs, p.hud, p.hudAccent);
    const particles = buildParticles(p.circuit);
    const hudScene = new THREE.Scene();
    hudScene.add(hud.group, particles.points);
    return { hand, bg, lights, cube, main, hud, particles, hudScene };
  }, [gl, p, v]);

  useLayoutEffect(() => {
    const st = computeState(frame, v);
    const { hand, bg, lights, cube, hud, particles } = objs;
    const cam = refs.camera;
    const W = size.width * gl.getPixelRatio();
    const H = size.height * gl.getPixelRatio();

    // --- hand: rise into frame and settle palm-up ------------------------------
    const rise = st.handRise;
    const rot = new THREE.Euler(
      SCENE.handTilt - (1 - rise) * 1.05,
      SCENE.handYaw - (1 - rise) * 0.35,
      SCENE.handRoll,
      "YXZ",
    );
    hand.root.rotation.copy(rot);
    hand.root.scale.setScalar(SCENE.handScale);
    hand.setWrist(SCENE.wristBend);
    // place the hand so the palm anchor sits under the cube's floating spot
    const anchorRot = SCENE.palmAnchor.clone().multiplyScalar(SCENE.handScale).applyEuler(
      new THREE.Euler(SCENE.handTilt, SCENE.handYaw, SCENE.handRoll, "YXZ"),
    );
    const floatBottom = SCENE.cubeWorld.clone().add(new THREE.Vector3(0, -CUBE_SIZE / 2 - SCENE.floatGap, 0));
    hand.root.position.copy(floatBottom).sub(anchorRot);
    hand.root.position.y -= (1 - rise) * 2.8;
    hand.root.position.z -= (1 - rise) * 0.4;
    hand.setPose(st.fingerCurl);
    hand.root.updateMatrixWorld(true);

    // --- cube: builds on the palm, lifts to float, turns ----------------------
    const anchorWorld = SCENE.palmAnchor.clone().applyMatrix4(hand.root.matrixWorld);
    // the cube starts lying on the palm (aligned with it, sitting on the
    // glowing square) and straightens upright as it lifts to float
    const lift = st.cubeLift;
    const palmQ = hand.root.quaternion.clone();
    const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, st.cubeRotY - SCENE.handYaw, 0));
    const qPalm = palmQ.clone().multiply(spin);
    const qUp = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, st.cubeRotY, 0));
    cube.group.quaternion.copy(qPalm).slerp(qUp, lift);
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(palmQ);
    const onPalm = anchorWorld.clone().addScaledVector(normal, SQUARE_LIFT * SCENE.handScale + 0.004 + CUBE_SIZE / 2);
    const floating = anchorWorld.clone().add(new THREE.Vector3(0, SCENE.floatGap + CUBE_SIZE / 2, 0));
    cube.group.position.copy(onPalm).lerp(floating, lift);
    cube.group.position.y += st.cubeBob;
    // the square on the palm turns with the cube (around the palm normal)
    cube.square.rotation.set(0, st.cubeRotY - SCENE.handYaw, 0);
    cube.update(st);

    // --- camera ----------------------------------------------------------------
    placeCamera(cam, st, v, W, H);

    // --- lights ----------------------------------------------------------------
    lights.cube.position.copy(cube.group.position);
    lights.cube.intensity = 0.45 * (0.45 * st.squareGlow + 1.0 * st.innerGlow + 1.0 * st.aiFlash);

    // --- background glow follows the cube on screen --------------------------
    const sp = cube.group.position.clone().project(cam);
    bg.material.uniforms.uGlowPos.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5 - 0.02);
    bg.material.uniforms.uAspect.value = W / H;
    bg.material.uniforms.uGlowStrength.value = 0.4 + 0.14 * st.innerGlow + 0.12 * st.aiFlash;

    // --- HUD + particles ---------------------------------------------------------
    const focus = cam.position.distanceTo(cube.group.position);
    const coc = cocFn(focus, H);
    objs.hud.group.position.copy(SCENE.cubeWorld);
    hud.update(st.frame, v.durationInFrames, st.hudOpacity, st.hudDrift, cam, coc, H);
    const pm = particles.material.uniforms;
    pm.uTime.value = st.t;
    pm.uStart.value = st.particleStart;
    pm.uAmount.value = st.particles * 0.35;
    pm.uOrigin.value.copy(anchorWorld);
    pm.uFocus.value = focus;
    pm.uNearK.value = SCENE.dof.nearK;
    pm.uFarK.value = SCENE.dof.farK;
    pm.uMaxCoc.value = SCENE.dof.maxCoc;
    pm.uFocusBand.value = SCENE.dof.band;
    pm.uHeightPx.value = H;

    refs.hudScene = objs.hudScene;
    Object.assign(refs.params, {
      frameMod: st.frameMod,
      focus,
      focusBand: SCENE.dof.band,
      nearK: SCENE.dof.nearK,
      farK: SCENE.dof.farK,
      maxCoc: SCENE.dof.maxCoc,
      dof: true,
    });
  }, [frame, objs, refs, v, gl, size]);

  return <primitive object={objs.main} />;
};

export const AIHandCube: React.FC<{ versionId: string }> = ({ versionId }) => {
  const v = VERSIONS.find((x) => x.id === versionId) ?? VERSIONS[0];
  const { width, height } = useVideoConfig();
  const refs = useMemo<RenderRefs>(
    () => ({
      camera: new THREE.PerspectiveCamera(SCENE.fov, width / height, 0.1, 60),
      hudScene: null,
      params: {
        frameMod: 0,
        focus: 4,
        focusBand: SCENE.dof.band,
        nearK: SCENE.dof.nearK,
        farK: SCENE.dof.farK,
        maxCoc: SCENE.dof.maxCoc,
        dof: true,
        bloomStrength: 1.0,
        bloomThreshold: 1.15,
        exposure: 1.0,
        grain: 0.015,
        vignette: 0.55,
      },
    }),
    [width, height],
  );
  // fonts must be loaded before textures are drawn
  const [handle] = useState(() => delayRender("Loading OFL fonts"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadFonts().then(() => setReady(true));
  }, []);
  useEffect(() => {
    // released only after the canvas has mounted (and registered its own delay)
    if (ready) continueRender(handle);
  }, [ready, handle]);
  return (
    <AbsoluteFill style={{ backgroundColor: v.palette.background }}>
      {ready ? (
        <Stage refs={refs}>
          <Scene v={v} refs={refs} />
        </Stage>
      ) : null}
    </AbsoluteFill>
  );
};
