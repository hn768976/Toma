import * as THREE from "three";
import { mulberry32, TAU } from "../lib/random";
import { glowPointsMaterial, pxScale } from "../lib/three-util";
import type { Look } from "../lib/look";

export type GlobeParams = { ocean: string; rim: string; city: string; land: string };

// long lens: nearly a full hemisphere is visible, as in the reference
const FOV = 9.45;
const CAM = new THREE.Vector3(0, 0, 8.0);
const LOOK = new THREE.Vector3(0, 0, 0);
const LON0 = 100; // longitude facing the camera at frame 0 (Asia)

// lon/lat (deg) -> unit vector; lon 0 faces +z, east is +x
const ll = (lon: number, lat: number, r = 1) => {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
};

// streak orbits (seeded at module level)
const srng = mulberry32(0x91be);
type Streak = { rad: boolean; theta: number; straight: boolean; c: THREE.Vector3; d: THREE.Vector3; len: number; r: number; normal: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3; ph: number; k: number; tail: number; w: number; br: number; orb: boolean };
const streaks: Streak[] = [];
for (let i = 0; i < 300; i++) {
  const orb = i >= 112 && i < 130;
  // i >= 130: dense field of streaks fanning out from behind the globe
  const rad = i >= 130;
  const side = srng() < 0.5 ? 0 : Math.PI;
  const theta = side + (srng() - 0.5) * 1.5;
  // orbit planes share a diagonal tilt (lower-left -> upper-right on screen)
  const tiltZ = 0.32 + (srng() - 0.5) * 0.22;
  const tiltX = (srng() - 0.5) * 1.1;
  const e = new THREE.Euler(tiltX, 0, tiltZ, "ZXY");
  const normal = new THREE.Vector3(0, 1, 0).applyEuler(e);
  const u = new THREE.Vector3(1, 0, 0).applyEuler(e);
  const v = new THREE.Vector3().crossVectors(normal, u);
  // ~60% are straight diagonal fly-bys at many depths, the rest orbit
  const straight = !orb && srng() < 0.6;
  const d = new THREE.Vector3(1, 0.3 + (srng() - 0.5) * 0.12, (srng() - 0.5) * 0.5).normalize();
  const front = srng() < 0.45;
  const c = new THREE.Vector3((srng() - 0.5) * 1.0, (srng() - 0.5) * 1.5 + 0.35, front ? 1.05 + srng() * 0.75 : -0.8 + srng() * 1.6);
  streaks.push({
    rad, theta, straight, c, d, len: 0.5 + srng() * 1.3,
    r: orb ? 1.06 + srng() * 0.25 : 1.04 + Math.pow(srng(), 1.2) * 1.1,
    normal, u, v,
    ph: srng() * TAU,
    k: (1 + Math.floor(srng() * 3)) * (srng() < 0.85 ? -1 : 1), // whole turns per loop
    tail: 0.4 + srng() * 1.1,
    w: 0.0012 + srng() * 0.0018,
    br: 0.6 + srng() * 1.2,
    orb,
  });
}

