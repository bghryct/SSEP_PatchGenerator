/* ==========================================================================
   Patch renderer — draws a design state through any backend.
   Order: twill/ground → layers (motifs, blocks, symbols, uploads, type, labels)
          → keyline → merrowed border.  Everything is clipped to the silhouette.
   ========================================================================== */
(function (S) {
  'use strict';
  const P = S.P;

  /* ---------- palette ---------- */
  S.threadList = (state) => state.palette.threads.slice(0, S.clamp(state.palette.count | 0, 2, 6));
  S.colorFn = function (state) {
    const t = S.threadList(state), n = t.length;
    return (i) => { i = Math.max(0, i | 0); if (i < n) return t[i]; if (n <= 2) return t[i % n]; return t[2 + ((i - 2) % (n - 2))]; };
  };

  S.layerText = function (state, L) {
    let t = L.bind && state.meta && state.meta[L.bind] != null ? state.meta[L.bind] : L.text;
    t = String(t == null ? '' : t);
    return L.upper === false ? t : t.toUpperCase();
  };

  /** Resolve where a layer sits: either in a grid cell or at free coordinates. */
  S.layerFrame = function (L, grid) {
    if (L.cell) {
      const c = S.resolveCell(grid, L.cell);
      if (c) {
        const sc = L.scale == null ? 0.86 : L.scale;
        return { x: c.cx + (L.dx || 0), y: c.cy + (L.dy || 0), size: c.fit * sc, w: c.fitW * sc, h: c.fitH * sc,
          rot: (L.rot || 0) + (L.orient && c.rot != null ? c.rot : 0), cell: c };
      }
    }
    return { x: L.x == null ? 500 : L.x, y: L.y == null ? 500 : L.y, size: L.size || 200, w: L.size || 200, h: L.size || 200, rot: L.rot || 0, cell: null };
  };

  /** Expand tiling into a list of frames. */
  function tileFrames(L, fr, grid) {
    const t = L.tile || { mode: 'none' };
    const n = S.clamp(t.count | 0 || 6, 2, 36);
    const [cx, cy] = grid.center;
    if (t.mode === 'radial') {
      let r = Math.hypot(fr.x - cx, fr.y - cy); if (r < 10) r = t.radius || grid.Ri * 0.62;
      const a0 = Math.atan2(fr.y - cy, fr.x - cx) || -Math.PI / 2;
      return Array.from({ length: n }, (_, i) => { const a = a0 + i * Math.PI * 2 / n; return Object.assign({}, fr, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), rot: fr.rot + (t.orient !== false ? S.deg(a - a0) : 0) }); });
    }
    if (t.mode === 'row') {
      const sp = fr.size * (t.spacing || 1.15);
      return Array.from({ length: n }, (_, i) => Object.assign({}, fr, { x: fr.x + (i - (n - 1) / 2) * sp }));
    }
    if (t.mode === 'column') {
      const sp = fr.size * (t.spacing || 1.15);
      return Array.from({ length: n }, (_, i) => Object.assign({}, fr, { y: fr.y + (i - (n - 1) / 2) * sp }));
    }
    if (t.mode === 'cells') {
      const role = fr.cell ? fr.cell.role : 'cell';
      const cells = grid.cells.filter((c) => c.inside && c.role === role);
      const sc = L.scale == null ? 0.86 : L.scale;
      if (cells.length) return cells.map((c) => Object.assign({}, fr, { x: c.cx, y: c.cy, size: c.fit * sc, w: c.fitW * sc, h: c.fitH * sc, rot: (L.rot || 0) + (L.orient && c.rot != null ? c.rot : 0), cell: c }));
    }
    if (t.mode === 'mirror') {
      return [fr, Object.assign({}, fr, { x: 2 * cx - fr.x, mirrorX: true }), Object.assign({}, fr, { y: 2 * cy - fr.y, mirrorY: true }), Object.assign({}, fr, { x: 2 * cx - fr.x, y: 2 * cy - fr.y, mirrorX: true, mirrorY: true })];
    }
    return [fr];
  }

  /* ---------- the pen handed to symbol / upload drawing ---------- */
  function makePen(b, colors, L, absAngle) {
    const mode = L.stitch || 'auto';
    const st = (prim, o) => {
      if (mode === 'twill') return { type: 'twill' };
      if (prim === 'stroke' || mode === 'satin' || (mode === 'auto' && o && o.satin)) return { type: 'satin', angle: absAngle };
      return { type: 'fill', angle: absAngle };
    };
    return {
      colors,
      fill(d, slot, o = {}) { b.path(d, { fill: colors[slot] || colors[0], rule: o.rule, stitch: st('fill', o) }); },
      stroke(d, slot, w, o = {}) { b.path(d, { stroke: colors[slot] || colors[0], width: w, cap: o.cap, join: o.join, dash: o.dash, stitch: st('stroke', o) }); },
      save: () => b.save(), restore: () => b.restore(), translate: (x, y) => b.translate(x, y),
      rotate: (d) => b.rotate(d), scale: (x, y) => b.scale(x, y), clip: (d, r) => b.clip(d, r),
    };
  }

  function placeAt(b, fr, L, s = 1) {
    b.translate(fr.x, fr.y);
    if (fr.rot) b.rotate(fr.rot);
    const mx = (L.mirror ? -1 : 1) * (fr.mirrorX ? -1 : 1), my = (L.flipV ? -1 : 1) * (fr.mirrorY ? -1 : 1);
    b.scale(mx * s, my * s);
  }

  function box(ctx, L, x, y, w, h, rot) { if (ctx.boxes) (ctx.boxes[L.id] = ctx.boxes[L.id] || []).push({ x, y, w, h, rot: rot || 0 }); }

  /* ---------- layer kinds ---------- */
  const draw = {};

  draw.symbol = function (ctx, L) {
    const sym = S.symbolById(L.symbol);
    const colors = (L.colors || [2, 3, 4]).map(ctx.color);
    const fr0 = S.layerFrame(L, ctx.grid);
    for (const fr of tileFrames(L, fr0, ctx.grid)) {
      ctx.b.save(); placeAt(ctx.b, fr, L, fr.size / 100);
      sym.draw(makePen(ctx.b, colors, L, (L.angle || 0) + fr.rot), L);
      ctx.b.restore();
      box(ctx, L, fr.x, fr.y, fr.size, fr.size, fr.rot);
    }
  };

  draw.upload = function (ctx, L) {
    const a = ctx.state.assets && ctx.state.assets[L.asset];
    if (!a) return;
    const colors = (L.colors || [2, 3, 4]).map(ctx.color);
    const [vx, vy, vw, vh] = a.vb;
    const sorted = a.colors.slice().sort((p, q) => S.luminance(p) - S.luminance(q));
    const threads = S.threadList(ctx.state);
    const mapColor = (c) => {
      if (!c) return null;
      if (L.recolor === 'original') return c;
      if (L.recolor === 'mono') return colors[0];
      if (L.recolor === 'nearest') {
        const [r, g, bl] = S.hexToRgb(c); let best = threads[0], bd = 1e9;
        for (const t of threads) { const [r2, g2, b2] = S.hexToRgb(t); const dd = (r - r2) ** 2 * 0.3 + (g - g2) ** 2 * 0.59 + (bl - b2) ** 2 * 0.11; if (dd < bd) { bd = dd; best = t; } }
        return best;
      }
      const i = sorted.indexOf(c); // 'palette' — rank by value onto the layer's thread slots
      return colors[Math.max(0, i) % colors.length];
    };
    const fr0 = S.layerFrame(L, ctx.grid);
    const s = 100 / Math.max(vw, vh);
    for (const fr of tileFrames(L, fr0, ctx.grid)) {
      const b = ctx.b;
      b.save(); placeAt(b, fr, L, fr.size / 100);
      b.scale(s, s); b.translate(-(vx + vw / 2), -(vy + vh / 2));
      const absAngle = (L.angle || 0) + fr.rot;
      for (const it of a.items) {
        if (it.bg && L.dropBg !== false) continue;
        b.save(); b.transform(...it.m);
        const fill = mapColor(it.fill), stroke = mapColor(it.stroke);
        const fillSt = L.stitch === 'twill' ? { type: 'twill' } : { type: L.stitch === 'satin' ? 'satin' : 'fill', angle: absAngle };
        if (fill) b.path(it.d, { fill, rule: it.rule, opacity: it.op, stitch: fillSt });
        if (stroke && it.sw > 0) b.path(it.d, { stroke, width: it.sw * (L.strokeBoost || 1), cap: it.cap, join: it.join, opacity: it.op, stitch: { type: 'satin', angle: absAngle } });
        b.restore();
      }
      b.restore();
      box(ctx, L, fr.x, fr.y, fr.size * vw / Math.max(vw, vh), fr.size * vh / Math.max(vw, vh), fr.rot);
    }
  };

  function textStyle(ctx, L, size) {
    const cs = L.colors || [2, 0];
    return {
      family: L.font || 'Space Grotesk', weight: L.weight || 700, size, tracking: L.tracking || 0,
      fill: ctx.color(cs[0]),
      outline: L.outline ? ctx.color(cs[1] == null ? 0 : cs[1]) : null,
      outlineWidth: L.outline ? (L.outlineWidth || 6) : 0,
      stitch: { type: 'satin' },
    };
  }

  /** colour of a colour-block directly behind a text layer (for contrast checks) */
  function behind(ctx, L) {
    const want = L.kind === 'arctext' ? 'band' : L.cell;
    if (!want) return null;
    const blk = ctx.state.layers.find((b) => b.kind === 'block' && b.visible !== false && b.cell === want);
    return blk ? ctx.color((blk.colors || [3])[0]) : null;
  }

  draw.text = function (ctx, L) {
    const fr = S.layerFrame(L, ctx.grid);
    const lines = S.layerText(ctx.state, L).split('\n');
    const fam = L.font || 'Space Grotesk', wt = L.weight || 700, cap = S.capRatio(fam, wt);
    const lh = L.leading || 1.3;
    let size = L.fontSize || 60;
    const boxW = fr.cell ? fr.w : (L.boxW || 0), boxH = fr.cell ? fr.h : 0;
    if (L.autoFit !== false && fr.cell) {
      const w1 = Math.max(...lines.map((t) => S.textWidth1(t, fam, wt, L.tracking))) || 1;
      size = Math.min(boxH * 0.64 / (cap * (1 + (lines.length - 1) * lh)), boxW * 0.94 / w1, L.maxSize || 400);
    }
    const st = textStyle(ctx, L, size), capH = cap * size;
    const ax = L.align === 'left' ? -boxW / 2 * 0.94 : L.align === 'right' ? boxW / 2 * 0.94 : 0;
    const totalH = capH + (lines.length - 1) * capH * lh;
    const b = ctx.b; b.save(); placeAt(b, fr, L, 1);
    let maxW = 0;
    lines.forEach((t, i) => {
      const lay = S.layoutLine(t, Object.assign({}, st, { align: L.align || 'center', x: ax, y: -totalH / 2 + capH + i * capH * lh }));
      maxW = Math.max(maxW, lay.width);
      b.glyphs(lay.glyphs, st);
    });
    b.restore();
    box(ctx, L, fr.x, fr.y, Math.max(maxW, boxW * 0.5), Math.max(totalH, 20), fr.rot);
    if (ctx.texts) ctx.texts.push({ id: L.id, capH, size, color: st.fill, on: behind(ctx, L) });
  };

  draw.arctext = function (ctx, L) {
    const band = ctx.grid.bands || ctx.grid.fallbackBand;
    const text = S.layerText(ctx.state, L);
    const fam = L.font || 'Space Grotesk', wt = L.weight || 700, cap = S.capRatio(fam, wt);
    const r = band.rc + (L.offset || 0);
    const span = S.rad(L.span || (L.pos === 'bottom' ? band.spanBottom : band.spanTop));
    let size = L.fontSize || 60;
    if (L.autoFit !== false) {
      const w1 = S.textWidth1(text, fam, wt, L.tracking) || 1;
      size = Math.min(band.h * (L.fill || 0.6) / cap, span * r / w1, L.maxSize || 400);
    }
    const st = textStyle(ctx, L, size);
    const lay = S.layoutArc(text, Object.assign({}, st, { cx: band.cx, cy: band.cy, r, pos: L.pos || 'top' }));
    const b = ctx.b; b.save();
    if (L.rot) { b.translate(band.cx, band.cy); b.rotate(L.rot); b.translate(-band.cx, -band.cy); }
    b.glyphs(lay.glyphs, st);
    b.restore();
    if (lay.glyphs.length) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const g of lay.glyphs) { x0 = Math.min(x0, g.x); y0 = Math.min(y0, g.y); x1 = Math.max(x1, g.x); y1 = Math.max(y1, g.y); }
      const pad = lay.capH * 0.8;
      box(ctx, L, (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0 + pad, y1 - y0 + pad, 0);
    }
    if (ctx.texts) ctx.texts.push({ id: L.id, capH: lay.capH, size, color: st.fill, on: behind(ctx, L) });
  };

  /** Cobb-style semiotic label block: plate + pictogram + system code. */
  draw.label = function (ctx, L) {
    const fr = S.layerFrame(L, ctx.grid);
    const colors = (L.colors || [1, 0, 2]).map(ctx.color);
    const fam = L.font || 'IBM Plex Mono', wt = L.weight || 700;
    let w = fr.cell ? fr.w : fr.size, h = fr.cell ? fr.h : fr.size * 0.42;
    const vertical = h > w * 0.72;
    if (!vertical) h = Math.min(h, w * 0.5); else h = Math.min(h, w * 1.25);
    const b = ctx.b; b.save(); placeAt(b, fr, L, 1);
    const plate = P.rrect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.16);
    b.path(plate, { fill: colors[0], stitch: { type: 'fill', angle: (L.angle || 0) + fr.rot } });
    const sym = L.icon ? S.symbolById(L.icon) : null;
    const text = S.layerText(ctx.state, L);
    const cap = S.capRatio(fam, wt);
    const pen = makePen(b, [colors[0], colors[1], colors[2]], L, (L.angle || 0) + fr.rot);
    let tx, ty, tw, th;
    if (vertical) {
      const is = Math.min(w * 0.62, h * 0.52);
      if (sym) { b.save(); b.translate(0, -h / 2 + h * 0.08 + is / 2); b.scale(is / 100, is / 100); sym.draw(pen, { frame: 'none' }); b.restore(); }
      tx = 0; tw = w * 0.84; th = h * 0.2; ty = sym ? h / 2 - h * 0.1 - th / 2 : 0;
    } else {
      const is = h * 0.74;
      if (sym) { b.save(); b.translate(-w / 2 + h * 0.13 + is / 2, 0); b.scale(is / 100, is / 100); sym.draw(pen, { frame: 'none' }); b.restore(); }
      const x0 = sym ? -w / 2 + h * 0.26 + is : -w / 2 + h * 0.18;
      if (sym) b.path(P.line(x0 - h * 0.07, -h * 0.3, x0 - h * 0.07, h * 0.3), { stroke: colors[1], width: Math.max(2, h * 0.045), cap: 'butt', stitch: { type: 'satin' } });
      tw = w / 2 - h * 0.16 - x0; tx = x0 + tw / 2; th = h * 0.42; ty = 0;
    }
    if (L.stripes) {
      b.save(); b.clip(plate);
      const sx = vertical ? -w / 2 : w / 2 - h * 0.32, sw = vertical ? w : h * 0.32, sy = vertical ? h / 2 - h * 0.12 : -h / 2, shh = vertical ? h * 0.12 : h;
      b.clip(P.rect(sx, sy, sw, shh));
      for (let k = -8; k < 16; k++) { const xx = sx + k * h * 0.12; b.path(P.poly([[xx, sy + shh], [xx + h * 0.06, sy + shh], [xx + h * 0.06 + shh, sy], [xx + shh, sy]]), { fill: colors[2], stitch: { type: 'satin' } }); }
      b.restore();
      if (!vertical) { tw -= h * 0.3; tx -= h * 0.15; }
    }
    if (text) {
      const w1 = S.textWidth1(text, fam, wt, L.tracking == null ? 60 : L.tracking) || 1;
      const size = Math.min(th / cap, tw / w1);
      const st = { family: fam, weight: wt, size, tracking: L.tracking == null ? 60 : L.tracking, fill: colors[1], stitch: { type: 'satin' } };
      const lay = S.layoutLine(text, Object.assign({}, st, { align: 'center', x: tx, y: ty + cap * size / 2 }));
      b.glyphs(lay.glyphs, st);
      if (ctx.texts) ctx.texts.push({ id: L.id, capH: cap * size, size, color: colors[1], on: colors[0] });
    }
    b.restore();
    box(ctx, L, fr.x, fr.y, w, h, fr.rot);
  };

  /** Colour-block a grid cell (Klein-style geometric blocking). */
  draw.block = function (ctx, L) {
    const c = S.resolveCell(ctx.grid, L.cell);
    if (!c) return;
    const color = ctx.color((L.colors || [3])[0]);
    const st = { type: L.stitch === 'twill' ? 'twill' : L.stitch === 'satin' ? 'satin' : 'fill', angle: L.angle || 0 };
    ctx.b.path(c.path, { fill: color, rule: c.rule, stitch: st });
    box(ctx, L, c.x + c.w / 2, c.y + c.h / 2, c.w, c.h, 0);
  };

  draw.motif = function (ctx, L) { S.drawMotif(ctx, L); };

  /* ---------- border ---------- */
  function drawBorder(ctx) {
    const s = ctx.state, o = ctx.outline, bw = +s.borderWidth;
    if (s.keyline && s.keylineWidth > 0) ctx.b.path(o.d, { stroke: ctx.color(s.keylineColor), width: 2 * (bw + +s.keylineWidth), join: 'round', stitch: { type: 'satin' } });
    if (bw > 0) ctx.b.path(o.d, { stroke: ctx.color(s.borderColor), width: 2 * bw, join: 'round', stitch: { type: 'merrow' } });
  }

  /**
   * Render a full patch. opts: { boxes:{} collect hit boxes, texts:[] collect type metrics,
   *   only(layer) filter, noBorder }
   */
  S.renderPatch = function (state, b, opts = {}) {
    const ctx = { state, b, grid: S.buildGrid(state), outline: S.shapeOutline(state), color: S.colorFn(state), boxes: opts.boxes || null, texts: opts.texts || null };
    b.save();
    b.clip(ctx.outline.d);
    b.path(ctx.outline.d, { fill: ctx.color(state.bgColor), stitch: { type: state.bgStitch || 'fill', angle: state.bgAngle || 0, ground: true } });
    for (const L of state.layers) {
      if (L.visible === false || (opts.only && !opts.only(L))) continue;
      const fn = draw[L.kind];
      if (fn) { try { fn(ctx, L); } catch (e) { console.warn('layer render failed', L.kind, e); } }
    }
    if (!opts.noBorder) drawBorder(ctx);
    b.restore();
    return ctx;
  };

  /* ---------- analysis backend: thread usage + type metrics ---------- */
  class CollectBackend {
    constructor() { this.kind = 'collect'; this.colors = new Set(); }
    save() {} restore() {} translate() {} rotate() {} scale() {} transform() {} clip() {}
    path(d, st) { if (st.fill) this.colors.add(st.fill.toLowerCase()); if (st.stroke && st.width > 0) this.colors.add(st.stroke.toLowerCase()); }
    glyphs(l, st) { if (!l.length) return; this.colors.add(st.fill.toLowerCase()); if (st.outline && st.outlineWidth > 0) this.colors.add(st.outline.toLowerCase()); }
  }
  S.analyze = function (state) {
    const cb = new CollectBackend(), texts = [];
    S.renderPatch(state, cb, { texts });
    const bg = S.colorFn(state)(state.bgColor);
    const minCap = texts.length ? Math.min(...texts.map((t) => t.capH)) : null;
    const lowContrast = texts.filter((t) => S.contrast(t.color, t.on || bg) < 2.2);
    return { threads: Array.from(cb.colors), texts, minCapMM: minCap == null ? null : minCap * S.MM_PER_UNIT, lowContrast };
  };
})(window.SSEP = window.SSEP || {});
