import * as THREE from "three";
import { buildField, buildHelix, type LayerSet, type LineBuffer, type PointBuffer } from "./build";
import {
  bgFragment,
  bgVertex,
  facetFragment,
  facetVertex,
  glowFragment,
  glowVertex,
  lineFragment,
  lineVertex,
  pointFragment,
  pointVertex,
} from "./shaders";
import type { Preset } from "./types";

const additive = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
} as const;

/**
 * Owns one WebGL2 renderer for a <canvas>. `render(t)` is a pure function of
 * time: it repositions the camera/helix and redraws, so any frame can be
 * rendered in any order (required by Remotion's parallel rendering).
 */
export class DnaEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private helix = new THREE.Group();
  private glows: { mesh: THREE.Mesh; local: THREE.Vector3 }[] = [];
  private glowUniforms?: Record<string, THREE.IUniform>;
  private blobGeom?: THREE.BufferGeometry;
  private shared: Record<string, THREE.IUniform>;
  private bgUniforms: Record<string, THREE.IUniform>;
  private disposables: { dispose: () => void }[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    private width: number,
    private height: number,
    private preset: Preset,
    private duration: number,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x000000, 1);

    const gl = this.renderer.getContext();
    const pointRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array;
    const maxPoint = Math.max(64, pointRange ? pointRange[1] : 256);

    this.camera = new THREE.PerspectiveCamera(35, width / height, 0.05, 200);

    const pxScale = height / 1080;
    this.shared = {
      uTime: { value: 0 },
      uFocus: { value: 5 },
      uAperture: { value: preset.dof.aperture },
      uPxScale: { value: pxScale },
      uMaxCoc: { value: preset.dof.maxCoc },
      uRefDepth: { value: preset.dof.refDepth },
      uMaxPoint: { value: maxPoint },
      uRingAmount: { value: preset.dof.ringAmount },
      uTwinkle: { value: preset.twinkle },
      uResolution: { value: new THREE.Vector2(width, height) },
      uNearFade: { value: 0.9 },
      uFog: { value: new THREE.Vector2(preset.fog?.start ?? 1000, preset.fog?.density ?? 0) },
    };

    // --- background
    const bg = preset.bg;
    this.bgUniforms = {
      uDark: { value: new THREE.Color(...bg.dark) },
      uMid: { value: new THREE.Color(...bg.mid) },
      uLight: { value: new THREE.Color(...bg.light) },
      uCenter: { value: new THREE.Vector2(...bg.center) },
      uRadius: { value: new THREE.Vector2(...bg.radius) },
      uVignette: { value: bg.vignette },
      uAspect: { value: width / height },
      uTime: { value: 0 },
    };
    const bgMat = new THREE.ShaderMaterial({
      vertexShader: bgVertex,
      fragmentShader: bgFragment,
      uniforms: this.bgUniforms,
      depthTest: false,
      depthWrite: false,
    });
    const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    bgMesh.frustumCulled = false;
    bgMesh.renderOrder = -100;
    this.scene.add(bgMesh);
    this.track(bgMesh.geometry, bgMat);

    // --- volumetric glow column (world-space billboards following the helix)
    if (preset.glow) {
      const g = preset.glow;
      this.glowUniforms = {
        uColor: { value: new THREE.Color(...g.color) },
        uIntensity: { value: g.intensity },
      };
      const mat = new THREE.ShaderMaterial({
        vertexShader: glowVertex,
        fragmentShader: glowFragment,
        uniforms: this.glowUniforms,
        ...additive,
      });
      const geom = new THREE.PlaneGeometry(g.size, g.size);
      this.track(geom, mat);
      const [y0, y1] = g.yRange ?? [preset.helix.yMin, preset.helix.yMax];
      for (let y = y0; y <= y1 + 1e-6; y += g.spacing) {
        const mesh = new THREE.Mesh(geom, mat);
        mesh.renderOrder = -50;
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        this.glows.push({ mesh, local: new THREE.Vector3(g.offset[0], y, g.offset[1]) });
      }
    }

    // --- background plexus field (world space)
    const field = buildField(preset.field, preset.seed * 7 + 3);
    this.addLayer(field, this.scene, -20, preset.dof.fieldApertureScale);

    // --- the DNA helix
    const helix = buildHelix(preset.helix, preset.seed);
    this.addLayer(helix, this.helix, 0);
    this.scene.add(this.helix);

    // --- foreground out-of-focus blobs (positions animated per frame)
    if (preset.blobs && preset.blobs.length) {
      const n = preset.blobs.length;
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geom.setAttribute("color", new THREE.BufferAttribute(new Float32Array(preset.blobs.flatMap((b) => [...b.color])), 3));
      geom.setAttribute("size", new THREE.BufferAttribute(new Float32Array(preset.blobs.map((b) => b.size)), 1));
      geom.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(n), 1));
      geom.setAttribute("kind", new THREE.BufferAttribute(new Float32Array(n).fill(3), 1));
      geom.setAttribute("phase", new THREE.BufferAttribute(new Float32Array(n), 1));
      geom.setAttribute("axis", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const mat = this.pointMaterial(1);
      const pts = new THREE.Points(geom, mat);
      pts.frustumCulled = false;
      pts.renderOrder = 50;
      this.scene.add(pts);
      this.blobGeom = geom;
      this.track(geom, mat);
    }
  }

  private track(...items: { dispose: () => void }[]) {
    this.disposables.push(...items);
  }

  private pointMaterial(gain: number, apertureScale = 1) {
    return new THREE.ShaderMaterial({
      vertexShader: pointVertex,
      fragmentShader: pointFragment,
      uniforms: {
        ...this.shared,
        uGain: { value: gain },
        uAperture: { value: this.preset.dof.aperture * apertureScale },
      },
      ...additive,
    });
  }

  private lineMaterial(width: number, gain: number, apertureScale = 1) {
    return new THREE.ShaderMaterial({
      vertexShader: lineVertex,
      fragmentShader: lineFragment,
      uniforms: {
        ...this.shared,
        uWidth: { value: width },
        uGain: { value: gain },
        uAperture: { value: this.preset.dof.aperture * apertureScale },
      },
      side: THREE.DoubleSide,
      ...additive,
    });
  }

  private makePoints(p: PointBuffer, order: number, apertureScale: number) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(p.pos, 3));
    geom.setAttribute("color", new THREE.Float32BufferAttribute(p.col, 3));
    geom.setAttribute("size", new THREE.Float32BufferAttribute(p.size, 1));
    geom.setAttribute("alpha", new THREE.Float32BufferAttribute(p.alpha, 1));
    geom.setAttribute("kind", new THREE.Float32BufferAttribute(p.kind, 1));
    geom.setAttribute("phase", new THREE.Float32BufferAttribute(p.phase, 1));
    geom.setAttribute("axis", new THREE.Float32BufferAttribute(p.axis, 3));
    const mat = this.pointMaterial(this.preset.gain.points, apertureScale);
    const pts = new THREE.Points(geom, mat);
    pts.frustumCulled = false;
    pts.renderOrder = order;
    this.track(geom, mat);
    return pts;
  }

  private makeLines(l: LineBuffer, width: number, order: number, apertureScale: number) {
    const geom = new THREE.InstancedBufferGeometry();
    geom.setAttribute("corner", new THREE.Float32BufferAttribute([0, -1, 0, 1, 1, -1, 1, 1], 2));
    geom.setIndex([0, 1, 2, 2, 1, 3]);
    geom.setAttribute("iStart", new THREE.InstancedBufferAttribute(new Float32Array(l.start), 3));
    geom.setAttribute("iEnd", new THREE.InstancedBufferAttribute(new Float32Array(l.end), 3));
    geom.setAttribute("iColor", new THREE.InstancedBufferAttribute(new Float32Array(l.col), 4));
    geom.instanceCount = l.count;
    const mat = this.lineMaterial(width, this.preset.gain.lines, apertureScale);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    this.track(geom, mat);
    return mesh;
  }

  private addLayer(layer: LayerSet, parent: THREE.Object3D, order: number, apertureScale = 1) {
    if (layer.facets.pos.length) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(layer.facets.pos, 3));
      geom.setAttribute("rgba", new THREE.Float32BufferAttribute(layer.facets.rgba, 4));
      const mat = new THREE.ShaderMaterial({
        vertexShader: facetVertex,
        fragmentShader: facetFragment,
        uniforms: { ...this.shared, uGain: { value: this.preset.gain.facets } },
        side: THREE.DoubleSide,
        ...additive,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      parent.add(mesh);
      this.track(geom, mat);
    }
    const width =
      parent === this.scene ? this.preset.field.lineWidth : this.preset.helix.plexus.width;
    if (layer.lines.count) parent.add(this.makeLines(layer.lines, width, order + 1, apertureScale));
    layer.bars.forEach((b, i) => {
      if (b.lines.count) parent.add(this.makeLines(b.lines, b.width, order + 2 + i, apertureScale));
    });
    if (layer.points.count) parent.add(this.makePoints(layer.points, order + 10, apertureScale));
  }

  render(t: number) {
    const rig = this.preset.rig(t, this.duration);
    this.shared.uTime.value = t;
    this.shared.uFocus.value = rig.focus;
    this.bgUniforms.uTime.value = t;

    this.helix.position.set(...rig.helixPos);
    this.helix.rotation.order = "ZXY";
    this.helix.rotation.set(rig.helixTilt[0], rig.helixSpin, rig.helixTilt[1]);
    this.helix.updateMatrixWorld(true);

    const cam = this.camera;
    cam.fov = rig.fov;
    cam.aspect = this.width / this.height;
    cam.updateProjectionMatrix();
    cam.position.set(...rig.camPos);
    cam.up.set(0, 1, 0);
    cam.lookAt(new THREE.Vector3(...rig.target));
    cam.rotateZ(rig.roll);
    cam.updateMatrixWorld(true);

    // Glow billboards: follow the helix axis (not its spin) and face camera.
    if (this.glowUniforms && this.preset.glow) {
      this.glowUniforms.uIntensity.value = this.preset.glow.intensity * (rig.glow ?? 1);
    }
    if (this.glows.length) {
      const axisOnly = new THREE.Object3D();
      axisOnly.position.copy(this.helix.position);
      axisOnly.rotation.order = "ZXY";
      axisOnly.rotation.set(rig.helixTilt[0], 0, rig.helixTilt[1]);
      axisOnly.updateMatrixWorld(true);
      for (const g of this.glows) {
        g.mesh.position.copy(g.local).applyMatrix4(axisOnly.matrixWorld);
        g.mesh.quaternion.copy(cam.quaternion);
      }
    }

    if (this.blobGeom && this.preset.blobs) {
      const pos = this.blobGeom.getAttribute("position") as THREE.BufferAttribute;
      const alpha = this.blobGeom.getAttribute("alpha") as THREE.BufferAttribute;
      this.preset.blobs.forEach((b, i) => {
        const u = Math.min(1, Math.max(0, (t - b.t0) / (b.t1 - b.t0)));
        const s = u * u * (3 - 2 * u);
        pos.setXYZ(
          i,
          b.from[0] + (b.to[0] - b.from[0]) * s,
          b.from[1] + (b.to[1] - b.from[1]) * s,
          b.from[2] + (b.to[2] - b.from[2]) * s,
        );
        const fade = Math.sin(Math.PI * u);
        alpha.setX(i, b.alpha * (u > 0 && u < 1 ? Math.pow(fade, 0.6) : 0));
      });
      pos.needsUpdate = true;
      alpha.needsUpdate = true;
    }

    this.renderer.render(this.scene, cam);
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
  }
}
