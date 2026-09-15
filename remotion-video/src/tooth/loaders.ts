import { useEffect, useMemo, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";

/**
 * The tooth geometry is shipped as flat little binaries rather than as glTF so
 * that decoding is a couple of typed-array views instead of a parser, and so
 * the low-poly / point-cloud variants (which glTF has no notion of) travel in
 * exactly the same format.
 *
 *   TMSH  magic(4) version(u32) vertexCount(u32) indexCount(u32)
 *         position f32[v*3]  normal f32[v*3]  index u32[i]
 *   TMSU  as TMSH, with uv f32[v*2] between normal and index
 *   TPTS  magic(4) version(u32) count(u32)
 *         position f32[n*3]  normal f32[n*3]
 */

const magicOf = (buffer: ArrayBuffer) =>
  String.fromCharCode(...new Uint8Array(buffer, 0, 4));

export const parseMesh = (buffer: ArrayBuffer): THREE.BufferGeometry => {
  const magic = magicOf(buffer);
  if (magic !== "TMSH" && magic !== "TMSU") {
    throw new Error(`Not a tooth mesh binary (magic "${magic}")`);
  }
  const head = new Uint32Array(buffer, 4, 3);
  const [, vertexCount, indexCount] = head;

  let offset = 16;
  const positions = new Float32Array(buffer, offset, vertexCount * 3);
  offset += vertexCount * 3 * 4;
  const normals = new Float32Array(buffer, offset, vertexCount * 3);
  offset += vertexCount * 3 * 4;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));

  if (magic === "TMSU") {
    const uvs = new Float32Array(buffer, offset, vertexCount * 2);
    offset += vertexCount * 2 * 4;
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  }

  geometry.setIndex(
    new THREE.BufferAttribute(new Uint32Array(buffer, offset, indexCount), 1),
  );
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
};

export type PointCloud = {
  readonly count: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
};

export const parsePoints = (buffer: ArrayBuffer): PointCloud => {
  const magic = magicOf(buffer);
  if (magic !== "TPTS") {
    throw new Error(`Not a tooth point binary (magic "${magic}")`);
  }
  const count = new Uint32Array(buffer, 4, 2)[1];
  return {
    count,
    positions: new Float32Array(buffer, 12, count * 3),
    normals: new Float32Array(buffer, 12 + count * 3 * 4, count * 3),
  };
};

/**
 * Decoded assets are memoised per bundle, because Remotion mounts the same
 * composition once per rendering tab and the Studio switches between the twelve
 * versions constantly - re-decoding a 5MB mesh each time is pure waste.
 */
const decoded = new Map<string, unknown>();

const useBinaryAsset = <T,>(
  path: string,
  parse: (buffer: ArrayBuffer) => T,
): T | null => {
  const url = staticFile(path);
  const [value, setValue] = useState<T | null>(
    () => (decoded.get(url) as T | undefined) ?? null,
  );
  // Only the first tab to touch this asset has to hold up the render.
  const [handle] = useState<number | null>(() =>
    decoded.has(url) ? null : delayRender(`Loading ${path}`),
  );

  useEffect(() => {
    if (handle === null) {
      return;
    }
    let alive = true;
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`${response.status} while fetching ${path}`);
        }
        return response.arrayBuffer();
      })
      .then((buffer) => {
        const parsed = parse(buffer);
        decoded.set(url, parsed);
        if (alive) {
          setValue(parsed);
        }
        continueRender(handle);
      })
      .catch((error) => {
        cancelRender(error);
      });
    return () => {
      alive = false;
    };
    // `parse` is a stable module-level function for every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, url, path]);

  return value;
};

export const useToothGeometry = (path: string) => useBinaryAsset(path, parseMesh);
export const useToothPoints = (path: string) => useBinaryAsset(path, parsePoints);

/**
 * A copy of `geometry` carrying per-corner barycentric coordinates, which is
 * what the wireframe shader needs to draw resolution-independent edges without
 * WebGL's unsupported `lineWidth`.
 */
export const useBarycentricGeometry = (
  geometry: THREE.BufferGeometry | null,
): THREE.BufferGeometry | null =>
  useMemo(() => {
    if (!geometry) {
      return null;
    }
    const expanded = geometry.toNonIndexed();
    const vertexCount = expanded.getAttribute("position").count;
    const bary = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      bary[i * 3 + (i % 3)] = 1;
    }
    expanded.setAttribute("aBary", new THREE.BufferAttribute(bary, 3));
    return expanded;
  }, [geometry]);
