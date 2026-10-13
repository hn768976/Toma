import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { buildWorldMap, offsetRing } from "../kit/worldmap";
import { clamp, easeInOut, lerp, loopSin, smooth, TAU } from "../lib/math";
import { hash01, mulberry32, range } from "../lib/random";
import { Polyline, RIBBON_VERT, ribbonGeometry, updateRibbonPositions } from "../lib/ribbons";
import { Driver, Stage } from "../lib/Stage";

export type FibreWorldMapProps = {
  mode: "story" | "hold";
  seed: number;
  outline: string;
  fill: string;
  network: string;
  tipBlue: string;
};

const FPS = 30;
const lin = (hex: string) => new THREE.Color(hex);
const v3 = (p: THREE.Vector2, y = 0) => new THREE.Vector3(p.x, y, p.y);

// Fibre ribbon shading: soft round core; optional pulses and reveal for links.
const RIBBON_FRAG = /* glsl */ `
uniform vec3 uColA;
uniform vec3 uColB;
uniform float uT;        // 0..1 over the composition
uniform float uDraw;     // seconds, for link reveal
uniform float uPulseOn;
uniform float uDim;
uniform float uLink;     // 1 for network links
uniform float uCoreCyan;
varying float vAcross;
varying float vAlong;
varying float vI;
varying vec4 vPar;
varying float vLen;
varying vec3 vWorld;
void main() {
  float core = exp(-vAcross * vAcross * 2.2);
  vec3 col = mix(uColA, uColB, vPar.w);
  // Hot core: the blue fibres run toward icy cyan-white at their centre.
  col = mix(col, vec3(0.45, 0.85, 1.0) * max(max(col.r, col.g), col.b), uCoreCyan * core * core);
  float a = vI * core;
  if (uLink > 0.5) {
    a *= 0.6 + 0.9 * vAlong;
    // Reveal: grows from node to node.
    float prog = clamp((uDraw - vPar.z) / 0.8, 0.0, 1.0);
    float head = smoothstep(prog, prog - 0.02, vAlong);
    a *= head;
    // Pulses: whole cycles per composition.
    float ph = fract(vAlong - vPar.y - vPar.x * uT);
    float pulse = exp(-ph * 14.0 / max(vLen, 0.5)) * step(0.0, ph);
    a += vI * core * pulse * 8.0 * uPulseOn * head;
  }
  gl_FragColor = vec4(col * a * uDim, 1.0);
}`;

