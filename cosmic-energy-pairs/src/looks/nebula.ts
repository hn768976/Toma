import * as THREE from "three";
import { NebulaColours } from "../colourways";
import { lin } from "../lib/color";
import { NOISE } from "../lib/glsl";
import { FullScreenQuad, PostPipeline, PostSettings, rawMat } from "../lib/pipeline";
import { mulberry32 } from "../lib/random";
import { FrameInfo, Look } from "../lib/Stage";

/**
 * LOOK 5 — Nebula Core (20 s loop, 600 frames).
 *
 * 12 cloud planes at different depths, each a domain-warped fbm computed in the
 * fragment shader, coloured by density (dark dust edges, glowing centres) and
 * lit by the core. Premultiplied "over" blending back-to-front gives both
 * emission (glowing gas) and absorption (dust lanes).
 *
 * Loop design: noise is sampled at p + r·(cos 2πt, sin 2πt) (a closed circle
 * in noise space; two octave groups go round in opposite directions so the
 * clouds billow instead of sliding), the camera follows a closed Lissajous path
 * with whole-number frequencies, and star twinkles use whole-number cycles.
 *
 * Cost control: clouds are rendered into an offscreen buffer at
 * NEBULA_CLOUD_SCALE of the output resolution (they're soft), stars at full res.
 */

export const NEBULA_LOOP = 600;
export const NEBULA_POST: PostSettings = {
  bloomStrength: 0.9,
  bloomRadius: 0.85,
  bloomThreshold: 0.35,
  exposure: 1.0,
  grain: 0.02,
  pureBlack: false,
};
export const NEBULA_CLOUD_SCALE = 0.5;

const LAYERS = 12;
const STARS = 9000;
const CORE = new THREE.Vector3(0, 0, -4);
const FOV = 50;

export const nebulaCameraAt = (t: number) => {
  const th = 2 * Math.PI * t;
  const pos = new THREE.Vector3(1.1 * Math.sin(th), 0.55 * Math.sin(2 * th), 8.5 + 1.1 * Math.cos(th));
  const target = CORE.clone().add(new THREE.Vector3(-0.35 * Math.sin(th), -0.15 * Math.sin(2 * th), 0));
  return { pos, target };
};

const PLANE_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CLOUD_FRAG = /* glsl */ `
precision highp float;
uniform float uT;
uniform vec3 uCore;
uniform vec3 uCamPos;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uDust;
uniform vec3 uCoreCol;
uniform float uSeed;
uniform float uFreq;
uniform float uGain;     // layer brightness
uniform float uDustAmt;  // layer absorption
uniform float uSpread;   // how far from the core this layer reaches
in vec3 vWorld;
out vec4 outColor;
${NOISE}

float fbm(vec3 p, int oct) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * snoise(p);
    p = p * 2.03 + vec3(1.7, -2.3, 0.9);
    a *= 0.5;
  }
  return s;
}

void main() {
  float th = 6.28318530718 * uT;
  vec2 c1 = vec2(cos(th), sin(th));
  vec2 xy = vWorld.xy * uFreq;
  // Domain warp (time circle radius 0.45), then main fbm (opposite circle).
  vec3 wq = vec3(xy + c1 * 0.45, uSeed);
  vec2 warp = vec2(fbm(wq, 3), fbm(wq + vec3(5.2, 1.3, 2.7), 3));
  vec3 mq = vec3(xy + warp * 1.35 - c1.yx * vec2(0.3, -0.3), uSeed + 3.1);
  float n = fbm(mq, 6);
  float colN = snoise(vec3(xy * 0.6 + warp * 0.5, uSeed + 9.0));

  // Concentrate the nebula around the core, with ragged edges.
  vec2 rel = vWorld.xy - uCore.xy;
  float rr = length(rel * vec2(0.8, 1.15)) / uSpread;
  float mask = exp(-rr * rr * 1.6) * (0.75 + 0.5 * warp.x);

  float dens = clamp((n * 0.9 + 0.32) * mask * 1.7, 0.0, 1.0);
  float glow = smoothstep(0.18, 0.85, dens);
  float edge = smoothstep(0.05, 0.4, dens) * (1.0 - glow);

  float dCore = length(vWorld - uCore);
  float light = 1.0 / (1.0 + dCore * dCore * 0.09) + 0.6 * exp(-dCore * dCore * 0.35);

  vec3 gas = mix(uColA, uColB, smoothstep(0.05, 0.7, 0.85 * light + 0.35 * colN));
  vec3 emit = gas * glow * uGain * (0.1 + 1.6 * light) + uCoreCol * glow * light * light * 0.5 * uGain;
  // Dust: dark, absorbing, at the cloud edges and in fine fbm detail.
  float dust = uDustAmt * (edge * 1.0 + smoothstep(0.1, 0.5, -n) * mask * 0.8);
  float a = clamp(dust + glow * 0.25, 0.0, 0.92);
  vec3 col = emit + uDust * dust * 0.4;
  outColor = vec4(col, a);
}
`;

