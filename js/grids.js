/* ==========================================================================
   Grid & layout engine
   Swiss modular grids, radial/orbital grids and hybrid badge layouts.
   A grid returns named cells (with semantic roles), perimeter text bands,
   construction lines for the overlay and snap points.
   ========================================================================== */
(function (S) {
  'use strict';
  const P = S.P;
  const PHI = 0.6180339887;

  function rectCell(ctx, id, role, x, y, w, h) {
    const c = { id, role, type: 'rect', x, y, w, h, path: P.rrect(x, y, w, h, ctx.cr) };
    const safe = safeRect(ctx, x, y, w, h);
    c.safe = safe; c.cx = safe.x + safe.w / 2; c.cy = safe.y + safe.h / 2;
    c.fit = Math.min(safe.w, safe.h); c.fitW = safe.w; c.fitH = safe.h;
    c.inside = safe.w * safe.h >= 0.35 * w * h && c.fit > 24;
    return c;
  }
  function diskCell(id, role, cx, cy, r) {
    return { id, role, type: 'disk', x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, cx, cy, r, fit: 2 * r * 0.78, fitW: 2 * r * 0.78, fitH: 2 * r * 0.78, inside: true, path: P.circle(cx, cy, r) };
  }
  function annulusCell(id, role, cx, cy, r0, r1) {
    const rm = (r0 + r1) / 2;
    return { id, role, type: 'annulus', x: cx - r1, y: cy - r1, w: 2 * r1, h: 2 * r1, cx, cy: cy - rm, ox: cx, oy: cy, r0, r1, fit: (r1 - r0) * 0.9, fitW: (r1 - r0) * 0.9, fitH: (r1 - r0) * 0.9, inside: true, path: P.ring(cx, cy, r0, r1), rule: 'evenodd' };
  }
  function sectorCell(id, role, cx, cy, r0, r1, a0, a1) {
    const rm = (r0 + r1) / 2, am = (a0 + a1) / 2;
    const fit = Math.min((r1 - r0) * 0.86, rm * (a1 - a0) * 0.86);
    return { id, role, type: 'sector', x: cx - r1, y: cy - r1, w: 2 * r1, h: 2 * r1, cx: cx + rm * Math.cos(am), cy: cy + rm * Math.sin(am), ox: cx, oy: cy, r0, r1, a0, a1, rot: S.deg(am) + 90, fit, fitW: fit, fitH: fit, inside: true, path: P.sector(cx, cy, r0, r1, a0, a1) };
  }

  /** Shrink a rect (width first) until its corners sit inside the border. */
  function safeRect(ctx, x, y, w, h) {
    const o = ctx.outline, need = ctx.bw + ctx.pad * 0.5;
    const ok = (px, py) => S.insideOutline(o, px, py) && S.distToOutline(o, px, py) >= need;
    let cx = x + w / 2, cy = y + h / 2, ww = w, hh = h;
    for (let i = 0; i < 40; i++) {
      const good = ok(cx - ww / 2, cy - hh / 2) && ok(cx + ww / 2, cy - hh / 2) && ok(cx - ww / 2, cy + hh / 2) && ok(cx + ww / 2, cy + hh / 2);
      if (good) break;
      if (ww > w * 0.45) ww *= 0.95; else { ww *= 0.96; hh *= 0.95; }
      // drift toward the patch centre so edge cells keep usable space
      cx = S.lerp(cx, ctx.cx, 0.02); cy = S.lerp(cy, ctx.cy, 0.02);
    }
    return { x: cx - ww / 2, y: cy - hh / 2, w: ww, h: hh };
  }

  function band(cx, cy, r0, r1, spanTop, spanBottom) {
    return { cx, cy, r0, r1, rc: (r0 + r1) / 2, h: r1 - r0, spanTop, spanBottom };
  }

  /** Cobb corner cells in the space between a seal circle and a square-ish silhouette. */
  function cornerCells(ctx, g, r1) {
    if (ctx.shape !== 'roundsquare' && ctx.shape !== 'shield') return;
    const inner = ctx.inner;
    const corners = [['corner-tl', inner.x, inner.y, -1, -1], ['corner-tr', inner.x + inner.w, inner.y, 1, -1]];
    if (ctx.shape === 'roundsquare') corners.push(['corner-bl', inner.x, inner.y + inner.h, -1, 1], ['corner-br', inner.x + inner.w, inner.y + inner.h, 1, 1]);
    for (const [id, px, py, sx, sy] of corners) {
      // walk the diagonal from the circle edge toward the corner, keep the inside part
      const ang = Math.atan2(py - ctx.cy, px - ctx.cx);
      let a = r1 + 8, b = a;
      for (let r = a; r < 800; r += 4) {
        const x = ctx.cx + r * Math.cos(ang), y = ctx.cy + r * Math.sin(ang);
        if (!S.insideOutline(ctx.outline, x, y) || S.distToOutline(ctx.outline, x, y) < ctx.bw + 6) break;
        b = r;
      }
      const len = b - a, size = len * 0.92;
      if (size < 46) continue;
      const rm = (a + b) / 2, cx = ctx.cx + rm * Math.cos(ang), cy = ctx.cy + rm * Math.sin(ang);
      const s = size / Math.SQRT2 * 1.05;
      g.cells.push({ id, role: 'corner', type: 'rect', x: cx - s / 2, y: cy - s / 2, w: s, h: s, cx, cy, fit: s, fitW: s, fitH: s, inside: true, path: P.rrect(cx - s / 2, cy - s / 2, s, s, ctx.cr) });
    }
  }

  const builders = {
    swiss(ctx, g, n) {
      const b = ctx.box, gt = ctx.gut;
      const cw = (b.w - (n - 1) * gt) / n, ch = (b.h - (n - 1) * gt) / n;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        g.cells.push(rectCell(ctx, `r${r}c${c}`, 'cell', b.x + c * (cw + gt), b.y + r * (ch + gt), cw, ch));
      }
      const span = (id, role, r0, c0, r1, c1) => g.cells.push(rectCell(ctx, id, role,
        b.x + c0 * (cw + gt), b.y + r0 * (ch + gt), (c1 - c0 + 1) * cw + (c1 - c0) * gt, (r1 - r0 + 1) * ch + (r1 - r0) * gt));
      if (n === 2) span('emblem', 'emblem', 0, 0, 1, 1);
      if (n === 3) { span('emblem', 'emblem', 1, 1, 1, 1); span('header', 'header', 0, 0, 0, 2); span('footer', 'footer', 2, 0, 2, 2); }
      if (n === 4) { span('emblem', 'emblem', 1, 1, 2, 2); span('header', 'header', 0, 0, 0, 3); span('footer', 'footer', 3, 0, 3, 3); }
      if (n === 6) { span('emblem', 'emblem', 1, 1, 4, 4); span('header', 'header', 0, 1, 0, 4); span('footer', 'footer', 5, 1, 5, 4); }
      for (let i = 0; i <= n; i++) {
        const x = b.x + i * (cw + gt) - (i ? gt / 2 : 0), y = b.y + i * (ch + gt) - (i ? gt / 2 : 0);
        g.lines.push({ d: P.line(Math.min(x, b.x + b.w), 0, Math.min(x, b.x + b.w), 1000), k: 'minor' });
        g.lines.push({ d: P.line(0, Math.min(y, b.y + b.h), 1000, Math.min(y, b.y + b.h)), k: 'minor' });
      }
    },
    golden(ctx, g, mirror) {
      const b = ctx.box, gt = ctx.gut;
      const wL = b.w * PHI - gt / 2, wR = b.w - wL - gt;
      const hT = b.h * (1 - PHI) - gt / 2, hB = b.h - hT - gt;
      const hR2 = hB * (1 - PHI) - gt / 2, hR3 = hB - hR2 - gt;
      const cells = [
        ['header', 'header', 0, 0, wL, hT], ['emblem', 'emblem', 0, hT + gt, wL, hB],
        ['aux-1', 'aux', wL + gt, 0, wR, hT], ['aux-2', 'aux', wL + gt, hT + gt, wR, hR2], ['aux-3', 'aux', wL + gt, hT + gt + hR2 + gt, wR, hR3],
      ];
      for (const [id, role, x, y, w, h] of cells) {
        const X = mirror ? b.w - x - w : x, Y = mirror ? b.h - y - h : y;
        g.cells.push(rectCell(ctx, id, role, b.x + X, b.y + Y, w, h));
      }
      const xs = mirror ? b.x + b.w - b.w * PHI : b.x + b.w * PHI, ys = mirror ? b.y + b.h * PHI : b.y + b.h * (1 - PHI);
      g.lines.push({ d: P.line(xs, 0, xs, 1000), k: 'golden' }, { d: P.line(0, ys, 1000, ys), k: 'golden' });
      // quarter-circle golden arcs as construction guides
      const s = b.w * PHI;
      g.lines.push({ d: mirror ? P.arc(b.x + b.w - s, b.y + b.h, s, -Math.PI / 2, 0) : P.arc(b.x + s, b.y, s, Math.PI / 2, Math.PI), k: 'golden' });
    },
    rings(ctx, g) {
      const { cx, cy } = ctx, r1 = ctx.Ri - ctx.pad * 0.3;
      const bw = ctx.Ri * ctx.bandRatio, r0 = r1 - bw;
      const m1 = r0 - ctx.gut, m0 = m1 - ctx.Ri * 0.13, e = m0 - ctx.gut;
      g.cells.push(annulusCell('band', 'band', cx, cy, r0, r1), annulusCell('ring-1', 'ring', cx, cy, m0, m1), diskCell('emblem', 'emblem', cx, cy, e));
      g.bands = band(cx, cy, r0, r1, 150, 130);
      cornerCells(ctx, g, r1);
      [r1, r0, m1, m0, e].forEach((r) => g.lines.push({ d: P.circle(cx, cy, r), k: 'minor' }));
    },
    polar(ctx, g, n) {
      const { cx, cy } = ctx, r1 = ctx.Ri - ctx.pad * 0.3;
      const bw = ctx.Ri * ctx.bandRatio, br0 = r1 - bw;
      const sr1 = br0 - ctx.gut, sr0 = ctx.Ri * 0.34;
      g.cells.push(annulusCell('band', 'band', cx, cy, br0, r1), diskCell('emblem', 'emblem', cx, cy, sr0 - ctx.gut));
      g.bands = band(cx, cy, br0, r1, 150, 130);
      const step = Math.PI * 2 / n, ga = ctx.gut / ((sr0 + sr1) / 2);
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 - step / 2 + i * step + ga / 2;
        g.cells.push(sectorCell(`sector-${i}`, 'sector', cx, cy, sr0, sr1, a0, a0 + step - ga));
        const a = -Math.PI / 2 - step / 2 + i * step;
        g.lines.push({ d: P.line(cx + sr0 * Math.cos(a), cy + sr0 * Math.sin(a), cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)), k: 'minor' });
      }
      cornerCells(ctx, g, r1);
      [r1, br0, sr1, sr0].forEach((r) => g.lines.push({ d: P.circle(cx, cy, r), k: 'minor' }));
    },
    seal(ctx, g, curved) {
      const { cx, cy } = ctx, r1 = ctx.Ri - ctx.pad * 0.3;
      const bw = ctx.Ri * ctx.bandRatio, r0 = r1 - bw, rc = (r0 + r1) / 2;
      g.cells.push(annulusCell('band', 'band', cx, cy, r0, r1), diskCell('emblem', 'emblem', cx, cy, r0 - ctx.gut));
      g.bands = band(cx, cy, r0, r1, curved ? 112 : 150, curved ? 100 : 130);
      const sz = bw * (curved ? 0.92 : 0.6);
      for (const [id, a] of [['side-l', Math.PI], ['side-r', 0]]) {
        const x = cx + rc * Math.cos(a), y = cy + rc * Math.sin(a);
        g.cells.push({ id, role: curved ? 'aux' : 'sep', type: 'rect', x: x - sz / 2, y: y - sz / 2, w: sz, h: sz, cx: x, cy: y, fit: sz, fitW: sz, fitH: sz, inside: true, path: P.rrect(x - sz / 2, y - sz / 2, sz, sz, ctx.cr) });
      }
      cornerCells(ctx, g, r1);
      [r1, r0, rc].forEach((r, i) => g.lines.push({ d: P.circle(cx, cy, r), k: i === 2 ? 'guide' : 'minor' }));
    },
    badgeStraight(ctx, g) {
      const b = ctx.box, gt = ctx.gut;
      const hH = b.h * 0.19, fH = b.h * 0.16, my = b.y + hH + gt, mh = b.h - hH - fH - 2 * gt;
      const sw = b.w * 0.22, ew = b.w - 2 * sw - 2 * gt, rh = (mh - gt) / 2;
      g.cells.push(rectCell(ctx, 'header', 'header', b.x, b.y, b.w, hH), rectCell(ctx, 'footer', 'footer', b.x, b.y + b.h - fH, b.w, fH),
        rectCell(ctx, 'emblem', 'emblem', b.x + sw + gt, my, ew, mh),
        rectCell(ctx, 'corner-tl', 'corner', b.x, my, sw, rh), rectCell(ctx, 'corner-bl', 'corner', b.x, my + rh + gt, sw, rh),
        rectCell(ctx, 'corner-tr', 'corner', b.x + b.w - sw, my, sw, rh), rectCell(ctx, 'corner-br', 'corner', b.x + b.w - sw, my + rh + gt, sw, rh));
    },
    badgeTelemetry(ctx, g) {
      const b = ctx.box, gt = ctx.gut;
      const hH = b.h * 0.18, fH = b.h * 0.15, my = b.y + hH + gt, mh = b.h - hH - fH - 2 * gt;
      const ew = b.w * 0.64, aw = b.w - ew - gt, ah = (mh - 2 * gt) / 3, tw = (b.w - 3 * gt) / 4;
      g.cells.push(rectCell(ctx, 'header', 'header', b.x, b.y, b.w, hH), rectCell(ctx, 'emblem', 'emblem', b.x, my, ew, mh));
      for (let i = 0; i < 3; i++) g.cells.push(rectCell(ctx, `aux-${i + 1}`, 'aux', b.x + ew + gt, my + i * (ah + gt), aw, ah));
      for (let i = 0; i < 4; i++) g.cells.push(rectCell(ctx, `tel-${i + 1}`, 'telemetry', b.x + i * (tw + gt), b.y + b.h - fH, tw, fH));
    },
  };

  const cache = new Map();
  S.buildGrid = function (state) {
    const gs = state.grid;
    const key = [state.shape, state.cornerRadius, state.borderWidth, state.keyline, state.keylineWidth, gs.preset, gs.gutter, gs.padding, gs.cellRadius, gs.bandRatio].join('|');
    if (cache.has(key)) return cache.get(key);
    const m = S.shapeMetrics(state);
    const pad = +gs.padding;
    const ctx = {
      shape: state.shape, outline: m.outline, bw: m.bw, inner: m.inner, pad, gut: +gs.gutter, cr: +gs.cellRadius || 0,
      cx: m.cx, cy: m.cy, Ri: m.Ri, bandRatio: +gs.bandRatio || 0.24,
      box: { x: m.inner.x + pad, y: m.inner.y + pad, w: m.inner.w - 2 * pad, h: m.inner.h - 2 * pad },
    };
    const g = { preset: gs.preset, cells: [], lines: [], bands: null, center: [m.cx, m.cy], Ri: m.Ri, box: ctx.box };
    const p = gs.preset;
    if (p.startsWith('swiss-')) builders.swiss(ctx, g, +p.split('-')[1]);
    else if (p === 'golden' || p === 'golden-r') builders.golden(ctx, g, p === 'golden-r');
    else if (p === 'rings') builders.rings(ctx, g);
    else if (p.startsWith('polar-')) builders.polar(ctx, g, +p.split('-')[1]);
    else if (p === 'seal') builders.seal(ctx, g, false);
    else if (p === 'badge-curved') builders.seal(ctx, g, true);
    else if (p === 'badge-straight') builders.badgeStraight(ctx, g);
    else if (p === 'badge-telemetry') builders.badgeTelemetry(ctx, g);
    else builders.swiss(ctx, g, 3);

    // fallback text band for layouts without one (arc text still works)
    g.fallbackBand = g.bands || band(m.cx, m.cy, m.Ri - pad * 0.3 - m.Ri * 0.2, m.Ri - pad * 0.3, 150, 130);
    g.lines.push({ d: P.line(m.cx, 0, m.cx, 1000), k: 'axis' }, { d: P.line(0, m.cy, 1000, m.cy), k: 'axis' });
    g.lines.push({ d: P.rect(ctx.box.x, ctx.box.y, ctx.box.w, ctx.box.h), k: 'box' });
    g.snaps = [[m.cx, m.cy]];
    for (const c of g.cells) { g.snaps.push([c.cx, c.cy]); if (c.type === 'rect') g.snaps.push([c.x, c.y], [c.x + c.w, c.y], [c.x, c.y + c.h], [c.x + c.w, c.y + c.h]); }
    g.byId = Object.fromEntries(g.cells.map((c) => [c.id, c]));
    cache.set(key, g);
    if (cache.size > 30) cache.delete(cache.keys().next().value);
    return g;
  };

  /** Resolve a cell id against a (possibly different) grid, falling back by role. */
  S.resolveCell = function (grid, id) {
    if (!id) return null;
    if (grid.byId[id]) return grid.byId[id];
    const roleOf = (s) => (s.startsWith('corner') ? 'corner' : s.startsWith('aux') || s.startsWith('side') ? 'aux' : s.startsWith('sector') ? 'sector' : s.startsWith('tel') ? 'telemetry' : s.startsWith('r') && /r\dc\d/.test(s) ? 'cell' : s);
    const want = roleOf(id);
    const pool = grid.cells.filter((c) => c.inside && c.role === want);
    if (pool.length) { const n = parseInt((id.match(/\d+/) || ['0'])[0], 10); return pool[n % pool.length]; }
    const alias = { corner: ['aux', 'telemetry', 'sector', 'cell', 'sep'], aux: ['corner', 'telemetry', 'sector', 'cell'], sector: ['aux', 'corner', 'cell'], telemetry: ['aux', 'corner', 'cell'], cell: ['aux', 'corner', 'sector'], header: ['band'], footer: ['band'] }[want] || [];
    for (const r of alias) { const c = grid.cells.find((x) => x.inside && x.role === r); if (c) return c; }
    return grid.byId.emblem || grid.cells.find((c) => c.inside) || null;
  };

  /** Cells available to the generator for a role. */
  S.cellsByRole = (grid, ...roles) => grid.cells.filter((c) => c.inside && roles.includes(c.role));
})(window.SSEP = window.SSEP || {});
