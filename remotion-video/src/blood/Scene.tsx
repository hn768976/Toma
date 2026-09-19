import { useMemo } from "react";
import * as THREE from "three";
import { createRbcGeometry } from "./assets";
import { CellField } from "./CellField";
import type { BloodLook } from "./looks";
import { Motes } from "./Motes";
import { CameraRig, Lights } from "./Rig";
import { useGlbGeometry } from "./useGlbGeometry";
import { CoreGlow, Vessel } from "./Vessel";

export type SceneProps = {
  look: BloodLook;
  /** Only the defocused foreground cells — rendered into its own blurred pass. */
  layer: "main" | "near";
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
export const Scene: React.FC<SceneProps> = ({ look, layer, matte = false }) => {
  const heroGeometry = useGlbGeometry("models/rbc.glb");
  // The swarm runs a much cheaper lathed cell: at these sizes the silhouette is
  // what reads, and the saving is what makes the long clips renderable.
  const swarmGeometry = useMemo(() => createRbcGeometry(28, 10), []);
  // The foreground layer is blurred before it is ever seen, so it gets the
  // cheap cell too — detail there is spent on pixels that get smeared away.
  const nearGeometry = useMemo(() => createRbcGeometry(40, 12), []);

  const fog = useMemo(
    () => new THREE.FogExp2(new THREE.Color(matte ? "#000000" : look.fogColor).getHex(), matte ? 0 : look.fogDensity),
    [look.fogColor, look.fogDensity, matte],
  );

  if (layer === "near") {
    return (
      <>
        <CameraRig look={look} />
        <Lights lights={look.lights} />
        <primitive attach="fog" object={fog} />
        {look.nearLayer ? (
          <CellField
            look={look}
            geometry={nearGeometry}
            count={look.nearLayer.count}
            seed={0x1f00d}
            sizeScale={look.nearLayer.sizeScale}
            thickness={0.62}
            nearOnly
            matte={matte}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <CameraRig look={look} />
      <primitive attach="fog" object={fog} />
      {/* Background is the fog colour, not the look's own: anything that ends
          in the distance — the far mouth of the vessel above all — would
          otherwise show the unfogged background through it as a hard-edged
          disc, since three does not fog the clear colour. */}
      <color attach="background" args={[matte ? "#000000" : look.fogColor]} />
      {matte ? null : <Lights lights={look.lights} />}
      {matte || !look.vessel ? null : <Vessel look={look} spec={look.vessel} />}
      {matte || !look.coreGlow ? null : <CoreGlow look={look} spec={look.coreGlow} />}

      <CellField
        look={look}
        geometry={swarmGeometry}
        count={look.swarmCount}
        seed={0xb100d}
        thickness={0.78}
        matte={matte}
      />
      {/* Full-detail scanned cell for the foreground population. */}
      {heroGeometry ? (
        <CellField
          look={look}
          geometry={heroGeometry}
          count={look.heroCount}
          seed={0xce115}
          sizeScale={1.18}
          thickness={0.42}
          matte={matte}
        />
      ) : null}

      {matte || !look.motes ? null : <Motes look={look} spec={look.motes} seed={0x59ec5} />}
    </>
  );
};
