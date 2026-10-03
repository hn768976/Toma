import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Pipeline } from "../../lib/three/Pipeline";
import { SceneFactory, ThreeStage } from "../../lib/three/ThreeStage";
import { createDofPass, createLinearDepthMaterial } from "../../lib/three/dof";
import { radialTexture } from "../../lib/three/textures";
import { keyed3, monotoneCubic } from "../../lib/curve";
import { clamp, mulberry32, smoothstep } from "../../lib/rng";
import type { CrowdColors } from "../../versions";

const COLS = 15;
const ROWS = 14;
const SX = 2.0; // spacing across
const SZ = 1.85; // spacing in depth
const FX_LAYER = 1; // additive glow sprites/rings — excluded from the depth pass

/** Bust icon: extruded shoulders + head, shirt "V" and tie inset on the front.
 * Vertex colours carry the shading (body 1, shirt lighter, tie dark). */
const buildBust = () => {
  const bevel = { bevelEnabled: true, bevelSegments: 3, steps: 1, curveSegments: 18 };
  const body = new THREE.Shape();
  body.moveTo(-0.8, 0);
  body.lineTo(0.8, 0);
  body.lineTo(0.8, 0.4);
  body.quadraticCurveTo(0.8, 0.7, 0.5, 0.74);
  body.lineTo(0.2, 0.8);
  body.lineTo(-0.2, 0.8);
  body.lineTo(-0.5, 0.74);
  body.quadraticCurveTo(-0.8, 0.7, -0.8, 0.4);
  body.closePath();
  const D = 0.34;
  const gBody = new THREE.ExtrudeGeometry(body, { ...bevel, depth: D, bevelSize: 0.05, bevelThickness: 0.06 });
  gBody.translate(0, 0, -D / 2);
  const head = new THREE.Shape();
  head.absellipse(0, 0, 0.29, 0.35, 0, Math.PI * 2, false, 0);
  const gHead = new THREE.ExtrudeGeometry(head, { ...bevel, depth: 0.26, bevelSize: 0.06, bevelThickness: 0.08 });
  gHead.translate(0, 1.2, -0.13);
  const neck = new THREE.CylinderGeometry(0.13, 0.15, 0.3, 16);
  neck.translate(0, 0.86, 0);
  const front = D / 2 + 0.06;
  const vee = new THREE.Shape();
  vee.moveTo(-0.21, 0.79);
  vee.lineTo(0.21, 0.79);
  vee.lineTo(0, 0.2);
  vee.closePath();
  const gVee = new THREE.ExtrudeGeometry(vee, { bevelEnabled: false, depth: 0.02 });
  gVee.translate(0, 0, front - 0.012);
  const tie = new THREE.Shape();
  tie.moveTo(-0.045, 0.74);
  tie.lineTo(0.045, 0.74);
  tie.lineTo(0.03, 0.66);
  tie.lineTo(0.075, 0.3);
  tie.lineTo(0, 0.2);
  tie.lineTo(-0.075, 0.3);
  tie.lineTo(-0.03, 0.66);
  tie.closePath();
  const gTie = new THREE.ExtrudeGeometry(tie, { bevelEnabled: false, depth: 0.02 });
  gTie.translate(0, 0, front + 0.004);
  const paint = (g: THREE.BufferGeometry, v: number) => {
    const n = g.getAttribute("position").count;
    const c = new Float32Array(n * 3).fill(v);
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    return g.index ? g.toNonIndexed() : g;
  };
  const parts = [paint(gBody, 1), paint(gHead, 1), paint(neck, 0.8), paint(gVee, 1.45), paint(gTie, 0.32)].map((g) => {
    g.deleteAttribute("uv");
    return g;
  });
  const merged = mergeGeometries(parts)!;
  merged.computeVertexNormals();
  return merged;
};

