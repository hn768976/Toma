// Imperative three.js renderer. `render(gl, frame)` rebuilds the whole frame
// from the frame number alone: no clocks, no state carried between frames.

import {
  BufferGeometry,
  CustomBlending,
  CylinderGeometry,
  DataTexture,
  DataUtils,
  Float32BufferAttribute,
  GLSL3,
  HalfFloatType,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix3,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  OrthographicCamera,
  PerspectiveCamera,
  Quaternion,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
  DynamicDrawUsage,
  BufferAttribute,
} from 'three';
import {sceneColorForDisplayHex} from '../agx';
import {BACKGROUNDS, BackgroundId, ColourRow, LOOP_FRAMES} from '../data';
import {
  BACKGROUND_BODIES,
  Body,
  CAM_FOV,
  CAM_Z,
  FOCUS_DIST,
  HERO_AXIS,
  HERO_Q0,
  HEROES,
} from './layout';
import {
  BG_FRAG,
  FINAL_FRAG,
  FULLSCREEN_VERT,
  HERO_FRAG,
  HERO_VERT,
  IMPOSTOR_FRAG,
  IMPOSTOR_VERT,
} from './shaders';

const TAU = Math.PI * 2;

// fixed per-atom orientation offsets so each atom shows a different bubble set
const ATOM_TWISTS = [0, 1.7, 3.1, 4.4, 5.6].map((a, k) =>
  new Quaternion().setFromAxisAngle(new Vector3(Math.sin(k * 2.1), 1, Math.cos(k * 1.3)).normalize(), a),
);

// Look parameters (shared by all compositions).
export const LOOK = {
  envStrength: 0.3, // HDRI reflection level relative to the background
  specLevel: 2.6, // key highlight level relative to the background
  grain: 0.015, // +-1.5 % film grain
  vignette: 0.35,
  bloom: 0.8,
  heroBob: 0.05,
};

const blending = {
  blending: CustomBlending,
  blendSrc: OneFactor,
  blendDst: OneMinusSrcAlphaFactor,
  blendSrcAlpha: OneFactor,
  blendDstAlpha: OneMinusSrcAlphaFactor,
} as const;

const fullscreenTriangle = () => {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  return g;
};

type Instance = {
  a: Vector3;
  b: Vector3;
  r: number;
  pale: number;
  opacity: number;
  glow: number;
  z: number;
};

class ImpostorBatch {
  geometry = new InstancedBufferGeometry();
  mesh: Mesh;
  private aA: InstancedBufferAttribute;
  private aB: InstancedBufferAttribute;
  private aR: InstancedBufferAttribute;
  private aPale: InstancedBufferAttribute;
  private aOpacity: InstancedBufferAttribute;
  private aGlow: InstancedBufferAttribute;

  constructor(max: number, material: ShaderMaterial) {
    const g = this.geometry;
    g.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 3),
    );
    g.setAttribute('corner', new Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2));
    g.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
    const mk = (n: number) => {
      const a = new InstancedBufferAttribute(new Float32Array(max * n), n);
      a.setUsage(DynamicDrawUsage);
      return a;
    };
    this.aA = mk(3);
    this.aB = mk(3);
    this.aR = mk(1);
    this.aPale = mk(1);
    this.aOpacity = mk(1);
    this.aGlow = mk(1);
    g.setAttribute('iA', this.aA);
    g.setAttribute('iB', this.aB);
    g.setAttribute('iR', this.aR);
    g.setAttribute('iPale', this.aPale);
    g.setAttribute('iOpacity', this.aOpacity);
    g.setAttribute('iGlow', this.aGlow);
    this.mesh = new Mesh(g, material);
    this.mesh.frustumCulled = false;
  }

  set(list: Instance[]) {
    // back to front
    list.sort((p, q) => p.z - q.z);
    list.forEach((it, k) => {
      this.aA.setXYZ(k, it.a.x, it.a.y, it.a.z);
      this.aB.setXYZ(k, it.b.x, it.b.y, it.b.z);
      this.aR.setX(k, it.r);
      this.aPale.setX(k, it.pale);
      this.aOpacity.setX(k, it.opacity);
      this.aGlow.setX(k, it.glow);
    });
    for (const a of [this.aA, this.aB, this.aR, this.aPale, this.aOpacity, this.aGlow]) a.needsUpdate = true;
    this.geometry.instanceCount = list.length;
  }
}

