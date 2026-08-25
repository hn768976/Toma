import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// The heavy blur passes and near-black gradients band badly at the default CRF.
Config.setCrf(12);
// Concurrency is left to the CLI flag so the config travels between machines.
