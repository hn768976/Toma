import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { fontsLoaded, loadFonts } from "../../lib/fonts";
import { bufferSize } from "../../lib/CanvasStage";
import { hash3, TAU } from "../../lib/random";
import { BOKEH, buildMannequin, buildPlexus, DUST, FIGURES, PANELS_BG } from "./geometry";
import { HoloPipeline } from "./pipeline";
import { drawTag, TAG_KINDS, TAG_PX } from "./tags";
import { HoloVersion } from "./versions";

const LOOP = 600;
const DEPTH_LAYER = 1;
const FRONT_LAYER = 2;

// Module-level geometry (deterministic, built once per tab).
const MANNEQUIN = buildMannequin();
const WIRE = new THREE.WireframeGeometry(MANNEQUIN);
const WIRE_POS = Array.from(WIRE.getAttribute("position").array as Float32Array);
// Lines are drawn as wide lines whose width scales with the output height,
// so 4K renders look like the 720p previews (GL lines are always 1 device px).
const REF_H = 720;
const PLEX = buildPlexus();
const OCCLUDER = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 });

const holoVert = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const holoFrag = /* glsl */ `
uniform vec3 color; uniform float scan; uniform float flicker; uniform float baseY; uniform float fade;
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main() {
  float ndv = abs(dot(normalize(vN), normalize(vV)));
  float fres = pow(1.0 - ndv, 2.2);
  float y = vW.y - baseY;
  float line = pow(1.0 - abs(fract(y * 64.0 - scan) * 2.0 - 1.0), 6.0);
  float band = smoothstep(0.0, 0.08, fract(y * 0.9 - scan * 0.1) ) * 0.0;
  float feet = exp(-y * 4.0) * 1.4;
  float legs = mix(1.25, 0.6, smoothstep(0.3, 1.5, y));
  float body = (0.28 + 0.9 * fres + 0.3 * line) * legs + feet + band;
  // hot inner core facing the camera, strongest on the legs / spine
  float core = pow(ndv, 4.0) * (0.12 + 0.3 * exp(-y * 1.5));
  vec3 hot = mix(color, vec3(1.0, 0.97, 0.85), 0.55);
  gl_FragColor = vec4((color * body + hot * core) * flicker * fade, 1.0);
}
`;

