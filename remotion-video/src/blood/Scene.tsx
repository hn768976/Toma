import { useMemo } from "react";
import { useVideoConfig } from "remotion";
import * as THREE from "three";
import { createRbcGeometry } from "./assets";
import { Backdrop, CoreGlow } from "./Backdrop";
import { CellField } from "./CellField";
import { computeVolume, sampleCells } from "./flow";
import type { BloodLook } from "./looks";
import { Motes } from "./Motes";
import { CameraRig, Lights } from "./Rig";
import { useGlbGeometry } from "./useGlbGeometry";

export type SceneProps = {
  look: BloodLook;
  /** Flat white-on-black pass for compositing. */
  matte?: boolean;
};

/**
 * The contents of the three.js canvas.
 *
 * Identical under WebGPU and WebGL: no post-processing passes and no shader
 * injection, so both backends produce the same image and the fallback is a
 * performance decision rather than a visual one.
 */
export const Scene: React.FC<SceneProps> = ({ look, matte = false }) => {
  const { width, height, fps } = useVideoConfig();
  const aspect = width / height;

  const heroGeometry = useGlbGeometry("models/rbc.glb");
  // The swarm runs a much cheaper lathed cell: at these sizes the silhouette is
  // what reads, and the saving is what makes the long clips renderable.
  const swarmGeometry = useMemo(() => createRbcGeometry(22, 8), []);

  const volume = useMemo(
    () => computeVolume(look.depth, look.fov, aspect, look.fill, look.nearZ),
    [look.depth, look.fov, look.fill, look.nearZ, aspect],
  );

  // One placement pass for the entire population. Sampling the hero and swarm
  // separately would let a hero cell land inside a swarm cell, so they are
  // placed together and only split afterwards.
  const cells = useMemo(
    () =>
      sampleCells({
        count: look.cellCount,
        seed: 0xb100d,
        volume,
        size: look.cellSize,
        margin: look.cellMargin,
        tumble: look.tumble,
        color: look.cellColor,
        colorSpread: look.cellColorSpread,
        // Routes every cell around the lens rather than through it, for the
        // whole length of this clip.
        cameraClearance: look.cameraClearance,
        duration: look.durationInFrames / fps,
        flowDirection: look.flowDirection,
        flowSpeed: look.flowSpeed,
      }),
    [
      look.cellCount,
      look.cellSize,
      look.cellMargin,
      look.tumble,
      look.cellColor,
      look.cellColorSpread,
      look.cameraClearance,
      look.durationInFrames,
      look.flowDirection,
      look.flowSpeed,
      fps,
      volume,
    ],
  );

  // Placement runs largest-first, so the front of the list is the biggest
  // cells — exactly the ones worth spending the detailed model on.
  const heroes = useMemo(() => cells.slice(0, look.heroCount), [cells, look.heroCount]);
  const swarm = useMemo(() => cells.slice(look.heroCount), [cells, look.heroCount]);

  const fog = useMemo(
    () =>
      new THREE.FogExp2(
        new THREE.Color(matte ? "#000000" : look.fogColor).getHex(),
        matte ? 0 : look.fogDensity,
      ),
    [look.fogColor, look.fogDensity, matte],
  );

  return (
    <>
      <CameraRig look={look} />
      <primitive attach="fog" object={fog} />
      {/* Background is the fog colour, not the look's own: three does not fog
          the clear colour, so anything that ends in the distance would show the
          unfogged background through it as a hard-edged shape. */}
      <color attach="background" args={[matte ? "#000000" : look.fogColor]} />
      {matte ? null : <Lights lights={look.lights} />}
      {matte || !look.backdrop ? null : <Backdrop look={look} spec={look.backdrop} />}
      {matte || !look.coreGlow ? null : <CoreGlow look={look} spec={look.coreGlow} />}

      <CellField look={look} geometry={swarmGeometry} cells={swarm} volume={volume} matte={matte} />
      {/* Full-detail scanned cell for the largest cells in the field. */}
      {heroGeometry ? (
        <CellField
          look={look}
          geometry={heroGeometry}
          cells={heroes}
          volume={volume}
          thickness={0.56}
          matte={matte}
        />
      ) : null}

      {matte || !look.motes ? null : (
        <Motes look={look} spec={look.motes} volume={volume} seed={0x59ec5} />
      )}
    </>
  );
};
