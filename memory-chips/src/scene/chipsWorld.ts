import * as THREE from "three";
import { MODULE, PACKAGES, PALETTE, type PackageKind } from "../config";
import { LIGHT, SURFACE } from "../look";
import type { World } from "../three/Stage";
import { buildChipTexture, buildPcbTexture, chipCentreY } from "./pcbTexture";

const deg = THREE.MathUtils.degToRad;

/** module coordinates (x across, y along, height) -> world (x right, y up, z towards the camera) */
const P = (x: number, y: number, h: number) => new THREE.Vector3(x, h, -y);

/** A box with chamfered top and bottom edges, sitting on y = 0. UVs span the top face. */
const chamferBox = (w: number, d: number, h: number, bevel: number) => {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + bevel, -d / 2 + bevel);
  s.lineTo(w / 2 - bevel, -d / 2 + bevel);
  s.lineTo(w / 2 - bevel, d / 2 - bevel);
  s.lineTo(-w / 2 + bevel, d / 2 - bevel);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: h - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    steps: 1,
  });
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / d + 0.5);
  }
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  g.computeVertexNormals();
  return g;
};

/** A bent metal lead: a thick polyline (side profile) extruded to the lead's width. Extends along +x. */
const leadGeometry = (pts: [number, number][], thickness: number, width: number) => {
  const left: THREE.Vector2[] = [];
  const right: THREE.Vector2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * (thickness / 2);
    const ny = (dx / l) * (thickness / 2);
    left.push(new THREE.Vector2(pts[i][0] + nx, pts[i][1] + ny));
    right.push(new THREE.Vector2(pts[i][0] - nx, pts[i][1] - ny));
  }
  const shape = new THREE.Shape([...left, ...right.reverse()]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, steps: 1 });
  g.translate(0, 0, -width / 2);
  g.computeVertexNormals();
  return g;
};

type Mats = {
  plastic: THREE.MeshStandardMaterial;
  lead: THREE.MeshStandardMaterial;
};

/** One loose component: body plus leads, centred on the origin, standing on y = 0. */
const buildPackage = (
  kind: PackageKind,
  size: [number, number, number],
  leadsPerSide: number,
  mats: Mats,
) => {
  const [w, d, h] = size;
  const group = new THREE.Group();
  const standoff = kind === "plcc" ? 0.5 : kind === "dip" ? 1.2 : 1.1;
  const body = new THREE.Mesh(chamferBox(w, d, h, kind === "soic" ? 0.5 : 0.35), mats.plastic);
  body.position.y = standoff;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const mid = standoff + h * 0.5;
  let geo: THREE.BufferGeometry;
  let sides: number[];
  let run: number;
  if (kind === "plcc") {
    // J-leads: short tabs hugging the side faces
    geo = new THREE.BoxGeometry(0.5, h * 0.62, 1.5);
    geo.translate(0.16, standoff * 0.4 + h * 0.31, 0);
    sides = [0, 1, 2, 3];
    run = w - 7;
  } else if (kind === "qfp") {
    geo = leadGeometry(
      [
        [-0.2, mid + 0.4],
        [1.4, mid + 0.4],
        [6.2, 0.55],
        [8.0, 0.3],
      ],
      0.45,
      0.95,
    );
    sides = [0, 1, 2, 3];
    run = w - 7;
  } else if (kind === "soic") {
    geo = leadGeometry(
      [
        [-0.2, mid],
        [1.2, mid],
        [2.3, 0.5],
        [3.8, 0.32],
      ],
      0.5,
      1.7,
    );
    sides = [0, 2];
    run = d - 5.5;
  } else {
    // DIP: shoulder out, then a long leg down
    geo = leadGeometry(
      [
        [-0.2, mid + 0.4],
        [0.8, mid + 0.4],
        [1.3, mid - 0.5],
        [1.6, 0.28],
        [2.0, 0.24],
      ],
      0.45,
      1.3,
    );
    sides = [0, 2];
    run = d - 6.5;
  }
  const leads = new THREE.InstancedMesh(geo, mats.lead, sides.length * leadsPerSide);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  let i = 0;
  for (const side of sides) {
    // side 0: +x, 1: +z (towards camera), 2: -x, 3: -z
    const angle = [0, -Math.PI / 2, Math.PI, Math.PI / 2][side];
    q.setFromAxisAngle(yAxis, angle);
    const half = side % 2 === 0 ? w / 2 : d / 2;
    const span = side % 2 === 0 ? (kind === "qfp" || kind === "plcc" ? d - 7 : run) : run;
    for (let k = 0; k < leadsPerSide; k++) {
      const t = leadsPerSide === 1 ? 0 : (k / (leadsPerSide - 1) - 0.5) * span;
      const pos =
        side === 0
          ? new THREE.Vector3(half, 0, t)
          : side === 2
            ? new THREE.Vector3(-half, 0, t)
            : side === 1
              ? new THREE.Vector3(t, 0, half)
              : new THREE.Vector3(t, 0, -half);
      m.compose(pos, q, new THREE.Vector3(1, 1, 1));
      leads.setMatrixAt(i++, m);
    }
  }
  leads.instanceMatrix.needsUpdate = true;
  leads.castShadow = true;
  leads.receiveShadow = true;
  leads.frustumCulled = false;
  group.add(leads);
  return group;
};

