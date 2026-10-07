import * as THREE from "three";
import { hexLinear } from "../lib/color";
import { PostPipeline, planeDepthAtNdc, viewPlane } from "../lib/post";
import { HEADER } from "../lib/shaders";
import type { LookRenderer } from "../lib/Stage";
import type { TerminalVersion } from "../versions";
import {
  LABEL_CANVAS,
  LABEL_LAYOUT,
  TEXT_CANVAS,
  TEXT_LAYOUT,
  drawLabelScreen,
  drawTextScreen,
  makeGlobe,
} from "./screenContent";
import { STORY_FRAMES, T, clamp01, smoother } from "./timeline";

// ---------------------------------------------------------------- screen geometry (world units)
// The monitor is the plane z = 0. Region A (text) and region B (label + background shape) are
// two areas of the same screen, each with its own 4096 x 2304 canvas texture.
const A = { x0: 0, y0: 0, w: 16, h: 9 };
const B = { x0: 9, y0: -9.25, w: 12, h: 6.75 };
const pxA = A.w / TEXT_CANVAS.w;
const pxB = B.w / LABEL_CANVAS.w;

const textLineY = (li: number) => A.y0 + A.h - (TEXT_LAYOUT.firstBaseline + li * TEXT_LAYOUT.lineGap) * pxA;
const TEXT_MID_Y = textLineY(1) + 0.2;
const LABEL_CENTER = new THREE.Vector3(
  B.x0 + (LABEL_LAYOUT.stripX + LABEL_LAYOUT.stripW * 0.4) * pxB,
  B.y0 + B.h - (LABEL_LAYOUT.stripY + LABEL_LAYOUT.stripH * 0.5) * pxB,
  0,
);

// az: direction along the screen (0 = looking toward +x, -180 = toward -x); graze: angle to the screen.
type Pose = { target: THREE.Vector3; graze: number; az: number; dist: number; roll: number };

const FOV = 38;

// Camera pose as a pure function of (fractional) story time in frames.
const poseAt = (t: number): Pose => {
  // Text shot: a 3/4 view along the lines; the focus slides a little with the typing.
  const typeP = clamp01((t - T.lineStart[0]) / (T.typeEnd - T.lineStart[0]));
  const textX = 4.6 + 1.4 * smoother(typeP) + 0.01 * Math.max(0, t - T.typeEnd);
  const text: Pose = {
    target: new THREE.Vector3(textX, TEXT_MID_Y, 0),
    graze: 40,
    az: -3,
    dist: 4.7,
    roll: 0,
  };
  // Label shot: strip recedes to the right and descends slightly; slow push-in + drift.
  const hold = clamp01((t - T.labelIn[0]) / (STORY_FRAMES - T.labelIn[0]));
  const label: Pose = {
    target: LABEL_CENTER.clone().add(new THREE.Vector3(0.2 * Math.sin(hold * 2.4), 0.08 * Math.sin(hold * 3.1 + 0.6), 0)),
    graze: 44 + 2 * hold,
    az: 9,
    dist: 7.6 - 0.9 * smoother(hold),
    roll: -3,
  };
  if (t <= T.whipStart) return text;
  if (t >= T.whipEnd) return label;
  // Whip: slides sideways and down across the screen to the label.
  const s = smoother((t - T.whipStart) / (T.whipEnd - T.whipStart));
  const arc = Math.sin(Math.PI * s);
  return {
    // Sideways along the redaction bars first, then down to the label.
    target: new THREE.Vector3(
      text.target.x + (label.target.x - text.target.x) * smoother(Math.min(1, s * 1.7)),
      text.target.y + (label.target.y - text.target.y) * smoother((s - 0.3) / 0.7),
      0,
    ),
    graze: text.graze + (label.graze - text.graze) * s - 6 * arc,
    az: text.az + (label.az - text.az) * s - 25 * arc,
    dist: text.dist + (label.dist - text.dist) * s + 1.5 * arc,
    roll: text.roll + (label.roll - text.roll) * s,
  };
};