const CORE_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CORE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCoreCol;
uniform vec3 uColB;
in vec2 vUv;
out vec4 outColor;
void main() {
  float r2 = dot(vUv, vUv);
  float c = 40.0 * exp(-r2 * 300.0) + 7.0 * exp(-r2 * 40.0) + 1.2 * exp(-r2 * 8.0);
  vec3 col = uCoreCol * c + uColB * 0.6 * exp(-r2 * 5.0);
  col *= 1.0 - smoothstep(0.8, 1.0, sqrt(r2));
  outColor = vec4(col, 0.0); // pure emission, no absorption
}
`;

const BG_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uSpace;
uniform vec3 uColA;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 d = vUv - 0.5;
  vec3 c = uSpace + uColA * 0.035 * exp(-dot(d, d) * 5.0);
  outColor = vec4(c, 1.0);
}
`;

const STAR_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uT;
uniform float uPx;
in vec3 position;
in vec4 aStar; // x: size, y: brightness, z: twinkle freq (whole number), w: phase
out float vI;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 0.1);
  float s = aStar.x * uPx * clamp(14.0 / depth, 0.6, 2.5);
  gl_PointSize = max(s, 1.0 * uPx);
  float tw = aStar.z > 0.0 ? 0.55 + 0.45 * sin(6.28318530718 * (aStar.z * uT + aStar.w)) : 1.0;
  vI = aStar.y * tw * min(1.0, s / uPx);
}
`;

const STAR_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uStar;
in float vI;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  outColor = vec4(uStar * vI * exp(-r2 * 6.0), 1.0);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tCloud;
in vec2 vUv;
out vec4 outColor;
void main() { outColor = texture(tCloud, vUv); }
`;

