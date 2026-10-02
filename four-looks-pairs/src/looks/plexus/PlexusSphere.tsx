import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { GLStage, useFrameRender } from "../../lib/gl/GLStage";
import { GLSL_FINISH, PostPipeline } from "../../lib/gl/post";
import { easeInOutCubic, hexToRgb, smoothstep } from "../../lib/math";
import { LINKS, NODE_COUNT, NODES, nodeAppear, nodePosition } from "./nodes";
import type { PlexusVersion } from "./versions";

const CUBE_VERT = /* glsl */ `
attribute vec3 aColor;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  vColor = aColor;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const CUBE_FRAG = /* glsl */ `
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec3 n = normalize(vNormal);
  float key = max(dot(n, normalize(vec3(0.45, 0.75, 0.55))), 0.0);
  float fill = max(dot(n, normalize(vec3(-0.6, -0.2, 0.4))), 0.0);
  float rim = pow(1.0 - max(dot(n, vView), 0.0), 2.0);
  vec3 c = vColor * (0.42 + 0.62 * key + 0.18 * fill + 0.35 * rim);
  gl_FragColor = vec4(c, 1.0);
}
`;

// Links: one instanced quad per segment, width in screen pixels (scaled with resolution).
const LINK_VERT = /* glsl */ `
attribute vec3 aStart;
attribute vec3 aEnd;
attribute float aAlpha;
uniform vec2 uRes;
uniform float uWidth;
varying float vAlpha;
void main() {
  mat4 mvp = projectionMatrix * viewMatrix * modelMatrix;
  vec4 a = mvp * vec4(aStart, 1.0);
  vec4 b = mvp * vec4(aEnd, 1.0);
  vec4 p = mix(a, b, position.y);
  vec2 d = (b.xy / b.w - a.xy / a.w) * uRes;
  vec2 dir = length(d) > 1e-5 ? normalize(d) : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  p.xy += nrm * position.x * uWidth / uRes * p.w;
  vAlpha = aAlpha;
  gl_Position = p;
}
`;
const LINK_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() { gl_FragColor = vec4(uColor * vAlpha, vAlpha); }
`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform vec2 uRes;
uniform vec3 uBgCenter;
uniform vec3 uBgEdge;
uniform float uBloom;
uniform uint uFrame;
in vec2 vUv;
out vec4 outColor;
${GLSL_FINISH}
void main() {
  vec4 s = texture(tScene, vUv);
  vec3 bloom = texture(tBloom, vUv).rgb;
  vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec3 bg = mix(uBgCenter, uBgEdge, smoothstep(0.05, 1.0, length(p * vec2(0.8, 1.0))));
  vec3 c = bg * (1.0 - s.a) + s.rgb + bloom * uBloom;
  outColor = vec4(finish(c, gl_FragCoord.xy, uFrame, 0.049), 1.0);
}
`;

const LINK_COUNT = LINKS.length;

const Renderer: React.FC<{ version: PlexusVersion }> = ({ version }) => {
  const world = useMemo(() => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    group.rotation.x = 0.12;
    scene.add(group);
    const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 50);

    // Cubes
    const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
    const colors = new Float32Array(NODE_COUNT * 3);
    const palette = version.nodes.map((n) => ({ rgb: hexToRgb(n.color), w: n.weight }));
    const total = palette.reduce((s, p) => s + p.w, 0);
    NODES.forEach((n, i) => {
      let acc = 0;
      let rgb = palette[0].rgb;
      for (const p of palette) {
        acc += p.w / total;
        if (n.colorPick <= acc) {
          rgb = p.rgb;
          break;
        }
      }
      const k = n.bright ? 2.6 : 0.95;
      colors.set([rgb[0] * k, rgb[1] * k, rgb[2] * k], i * 3);
    });
    cubeGeo.setAttribute("aColor", new THREE.InstancedBufferAttribute(colors, 3));
    const cubes = new THREE.InstancedMesh(
      cubeGeo,
      new THREE.ShaderMaterial({ vertexShader: CUBE_VERT, fragmentShader: CUBE_FRAG }),
      NODE_COUNT,
    );
    cubes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    cubes.frustumCulled = false;
    group.add(cubes);

    // Links
    const linkGeo = new THREE.InstancedBufferGeometry();
    linkGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 0, 0, 1, 1, 0, -1, 1, 0], 3),
    );
    const aStart = new THREE.InstancedBufferAttribute(new Float32Array(LINK_COUNT * 3), 3);
    const aEnd = new THREE.InstancedBufferAttribute(new Float32Array(LINK_COUNT * 3), 3);
    const aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(LINK_COUNT), 1);
    [aStart, aEnd, aAlpha].forEach((a) => a.setUsage(THREE.DynamicDrawUsage));
    linkGeo.setAttribute("aStart", aStart);
    linkGeo.setAttribute("aEnd", aEnd);
    linkGeo.setAttribute("aAlpha", aAlpha);
    linkGeo.instanceCount = LINK_COUNT;
    const linkMat = new THREE.ShaderMaterial({
      vertexShader: LINK_VERT,
      fragmentShader: LINK_FRAG,
      uniforms: {
        uRes: { value: new THREE.Vector2(1920, 1080) },
        uWidth: { value: 1 },
        uColor: { value: new THREE.Vector3(...hexToRgb(version.link)) },
      },
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const links = new THREE.Mesh(linkGeo, linkMat);
    links.frustumCulled = false;
    links.renderOrder = 1;
    group.add(links);

    const post = new PostPipeline(COMPOSITE, {
      uBgCenter: { value: new THREE.Vector3(...hexToRgb(version.bgCenter)) },
      uBgEdge: { value: new THREE.Vector3(...hexToRgb(version.bgEdge)) },
      uBloom: { value: 0.9 },
      uFrame: { value: 0 },
    });
    return {
      scene, group, camera, cubes, links, linkMat, aStart, aEnd, aAlpha, post,
      pos: new Float32Array(NODE_COUNT * 3),
      appear: new Float32Array(NODE_COUNT),
      m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(),
      v: new THREE.Vector3(), s: new THREE.Vector3(),
    };
  }, [version]);

  useEffect(() => () => world.post.dispose(), [world]);

  useFrameRender((frame, gl) => {
    const w = world;
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    const res = size.y / 1080;

    w.group.rotation.y = 0.6 + frame * 0.0042;

    for (let i = 0; i < NODE_COUNT; i++) {
      const n = NODES[i];
      nodePosition(n, frame, w.pos, i * 3);
      const a = nodeAppear(n, frame);
      w.appear[i] = a;
      const sc = n.size * (a < 1 ? a * (1 + 0.6 * Math.sin(Math.PI * a)) : 1);
      w.e.set(n.rx + frame * n.spin, n.ry + frame * n.spin * 0.7, n.rz);
      w.q.setFromEuler(w.e);
      w.v.set(w.pos[i * 3], w.pos[i * 3 + 1], w.pos[i * 3 + 2]);
      w.s.set(sc, sc, sc);
      w.m.compose(w.v, w.q, w.s);
      w.cubes.setMatrixAt(i, w.m);
    }
    w.cubes.instanceMatrix.needsUpdate = true;

    const st = w.aStart.array as Float32Array;
    const en = w.aEnd.array as Float32Array;
    const al = w.aAlpha.array as Float32Array;
    const settle = smoothstep(200, 330, frame); // links may be long while still a column
    const maxLen = 0.9 + 0.3 * settle;
    for (let l = 0; l < LINK_COUNT; l++) {
      const [i, j] = LINKS[l];
      const ax = w.pos[i * 3], ay = w.pos[i * 3 + 1], az = w.pos[i * 3 + 2];
      const bx = w.pos[j * 3], by = w.pos[j * 3 + 1], bz = w.pos[j * 3 + 2];
      st[l * 3] = ax; st[l * 3 + 1] = ay; st[l * 3 + 2] = az;
      en[l * 3] = bx; en[l * 3 + 1] = by; en[l * 3 + 2] = bz;
      const len = Math.hypot(ax - bx, ay - by, az - bz);
      const lenFade = 1 - smoothstep(maxLen * 0.6, maxLen, len);
      al[l] = version.linkAlpha * Math.min(w.appear[i], w.appear[j]) * lenFade;
    }
    w.aStart.needsUpdate = true;
    w.aEnd.needsUpdate = true;
    w.aAlpha.needsUpdate = true;
    w.linkMat.uniforms.uRes.value.copy(size);
    w.linkMat.uniforms.uWidth.value = Math.max(0.8, 1.0 * res);

    // Camera: slow push-in from the column framing to the sphere framing.
    const t = easeInOutCubic(frame / 450);
    const dist = 6.9 - 1.6 * t;
    const sway = 0.12 * Math.sin(frame * 0.006);
    w.camera.aspect = size.x / size.y;
    w.camera.position.set(sway, 0.12 - 0.08 * t, dist);
    w.camera.lookAt(0, 0.12 - 0.14 * t, 0);
    w.camera.updateProjectionMatrix();

    w.post.composite.uniforms.uFrame.value = frame;
    w.post.render(gl, w.scene, w.camera, {
      near: 0.1,
      far: 50,
      focus: dist - 0.75,
      cocScale: 105,
      maxCoc: 12,
      bloomThreshold: 1.25,
      bloomKnee: 0.4,
    });
  });
  return null;
};

export const PlexusSphere: React.FC<{ version: PlexusVersion }> = ({ version }) => (
  <GLStage>
    <Renderer version={version} />
  </GLStage>
);
