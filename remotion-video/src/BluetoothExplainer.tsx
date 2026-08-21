import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { z } from "zod";
import { HandDrawnFilter } from "./components/HandDrawnFilter";
import { Paper } from "./components/Paper";
import {
  TitleScene,
  titleSceneSchema,
  titleSceneDefaults,
} from "./scenes/TitleScene";
import {
  DevicesScene,
  devicesSceneSchema,
  devicesSceneDefaults,
} from "./scenes/DevicesScene";
import {
  PairingScene,
  pairingSceneSchema,
  pairingSceneDefaults,
} from "./scenes/PairingScene";
import {
  DataTransferScene,
  dataTransferSceneSchema,
  dataTransferSceneDefaults,
} from "./scenes/DataTransferScene";
import {
  OutroScene,
  outroSceneSchema,
  outroSceneDefaults,
} from "./scenes/OutroScene";
import {
  TITLE_DURATION,
  DEVICES_DURATION,
  PAIRING_DURATION,
  TRANSFER_DURATION,
  OUTRO_DURATION,
} from "./constants";

// Every scene is independently editable: tweak its text/colors either here
// via defaultProps, or live in the Remotion Studio "Properties" panel
// (each field below is backed by the scene's own zod schema).
export const bluetoothExplainerSchema = z.object({
  title: titleSceneSchema,
  devices: devicesSceneSchema,
  pairing: pairingSceneSchema,
  transfer: dataTransferSceneSchema,
  outro: outroSceneSchema,
});

export type BluetoothExplainerProps = z.infer<typeof bluetoothExplainerSchema>;

export const bluetoothExplainerDefaultProps: BluetoothExplainerProps = {
  title: titleSceneDefaults,
  devices: devicesSceneDefaults,
  pairing: pairingSceneDefaults,
  transfer: dataTransferSceneDefaults,
  outro: outroSceneDefaults,
};

export const BluetoothExplainer: React.FC<BluetoothExplainerProps> = ({
  title,
  devices,
  pairing,
  transfer,
  outro,
}) => {
  return (
    <AbsoluteFill>
      <HandDrawnFilter />
      <Paper />
      <Series>
        <Series.Sequence durationInFrames={TITLE_DURATION}>
          <TitleScene {...title} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={DEVICES_DURATION}>
          <DevicesScene {...devices} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={PAIRING_DURATION}>
          <PairingScene {...pairing} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={TRANSFER_DURATION}>
          <DataTransferScene {...transfer} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={OUTRO_DURATION}>
          <OutroScene {...outro} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