export class NebulaLook implements Look {
  cloudScene = new THREE.Scene();
  nearStarScene = new THREE.Scene();
  farStarScene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 200);
  quad = new FullScreenQuad();
  bgMat: THREE.RawShaderMaterial;
  compMat: THREE.RawShaderMaterial;
  rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  u: Record<string, THREE.IUniform>;

  constructor(c: NebulaColours) {
    this.u = {
      uT: { value: 0 },
      uPx: { value: 1 },
      uCore: { value: CORE.clone() },
      uCamPos: { value: new THREE.Vector3() },
      uColA: { value: lin(c.cloudA) },
      uColB: { value: lin(c.cloudB) },
      uDust: { value: lin(c.dust) },
      uCoreCol: { value: lin(c.core) },
    };
    this.bgMat = rawMat(BG_FRAG, { uSpace: { value: lin(c.space) }, uColA: this.u.uColA });
    // Premultiplied "over" onto the HDR image: out = cloud.rgb + dst·(1 − cloud.a).
    this.compMat = rawMat(
      COMPOSITE_FRAG,
      { tCloud: { value: null } },
      {
        transparent: true,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      },
    );

    const over = {
      transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      side: THREE.DoubleSide,
    };

    const rng = mulberry32(0x0e8a);
    const tanHalf = Math.tan(((FOV / 2) * Math.PI) / 180);
    for (let i = 0; i < LAYERS; i++) {
      // Depths from far behind the core to just in front of the camera's path.
      const z = -22 + (i / (LAYERS - 1)) * 25 + (rng() - 0.5) * 0.8;
      const dist = 10 - z;
      const h = 2 * dist * tanHalf * 1.5;
      const near = z > CORE.z;
      const geo = new THREE.PlaneGeometry(h * (16 / 9), h);
      const mat = rawMat(
        CLOUD_FRAG,
        {
          ...this.u,
          uSeed: { value: rng() * 50 },
          uFreq: { value: (0.17 + rng() * 0.07) * (near ? 1.35 : 1) },
          uGain: { value: (near ? 0.55 : 1.0) * (0.7 + rng() * 0.6) },
          uDustAmt: { value: near ? 0.75 : 0.45 },
          uSpread: { value: (near ? 6.0 : 8.5) + Math.max(0, -z - 4) * 0.45 },
        },
        over,
        PLANE_VERT,
      );
      const m = new THREE.Mesh(geo, mat);
      m.position.set(CORE.x + (rng() - 0.5) * 0.8, CORE.y + (rng() - 0.5) * 0.5, z);
      m.renderOrder = i * 2;
      m.frustumCulled = false;
      this.cloudScene.add(m);
      if (!near && z + (25 / (LAYERS - 1)) > CORE.z) {
        // Core sits between the last far layer and the first near layer.
        const core = new THREE.Mesh(
          new THREE.PlaneGeometry(9, 9),
          rawMat(CORE_FRAG, { ...this.u }, over, CORE_VERT),
        );
        core.position.copy(CORE);
        core.renderOrder = i * 2 + 1;
        core.frustumCulled = false;
        core.name = "core";
        this.cloudScene.add(core);
      }
    }

    // Stars: far ones behind the clouds (dimmed by dust), a few near ones on top.
    const srng = mulberry32(0x57a2);
    const mk = (count: number, zMin: number, zMax: number, spread: number) => {
      const pos = new Float32Array(count * 3);
      const data = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) {
        const z = zMin + srng() * (zMax - zMin);
        const d = 10 - z;
        pos.set([(srng() * 2 - 1) * d * spread * 1.78, (srng() * 2 - 1) * d * spread, z], i * 3);
        const big = srng() < 0.04;
        const tw = srng() < 0.3 ? 1 + Math.floor(srng() * 4) : 0;
        data.set([(big ? 3.2 : 1.6) * (0.6 + srng() * 0.7), (big ? 2.4 : 0.7) * (0.3 + srng()), tw, srng()], i * 4);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("aStar", new THREE.BufferAttribute(data, 4));
      const p = new THREE.Points(
        g,
        rawMat(STAR_FRAG, { ...this.u, uStar: { value: lin(c.star) } }, { transparent: true, blending: THREE.AdditiveBlending }, STAR_VERT),
      );
      p.frustumCulled = false;
      return p;
    };
    this.farStarScene.add(mk(Math.round(STARS * 0.85), -60, -6, 0.62));
    this.nearStarScene.add(mk(Math.round(STARS * 0.15), -4, 4, 0.62));
  }

  render(gl: THREE.WebGLRenderer, pipe: PostPipeline, f: FrameInfo) {
    const t = f.frame / NEBULA_LOOP;
    const { pos, target } = nebulaCameraAt(t);
    this.camera.position.copy(pos);
    this.camera.lookAt(target);
    this.camera.aspect = f.width / f.height;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.u.uT.value = t;
    this.u.uPx.value = f.px;
    this.u.uCamPos.value.copy(pos);
    // Core billboard faces the camera.
    this.cloudScene.getObjectByName("core")?.quaternion.copy(this.camera.quaternion);

    // 1) Background + far stars, full res, into the HDR target.
    this.quad.render(gl, this.bgMat);
    gl.render(this.farStarScene, this.camera);

    // 2) Clouds into the reduced-res buffer (premultiplied RGBA).
    const w = Math.max(1, Math.round(f.width * NEBULA_CLOUD_SCALE));
    const h = Math.max(1, Math.round(f.height * NEBULA_CLOUD_SCALE));
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
    gl.setRenderTarget(this.rt);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, false, false);
    gl.render(this.cloudScene, this.camera);

    // 3) Composite clouds over, then near stars on top.
    gl.setRenderTarget(pipe.hdr);
    this.compMat.uniforms.tCloud.value = this.rt.texture;
    this.quad.render(gl, this.compMat);
    gl.render(this.nearStarScene, this.camera);
  }

  dispose() {
    this.quad.dispose();
    this.bgMat.dispose();
    this.compMat.dispose();
    this.rt.dispose();
    for (const s of [this.cloudScene, this.farStarScene, this.nearStarScene]) {
      s.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) (o.material as THREE.Material).dispose();
      });
    }
  }
}
