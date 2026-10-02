// Generic, invented code text for the overlay blocks. No product names.
export const CODE_BLOCKS: string[][][] = [
  [
    ["$ grid.init --cols 160 --rows 72", "  loading tiles ........ ok", "  projection: equirect", "  nodes online: 4096"],
    ["$ route.trace node_a -> node_k", "  hop 01  12ms", "  hop 02  19ms", "  hop 03  27ms  done"],
    ["$ sync --region all", "  pending: 0  merged: 214", "  checksum 9f3a-21c7", "  status: stable"],
  ],
  [
    ["fn project(lat, lon) {", "  let x = (lon + 180) / 360;", "  let y = (90 - lat) / 180;", "  return vec2(x, y);", "}"],
    ["for cell in grid.cells {", "  if cell.active {", "    emit(cell.id, cell.load);", "  }", "}"],
    ["let q = stream.open(\"feed_07\");", "q.window(64).reduce(sum);", "q.flush();"],
  ],
  [
    ["> link 0x4F2A ... established", "> link 0x4F2B ... established", "> latency avg 23.4 ms"],
    ["> scan sector 12/40", "> scan sector 13/40", "> scan sector 14/40", "> anomalies: none"],
    ["> buffer 82% ", "> compress lz block 07", "> write ok (3.2 MB)"],
  ],
  [
    ["// node map v2", "nodes = 4096", "edges = 18211", "mean_degree = 8.89"],
    ["// telemetry", "uptime   99.982%", "packets  1.42e9", "dropped  0.0004%"],
    ["// orbit", "axis_tilt = 23.4", "spin = 1 rev / cycle", "phase = locked"],
  ],
];
