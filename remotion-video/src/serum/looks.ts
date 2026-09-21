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
  top: [1.32, 1.32, 1.36],
  bottom: [1.28, 1.28, 1.33],
  accent: 0.16,
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
    envMapIntensity: 0.9,
  }),
  backTint: attenuationColor,
  bubble: { rim: '#ffffff', core: bubbleCore, strength: 1.35 },
  background: moleculeBackground(),
  lighting: lighting({
    keyIntensity: 2.6,
    fillIntensity: 0.9,
    ambientIntensity: 0.9,
    ambientColor: '#ffffff',
  }),
  dof: dof(9.4, 0.9, 16),
  grain: 0.02,
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
  bubble: { rim: '#ffffff', core: over.bubbleCore, strength: 1.0 },
  background: over.background,
  lighting: lighting({
    keyIntensity: over.keyIntensity,
    fillIntensity: over.keyIntensity * 0.35,
    ambientIntensity: 0.6,
  }),
  dof: dof(9.2, 1.8, 7),
  grain: 0.02,
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
  top: [1.12, 1.15, 1.18],
  bottom: [0.62, 0.66, 0.7],
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
    attenuationDistance: 1.6,
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
  dof: dof(8.8, 3.4, 2.4),
  grain: 0.018,
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
  dof: dof(9.2, 0.8, 11),
  lighting: lighting({
    keyIntensity: 2.0,
    fillIntensity: 0.8,
    ambientIntensity: 0.8,
  }),
  grain: 0.022,
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
    mode: 'flat',
    top: [1.5, 0.84, 1.06],
    bottom: [1.44, 0.76, 1.0],
    accent: 0,
    accentColor: [1, 1, 1],
  },
  lighting: lighting({
    keyIntensity: 3.4,
    fillIntensity: 1.1,
    ambientIntensity: 0.6,
  }),
  dof: dof(9.0, 2.0, 4),
  grain: 0.018,
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
  dof: dof(8.6, 2.6, 3.2),
  grain: 0.02,
  stillFrame: 150,
  stillFrames: [35, 150, 260],
  isLoop: true,
});

export const LOOKS: LookRow[] = [
  // Look 1 -- three colourways of one asset.
  moleculeRow('Molecule-Lavender', 'Molecule_Lavender', 1101, '#5f66c8', 3.3, '#6068c0'),
  moleculeRow('Molecule-Blue', 'Molecule_Blue', 1102, '#4d94c4', 3.5, '#4f96c4'),
  moleculeRow('Molecule-Gold', 'Molecule_Gold', 1103, '#b98f3d', 3.7, '#b08a38'),

  // Look 2 -- soft champagne, then glossy lilac.
  giantRow('GiantSphere-Champagne', 'GiantSphere_Champagne', 2101, {
    attenuationColor: '#c79a4e',
    attenuationDistance: 3.6,
    bubbleCore: '#9c7526',
    roughness: 0.15,
    backTint: '#d8b877',
    envMapIntensity: 0.8,
    keyIntensity: 2.0,
    background: {
      mode: 'radial',
      top: [1.02, 0.88, 0.66],
      bottom: [0.96, 0.82, 0.6],
      accent: 0.12,
      accentColor: [1.1, 0.98, 0.78],
    },
  }),
  giantRow('GiantSphere-Lilac', 'GiantSphere_Lilac', 2102, {
    attenuationColor: '#7a52c0',
    attenuationDistance: 3.0,
    bubbleCore: '#5a3a94',
    roughness: 0.02,
    backTint: '#a98ada',
    envMapIntensity: 2.3,
    keyIntensity: 3.4,
    background: {
      mode: 'radial',
      top: [0.86, 0.72, 1.08],
      bottom: [0.78, 0.64, 1.0],
      accent: 0.16,
      accentColor: [0.98, 0.88, 1.18],
    },
  }),

  // Look 3 -- rose, then orange.
  blobRow('CandyBlob-Rose', 'CandyBlob_Rose', 3101, '#f0a894', '#ffeae2', '#d08770'),
  blobRow('CandyBlob-Orange', 'CandyBlob_Orange', 3102, '#f0a552', '#ffe4c4', '#d4903c'),

  // Look 4 -- dusty pink reference, plus a pale blue.
  fieldRow(
    'BubbleField-Pink',
    'BubbleField_Pink',
    4101,
    {
      mode: 'radial',
      top: [1.16, 0.76, 0.86],
      bottom: [0.96, 0.58, 0.7],
      accent: 0.18,
      accentColor: [1.24, 0.9, 0.98],
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
      top: [0.78, 0.98, 1.16],
      bottom: [0.6, 0.82, 1.02],
      accent: 0.18,
      accentColor: [0.9, 1.08, 1.24],
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