const discFrag = /* glsl */ `
uniform vec3 color; uniform vec3 ringColor; uniform float pulse; varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0; float r = length(p);
  float core = exp(-r * r * 220.0) * 4.0 + exp(-r * r * 24.0) * 0.25;
  float inner = exp(-pow((r - 0.3) / 0.02, 2.0)) * 0.5;
  float ring1 = exp(-pow((r - 0.48) / 0.010, 2.0)) * (0.8 + 0.4 * pulse);
  float ring2 = exp(-pow((r - 0.70) / 0.008, 2.0)) * (0.7 + 0.4 * (1.0 - pulse));
  float ring3 = exp(-pow((r - 0.93) / 0.007, 2.0)) * 0.45;
  // small triangle markers on the outer ring
  float ang = atan(p.y, p.x);
  float seg = fract(ang / 6.2831 * 4.0 + 0.125);
  float tri = step(abs(seg - 0.5), 0.03 * (1.0 - (r - 0.78) / 0.1)) * step(0.78, r) * step(r, 0.88);
  vec3 white = vec3(1.0, 0.97, 0.92);
  vec3 c = mix(color, white, 0.6) * core + color * inner + ringColor * (ring1 + ring2 + ring3) + white * tri * 1.2;
  gl_FragColor = vec4(c, 1.0);
}
`;
const uvVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const beamFrag = /* glsl */ `
uniform vec3 color; varying vec2 vUv;
void main() {
  float a = pow(1.0 - vUv.y, 2.2);
  gl_FragColor = vec4(mix(color, vec3(1.0, 0.95, 0.85), 0.4) * a * 0.9, 1.0);
}
`;
const bokehFrag = /* glsl */ `
uniform vec3 color; uniform float alpha; varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0; float r = length(p);
  float a = smoothstep(1.0, 0.0, r); a = a * a;
  gl_FragColor = vec4(color * a * alpha, 1.0);
}
`;
const panelFrag = /* glsl */ `
uniform vec3 color; uniform float alpha; varying vec2 vUv;
void main() {
  vec2 p = abs(vUv * 2.0 - 1.0);
  float a = smoothstep(1.0, 0.6, p.x) * smoothstep(1.0, 0.6, p.y);
  gl_FragColor = vec4(color * a * alpha, 1.0);
}
`;
const pointFrag = /* glsl */ `
uniform vec3 color; varying float vG;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0; float r = dot(p, p);
  if (r > 1.0) discard;
  gl_FragColor = vec4(color * (1.0 - r) * (1.0 - r) * vG, 1.0);
}
`;
const pointVert = /* glsl */ `
uniform float px; uniform float pxScale; varying float vG;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // a few points are bright glints, the rest are faint
  vG = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453) > 0.85 ? 1.6 : 0.3;
  gl_PointSize = px * pxScale * 3.0 / -mv.z * (0.7 + 0.5 * vG);
  gl_Position = projectionMatrix * mv;
}
`;
const floorFrag = /* glsl */ `
varying vec2 vUv;
void main() {
  vec2 p = vUv * 80.0;
  vec2 g = abs(fract(p) - 0.5);
  float grid = 0.0;
  gl_FragColor = vec4(vec3(0.0016, 0.0020, 0.0022) + vec3(grid * 0.25), 1.0);
}
`;
// HUD tag drawn procedurally: outlined box with bars/sparkline that tick.
const tagFrag = /* glsl */ `
uniform vec3 color; uniform float tick; uniform float kind; uniform float aspect; varying vec2 vUv;
float h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
void main() {
  vec2 p = vUv; vec2 px = vec2(p.x * aspect, p.y);
  float edge = 0.035;
  float border = (step(p.x, edge / aspect) + step(1.0 - edge / aspect, p.x) + step(p.y, edge) + step(1.0 - edge, p.y));
  float inner = 0.0;
  if (kind < 0.5) {
    // row of cells, a few lit
    float cell = floor(p.x * 7.0);
    float lit = step(cell, 2.0 + floor(h(tick + cell * 0.1) * 4.0));
    vec2 q = fract(vec2(p.x * 7.0, p.y));
    inner = step(0.15, q.x) * step(q.x, 0.85) * step(0.25, q.y) * step(q.y, 0.75) * (0.35 + 0.65 * lit);
  } else if (kind < 1.5) {
    // sparkline
    float x = p.x * 10.0; float i = floor(x); float f = fract(x);
    float y = mix(h(i + tick), h(i + 1.0 + tick), smoothstep(0.0, 1.0, f)) * 0.5 + 0.25;
    inner = smoothstep(0.06, 0.0, abs(p.y - y)) * step(0.06, p.x) * step(p.x, 0.94);
  } else {
    // circle badge + text lines
    float r = length((px - vec2(0.5, 0.5)));
    inner = smoothstep(0.04, 0.0, abs(r - 0.32)) + step(r, 0.14) * 0.6;
    inner += step(aspect * 0.32 + 0.35, px.x) * step(px.x, aspect - 0.15) * (step(0.55, p.y) * step(p.y, 0.68) + step(0.3, p.y) * step(p.y, 0.4) * 0.6);
  }
  float a = clamp(border + inner, 0.0, 1.0);
  gl_FragColor = vec4(color * a * 1.6, 1.0);
}
`;

const col = (hex: string) => new THREE.Color(hex);

