/**
 * The twelve compositions.
 *
 * Six looks; several of them ship in more than one colourway. Colourways of a
 * look share `geometrySeed`, so their geometry and motion are identical and
 * only colour differs -- that is what the verify step checks for looks 1 and 6.
 */
import type { BackgroundSpec, DofSpec, LightingSpec, LookRow, MaterialSpec } from './types';

const LOOP = 300;

const material = (over: Partial<MaterialSpec>): MaterialSpec => ({
  transmission: 1,
  thickness: 1.2,
  ior: 1.45,
  roughness: 0.05,
  attenuationColor: '#ffffff',
  attenuationDistance: 3,
  color: '#ffffff',
  clearcoat: 0,
  clearcoatRoughness: 0.1,
  chromaticAberration: 0.02,
  envMapIntensity: 1,
  iridescence: 0,
  iridescenceIOR: 1.3,
  iridescenceThicknessRange: [100, 400],
  heroOpacity: 1,
  ...over,
});

const lighting = (over: Partial<LightingSpec>): LightingSpec => ({
  keyIntensity: 2.2,
  keyColor: '#ffffff',
  keyPosition: [-4, 5, 6],
  fillIntensity: 0.8,
  fillColor: '#eef2ff',
  rimIntensity: 0,
  rimColor: '#ffffff',
  ambientIntensity: 0.35,
  ambientColor: '#ffffff',
  backPanel: null,
  ...over,
});

const dof = (worldFocusDistance: number, worldFocusRange: number, bokehScale: number): DofSpec => ({
  worldFocusDistance,
  worldFocusRange,
  bokehScale,
});

// ---------------------------------------------------------------------------
// Look 1 -- Molecule Chain. Near-white ground, thin frosted bonds, very heavy
// depth of field so background clusters go nearly shapeless.
// ---------------------------------------------------------------------------

const MOLECULE_GEOMETRY_SEED = 1001;

const moleculeBackground = (): BackgroundSpec => ({
  mode: 'edgeCool',
  top: [2.15, 2.15, 2.22],
  bottom: [2.05, 2.05, 2.14],
  accent: 0.1,
  accentColor: [0.86, 0.9, 1.0],
});

const moleculeRow = (
  id: string,
  name: string,
  seed: number,
  attenuationColor: string,
  attenuationDistance: number,
  bubbleCore: string,
): LookRow => ({
  id,
  name,
  mode: 'molecule',
  seed,
  geometrySeed: MOLECULE_GEOMETRY_SEED,
  durationInFrames: LOOP,
  material: material({
    thickness: 1.6,
    ior: 1.45,
    roughness: 0.05,
    attenuationColor,
    attenuationDistance,
    chromaticAberration: 0.03,
    envMapIntensity: 0.42,
  }),
  backTint: attenuationColor,
  bubble: { rim: '#dfe3ff', core: bubbleCore, strength: 0.28 },
  background: moleculeBackground(),
  lighting: lighting({
    keyIntensity: 2.6,
    fillIntensity: 0.9,
    ambientIntensity: 0.9,
    ambientColor: '#ffffff',
  }),
  heroLayers: ['mid'],
  dof: dof(9.4, 1.3, 30),
  grain: 0.035,
  stillFrame: 150,
  stillFrames: [40, 150, 240],
  isLoop: true,
});

// ---------------------------------------------------------------------------
// Look 2 -- Giant Sphere Cluster. Very large spheres cropped by the frame, a
// flat ground close in tone to the spheres. 2A soft and matte, 2B glossy.
// ---------------------------------------------------------------------------

const GIANT_GEOMETRY_SEED = 2002;

const giantRow = (
  id: string,
  name: string,
  seed: number,
  over: {
    attenuationColor: string;
    attenuationDistance: number;
    roughness: number;
    background: BackgroundSpec;
    backTint: string;
    envMapIntensity: number;
    keyIntensity: number;
    bubbleCore: string;
  },
): LookRow => ({
  id,
  name,
  mode: 'giant',
  seed,
  geometrySeed: GIANT_GEOMETRY_SEED,
  durationInFrames: LOOP,
  material: material({
    thickness: 3.2,
    ior: 1.47,
    roughness: over.roughness,
    attenuationColor: over.attenuationColor,
    attenuationDistance: over.attenuationDistance,
    chromaticAberration: 0.02,
    envMapIntensity: over.envMapIntensity,
  }),
  backTint: over.backTint,
  bubble: { rim: '#f2e8d2', core: over.bubbleCore, strength: 0.5 },
  background: over.background,
  lighting: lighting({
    keyIntensity: over.keyIntensity,
    fillIntensity: over.keyIntensity * 0.35,
    ambientIntensity: 0.6,
  }),
  dof: dof(9.2, 2.0, 16),
  grain: 0.035,
  stillFrame: 150,
  stillFrames: [30, 150, 250],
  isLoop: true,
});

