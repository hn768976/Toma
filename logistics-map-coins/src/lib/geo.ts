import {loadImage, loadJson, once} from './assets';

// Natural Earth data as shipped in public/data (see scripts/prepare-data.mjs).
// Polygons: [ring, ring, ...] with each ring a flat [lon, lat, lon, lat, ...].
export type Polygon = number[][];
// [lon, lat, pop_max, scalerank]
export type Place = [number, number, number, number];

export const loadLand = () => loadJson<Polygon[]>('data/ne_50m_land.json');
export const loadLandCoarse = () => loadJson<Polygon[]>('data/ne_110m_land.json');
export const loadCountries = () => loadJson<Polygon[]>('data/ne_50m_admin_0_countries.json');
export const loadPlaces = () => loadJson<Place[]>('data/ne_10m_populated_places.json');
export const loadRelief = () => loadImage('data/gray_50m_sr.png');

// Draw polygons onto a 2D context with an equirectangular mapping of the box
// [lon0,lon1]x[lat0,lat1] to [0,w]x[0,h].
export const tracePolygons = (
  ctx: CanvasRenderingContext2D,
  polys: Polygon[],
  w: number,
  h: number,
  box: [number, number, number, number] = [-180, 180, -90, 90],
) => {
  const [lon0, lon1, lat0, lat1] = box;
  const sx = w / (lon1 - lon0);
  const sy = h / (lat1 - lat0);
  ctx.beginPath();
  for (const poly of polys) {
    for (const ring of poly) {
      for (let i = 0; i < ring.length; i += 2) {
        const x = (ring[i] - lon0) * sx;
        const y = (lat1 - ring[i + 1]) * sy;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
  }
};

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

export type MapRasters = {
  land: HTMLCanvasElement; // white land on black, 8192x4096
  landBlur: HTMLCanvasElement; // blurred copy for coastline glow, 2048x1024
  city: HTMLCanvasElement; // city-light density, 4096x2048
  relief: HTMLImageElement; // Natural Earth gray shaded relief
  places: Place[];
  polys: Polygon[];
};

export const loadMapRasters = () =>
  once('mapRasters', async (): Promise<MapRasters> => {
    const [polys, places, relief] = await Promise.all([loadLand(), loadPlaces(), loadRelief()]);
    const land = canvas(8192, 4096);
    {
      const ctx = land.getContext('2d')!;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, land.width, land.height);
      ctx.fillStyle = '#fff';
      tracePolygons(ctx, polys, land.width, land.height);
      ctx.fill('evenodd');
    }
    const landBlur = canvas(2048, 1024);
    {
      const ctx = landBlur.getContext('2d')!;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 2048, 1024);
      ctx.filter = 'blur(3px)';
      ctx.drawImage(land, 0, 0, 2048, 1024);
    }
    const city = canvas(4096, 2048);
    {
      const ctx = city.getContext('2d')!;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 4096, 2048);
      ctx.globalCompositeOperation = 'lighter';
      const sx = 4096 / 360;
      for (const [lon, lat, pop] of places) {
        const x = (lon + 180) * sx;
        const y = (90 - lat) * sx;
        // Radius grows with population (in degrees), soft falloff.
        const rDeg = 0.25 + Math.sqrt(pop / 1e6) * 0.55;
        const r = rDeg * sx;
        const a = Math.min(0.9, 0.12 + Math.log10(pop / 1e5) * 0.22);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(0.35, `rgba(255,255,255,${a * 0.45})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    return {land, landBlur, city, relief, places, polys};
  });
