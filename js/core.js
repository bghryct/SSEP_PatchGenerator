/* ==========================================================================
   SSEP Mission Patch Design Studio — core utilities
   Namespace: window.SSEP (classic scripts so the app also runs from file://)
   Design space: 1000 × 1000 units  =  3.5″ × 3.5″  (≈ 285.7 units / inch)
   ========================================================================== */
(function (S) {
  'use strict';

  S.VERSION = '1.0.0';
  S.UNITS = 1000;
  S.INCHES = 3.5;
  S.UNITS_PER_IN = S.UNITS / S.INCHES;
  S.MM_PER_UNIT = (S.INCHES * 25.4) / S.UNITS;
  S.UI_SANS = 'Spline Sans';
  S.UI_MONO = 'Spline Sans Mono';

  /* ---------- seeded randomness (mulberry32) ---------- */
  S.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  S.R = {
    pick: (r, arr) => arr[Math.floor(r() * arr.length)],
    int: (r, a, b) => a + Math.floor(r() * (b - a + 1)),
    range: (r, a, b) => a + r() * (b - a),
    chance: (r, p) => r() < p,
    weighted(r, pairs) {
      let t = 0; for (const p of pairs) t += p[1];
      let x = r() * t;
      for (const p of pairs) { x -= p[1]; if (x <= 0) return p[0]; }
      return pairs[pairs.length - 1][0];
    },
    shuffle(r, arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
  };
  S.newSeed = () => Math.floor(Math.random() * 899999999) + 100000000;
  S.uid = (p = 'l') => p + '_' + Math.random().toString(36).slice(2, 8);

  /* ---------- math ---------- */
  S.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  S.lerp = (a, b, t) => a + (b - a) * t;
  S.rad = (d) => d * Math.PI / 180;
  S.deg = (r) => r * 180 / Math.PI;
  S.f = (n) => String(+(+n).toFixed(2));
  S.deepClone = (o) => JSON.parse(JSON.stringify(o));
  S.fmt = (n, d = 2) => (+n).toFixed(d);

  /* ---------- colour ---------- */
  S.hexToRgb = function (hex) {
    let h = String(hex || '#000').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  S.rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => S.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  S.luminance = function (hex) {
    const c = S.hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  S.contrast = function (a, b) {
    const la = S.luminance(a), lb = S.luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  S.mixHex = function (a, b, t) {
    const A = S.hexToRgb(a), B = S.hexToRgb(b);
    return S.rgbToHex(S.lerp(A[0], B[0], t), S.lerp(A[1], B[1], t), S.lerp(A[2], B[2], t));
  };
  const _cc = document.createElement('canvas').getContext('2d');
  /** Normalise any CSS colour to #rrggbb (or null for none/transparent). */
  S.normColor = function (c) {
    if (!c) return null;
    c = String(c).trim();
    if (c === 'none' || c === 'transparent') return null;
    _cc.fillStyle = '#000001';
    _cc.fillStyle = c;
    const v = _cc.fillStyle;
    if (v === '#000001' && c.toLowerCase() !== '#000001') return null;
    if (v[0] === '#') return v;
    const m = v.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(parseFloat);
    if (p.length > 3 && p[3] === 0) return null;
    return S.rgbToHex(p[0], p[1], p[2]);
  };

  /* ---------- path building (SVG path data, shared by every backend) ---------- */
  const f = S.f;
  class Path {
    constructor() { this.parts = []; this.subs = []; this.cur = null; this.sub = null; }
    moveTo(x, y) { this.parts.push(`M${f(x)} ${f(y)}`); this.cur = [x, y]; this.sub = [[x, y]]; this.subs.push(this.sub); return this; }
    lineTo(x, y) {
      if (!this.cur) return this.moveTo(x, y);
      this.parts.push(`L${f(x)} ${f(y)}`); this.cur = [x, y]; this.sub.push([x, y]); return this;
    }
    /** canvas-style arc; angles in radians, positive = clockwise on screen (y down) */
    arc(cx, cy, r, a0, a1) {
      const sx = cx + r * Math.cos(a0), sy = cy + r * Math.sin(a0);
      if (!this.cur) this.moveTo(sx, sy);
      else if (Math.hypot(this.cur[0] - sx, this.cur[1] - sy) > 0.01) this.lineTo(sx, sy);
      const sweep = a1 - a0;
      const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
      const flag = sweep > 0 ? 1 : 0;
      for (let i = 1; i <= n; i++) {
        const a = a0 + sweep * i / n;
        this.parts.push(`A${f(r)} ${f(r)} 0 0 ${flag} ${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`);
      }
      const steps = Math.max(2, Math.ceil(Math.abs(sweep) / S.rad(3)));
      for (let i = 1; i <= steps; i++) {
        const a = a0 + sweep * i / steps;
        this.sub.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      this.cur = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
      return this;
    }
    quadTo(qx, qy, x, y) {
      const [x0, y0] = this.cur;
      this.parts.push(`Q${f(qx)} ${f(qy)} ${f(x)} ${f(y)}`);
      for (let i = 1; i <= 12; i++) {
        const t = i / 12, u = 1 - t;
        this.sub.push([u * u * x0 + 2 * u * t * qx + t * t * x, u * u * y0 + 2 * u * t * qy + t * t * y]);
      }
      this.cur = [x, y]; return this;
    }
    cubicTo(c1x, c1y, c2x, c2y, x, y) {
      const [x0, y0] = this.cur;
      this.parts.push(`C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(x)} ${f(y)}`);
      for (let i = 1; i <= 20; i++) {
        const t = i / 20, u = 1 - t;
        this.sub.push([
          u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x,
          u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y,
        ]);
      }
      this.cur = [x, y]; return this;
    }
    close() { this.parts.push('Z'); this.cur = null; return this; }
    get d() { return this.parts.join(''); }
  }
  S.Path = Path;

  /** Primitive shape → path-data helpers. Coordinates in whatever space the caller uses. */
  S.P = {
    circle(cx, cy, r) {
      return `M${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)}Z`;
    },
    ellipse(cx, cy, rx, ry, rotDeg = 0) {
      const a = S.rad(rotDeg), c = Math.cos(a), s = Math.sin(a);
      const sx = cx - rx * c, sy = cy - rx * s, ex = cx + rx * c, ey = cy + rx * s;
      return `M${f(sx)} ${f(sy)}A${f(rx)} ${f(ry)} ${f(rotDeg)} 1 0 ${f(ex)} ${f(ey)}A${f(rx)} ${f(ry)} ${f(rotDeg)} 1 0 ${f(sx)} ${f(sy)}Z`;
    },
    rect(x, y, w, h) { return `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}Z`; },
    rrect(x, y, w, h, r) {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      if (r < 0.01) return S.P.rect(x, y, w, h);
      return `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`;
    },
    poly(pts, close = true) { return pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join('') + (close ? 'Z' : ''); },
    line(x1, y1, x2, y2) { return `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`; },
    arc(cx, cy, r, a0, a1) { return new Path().arc(cx, cy, r, a0, a1).d; },
    regPolyPts(cx, cy, r, n, rotDeg = 0) {
      const pts = [];
      for (let i = 0; i < n; i++) { const a = S.rad(rotDeg) + i * Math.PI * 2 / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      return pts;
    },
    regPoly(cx, cy, r, n, rotDeg = 0) { return S.P.poly(S.P.regPolyPts(cx, cy, r, n, rotDeg)); },
    star(cx, cy, ro, ri, n, rotDeg = -90) {
      const pts = [];
      for (let i = 0; i < n * 2; i++) {
        const a = S.rad(rotDeg) + i * Math.PI / n, r = i % 2 ? ri : ro;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      return S.P.poly(pts);
    },
    /** donut — use with fill-rule evenodd */
    ring(cx, cy, r0, r1) { return S.P.circle(cx, cy, r1) + S.P.circle(cx, cy, r0); },
    /** annular sector, angles in radians (screen, clockwise) */
    sector(cx, cy, r0, r1, a0, a1) {
      const p = new Path().arc(cx, cy, r1, a0, a1);
      if (r0 > 0.5) p.arc(cx, cy, r0, a1, a0); else p.lineTo(cx, cy);
      return p.close().d;
    },
    /** polygon with rounded corners (quadratic corner fillets) */
    roundPoly(pts, r, path) {
      const p = path || new Path(), n = pts.length;
      if (r < 0.5) { pts.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); return p.close(); }
      for (let i = 0; i < n; i++) {
        const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
        const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
        const rr = Math.min(r, l1 / 2, l2 / 2);
        const p1 = [b[0] + (a[0] - b[0]) * rr / l1, b[1] + (a[1] - b[1]) * rr / l1];
        const p2 = [b[0] + (c[0] - b[0]) * rr / l2, b[1] + (c[1] - b[1]) * rr / l2];
        if (i === 0) p.moveTo(p1[0], p1[1]); else p.lineTo(p1[0], p1[1]);
        p.quadTo(b[0], b[1], p2[0], p2[1]);
      }
      return p.close();
    },
  };

  /* ---------- DOM helpers ---------- */
  S.$ = (sel, root = document) => root.querySelector(sel);
  S.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  S.el = function (tag, props, ...kids) {
    const n = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null) continue;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
        else if (k === 'on') for (const e in v) n.addEventListener(e, v[e]);
        else if (k in n && typeof v !== 'string') n[k] = v;
        else n.setAttribute(k, v);
      }
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  };
  S.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- events & timing ---------- */
  const handlers = {};
  S.bus = {
    on(e, fn) { (handlers[e] = handlers[e] || []).push(fn); return () => S.bus.off(e, fn); },
    off(e, fn) { handlers[e] = (handlers[e] || []).filter((h) => h !== fn); },
    emit(e, d) { (handlers[e] || []).slice().forEach((h) => { try { h(d); } catch (err) { console.error(err); } }); },
  };
  S.debounce = function (fn, ms) {
    let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  };
  S.rafOnce = function (fn) {
    let queued = false;
    return function () { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; fn(); }); };
  };
  S.toast = function (msg, kind = 'info') {
    const host = S.$('#toasts'); if (!host) return;
    const t = S.el('div', { class: 'toast toast-' + kind, text: msg });
    host.append(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3200);
  };

  /* ---------- storage ---------- */
  S.store_get = function (k, fallback) {
    try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  };
  S.store_set = function (k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  };

  /* ---------- files ---------- */
  S.download = function (blob, name) {
    const url = URL.createObjectURL(blob);
    const a = S.el('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  S.canvasToBlob = (cv, type = 'image/png', q) => new Promise((res) => cv.toBlob(res, type, q));
  S.slug = (s) => String(s || 'patch').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'patch';

  /* PNG pHYs chunk so exported files carry their true 3.5″ print size */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  S.crc32 = crc32;
  S.pngSetDPI = async function (blob, dpi) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const dv = new DataView(buf.buffer);
    const ppm = Math.round(dpi / 0.0254);
    const chunk = new Uint8Array(21), cv = new DataView(chunk.buffer);
    cv.setUint32(0, 9); chunk.set([0x70, 0x48, 0x59, 0x73], 4);
    cv.setUint32(8, ppm); cv.setUint32(12, ppm); chunk[16] = 1;
    cv.setUint32(17, crc32(chunk.subarray(4, 17)));
    // strip any existing pHYs, insert ours after IHDR
    const parts = [buf.subarray(0, 8)];
    let off = 8;
    while (off < buf.length) {
      const len = dv.getUint32(off), type = String.fromCharCode(...buf.subarray(off + 4, off + 8));
      const end = off + 12 + len;
      if (type !== 'pHYs') parts.push(buf.subarray(off, end));
      if (type === 'IHDR') parts.push(chunk);
      off = end;
    }
    return new Blob(parts, { type: 'image/png' });
  };
  S.readFileText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });
})(window.SSEP = window.SSEP || {});
