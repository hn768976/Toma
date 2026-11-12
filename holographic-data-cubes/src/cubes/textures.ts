import * as THREE from "three";
import { makeRng } from "./rng";

const FONT = '"DejaVu Sans Mono", "JetBrains Mono", Menlo, Consolas, "Courier New", monospace';

const SNIPPETS = [
  "public static function addInterface($name) {",
  "    $this->node = self::$registry[$name];",
  "    if (!isset($scode)) {",
  "        return false;",
  "    }",
  "    $scode .= \"namespace \" . $namespace . \";\";",
  "    $scode .= \"interface \" . $interface . \" {}\";",
  "    //create the interface",
  "    eval($scode);",
  "    self::$virtualized[] = $interface;",
  "    return true;",
  "} else return false;",
  "",
  "public static function getInterfaces() {",
  "    return array_keys(self::$interfaces);",
  "}",
  "function validate($token, $index) {",
  "    $token = trim($token);",
  "    # change empty values to null",
  "    foreach ($this->rows as $key => $row) {",
  "        $buffer[$key] = $row->resolve($index);",
  "    }",
  "    return array_search($interface, $buffer);",
  "}",
  "private function dispatch(array $queue) {",
  "    while ($job = array_shift($queue)) {",
  "        $result = $job->run($this->context);",
  "        $this->log[] = [$job->id, $result];",
  "    }",
  "    return count($this->log);",
  "}",
  "",
  "$stream = new DataStream($source, 0x3F);",
  "$stream->seek($offset + self::HEADER);",
  "echo $scode;",
];

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = "#000";
  g.fillRect(0, 0, w, h);
  return { c, g };
}

function finish(c: HTMLCanvasElement, renderer: THREE.WebGLRenderer) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * A tall sheet of generic source code, white on black. It tiles vertically
 * so panels can scroll through it forever. Drawn additively in the scene.
 */
export function makeCodeTexture(renderer: THREE.WebGLRenderer, seed: number) {
  const W = 1024;
  const H = 2048;
  const { c, g } = makeCanvas(W, H);
  const rng = makeRng(seed);
  const lineH = 32;
  const rows = H / lineH;
  g.font = `600 21px ${FONT}`;
  g.textBaseline = "middle";
  let k = rng.int(0, SNIPPETS.length - 1);
  for (let i = 0; i < rows; i++) {
    const line = SNIPPETS[k % SNIPPETS.length];
    k++;
    if (rng.chance(0.08)) {
      k += rng.int(1, 6);
    }
    g.fillStyle = `rgba(255,255,255,${rng.range(0.62, 1).toFixed(2)})`;
    g.fillText(line, 40 + (rng.chance(0.2) ? 60 : 0), i * lineH + lineH / 2);
  }
  return finish(c, renderer);
}

/** Dense numeric / hex read-out with short bar rows, tiles vertically. */
export function makeDataTexture(renderer: THREE.WebGLRenderer, seed: number) {
  const W = 1024;
  const H = 1024;
  const { c, g } = makeCanvas(W, H);
  const rng = makeRng(seed);
  const lineH = 32;
  g.font = `600 19px ${FONT}`;
  g.textBaseline = "middle";
  const hex = "0123456789ABCDEF";
  for (let i = 0; i < H / lineH; i++) {
    if (rng.chance(0.12)) {
      continue;
    }
    const len = rng.int(10, 58);
    let s = "";
    for (let j = 0; j < len; j++) {
      s += rng.chance(0.14) ? " " : hex[rng.int(0, rng.chance(0.6) ? 9 : 15)];
    }
    g.fillStyle = `rgba(255,255,255,${rng.range(0.5, 0.95).toFixed(2)})`;
    g.fillText(s, 30, i * lineH + lineH / 2);
  }
  return finish(c, renderer);
}
