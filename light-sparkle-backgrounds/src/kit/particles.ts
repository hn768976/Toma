import { Container, Particle, ParticleContainer, type Texture } from "pixi.js";

export const layer = (texture: Texture) => {
  const pc = new ParticleContainer({
    texture,
    dynamicProperties: { position: true, vertex: true, rotation: true, color: true, uvs: false },
    roundPixels: false,
  });
  pc.blendMode = "add";
  return pc;
};

export const addParticle = (pc: ParticleContainer, texture: Texture) => {
  const p = new Particle({ texture, anchorX: 0.5, anchorY: 0.5 });
  pc.addParticle(p);
  return p;
};

/** Size a particle in design px (texture-size independent). */
export const setSize = (p: Particle, w: number, h: number = w) => {
  p.scaleX = w / p.texture.width;
  p.scaleY = h / p.texture.height;
};

export const group = (...children: Container[]) => {
  const c = new Container();
  for (const ch of children) c.addChild(ch);
  return c;
};
