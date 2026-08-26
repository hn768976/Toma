import { writeFileSync, readFileSync } from "node:fs";
import { createRiv } from "/opt/node22/lib/node_modules/rive-mcp-server/dist/rivWriter.js";

export function emit(spec, outPath) {
  for (const f of spec.fonts ?? []) if (!f.bytes) f.bytes = new Uint8Array(readFileSync(f.path));
  const { bytes, warnings } = createRiv(spec);
  writeFileSync(outPath, bytes);
  console.log(`wrote ${outPath} (${bytes.length} bytes)`);
  if (warnings?.length) console.log("warnings: " + warnings.join("; "));
  return bytes.length;
}
