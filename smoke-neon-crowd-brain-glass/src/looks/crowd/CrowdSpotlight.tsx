import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Pipeline } from "../../lib/three/Pipeline";
import { SceneFactory, ThreeStage } from "../../lib/three/ThreeStage";
import { createDofPass, createLinearDepthMaterial } from "../../lib/three/dof";
import { radialTexture } from "../../lib/three/textures";
import { keyed3, monotoneCubic } from "../../lib/curve";
import { mulberry32, smoothstep } from "../../lib/rng";
import type { CrowdColors } from "../../versions";

const COLS = 15;
const ROWS = 14;
const SX = 2.2; // spacing across
const SZ = 2.2; // spacing in depth
const FX_LAYER = 1; // additive glow sprites/rings — excluded from the depth pass

/** Bust icon: extruded shoulders + head, shirt "V" and tie inset on the front.
 * Vertex colours carry the shading (body 1, shirt lighter, tie dark). */
const buildBust = () => {
  const bevel = { bevelEnabled: true, bevelSegments: 3, steps: 1, curveSegments: 18 };
  const body = new THREE.Shape();
  body.moveTo(-0.68, 0);
  body.lineTo(0.68, 0);
  body.lineTo(0.68, 0.42);
  body.quadraticCurveTo(0.68, 0.7, 0.42, 0.75);
  body.lineTo(0.18, 0.8);
  body.lineTo(-0.18, 0.8);
  body.lineTo(-0.42, 0.75);
  body.quadraticCurveTo(-0.68, 0.7, -0.68, 0.42);
  body.closePath();
  const D = 0.34;
  const gBody = new THREE.ExtrudeGeometry(body, { ...bevel, depth: D, bevelSize: 0.05, bevelThickness: 0.06 });
  gBody.translate(0, 0, -D / 2);
  // big oval head sitting straight on the shoulders (icon bust, no neck)
  // (an extruded oval slab with a deep rounded bevel, like the shoulders — icon style)
  const headShape = new THREE.Shape();
  headShape.absellipse(0, 0, 0.27, 0.34, 0, Math.PI * 2, false, 0);
  const gHead = new THREE.ExtrudeGeometry(headShape, { ...bevel, depth: 0.16, bevelSize: 0.07, bevelThickness: 0.1, bevelSegments: 5 });
  gHead.translate(0, 1.16, -0.08);
  const front = D / 2 + 0.06;
  // shirt V
  const vee = new THREE.Shape();
  vee.moveTo(-0.2, 0.79);
  vee.lineTo(0.2, 0.79);
  vee.lineTo(0, 0.18);
  vee.closePath();
  const gVee = new THREE.ExtrudeGeometry(vee, { bevelEnabled: false, depth: 0.02 });
  gVee.translate(0, 0, front - 0.012);
  // jacket lapels framing the V (raised, darker edge)
  const lapel = (sx: number) => {
    const l = new THREE.Shape();
    l.moveTo(sx * 0.2, 0.8);
    l.lineTo(sx * 0.36, 0.74);
    l.lineTo(sx * 0.27, 0.56);
    l.lineTo(sx * 0.33, 0.5);
    l.lineTo(sx * 0.02, 0.16);
    l.lineTo(sx * 0.0, 0.18);
    l.closePath();
    const g = new THREE.ExtrudeGeometry(l, { bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1, depth: 0.03 });
    g.translate(0, 0, front - 0.005);
    return g;
  };
  const tie = new THREE.Shape();
  tie.moveTo(-0.045, 0.75);
  tie.lineTo(0.045, 0.75);
  tie.lineTo(0.03, 0.67);
  tie.lineTo(0.07, 0.3);
  tie.lineTo(0, 0.2);
  tie.lineTo(-0.07, 0.3);
  tie.lineTo(-0.03, 0.67);
  tie.closePath();
  const gTie = new THREE.ExtrudeGeometry(tie, { bevelEnabled: false, depth: 0.02 });
  gTie.translate(0, 0, front + 0.004);
  const paint = (g: THREE.BufferGeometry, v: number) => {
    const n = g.getAttribute("position").count;
    const c = new Float32Array(n * 3).fill(v);
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    return g.index ? g.toNonIndexed() : g;
  };
  const parts = [paint(gBody, 1), paint(gHead, 1.05), paint(gVee, 1.5), paint(lapel(1), 0.78), paint(lapel(-1), 0.78), paint(gTie, 0.3)].map((g) => {
    g.deleteAttribute("uv");
    return g;
  });
  // every part already carries smooth normals; don't recompute on the non-indexed merge (that would facet the heads)
  return mergeGeometries(parts)!;
};

