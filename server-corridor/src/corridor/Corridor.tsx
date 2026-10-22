import React, { useMemo } from "react";
import {
  BoxGeometry,
  CanvasTexture,
  Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
} from "three";
import {
  CABINET_PITCH,
  CEILING_Y,
  END_CABINETS,
  END_WALL_Z,
  FIRST_CABINET_Z,
  GLASS_TOP_Y,
  GLASS_WIDTH,
  HALF_WIDTH,
  PILLAR_WIDTH,
  PLINTH_TOP_Y,
  RACK_TOP_Y,
} from "./layout";
import { Palette } from "./palette";
import { makeGlassTextures } from "./glass-textures";
import { makeGlassMaterial } from "./glass-material";

const GLASS_RECESS = 0.1;
const BEZEL = 0.08; // door frame around each glass pane
const GLASS_H = GLASS_TOP_Y - PLINTH_TOP_Y;
const RACK_DEPTH = 1.0;
const NEAR_Z = 8; // corridor extends this far behind the camera start
const END_PILLAR = 0.24;
const END_GLASS_W = (HALF_WIDTH * 2 - END_PILLAR * (END_CABINETS + 1)) / END_CABINETS;
const VARIANTS = 6;

type Materials = {
  frame: MeshStandardMaterial;
  ceiling: MeshStandardMaterial;
  strip: MeshBasicMaterial;
  cove: MeshBasicMaterial;
  coveGlow: MeshBasicMaterial;
  slot: MeshBasicMaterial;
  bezel: MeshStandardMaterial;
  handle: MeshStandardMaterial;
  glass: ShaderMaterial[];
};

export const useCorridorMaterials = (palette: Palette, ledBoost: number): Materials =>
  useMemo(() => {
    const ledColors = [0, 1, 2].map(
      (i) => palette.leds[Math.min(i, palette.leds.length - 1)].color,
    ) as [string, string, string];
    return {
      frame: new MeshStandardMaterial({ color: palette.frame, roughness: 0.55, metalness: 0 }),
      ceiling: new MeshStandardMaterial({ color: palette.ceiling, roughness: 0.8 }),
      strip: new MeshBasicMaterial({ color: palette.stripLight, toneMapped: false, transparent: palette.stripOpacity < 1, opacity: palette.stripOpacity }),
      cove: new MeshBasicMaterial({ color: palette.stripLight, toneMapped: false }),
      coveGlow: new MeshBasicMaterial({ color: palette.stripLight, toneMapped: false, transparent: true, opacity: 0.3, depthWrite: false }),
      slot: new MeshBasicMaterial({ color: palette.stripLight, toneMapped: false, transparent: true, opacity: 0.9, alphaMap: pillTexture() }),
      bezel: new MeshStandardMaterial({ color: palette.frame, roughness: 0.4, emissive: palette.frame, emissiveIntensity: 0.12 }),
      handle: new MeshStandardMaterial({ color: palette.handle, roughness: 0.4, emissive: palette.handle, emissiveIntensity: palette.handleGlow }),
      glass: new Array(VARIANTS)
        .fill(0)
        .map((_, i) => makeGlassMaterial(makeGlassTextures(palette, 1013 + i * 7919), ledColors, ledBoost)),
    };
  }, [palette, ledBoost]);

// Rounded "pill" mask for the plinth light slots.
const pillTexture = () => {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, 512, 64);
  g.fillStyle = "#fff";
  g.beginPath();
  g.roundRect(4, 6, 504, 52, 26);
  g.fill();
  return new CanvasTexture(c);
};

const box = new BoxGeometry(1, 1, 1);
const plane = new PlaneGeometry(1, 1);

const Box: React.FC<{
  x0: number; x1: number; y0: number; y1: number; z0: number; z1: number;
  material: Material;
}> = ({ x0, x1, y0, y1, z0, z1, material }) => (
  <mesh
    geometry={box}
    material={material}
    position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]}
    scale={[Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)]}
  />
);

