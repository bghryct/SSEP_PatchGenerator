/* ==========================================================================
   Procedural embroidery texture synthesis
   The patch is rendered a second time through a StitchBackend that paints a
   HEIGHT field (and a ROUGHNESS field) instead of colour:
     tatami fill  → staggered brick rows at the layer's stitch angle
     satin        → dashed strokes = parallel threads across the column
     merrow edge  → coarse dashed roll around the silhouette
     twill        → diagonal 2/1 weave where no thread covers the ground
   Post-processing derives NORMAL, ANISOTROPY (structure tensor → thread
   direction) and a cavity-shaded COLOUR map for Three.js.
   ========================================================================== */
(function (S) {
  'use strict';

  const gray = (v) => { const c = S.clamp(Math.round(v * 255), 0, 255); return `rgb(${c},${c},${c})`; };
  const mk = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  const PITCH = { satin: 4.6, merrow: 9, tatamiRow: 5.2, tatamiLen: 38, twill: 7 }; // design units (1u ≈ 0.089 mm)

  function tatamiTile(k) {
    const rh = Math.max(3, PITCH.tatamiRow * k), L = Math.max(12, PITCH.tatamiLen * k);
    const W = Math.round(L), H = Math.round(rh * 3), c = mk(W, H), x = c.getContext('2d');
    const img = x.createImageData(W, H), d = img.data;
    const gap = Math.max(1, 1.1 * k);
    for (let y = 0; y < H; y++) {
      const row = Math.floor(y / (H / 3)), fy = (y % (H / 3)) / (H / 3);
      const ridge = Math.sin(Math.PI * S.clamp(fy, 0, 1));
      const off = row * W / 3;
      for (let px = 0; px < W; px++) {
        const u = ((px + off) % W);
        const end = Math.min(u, W - u) < gap ? 0.35 : 1;
        const bulge = 0.85 + 0.15 * Math.sin(Math.PI * u / W);
        const v = 0.3 + 0.24 * ridge * end * bulge;
        const i = (y * W + px) * 4; d[i] = d[i + 1] = d[i + 2] = v * 255; d[i + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  function twillTile(k) {
    const p = Math.max(4, Math.round(PITCH.twill * k)), W = p * 2, c = mk(W, W), x = c.getContext('2d');
    const img = x.createImageData(W, W), d = img.data;
    for (let y = 0; y < W; y++) for (let px = 0; px < W; px++) {
      const a = ((px + y) % p) / p, b = ((px - y + W * 4) % W) / W;
      const v = 0.08 + 0.1 * (0.5 + 0.5 * Math.cos(Math.PI * 2 * a)) * (0.7 + 0.3 * Math.cos(Math.PI * 2 * b));
      const i = (y * W + px) * 4; d[i] = d[i + 1] = d[i + 2] = v * 255; d[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  class StitchBackend {
    constructor(size) {
      this.kind = 'stitch'; this.size = size; this.k = size / 1000;
      this.H = mk(size); this.R = mk(size); this.T = mk(size);
      this.h = this.H.getContext('2d'); this.r = this.R.getContext('2d'); this.t = this.T.getContext('2d');
      this.r.fillStyle = gray(0.95); this.r.fillRect(0, 0, size, size);
      for (const c of [this.h, this.r]) { c.setTransform(this.k, 0, 0, this.k, 0, 0); c.lineCap = 'round'; c.lineJoin = 'round'; }
      this.tat = this.h.createPattern(tatamiTile(this.k), 'repeat');
      this.tw = this.h.createPattern(twillTile(this.k), 'repeat');
    }
    both(fn) { fn(this.h); fn(this.r); }
    save() { this.both((c) => c.save()); }
    restore() { this.both((c) => c.restore()); }
    translate(x, y) { this.both((c) => c.translate(x, y)); }
    rotate(d) { this.both((c) => c.rotate(S.rad(d))); }
    scale(x, y) { this.both((c) => c.scale(x, y)); }
    transform(a, b, c2, d, e, f) { this.both((c) => c.transform(a, b, c2, d, e, f)); }
    clip(d, rule) { const p = new Path2D(d); this.both((c) => c.clip(p, rule || 'nonzero')); }
    sT(ctx = this.h) { const m = ctx.getTransform(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; }
    pattern(pat, angle) { pat.setTransform(this.h.getTransform().inverse().multiply(new DOMMatrix().rotate(angle || 0))); return pat; }

    path(d, st) {
      const p = new Path2D(d);
      const t = (st.stitch && st.stitch.type) || (st.stroke ? 'satin' : 'fill');
      if (st.fill) this.fillShape(p, st, t === 'merrow' ? 'satin' : t);
      if (st.stroke && st.width > 0) this.strokeShape(p, st, t === 'twill' ? 'twill' : t === 'merrow' ? 'merrow' : 'satin');
    }

    fillShape(p, st, type) {
      const h = this.h, rule = st.rule || 'nonzero', s = this.sT();
      if (type === 'twill') {
        h.fillStyle = this.pattern(this.tw, 0); h.fill(p, rule);
        this.r.fillStyle = gray(0.93); this.r.fill(p, rule); return;
      }
      if (type === 'satin') {
        const pp = PITCH.satin * this.k / s, W = 30 * this.k / s;
        h.save(); h.clip(p, rule);
        h.fillStyle = gray(0.5); h.fill(p, rule);
        h.setLineDash([pp * 0.74, pp * 0.26]); h.lineCap = 'butt';
        h.lineWidth = W; h.strokeStyle = gray(0.8); h.stroke(p);
        h.lineWidth = W * 0.26; h.strokeStyle = gray(0.6); h.stroke(p);
        h.setLineDash([]); h.restore();
        this.r.fillStyle = gray(0.42); this.r.fill(p, rule); return;
      }
      h.fillStyle = this.pattern(this.tat, (st.stitch && st.stitch.angle) || 0); h.fill(p, rule);
      if (!(st.stitch && st.stitch.ground)) { h.lineWidth = 1.4 * this.k / s; h.strokeStyle = gray(0.18); h.setLineDash([]); h.stroke(p); }
      this.r.fillStyle = gray(0.6); this.r.fill(p, rule);
    }

    strokeShape(p, st, type) {
      const h = this.h, s = this.sT(), lw = st.width;
      h.lineJoin = st.join || 'round';
      if (type === 'twill') { h.lineWidth = lw; h.strokeStyle = this.pattern(this.tw, 0); h.stroke(p); return; }
      if (type === 'merrow') {
        const pm = PITCH.merrow * this.k / s;
        h.setLineDash([]); h.lineCap = 'butt';
        h.lineWidth = lw + 3.2 * this.k / s; h.strokeStyle = gray(0.12); h.stroke(p);
        h.lineWidth = lw; h.strokeStyle = gray(0.55); h.stroke(p);
        h.setLineDash([pm * 0.66, pm * 0.34]); h.strokeStyle = gray(0.8); h.stroke(p);
        h.lineWidth = lw * 0.55; h.setLineDash([pm * 0.46, pm * 0.54]); h.lineDashOffset = -pm * 0.1; h.strokeStyle = gray(0.96); h.stroke(p);
        h.lineDashOffset = 0; h.setLineDash([]);
        this.r.lineWidth = lw; this.r.strokeStyle = gray(0.48); this.r.stroke(p); return;
      }
      const pp = PITCH.satin * this.k / s;
      h.lineCap = st.cap || 'round';
      h.setLineDash([]); h.lineWidth = lw; h.strokeStyle = gray(0.46); h.stroke(p);
      if (lw * s > 2.5) {
        h.lineCap = 'butt';
        h.setLineDash([pp * 0.78, pp * 0.22]); h.strokeStyle = gray(0.68); h.stroke(p);
        h.setLineDash([pp * 0.45, pp * 0.55]); h.lineDashOffset = -pp * 0.165; h.strokeStyle = gray(0.8); h.stroke(p);
        h.lineWidth = lw * 0.5; h.strokeStyle = gray(0.9); h.stroke(p);
        h.lineDashOffset = 0; h.setLineDash([]);
      }
      this.r.lineCap = st.cap || 'round'; this.r.lineWidth = lw; this.r.strokeStyle = gray(0.44); this.r.stroke(p);
    }

    glyphs(list, st) {
      const t = this.t, S0 = this.size;
      t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, S0, S0);
      t.setTransform(this.h.getTransform());
      t.font = S.fontCSS(st.family, st.weight, st.size); t.textAlign = 'center'; t.textBaseline = 'alphabetic';
      const each = (ctx, fn) => { for (const g of list) { ctx.save(); ctx.translate(g.x, g.y); if (g.rot) ctx.rotate(g.rot); fn(ctx, g.ch); ctx.restore(); } };
      const ow = st.outline && st.outlineWidth > 0 ? st.outlineWidth * 2 : 0;
      t.lineJoin = 'round'; t.setLineDash([]);
      if (ow) { t.lineWidth = ow; t.strokeStyle = gray(0.5); each(t, (c, ch) => c.strokeText(ch, 0, 0)); }
      t.fillStyle = gray(0.52); each(t, (c, ch) => c.fillText(ch, 0, 0));
      t.globalCompositeOperation = 'source-atop';
      const pp = PITCH.satin * this.k / this.sT(t);
      t.lineCap = 'butt'; t.setLineDash([pp * 0.74, pp * 0.26]);
      if (ow) { t.lineWidth = ow + st.size * 0.1; t.strokeStyle = gray(0.7); each(t, (c, ch) => c.strokeText(ch, 0, 0)); }
      t.lineWidth = st.size * 0.17; t.strokeStyle = gray(0.84); each(t, (c, ch) => c.strokeText(ch, 0, 0));
      t.lineWidth = st.size * 0.045; t.strokeStyle = gray(0.62); each(t, (c, ch) => c.strokeText(ch, 0, 0));
      t.setLineDash([]); t.globalCompositeOperation = 'source-over';
      this.h.save(); this.h.setTransform(1, 0, 0, 1, 0, 0); this.h.drawImage(this.T, 0, 0); this.h.restore();
      const r = this.r; r.font = t.font; r.textAlign = 'center'; r.textBaseline = 'alphabetic';
      if (ow) { r.lineWidth = ow; r.strokeStyle = gray(0.45); each(r, (c, ch) => c.strokeText(ch, 0, 0)); }
      r.fillStyle = gray(0.42); each(r, (c, ch) => c.fillText(ch, 0, 0));
    }
  }
  S.StitchBackend = StitchBackend;

  /* ---------- float-field helpers ---------- */
  function boxBlur(src, w, h, rad) {
    if (rad < 1) return src.slice();
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * rad + 1;
    for (let y = 0; y < h; y++) {
      const o = y * w; let acc = 0;
      for (let x = -rad; x <= rad; x++) acc += src[o + S.clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        tmp[o + x] = acc / n;
        acc += src[o + Math.min(w - 1, x + rad + 1)] - src[o + Math.max(0, x - rad)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -rad; y <= rad; y++) acc += tmp[S.clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc / n;
        acc += tmp[Math.min(h - 1, y + rad + 1) * w + x] - tmp[Math.max(0, y - rad) * w + x];
      }
    }
    return out;
  }

  /** Height → normal-map RGB (OpenGL / +Y up after texture flipY). */
  function normalsFrom(H, w, h, strength, out) {
    for (let y = 0; y < h; y++) {
      const ym = Math.max(0, y - 1) * w, y0 = y * w, yp = Math.min(h - 1, y + 1) * w;
      for (let x = 0; x < w; x++) {
        const xm = Math.max(0, x - 1), xp = Math.min(w - 1, x + 1);
        const dx = (H[ym + xp] + 2 * H[y0 + xp] + H[yp + xp] - H[ym + xm] - 2 * H[y0 + xm] - H[yp + xm]) / 8;
        const dy = (H[yp + xm] + 2 * H[yp + x] + H[yp + xp] - H[ym + xm] - 2 * H[ym + x] - H[ym + xp]) / 8;
        let nx = -dx * strength, ny = dy * strength, nz = 1;
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        const i = (y0 + x) * 4;
        out[i] = (nx * 0.5 + 0.5) * 255; out[i + 1] = (ny * 0.5 + 0.5) * 255; out[i + 2] = (nz * 0.5 + 0.5) * 255; out[i + 3] = 255;
      }
    }
  }

  S.Embroidery = {
    PITCH,
    /**
     * Build every map for the 3D viewer.
     * @returns {{size, color, height, normal, rough, aniso}} canvases
     */
    synthesize(state, size = 1024, opts = {}) {
      const t0 = performance.now();
      const relief = opts.relief == null ? 1 : opts.relief;
      const colorC = mk(size);
      S.renderPatch(state, new S.CanvasBackend(colorC.getContext('2d'), size));
      const sb = new StitchBackend(size);
      S.renderPatch(state, sb);

      const w = size, h = size, N = w * h, sc = size / 1024;
      const hctx = sb.H.getContext('2d'), hd = hctx.getImageData(0, 0, w, h).data;
      const rand = S.rng(9001);
      const H0 = new Float32Array(N);
      for (let i = 0; i < N; i++) H0[i] = hd[i * 4] / 255 + (rand() - 0.5) * 0.035;
      const H = boxBlur(H0, w, h, Math.max(1, Math.round(0.6 * sc)));

      const nC = mk(size), nI = nC.getContext('2d').createImageData(w, h);
      normalsFrom(H, w, h, 9 * relief * sc, nI.data);
      nC.getContext('2d').putImageData(nI, 0, 0);

      // structure tensor → thread direction (perpendicular to height gradient)
      const Jxx = new Float32Array(N), Jxy = new Float32Array(N), Jyy = new Float32Array(N);
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x, gx = (H[i + 1] - H[i - 1]) * 0.5, gy = (H[i + w] - H[i - w]) * 0.5;
        Jxx[i] = gx * gx; Jxy[i] = gx * gy; Jyy[i] = gy * gy;
      }
      const br = Math.max(1, Math.round(2 * sc));
      const Bxx = boxBlur(Jxx, w, h, br), Bxy = boxBlur(Jxy, w, h, br), Byy = boxBlur(Jyy, w, h, br);
      const Hb = boxBlur(H, w, h, Math.max(2, Math.round(3 * sc)));

      const aC = mk(size), aI = aC.getContext('2d').createImageData(w, h), ad = aI.data;
      const rC = mk(size), rctx = sb.R.getContext('2d'), rd = rctx.getImageData(0, 0, w, h).data;
      const rI = rC.getContext('2d').createImageData(w, h), ro = rI.data;
      const cctx = colorC.getContext('2d'), cI = cctx.getImageData(0, 0, w, h), cd = cI.data;
      for (let i = 0; i < N; i++) {
        const a = Bxx[i] - Byy[i], b = 2 * Bxy[i], tr = Bxx[i] + Byy[i] + 1e-7;
        const coh = Math.sqrt(a * a + b * b) / tr;
        const phi = 0.5 * Math.atan2(b, a) + Math.PI / 2; // canvas-space thread angle
        let tx = Math.cos(phi), ty = -Math.sin(phi);
        if (ty < 0) { tx = -tx; ty = -ty; }
        const j = i * 4, rough = rd[j] / 255;
        const strength = S.clamp(coh * 1.3, 0, 1) * (rough < 0.5 ? 1 : rough < 0.8 ? 0.7 : 0.35);
        ad[j] = (tx * 0.5 + 0.5) * 255; ad[j + 1] = (ty * 0.5 + 0.5) * 255; ad[j + 2] = strength * 255; ad[j + 3] = 255;
        const rv = S.clamp(rough + (0.5 - H[i]) * 0.18, 0.05, 1) * 255;
        ro[j] = ro[j + 1] = ro[j + 2] = rv; ro[j + 3] = 255;
        const shade = S.clamp(1 + (H[i] - Hb[i]) * 2.6 * relief, 0.62, 1.14) * (0.9 + 0.14 * H[i]);
        cd[j] = S.clamp(cd[j] * shade, 0, 255); cd[j + 1] = S.clamp(cd[j + 1] * shade, 0, 255); cd[j + 2] = S.clamp(cd[j + 2] * shade, 0, 255);
      }
      aC.getContext('2d').putImageData(aI, 0, 0);
      rC.getContext('2d').putImageData(rI, 0, 0);
      cctx.putImageData(cI, 0, 0);
      const hC = mk(size), hI = hC.getContext('2d').createImageData(w, h);
      for (let i = 0; i < N; i++) { const v = S.clamp(H[i], 0, 1) * 255, j = i * 4; hI.data[j] = hI.data[j + 1] = hI.data[j + 2] = v; hI.data[j + 3] = 255; }
      hC.getContext('2d').putImageData(hI, 0, 0);
      return { size, color: colorC, height: hC, normal: nC, rough: rC, aniso: aC, ms: Math.round(performance.now() - t0) };
    },

    /** Wrap-around merrow texture for the patch edge (u = along the contour). */
    sideMaps(hex) {
      const W = 512, Ht = 64, c = mk(W, Ht), n = mk(W, Ht);
      const [r, g, b] = S.hexToRgb(hex);
      const H = new Float32Array(W * Ht), ci = c.getContext('2d').createImageData(W, Ht);
      for (let y = 0; y < Ht; y++) for (let x = 0; x < W; x++) {
        const u = (x % 8) / 8, slant = ((x + y * 0.25) % 8) / 8;
        const v = 0.35 + 0.65 * Math.pow(Math.sin(Math.PI * slant), 0.8) * (0.8 + 0.2 * Math.sin(Math.PI * y / Ht));
        H[y * W + x] = v;
        const s = 0.6 + 0.45 * v, j = (y * W + x) * 4;
        ci.data[j] = S.clamp(r * s, 0, 255); ci.data[j + 1] = S.clamp(g * s, 0, 255); ci.data[j + 2] = S.clamp(b * s, 0, 255); ci.data[j + 3] = 255;
        void u;
      }
      c.getContext('2d').putImageData(ci, 0, 0);
      const ni = n.getContext('2d').createImageData(W, Ht);
      normalsFrom(H, W, Ht, 6, ni.data);
      n.getContext('2d').putImageData(ni, 0, 0);
      return { color: c, normal: n };
    },
  };
})(window.SSEP = window.SSEP || {});
