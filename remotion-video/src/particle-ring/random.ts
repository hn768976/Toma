// Moved to src/shared/random.ts so the cyber-shield compositions can use
// the same deterministic PRNG. Re-exported here to keep this module's
// existing import sites unchanged.
export { mulberry32, seededRandom } from "../shared/random";
