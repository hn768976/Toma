import React from "react";
import { AbsoluteFill } from "remotion";
import { MathUtils, Vector3 } from "three/webgpu";
import { QUALITY } from "./config";
import { ThreeStage, type StageFactory } from "./three/ThreeStage";
import { createShotRig } from "./shots/kit";
import { defaultSky } from "./three/sky";
import { defaultGrade } from "./post/grade";
import { bakeContainerMarkings } from "./three/canvas-textures";
import { createContainerYard } from "./props/containerYard";
import { createJet } from "./props/jet";

/**
 * Development rig: the two hero assets at close range under neutral light.
 *
 * Both subjects spend the finished shots either very far away or very steeply
 * foreshortened, which makes it almost impossible to judge a material change
 * from the shots themselves. Scrub this instead — the first half of the
 * timeline orbits the containers, the second half orbits the aircraft.
 */
const factory: StageFactory = async (ctx) => {
  const rig = createShotRig({
    ctx,
    sky: defaultSky({
      sunDirection: new Vector3(0.45, 0.5, -0.74).normalize(),
      intensity: 1,
    }),
    grade: defaultGrade({ exposure: -0.9, vignette: 0.14, grain: 0.008 }),
    camera: { fov: 38, near: 0.1, far: 20000 },
    world: { radius: 9000, sunIntensity: 3.2, fillIntensity: 0.7, environmentIntensity: 0.9 },
  });

  const markings = bakeContainerMarkings(ctx.quality.anisotropy);
  const yard = await createContainerYard({
    seed: 7,
    columns: 3,
    rows: 2,
    minTiers: 2,
    maxTiers: 3,
    markings,
    lod: false,
    gapChance: 0,
  });
  rig.world.scene.add(yard.object);

  const jet = await createJet();
  jet.object.position.set(0, 400, 0);
  rig.world.scene.add(jet.object);

  const target = new Vector3();
  const position = new Vector3();

  return rig.toStage((frame) => {
    const half = ctx.durationInFrames / 2;
    const onJet = frame >= half;
    const t = ((frame % half) / half) * Math.PI * 2;
    const radius = onJet ? jet.span * 0.85 : 11;
    const centre = onJet ? new Vector3(0, 400, 0) : new Vector3(0, 3.1, 0);
    position.set(
      centre.x + Math.sin(t) * radius,
      centre.y + (onJet ? jet.span * 0.12 : 2.4),
      centre.z + Math.cos(t) * radius,
    );
    rig.camera.position.copy(position);
    target.copy(centre);
    rig.camera.lookAt(target);
    rig.camera.fov = onJet ? 34 : 42;
    rig.camera.updateProjectionMatrix();
    void MathUtils;
  }, () => {
    yard.dispose();
    jet.dispose();
    markings.dispose();
  });
};

export const DevMaterialProbe: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <ThreeStage factory={factory} quality={QUALITY["1080p"]} />
  </AbsoluteFill>
);