// ---------------------------------------------------------------------------
// Look 3 -- Candy Blob. Density here is absorption, not opacity: transmission
// stays at 1 and the attenuation distance is short, so light is absorbed
// before it crosses. That is what gives the bright rim over a deeper core.
// ---------------------------------------------------------------------------

const BLOB_GEOMETRY_SEED = 3003;

const blobBackground = (): BackgroundSpec => ({
  mode: 'vertical',
  top: [1.6, 1.62, 1.65],
  bottom: [0.86, 0.9, 0.95],
  accent: 0,
  accentColor: [1, 1, 1],
});

const blobRow = (
  id: string,
  name: string,
  seed: number,
  attenuationColor: string,
  color: string,
  backTint: string,
): LookRow => ({
  id,
  name,
  mode: 'blob',
  seed,
  geometrySeed: BLOB_GEOMETRY_SEED,
  durationInFrames: LOOP,
  material: material({
    thickness: 4.4,
    ior: 1.5,
    roughness: 0.08,
    attenuationColor,
    attenuationDistance: 3.4,
    color,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    chromaticAberration: 0.01,
    envMapIntensity: 1.1,
  }),
  backTint,
  bubble: { rim: '#ffffff', core: '#ffffff', strength: 0 },
  background: blobBackground(),
  lighting: lighting({
    keyIntensity: 1.5,
    fillIntensity: 0.55,
    rimIntensity: 5.5,
    rimColor: '#ffffff',
    ambientIntensity: 0.22,
  }),
  dof: dof(8.8, 2.6, 15),
  grain: 0.032,
  stillFrame: 150,
  stillFrames: [45, 150, 255],
  isLoop: true,
});

// ---------------------------------------------------------------------------
// Look 4 -- Fine Bubble Field. No hero element; an even scatter at several
// depths, most soft, a thin band sharp.
// ---------------------------------------------------------------------------

const FIELD_GEOMETRY_SEED = 4004;

const fieldRow = (
  id: string,
  name: string,
  seed: number,
  background: BackgroundSpec,
  attenuationColor: string,
  backTint: string,
): LookRow => ({
  id,
  name,
  mode: 'field',
  seed,
  geometrySeed: FIELD_GEOMETRY_SEED,
  durationInFrames: LOOP,
  material: material({
    thickness: 0.5,
    ior: 1.33,
    roughness: 0.03,
    attenuationColor,
    attenuationDistance: 6,
    chromaticAberration: 0.015,
    envMapIntensity: 1.0,
  }),
  backTint,
  bubble: { rim: '#ffffff', core: '#ffffff', strength: 0 },
  background,
  heroLayers: ['mid'],
  dof: dof(9.2, 1.0, 26),
  lighting: lighting({
    keyIntensity: 2.0,
    fillIntensity: 0.8,
    ambientIntensity: 0.8,
  }),
  grain: 0.038,
  stillFrame: 150,
  stillFrames: [50, 150, 245],
  isLoop: true,
});

// ---------------------------------------------------------------------------
// Look 5 -- Iridescent Rise. Not a loop: bubbles enter below and leave above.
// 600 frames -- beauty pass, then the same animation as solid black on white
// so the clip ships with its own luma matte.
// ---------------------------------------------------------------------------

const iridescentRow = (): LookRow => ({
  id: 'IridescentRise-Pink',
  name: 'IridescentRise_Pink',
  mode: 'iridescent',
  seed: 5005,
  geometrySeed: 5005,
  durationInFrames: 600,
  material: material({
    thickness: 0.55,
    ior: 1.34,
    roughness: 0.02,
    attenuationColor: '#ffd9ee',
    attenuationDistance: 5,
    chromaticAberration: 0.02,
    envMapIntensity: 2.6,
    iridescence: 1,
    iridescenceIOR: 2.0,
    iridescenceThicknessRange: [120, 420],
  }),
  useNativeTransmission: true,
  envIntensity: 3.2,
  backTint: '#f6c8de',
  bubble: { rim: '#ffd9a8', core: '#f0a8d0', strength: 0.9 },
  background: {
    mode: 'radial',
    top: [1.86, 1.12, 1.4],
    bottom: [1.58, 0.86, 1.14],
    accent: 0.22,
    accentColor: [2.9, 2.0, 2.3],
  },
  lighting: lighting({
    keyIntensity: 3.4,
    fillIntensity: 1.1,
    ambientIntensity: 0.6,
  }),
  dof: dof(9.0, 2.4, 11),
  grain: 0.032,
  stillFrame: 120,
  stillFrames: [60, 150, 260],
  isLoop: false,
});

// ---------------------------------------------------------------------------
// Look 6 -- Golden Oil Cluster. Packed in contact, no background visible, lit
// from behind so the spheres glow from within. Motion is much smaller than the
// other looks because packed spheres cannot drift far without interpenetrating.
// ---------------------------------------------------------------------------

const OIL_GEOMETRY_SEED = 6006;

