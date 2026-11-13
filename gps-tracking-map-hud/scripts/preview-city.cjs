// Quick debug preview of city JSON via Chromium canvas (not used for final renders)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const data = fs.readFileSync(process.argv[2], 'utf8');
  const out = process.argv[3];
  const [vx, vy, vw] = (process.argv[4] || '-450,-450,12900').split(',').map(Number);
  const W = 2400, H = Math.round(W * 7900 / 12900);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.setContent(`<canvas id=c width=${W} height=${H}></canvas>`);
  await p.evaluate(([d, vx, vy, vw, W, H]) => {
    const c = JSON.parse(d); const ctx = document.getElementById('c').getContext('2d');
    const s = W / vw; ctx.fillStyle = '#0A1418'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(s, 0, 0, s, -vx * s, -vy * s);
    const col = { sea: '#03080a', river: '#03080a', park: '#050A0C', block: '#050A0C', yard: '#050A0C', airport: '#050A0C', runway: '#1d3a3e', pier: '#0A1418' };
    for (const k of ['sea','river','park','block','yard','airport','runway','pier']) for (const q of c.polys) if (q.kind === k) { ctx.fillStyle = col[k]; ctx.beginPath(); for (let i = 0; i < q.pts.length; i += 2) ctx.lineTo(q.pts[i], q.pts[i+1]); ctx.fill(); }
    const st = { route: ['#FFE04A', 2.5, 1], lane: ['#5AC8C8', 0.5, 0.45], street: ['#5AC8C8', 0.8, 0.8], rail: ['#7fbcbc', 0.6, 0.7], avenue: ['#8AF0F0', 1.4, 1], highway: ['#8AF0F0', 2.6, 1] };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const k of ['lane','street','rail','avenue','highway','route']) { const [cc, w, a] = st[k]; ctx.strokeStyle = cc; ctx.globalAlpha = a; ctx.lineWidth = w / s * (vw < 5000 ? 1.5 : 1); for (const r of c.roads) if (r.cls === k) { ctx.beginPath(); for (let i = 0; i < r.pts.length; i += 2) ctx.lineTo(r.pts[i], r.pts[i+1]); ctx.stroke(); } }
  }, [data, vx, vy, vw, W, H]);
  await p.screenshot({ path: out });
  await b.close();
})();
