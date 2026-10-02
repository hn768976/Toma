import * as THREE from 'three';
import { GeoJsonFeatureCollection } from '../../lib/assets';

/**
 * Rasterises Natural Earth land polygons (equirectangular) into a soft-edged
 * mask texture. Canvas2D rasterisation + blur is deterministic for a given
 * browser build, and it runs once per tab, before frame 0.
 */
export const makeLandTexture = (land: GeoJsonFeatureCollection, w = 2048, blurPx = 3) => {
  const h = w / 2;
  const src = document.createElement('canvas');
  src.width = w;
  src.height = h;
  const ctx = src.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  const px = (lon: number) => ((lon + 180) / 360) * w;
  const py = (lat: number) => ((90 - lat) / 180) * h;
  const drawPoly = (rings: number[][][]) => {
    ctx.beginPath();
    for (const ring of rings) {
      ring.forEach(([lon, lat], i) => {
        if (i === 0) ctx.moveTo(px(lon), py(lat));
        else ctx.lineTo(px(lon), py(lat));
      });
      ctx.closePath();
    }
    ctx.fill('evenodd');
  };
  for (const f of land.features) {
    const g = f.geometry;
    if (g.type === 'Polygon') drawPoly(g.coordinates as number[][][]);
    else for (const poly of g.coordinates as number[][][][]) drawPoly(poly);
  }
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const o = out.getContext('2d')!;
  o.fillStyle = '#000';
  o.fillRect(0, 0, w, h);
  o.filter = `blur(${blurPx}px)`;
  o.drawImage(src, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
};