const oilRow = (
  id: string,
  name: string,
  seed: number,
  attenuationColor: string,
  color: string,
  panelColor: string,
  backTint: string,
): LookRow => ({
  id,
  name,
  mode: 'oil',
  seed,
  geometrySeed: OIL_GEOMETRY_SEED,
  durationInFrames: LOOP,
  material: material({
    thickness: 3.4,
    ior: 1.47,
    roughness: 0.04,
    attenuationColor,
    attenuationDistance: 3.0,
    color,
    chromaticAberration: 0.015,
    // Kept low on purpose: a strong environment puts hard softbox dots on the
    // front surfaces, which is exactly the "lit the wrong way round" failure.
    envMapIntensity: 0.16,
  }),
  backTint,
  bubble: { rim: '#fff4d8', core: '#c98a28', strength: 0.8, opaque: true },
  envIntensity: 0.02,
  backEmissive: panelColor,
  backEmissiveIntensity: 0.3,
  background: { mode: 'none', top: [0, 0, 0], bottom: [0, 0, 0], accent: 0, accentColor: [1, 1, 1] },
  lighting: lighting({
    // Front key drops to a soft fill; the panel behind is the dominant source.
    keyIntensity: 0.05,
    keyColor: '#fff3d8',
    fillIntensity: 0.03,
    ambientIntensity: 1.5,
    ambientColor: '#ffe4b0',
    backPanel: { color: panelColor, intensity: 1 },
  }),
  dof: dof(8.6, 3.2, 10),
  grain: 0.035,
  stillFrame: 150,
  stillFrames: [35, 150, 260],
  isLoop: true,
});

export const LOOKS: LookRow[] = [
  // Look 1 -- three colourways of one asset.
  moleculeRow('Molecule-Lavender', 'Molecule_Lavender', 1101, '#5f66c8', 1.7, '#6068c0'),
  moleculeRow('Molecule-Blue', 'Molecule_Blue', 1102, '#4d94c4', 1.8, '#4f96c4'),
  moleculeRow('Molecule-Gold', 'Molecule_Gold', 1103, '#b98f3d', 1.9, '#b08a38'),

  // Look 2 -- soft champagne, then glossy lilac.
  giantRow('GiantSphere-Champagne', 'GiantSphere_Champagne', 2101, {
    attenuationColor: '#c79a4e',
    attenuationDistance: 3.6,
    bubbleCore: '#9c7526',
    roughness: 0.15,
    backTint: '#c9a05a',
    envMapIntensity: 0.8,
    keyIntensity: 2.0,
    background: {
      mode: 'radial',
      top: [1.5, 1.27, 0.93],
      bottom: [1.38, 1.14, 0.8],
      accent: 0.14,
      accentColor: [2.1, 1.82, 1.34],
    },
  }),
  giantRow('GiantSphere-Lilac', 'GiantSphere_Lilac', 2102, {
    attenuationColor: '#7a52c0',
    attenuationDistance: 3.0,
    bubbleCore: '#5a3a94',
    roughness: 0.02,
    backTint: '#8f6bc8',
    envMapIntensity: 2.3,
    keyIntensity: 3.4,
    background: {
      mode: 'radial',
      top: [1.2, 0.97, 1.5],
      bottom: [1.06, 0.84, 1.38],
      accent: 0.18,
      accentColor: [1.74, 1.5, 2.1],
    },
  }),

  // Look 3 -- rose, then orange.
  blobRow('CandyBlob-Rose', 'CandyBlob_Rose', 3101, '#f2b6a4', '#fff0ea', '#e8a894'),
  blobRow('CandyBlob-Orange', 'CandyBlob_Orange', 3102, '#f2b464', '#ffecd4', '#e8ae66'),

  // Look 4 -- dusty pink reference, plus a pale blue.
  fieldRow(
    'BubbleField-Pink',
    'BubbleField_Pink',
    4101,
    {
      mode: 'radial',
      top: [1.72, 0.95, 1.1],
      bottom: [1.14, 0.52, 0.68],
      accent: 0.2,
      accentColor: [2.6, 1.5, 1.7],
    },
    '#e7a7b6',
    '#eab9c4',
  ),
  fieldRow(
    'BubbleField-Blue',
    'BubbleField_Blue',
    4102,
    {
      mode: 'radial',
      top: [0.92, 1.44, 1.74],
      bottom: [0.55, 1.0, 1.34],
      accent: 0.2,
      accentColor: [1.4, 2.1, 2.6],
    },
    '#9cc2dd',
    '#aecde2',
  ),

  // Look 5 -- beauty pass plus matte, 600 frames, not a loop.
  iridescentRow(),

  // Look 6 -- golden amber, and an olive that reads as a different product.
  oilRow('GoldenOil-Amber', 'GoldenOil_Amber', 6101, '#ffc12e', '#fff0b8', '#ffc94e', '#e8a824'),
  oilRow('GoldenOil-Olive', 'GoldenOil_Olive', 6102, '#b8c23a', '#f2f6c8', '#d2dc6e', '#b0ba38'),
];

export const lookById = (id: string): LookRow => {
  const row = LOOKS.find((l) => l.id === id);
  if (!row) throw new Error(`Unknown look: ${id}`);
  return row;
};
