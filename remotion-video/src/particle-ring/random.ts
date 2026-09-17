// Re-exported from the shared lib so the particle ring and the cyber-alert
// wall draw their "identity" randomness from the exact same generator.
export { mulberry32, seededRandom } from "../lib/random";