const factory: SceneFactory<{ colors: CrowdColors }> = ({ gl, props }) => {
  const { colors } = props;
  const rand = mulberry32(0xc40d);
  const glow = new THREE.Color(colors.glow);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(colors.bg);
  scene.fog = new THREE.Fog(new THREE.Color(colors.bg), 11, 25);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 80);
  camera.layers.enable(FX_LAYER);

  const bust = buildBust();
  const crowdMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.crowd),
    vertexColors: true,
    roughness: 0.32,
    metalness: 0.1,
  });
  const mirrorMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(colors.crowd).multiplyScalar(0.3), vertexColors: true, side: THREE.BackSide });

  // grid: chosen figure = front row, centre column, at the origin
  const chosenCol = Math.floor(COLS / 2);
  const mats: THREE.Matrix4[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === 0 && c === chosenCol) continue;
      const x = (c - chosenCol) * SX + (r % 2 ? SX / 2 : 0) + (rand() - 0.5) * 0.12;
      const z = -r * SZ + (rand() - 0.5) * 0.1;
      const s = 0.97 + rand() * 0.06;
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (rand() - 0.5) * 0.12, 0)), new THREE.Vector3(s, s, s)));
    }
  }
  const crowd = new THREE.InstancedMesh(bust, crowdMat, mats.length);
  const mirror = new THREE.InstancedMesh(bust, mirrorMat, mats.length);
  const flip = new THREE.Matrix4().makeScale(1, -1, 1);
  mats.forEach((m, i) => {
    crowd.setMatrixAt(i, m);
    mirror.setMatrixAt(i, flip.clone().multiply(m));
  });
  scene.add(crowd, mirror);

  // chosen figure (emissive) + its reflection
  const chosenMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.crowd),
    vertexColors: true,
    roughness: 0.45,
    emissive: glow.clone(),
    emissiveIntensity: 0,
  });
  // emissive follows the vertex shading so collar and tie stay readable while glowing
  chosenMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb * vColor.rgb;",
    );
  };
  const chosen = new THREE.Mesh(bust, chosenMat);
  scene.add(chosen);
  const chosenMirMat = chosenMat.clone();
  chosenMirMat.side = THREE.BackSide;
  const chosenMir = new THREE.Mesh(bust, chosenMirMat);
  chosenMir.scale.y = -1;
  scene.add(chosenMir);

  // glossy dark floor: semi-transparent over the mirrored crowd
  const floorMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(colors.bg),
    transparent: true,
    opacity: 0.72,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // lights: soft top light + a little front fill; glow light at the chosen figure
  const top = new THREE.DirectionalLight(0xdfe8ff, 2.6);
  top.position.set(1.5, 10, 3);
  scene.add(top);
  scene.add(new THREE.HemisphereLight(new THREE.Color(colors.crowd), 0x000000, 1.0));
  // cool rim / back light picking out shoulders and crowns
  const rim = new THREE.DirectionalLight(new THREE.Color(colors.crowd).lerp(new THREE.Color(1, 1, 1), 0.55), 2.4);
  rim.position.set(0.5, 6, -10);
  scene.add(rim);
  const front = new THREE.DirectionalLight(new THREE.Color(colors.crowd).lerp(new THREE.Color(1, 1, 1), 0.4), 1.7);
  front.position.set(0, 2, 10);
  scene.add(front);
  const glowLight = new THREE.PointLight(glow, 0, 7, 1.6);
  glowLight.position.set(0, 1.0, 0.9);
  scene.add(glowLight);

  // FX: floor rings, halo above head, beam
  const tex = radialTexture();
  const ringTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    grd.addColorStop(0, "rgba(255,255,255,0)");
    grd.addColorStop(0.84, "rgba(255,255,255,0)");
    grd.addColorStop(0.9, "rgba(255,255,255,0.35)");
    grd.addColorStop(0.94, "rgba(255,255,255,1)");
    grd.addColorStop(0.97, "rgba(255,255,255,0.35)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 512);
    return new THREE.CanvasTexture(c);
  })();
  const fxMat = (map: THREE.Texture) =>
    new THREE.MeshBasicMaterial({
      map,
      color: glow.clone(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0,
    });
  const ringGeo = new THREE.PlaneGeometry(1, 1);
  ringGeo.rotateX(-Math.PI / 2);
  const mkRing = () => {
    const m = new THREE.Mesh(ringGeo, fxMat(ringTex));
    m.position.y = 0.012;
    m.layers.set(FX_LAYER);
    scene.add(m);
    return m;
  };
  const staticRings = [mkRing(), mkRing()];
  const pulseRings = [mkRing(), mkRing(), mkRing()];
  // hologram disc: flat translucent fill with a crisp bright edge
  const discTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    grd.addColorStop(0, "rgba(255,255,255,0.55)");
    grd.addColorStop(0.7, "rgba(255,255,255,0.28)");
    grd.addColorStop(0.9, "rgba(255,255,255,0.35)");
    grd.addColorStop(0.95, "rgba(255,255,255,1)");
    grd.addColorStop(0.985, "rgba(255,255,255,0.3)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 512);
    return new THREE.CanvasTexture(c);
  })();
  const floorPool = new THREE.Mesh(ringGeo, fxMat(discTex));
  floorPool.position.y = 0.01;
  floorPool.layers.set(FX_LAYER);
  scene.add(floorPool);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, color: glow.clone(), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }),
  );
  halo.position.set(0, 1.5, 0);
  halo.layers.set(FX_LAYER);
  scene.add(halo);
  const haloMir = halo.clone();
  haloMir.material = halo.material.clone();
  haloMir.position.y = -1.3;
  scene.add(haloMir);

  // long blurred reflection streak on the glossy floor, running from the hero toward camera
  const streakTex = (() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 256;
    const g = c.getContext("2d")!;
    const lg = g.createLinearGradient(0, 0, 64, 0);
    lg.addColorStop(0, "rgba(255,255,255,0)");
    lg.addColorStop(0.5, "rgba(255,255,255,1)");
    lg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = lg;
    g.fillRect(0, 0, 64, 256);
    g.globalCompositeOperation = "destination-in";
    const vg = g.createLinearGradient(0, 0, 0, 256);
    vg.addColorStop(0, "rgba(0,0,0,1)");
    vg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = vg;
    g.fillRect(0, 0, 64, 256);
    return new THREE.CanvasTexture(c);
  })();
  const streakGeo = new THREE.PlaneGeometry(1.1, 8);
  streakGeo.rotateX(-Math.PI / 2);
  streakGeo.translate(0, 0.008, 4.2);
  const streak = new THREE.Mesh(streakGeo, fxMat(streakTex));
  streak.layers.set(FX_LAYER);
  scene.add(streak);
  // wide blue haze rising behind the crowd
  const haze = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: glow.clone().multiplyScalar(0.09), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false }));
  haze.position.set(0, 2.2, -7);
  haze.scale.set(26, 12, 1);

  haze.layers.set(FX_LAYER);
  scene.add(haze);

  // depth of field
  const dof = createDofPass();
  const depthRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  const depthMat = createLinearDepthMaterial();
  dof.uniforms.tDepth.value = depthRT.texture;

  const pipe = new Pipeline(gl, scene, camera, {
    bloom: { strength: 0.55, radius: 0.35, threshold: 0.95 },
    grain: 0.02,
    vignette: 0.35,
    clampHDR: 4,
    extraPasses: [dof],
  });

  // camera path — chosen figure at the origin, crowd stretching to -z
  const KF = [0, 120, 200, 300, 360];
  const camPos = keyed3(KF, [
    [0.6, 5.8, 4.6],
    [0.3, 3.0, 2.4],
    [0.05, 2.2, 9.5],
    [0, 2.0, 15.2],
    [0, 1.98, 15.45],
  ]);
  const camLook = keyed3(KF, [
    [0, 0.0, -8.5],
    [0, 0.4, -7],
    [0, 0.85, -0.5],
    [0, 0.82, 0],
    [0, 0.82, 0],
  ]);
  const focusZ = monotoneCubic([0, 110, 200, 300], [-6, -4.5, 0, 0]);
  const fovK = monotoneCubic([0, 150, 300], [36, 32, 26]);

  const tmp = new THREE.Vector3();
  return {
    render(frame) {
      const { w, h } = pipe.ensureSize();
      camera.aspect = w / h;
      camera.fov = fovK(frame);
      const p = camPos(frame);
      const l = camLook(frame);
      camera.position.set(p[0], p[1], p[2]);
      camera.lookAt(l[0], l[1], l[2]);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      // glow timeline
      const g = smoothstep(100, 180, frame);
      const flicker = 1 + 0.06 * Math.sin(frame * 0.21);
      chosenMat.emissiveIntensity = 0.3 * g * flicker;
      chosenMat.color.set(colors.crowd).lerp(glow, g * 0.75);
      chosenMirMat.emissiveIntensity = 0.22 * g;
      chosenMirMat.color.copy(chosenMat.color).multiplyScalar(0.25);
      glowLight.intensity = 3.5 * g;
      (halo.material as THREE.SpriteMaterial).opacity = 0.09 * g;
      halo.scale.setScalar(2.4 + 0.2 * g);
      (haloMir.material as THREE.SpriteMaterial).opacity = 0.025 * g;
      haloMir.scale.setScalar(2.6);
      (floorPool.material as THREE.MeshBasicMaterial).opacity = 0.35 * g * smoothstep(120, 175, frame);
      (streak.material as THREE.MeshBasicMaterial).opacity = 0.5 * g;
      (haze.material as THREE.SpriteMaterial).opacity = 0.35 + 0.65 * g;
      floorPool.scale.set(3.4, 1, 3.4);
      staticRings.forEach((r, i) => {
        (r.material as THREE.MeshBasicMaterial).opacity = (i === 0 ? 0.75 : 0.4) * smoothstep(130 + i * 12, 185 + i * 12, frame);
        r.scale.setScalar(i === 0 ? 3.5 : 5.8);
      });
      // rings pulse outward: period 72 frames, staggered
      pulseRings.forEach((r, i) => {
        const start = 120 + i * 24;
        const ph = frame < start ? -1 : ((frame - start) % 72) / 72;
        const vis = ph < 0 ? 0 : Math.pow(1 - ph, 1.6) * smoothstep(0, 0.1, ph);
        (r.material as THREE.MeshBasicMaterial).opacity = 0.35 * vis * g;
        r.scale.setScalar(3.0 + ph * 4.0);
      });

      // depth pass (opaque geometry only), then DoF focused on the chosen figure
      if (depthRT.width !== w || depthRT.height !== h) depthRT.setSize(w, h);
      const fz = focusZ(frame);
      tmp.set(0, 0.9, fz);
      const focusDist = tmp.applyMatrix4(camera.matrixWorldInverse).z * -1;
      dof.uniforms.uFocus.value = focusDist;
      dof.uniforms.uAperture.value = 0.052 * h;
      dof.uniforms.uMaxR.value = 0.017 * h;
      dof.uniforms.uRes.value.set(w, h);
      camera.layers.set(0);
      const prevBg = scene.background;
      const prevFog = scene.fog;
      scene.background = new THREE.Color(1000, 0, 0);
      scene.fog = null;
      scene.overrideMaterial = depthMat;
      gl.setRenderTarget(depthRT);
      gl.render(scene, camera);
      gl.setRenderTarget(null);
      scene.overrideMaterial = null;
      scene.background = prevBg;
      scene.fog = prevFog;
      camera.layers.enable(FX_LAYER);

      pipe.render(frame);
    },
    dispose() {
      pipe.dispose();
      depthRT.dispose();
    },
  };
};

export const CrowdSpotlight: React.FC<{ colors: CrowdColors }> = ({ colors }) => (
  <ThreeStage factory={factory} props={{ colors }} background={colors.bg} />
);
