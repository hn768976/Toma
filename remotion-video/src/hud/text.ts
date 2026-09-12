// Generic telemetry vocabulary. Deliberately non-branded and meaningless
// -- the reference is stock footage whose labels are pure texture, and
// keeping ours abstract means the clip drops into any context.
export const NODE_WORDS = [
  "SYS", "NODE", "LINK", "CORE", "GRID", "FLUX", "ARRAY", "CHNL",
  "RELAY", "TRACE", "VECTR", "BUFFR", "STRM", "SECTR", "PROBE", "MESH",
] as const;

export const STATUS_WORDS = [
  "SYNC", "IDLE", "LOCK", "SCAN", "HOLD", "LIVE", "AUTH", "READY",
] as const;

export const CODE_LINES = [
  "for (let i = 0; i < len; i++) {",
  "  const node = mesh.resolve(i);",
  "  if (!node.active) continue;",
  "  buffer.push(node.vector * gain);",
  "}",
  "",
  "function calibrate(channel) {",
  "  const drift = channel.read(0x1f);",
  "  return clamp(drift, -1.0, 1.0);",
  "}",
  "",
  "// recompute the lattice offsets",
  "const offsets = grid.map((cell) => {",
  "  return cell.phase % TAU;",
  "});",
  "",
  "await relay.open({ retries: 3 });",
  "relay.on('frame', (f) => decode(f));",
  "",
  "if (checksum !== expected) {",
  "  trace.warn('parity mismatch');",
  "  return recover(sector);",
  "}",
  "",
  "const stream = source.pipe(filter);",
  "stream.flush();",
] as const;

export const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;
