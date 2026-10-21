import * as THREE from "three";
import colors from "../../../data/colors.json";
import counts from "../../../data/counts.json";
import { easeOut, mod, smoothstep, TAU } from "../../lib/math";
import { mulberry32 } from "../../lib/random";
import { GLStage, Stage, StageContext } from "../../lib/three/GLStage";
import { makeMapLayer } from "./mapLayer";
import { SPRITE, SpriteBuffer } from "./overlays";
import { LOOP, PERSON_H, makeCrowd, makeCrowdMesh, personPos } from "./people";
import { SERVER, makeServer } from "./server";

const FOG = { near: 105, far: 320 };
const CAM_H = 60;
const PITCH = (30 * Math.PI) / 180;
const LIFE = 330;
const N_EVENTS = 22;
const SHOOT = 14;

const cameraAt = (f: number) => {
  const th = (TAU * mod(f, LOOP)) / LOOP;
  const x = 7 * Math.sin(th);
  const cam = new THREE.PerspectiveCamera(40, 16 / 9, 1, 2000);
  cam.position.set(x, CAM_H, 0);
  cam.lookAt(x * 0.7, 0, -CAM_H / Math.tan(PITCH));
  cam.updateMatrixWorld();
  return cam;
};

const makeBuild = (night: boolean) => (ctx: StageContext): Stage => {
  const { renderer } = ctx;
  const pal = night ? colors.cityNight : colors.cityDay;
  const scene = new THREE.Scene();
  const map = makeMapLayer(pal, night, FOG);
  scene.add(map.group);

  const people = makeCrowd(counts.dataServer.people, { x: [-330, 330], z: [-470, -32] }, 0xda7a);
  const crowd = makeCrowdMesh(people, pal.people, pal.haze);
  crowd.renderOrder = 1;
  scene.add(crowd);

  const server = makeServer(colors.server);
  // Hovering at the top centre of the view.
  const serverPos = new THREE.Vector3(0, 27, -108);
  server.position.copy(serverPos);
  server.rotation.y = 0;
  server.renderOrder = 2;
  scene.add(server);
  const serverBase = serverPos.clone().add(new THREE.Vector3(0, -SERVER.h / 2, 0));

  const sprites = new SpriteBuffer(6000, pal.line, pal.haze);
  sprites.mesh.renderOrder = 3;
  scene.add(sprites.mesh);
  const ringSprites = new SpriteBuffer(64, pal.ring, pal.haze);
  ringSprites.mesh.renderOrder = 4;
  scene.add(ringSprites.mesh);

  // Events: who gets circled and when (period 600 frames).
  const rng = mulberry32(0xe7e7);
  const candidates = people
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.z > -230 && p.z < -45 && Math.abs(p.x) < 18 + (-p.z) * 0.55);
  const events = Array.from({ length: N_EVENTS }, (_, e) => ({
    t: Math.floor((e + 0.6 * rng()) * (LOOP / N_EVENTS)),
    person: candidates[Math.floor(rng() * candidates.length)].i,
    spread: (rng() - 0.5) * 6,
  }));

  const crowdMat = crowd.material as THREE.RawShaderMaterial;
  return {
    render: (frame, target) => {
      const f = mod(frame, LOOP);
      const cam = cameraAt(f);
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      map.update(cam.position);
      crowdMat.uniforms.uFrame.value = f;
      crowdMat.uniforms.uRight.value.copy(right);
      crowdMat.uniforms.uCam.value.copy(cam.position);
      crowdMat.uniforms.uFog.value.set(FOG.near, FOG.far);
      for (const s of [sprites, ringSprites]) {
        s.material.uniforms.uRight.value.copy(right);
        s.material.uniforms.uUp.value.copy(up);
        s.material.uniforms.uCam.value.copy(cam.position);
        s.material.uniforms.uFog.value.set(FOG.near, FOG.far);
        s.reset();
      }
      for (const ev of events) {
        const age = mod(f - ev.t, LOOP);
        if (age >= LIFE) continue;
        const P = people[ev.person];
        const pos = personPos(P, f);
        const h = PERSON_H * P.scale;
        const fade = 1 - smoothstep(LIFE - 40, LIFE, age);
        const pop = easeOut(Math.min(1, age / 8));
        ringSprites.push(pos.clone().add(new THREE.Vector3(0, h * 0.5, 0)), h * 1.25 * (0.6 + 0.4 * pop), SPRITE.ring, fade * pop);
        // Dotted line from the base of the server down to the person.
        const top = serverBase.clone().add(new THREE.Vector3(ev.spread * 0.5, 0.3, 0));
        const end = pos.clone().add(new THREE.Vector3(0, h * 0.62, 0));
        const len = top.distanceTo(end);
        const shoot = Math.min(1, age / SHOOT);
        const nDots = Math.floor(len / 1.1);
        for (let k = 0; k <= nDots; k++) {
          const u = k / nDots;
          if (u > shoot) break;
          sprites.push(top.clone().lerp(end, u), 0.38, SPRITE.dot, fade * 0.9);
        }
        // Small square packets travelling up to the server.
        if (age > SHOOT) {
          for (let k = 0; k < 6; k++) {
            const pa = age - SHOOT - k * 9;
            if (pa < 0) continue;
            const u = 1 - mod(pa, 54) / 54;
            if (pa > LIFE - SHOOT - 50) continue;
            sprites.push(top.clone().lerp(end, u), 0.95, SPRITE.packet, fade);
          }
        }
      }
      sprites.commit();
      ringSprites.commit();
      renderer.setRenderTarget(target);
      renderer.setClearColor(new THREE.Color(pal.haze), 1);
      renderer.clear(true, true, true);
      renderer.render(scene, cam);
    },
  };
};

const buildDay = makeBuild(false);
const buildNight = makeBuild(true);

export const DataServer_City: React.FC = () => <GLStage build={buildDay} background={colors.cityDay.haze} />;
export const DataServer_Dark: React.FC = () => <GLStage build={buildNight} background={colors.cityNight.haze} />;
