/* ==========================================================================
   Drawing backends + text layout
   The patch renderer draws once against a tiny API; backends translate it to
   Canvas 2D (screen / PNG), SVG markup (vector export) or stitch maps (3D).
     save restore translate rotate(deg) scale clip(d, rule)
     path(d, style)        style: fill stroke width cap join dash rule opacity stitch
     glyphs(list, style)   list: [{ch, x, y, rot(rad)}]  style: family weight size fill outline outlineWidth stitch
   ========================================================================== */
(function (S) {
  'use strict';

  /* ---------------- text measurement & layout ---------------- */
  const mctx = document.createElement('canvas').getContext('2d');
  const wCache = new Map(), capCache = new Map();
  S.fontCSS = (family, weight, size) => `${weight} ${size}px "${family}", "Helvetica Neue", Arial, sans-serif`;

  function width100(family, weight, str) {
    const k = family + '|' + weight + '|' + str;
    let v = wCache.get(k);
    if (v == null) {
      mctx.font = S.fontCSS(family, weight, 100);
      v = mctx.measureText(str).width;
      wCache.set(k, v);
      if (wCache.size > 6000) wCache.clear();
    }
    return v;
  }
  /** cap height as a fraction of font size */
  S.capRatio = function (family, weight) {
    const k = family + '|' + weight;
    let v = capCache.get(k);
    if (v == null) {
      mctx.font = S.fontCSS(family, weight, 100);
      const m = mctx.measureText('H');
      v = m.actualBoundingBoxAscent ? m.actualBoundingBoxAscent / 100 : 0.7;
      capCache.set(k, v);
    }
    return v;
  };
  S.clearTextCaches = () => { wCache.clear(); capCache.clear(); };

  /** Glyph centres along a straight baseline, kerning-aware (prefix widths) + tracking. */
  S.layoutLine = function (text, o) {
    const chars = Array.from(text || '');
    const k = o.size / 100, t = (o.tracking || 0) / 1000 * o.size;
    const pre = [0];
    for (let i = 1; i <= chars.length; i++) pre.push(width100(o.family, o.weight, chars.slice(0, i).join('')) * k);
    const W = pre[chars.length] + Math.max(0, chars.length - 1) * t;
    const x0 = o.align === 'left' ? o.x : o.align === 'right' ? o.x - W : o.x - W / 2;
    const glyphs = chars.map((ch, i) => ({ ch, x: x0 + (pre[i] + pre[i + 1]) / 2 + i * t, y: o.y, rot: 0 }));
    return { glyphs, width: W, capH: S.capRatio(o.family, o.weight) * o.size };
  };
  /** width of a string at size 1 (used for auto-fit) */
  S.textWidth1 = function (text, family, weight, tracking) {
    const n = Array.from(text || '').length;
    return width100(family, weight, text || '') / 100 + Math.max(0, n - 1) * (tracking || 0) / 1000;
  };

  /** Glyphs around a circle. pos 'top' reads clockwise over the top, 'bottom' reads left→right under. */
  S.layoutArc = function (text, o) {
    const line = S.layoutLine(text, Object.assign({}, o, { x: 0, y: 0, align: 'center' }));
    const capH = line.capH, r = o.r;
    const rb = o.pos === 'bottom' ? r + capH / 2 : r - capH / 2;
    const glyphs = line.glyphs.map((g) => {
      const s = g.x;
      if (o.pos === 'bottom') {
        const th = Math.PI / 2 - s / r;
        return { ch: g.ch, x: o.cx + rb * Math.cos(th), y: o.cy + rb * Math.sin(th), rot: th - Math.PI / 2 };
      }
      const th = -Math.PI / 2 + s / r;
      return { ch: g.ch, x: o.cx + rb * Math.cos(th), y: o.cy + rb * Math.sin(th), rot: th + Math.PI / 2 };
    });
    return { glyphs, width: line.width, capH, spanDeg: S.deg(line.width / r) };
  };

  /* ---------------- Canvas 2D backend ---------------- */
  class CanvasBackend {
    constructor(ctx, px, opts = {}) {
      this.kind = 'canvas';
      this.ctx = ctx; this.px = px; this.k = px / 1000;
      ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      this.opts = opts;
    }
    save() { this.ctx.save(); }
    restore() { this.ctx.restore(); }
    translate(x, y) { this.ctx.translate(x, y); }
    rotate(deg) { this.ctx.rotate(S.rad(deg)); }
    scale(x, y) { this.ctx.scale(x, y); }
    transform(a, b, c, d, e, f) { this.ctx.transform(a, b, c, d, e, f); }
    clip(d, rule) { this.ctx.clip(new Path2D(d), rule || 'nonzero'); }
    path(d, st) {
      const c = this.ctx, p = new Path2D(d);
      c.globalAlpha = st.opacity == null ? 1 : st.opacity;
      if (st.fill) { c.fillStyle = st.fill; c.fill(p, st.rule || 'nonzero'); }
      if (st.stroke && st.width > 0) {
        c.strokeStyle = st.stroke; c.lineWidth = st.width;
        c.lineCap = st.cap || 'round'; c.lineJoin = st.join || 'round'; c.miterLimit = 6;
        c.setLineDash(st.dash || []);
        c.stroke(p);
        c.setLineDash([]);
      }
      c.globalAlpha = 1;
    }
    glyphs(list, st) {
      const c = this.ctx;
      c.font = S.fontCSS(st.family, st.weight, st.size);
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      const each = (fn) => { for (const g of list) { c.save(); c.translate(g.x, g.y); if (g.rot) c.rotate(g.rot); fn(g.ch); c.restore(); } };
      if (st.outline && st.outlineWidth > 0) {
        c.strokeStyle = st.outline; c.lineWidth = st.outlineWidth * 2; c.lineJoin = 'round';
        each((ch) => c.strokeText(ch, 0, 0));
      }
      c.fillStyle = st.fill;
      each((ch) => c.fillText(ch, 0, 0));
    }
  }
  S.CanvasBackend = CanvasBackend;

  /* ---------------- SVG backend ---------------- */
  const num = S.f;
  class SVGBackend {
    constructor() {
      this.kind = 'svg';
      this.m = new DOMMatrix(); this.stack = []; this.out = []; this.defs = []; this.n = 0; this.open = 0;
      this.fonts = new Map(); // "family|weight" -> Set(chars)
    }
    save() { this.stack.push({ m: this.m, open: this.open }); this.open = 0; }
    restore() { while (this.open > 0) { this.out.push('</g>'); this.open--; } const s = this.stack.pop(); if (s) { this.m = s.m; this.open = s.open; } }
    translate(x, y) { this.m = this.m.translate(x, y); }
    rotate(deg) { this.m = this.m.rotate(deg); }
    scale(x, y) { this.m = this.m.scale(x, y); }
    transform(a, b, c, d, e, f) { this.m = this.m.multiply(new DOMMatrix([a, b, c, d, e, f])); }
    tf(m = this.m) { return m.isIdentity ? '' : ` transform="matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map((v) => +v.toFixed(4)).join(' ')})"`; }
    clip(d, rule) {
      const id = (this.idp || 'c') + (++this.n);
      this.defs.push(`<clipPath id="${id}"><path d="${d}"${this.tf()}${rule === 'evenodd' ? ' clip-rule="evenodd"' : ''}/></clipPath>`);
      this.out.push(`<g clip-path="url(#${id})">`); this.open++;
    }
    path(d, st) {
      let a = ` fill="${st.fill || 'none'}"`;
      if (st.fill && st.rule === 'evenodd') a += ' fill-rule="evenodd"';
      if (st.stroke && st.width > 0) {
        a += ` stroke="${st.stroke}" stroke-width="${num(st.width)}" stroke-linecap="${st.cap || 'round'}" stroke-linejoin="${st.join || 'round'}"`;
        if (st.dash && st.dash.length) a += ` stroke-dasharray="${st.dash.map(num).join(' ')}"`;
      }
      if (st.opacity != null && st.opacity < 1) a += ` opacity="${num(st.opacity)}"`;
      if (st.stitch) a += ` data-stitch="${st.stitch.type}${st.stitch.angle != null ? ' ' + Math.round(st.stitch.angle) : ''}"`;
      this.out.push(`<path d="${d}"${a}${this.tf()}/>`);
    }
    glyphs(list, st) {
      const key = st.family + '|' + st.weight;
      if (!this.fonts.has(key)) this.fonts.set(key, new Set());
      const set = this.fonts.get(key);
      const base = `font-family="'${S.esc(st.family)}', sans-serif" font-weight="${st.weight}" font-size="${num(st.size)}" text-anchor="middle"`;
      const emit = (extra) => {
        for (const g of list) {
          set.add(g.ch);
          const m = this.m.translate(g.x, g.y).rotate(S.deg(g.rot || 0));
          this.out.push(`<text ${base}${extra}${this.tf(m)}>${S.esc(g.ch)}</text>`);
        }
      };
      this.out.push(`<g data-stitch="satin">`);
      if (st.outline && st.outlineWidth > 0) emit(` fill="${st.outline}" stroke="${st.outline}" stroke-width="${num(st.outlineWidth * 2)}" stroke-linejoin="round"`);
      emit(` fill="${st.fill}"`);
      this.out.push('</g>');
    }
    toString(opts = {}) {
      while (this.open > 0) { this.out.push('</g>'); this.open--; }
      const style = opts.fontCSS ? `<style>${opts.fontCSS}</style>` : '';
      const meta = opts.title ? `<title>${S.esc(opts.title)}</title><desc>${S.esc(opts.desc || '')}</desc>` : '';
      return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="3.5in" height="3.5in" viewBox="0 0 1000 1000">${meta}<defs>${style}${this.defs.join('')}</defs>\n${this.out.join('\n')}\n</svg>\n`;
    }
  }
  S.SVGBackend = SVGBackend;
})(window.SSEP = window.SSEP || {});
