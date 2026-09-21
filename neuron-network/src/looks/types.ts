import type { GrowParams } from "../core/branching";
import type { SomaStyle } from "../core/soma";

export type Vec3Tuple = [number, number, number];

export type Palette = {
  /** Background gradient centre and edge, as CSS hex. */
  bgInner: string;
  bgOuter: string;
  /** Dendrite body and its fresnel rim. */
  tube: string;
  rim: string;
  /** Soma core and its surrounding glow. */
  somaCore: string;
  somaGlow: string;
  /** Travelling signal pulses. */
  pulse: string;
  /** Junction nodes, sparks and static node glow. */
  node: string;
  particle: string;
};

export type PulseStyle = {
  /** Simultaneous pulses per primary dendrite, 0..3. */
  slots: number;
  /**
   * Complete traversals of the loop, drawn from this list. Integers only --
   * a single non-integer here breaks loop closure.
   */
  counts: number[];
  amplitude: number;
  /** Gaussian width of a soft pulse, in normalised arc length. */
  sigma: number;
  /** 0 = soft blob, 1 = hard-edged dash. */
  hardness: number;
  /** Extra brightness as a pulse crosses a junction. */
  junctionFlare: number;
  /** Whole-cell brightening, in complete cycles over the loop. 0 disables. */
  cellPulseCycles: number;
  cellPulseDepth: number;
  /** Junction spark flashes: cycles over the loop. 0 disables. */
  flashCycles: number;
  flashStrength: number;
  /** Steady, non-travelling glow at junctions (look 5's nodes). */
  nodeStrength: number;
  /**
   * Branch thickness, as a fraction of a primary dendrite's radius, over
   * which junction nodes and flashes fade in. Without it every terminal twig
   * sprouts a bright spot and the look turns spiky; look 5's tendrils are far
   * thinner than the other looks', so the threshold has to be per-look.
   */
  nodeGate: [number, number];
};

export type Look = {
  /** Remotion composition id. */
  id: string;
  /** Output file stem. */
  file: string;
  seed: number;
  /** Frames chosen for still harvesting, where a pulse sits well. */
  stillFrames: Vec3Tuple;

  field: {
    neuronCount: number;
    /** A single dominant soma near the camera. */
    hero: boolean;
    heroRadius: number;
    /** Where the dominant soma sits. Off-centre, near the camera. */
    heroCenter: Vec3Tuple;
    radius: number;
    /** Horizontal coverage as a fraction of the frame; 1.0 fills it exactly. */
    spreadX: number;
    /** Vertical coverage as a fraction of the frame. */
    spreadY: number;
    zNear: number;
    zFar: number;
    /** Depth reduction applied to the furthest neurons. */
    backgroundDepthDrop: number;
  };

  grow: GrowParams;
  soma: SomaStyle;

  tube: {
    radialCap: number;
    subdivisions: number;
    /** Ring-shaped thickenings along a fraction of the dendrites. */
    myelinAmplitude: number;
    myelinPeriod: number;
    myelinFraction: number;
    /** Glassy looks blend against the background through thin tubes. */
    transparent: boolean;
    minAlpha: number;
    ambient: number;
    rimStrength: number;
    rimPower: number;
  };

  palette: Palette;

  /** Emissive strengths. Somas and nodes glow; the tubes mostly do not. */
  emissive: {
    soma: number;
    somaRim: number;
    /**
     * How tightly the hot core sits inside the soma. Low values give a broad
     * bright cell body; high values leave a small white centre surrounded by
     * the glow colour, which is what makes a teal soma read as teal.
     */
    corePower: number;
  };

  pulse: PulseStyle;

  particles: {
    count: number;
    size: number;
    brightness: number;
    /** Seed particles on the dendrites rather than freely in the volume. */
    alongFibres: boolean;
    spread: number;
    /** Lissajous excursion. */
    amplitude: number;
  };

  sparks: {
    count: number;
    size: number;
    strength: number;
    cycles: number;
  };

  camera: {
    position: Vec3Tuple;
    target: Vec3Tuple;
    fov: number;
    /** Gentle parallax, not travel. */
    amplitude: Vec3Tuple;
    /** Integers only, so the camera path closes. */
    frequency: Vec3Tuple;
    phase: Vec3Tuple;
    near: number;
    far: number;
  };

  post: {
    /** Distance from the camera, in world units, that is sharp. */
    focusWorld: number;
    /** Depth of the sharp band, in world units. */
    focusRangeWorld: number;
    /**
     * Blur strength at 1080p. Scaled with frame height at render time, so a
     * 4K render matches the 1080p preview instead of being half as soft.
     */
    bokehScale: number;
    bloomIntensity: number;
    bloomThreshold: number;
    bloomSmoothing: number;
    grain: number;
    exposure: number;
    /** Background vignette / centre lift. */
    bgLift: number;
    /** Scales the background before tone mapping; a high-key look needs >1. */
    bgGain: number;
    multisampling: number;
  };
};
