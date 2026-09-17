import type { Node } from "three/webgpu";
import type { ShaderNodeObject, smoothstep } from "three/tsl";

/**
 * Every TSL expression in this project is built with the chainable proxy
 * wrapper, so one alias keeps the shader code readable instead of repeating
 * the generic at every call site.
 */
export type TSL = ShaderNodeObject<Node>;

/**
 * Anything TSL accepts where a node is expected: a node, a uniform, or a plain
 * JS number it will promote. Mirrors the parameter type three's own math
 * helpers use.
 */
export type TSLInput = Parameters<typeof smoothstep>[0];
