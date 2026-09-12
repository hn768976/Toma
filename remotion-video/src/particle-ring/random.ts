// The PRNG now lives in src/lib so the plexus compositions can share it.
// Re-exported here to keep the particle-ring module's imports unchanged.
export { mulberry32, seededRandom } from "../lib/random";
