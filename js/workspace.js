/* ==========================================================================
   Workspace: the locked 3.5″ artboard, construction overlay, direct
   manipulation (move / snap-to-cell / scale / rotate), inch rulers, the
   small-scale legibility previews, and 3D map scheduling.
   ========================================================================== */
(function (S) {
  'use strict';
  const $ = S.$;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  const W = S.Workspace = {
    size: 600, dpr: 1, boxes: {}, texts: {}, drag: null, hover: null, snapPt: null,

    init() {
      this.ws = $('#workspace'); this.wrap = $('#canvas-wrap');
      this.cv = $('#patch'); this.ov = $('#overlay');
      this.ctx = this.cv.getContext('2d'); this.octx = this.ov.getContext('2d');
      this.rx = $('#ruler-x'); this.ry = $('#ruler-y');
      new ResizeObserver(() => this.layout()).observe(this.ws);
      const draw = S.rafOnce(() => this.render());
      this.schedulePreview = S.debounce(() => this.previews(), 140);
      S.bus.on('change', draw); S.bus.on('redraw', draw);
      S.bus.on('select', () => this.overlay());
      S.bus.on('theme', () => { this.rulers(); this.overlay(); });
      if (document.fonts) document.fonts.ready.then(() => { this.rulers(); this.overlay(); });
      S.bus.on('fonts', () => this.rulers());
      this.bindPointer();
      this.layout();
    },

    layout() {
      const R = 24, pad = 18;
      const avail = Math.floor(Math.min(this.ws.clientWidth - R - pad * 2, this.ws.clientHeight - R - pad * 2));
      this.size = Math.max(220, avail);
      this.dpr = Math.min(3, window.devicePixelRatio || 1);
      for (const c of [this.cv, this.ov]) { c.width = c.height = Math.round(this.size * this.dpr); c.style.width = c.style.height = this.size + 'px'; }
      this.wrap.style.width = this.wrap.style.height = this.size + 'px';
      this.rx.width = Math.round(this.size * this.dpr); this.rx.height = Math.round(R * this.dpr); this.rx.style.width = this.size + 'px'; this.rx.style.height = R + 'px';
      this.ry.height = Math.round(this.size * this.dpr); this.ry.width = Math.round(R * this.dpr); this.ry.style.height = this.size + 'px'; this.ry.style.width = R + 'px';
      $('#ws-scale').textContent = `${(this.size / 96 / S.INCHES * 100).toFixed(0)}% OF 3.5″`;
      this.rulers(); this.render();
    },

    render() {
      const st = S.store.state; if (!st) return;
      const px = Math.round(this.size * this.dpr);
      this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, px, px);
      const boxes = {}, texts = [];
      S.renderPatch(st, new S.CanvasBackend(this.ctx, px), { boxes, texts });
      this.boxes = boxes; this.texts = Object.fromEntries(texts.map((t) => [t.id, t]));
      this.overlay();
      this.schedulePreview();
    },

    /* ---------- overlay ---------- */
    overlay() {
      const st = S.store.state; if (!st) return;
      const c = this.octx, px = Math.round(this.size * this.dpr), k = px / 1000, hair = 1 / k;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, px, px);
      c.setTransform(k, 0, 0, k, 0, 0);
      const grid = S.buildGrid(st);
      const cg = css('--grid') || '#16c2d5', cm = css('--golden') || '#e0408a', acc = css('--accent') || '#ff5a1f';
      // 3.5″ format frame + crop marks
      c.strokeStyle = css('--frame') || 'rgba(127,127,127,.5)'; c.lineWidth = hair; c.setLineDash([4 * hair, 4 * hair]);
      c.strokeRect(0.5 * hair, 0.5 * hair, 1000 - hair, 1000 - hair); c.setLineDash([]);
      if (st.grid.overlay) {
        for (const l of grid.lines) {
          c.strokeStyle = l.k === 'golden' ? cm : cg;
          c.globalAlpha = l.k === 'axis' ? 0.35 : l.k === 'box' ? 0.5 : 0.55;
          c.lineWidth = hair; c.setLineDash(l.k === 'axis' || l.k === 'box' ? [6 * hair, 5 * hair] : []);
          c.stroke(new Path2D(l.d));
        }
        c.setLineDash([3 * hair, 3 * hair]); c.globalAlpha = 0.9;
        c.font = `500 ${10 * hair * this.dpr}px "${S.UI_MONO}", monospace`; c.fillStyle = cg;
        for (const cell of grid.cells) {
          c.strokeStyle = cg; c.globalAlpha = cell.inside ? 0.85 : 0.3;
          c.stroke(new Path2D(cell.path), cell.rule || 'nonzero');
          if (cell.inside && cell.role !== 'cell') c.fillText(cell.id.toUpperCase(), cell.type === 'rect' ? cell.x + 6 : cell.cx - 20, cell.type === 'rect' ? cell.y + 14 : cell.cy - (cell.type === 'disk' ? cell.r - 14 : 0));
          if (cell.inside && cell.role === 'cell') c.fillText(cell.id.toUpperCase(), cell.x + 6, cell.y + 14);
        }
        if (grid.bands) { c.globalAlpha = 0.6; c.setLineDash([2 * hair, 4 * hair]); c.stroke(new Path2D(S.P.circle(grid.bands.cx, grid.bands.cy, grid.bands.rc))); }
        c.setLineDash([]); c.globalAlpha = 1;
      }
      // hover + selection
      const draws = (id, color, handles) => {
        const list = this.boxes[id]; if (!list) return;
        list.forEach((b, i) => {
          if (b.bg) return;
          c.save(); c.translate(b.x, b.y); c.rotate(S.rad(b.rot || 0));
          c.strokeStyle = color; c.lineWidth = 1.5 * hair; c.setLineDash(i ? [4 * hair, 3 * hair] : []);
          c.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
          if (handles && i === 0) {
            const hs = 9 * hair * this.dpr;
            c.setLineDash([]); c.fillStyle = color;
            c.fillRect(b.w / 2 - hs / 2, b.h / 2 - hs / 2, hs, hs);
            c.beginPath(); c.moveTo(0, -b.h / 2); c.lineTo(0, -b.h / 2 - 22 * hair * this.dpr); c.stroke();
            c.beginPath(); c.arc(0, -b.h / 2 - 22 * hair * this.dpr, hs * 0.6, 0, Math.PI * 2); c.fill();
          }
          c.restore();
        });
      };
      if (this.hover && this.hover !== S.ui.selected) draws(this.hover, cg, false);
      if (S.ui.selected) draws(S.ui.selected, acc, true);
      if (this.snapPt) {
        c.strokeStyle = acc; c.lineWidth = 1.5 * hair; c.setLineDash([]);
        const [x, y] = this.snapPt, s = 14;
        c.beginPath(); c.moveTo(x - s, y); c.lineTo(x + s, y); c.moveTo(x, y - s); c.lineTo(x, y + s); c.stroke();
        c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.stroke();
      }
    },

    rulers() {
      const draw = (cv, horiz) => {
        const c = cv.getContext('2d'), d = this.dpr, len = this.size * d, th = 24 * d;
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
        c.fillStyle = css('--ink-2') || '#777'; c.strokeStyle = css('--ink-2') || '#777';
        c.font = `500 ${9 * d}px "${S.UI_MONO}", monospace`; c.lineWidth = d;
        const per = len / S.INCHES;
        for (let i = 0; i <= S.INCHES * 8 + 0.01; i++) {
          const p = Math.round(i * per / 8) + 0.5;
          const h = i % 8 === 0 ? th * 0.55 : i % 4 === 0 ? th * 0.38 : i % 2 === 0 ? th * 0.26 : th * 0.16;
          c.beginPath();
          if (horiz) { c.moveTo(p, th); c.lineTo(p, th - h); } else { c.moveTo(th, p); c.lineTo(th - h, p); }
          c.stroke();
          if (i % 8 === 0 || (i === S.INCHES * 8)) {
            const lbl = (i / 8).toFixed(i % 8 ? 1 : 0) + '″';
            if (horiz) c.fillText(lbl, Math.min(p + 3 * d, len - 22 * d), 10 * d);
            else { c.save(); c.translate(10 * d, Math.min(p + 3 * d, len - 4 * d)); c.rotate(-Math.PI / 2); c.fillText(lbl, -18 * d, 0); c.restore(); }
          }
        }
      };
      draw(this.rx, true); draw(this.ry, false);
    },

    /* ---------- small-scale legibility ---------- */
    previews() {
      const st = S.store.state;
      for (const [id, cssPx] of [['#prev-1in', 96], ['#prev-05in', 48], ['#prev-gray', 96]]) {
        const cv = $(id); if (!cv) continue;
        const px = Math.round(cssPx * this.dpr);
        cv.width = cv.height = px; cv.style.width = cv.style.height = cssPx + 'px';
        const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, px, px);
        S.renderPatch(st, new S.CanvasBackend(ctx, px));
      }
      S.bus.emit('analysis', S.analyze(st));
    },

    /* ---------- pointer interaction ---------- */
    toUnits(e) { const r = this.ov.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 1000, (e.clientY - r.top) / r.height * 1000]; },
    inBox(b, x, y, pad = 0) {
      const a = -S.rad(b.rot || 0), dx = x - b.x, dy = y - b.y;
      const u = dx * Math.cos(a) - dy * Math.sin(a), v = dx * Math.sin(a) + dy * Math.cos(a);
      return Math.abs(u) <= b.w / 2 + pad && Math.abs(v) <= b.h / 2 + pad;
    },
    hit(x, y) {
      const layers = S.store.state.layers;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = layers.length - 1; i >= 0; i--) {
          const L = layers[i]; if (L.visible === false) continue;
          if ((pass === 0) === (L.kind === 'block' || L.kind === 'motif')) continue;
          const list = this.boxes[L.id] || [];
          if (list.some((b) => !b.bg && this.inBox(b, x, y, 4))) return L;
        }
      }
      return null;
    },
    handleAt(x, y) {
      const L = S.selectedLayer(); if (!L) return null;
      const b = (this.boxes[L.id] || [])[0]; if (!b || b.bg) return null;
      const a = S.rad(b.rot || 0), cos = Math.cos(a), sin = Math.sin(a), tol = 14 * 1000 / this.size;
      const toW = (u, v) => [b.x + u * cos - v * sin, b.y + u * sin + v * cos];
      const [sx, sy] = toW(b.w / 2, b.h / 2);
      const [rx, ry] = toW(0, -b.h / 2 - 22 * 1000 / this.size);
      if (Math.hypot(x - sx, y - sy) < tol && L.kind !== 'block') return 'scale';
      if (Math.hypot(x - rx, y - ry) < tol && L.kind !== 'block') return 'rotate';
      return null;
    },
    snapTargets() {
      const g = S.buildGrid(S.store.state), out = [{ x: g.center[0], y: g.center[1], cell: null }];
      for (const c of g.cells) if (c.inside) out.push({ x: c.cx, y: c.cy, cell: c });
      for (const p of g.snaps) out.push({ x: p[0], y: p[1], cell: null });
      return out;
    },

    bindPointer() {
      const ov = this.ov;
      ov.addEventListener('pointermove', (e) => {
        const [x, y] = this.toUnits(e);
        if (!this.drag) {
          const h = this.handleAt(x, y);
          ov.style.cursor = h === 'scale' ? 'nwse-resize' : h === 'rotate' ? 'grab' : this.hit(x, y) ? 'move' : 'default';
          const hv = (this.hit(x, y) || {}).id || null;
          if (hv !== this.hover) { this.hover = hv; this.overlay(); }
          return;
        }
        this.dragMove(x, y, e);
      });
      ov.addEventListener('pointerleave', () => { if (!this.drag && this.hover) { this.hover = null; this.overlay(); } });
      ov.addEventListener('pointerdown', (e) => {
        const [x, y] = this.toUnits(e);
        const handle = this.handleAt(x, y);
        let L = handle ? S.selectedLayer() : this.hit(x, y);
        if (!L) { S.select(null); return; }
        S.select(L.id);
        const grid = S.buildGrid(S.store.state);
        const fr = S.layerFrame(L, grid);
        let cx = fr.x, cy = fr.y;
        if (L.kind === 'arctext') { const bd = grid.bands || grid.fallbackBand; cx = bd.cx; cy = bd.cy; }
        this.drag = { mode: handle || 'move', id: L.id, x0: x, y0: y, fr, L0: S.deepClone(L), cx, cy, moved: false, text: this.texts[L.id] };
        ov.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      const end = () => {
        if (!this.drag) return;
        const d = this.drag; this.drag = null;
        if (d.mode === 'move' && d.moved && this.snapPt && this.snapCell) {
          const c = this.snapCell, L0 = d.L0;
          const scale = L0.cell ? (L0.scale == null ? 0.86 : L0.scale) : S.clamp(d.fr.size / c.fit, 0.2, 1.4);
          S.patchLayer(d.id, { cell: c.id, dx: 0, dy: 0, scale }, 'Move');
        }
        this.snapPt = null; this.snapCell = null; this.overlay();
      };
      ov.addEventListener('pointerup', end); ov.addEventListener('pointercancel', end);
      ov.addEventListener('dblclick', (e) => {
        const L = this.hit(...this.toUnits(e));
        if (L && S.isTextLayer(L)) S.bus.emit('focus-text', L.id);
      });
    },

    dragMove(x, y, e) {
      const d = this.drag, L0 = d.L0, st = S.store.state;
      const dist = Math.hypot(x - d.x0, y - d.y0);
      if (!d.moved && dist < 3) return;
      d.moved = true;
      if (d.mode === 'move') {
        if (L0.kind === 'block' || L0.kind === 'motif') return;
        if (L0.kind === 'arctext') {
          const a = S.deg(Math.atan2(y - d.cy, x - d.cx) - Math.atan2(d.y0 - d.cy, d.x0 - d.cx));
          S.patchLayer(d.id, { rot: Math.round(((L0.rot || 0) + a) * 10) / 10 }, 'Move');
          return;
        }
        let nx = d.fr.x + (x - d.x0), ny = d.fr.y + (y - d.y0);
        this.snapPt = null; this.snapCell = null;
        if (st.grid.snap && !e.altKey) {
          let best = null, bd = 18;
          for (const t of this.snapTargets()) { const dd = Math.hypot(t.x - nx, t.y - ny); if (dd < bd) { bd = dd; best = t; } }
          if (best) { nx = best.x; ny = best.y; this.snapPt = [nx, ny]; this.snapCell = best.cell; }
        }
        const patch = { cell: null, x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10, size: Math.round(d.fr.size), dx: 0, dy: 0 };
        if (L0.kind === 'text' && d.text) patch.fontSize = Math.round(d.text.size * 10) / 10;
        if (L0.kind === 'label') patch.size = Math.round(d.fr.w);
        S.patchLayer(d.id, patch, 'Move');
      } else if (d.mode === 'scale') {
        const f = Math.max(0.05, Math.hypot(x - d.cx, y - d.cy) / Math.max(4, Math.hypot(d.x0 - d.cx, d.y0 - d.cy)));
        const p = {};
        if (L0.kind === 'arctext') p.offset = Math.round((L0.offset || 0) + (Math.hypot(x - d.cx, y - d.cy) - Math.hypot(d.x0 - d.cx, d.y0 - d.cy)));
        else if (L0.cell) p.scale = +S.clamp((L0.scale == null ? 0.86 : L0.scale) * f, 0.05, 3).toFixed(3);
        else if (L0.kind === 'text') p.fontSize = +S.clamp((L0.fontSize || 60) * f, 6, 600).toFixed(1);
        else p.size = Math.round(S.clamp((L0.size || 200) * f, 8, 1600));
        S.patchLayer(d.id, p, 'Scale');
      } else if (d.mode === 'rotate') {
        let a = S.deg(Math.atan2(y - d.cy, x - d.cx) - Math.atan2(d.y0 - d.cy, d.x0 - d.cx)) + (L0.rot || 0);
        if (e.shiftKey) a = Math.round(a / 15) * 15;
        S.patchLayer(d.id, { rot: Math.round(a * 10) / 10 }, 'Rotate');
      }
    },
  };

  /* ---------- 3D map scheduling ---------- */
  S.View3D = {
    quality: 1024, relief: 1, stale: true, maps: null,
    init() {
      this.viewer = new S.Viewer3D($('#viewer'));
      this.schedule = S.debounce(() => this.synth(), 420);
      S.bus.on('change', () => this.schedule());
      S.bus.on('fonts', () => this.schedule());
      this.viewer.ready.then(() => this.synth()).catch(() => { const st = $('#viewer-status'); if (st) st.textContent = 'OFFLINE'; });
    },
    /** Render any design state with the standard hero camera; restores the live view afterwards. */
    async renderState(state, px = 2000) {
      const v = this.viewer;
      try { await v.ready; } catch (e) { return null; }
      if (!v.renderer) return null;
      const saved = { pos: v.camera.position.clone(), tgt: v.controls.target.clone(), light: Object.assign({}, v.light), auto: v.controls.autoRotate };
      v.controls.autoRotate = false;
      v.update(state, S.Embroidery.synthesize(state, px > 1200 ? 2048 : 1024, { relief: this.relief }));
      v.view('hero');
      const url = v.snapshot(px);
      v.camera.position.copy(saved.pos); v.controls.target.copy(saved.tgt); v.controls.autoRotate = saved.auto;
      v.setLight(saved.light); v.controls.update();
      if (this.maps && S.ui.view !== '2d') v.update(S.store.state, this.maps); else { this.stale = true; this.maps = null; }
      return url;
    },
    synth() {
      if (!this.viewer.renderer) return;
      if (S.ui.view === '2d') { this.stale = true; return; }
      const st = $('#viewer-status'); if (st) st.textContent = 'STITCHING…';
      requestAnimationFrame(() => setTimeout(() => {
        const maps = S.Embroidery.synthesize(S.store.state, this.quality, { relief: this.relief });
        this.maps = maps; this.stale = false;
        this.viewer.update(S.store.state, maps);
        if (st) st.textContent = `${maps.size}PX MAPS · ${maps.ms} MS`;
        S.bus.emit('maps', maps);
      }, 0));
    },
  };

  S.setView = function (mode) {
    S.ui.view = mode;
    const studio = $('#studio'); studio.dataset.view = mode;
    const block = $('#viewer-block');
    (mode === '3d' ? $('#stage-3d') : $('#viewer-home')).append(block);
    if (mode === '3d') $('#maps-wrap').open = true;
    S.$$('#view-mode button').forEach((b) => b.classList.toggle('on', b.dataset.view === mode));
    if (mode !== '2d' && S.View3D.stale) S.View3D.synth();
    setTimeout(() => { W.layout(); S.View3D.viewer && S.View3D.viewer.resize(); }, 30);
  };
})(window.SSEP = window.SSEP || {});