const SideRow: React.FC<{ side: -1 | 1; m: Materials }> = ({ side, m }) => {
  const front = side * HALF_WIDTH;
  const back = side * (HALF_WIDTH + RACK_DEPTH);
  const glassX = side * (HALF_WIDTH + GLASS_RECESS);
  // Pillars sit at END_WALL_Z + k * pitch; cabinet k fills the gap above it.
  const count = Math.ceil((FIRST_CABINET_Z - END_WALL_Z) / CABINET_PITCH) + 1;
  const items = [];
  for (let k = 0; k <= count; k++) {
    const pz = END_WALL_Z + k * CABINET_PITCH;
    items.push(
      <Box key={`p${k}`} x0={front} x1={back} y0={0} y1={RACK_TOP_Y} z0={pz - PILLAR_WIDTH / 2} z1={pz + PILLAR_WIDTH / 2} material={m.frame} />,
    );
    // door handle on the pillar, next to the glass
    const hz = pz + PILLAR_WIDTH / 2 - 0.07;
    items.push(
      <Box key={`h${k}`} x0={front - side * 0.02} x1={front + side * 0.01} y0={1.42} y1={1.66} z0={hz - 0.018} z1={hz + 0.018} material={m.handle} />,
    );
    if (k === count) continue;
    const cz = pz + CABINET_PITCH / 2;
    items.push(
      <mesh
        key={`g${k}`}
        geometry={plane}
        material={m.glass[(k * 5 + (side === 1 ? 3 : 0)) % VARIANTS]}
        position={[glassX, (PLINTH_TOP_Y + GLASS_TOP_Y) / 2, cz]}
        rotation={[0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}
        scale={[GLASS_WIDTH + 0.02, GLASS_H, 1]}
      />,
    );
    // door bezel inside the recess
    const bx0 = glassX;
    const bx1 = glassX - side * 0.075;
    const zA = cz - GLASS_WIDTH / 2;
    const zB = cz + GLASS_WIDTH / 2;
    items.push(
      <Box key={`bt${k}`} x0={bx0} x1={bx1} y0={GLASS_TOP_Y - BEZEL} y1={GLASS_TOP_Y} z0={zA} z1={zB} material={m.bezel} />,
      <Box key={`bb${k}`} x0={bx0} x1={bx1} y0={PLINTH_TOP_Y} y1={PLINTH_TOP_Y + BEZEL} z0={zA} z1={zB} material={m.bezel} />,
      <Box key={`bl${k}`} x0={bx0} x1={bx1} y0={PLINTH_TOP_Y} y1={GLASS_TOP_Y} z0={zA} z1={zA + BEZEL} material={m.bezel} />,
      <Box key={`br${k}`} x0={bx0} x1={bx1} y0={PLINTH_TOP_Y} y1={GLASS_TOP_Y} z0={zB - BEZEL} z1={zB} material={m.bezel} />,
      <Box key={`bm${k}`} x0={bx0} x1={bx1 + side * 0.015} y0={PLINTH_TOP_Y} y1={GLASS_TOP_Y} z0={cz - 0.012} z1={cz + 0.012} material={m.bezel} />,
    );
    // plinth light slot
    items.push(
      <mesh
        key={`s${k}`}
        geometry={plane}
        material={m.slot}
        position={[front - side * 0.003, 0.23, cz]}
        rotation={[0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}
        scale={[GLASS_WIDTH * 0.8, 0.1, 1]}
      />,
    );
  }
  return (
    <group>
      {items}
      {/* plinth, header and back wall run the full row */}
      <Box x0={front} x1={back} y0={0} y1={PLINTH_TOP_Y} z0={END_WALL_Z} z1={NEAR_Z} material={m.frame} />
      <Box x0={front} x1={back} y0={GLASS_TOP_Y} y1={CEILING_Y} z0={END_WALL_Z} z1={NEAR_Z} material={m.frame} />
      <Box x0={glassX + side * 0.01} x1={back} y0={0} y1={CEILING_Y} z0={END_WALL_Z} z1={NEAR_Z} material={m.frame} />
      {/* cove light where the ceiling meets the cabinets */}
      <Box x0={front - side * 0.04} x1={front - side * 0.24} y0={CEILING_Y - 0.012} y1={CEILING_Y} z0={END_WALL_Z} z1={NEAR_Z} material={m.cove} />
      <Box x0={front - side * 0.24} x1={front - side * 0.6} y0={CEILING_Y - 0.008} y1={CEILING_Y - 0.002} z0={END_WALL_Z} z1={NEAR_Z} material={m.coveGlow} />
      {/* header light strip */}
      <Box x0={front - side * 0.012} x1={front} y0={RACK_TOP_Y - 0.075} y1={RACK_TOP_Y - 0.03} z0={END_WALL_Z} z1={NEAR_Z} material={m.strip} />
    </group>
  );
};

const EndWall: React.FC<{ m: Materials }> = ({ m }) => {
  const z = END_WALL_Z;
  const items = [];
  for (let i = 0; i <= END_CABINETS; i++) {
    const x0 = -HALF_WIDTH + i * (END_PILLAR + END_GLASS_W);
    items.push(<Box key={`p${i}`} x0={x0} x1={x0 + END_PILLAR} y0={0} y1={CEILING_Y} z0={z - RACK_DEPTH} z1={z} material={m.frame} />);
    if (i > 0 && i < END_CABINETS) {
      for (const dx of [-0.05, 0.05]) {
        const hx = x0 + END_PILLAR / 2 + dx;
        items.push(<Box key={`h${i}${dx}`} x0={hx - 0.016} x1={hx + 0.016} y0={1.42} y1={1.66} z0={z} z1={z + 0.02} material={m.handle} />);
      }
    }
    if (i === END_CABINETS) continue;
    const gx = x0 + END_PILLAR + END_GLASS_W / 2;
    items.push(
      <mesh key={`g${i}`} geometry={plane} material={m.glass[(i * 2 + 1) % VARIANTS]} position={[gx, (PLINTH_TOP_Y + GLASS_TOP_Y) / 2, z - GLASS_RECESS]} scale={[END_GLASS_W + 0.02, GLASS_H, 1]} />,
      <Box key={`bt${i}`} x0={gx - END_GLASS_W / 2} x1={gx + END_GLASS_W / 2} y0={GLASS_TOP_Y - BEZEL} y1={GLASS_TOP_Y} z0={z - GLASS_RECESS} z1={z - GLASS_RECESS + 0.075} material={m.bezel} />,
      <Box key={`bb${i}`} x0={gx - END_GLASS_W / 2} x1={gx + END_GLASS_W / 2} y0={PLINTH_TOP_Y} y1={PLINTH_TOP_Y + BEZEL} z0={z - GLASS_RECESS} z1={z - GLASS_RECESS + 0.075} material={m.bezel} />,
      <Box key={`bl${i}`} x0={gx - END_GLASS_W / 2} x1={gx - END_GLASS_W / 2 + BEZEL} y0={PLINTH_TOP_Y} y1={GLASS_TOP_Y} z0={z - GLASS_RECESS} z1={z - GLASS_RECESS + 0.075} material={m.bezel} />,
      <Box key={`br${i}`} x0={gx + END_GLASS_W / 2 - BEZEL} x1={gx + END_GLASS_W / 2} y0={PLINTH_TOP_Y} y1={GLASS_TOP_Y} z0={z - GLASS_RECESS} z1={z - GLASS_RECESS + 0.075} material={m.bezel} />,
      <mesh key={`s${i}`} geometry={plane} material={m.slot} position={[gx, 0.23, z + 0.003]} scale={[END_GLASS_W * 0.8, 0.1, 1]} />,
    );
  }
  return (
    <group>
      {items}
      <Box x0={-HALF_WIDTH} x1={HALF_WIDTH} y0={0} y1={PLINTH_TOP_Y} z0={z - RACK_DEPTH} z1={z} material={m.frame} />
      <Box x0={-HALF_WIDTH} x1={HALF_WIDTH} y0={GLASS_TOP_Y} y1={CEILING_Y} z0={z - RACK_DEPTH} z1={z} material={m.frame} />
      <Box x0={-HALF_WIDTH} x1={HALF_WIDTH} y0={CEILING_Y - 0.012} y1={CEILING_Y} z0={z + 0.04} z1={z + 0.24} material={m.cove} />
      <Box x0={-HALF_WIDTH} x1={HALF_WIDTH} y0={RACK_TOP_Y - 0.075} y1={RACK_TOP_Y - 0.03} z0={z} z1={z + 0.012} material={m.strip} />
    </group>
  );
};

const Ceiling: React.FC<{ m: Materials }> = ({ m }) => {
  const strips = [];
  const SEG = 2.6;
  const GAP = 0.45;
  for (let z = NEAR_Z; z > END_WALL_Z; z -= SEG + GAP) {
    const z1 = Math.max(END_WALL_Z, z - SEG);
    for (const x of [-0.62, 0.62]) {
      strips.push(
        <Box key={`${x}${z}`} x0={x - 0.03} x1={x + 0.03} y0={CEILING_Y - 0.012} y1={CEILING_Y} z0={z1} z1={z} material={m.strip} />,
      );
    }
  }
  return (
    <group>
      <Box x0={-HALF_WIDTH - 0.1} x1={HALF_WIDTH + 0.1} y0={CEILING_Y} y1={CEILING_Y + 0.1} z0={END_WALL_Z - 0.1} z1={NEAR_Z} material={m.ceiling} />
      {strips}
    </group>
  );
};

// The room without the floor; rendered once upright and once mirrored under
// a translucent floor to fake the glossy reflection.
export const CorridorShell: React.FC<{ m: Materials }> = ({ m }) => (
  <group>
    <SideRow side={-1} m={m} />
    <SideRow side={1} m={m} />
    <EndWall m={m} />
    <Ceiling m={m} />
  </group>
);
