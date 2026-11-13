import * as THREE from "three";
import type { SceneFactory } from "../lib/GLCanvas";
import { PostFX } from "../lib/postfx";
import { clamp, smoothstep, spline } from "../lib/random";
import { Ribbon, makeDot } from "../lib/ribbon";
import {
  CANDLES,
  LINE_A,
  LINE_B,
  MARKERS_A,
  MARKERS_B,
  curveA,
  curveB,
  markerLabel,
} from "./data";
import type { Palette } from "./palette";
import {
  FLOOR_BLIPS,
  FLOOR_COLS,
  FLOOR_H,
  FLOOR_ROWS,
  FLOOR_W,
  LOWER_H,
  LOWER_W,
  SIDE_H,
  SIDE_W,
  UPPER_H,
  UPPER_W,
  VAL_MAX,
  curveProgress,
  drawFarPanel,
  drawFloor,
  drawGlowBar,
  drawLabel,
  drawLeftPanel,
  drawLowerStatic,
  drawRightPanel,
  drawUpperStatic,
  lx,
  ly,
  makeCanvas,
  reflX,
  reflY,
  ux,
  uy,
} from "./textures";

const DEG = Math.PI / 180;

/**
 * Camera path matching the reference: starts close and strongly rolled on
 * the left of the dashboard, sweeps through a near-frontal view around 9-11s,
 * then continues to the right side with the opposite roll.
 */
export const cameraAt = (t: number) => {
  const yaw = spline(
    [
      [0, -42],
      [3, -35],
      [6, -21],
      [9, -7],
      [12, 5],
      [16, 19],
      [20, 29],
    ],
    t,
  );
  const pitch = spline(
    [
      [0, 9],
      [5, 13],
      [10, 15],
      [20, 13],
    ],
    t,
  );
  const dist = spline(
    [
      [0, 10.5],
      [4, 13.8],
      [9, 17.2],
      [14, 17.6],
      [20, 16.8],
    ],
    t,
  );
  const roll = spline(
    [
      [0, -24],
      [3, -20],
      [6, -11],
      [9, -3],
      [12, 2],
      [16, 8],
      [20, 12],
    ],
    t,
  );
  const tx = spline(
    [
      [0, -3.2],
      [6, -1.3],
      [10, 0],
      [20, 1.4],
    ],
    t,
  );
  const ty = spline(
    [
      [0, 1.2],
      [10, 0.05],
      [20, 0.1],
    ],
    t,
  );
  return {
    yaw: yaw * DEG,
    pitch: pitch * DEG,
    dist,
    roll: roll * DEG,
    target: new THREE.Vector3(tx, ty, 0),
  };
};

