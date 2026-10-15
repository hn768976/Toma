import * as THREE from "three";
import { buildAtlas } from "../lib/atlas";
import { ELEMENTS, tableXY } from "../lib/elements";
import { DEFAULT_POST } from "../lib/pipeline";
import type { LookFactory } from "../lib/Stage";
import { makeTileMaterial, makeTileMesh } from "../lib/tiles";

export type FlyoverParams = {
  plane: string; // tile / plane colour
  text: string; // numbers, symbol, mass, lines
  sub: string; // name, shells
  haze: string; // fog / top haze colour
  hazeMin: number; // haze already present right in front of the camera
  glow: number; // bloom strength
};

const ASPECT = 1.18; // tile height / width
const F_GAP = 0.55; // gap (tile heights) between period 7 and the f-block
const HEADING = -10; // degrees from -x towards -z
const UP_BLEND = 0.0;
const ROLL = 0; // degrees
// Angle between the line of sight and the table. The brief says ~25°; the
// reference reads closer to 45° (the grid fills the frame edge to edge).
const ELEVATION = 32;

// Closed glide path of the look-at point, in table tile units (x = column,
// y = row downwards). Out along the transition metals, round over the
// lanthanides/actinides, back to the start.
const PATH: [number, number][] = [
  [6.6, 4.6],
  [9.4, 4.2],
  [12.4, 4.6],
  [13.6, 6.0],
  [12.8, 8.0],
  [10.6, 8.9],
  [8.0, 8.9],
  [6.2, 7.6],
  [5.8, 5.8],
];

export const tableFlyover =
  (p: FlyoverParams, frames: number): LookFactory =>
  ({ gl, aspect }) => {
    const atlas = buildAtlas(
      {
        id: "flyover",
        px: 448,
        aspect: ASPECT,
        layout: "detailed",
        bg: p.plane,
        border: p.text,
        borderWidth: 0.008,
        radius: 0,
        inset: 0,
        symbol: p.text,
        text: p.text,
        sub: p.sub,
        showName: true,
        showMass: true,
        symbolWeight: 700,
        symbolSize: 0.34,
        numberSize: 0.125,
        nameSize: 0.116,
        massSize: 0.12,
        shellSize: 0.092,
        oxSize: 0.095,
      },
      gl,
    );

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(p.haze);
    const camera = new THREE.PerspectiveCamera(34, aspect, 0.3, 120);

    const fogOpts = { fogColor: p.haze, fogRange: [4.0, 15.0] as [number, number], fogMax: 0.78, fogMin: p.hazeMin };
    const material = makeTileMaterial(atlas, fogOpts);
    const tiles = makeTileMesh(atlas, ELEMENTS.length, material);
    const m = new THREE.Matrix4();
    const rotX = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    ELEMENTS.forEach((e, i) => {
      const { x, y } = tableXY(e, F_GAP);
      m.makeTranslation(x, 0, y * ASPECT).multiply(rotX);
      tiles.mesh.setMatrixAt(i, m);
      tiles.setRect(i, atlas.rect(e.z));
    });
    scene.add(tiles.mesh);

    // The dark plane under and around the table, fogged the same way.
    const planeMat = new THREE.ShaderMaterial({
      uniforms: {
        base: { value: new THREE.Color(p.plane) },
        fogColor: { value: new THREE.Color(p.haze) },
        fogRange: { value: new THREE.Vector2(...fogOpts.fogRange) },
        fogMax: { value: fogOpts.fogMax },
        fogMin: { value: fogOpts.fogMin },
      },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform vec3 base, fogColor; uniform vec2 fogRange; uniform float fogMax, fogMin; varying vec3 vW;
        void main(){ float d = distance(vW, cameraPosition); vec3 c = base * 0.82;
          c = mix(c, fogColor, mix(fogMin, fogMax, smoothstep(fogRange.x, fogRange.y, d))); gl_FragColor = vec4(c,1.0); }`,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(8.5, -0.002, 5);
    scene.add(plane);

    const curve = new THREE.CatmullRomCurve3(
      PATH.map(([x, y]) => new THREE.Vector3(x, 0, y * ASPECT)),
      true,
      "centripetal",
    );
    const target = new THREE.Vector3();
    const pitch = THREE.MathUtils.degToRad(ELEVATION);
    const viewDist = 7.2;

    return {
      scene,
      camera,
      update: (frame) => {
        const t = (((frame % frames) + frames) % frames) / frames;
        curve.getPointAt(t, target);
        // Heading: looking left along the rows (rows recede to a vanishing
        // point on the left), 25° above the plane. The camera's up vector
        // follows the table's "north" so the text stands upright.
        const yaw = THREE.MathUtils.degToRad(HEADING + 5 * Math.sin(2 * Math.PI * t + 0.6));
        const fwd = new THREE.Vector3(-Math.cos(yaw), 0, -Math.sin(yaw));
        camera.position
          .copy(target)
          .addScaledVector(fwd, -viewDist * Math.cos(pitch))
          .setY(viewDist * Math.sin(pitch));
        const north = new THREE.Vector3(0, 0, -1);
        camera.up.copy(north).lerp(new THREE.Vector3(0, 1, 0), UP_BLEND).normalize();
        camera.lookAt(target);
        camera.rotateZ(THREE.MathUtils.degToRad(ROLL));
        camera.updateMatrixWorld();
        return {
          ...DEFAULT_POST,
          focusDist: viewDist * 0.9,
          aperture: 1.15,
          focusBand: 0.06,
          nearScale: 0.5,
          maxBlur: 0.012,
          bloomThreshold: 0.66,
          bloomStrength: p.glow,
          bloomWeights: [0.6, 0.5, 0.35, 0.25],
          vignette: 0.15,
        };
      },
      dispose: () => {
        atlas.texture.dispose();
        material.dispose();
        tiles.mesh.geometry.dispose();
        planeMat.dispose();
      },
    };
  };