const applyPose = (cam: THREE.PerspectiveCamera, p: Pose) => {
  const g = THREE.MathUtils.degToRad(p.graze);
  const az = THREE.MathUtils.degToRad(p.az);
  const d = new THREE.Vector3(Math.cos(g) * Math.cos(az), Math.cos(g) * Math.sin(az), -Math.sin(g)).normalize();
  cam.position.copy(p.target).addScaledVector(d, -p.dist);
  const right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
  const up0 = new THREE.Vector3().crossVectors(right, d).normalize();
  const r = THREE.MathUtils.degToRad(p.roll);
  cam.up.copy(up0.multiplyScalar(Math.cos(r)).addScaledVector(right, Math.sin(r)));
  cam.lookAt(p.target);
  cam.updateMatrixWorld(true);
};

// ---------------------------------------------------------------- screen shader
const SCREEN_VERT = /* glsl */ `${HEADER}
in vec3 position;
in vec2 uv;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 modelMatrix;
out vec2 vUv;
out vec2 vScreen;
void main() {
  vUv = uv;
  vScreen = (modelMatrix * vec4(position, 1.0)).xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SCREEN_FRAG = /* glsl */ `${HEADER}
in vec2 vUv;
in vec2 vScreen;
uniform sampler2D tScreen;
uniform bool hasTex;
uniform vec3 cBase;
uniform float uGain;
uniform float uPitch;      // display pixel pitch (world units)
uniform float uMask;       // sub-pixel mask strength
out vec4 outColor;
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
void main() {
  vec3 c = hasTex ? toLinear(texture(tScreen, vUv).rgb) : cBase;
  // Emissive boost so text and bars bloom; dark background stays dark.
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c *= uGain * (0.75 + 0.25 * smoothstep(0.05, 0.4, lum)) / (1.0 + 0.6 * smoothstep(0.45, 0.9, lum));
  // RGB stripe sub-pixel mask, only where a display pixel spans several frame pixels.
  vec2 cell = vScreen / uPitch;
  vec2 fw = fwidth(cell);
  float vis = 1.0 - smoothstep(0.05, 0.14, max(fw.x, fw.y * 0.5));
  float fx = fract(cell.x);
  vec3 stripe = vec3(
    smoothstep(0.02, 0.06, fx) * (1.0 - smoothstep(0.28, 0.32, fx)),
    smoothstep(0.35, 0.39, fx) * (1.0 - smoothstep(0.61, 0.65, fx)),
    smoothstep(0.68, 0.72, fx) * (1.0 - smoothstep(0.94, 0.98, fx))
  );
  float fy = fract(cell.y);
  float row = smoothstep(0.03, 0.1, fy) * (1.0 - smoothstep(0.9, 0.97, fy));
  vec3 mask = stripe * row * 3.6;
  c *= mix(vec3(1.0), mask, vis * uMask);
  // Slight scanline brightness variation.
  c *= 0.975 + 0.025 * sin(vScreen.y / uPitch * 0.5);
  outColor = vec4(c, 1.0);
}
`;

// ---------------------------------------------------------------- renderer
export class TerminalRenderer implements LookRenderer {
  private post: PostPipeline;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 100);
  private canvasA = document.createElement("canvas");
  private canvasB = document.createElement("canvas");
  private ctxA: CanvasRenderingContext2D;
  private ctxB: CanvasRenderingContext2D;
  private texA: THREE.CanvasTexture;
  private texB: THREE.CanvasTexture;
  private meshA: THREE.Mesh;
  private meshB: THREE.Mesh;
  private globe: HTMLCanvasElement;
  private h = 1;
  private bg: [number, number, number];

  constructor(
    gl: THREE.WebGLRenderer,
    private v: TerminalVersion,
  ) {
    this.post = new PostPipeline(gl);
    this.bg = hexLinear(v.background);
    this.canvasA.width = TEXT_CANVAS.w;
    this.canvasA.height = TEXT_CANVAS.h;
    this.canvasB.width = LABEL_CANVAS.w;
    this.canvasB.height = LABEL_CANVAS.h;
    this.ctxA = this.canvasA.getContext("2d")!;
    this.ctxB = this.canvasB.getContext("2d")!;
    this.globe = makeGlobe(v);
    const aniso = gl.capabilities.getMaxAnisotropy();
    const mkTex = (c: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.NoColorSpace;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = Math.min(16, aniso);
      return t;
    };
    this.texA = mkTex(this.canvasA);
    this.texB = mkTex(this.canvasB);

    const mat = (tex: THREE.Texture | null) =>
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: SCREEN_VERT,
        fragmentShader: SCREEN_FRAG,
        uniforms: {
          tScreen: { value: tex },
          hasTex: { value: tex !== null },
          cBase: { value: new THREE.Vector3(...this.bg) },
          uGain: { value: 1.25 },
          uPitch: { value: 0.02 },
          uMask: { value: 0.85 },
        },
      });
    // Glass: the rest of the screen surface (background colour + sub-pixel mask).
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), mat(null));
    glass.position.set(10, -2, -0.002);
    this.scene.add(glass);
    this.meshA = new THREE.Mesh(new THREE.PlaneGeometry(A.w, A.h), mat(this.texA));
    this.meshA.position.set(A.x0 + A.w / 2, A.y0 + A.h / 2, 0);
    this.meshB = new THREE.Mesh(new THREE.PlaneGeometry(B.w, B.h), mat(this.texB));
    this.meshB.position.set(B.x0 + B.w / 2, B.y0 + B.h / 2, 0);
    this.scene.add(this.meshA, this.meshB);
    [glass, this.meshA, this.meshB].forEach((m) => (m.frustumCulled = false));
  }

  setSize(w: number, h: number) {
    this.h = h;
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private renderAt(t: number) {
    const cam = this.camera;
    applyPose(cam, poseAt(t));
    this.post.renderScene(this.scene, cam, this.bg);
    const plane = viewPlane(cam, new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0));
    const zf = planeDepthAtNdc(cam, plane, 0, 0);
    const label = t >= T.whipEnd;
    return this.post.dof({
      camera: cam,
      planeView: plane,
      focusDepth: zf,
      cocK: (label ? 0.022 : 0.03) * this.h * zf,
      maxCoc: 0.05 * this.h,
    });
  }

  render(frame: number) {
    const f = Math.min(frame, STORY_FRAMES - 1);
    const showA = f < T.whipEnd + 3;
    const showB = f >= T.whipStart - 2;
    this.meshA.visible = showA;
    this.meshB.visible = showB;
    if (showA) {
      drawTextScreen(this.ctxA, f, this.v);
      this.texA.needsUpdate = true;
    }
    if (showB) {
      drawLabelScreen(this.ctxB, f, this.v, this.globe);
      this.texB.needsUpdate = true;
    }

    // Motion blur during the whip: average of deterministic sub-frames (180-degree shutter).
    const inWhip = f >= T.whipStart - 1 && f <= T.whipEnd + 1;
    let src: THREE.Texture;
    if (inWhip) {
      const N = 10;
      this.post.clearAccum();
      for (let k = 0; k < N; k++) {
        const t = f - 0.25 + (0.5 * (k + 0.5)) / N;
        this.post.accumulate(this.renderAt(t), 1 / N);
      }
      src = this.post.accum.texture;
    } else {
      src = this.renderAt(f);
    }

    const glitch = f >= T.glitch[0] && f < T.glitch[1];
    const split = glitch ? (f % 2 === 0 ? 0.006 : -0.0045) : 0.0011;
    this.post.finish(src, {
      bloomStrength: 0.75,
      bloomThreshold: 0.6,
      bloomKnee: 0.5,
      bloomRadius: 0.9,
      caEdge: 0.006,
      rgbSplit: split,
      knee: 0.9,
      gradeGain: this.v.gradeGain,
      gradeLift: this.v.gradeLift,
      exposure: 1,
      vignette: 0.5,
      grain: 0.015,
      grainFrame: f % STORY_FRAMES,
    });
  }

  dispose() {
    this.post.dispose();
    this.texA.dispose();
    this.texB.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}

export const TEXT_LINE_Y = [0, 1, 2].map(textLineY);
