/* ==========================================================================
   Procedural background motifs (seeded). Klein-style colour blocking and
   orbital geometry, Cobb-style hazard banding, Manhattan street grid.
   ========================================================================== */
(function (S) {
  'use strict';
  const P = S.P;
  const M = {};

  M.starfield = (c, L, r, C, F, St) => {
    const n = Math.round(18 + (L.density == null ? 0.5 : L.density) * 110);
    for (let i = 0; i < n; i++) {
      const x = r() * 1000, y = r() * 1000;
      if (!S.insideOutline(c.outline, x, y)) continue;
      if (r() < 0.12) { const s = 9 + r() * 17; F(P.star(x, y, s, s * 0.22, 4, -90), C[1], St('satin')); }
      else F(P.circle(x, y, 2.4 + r() * r() * 6), C[0], St('satin'));
    }
  };

  M.colorblock = (c, L, r, C, F, St) => {
    const th = S.rad(L.param == null ? 35 : L.param * 180), u = [Math.cos(th), Math.sin(th)], nrm = [-u[1], u[0]];
    const [cx, cy] = c.grid.center, off = (r() - 0.5) * 220;
    const half = (o) => {
      const p0 = [cx + nrm[0] * o, cy + nrm[1] * o];
      return P.poly([[p0[0] + u[0] * 2000, p0[1] + u[1] * 2000], [p0[0] + u[0] * 2000 + nrm[0] * 2000, p0[1] + u[1] * 2000 + nrm[1] * 2000],
        [p0[0] - u[0] * 2000 + nrm[0] * 2000, p0[1] - u[1] * 2000 + nrm[1] * 2000], [p0[0] - u[0] * 2000, p0[1] - u[1] * 2000]]);
    };
    F(half(off), C[0], St('fill', 90));
    if ((L.density == null ? 0.5 : L.density) > 0.35) F(half(off + 46 + r() * 30) + half(off + 110 + r() * 40), C[1], Object.assign(St('fill', 0), {}), 'evenodd');
  };

  M.concentric = (c, L, r, C, F, St) => {
    const [cx, cy] = c.grid.center, R = c.grid.Ri + 20;
    const k = 3 + Math.round((L.density == null ? 0.5 : L.density) * 4);
    let rad = R;
    for (let i = 0; i < k; i++) {
      const w = R / k * (0.6 + r() * 0.5);
      if (i % 2 === 0) F(P.ring(cx, cy, Math.max(0, rad - w), rad), C[(i / 2) % 2 ? 1 : 0], St('satin'), 'evenodd');
      rad -= w;
      if (rad < 30) break;
    }
  };

  M.horizon = (c, L, r, C, F, St, K) => {
    const R = 980, top = 560 + (L.param == null ? 0.5 : L.param) * 260, cy = top + R;
    F(P.circle(500, cy, R), C[0], St('fill', 0));
    K(P.circle(500, cy, R + 16), C[1], 9, St('satin'));
    K(P.circle(500, cy + 90, R), C[2], 5, St('satin'));
    K(P.circle(500, cy + 200, R), C[2], 4, St('satin'));
  };

  M.sunburst = (c, L, r, C, F, St) => {
    const [cx, cy] = c.grid.center;
    const n = 2 * Math.round(6 + (L.density == null ? 0.5 : L.density) * 10), step = Math.PI * 2 / n;
    const a0 = -Math.PI / 2 - step / 2;
    let d = '';
    for (let i = 0; i < n; i += 2) d += P.sector(cx, cy, 0, 900, a0 + i * step, a0 + (i + 1) * step);
    F(d, C[0], St('fill'));
  };

  M.orbits = (c, L, r, C, F, St, K) => {
    const n = 2 + Math.round((L.density == null ? 0.5 : L.density) * 2);
    for (let i = 0; i < n; i++) {
      K(P.ellipse(500 + (r() - 0.5) * 120, 500 + (r() - 0.5) * 120, 360 + r() * 200, 80 + r() * 140, r() * 180), C[i % 2], 8 + r() * 9, St('satin'));
    }
  };

  M.lattice = (c, L, r, C, F, St, K) => {
    const s = 78 - (L.density == null ? 0.5 : L.density) * 36, h = s * Math.sqrt(3);
    let d = '';
    for (let col = -1; col * s * 1.5 < 1100; col++) {
      for (let row = -1; row * h < 1100; row++) {
        const x = col * s * 1.5, y = row * h + (col % 2 ? h / 2 : 0);
        d += P.regPoly(x, y, s, 6, 0);
      }
    }
    K(d, C[0], 3.2, St('satin'));
    for (let i = 0; i < 9; i++) {
      const col = Math.floor(r() * 9), row = Math.floor(r() * 9);
      const x = col * s * 1.5 + s, y = row * h + (col % 2 ? h / 2 : 0);
      F(P.circle(x, y, 7), C[1], St('satin'));
    }
  };

  M.hazard = (c, L, r, C, F, St) => {
    const yc = 140 + (L.param == null ? 0.86 : L.param) * 720, bh = 56 + (L.density == null ? 0.5 : L.density) * 40;
    c.b.save();
    c.b.clip(P.rect(0, yc - bh / 2, 1000, bh));
    F(P.rect(0, yc - bh / 2, 1000, bh), C[0], St('fill', 0));
    let d = '';
    for (let x = -200; x < 1200; x += 64) d += P.poly([[x, yc + bh / 2], [x + 32, yc + bh / 2], [x + 32 + bh, yc - bh / 2], [x + bh, yc - bh / 2]]);
    F(d, C[1], St('satin'));
    c.b.restore();
  };

  M.manhattan = (c, L, r, C, F, St, K) => {
    const b = c.b;
    b.save(); b.translate(500, 500); b.rotate(29); b.translate(-500, -500);
    const av = 120 - (L.density == null ? 0.5 : L.density) * 40;
    let d1 = '', d2 = '';
    for (let x = -300; x < 1300; x += av) d1 += P.rect(x, -300, 9, 1600);
    for (let y = -300; y < 1300; y += av / 3.2) d2 += P.rect(-300, y, 1600, 3.6);
    F(d1, C[0], St('satin')); F(d2, C[0], St('satin'));
    b.restore();
    K(P.line(80, 980, 900, -40), C[1], 10, St('satin'));
  };

  S.drawMotif = function (ctx, L) {
    const fn = M[L.motif];
    if (!fn) return;
    const r = S.rng(L.seed || 7);
    const C = (L.colors || [3, 4, 2]).map(ctx.color);
    const base = L.angle || 0;
    const St = (type, add = 0) => (L.stitch === 'twill' ? { type: 'twill' } : { type: L.stitch && L.stitch !== 'auto' ? L.stitch : type, angle: base + add });
    const F = (d, color, st, rule) => ctx.b.path(d, { fill: color, stitch: st, rule });
    const K = (d, color, w, st) => ctx.b.path(d, { stroke: color, width: w, cap: 'butt', stitch: st });
    fn(ctx, L, r, C, F, St, K);
    if (ctx.boxes) ctx.boxes[L.id] = [{ x: 500, y: 500, w: 1000, h: 1000, rot: 0, bg: true }];
  };
})(window.SSEP = window.SSEP || {});
