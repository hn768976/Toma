/**
 * remotion-lib — shared components for Remotion stock-footage projects.
 *
 * Extracted from 78 project branches in hn768976/Toma. See CATALOG.md for what
 * exists, which projects each piece came from, and the gotchas.
 *
 * Everything here is pure: no internal state, no Date.now(), no rAF. Each
 * function takes a frame number or a progress value and returns a result, so
 * output is identical for identical (seed, frame) on every render.
 */
export * from './types';
export * from './random';
export * from './geo';
export * from './effects';
export * from './strokes';
export * from './generators';
export * from './shapes';