const POINT_VERT = /* glsl */ `
attribute float aSize;
attribute float aBright;
attribute float aStart;
uniform float uPx;
uniform float uMirror;
uniform float uDraw;
varying float vB;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  w.y *= uMirror;
  vec4 mv = viewMatrix * w;
  float dist = -mv.z;
  float px = aSize / (uPx * dist);
  gl_PointSize = max(px, 2.5) * 3.0;
  vB = aBright * min(1.0, px / 2.5) * smoothstep(aStart, aStart + 0.4, uDraw);
  gl_Position = projectionMatrix * mv;
}`;
const POINT_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uDim;
varying float vB;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float d = dot(q, q) * 9.0;
  float a = exp(-d * 1.5) + 0.25 * exp(-d * 0.25);
  // Four-point star flare.
  float sx = exp(-abs(q.x) * 30.0) * exp(-q.y * q.y * 6.0);
  float sy = exp(-abs(q.y) * 30.0) * exp(-q.x * q.x * 6.0);
  a += (sx + sy) * 1.6 * smoothstep(1.2, 2.5, vB);
  gl_FragColor = vec4(uCol * a * vB * uDim, 1.0);
}`;

type Fibre = { base: THREE.Vector2; dir: THREE.Vector2; len: number; h: number; curl: number; orange: boolean };

const fibrePoints = (fb: Fibre, lift: number, n = 28) => {
  const pts: THREE.Vector3[] = [];
  const side = new THREE.Vector2(-fb.dir.y, fb.dir.x);
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    const p = fb.base.clone().addScaledVector(fb.dir, s * fb.len).addScaledVector(side, fb.curl * s * s * lift);
    pts.push(new THREE.Vector3(p.x, 0.004 + lift * fb.h * Math.pow(s, 1.7), p.y));
  }
  return pts;
};

const Scene: React.FC<FibreWorldMapProps & { duration: number }> = (p) => {
  const mirror = useRef<THREE.Group>(null);
  const floor = useRef<THREE.Mesh>(null);
  const story = p.mode === "story";

  const m = useMemo(() => {
    const map = buildWorldMap(p.seed);
    const r = mulberry32(p.seed ^ 0xabc);

    const ribbonMat = (cA: THREE.Color, cB: THREE.Color, link: number, mir: number, dim: number) =>
      new THREE.ShaderMaterial({
        vertexShader: RIBBON_VERT,
        fragmentShader: RIBBON_FRAG,
        uniforms: {
          uPx: { value: 0.001 },
          uMirror: { value: mir },
          uWidthMul: { value: 1 },
          uColA: { value: cA },
          uColB: { value: cB },
          uT: { value: 0 },
          uDraw: { value: 100 },
          uPulseOn: { value: 1 },
          uDim: { value: dim },
          uLink: { value: link },
          uCoreCyan: { value: link > 0.5 ? 0 : 1.0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });

    // Outline: 4 parallel strands per coast, inner ones brighter.
    const outlineLines: Polyline[] = [];
    const strands = [-1.5, -0.5, 0.5, 1.5];
    map.rings.forEach((ring, ri) => {
      strands.forEach((k, si) => {
        const off = offsetRing(ring, k * 0.04, 0.015, ri * 7 + si);
        const pts = [...off, off[0]].map((q) => v3(q, 0.003));
        outlineLines.push({ pts, width: 0.011, intensity: Math.abs(k) < 1 ? 2.6 : 1.4, params: [0, 0, 0, 0] });
      });
    });
    const outlineGeo = ribbonGeometry(outlineLines);
    const outlineCol = lin(p.outline);

    // Fill grid (Delaunay inside each continent).
    const fillLines: Polyline[] = map.fillEdges.map(([a, b], i) => ({ pts: [v3(a, 0.002), v3(b, 0.002)], width: 0.008, intensity: 0.8 + 2.4 * Math.pow(hash01(i, 31), 2) }));
    const fillGeo = ribbonGeometry(fillLines);
    const tri = new Float32Array(map.fillTris.flatMap(([a, b, c]) => [a.x, 0.001, a.y, b.x, 0.001, b.y, c.x, 0.001, c.y]));
    const areaGeo = new THREE.BufferGeometry();
    areaGeo.setAttribute("position", new THREE.BufferAttribute(tri, 3));
    const areaMat = new THREE.MeshBasicMaterial({ color: lin(p.fill).lerp(new THREE.Color(0.05, 0.45, 1), 0.6).multiplyScalar(0.2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const fillCol = lin(p.fill);

    // Network: 80 nodes on land, ~120 links (nearest neighbours + long arcs).
    const cand = map.fillVerts;
    const nodes: THREE.Vector2[] = [];
    let guard = 0;
    while (nodes.length < 80 && guard++ < 10000) {
      const q = cand[Math.floor(r() * cand.length)];
      if (nodes.every((n) => n.distanceTo(q) > 0.9)) nodes.push(q);
    }
    const links: [number, number][] = [];
    const has = (a: number, b: number) => links.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    nodes.forEach((n, i) => {
      const order = nodes.map((q, j) => [q.distanceTo(n), j] as const).filter(([, j]) => j !== i).sort((a, b) => a[0] - b[0]);
      const take = r() < 0.3 ? 1 : 2;
      for (let k = 0; k < take; k++) {
        const j = order[k][1];
        if (!has(i, j) && order[k][0] < 6) links.push([i, j]);
      }
    });
    // Hubs: a few nodes fan out many links (the reference's bursts).
    const hubs = [0, 1, 2, 3, 4].map(() => Math.floor(r() * nodes.length));
    hubs.forEach((h, hi) => {
      const order = nodes.map((q, j) => [q.distanceTo(nodes[h]), j] as const).filter(([d, j]) => j !== h && d < (hi === 0 ? 9 : 5)).sort((a, b) => a[0] - b[0]);
      const fan = hi === 0 ? 22 : 10;
      for (let k = 0; k < Math.min(fan, order.length); k++) {
        const j = order[Math.floor(r() * order.length)][1];
        if (!has(h, j)) links.push([h, j]);
      }
    });
    // A few long-haul arcs, then fill up to ~120 with mid-range links.
    let longN = 0;
    while (longN < 2) {
      const a = Math.floor(r() * nodes.length);
      const b = Math.floor(r() * nodes.length);
      const d = nodes[a].distanceTo(nodes[b]);
      if (a !== b && d > 6 && d < 14 && !has(a, b)) {
        links.push([a, b]);
        longN++;
      }
    }
    while (links.length < 120) {
      const a = Math.floor(r() * nodes.length);
      const b = Math.floor(r() * nodes.length);
      const d = nodes[a].distanceTo(nodes[b]);
      if (a !== b && d > 1.5 && d < 4.5 && !has(a, b)) links.push([a, b]);
    }
    const nodeStart = nodes.map(() => 99);
    const linkLines: Polyline[] = links.map(([a, b], i) => {
      const A = nodes[a];
      const B = nodes[b];
      const d = A.distanceTo(B);
      const lift = d > 3 ? d * 0.12 : 0.02;
      const n = Math.max(8, Math.ceil(d * 6));
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= n; k++) {
        const s = k / n;
        const q = A.clone().lerp(B, s);
        pts.push(new THREE.Vector3(q.x, 0.005 + lift * 4 * s * (1 - s), q.y));
      }
      const start = 6 + 2.2 * hash01(i, 77);
      nodeStart[a] = Math.min(nodeStart[a], start);
      nodeStart[b] = Math.min(nodeStart[b], start + 0.6);
      const cycles = story ? 1 + Math.floor(r() * 3) : 2 + Math.floor(r() * 4);
      return { pts, width: 0.008, intensity: d > 6 ? 0.8 : 1.2, params: [cycles, r(), start, r() * 0.3] };
    });
    const linkGeo = ribbonGeometry(linkLines);
    const netCol = lin(p.network);

    // Points: fill vertices (blue-white) and network nodes (gold-white).
    const pointGeo = (pts: THREE.Vector2[], size: number, bright: (i: number) => number, start: (i: number) => number) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts.flatMap((q) => [q.x, 0.01, q.y])), 3));
      g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(pts.map(() => size)), 1));
      g.setAttribute("aBright", new THREE.BufferAttribute(new Float32Array(pts.map((_, i) => bright(i))), 1));
      g.setAttribute("aStart", new THREE.BufferAttribute(new Float32Array(pts.map((_, i) => start(i))), 1));
      return g;
    };
    const vertGeo = pointGeo(map.fillVerts, 0.045, (i) => 1.0 + Math.pow(hash01(i, 5), 2) * 3.0, () => -10);
    const sparks = map.fillVerts.filter((_, i) => hash01(i, 404) < 0.35).map((q, i) => q.clone().add(new THREE.Vector2(hash01(i, 1) - 0.5, hash01(i, 2) - 0.5).multiplyScalar(0.6)));
    const sparkGeo = pointGeo(sparks, 0.03, (i) => 0.8 + hash01(i, 77) * 1.6, (i) => 6.5 + 2.5 * hash01(i, 78));
    const nodeGeo = pointGeo(nodes, 0.06, (i) => 1.6 + hash01(i, 9) * 2.0, (i) => nodeStart[i]);
    const pointMat = (c: THREE.Color, mir: number, dim: number) =>
      new THREE.ShaderMaterial({
        vertexShader: POINT_VERT,
        fragmentShader: POINT_FRAG,
        uniforms: { uPx: { value: 0.001 }, uMirror: { value: mir }, uDraw: { value: 100 }, uCol: { value: c }, uDim: { value: dim } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

    // Story fibres: 40 fibres rising from the coast in front of the camera.
    const fibres: Fibre[] = [];
    const focusC = new THREE.Vector2(-1.2, -4.6);
    const nearRings = map.rings.flatMap((ring) => ring.map((q, i) => ({ q, ring, i }))).filter(({ q }) => q.distanceTo(focusC) < 3.4 && q.y < focusC.y - 0.6);
    const fr = mulberry32(p.seed ^ 0xf1b);
    for (let k = 0; k < 40 && nearRings.length; k++) {
      const { q, ring, i } = nearRings[Math.floor(fr() * nearRings.length)];
      const nx = ring[(i + 3) % ring.length];
      const dir = nx.clone().sub(q).normalize();
      if (fr() < 0.5) dir.negate();
      fibres.push({ base: q.clone(), dir, len: range(fr, 0.1, 0.35), h: range(fr, 0.15, 0.5), curl: range(fr, -0.3, 0.3), orange: fr() < 0.6 });
    }
    const fibreLines: Polyline[] = fibres.map((fb) => ({ pts: fibrePoints(fb, 1), width: 0.006, intensity: 1.6, params: [0, 0, 0, fb.orange ? 1 : 0] }));
    const fibreGeo = ribbonGeometry(fibreLines);
    const tipGeo = new THREE.BufferGeometry();
    tipGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(fibres.length * 3), 3));
    tipGeo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(fibres.map(() => 0.05)), 1));
    tipGeo.setAttribute("aBright", new THREE.BufferAttribute(new Float32Array(fibres.map(() => 4)), 1));
    tipGeo.setAttribute("aStart", new THREE.BufferAttribute(new Float32Array(fibres.map(() => -10)), 1));
    const tipColorsOrange = fibres.map((f) => f.orange);

    const mats = {
      outline: ribbonMat(outlineCol, outlineCol, 0, 1, 1),
      outlineM: ribbonMat(outlineCol, outlineCol, 0, -1, 0.35),
      fill: ribbonMat(fillCol, lin(p.outline), 0, 1, 1.6),
      link: ribbonMat(netCol.clone().lerp(new THREE.Color(1, 0.75, 0.7), 0.3), new THREE.Color(1, 1, 1), 1, 1, 1),
      fibre: ribbonMat(lin(p.tipBlue), netCol, 0, 1, 1),
      fibreM: ribbonMat(lin(p.tipBlue), netCol, 0, -1, 0.35),
      verts: pointMat(lin(p.outline).lerp(new THREE.Color(1, 1, 1), 0.35), 1, 1),
      nodes: pointMat(netCol.clone().lerp(new THREE.Color(1, 1, 1), 0.4), 1, 1),
      tipsO: pointMat(netCol.clone().lerp(new THREE.Color(1, 1, 1), 0.3), 1, 1),
      tipsB: pointMat(lin(p.tipBlue).lerp(new THREE.Color(1, 1, 1), 0.3), 1, 1),
      tipsOM: pointMat(netCol.clone(), -1, 0.35),
      tipsBM: pointMat(lin(p.tipBlue), -1, 0.35),
    };
    // Fibres carry orange as well as blue: no cyan core shift for them.
    mats.fibre.uniforms.uCoreCyan.value = 0;
    mats.fibreM.uniforms.uCoreCyan.value = 0;
    // Split tips into orange / blue draw ranges by sorting.
    const order = fibres.map((_, i) => i).sort((a, b) => Number(tipColorsOrange[b]) - Number(tipColorsOrange[a]));
    const nOrange = tipColorsOrange.filter(Boolean).length;
    const floorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.004, 0.006, 0.014), transparent: true, opacity: 0.75, depthWrite: false });
    const cx = (map.bounds.min.x + map.bounds.max.x) / 2;
    const cz = (map.bounds.min.y + map.bounds.max.y) / 2;
    return { map, sparkGeo, areaGeo, areaMat, outlineGeo, fillGeo, linkGeo, vertGeo, nodeGeo, fibres, fibreGeo, tipGeo, mats, order, nOrange, floorMat, center: new THREE.Vector3(cx, 0, cz), focusC };
  }, [p.seed, p.outline, p.fill, p.network, p.tipBlue, story]);

  const tipGeoO = useMemo(() => m.tipGeo.clone(), [m]);
  const tipGeoB = useMemo(() => m.tipGeo.clone(), [m]);

  return (
    <>
      {story && (
        <group ref={mirror}>
          <mesh geometry={m.outlineGeo} material={m.mats.outlineM} frustumCulled={false} />
          <mesh geometry={m.fibreGeo} material={m.mats.fibreM} frustumCulled={false} />
          <points geometry={tipGeoO} material={m.mats.tipsOM} frustumCulled={false} />
          <points geometry={tipGeoB} material={m.mats.tipsBM} frustumCulled={false} />
        </group>
      )}
      {story && (
        <mesh ref={floor} material={m.floorMat} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
          <planeGeometry args={[200, 200]} />
        </mesh>
      )}
      <group renderOrder={2}>
        <mesh geometry={m.areaGeo} material={m.areaMat} frustumCulled={false} renderOrder={2} />
        <mesh geometry={m.fillGeo} material={m.mats.fill} frustumCulled={false} renderOrder={2} />
        <mesh geometry={m.outlineGeo} material={m.mats.outline} frustumCulled={false} renderOrder={2} />
        <points geometry={m.vertGeo} material={m.mats.verts} frustumCulled={false} renderOrder={3} />
        <mesh geometry={m.linkGeo} material={m.mats.link} frustumCulled={false} renderOrder={3} />
        <points geometry={m.nodeGeo} material={m.mats.nodes} frustumCulled={false} renderOrder={4} />
        <points geometry={m.sparkGeo} material={m.mats.nodes} frustumCulled={false} renderOrder={4} />
        {story && <mesh geometry={m.fibreGeo} material={m.mats.fibre} frustumCulled={false} renderOrder={3} />}
        {story && <points geometry={tipGeoO} material={m.mats.tipsO} frustumCulled={false} renderOrder={4} />}
        {story && <points geometry={tipGeoB} material={m.mats.tipsB} frustumCulled={false} renderOrder={4} />}
      </group>
      <Driver
        post={{
          period: p.duration,
          background: "#000",
          exposure: 1,
          bloom: { intensity: 2.0, threshold: 0.3, smoothing: 0.2, radius: 0.8, levels: 7 },
          dof: { focus: 40, range: 100, bokeh: 0 },
          grain: 0.015,
          blackFade: true,
        }}
        update={(frame, cam, ctx) => {
          const f = frame % p.duration;
          const t = f / p.duration;
          const sec = f / FPS;
          const vfov = 30;
          cam.fov = vfov;
          const pxScale = (2 * Math.tan((vfov * Math.PI) / 360)) / ctx.buffer.y;
          Object.values(m.mats).forEach((mat) => {
            mat.uniforms.uPx.value = pxScale;
            if (mat.uniforms.uT) mat.uniforms.uT.value = t;
          });

          // Final framing: whole map, seen from high and slightly south.
          const D1 = 47;
          const phi1 = 76;
          let T: THREE.Vector3;
          let D: number;
          let phi: number;
          let theta: number;
          let lift = 0;
          let draw = 100;
          if (story) {
            const e = easeInOut((sec - 2.5) / 4.0);
            const drift = sec * 0.05;
            const T0 = new THREE.Vector3(m.focusC.x + drift, 0, m.focusC.y + 0.4);
            T = T0.clone().lerp(m.center, easeInOut((sec - 2.7) / 3.8));
            const D0 = 1.7;
            D = D0 * Math.pow(D1 / D0, e);
            phi = lerp(7, phi1, easeInOut((sec - 2.9) / 3.6));
            theta = lerp(24 - sec * 1.5, 0, e);
            // Fibres lie down into the outlines as the camera rises.
            lift = 1 - smooth(2.6, 5.6, sec);
            draw = sec;
            const dim = 1 - smooth(3.0, 5.5, sec);
            (m.floorMat as THREE.MeshBasicMaterial).opacity = 0.75;
            [m.mats.outlineM, m.mats.fibreM, m.mats.tipsOM, m.mats.tipsBM].forEach((mat) => (mat.uniforms.uDim.value = 0.6 * dim));
            mirror.current!.visible = dim > 0.001;
            floor.current!.visible = dim > 0.001;
            // Fibres: geometry follows the lift; brightness eases toward the
            // outline's so they merge without a pop.
            updateRibbonPositions(m.fibreGeo, m.fibres.map((fb) => fibrePoints(fb, lift)));
            const tips = m.order.map((i) => fibrePoints(m.fibres[i], lift).at(-1)!);
            const tipArr = tips.flatMap((q) => [q.x, q.y, q.z]);
            const nO = m.nOrange;
            const setTips = (g: THREE.BufferGeometry, from: number, to: number) => {
              const a = g.getAttribute("position") as THREE.BufferAttribute;
              (a.array as Float32Array).set(tipArr.slice(from * 3, to * 3));
              a.needsUpdate = true;
              g.setDrawRange(0, to - from);
            };
            setTips(tipGeoO, 0, nO);
            setTips(tipGeoB, nO, tips.length);
            const tipB = lift;
            [m.mats.tipsO, m.mats.tipsB].forEach((mat) => (mat.uniforms.uDim.value = tipB));
            m.mats.fibre.uniforms.uDim.value = smooth(0, 0.6, lift);
            m.mats.fibre.uniforms.uWidthMul.value = 1;
            // Pulses only once the network is drawn.
            m.mats.link.uniforms.uPulseOn.value = smooth(7.0, 9.0, sec);
            // Fill grid and nodes fade in during the pull-back.
            // Close-up: the map lines are near the lens, so they are drawn thinner
            // and dimmer and open up to full strength as the camera pulls back
            // (otherwise the bloom washes the opening out).
            const near = 1 - smooth(2.6, 6.0, sec);
            const k = lerp(1, 0.3, near);
            const wk = lerp(1, 0.45, near);
            m.mats.fill.uniforms.uDim.value = 1.6 * k * 0.7 + 1.6 * 0.3 * (1 - near);
            m.mats.outline.uniforms.uDim.value = k;
            m.mats.outlineM.uniforms.uWidthMul.value = wk;
            m.mats.outline.uniforms.uWidthMul.value = wk;
            m.mats.fill.uniforms.uWidthMul.value = wk;
            m.mats.verts.uniforms.uDim.value = k;
            (m.areaMat as THREE.MeshBasicMaterial).opacity = 1 - near;
          } else {
            T = m.center.clone();
            D = D1;
            phi = phi1 + 2 * loopSin(f, p.duration, 1, 1.2);
            theta = 3 * loopSin(f, p.duration, 1);
            m.mats.link.uniforms.uPulseOn.value = 1;
          }
          m.mats.link.uniforms.uDraw.value = draw;
          m.mats.nodes.uniforms.uDraw.value = draw;
          const ph = (phi * Math.PI) / 180;
          const th = (theta * Math.PI) / 180;
          cam.position.set(T.x + D * Math.cos(ph) * Math.sin(th), D * Math.sin(ph), T.z + D * Math.cos(ph) * Math.cos(th));
          cam.near = Math.max(0.01, D * 0.02);
          cam.far = D * 20;
          cam.up.set(0, 1, 0);
          cam.lookAt(T);
          // DoF: shallow in the close-up, opening up to all-sharp at the map.
          const open = story ? smooth(2.8, 6.0, sec) : 1;
          ctx.dof.focus = D;
          ctx.dof.range = lerp(D * 0.25, D * 3, open);
          ctx.dof.bokeh = lerp(8, 0, open);
          void TAU;
          void clamp;
        }}
      />
    </>
  );
};

export const FibreWorldMap: React.FC<FibreWorldMapProps> = (p) => {
  const duration = p.mode === "story" ? 360 : 600;
  return (
    <Stage fov={30} near={0.01} far={1000}>
      <Scene {...p} duration={duration} />
    </Stage>
  );
};