export const ConnectedGlobe: Look<GlobeParams> = {
  assets: ["globe"],
  create: ({ height, assets, params, period }) => {
    const data = assets.globe!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(params.rim).multiplyScalar(0.035); // steel-blue haze, not black
    const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 50);
    const ocean = new THREE.Color(params.ocean), rim = new THREE.Color(params.rim), city = new THREE.Color(params.city), landC = new THREE.Color(params.land);
    const rng = mulberry32(0x6106e); // scatter around cities (fixed per data set)

    // the globe group: tilt is fixed, spin is per frame
    const tilt = new THREE.Group();
    tilt.rotation.set(0.3, 0, -0.06); // ~17N faces the camera
    const spin = new THREE.Group();
    tilt.add(spin);
    scene.add(tilt);

    // ---- translucent blue fill under the land (blurred dot mask, equirect) ----
    const LW = 2048, LH = 1024;
    const lc = document.createElement("canvas");
    lc.width = LW; lc.height = LH;
    const lg = lc.getContext("2d")!;
    lg.fillStyle = "#000"; lg.fillRect(0, 0, LW, LH);
    lg.fillStyle = "#fff";
    for (let i = 0; i < data.dots.length; i += 3) {
      const x = ((((data.dots[i] + 90) / 360) % 1) + 1) % 1 * LW, y = (0.5 - data.dots[i + 1] / 180) * LH;
      lg.fillRect(x - 2, y - 2, 4, 4);
    }
    const lc2 = document.createElement("canvas");
    lc2.width = LW; lc2.height = LH;
    const lg2 = lc2.getContext("2d")!;
    lg2.filter = "blur(3px)";
    lg2.drawImage(lc, 0, 0);
    const landTex = new THREE.CanvasTexture(lc2);

    // ---- ocean sphere with fresnel rim ----
    const oceanMat = new THREE.ShaderMaterial({
      uniforms: { ocean: { value: ocean }, rim: { value: rim }, land: { value: landTex } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 ocean; uniform vec3 rim; uniform sampler2D land; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main() {
          float ndv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
          float f = 1.0 - ndv;
          vec3 c = vec3(0.004, 0.012, 0.018) + mix(ocean, rim, 0.4) * 0.35 * pow(f, 2.2); // dark charcoal-teal, glassy toward the limb
          c += mix(ocean, rim, 0.5) * 0.09 * texture2D(land, vUv).r;
          // soft blue sheen from the lower left
          c += ocean * 0.12 * pow(max(dot(normalize(vN), normalize(vec3(-0.8, -0.35, 0.5))), 0.0), 3.0);
          c += rim * (0.3 * pow(f, 5.0) + 0.9 * pow(f, 16.0));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    spin.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), oceanMat));

    // ---- atmosphere: thin bright ring hugging the limb + soft halo ----
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: { rim: { value: rim }, camPos: { value: new THREE.Vector3() } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 rim; varying vec3 vW;
        void main() {
          vec3 v = normalize(vW - cameraPosition);
          vec3 oc = -cameraPosition;
          float h = length(cross(v, oc)); // closest approach of the view ray to the centre
          float d = max(h - 1.0, 0.0);
          float g = 0.6 * exp(-d / 0.006) + 0.55 * exp(-d / 0.035) + 0.22 * exp(-d / 0.25)
            + 0.25 * exp(-abs(h - 1.016) / 0.012); // outer edge of the glass shell
          gl_FragColor = vec4(mix(rim, vec3(0.25, 0.55, 1.0), 0.45) * g, 1.0);
        }`,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.35, 96, 64), atmoMat));

    // ---- land dots + city lights (one Points draw, turns with the globe) ----
    const dots = data.dots;
    const n = dots.length / 3;
    const pos: number[] = [], col: number[] = [], size: number[] = [];
    const R = 1.0015;
    for (let i = 0; i < n; i++) {
      const lon = dots[i * 3], lat = dots[i * 3 + 1], light = dots[i * 3 + 2];
      const p = ll(lon, lat, R);
      pos.push(p.x, p.y, p.z);
      // only some dots in populated areas become city lights
      const lit = (light > 0.05 && rng() < 0.32) || rng() < 0.04 ? Math.max(light, 0.5) : 0;
      const c = lit > 0 ? city.clone().lerp(new THREE.Color(1, 1, 1), 0.25).multiplyScalar(5 + 4 * lit) : landC.clone().lerp(rim, 0.35).multiplyScalar(1.7);
      col.push(c.r, c.g, c.b);
      size.push(lit > 0 ? 1.0 : 0.85);
      // extra small amber dots scattered around the brightest areas
      if (light > 0.5) {
        const extra = Math.floor(rng() * 1.4);
        for (let e = 0; e < extra; e++) {
          const q = ll(lon + (rng() - 0.5) * 1.6, lat + (rng() - 0.5) * 1.2, R + 0.0005);
          pos.push(q.x, q.y, q.z);
          const b = 1.2 + rng() * 2.2;
          col.push(city.r * b, city.g * b, city.b * b);
          size.push(0.5 + rng() * 0.35);
        }
      }
    }
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    dotGeo.setAttribute("pcolor", new THREE.Float32BufferAttribute(col, 3));
    dotGeo.setAttribute("dsize", new THREE.Float32BufferAttribute(size, 1));
    const dotMat = new THREE.ShaderMaterial({
      uniforms: { uProj: { value: height / (2 * Math.tan((FOV * Math.PI) / 360)) }, step: { value: ((data.step * Math.PI) / 180) * 0.62 } },
      vertexShader: /* glsl */ `
        attribute vec3 pcolor; attribute float dsize; uniform float uProj; uniform float step;
        varying vec3 vColor; varying float vFacing;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vec3 nrm = normalize(mat3(modelMatrix) * position);
          vec3 vd = normalize(cameraPosition - w.xyz);
          vFacing = dot(nrm, vd);
          vec4 mv = viewMatrix * w;
          gl_Position = projectionMatrix * mv;
          // foreshortening: dots flatten toward the limb, so shrink them
          gl_PointSize = max(1.5, step * dsize * uProj / -mv.z * (0.45 + 0.55 * clamp(vFacing, 0.0, 1.0)));
          // brighter toward the limb (rim light), as in the reference
          vColor = pcolor * (0.75 + 0.6 * pow(1.0 - clamp(vFacing, 0.0, 1.0), 2.0));
          if (vFacing < -0.02) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vFacing;
        void main() {
          vec2 q = gl_PointCoord * 2.0 - 1.0;
          float r = length(q); // round LED
          if (r > 1.0) discard;
          gl_FragColor = vec4(vColor * (1.0 - smoothstep(0.55, 1.0, r) * 0.6), 1.0);
        }`,
    });
    const dotPoints = new THREE.Points(dotGeo, dotMat);
    dotPoints.frustumCulled = false;
    spin.add(dotPoints);

    // city-light glow sprites on the brightest cities
    const gPos: number[] = [], gCol: number[] = [], gSize: number[] = [];
    for (let i = 0; i < n; i++) {
      if (dots[i * 3 + 2] < 0.85 || rng() > 0.12) continue;
      const p = ll(dots[i * 3], dots[i * 3 + 1], 1.003);
      gPos.push(p.x, p.y, p.z);
      const b = 0.25 + rng() * 0.35;
      gCol.push(city.r * b, city.g * b, city.b * b);
      gSize.push(5 + rng() * 4);
    }
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute("position", new THREE.Float32BufferAttribute(gPos, 3));
    glowGeo.setAttribute("pcolor", new THREE.Float32BufferAttribute(gCol, 3));
    glowGeo.setAttribute("size", new THREE.Float32BufferAttribute(gSize, 1));
    const cityGlow = new THREE.Points(glowGeo, glowPointsMaterial(height));
    cityGlow.frustumCulled = false;
    spin.add(cityGlow);

    // ---- pins: ring on the surface + short radial line + dot on top ----
    const pinGroup = new THREE.Group();
    spin.add(pinGroup);
    const ringMat = new THREE.ShaderMaterial({
      uniforms: { col: { value: new THREE.Color(0.15, 1.0, 0.7) }, pulse: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 col; uniform float pulse; varying vec2 vUv;
        void main(){ float r = length(vUv * 2.0 - 1.0);
          float ring = smoothstep(0.66, 0.74, r) * (1.0 - smoothstep(0.86, 0.94, r));
          float dotc = 1.0 - smoothstep(0.14, 0.22, r);
          gl_FragColor = vec4(col * (ring * 2.2 + dotc * 2.6) * pulse, 1.0); }`,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: false, // billboards would otherwise be half-buried in the sphere
      side: THREE.DoubleSide,
    });
    const lineMat = new THREE.MeshBasicMaterial({ color: rim.clone().lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(1.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(2.2) });
    const pinRng = mulberry32(0x7172);
    const ringGroup = new THREE.Group(); // rings face the camera, placed per frame
    scene.add(ringGroup);
    type Pin = { ring: THREE.Mesh; local: THREE.Vector3; mat: THREE.ShaderMaterial; k: number; ph: number };
    const pins: Pin[] = data.pins.filter((_, i) => i % 3 !== 2).map(([lon, lat]) => {
      const p = ll(lon, lat, 1.0025);
      const nrm = p.clone().normalize();
      const s = 0.055 + pinRng() * 0.02;
      const m = ringMat.clone();
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(s, s), m);
      ringGroup.add(ring);
      const len = 0.1 + pinRng() * 0.15;
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0007, len, 6, 1, true), lineMat);
      line.position.copy(nrm.clone().multiplyScalar(1 + len / 2));
      line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm);
      pinGroup.add(line);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.006), headMat);
      head.position.copy(nrm.clone().multiplyScalar(1 + len));
      head.quaternion.copy(line.quaternion);
      pinGroup.add(head);
      return { ring, local: p, mat: m, k: 1 + Math.floor(pinRng() * 4), ph: pinRng() * TAU };
    });

    // ---- streaks (camera-facing ribbons rebuilt each frame) ----
    const SEG = 28;
    const NSt = streaks.length;
    const sPos = new Float32Array(NSt * (SEG + 1) * 2 * 3);
    const sUv = new Float32Array(NSt * (SEG + 1) * 2 * 2);
    const sBr = new Float32Array(NSt * (SEG + 1) * 2);
    const sIdx: number[] = [];
    for (let i = 0; i < NSt; i++)
      for (let k = 0; k < SEG; k++) {
        const b = (i * (SEG + 1) + k) * 2;
        sIdx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      }
    const stGeo = new THREE.BufferGeometry();
    stGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    stGeo.setAttribute("uv", new THREE.BufferAttribute(sUv, 2));
    stGeo.setAttribute("br", new THREE.BufferAttribute(sBr, 1));
    stGeo.setIndex(sIdx);
    const stMat = new THREE.ShaderMaterial({
      uniforms: { col: { value: rim.clone().lerp(new THREE.Color(1, 1, 1), 0.45) }, blue: { value: new THREE.Color(0.35, 0.65, 1.0) } },
      vertexShader: `attribute float br; varying vec2 vUv; varying float vBr; void main(){ vUv = uv; vBr = br; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 col; uniform vec3 blue; varying vec2 vUv; varying float vBr;
        void main(){ float a = exp(-vUv.y * vUv.y * 3.0); float s = vUv.x; float t = s * s * s;
          // tails run from blue to white toward the head; background fan is blue
          vec3 c = vBr < 0.0 ? blue : mix(blue, col, 0.35 + 0.65 * s);
          gl_FragColor = vec4(c * (0.15 + 3.0 * t) * a * abs(vBr) * s, 1.0); }`,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const stMesh = new THREE.Mesh(stGeo, stMat);
    stMesh.frustumCulled = false;
    scene.add(stMesh);
    // heads / orbs
    const hPos = new Float32Array(NSt * 3), hCol = new Float32Array(NSt * 3), hSize = new Float32Array(NSt);
    const hGeo = new THREE.BufferGeometry();
    hGeo.setAttribute("position", new THREE.BufferAttribute(hPos, 3));
    hGeo.setAttribute("pcolor", new THREE.BufferAttribute(hCol, 3));
    hGeo.setAttribute("size", new THREE.BufferAttribute(hSize, 1));
    const heads = new THREE.Points(hGeo, glowPointsMaterial(height, { sharp: 0 }));
    heads.frustumCulled = false;
    scene.add(heads);
    const headCol = rim.clone().lerp(new THREE.Color(1, 1, 1), 0.6);
    // out-of-focus foreground orbs (bokeh) drifting on the left
    const bRng = mulberry32(0xb0ce);
    const NB = 9;
    const bok = Array.from({ length: NB }, () => ({
      x: -0.225 + bRng() * 0.025, y: -0.07 + bRng() * 0.14, z: 6.4 + bRng() * 0.3,
      k: 1 + Math.floor(bRng() * 2), ph: bRng() * TAU, size: 10 + bRng() * 10, amber: bRng() < 0.6, b: 0.25 + bRng() * 0.35,
    }));
    const bPos = new Float32Array(NB * 3), bCol = new Float32Array(NB * 3), bSize = new Float32Array(NB);
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
    bGeo.setAttribute("pcolor", new THREE.BufferAttribute(bCol, 3));
    bGeo.setAttribute("size", new THREE.BufferAttribute(bSize, 1));
    const bokehPts = new THREE.Points(bGeo, glowPointsMaterial(height, { sharp: 0.75 }));
    bokehPts.frustumCulled = false;
    scene.add(bokehPts);
    void pxScale;

    const P = new THREE.Vector3(), Pn = new THREE.Vector3(), T = new THREE.Vector3(), Vv = new THREE.Vector3(), S = new THREE.Vector3();
    const update = (frame: number) => {
      const t = (frame % period) / period;
      camera.position.copy(CAM);
      camera.lookAt(LOOK);
      // exactly one full turn per loop; surface moves right -> left
      spin.rotation.y = -((LON0 * Math.PI) / 180 + TAU * t);
      atmoMat.uniforms.camPos.value.copy(camera.position);
      bok.forEach((o, i) => {
        bPos.set([o.x + 0.03 * Math.sin(TAU * o.k * t + o.ph), o.y + 0.04 * Math.sin(TAU * t + o.ph), o.z], i * 3);
        const c = o.amber ? city : headCol;
        const b = o.b * (0.7 + 0.3 * Math.sin(TAU * o.k * t + o.ph * 2));
        bCol.set([c.r * b, c.g * b, c.b * b], i * 3);
        bSize[i] = o.size;
      });
      bGeo.attributes.position.needsUpdate = true;
      bGeo.attributes.pcolor.needsUpdate = true;
      bGeo.attributes.size.needsUpdate = true;

      tilt.updateMatrixWorld(true);
      pins.forEach((p) => {
        const s = 0.5 + 0.5 * Math.sin(TAU * p.k * t + p.ph);
        p.mat.uniforms.pulse.value = 0.55 + 0.6 * s * s;
        p.ring.position.copy(p.local).applyMatrix4(spin.matrixWorld);
        p.ring.quaternion.copy(camera.quaternion);
        const facing = Pn.copy(p.ring.position).normalize().dot(Vv.subVectors(camera.position, p.ring.position).normalize());
        p.ring.visible = facing > 0.05;
        p.ring.scale.setScalar((0.85 + 0.3 * s) * Math.min(1, facing * 4));
      });

      for (let i = 0; i < NSt; i++) {
        const st = streaks[i];
        const head = st.ph + TAU * st.k * t;
        const dir = Math.sign(st.k);
        const tail = st.orb ? 0.0 : st.tail;
        // straight streaks: head position wraps once per cycle, whole cycles per loop
        const L = 3.6;
        const hu = ((((st.ph / TAU + Math.abs(st.k) * t) % 1) + 1) % 1) * 2 * L - L;
        for (let k = 0; k <= SEG; k++) {
          const s = k / SEG; // 0 tail -> 1 head
          if (st.rad) {
            // fans outward behind the globe; radius wraps once per cycle
            const rr = 0.95 + 2.6 * ((((st.ph / TAU + Math.abs(st.k) * t) % 1) + 1) % 1) - st.len * 0.5 * (1 - s);
            T.set(Math.cos(st.theta), Math.sin(st.theta) * 0.55, 0).normalize();
            P.copy(T).multiplyScalar(rr).setZ(-0.35);
          } else if (st.straight) {
            P.copy(st.c).addScaledVector(st.d, hu - st.len * (1 - s));
            T.copy(st.d);
          } else {
            const a = head - dir * tail * (1 - s);
            const ca = Math.cos(a), sa = Math.sin(a);
            P.copy(st.u).multiplyScalar(ca * st.r).addScaledVector(st.v, sa * st.r);
            T.copy(st.u).multiplyScalar(-sa).addScaledVector(st.v, ca).multiplyScalar(dir);
          }
          Vv.subVectors(camera.position, P).normalize();
          S.crossVectors(T, Vv).normalize().multiplyScalar(st.w * (0.4 + 0.6 * s));
          const o = (i * (SEG + 1) + k) * 2;
          Pn.copy(P).sub(S);
          sPos.set([Pn.x, Pn.y, Pn.z], o * 3);
          Pn.copy(P).add(S);
          sPos.set([Pn.x, Pn.y, Pn.z], o * 3 + 3);
          sUv.set([s, -1, s, 1], o * 2);
          sBr[o] = sBr[o + 1] = st.orb ? 0 : st.rad ? -0.5 * st.br : st.br;
          if (k === SEG) {
            hPos.set([P.x, P.y, P.z], i * 3);
            const hb = st.orb ? 1.4 * st.br : 1.8 * st.br;
            const c = st.orb && i % 3 === 0 ? city : headCol;
            hCol.set([c.r * hb, c.g * hb, c.b * hb], i * 3);
            hSize[i] = st.rad ? 0 : st.orb ? 7 + 4 * st.br : 9 + 5 * st.br;
          }
        }
      }
      stGeo.attributes.position.needsUpdate = true;
      stGeo.attributes.uv.needsUpdate = true;
      stGeo.attributes.br.needsUpdate = true;
      hGeo.attributes.position.needsUpdate = true;
      hGeo.attributes.pcolor.needsUpdate = true;
      hGeo.attributes.size.needsUpdate = true;
    };

    return {
      scene,
      camera,
      update,
      post: {
        exposure: 1.0,
        tonemap: "aces",
        bloom: { strength: 1.9, threshold: 0.5, knee: 0.5, radius: 0.65 },
        dof: { focus: 7.0, range: 1.0, nearRange: 0.8, maxBlur: 0.008, maxNearBlur: 0.01 },
        grain: 0.02,
        grainPeriod: period,
        grade: { vignette: 0.3, saturation: 1.35 },
      },
    };
  },
};