const factory: SceneFactory<{ colors: CrowdColors }> = ({ gl, props }) => {
  const { colors } = props;
  const rand = mulberry32(0xc40d);
  const glow = new THREE.Color(colors.glow);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(colors.bg);
  scene.fog = new THREE.Fog(new THREE.Color(colors.bg), 14, 34);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 80);
  camera.layers.enable(FX_LAYER);

  const bust = buildBust();
  const crowdMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.crowd),
    vertexColors: true,
    roughness: 0.5,
    metalness: 0.1,
  });
  const mirrorMat = crowdMat.clone();
  mirrorMat.side = THREE.BackSide;
  mirrorMat.color.multiplyScalar(0.35);

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
  const floorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.bg),
    roughness: 0.32,
    metalness: 0.6,
    transparent: true,
    opacity: 0.8,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // lights: soft top light + a little front fill; glow light at the chosen figure
  const top = new THREE.DirectionalLight(0xdfe8ff, 2.2);
  top.position.set(1.5, 10, 3);
  scene.add(top);
  scene.add(new THREE.HemisphereLight(new THREE.Color(colors.crowd), 0x000000, 0.55));
  const front = new THREE.DirectionalLight(new THREE.Color(colors.crowd), 0.5);
  front.position.set(0, 2, 10);
  scene.add(front);
  const glowLight = new THREE.PointLight(glow, 0, 7, 1.6);
  glowLight.position.set(0, 0.9, 0.6);
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
  const floorPool = new THREE.Mesh(ringGeo, fxMat(tex));
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

  // depth of field
  const dof = createDofPass();
  const depthRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  const depthMat = createLinearDepthMaterial();
  dof.uniforms.tDepth.value = depthRT.texture;

  const pipe = new Pipeline(gl, scene, camera, {
    bloom: { strength: 0.7, radius: 0.4, threshold: 0.9 },
    grain: 0.02,
    vignette: 0.35,
    extraPasses: [dof],
  });

  // camera path — chosen figure at the origin, crowd stretching to -z
  const KF = [0, 120, 200, 300, 360];
  const camPos = keyed3(KF, [
    [0.8, 6.2, 5.2],
    [0.25, 2.7, 2.2],
    [0.05, 1.45, 7.6],
    [0, 1.0, 10.8],
    [0, 0.98, 11.0],
  ]);
  const camLook = keyed3(KF, [
    [0, 0.0, -7.5],
    [0, 0.5, -6],
    [0, 0.85, -0.5],
    [0, 0.78, 0],
    [0, 0.78, 0],
  ]);
  const focusZ = monotoneCubic([0, 110, 200, 300], [-5, -3.5, 0, 0]);
  const fovK = monotoneCubic([0, 150, 300], [34, 32, 27]);

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
      chosenMat.emissiveIntensity = 0.75 * g * flicker;
      chosenMat.color.set(colors.crowd).lerp(glow, g * 0.6);
      chosenMirMat.emissiveIntensity = 0.35 * g;
      chosenMirMat.color.copy(chosenMat.color).multiplyScalar(0.4);
      glowLight.intensity = 5 * g;
      (halo.material as THREE.SpriteMaterial).opacity = 0.16 * g;
      halo.scale.setScalar(2.6 + 0.3 * g);
      (haloMir.material as THREE.SpriteMaterial).opacity = 0.06 * g;
      haloMir.scale.setScalar(2.6);
      (floorPool.material as THREE.MeshBasicMaterial).opacity = 0.12 * g;
      floorPool.scale.setScalar(4.2);
      staticRings.forEach((r, i) => {
        (r.material as THREE.MeshBasicMaterial).opacity = (i === 0 ? 1.0 : 0.55) * smoothstep(130 + i * 12, 185 + i * 12, frame);
        r.scale.setScalar(i === 0 ? 3.2 : 4.4);
      });
      // rings pulse outward: period 72 frames, staggered
      pulseRings.forEach((r, i) => {
        const start = 120 + i * 24;
        const ph = frame < start ? -1 : ((frame - start) % 72) / 72;
        const vis = ph < 0 ? 0 : Math.pow(1 - ph, 1.6) * smoothstep(0, 0.1, ph);
        (r.material as THREE.MeshBasicMaterial).opacity = 0.8 * vis * g;
        r.scale.setScalar(2.0 + ph * 5.0);
      });

      // depth pass (opaque geometry only), then DoF focused on the chosen figure
      if (depthRT.width !== w || depthRT.height !== h) depthRT.setSize(w, h);
      const fz = focusZ(frame);
      tmp.set(0, 0.9, fz);
      const focusDist = tmp.applyMatrix4(camera.matrixWorldInverse).z * -1;
      dof.uniforms.uFocus.value = focusDist;
      dof.uniforms.uAperture.value = 0.075 * h * clamp(1.4 - frame / 600, 0.9, 1.4);
      dof.uniforms.uMaxR.value = 0.024 * h;
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