const Scene: React.FC<{ v: HoloVersion }> = ({ v }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const { camera } = useThree();

  const world = useMemo(() => {
    const scene = new THREE.Scene();
    const fig = col(v.figure);
    const figs: { group: THREE.Group; mat: THREE.ShaderMaterial; wire: LineMaterial; disc: THREE.ShaderMaterial; spec: (typeof FIGURES)[0] }[] = [];

    // floor (also in the depth layer)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShaderMaterial({ vertexShader: uvVert, fragmentShader: floorFrag }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -10;
    floor.layers.enable(DEPTH_LAYER);
    scene.add(floor);

    // plexus lines + dots (colours baked per vertex: brightness, tint, distance fade)
    const fat: { mat: LineMaterial; width: number }[] = [];
    const c1 = fig.clone().lerp(new THREE.Color(1, 0.92, 0.6), 0.35).multiplyScalar(0.8);
    const c2 = col(v.plexusAlt).multiplyScalar(0.6);
    const camRest = new THREE.Vector3(0.1, 2.45, 7.9);
    const pcol: number[] = [];
    for (let i = 0; i < PLEX.seg.length / 3; i++) {
      const p = new THREE.Vector3(PLEX.seg[i * 3], PLEX.seg[i * 3 + 1], PLEX.seg[i * 3 + 2]);
      const d = p.distanceTo(camRest);
      const fog = Math.min(1, Math.max(0.15, 1 - (d - 8) / 14)) * THREE.MathUtils.smoothstep(d, 3, 7.5);
      const alt = PLEX.alt[i];
      const tw = 0.75 + 0.25 * Math.sin(Math.PI * 2 * (alt % 1) * 3);
      const c = (alt >= 1 ? c2 : c1).clone().multiplyScalar(PLEX.bright[i] * fog * tw * 0.85);
      pcol.push(c.r, c.g, c.b);
    }
    const pg = new LineSegmentsGeometry();
    pg.setPositions(Array.from(PLEX.seg));
    pg.setColors(pcol);
    const plexMat = new LineMaterial({ vertexColors: true, linewidth: 1, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    fat.push({ mat: plexMat, width: 1.3 });
    scene.add(new LineSegments2(pg, plexMat));
    const dots = new THREE.BufferGeometry().setFromPoints(PLEX.pts);
    const dotMat = new THREE.ShaderMaterial({ // eslint-disable-line
      vertexShader: pointVert,
      fragmentShader: pointFrag,
      uniforms: { color: { value: fig.clone().lerp(new THREE.Color(1, 1, 0.9), 0.5).multiplyScalar(1.6) }, px: { value: 7 }, pxScale: { value: 1 } },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    scene.add(new THREE.Points(dots, dotMat));
    const pointMats: THREE.ShaderMaterial[] = [dotMat];

    // floating dust
    const dust = new THREE.BufferGeometry().setFromPoints(DUST.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const dustMat = new THREE.ShaderMaterial({
          vertexShader: pointVert,
          fragmentShader: pointFrag,
          uniforms: { color: { value: fig.clone().lerp(new THREE.Color(1, 1, 1), 0.4).multiplyScalar(0.7) }, px: { value: 5 }, pxScale: { value: 1 } },
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
    });
    pointMats.push(dustMat);
    scene.add(new THREE.Points(dust, dustMat));

    // background bokeh
    const bokehGeo = new THREE.PlaneGeometry(1, 1);
    for (const b of BOKEH) {
      const m = new THREE.Mesh(
        bokehGeo,
        new THREE.ShaderMaterial({
          vertexShader: uvVert,
          fragmentShader: bokehFrag,
          uniforms: { color: { value: col(v.bokeh[b.c]) }, alpha: { value: b.a } },
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
        }),
      );
      m.position.set(b.x, b.y, b.z);
      m.scale.setScalar(b.s);
      scene.add(m);
    }

    for (const p of PANELS_BG) {
      const m = new THREE.Mesh(
        bokehGeo,
        new THREE.ShaderMaterial({
          vertexShader: uvVert,
          fragmentShader: panelFrag,
          uniforms: { color: { value: p.c ? new THREE.Color(0.35, 0.45, 0.3) : col(v.bokeh[0]) }, alpha: { value: p.a } },
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
        }),
      );
      m.position.set(p.x, p.y, p.z);
      m.scale.set(p.w, p.h, 1);
      scene.add(m);
    }

    const discGeo = new THREE.PlaneGeometry(1.4, 1.4);
    const beamGeo = new THREE.CylinderGeometry(0.06, 0.15, 1.3, 24, 1, true);
    beamGeo.translate(0, 0.65, 0);
    for (const spec of FIGURES) {
      const group = new THREE.Group();
      group.position.set(spec.x, 0, spec.z);
      const mat = new THREE.ShaderMaterial({
        vertexShader: holoVert,
        fragmentShader: holoFrag,
        uniforms: { color: { value: fig.clone() }, scan: { value: 0 }, flicker: { value: 1 }, baseY: { value: 0 }, fade: { value: 1 } },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      // depth-only copy first, so only the front surface of the hologram adds up
      const occluder = new THREE.Mesh(MANNEQUIN, OCCLUDER);
      occluder.renderOrder = -1;
      const body = new THREE.Mesh(MANNEQUIN, mat);
      body.layers.enable(DEPTH_LAYER);
      body.renderOrder = 1;
      const wire = new LineMaterial({ color: fig.clone().multiplyScalar(0.55).getHex(), linewidth: 1, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
      fat.push({ mat: wire, width: 1.1 });
      const wg = new LineSegmentsGeometry();
      wg.setPositions(WIRE_POS);
      const wireMesh = new LineSegments2(wg, wire);
      const spinner = new THREE.Group();
      spinner.add(occluder, body, wireMesh);
      group.add(spinner);
      const disc = new THREE.ShaderMaterial({
        vertexShader: uvVert,
        fragmentShader: discFrag,
        uniforms: { color: { value: fig.clone() }, ringColor: { value: col(v.hud).multiplyScalar(1.2) }, pulse: { value: 0 } },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
      const dm = new THREE.Mesh(discGeo, disc);
      dm.rotation.x = -Math.PI / 2;
      dm.position.y = 0.01;
      dm.layers.enable(DEPTH_LAYER);
      group.add(dm);
      const beam = new THREE.Mesh(
        beamGeo,
        new THREE.ShaderMaterial({ vertexShader: uvVert, fragmentShader: beamFrag, uniforms: { color: { value: fig.clone() } }, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      );
      group.add(beam);
      scene.add(group);
      if (FIGURES.indexOf(spec) < 5) {
        // front row: drawn in its own pass (still in the depth pre-pass)
        group.traverse((o) => {
          const inDepth = o.layers.isEnabled(DEPTH_LAYER);
          o.layers.set(FRONT_LAYER);
          if (inDepth) o.layers.enable(DEPTH_LAYER);
        });
      }
      figs.push({ group: spinner, mat, wire, disc, spec });
    }

    // HUD tags (billboards with canvas textures) and leader lines, drawn as a crisp overlay
    const overlay = new THREE.Scene();
    const tags: { mesh: THREE.Mesh; tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D; kind: number; seed: number }[] = [];
    FIGURES.forEach((spec, i) => {
      if (spec.hud < 0) return;
      const kind = spec.hud;
      const aspect = TAG_KINDS[kind].aspect;
      const h = i >= 5 ? 0.3 : 0.2;
      const canvas = document.createElement("canvas");
      canvas.height = TAG_PX;
      canvas.width = Math.round(TAG_PX * aspect);
      const ctx = canvas.getContext("2d")!;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.75, 1, 1).multiplyScalar(i >= 5 ? 0.45 : 0.85), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), mat);
      const side = [1, 1, -1, 1, -1, 1, 1, -1, 1][i];
      const lift = [0.3, 0.45, 0.2, 0.55, -0.1, 0.6, 0.0, 0.4, 0][i];
      mesh.position.set(spec.x + side * (0.45 + (h * aspect) / 2), 1.7 + lift, spec.z);
      overlay.add(mesh);
      const lg = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(spec.x + side * 0.1, 1.62, spec.z),
        new THREE.Vector3(spec.x + side * 0.38, 1.7 + lift, spec.z),
        new THREE.Vector3(mesh.position.x - side * (h * aspect) / 2, mesh.position.y, spec.z),
      ]);
      const lp = lg.getAttribute("position").array as Float32Array;
      const lsg = new LineSegmentsGeometry();
      lsg.setPositions([lp[0], lp[1], lp[2], lp[3], lp[4], lp[5], lp[3], lp[4], lp[5], lp[6], lp[7], lp[8]]);
      const lm = new LineMaterial({ color: col(v.hud).multiplyScalar(0.7).getHex(), linewidth: 1, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
      fat.push({ mat: lm, width: 1.4 });
      overlay.add(new LineSegments2(lsg, lm));
      tags.push({ mesh, tex, ctx, kind, seed: i });
    });

    return { scene, overlay, figs, tags, fat, pointMats };
  }, [v]);

  const pipeline = useMemo(() => new HoloPipeline(), []);
  useEffect(() => () => pipeline.dispose(), [pipeline]);

  // Render callback: everything below is a pure function of the frame number.
  useFrame(({ gl }) => {
    const f = ((frameRef.current % LOOP) + LOOP) % LOOP;
    const t = f / LOOP; // 0..1 over the loop
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = 34;
    cam.near = 0.1;
    cam.far = 80;
    cam.position.set(0.1 + 0.5 * Math.sin(TAU * t), 2.45 + 0.08 * Math.sin(TAU * 2 * t), 7.9 + 0.3 * Math.cos(TAU * t));
    cam.lookAt(-0.1 + 0.25 * Math.sin(TAU * t), 0.62, -1.2);
    cam.updateProjectionMatrix();

    const bucket = Math.floor(f / 2);
    world.figs.forEach(({ group, mat, wire, disc, spec }, i) => {
      group.rotation.y = spec.spin + 0.26 * Math.sin(TAU * spec.cycles * t + spec.phase);
      mat.uniforms.scan.value = t * 8; // whole cycles per loop
      const fl = 1 - 0.07 * hash3(bucket, i, 11) - (hash3(bucket >> 3, i, 5) > 0.93 ? 0.12 : 0);
      mat.uniforms.flicker.value = fl;
      const dist = cam.position.distanceTo(new THREE.Vector3(spec.x, 1, spec.z));
      mat.uniforms.fade.value = Math.min(1, Math.pow(9.5 / dist, 1.6));
      wire.opacity = 0.6 * fl;
      disc.uniforms.pulse.value = 0.5 + 0.5 * Math.sin(TAU * (3 * t + i * 0.13));
    });
    // resolution-relative line widths and point sizes
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    const pxScale = buf.y / REF_H;
    world.fat.forEach(({ mat, width }) => {
      mat.resolution.set(buf.x, buf.y);
      mat.linewidth = width * pxScale;
    });
    world.pointMats.forEach((m) => (m.uniforms.pxScale.value = pxScale));
    const tick = Math.floor(f / 8);
    world.tags.forEach(({ mesh, tex, ctx, kind, seed }) => {
      mesh.quaternion.copy(cam.quaternion);
      drawTag(ctx, kind, tick * 7 + seed, v.hud);
      tex.needsUpdate = true;
    });

    pipeline.render(gl, world.scene, cam, { frame: f, focus: 8.0, focusRange: 4.5, depthLayer: DEPTH_LAYER, frontLayer: FRONT_LAYER }, world.overlay);
  }, 1);

  return null;
};

export const HoloPeople: React.FC<{ v: HoloVersion; loopCheck?: boolean }> = ({ v }) => {
  const { width, height } = useVideoConfig();
  const { bw } = bufferSize(width, height);
  // HUD tag text needs the fonts; hold the first frame until they are loaded.
  const [handle] = useState(() => (fontsLoaded() ? null : delayRender("Loading fonts")));
  const [ready, setReady] = useState(fontsLoaded());
  useEffect(() => {
    if (ready) return;
    loadFonts().then(() => {
      setReady(true);
      if (handle !== null) continueRender(handle);
    });
  }, [ready, handle]);
  if (!ready) return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={bw / width}
        gl={{ preserveDrawingBuffer: true, antialias: false, alpha: false, powerPreference: "high-performance" }}
        camera={{ fov: 34, near: 0.1, far: 80, position: [0, 2.7, 8.6] }}
      >
        <Scene v={v} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