/**
 * Contact shadow decal: fully dark under the part's footprint, fading to nothing
 * over `margin` outside it. `inner` is the footprint as a fraction of the quad.
 */
const contactMaterial = (inner: THREE.Vector2, opacity: number) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uInner: { value: inner }, uOpacity: { value: opacity } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec2 uInner; uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec2 p = abs(vUv - 0.5) * 2.0;
        vec2 d = max(p - uInner, 0.0) / max(1.0 - uInner, vec2(1e-4));
        float t = clamp(length(d), 0.0, 1.0);
        float a = pow(1.0 - t * t * (3.0 - 2.0 * t), 2.2);
        gl_FragColor = vec4(0.0, 0.0, 0.0, a * uOpacity);
      }`,
  });

/** Studio surroundings used only for image-based light: one big softbox, dark elsewhere. */
const buildEnvScene = (boxDir: THREE.Vector3) => {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uBoxDir: { value: boxDir.clone().normalize() },
      uBox: { value: new THREE.Color(LIGHT.key.color).multiplyScalar(LIGHT.env.softbox) },
      uAmbient: { value: new THREE.Color("#9fb4c8").multiplyScalar(LIGHT.env.ambient) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBoxDir; uniform vec3 uBox; uniform vec3 uAmbient;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float c = max(dot(d, uBoxDir), 0.0);
        // softbox: bright core with a wide skirt; the room falls to near black opposite it
        float box = smoothstep(0.82, 0.95, c) + 0.22 * pow(c, 3.0);
        float room = 0.25 + 0.75 * smoothstep(-0.6, 0.7, dot(d, normalize(uBoxDir + vec3(0.0, 0.6, 0.0))));
        gl_FragColor = vec4(uBox * box + uAmbient * room, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), mat));
  return { scene, dispose: () => mat.dispose() };
};

export const buildChipsWorld = (): World => {
  const root = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(o: T) => {
    disposables.push(o);
    return o;
  };

  // ---- materials ------------------------------------------------------------------
  const plastic = keep(
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.chipBody,
      roughness: SURFACE.packageRoughness,
      metalness: 0,
      ior: SURFACE.packageIor,
    }),
  );
  const chipTex = keep(buildChipTexture());
  const chipMat = keep(
    new THREE.MeshPhysicalMaterial({
      map: chipTex,
      roughness: SURFACE.chipRoughness,
      metalness: 0,
      ior: SURFACE.chipIor,
    }),
  );
  const lead = keep(
    new THREE.MeshStandardMaterial({ color: PALETTE.lead, roughness: SURFACE.leadRoughness, metalness: 1 }),
  );
  const gold = keep(
    new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: SURFACE.goldRoughness, metalness: 1 }),
  );
  const smdMat = keep(new THREE.MeshStandardMaterial({ color: PALETTE.smd, roughness: 0.6, metalness: 0 }));
  const tableMat = keep(
    new THREE.MeshStandardMaterial({ color: PALETTE.table, roughness: SURFACE.tableRoughness, metalness: 0 }),
  );
  const pcbTex = keep(buildPcbTexture());
  const pcbTop = keep(new THREE.MeshStandardMaterial({ map: pcbTex, roughness: SURFACE.pcbRoughness, metalness: 0 }));
  const pcbSide = keep(new THREE.MeshStandardMaterial({ color: PALETTE.pcbEdge, roughness: 0.7, metalness: 0 }));

  // ---- table ----------------------------------------------------------------------
  const table = new THREE.Mesh(keep(new THREE.PlaneGeometry(6000, 6000)), tableMat);
  table.rotation.x = -Math.PI / 2;
  table.position.set(0, 0, -MODULE.length / 2);
  table.receiveShadow = true;
  root.add(table);

  // ---- contact shadows: the fill light is not shadowed, so the darkness right under
  // each part is painted in as a soft decal lying on the table --------------------------
  const contactGeo = keep(new THREE.PlaneGeometry(1, 1));
  const addContact = (x: number, y: number, w: number, d: number, rotDeg: number, margin: number) => {
    const mat = keep(
      contactMaterial(new THREE.Vector2(w / (w + margin * 2), d / (d + margin * 2)), LIGHT.contactShadow),
    );
    const mesh = new THREE.Mesh(contactGeo, mat);
    mesh.rotation.order = "YXZ";
    mesh.rotation.set(-Math.PI / 2, deg(rotDeg), 0);
    mesh.scale.set(w + margin * 2, d + margin * 2, 1);
    // the light comes from behind and the right: slide the patch towards the shadow side
    mesh.position.copy(P(x - margin * 0.35, y - margin * 0.35, 0.03));
    mesh.renderOrder = 1;
    root.add(mesh);
  };
  addContact(0, MODULE.length / 2, MODULE.width, MODULE.length, 0, 3);
  for (const pk of PACKAGES) addContact(pk.x, pk.y, pk.size[0], pk.size[1], pk.rotDeg, pk.kind === "plcc" ? 4.5 : 5);

  // ---- circuit board: outline with end notches, keying slot and two holes ------------
  const W = MODULE.width;
  const L = MODULE.length;
  const hw = W / 2;
  const [slotLen, slotDepth] = MODULE.keySlotSize;
  const outline = new THREE.Shape();
  const notch = (x0: number, x1: number, y: number, depth: number) => {
    outline.lineTo(x0, y);
    outline.lineTo(x0, y + depth);
    outline.lineTo(x1, y + depth);
    outline.lineTo(x1, y);
  };
  outline.moveTo(-hw, 0);
  notch(-5.6, -1.8, 0, 2.3);
  notch(2.4, 6.2, 0, 2.3);
  outline.lineTo(hw, 0);
  outline.lineTo(hw, MODULE.keySlotY - slotLen / 2);
  outline.lineTo(hw - slotDepth, MODULE.keySlotY - slotLen / 2);
  outline.lineTo(hw - slotDepth, MODULE.keySlotY + slotLen / 2);
  outline.lineTo(hw, MODULE.keySlotY + slotLen / 2);
  outline.lineTo(hw, L);
  notch(6.2, 2.4, L, -2.3);
  notch(-1.8, -5.6, L, -2.3);
  outline.lineTo(-hw, L);
  outline.closePath();
  for (const hy of [3.4, L - 3.4]) {
    const hole = new THREE.Path();
    hole.absarc(hw - 3.6, hy, 1.45, 0, Math.PI * 2, true);
    outline.holes.push(hole);
  }
  const pcbGeo = keep(new THREE.ExtrudeGeometry(outline, { depth: MODULE.thickness, bevelEnabled: false, curveSegments: 24 }));
  {
    const pos = pcbGeo.attributes.position;
    const uv = pcbGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + hw) / W, pos.getY(i) / L);
    pcbGeo.rotateX(-Math.PI / 2);
    pcbGeo.computeVertexNormals();
  }
  const pcb = new THREE.Mesh(pcbGeo, [pcbTop, pcbSide]);
  pcb.castShadow = true;
  pcb.receiveShadow = true;
  root.add(pcb);
  const top = MODULE.thickness;

  // ---- memory chips and their pins ---------------------------------------------------
  const [cw, cd, ch] = MODULE.chipSize;
  const chipGeo = keep(chamferBox(cw, cd, ch, 0.22));
  const chips = new THREE.InstancedMesh(chipGeo, chipMat, MODULE.chips);
  const m = new THREE.Matrix4();
  for (let k = 0; k < MODULE.chips; k++) {
    m.makeTranslation(MODULE.chipX, top, -chipCentreY(k));
    chips.setMatrixAt(k, m);
  }
  chips.castShadow = true;
  chips.receiveShadow = true;
  chips.frustumCulled = false;
  root.add(chips);

  const pinGeo = keep(new THREE.BoxGeometry(0.2, 0.3, 1.1));
  const pinMat = keep(new THREE.MeshStandardMaterial({ color: PALETTE.pin, roughness: 0.25, metalness: 1 }));
  const pins = new THREE.InstancedMesh(pinGeo, pinMat, MODULE.chips * MODULE.pinsPerSide * 2);
  const pinSpan = (MODULE.pinsPerSide - 1) * MODULE.pinPitch;
  let pi = 0;
  for (let k = 0; k < MODULE.chips; k++) {
    for (const side of [-1, 1]) {
      for (let p = 0; p < MODULE.pinsPerSide; p++) {
        m.makeTranslation(
          MODULE.chipX - pinSpan / 2 + p * MODULE.pinPitch,
          top + 0.17,
          -(chipCentreY(k) + side * (cd / 2 + 0.42)),
        );
        pins.setMatrixAt(pi++, m);
      }
    }
  }
  pins.castShadow = true;
  pins.receiveShadow = true;
  pins.frustumCulled = false;
  root.add(pins);

  // ---- gold edge fingers ---------------------------------------------------------------
  const fingerYs: number[] = [];
  for (let y = 2.6; y < L - 2.4; y += MODULE.fingerPitch) {
    if (Math.abs(y - MODULE.keySlotY) < slotLen / 2 + 0.75) continue;
    fingerYs.push(y);
  }
  const fingerGeo = keep(new THREE.BoxGeometry(MODULE.fingerLength, 0.07, MODULE.fingerPitch * 0.84));
  const fingers = new THREE.InstancedMesh(fingerGeo, gold, fingerYs.length);
  fingerYs.forEach((y, i) => {
    m.makeTranslation(hw - MODULE.fingerLength / 2 - 0.12, top + 0.035, -y);
    fingers.setMatrixAt(i, m);
  });
  fingers.receiveShadow = true;
  fingers.frustumCulled = false;
  root.add(fingers);

  // ---- column of small surface-mount parts beside the fingers ----------------------------
  const smdSpots: [number, number][] = [];
  for (let y = 3.2; y < L - 3.2; y += MODULE.smdPitch) {
    if (Math.abs(y - MODULE.keySlotY) < 3.0) continue;
    for (const x of MODULE.smdX) smdSpots.push([x, y]);
  }
  const [sw, sd, sh] = MODULE.smdSize;
  const smdGeo = keep(chamferBox(sw, sd, sh, 0.08));
  const smd = new THREE.InstancedMesh(smdGeo, smdMat, smdSpots.length);
  smdSpots.forEach(([x, y], i) => {
    m.makeTranslation(x, top, -y);
    smd.setMatrixAt(i, m);
  });
  smd.castShadow = true;
  smd.receiveShadow = true;
  smd.frustumCulled = false;
  root.add(smd);

  // ---- loose components on the table ------------------------------------------------------
  for (const pk of PACKAGES) {
    const g = buildPackage(pk.kind, pk.size, pk.leadsPerSide, { plastic, lead });
    g.position.copy(P(pk.x, pk.y, 0));
    g.rotation.y = deg(pk.rotDeg);
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) disposables.push(mesh.geometry);
    });
    root.add(g);
  }

  // ---- key light: a softbox sampled by a few spotlights -> wide, soft penumbrae -----------
  const [lx, ly, lh] = LIGHT.key.position;
  const [ax, ay, ah] = LIGHT.key.aimAt;
  const centre = P(lx, ly, lh);
  const aim = P(ax, ay, ah);
  const toAim = aim.clone().sub(centre).normalize();
  const tangent = new THREE.Vector3().crossVectors(toAim, new THREE.Vector3(0, 1, 0)).normalize();
  const bitangent = new THREE.Vector3().crossVectors(toAim, tangent).normalize();
  const dist = centre.distanceTo(aim);
  const n = LIGHT.key.samples;
  for (let i = 0; i < n; i++) {
    // The softbox is a long strip parallel to the board. Samples are spread along
    // it and each aims straight across, so the pool of light is a band that runs
    // the length of the module: the table falls off from right to left the same
    // way wherever the camera is. A small sideways stagger softens shadow edges.
    const along = (i + 0.5) / n - 0.5;
    const a = i * 2.39996323;
    const light = new THREE.SpotLight(LIGHT.key.color, LIGHT.key.intensity / n, 0, LIGHT.key.coneAngle, 1, 2);
    const shift = P(0, along * LIGHT.key.stripLength, 0);
    light.position
      .copy(centre)
      .add(shift)
      .addScaledVector(tangent, Math.cos(a) * LIGHT.key.halfSize * 0.5)
      .addScaledVector(bitangent, Math.sin(a) * LIGHT.key.halfSize * 0.5);
    // the far end of the band is skewed sideways, so the far table stays bright
    light.target.position.copy(aim).add(shift).add(P(along * LIGHT.key.stripLength * LIGHT.key.aimSkew, 0, 0));
    light.castShadow = true;
    light.shadow.mapSize.set(LIGHT.key.shadowMapSize, LIGHT.key.shadowMapSize);
    light.shadow.camera.near = dist * 0.55;
    light.shadow.camera.far = dist * 1.7;
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.12;
    light.shadow.radius = 4;
    root.add(light);
    root.add(light.target);
  }

  const env = buildEnvScene(P(LIGHT.env.softboxDir[0], LIGHT.env.softboxDir[1], LIGHT.env.softboxDir[2]));
  return {
    root,
    background: new THREE.Color("#000000"),
    fog: null,
    envScene: env.scene,
    envIntensity: LIGHT.env.intensity,
    dispose: () => {
      for (const d of disposables) d.dispose();
      env.dispose();
      chips.dispose();
      pins.dispose();
      fingers.dispose();
      smd.dispose();
    },
  };
};
