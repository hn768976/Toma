import { BufferAttribute, BufferGeometry, Sphere, Vector3 } from "three";

/**
 * One merged BufferGeometry holding every line as a quad strip — never one
 * object per line. `position` is not a position: it carries (u, v, side), and
 * the vertex shader evaluates the real world position from it analytically.
 *
 * Lines are emitted far edge first so that back-to-front alpha compositing is
 * correct without a depth buffer: the camera is locked and the displacement is
 * along the plane normal, so v ordering is depth ordering.
 */
export const buildLineRibbons = (lines: number, samples: number): BufferGeometry => {
  const vertexCount = lines * samples * 2;
  const positions = new Float32Array(vertexCount * 3);

  for (let j = 0; j < lines; j++) {
    const v = j / (lines - 1);
    for (let i = 0; i < samples; i++) {
      const u = i / (samples - 1);
      const base = (j * samples + i) * 6;
      positions[base + 0] = u;
      positions[base + 1] = v;
      positions[base + 2] = -1;
      positions[base + 3] = u;
      positions[base + 4] = v;
      positions[base + 5] = 1;
    }
  }

  const quadsPerLine = samples - 1;
  const indices = new Uint32Array(lines * quadsPerLine * 6);
  let w = 0;
  for (let j = 0; j < lines; j++) {
    const lineBase = j * samples * 2;
    for (let i = 0; i < quadsPerLine; i++) {
      const a = lineBase + i * 2;
      indices[w++] = a;
      indices[w++] = a + 1;
      indices[w++] = a + 2;
      indices[w++] = a + 2;
      indices[w++] = a + 1;
      indices[w++] = a + 3;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  // `position` is parameter space, so the derived bounds are meaningless.
  // Frustum culling is disabled on the mesh; this keeps three from computing them.
  geometry.boundingSphere = new Sphere(new Vector3(0, 0, 0), 1e6);
  return geometry;
};

/**
 * Plain indexed grid in parameter space, used by the opaque backing surface.
 * Like the ribbons, `position` carries (u, v) and the shader does the rest.
 */
export const buildParameterGrid = (cols: number, rows: number): BufferGeometry => {
  const positions = new Float32Array(cols * rows * 3);
  for (let j = 0; j < rows; j++) {
    const v = j / (rows - 1);
    for (let i = 0; i < cols; i++) {
      const base = (j * cols + i) * 3;
      positions[base + 0] = i / (cols - 1);
      positions[base + 1] = v;
      positions[base + 2] = 0;
    }
  }

  const indices = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let w = 0;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i;
      indices[w++] = a;
      indices[w++] = a + cols;
      indices[w++] = a + 1;
      indices[w++] = a + 1;
      indices[w++] = a + cols;
      indices[w++] = a + cols + 1;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.boundingSphere = new Sphere(new Vector3(0, 0, 0), 1e6);
  return geometry;
};
