// Pre-computes the Coin Rain (3F) rigid-body simulation with cannon-es.
//   npm run build:coinrain   ->  public/coinrain.bin
//
// Fixed timestep, seeded spawn positions/spins: the output is identical on
// every run. The composition only plays this data back (no physics at render
// time).
//
// File layout (little-endian):
//   uint32 magic 'CRN1', uint32 frames, uint32 coins, uint32 floatsPerCoin (=8)
//   float32[frames][coins][8]: x, y, z, qx, qy, qz, qw, visible (0/1)
// Units: centimetres, y up, table at y = 0. Coin axis = local +y.
import fs from 'node:fs';
import path from 'node:path';
import * as CANNON from 'cannon-es';

const FPS = 30;
const FRAMES = 450;
const SUBSTEPS = 16; // 480 Hz
const COINS = 150;
const R = 1.2;
const T = 0.2;
const PREROLL = 24; // frames simulated before frame 0 so coins are already falling

const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const rng = mulberry32(0x2837_0791);
const rnd = (a, b) => a + (b - a) * rng();

const world = new CANNON.World({gravity: new CANNON.Vec3(0, -981, 0)});
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.solver.iterations = 20;
world.defaultContactMaterial.contactEquationStiffness = 1e7;
world.defaultContactMaterial.contactEquationRelaxation = 3;

const tableMat = new CANNON.Material('table');
const coinMat = new CANNON.Material('coin');
world.addContactMaterial(new CANNON.ContactMaterial(tableMat, coinMat, {friction: 0.32, restitution: 0.38}));
world.addContactMaterial(new CANNON.ContactMaterial(coinMat, coinMat, {friction: 0.25, restitution: 0.3}));

const table = new CANNON.Body({mass: 0, material: tableMat, shape: new CANNON.Plane()});
table.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(table);

// Spawn schedule: most coins land between ~1 s and ~10 s, a few already in the
// air at frame 0. Positions spread across the visible table; some fall close
// to the camera (z > 0), most further back.
const spawns = [];
for (let i = 0; i < COINS; i++) {
  const u = i / (COINS - 1);
  const frame = Math.round(-PREROLL + Math.pow(u, 1.15) * 280 + rnd(-6, 6));
  const depth = Math.pow(rng(), 0.8);
  spawns.push({
    frame,
    pos: [rnd(-13, 13) * (0.6 + depth * 0.9), rnd(14, 26), 7 - depth * 34],
    euler: [rnd(-1.4, 1.4), rnd(0, Math.PI * 2), rnd(-1.4, 1.4)],
    vel: [rnd(-12, 12), rnd(-60, 0), rnd(-10, 10)],
    ang: [rnd(-25, 25), rnd(-8, 8), rnd(-25, 25)],
  });
}
spawns.sort((a, b) => a.frame - b.frame);

const bodies = spawns.map((s) => {
  const b = new CANNON.Body({mass: 0.0075, material: coinMat, shape: new CANNON.Cylinder(R, R, T, 20)});
  b.position.set(...s.pos);
  b.quaternion.setFromEuler(...s.euler);
  b.velocity.set(...s.vel);
  b.angularVelocity.set(...s.ang);
  b.linearDamping = 0.02;
  b.angularDamping = 0.05;
  b.sleepSpeedLimit = 1.0;
  b.sleepTimeLimit = 0.4;
  return b;
});

const FLOATS = 8;
const data = new Float32Array(FRAMES * COINS * FLOATS);
const added = new Array(COINS).fill(false);
const dt = 1 / (FPS * SUBSTEPS);

for (let f = -PREROLL; f < FRAMES; f++) {
  spawns.forEach((s, i) => {
    if (!added[i] && s.frame <= f) {
      world.addBody(bodies[i]);
      added[i] = true;
    }
  });
  if (f >= 0) {
    bodies.forEach((b, i) => {
      const o = (f * COINS + i) * FLOATS;
      data.set([b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w, added[i] ? 1 : 0], o);
    });
  }
  // Calm hold: once the fall is over, put slow coins to sleep so nothing creeps
  // during the final seconds.
  if (f >= 310) {
    for (const b of bodies) {
      if (b.sleepState !== CANNON.Body.SLEEPING && b.velocity.length() < 4 && b.angularVelocity.length() < 1.5) b.sleep();
    }
  }
  for (let k = 0; k < SUBSTEPS; k++) world.step(dt);
}

const header = new Uint32Array([0x314e5243, FRAMES, COINS, FLOATS]);
const out = path.resolve('public/coinrain.bin');
fs.writeFileSync(out, Buffer.concat([Buffer.from(header.buffer), Buffer.from(data.buffer)]));
const last = FRAMES - 1;
let resting = 0;
bodies.forEach((b) => (resting += b.position.y < 1.5 ? 1 : 0));
console.log(`wrote ${out} (${FRAMES} frames x ${COINS} coins), ${resting} resting near the table at frame ${last}`);
