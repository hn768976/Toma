import "./index.css";
import "./load-fonts";
import { Composition } from "remotion";
import {
  BluetoothExplainer,
  bluetoothExplainerSchema,
  bluetoothExplainerDefaultProps,
} from "./BluetoothExplainer";
import { DURATION_IN_FRAMES, FPS, WIDTH, HEIGHT } from "./constants";
import {
  ParticleRingHalo,
  particleRingHaloSchema,
  particleRingHaloDefaults,
} from "./particle-ring/ParticleRingHalo";
import {
  BASE_WIDTH,
  BASE_HEIGHT,
  DURATION_IN_FRAMES as RING_DURATION_IN_FRAMES,
  FPS as RING_FPS,
} from "./particle-ring/constants";
import {
  BlockchainChain,
  blockchainChainSchema,
  blockchainChainDefaults,
} from "./blockchain/BlockchainChain";
import {
  BASE_WIDTH as CHAIN_WIDTH,
  BASE_HEIGHT as CHAIN_HEIGHT,
  DURATION_IN_FRAMES as CHAIN_DURATION_IN_FRAMES,
  FPS as CHAIN_FPS,
} from "./blockchain/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BluetoothExplainer"
        component={BluetoothExplainer}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={bluetoothExplainerSchema}
        defaultProps={bluetoothExplainerDefaultProps}
      />
      <Composition
        id="ParticleRingHalo"
        component={ParticleRingHalo}
        durationInFrames={RING_DURATION_IN_FRAMES}
        fps={RING_FPS}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        schema={particleRingHaloSchema}
        defaultProps={particleRingHaloDefaults}
      />
      <Composition
        id="ParticleRingHalo4K"
        component={ParticleRingHalo}
        durationInFrames={RING_DURATION_IN_FRAMES}
        fps={RING_FPS}
        width={BASE_WIDTH * 2}
        height={BASE_HEIGHT * 2}
        schema={particleRingHaloSchema}
        defaultProps={{ ...particleRingHaloDefaults, resolutionScale: 2 }}
      />

      {/*
        Blockchain data chain -- 20s @ 30fps, matching the reference
        clip. Each version is registered twice: 1080p for delivery and
        4K for the handoff project. The 4K pair differs only in
        resolutionScale, so the two always stay in sync.
      */}
      <Composition
        id="BlockchainChain1080p"
        component={BlockchainChain}
        durationInFrames={CHAIN_DURATION_IN_FRAMES}
        fps={CHAIN_FPS}
        width={CHAIN_WIDTH}
        height={CHAIN_HEIGHT}
        schema={blockchainChainSchema}
        defaultProps={blockchainChainDefaults}
      />
      <Composition
        id="BlockchainChain4K"
        component={BlockchainChain}
        durationInFrames={CHAIN_DURATION_IN_FRAMES}
        fps={CHAIN_FPS}
        width={CHAIN_WIDTH * 2}
        height={CHAIN_HEIGHT * 2}
        schema={blockchainChainSchema}
        defaultProps={{ ...blockchainChainDefaults, resolutionScale: 2 }}
      />
      <Composition
        id="BlockchainChainHero1080p"
        component={BlockchainChain}
        durationInFrames={CHAIN_DURATION_IN_FRAMES}
        fps={CHAIN_FPS}
        width={CHAIN_WIDTH}
        height={CHAIN_HEIGHT}
        schema={blockchainChainSchema}
        defaultProps={{ ...blockchainChainDefaults, layout: "hero" }}
      />
      <Composition
        id="BlockchainChainHero4K"
        component={BlockchainChain}
        durationInFrames={CHAIN_DURATION_IN_FRAMES}
        fps={CHAIN_FPS}
        width={CHAIN_WIDTH * 2}
        height={CHAIN_HEIGHT * 2}
        schema={blockchainChainSchema}
        defaultProps={{
          ...blockchainChainDefaults,
          layout: "hero",
          resolutionScale: 2,
        }}
      />
    </>
  );
};
