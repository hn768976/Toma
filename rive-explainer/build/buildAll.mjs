import { P, W, H, FPS, SCENES } from "./lib.mjs";
import { sharedArtboards } from "./artboards.mjs";
import { buildMain } from "./scenes.mjs";
import { buildAnimations } from "./animations.mjs";
import { emit } from "./build.mjs";

const DIR = "/home/user/Toma/rive-explainer";
const HEAD = `${DIR}/assets/Poppins-ExtraBold.ttf`;
const BODY = `${DIR}/assets/Poppins-Bold.ttf`;

const { groups, shapes, nested, texts } = buildMain("head", "body");
const animations = buildAnimations();

// "Main" is a sequencer, not an interaction graph: time-based transitions only,
// no triggers and no conditions. F is terminal — no self-transition.
const states = SCENES.map((s) => ({ name: s.name, animation: s.name }));
const transitions = [{ from: "entry", to: SCENES[0].name }];
for (let i = 0; i < SCENES.length - 1; i++)
  transitions.push({ from: SCENES[i].name, to: SCENES[i + 1].name,
                     exitTimeMs: Math.round((SCENES[i].len / FPS) * 1000) });

const main = {
  name: "Explainer", width: W, height: H, backgroundColor: P.bg,
  groups, shapes, nested, texts, animations,
  stateMachine: { name: "Main", states, transitions },
};

const total = SCENES.reduce((a, s) => a + s.len, 0);
console.log(`timeline: ${total} frames @${FPS}fps = ${(total / FPS).toFixed(2)}s`);
emit({ fonts: [{ id: "head", path: HEAD }, { id: "body", path: BODY }],
       artboards: [main, ...sharedArtboards("head")] }, `${DIR}/adhd-brain.riv`);
