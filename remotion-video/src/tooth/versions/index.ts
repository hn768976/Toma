import type React from "react";
import { secondsToFrames } from "../config";
import { V01WireframeHalo } from "./V01WireframeHalo";
import { V02ScanSweep } from "./V02ScanSweep";
import { V03EnamelShield } from "./V03EnamelShield";
import { V04MintStudio } from "./V04MintStudio";
import { V05XRay } from "./V05XRay";
import { V06MolecularOrbit } from "./V06MolecularOrbit";
import { V07GlassScan } from "./V07GlassScan";
import { V08AtomCage } from "./V08AtomCage";
import { V09BubbleShield } from "./V09BubbleShield";
import { V10SoftBlue } from "./V10SoftBlue";
import { V11LatticeScan } from "./V11LatticeScan";
import { V12ReflectiveFloor } from "./V12ReflectiveFloor";

export type ToothVersion = {
  /** Composition id suffix, e.g. "01-WireframeHalo". */
  readonly id: string;
  /** What the version is, for the Studio sidebar and the README. */
  readonly title: string;
  /** Duration of the reference clip this version matches, in seconds. */
  readonly seconds: number;
  readonly component: React.FC;
};

const version = (
  id: string,
  title: string,
  seconds: number,
  component: React.FC,
): ToothVersion => ({ id, title, seconds, component });

export const TOOTH_VERSIONS: readonly ToothVersion[] = [
  version("01-WireframeHalo", "Low-poly glowing wireframe on deep navy", 10.0, V01WireframeHalo),
  version("02-ScanSweep", "Wireframe tooth with a magenta analysis plane", 10.0, V02ScanSweep),
  version("03-EnamelShield", "Honeycomb protection shield forming and dissolving", 7.019, V03EnamelShield),
  version("04-MintStudio", "Glossy enamel on a seamless mint cyclorama", 10.0, V04MintStudio),
  version("05-XRay", "Additive x-ray volume dissolving into a beam", 7.56, V05XRay),
  version("06-MolecularOrbit", "Pearlescent tooth inside a swarm of orbiting spheres", 13.56, V06MolecularOrbit),
  version("07-GlassScan", "Luminous glass tooth turning on a dark reflective floor", 13.334, V07GlassScan),
  version("08-AtomCage", "Orbit rings accumulating into an atomic cage", 13.6, V08AtomCage),
  version("09-BubbleShield", "Soap bubble sealing around the tooth above a mirror floor", 8.04, V09BubbleShield),
  version("10-SoftBlue", "Minimal glossy tooth on a soft powder-blue field", 12.01, V10SoftBlue),
  version("11-LatticeScan", "White tooth under a blue measurement lattice", 10.0, V11LatticeScan),
  version("12-ReflectiveFloor", "Small tooth turning on a glossy blue surface", 5.03, V12ReflectiveFloor),
];

export const durationOf = (v: ToothVersion) => secondsToFrames(v.seconds);