export class MoleculeRenderer {
  private camera = new PerspectiveCamera(CAM_FOV, 16 / 9, 0.1, 200);
  private scene = new Scene();
  private postScene = new Scene();
  private postCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private target: WebGLRenderTarget | null = null;
  private glassUniforms: Record<string, {value: unknown}>;
  private heroMat: ShaderMaterial;
  private heroBondMat: ShaderMaterial;
  private bgBatch: ImpostorBatch;
  private fgBatch: ImpostorBatch;
  private finalMat: ShaderMaterial;
  private heroAtoms: Mesh[] = [];
  private heroBonds: Mesh[] = [];
  private bodies: Body[];
  private hero;
  private heroOffset: [number, number];
  private disposables: {dispose: () => void}[] = [];

  constructor(env: DataTexture, background: BackgroundId, colour: ColourRow) {
    this.bodies = BACKGROUND_BODIES[background];
    this.hero = HEROES[background];
    const bgRow = BACKGROUNDS.find((b) => b.id === background)!;
    this.heroOffset = bgRow.heroOffset;
    this.camera.position.set(0, 0, CAM_Z);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();

    const lin = (hex: string) => new Vector3(...sceneColorForDisplayHex(hex));
    const bgLight = lin(colour.bgLight);
    const bgDeep = lin(colour.bgDeep);
    const bgMid = bgLight.clone().add(bgDeep).multiplyScalar(0.5);
    const bgLum = bgMid.dot(new Vector3(0.2126, 0.7152, 0.0722));

    // HDRI: mipmapped equirect, normalised to its mean luminance.
    env.generateMipmaps = true;
    env.minFilter = LinearMipmapLinearFilter;
    env.magFilter = LinearFilter;
    env.needsUpdate = true;
    const envMean = meanLuminance(env);
    const envLodMax = Math.log2(Math.max(env.image.width, env.image.height));

    const viewToWorld = new Matrix3().setFromMatrix4(this.camera.matrixWorld);
    const light = new Vector3(-0.62, 0.62, 0.5).normalize();

    this.glassUniforms = {
      uEnv: {value: env},
      uEnvLodMax: {value: envLodMax},
      uEnvScale: {value: (bgLum * LOOK.envStrength) / envMean},
      uViewToWorld: {value: viewToWorld},
      uEdge: {value: lin(colour.atomEdge)},
      uCenter: {value: lin(colour.atomCenter)},
      uBgMid: {value: bgMid},
      uLight: {value: light},
      uSpecLevel: {value: bgLum * LOOK.specLevel},
      uEnvNorm: {value: 1 / envMean},
    };

    // background gradient
    const bgMat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: BG_FRAG,
      uniforms: {uBgLight: {value: bgLight}, uBgDeep: {value: bgDeep}},
      depthTest: false,
      depthWrite: false,
    });
    const bgQuad = new Mesh(fullscreenTriangle(), bgMat);
    bgQuad.frustumCulled = false;
    bgQuad.renderOrder = 0;
    this.scene.add(bgQuad);

    // impostors
    const impostorMat = () =>
      new ShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: IMPOSTOR_VERT,
        fragmentShader: IMPOSTOR_FRAG,
        uniforms: {
          ...this.glassUniforms,
          uCocK: {value: bgRow.cocK},
          uFocus: {value: FOCUS_DIST},
          uPixelScale: {value: 0},
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        ...blending,
      });
    let maxBg = 0;
    let maxFg = 0;
    for (const b of this.bodies) {
      const n = b.atoms.length + b.bonds.length;
      if (b.foreground) maxFg += n;
      else maxBg += n;
    }
    this.bgBatch = new ImpostorBatch(Math.max(1, maxBg), impostorMat());
    this.fgBatch = new ImpostorBatch(Math.max(1, maxFg), impostorMat());
    this.bgBatch.mesh.renderOrder = 1;
    this.fgBatch.mesh.renderOrder = 1000;
    this.scene.add(this.bgBatch.mesh, this.fgBatch.mesh);

    // hero
    const heroMat = (pale: number, opacity: number, bubbles: number) =>
      new ShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: HERO_VERT,
        fragmentShader: HERO_FRAG,
        uniforms: {
          ...this.glassUniforms,
          uPale: {value: pale},
          uOpacity: {value: opacity},
          uBubbles: {value: bubbles},
        },
        transparent: true,
        depthWrite: true,
        depthTest: true,
        ...blending,
      });
    this.heroMat = heroMat(0, 1, 1);
    this.heroBondMat = heroMat(0.05, 0.8, 0);
    const sphere = new SphereGeometry(1, 128, 96);
    const cyl = new CylinderGeometry(1, 1, 1, 48, 1, true);
    cyl.translate(0, 0.5, 0); // base at origin, extends +y
    for (const a of this.hero.atoms) {
      const m = new Mesh(sphere, this.heroMat);
      m.scale.setScalar(a.r);
      this.heroAtoms.push(m);
      this.scene.add(m);
    }
    for (const _b of this.hero.bonds) {
      const m = new Mesh(cyl, this.heroBondMat);
      m.renderOrder = 10;
      this.heroBonds.push(m);
      this.scene.add(m);
    }

    // final pass
    this.finalMat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: FINAL_FRAG,
      uniforms: {
        uScene: {value: null},
        uToneMappingExposure: {value: 1},
        uFrame: {value: 0},
        uGrain: {value: LOOK.grain},
        uVignette: {value: LOOK.vignette},
        uBloomThreshold: {value: bgLight.x * 1.05},
        uBloom: {value: LOOK.bloom},
      },
      depthTest: false,
      depthWrite: false,
    });
    const post = new Mesh(fullscreenTriangle(), this.finalMat);
    post.frustumCulled = false;
    this.postScene.add(post);

    this.disposables.push(sphere, cyl, bgMat, this.heroMat, this.heroBondMat, this.finalMat);
  }

  private ensureTarget(size: Vector2) {
    if (this.target && this.target.width === size.x && this.target.height === size.y) return;
    this.target?.dispose();
    this.target = new WebGLRenderTarget(size.x, size.y, {
      type: HalfFloatType,
      format: RGBAFormat,
      samples: 4,
      depthBuffer: true,
      generateMipmaps: true, // bloom samples the mip chain
      minFilter: LinearMipmapLinearFilter,
    });
  }

  /** Everything below is a pure function of `frame`. */
  render(gl: WebGLRenderer, frame: number) {
    const loopFrame = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
    const p = loopFrame / LOOP_FRAMES; // 0..1, exactly 0 again at frame 600

    const size = gl.getDrawingBufferSize(new Vector2());
    this.ensureTarget(size);
    const pixelScale = (2 * Math.tan(((CAM_FOV / 2) * Math.PI) / 180)) / size.y;
    (this.bgBatch.mesh.material as ShaderMaterial).uniforms.uPixelScale.value = pixelScale;
    (this.fgBatch.mesh.material as ShaderMaterial).uniforms.uPixelScale.value = pixelScale;

    this.updateHero(p);
    this.updateBackground(p);

    gl.autoClear = true;
    gl.setRenderTarget(this.target);
    gl.setClearColor(0x000000, 1);
    gl.render(this.scene, this.camera);
    gl.setRenderTarget(null);
    this.finalMat.uniforms.uScene.value = this.target!.texture;
    this.finalMat.uniforms.uFrame.value = loopFrame;
    gl.render(this.postScene, this.postCamera);
  }

  private updateHero(p: number) {
    const q = new Quaternion().setFromAxisAngle(HERO_AXIS, TAU * p).multiply(HERO_Q0);
    const offset = new Vector3(
      this.heroOffset[0] + 0.02 * Math.sin(TAU * p),
      this.heroOffset[1] + LOOK.heroBob * Math.sin(TAU * 2 * p),
      0,
    );
    const world = this.hero.atoms.map((a) => a.p.clone().applyQuaternion(q).add(offset));
    // atoms: back to front, after the bonds
    const order = world.map((w, k) => ({k, z: w.z})).sort((a, b) => a.z - b.z);
    order.forEach(({k}, rank) => {
      const m = this.heroAtoms[k];
      m.position.copy(world[k]);
      m.quaternion.copy(q).multiply(ATOM_TWISTS[k % ATOM_TWISTS.length]);
      m.renderOrder = 20 + rank;
    });
    this.hero.bonds.forEach((b, k) => {
      const m = this.heroBonds[k];
      const from = world[b.i];
      const to = world[b.j];
      const dir = to.clone().sub(from).normalize();
      // the rods run on into the atoms, seen through the glass
      const start = from.clone().addScaledVector(dir, this.hero.atoms[b.i].r * 0.2);
      const end = to.clone().addScaledVector(dir, -this.hero.atoms[b.j].r * 0.2);
      m.position.copy(start);
      m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);
      m.scale.set(b.r, end.distanceTo(start), b.r);
    });
  }

  private updateBackground(p: number) {
    const bg: Instance[] = [];
    const fg: Instance[] = [];
    const camZ = CAM_Z;
    for (const body of this.bodies) {
      const th = TAU * (body.driftFreq * p + body.driftPhase);
      const c = body.center
        .clone()
        .addScaledVector(body.ampSin, Math.sin(th))
        .addScaledVector(body.ampCos, Math.cos(th));
      const q = body.q0
        .clone()
        .multiply(
          new Quaternion().setFromAxisAngle(
            body.spinAxis,
            TAU * (body.spinTurns * p + body.spinPhase),
          ),
        );
      // view space (camera looks down -z from (0,0,camZ), no rotation)
      const pts = body.atoms.map((a) => {
        const w = a.p.clone().applyQuaternion(q).add(c);
        w.z -= camZ;
        return w;
      });
      const list = body.foreground ? fg : bg;
      body.atoms.forEach((a, k) => {
        list.push({
          a: pts[k],
          b: pts[k],
          r: a.r,
          pale: body.pale,
          opacity: body.opacity,
          glow: body.glow ?? 0,
          z: pts[k].z,
        });
      });
      for (const bond of body.bonds) {
        const A = pts[bond.i];
        const B = pts[bond.j];
        const d = B.clone().sub(A);
        const len = d.length();
        d.multiplyScalar(1 / len);
        // stop at the atom surfaces so bonds never draw over their atoms
        const a = A.clone().addScaledVector(d, body.atoms[bond.i].r * 0.85);
        const b = B.clone().addScaledVector(d, -body.atoms[bond.j].r * 0.85);
        list.push({
          a,
          b,
          r: bond.r,
          pale: Math.min(1, body.pale + 0.12),
          opacity: body.opacity * body.bondOpacity,
          glow: 0,
          z: (a.z + b.z) / 2 - 1e-3,
        });
      }
    }
    this.bgBatch.set(bg);
    this.fgBatch.set(fg);
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.bgBatch.geometry.dispose();
    this.fgBatch.geometry.dispose();
    this.target?.dispose();
  }
}

const meanLuminance = (tex: DataTexture) => {
  const {data, width, height} = tex.image as {
    data: Uint16Array | Float32Array;
    width: number;
    height: number;
  };
  const half = tex.type === HalfFloatType;
  const get = (i: number) => (half ? DataUtils.fromHalfFloat(data[i]) : data[i]);
  let sum = 0;
  let wsum = 0;
  const stride = data.length / (width * height);
  for (let y = 0; y < height; y += 2) {
    // equirect: weight rows by solid angle
    const w = Math.cos(((y + 0.5) / height - 0.5) * Math.PI);
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * stride;
      sum += w * (0.2126 * get(i) + 0.7152 * get(i + 1) + 0.0722 * get(i + 2));
      wsum += w;
    }
  }
  return sum / wsum;
};