export const makeDashboardFactory =
  (palette: Palette): SceneFactory =>
  ({ renderer, width, height, fps }) => {
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(d: T) => {
      disposables.push(d);
      return d;
    };

    const canvasTexture = (canvas: HTMLCanvasElement) => {
      const tex = track(new THREE.CanvasTexture(canvas));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      return tex;
    };
    const staticLayer = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
      const { canvas, ctx } = makeCanvas(w, h);
      draw(ctx);
      return canvasTexture(canvas);
    };
    // alphaTest > 0: only visible pixels write depth (floating UI);
    // alphaTest = 0: the whole glass slab writes depth (main chart panels),
    // so thin lines drawn on it get the slab's depth for depth of field.
    const additive = (tex: THREE.Texture, boost = 1, alphaTest = 0.02) => {
      const m = track(
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: true,
          alphaTest,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      m.color.setScalar(boost);
      return m;
    };
    const plane = (w: number, h: number) => track(new THREE.PlaneGeometry(w, h));
    const hdr = (css: string, k: number) => new THREE.Color(css).multiplyScalar(k);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.background);
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 120);

    // --- far background panels (dim, out of focus) ---
    for (const [i, x] of [-21, 20].entries()) {
      const tex = staticLayer(1024, 512, (ctx) => drawFarPanel(ctx, palette, 900 + i));
      const mesh = new THREE.Mesh(plane(16, 8), additive(tex, 0.14));
      mesh.position.set(x, 3 - i, -14);
      mesh.rotation.y = x < 0 ? 0.35 : -0.35;
      mesh.renderOrder = 0;
      scene.add(mesh);
    }

    // --- foreground deck grid + flickering blips ---
    const floorTex = staticLayer(FLOOR_W, FLOOR_H, (ctx) => drawFloor(ctx, palette));
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.repeat.set(2, 1);
    const floorMat = track(
      new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: true, toneMapped: false }),
    );
    const FLOOR_SIZE_X = 46;
    const FLOOR_SIZE_Z = 14;
    const FLOOR_Y = -3.4;
    const FLOOR_Z = 12.5;
    const floorMesh = new THREE.Mesh(plane(FLOOR_SIZE_X, FLOOR_SIZE_Z), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, FLOOR_Y, FLOOR_Z);
    floorMesh.renderOrder = -1;
    scene.add(floorMesh);
    const cellW = FLOOR_SIZE_X / (FLOOR_COLS * 2);
    const cellH = FLOOR_SIZE_Z / FLOOR_ROWS;
    const blipGeo = plane(cellW * 0.64, cellH * 0.24);
    blipGeo.rotateX(-Math.PI / 2);
    const blipMat = track(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const blipCount = FLOOR_BLIPS.length * 2;
    const blips = new THREE.InstancedMesh(blipGeo, blipMat, blipCount);
    const m4 = new THREE.Matrix4();
    FLOOR_BLIPS.forEach((b, idx) => {
      for (let k = 0; k < 2; k++) {
        const x = -FLOOR_SIZE_X / 2 + (k * FLOOR_COLS + b.i + 0.5) * cellW;
        const localY = FLOOR_SIZE_Z / 2 - (b.j + 0.5) * cellH;
        m4.makeTranslation(x, FLOOR_Y + 0.01, FLOOR_Z - localY);
        blips.setMatrixAt(idx * 2 + k, m4);
        blips.setColorAt(idx * 2 + k, new THREE.Color(0, 0, 0));
      }
    });
    blips.renderOrder = -0.5;
    scene.add(blips);
    const blipColor = new THREE.Color(palette.floorBlip);
    const tmpColor = new THREE.Color();

    // --- side panels (static UI) ---
    const leftTex = staticLayer(SIDE_W, SIDE_H, (ctx) => drawLeftPanel(ctx, palette, 0));
    const leftMesh = new THREE.Mesh(plane(4.2, 8.4), additive(leftTex, 0.8));
    leftMesh.position.set(-11.2, 0.4, 0.8);
    leftMesh.rotation.y = 0.62;
    leftMesh.renderOrder = 1;
    scene.add(leftMesh);
    const rightTex = staticLayer(SIDE_W, SIDE_H, (ctx) => drawRightPanel(ctx, palette, 0));
    const rightMesh = new THREE.Mesh(plane(4.2, 8.4), additive(rightTex, 0.8));
    rightMesh.position.set(11.0, 0.9, 0.2);
    rightMesh.rotation.y = -0.62;
    rightMesh.renderOrder = 1;
    scene.add(rightMesh);

    // --- upper "Revenue Growth" panel ---
    const upperW = 16;
    const upperH = (16 * UPPER_H) / UPPER_W;
    const toU = (px: number, py: number): [number, number] => [
      (px / UPPER_W - 0.5) * upperW,
      (0.5 - py / UPPER_H) * upperH,
    ];
    const upperGroup = new THREE.Group();
    upperGroup.position.set(0, 3.4, -1.4);
    upperGroup.rotation.x = -0.12;
    scene.add(upperGroup);
    const upperTex = staticLayer(UPPER_W, UPPER_H, (ctx) => drawUpperStatic(ctx, palette));
    const us = new THREE.Mesh(plane(upperW, upperH), additive(upperTex, 0.85, 0));
    us.renderOrder = 2;
    upperGroup.add(us);

    const CURVE_SAMPLES = 520;
    const curvePts = (fn: (x: number) => number) =>
      Array.from({ length: CURVE_SAMPLES }, (_, i) => {
        const x = i / (CURVE_SAMPLES - 1);
        return toU(ux(x), uy(fn(x)));
      });
    const ribbons: Ribbon[] = [];
    const ribbon = (...args: ConstructorParameters<typeof Ribbon>) => {
      const r = new Ribbon(...args);
      ribbons.push(r);
      return r;
    };
    const curveDefs = [
      { fn: curveA, color: palette.curveA, markers: MARKERS_A, seed: 100, key: "a" as const },
      { fn: curveB, color: palette.curveB, markers: MARKERS_B, seed: 200, key: "b" as const },
    ];
    const dots: Array<{ material: THREE.ShaderMaterial; geometry: THREE.BufferGeometry }> = [];
    const curveObjs = curveDefs.map((c) => {
      const rb = ribbon(curvePts(c.fn), {
        halfWidth: 0.07,
        core: 0.2,
        glow: 0.45,
        color: hdr(c.color, 1.5),
        whiteCore: 0.15,
        z: 0.03,
      });
      rb.mesh.renderOrder = 2.5;
      upperGroup.add(rb.mesh);
      const markers = c.markers.map((mx, i) => {
        const [x, y] = toU(ux(mx), uy(c.fn(mx)));
        const d = makeDot(0.16, new THREE.Color(1.6, 1.6, 1.6), "diamond");
        dots.push(d);
        d.mesh.position.set(x, y, 0.04);
        d.mesh.renderOrder = 2.6;
        upperGroup.add(d.mesh);
        const labelTex = canvasTexture(drawLabel(markerLabel(c.seed + i), palette.text));
        const lm = track(
          new THREE.MeshBasicMaterial({
            map: labelTex,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        const lw = (512 / UPPER_W) * upperW;
        const lh = (64 / UPPER_H) * upperH;
        const label = new THREE.Mesh(plane(lw, lh), lm);
        const [lx0, ly0] = toU(ux(mx) - 150 + 256 - 8, uy(c.fn(mx)) - 34 - 2);
        label.position.set(lx0, ly0, 0.04);
        label.renderOrder = 2.6;
        upperGroup.add(label);
        return { mx, dot: d, label, labelMat: lm };
      });
      return { ...c, rb, markers };
    });

    // --- lower candlestick panel (tilted back like a desk display) ---
    const lowerW = 15;
    const lowerH = (15 * LOWER_H) / LOWER_W;
    const toL = (px: number, py: number): [number, number] => [
      (px / LOWER_W - 0.5) * lowerW,
      (0.5 - py / LOWER_H) * lowerH,
    ];
    const lowerGroup = new THREE.Group();
    lowerGroup.position.set(0, -1.2, 2.2);
    lowerGroup.rotation.x = -1.2;
    scene.add(lowerGroup);
    const lowerTex = staticLayer(LOWER_W, LOWER_H, (ctx) => drawLowerStatic(ctx, palette));
    const ls = new THREE.Mesh(plane(lowerW, lowerH), additive(lowerTex, 1.0, 0));
    ls.renderOrder = 3;
    lowerGroup.add(ls);

    // glossy reflections of the revenue curves
    const reflections = curveDefs.map((c) => {
      const pts = Array.from({ length: 260 }, (_, i) => {
        const x = i / 259;
        return toL(reflX(x), reflY(VAL_MAX - c.fn(x)));
      });
      const rb = ribbon(pts, {
        halfWidth: 0.05,
        core: 0.35,
        glow: 0.6,
        color: hdr(c.color, 0.14),
        whiteCore: 0,
        z: 0.02,
      });
      rb.mesh.renderOrder = 3.2;
      lowerGroup.add(rb.mesh);
      return { key: c.key, rb };
    });

    // overlay lines
    const lineAPts = LINE_A.map(([x, v]) => toL(lx(x), ly(v)));
    const lineA = ribbon(lineAPts, {
      halfWidth: 0.06,
      core: 0.22,
      glow: 0.45,
      color: hdr(palette.lineA, 1.5),
      whiteCore: 0.1,
      z: 0.035,
    });
    lineA.mesh.renderOrder = 3.5;
    lowerGroup.add(lineA.mesh);
    const lineADots = LINE_A.map((_, i) => i)
      .filter((i) => i % 4 === 0)
      .map((i) => {
        const d = makeDot(0.085, new THREE.Color(1.5, 1.5, 1.5));
        dots.push(d);
        const [x, y] = lineAPts[i];
        d.mesh.position.set(x, y, 0.04);
        d.mesh.renderOrder = 3.6;
        lowerGroup.add(d.mesh);
        return { i, d };
      });
    const lineB = ribbon(
      LINE_B.map(([x, v]) => toL(lx(x), ly(v))),
      {
        halfWidth: 0.06,
        core: 0.22,
        glow: 0.45,
        color: hdr(palette.lineB, 1.5),
        whiteCore: 0.1,
        z: 0.035,
      },
    );
    lineB.mesh.renderOrder = 3.5;
    lowerGroup.add(lineB.mesh);

    // travelling shimmer band across the candles
    const shimmerTex = staticLayer(256, 8, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 256, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,1)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 8);
    });
    const shimmerMat = track(
      new THREE.MeshBasicMaterial({
        map: shimmerTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    shimmerMat.color.set(palette.candleGlow).multiplyScalar(0.05);
    const chartW = ((lx(1) - lx(0)) / LOWER_W) * lowerW;
    const chartH = ((ly(0) - ly(1)) / LOWER_H) * lowerH;
    const shimmer = new THREE.Mesh(plane(chartW * 0.16, chartH), shimmerMat);
    shimmer.renderOrder = 3.4;
    lowerGroup.add(shimmer);

    // blinking "live" tick on the latest candle
    const tick = makeDot(0.1, new THREE.Color(1.4, 1.4, 1.4));
    dots.push(tick);
    {
      const lc = CANDLES[CANDLES.length - 1];
      const [x, y] = toL(lx(1) - 10, ly(lc.c));
      tick.mesh.position.set(x, y, 0.04);
      tick.mesh.renderOrder = 3.6;
      lowerGroup.add(tick.mesh);
    }

    // --- foreground light bar ---
    const barTex = staticLayer(1024, 64, (ctx) => drawGlowBar(ctx));
    const barMat = track(
      new THREE.MeshBasicMaterial({
        map: barTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    );
    const barColor = new THREE.Color(palette.glowBar);
    const barMesh = new THREE.Mesh(plane(21, 0.14), barMat);
    barMesh.position.set(0, -2.8, 6.0);
    barMesh.rotation.x = -0.5;
    barMesh.renderOrder = 5;
    scene.add(barMesh);

    const post = new PostFX(renderer, width, height);
    const lift = new THREE.Color().setRGB(...palette.lift);
    const white = new THREE.Color(1, 1, 1);

    return {
      render: (frame) => {
        const t = frame / fps;

        // revenue curves + markers
        const prog = curveProgress(t);
        for (const c of curveObjs) {
          const pr = prog[c.key];
          c.rb.setProgress(pr);
          for (const m of c.markers) {
            const a = smoothstep(m.mx, m.mx + 0.02, pr);
            m.dot.material.uniforms.opacity.value = a;
            m.dot.mesh.visible = a > 0;
            m.label.visible = a > 0;
            m.labelMat.opacity = a * 0.75;
          }
        }
        for (const r of reflections) r.rb.setProgress(prog[r.key]);

        const pA = smoothstep(2.0, 14.2, t) * 0.6 + clamp((t - 2) / 12.2, 0, 1) * 0.4;
        lineA.setProgress(pA);
        const fiA = pA * (LINE_A.length - 1);
        for (const { i, d } of lineADots) {
          const a = pA > 0 ? clamp(fiA - i + 1, 0, 1) : 0;
          d.material.uniforms.opacity.value = a;
          d.mesh.visible = a > 0;
        }
        lineB.setProgress(clamp((t - 13.6) / 6.0, 0, 1));

        const sx = ((t * 0.11) % 1.4) - 0.2;
        const [shx, shy] = toL(lx(sx), (ly(0) + ly(1)) / 2);
        shimmer.position.set(shx, shy, 0.025);

        tick.material.uniforms.opacity.value = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(frame * 0.35));

        FLOOR_BLIPS.forEach((b, idx) => {
          const on = Math.sin((frame + b.phase) * 0.12) > 0.2 ? 1 : 0.25;
          tmpColor.copy(blipColor).multiplyScalar(on * 0.9);
          blips.setColorAt(idx * 2, tmpColor);
          blips.setColorAt(idx * 2 + 1, tmpColor);
        });
        if (blips.instanceColor) blips.instanceColor.needsUpdate = true;

        const pulse = 1 + 0.08 * Math.sin(t * 2.1) + 0.04 * Math.sin(t * 5.3);
        barMat.color.copy(barColor).multiplyScalar(4.0 * pulse);

        const cam = cameraAt(t);
        const cp = Math.cos(cam.pitch);
        camera.position.set(
          cam.target.x + cam.dist * Math.sin(cam.yaw) * cp,
          cam.target.y + cam.dist * Math.sin(cam.pitch),
          cam.target.z + cam.dist * Math.cos(cam.yaw) * cp,
        );
        camera.up.set(0, 1, 0);
        camera.lookAt(cam.target);
        camera.rotateZ(cam.roll);
        camera.updateMatrixWorld();

        post.render(scene, camera, {
          focusDistance: cam.dist,
          focusRange: 2.2,
          blurRangeNear: 4.5,
          blurRangeFar: 9,
          maxBlur: 0.02,
          bloomStrength: 0.22,
          bloomThreshold: 0.75,
          bloomKnee: 0.4,
          streakStrength: 0,
          streakThreshold: 1,
          streakTint: white,
          exposure: 1.0,
          contrast: 1.04,
          saturation: 1.12,
          lift,
          vignette: 0.5,
          grain: 0.022,
          aberration: 0.0014,
          seed: (frame * 0.618) % 1,
        });
      },
      dispose: () => {
        post.dispose();
        ribbons.forEach((r) => r.dispose());
        dots.forEach((d) => {
          d.material.dispose();
          d.geometry.dispose();
        });
        blips.dispose();
        disposables.forEach((d) => d.dispose());
      },
    };
  };
