/* ==========================================================================
   Layer factories, default design, and the constrained variation engine.
   "Generate variation" permutes shape, grid, palette, stitch angles, motifs
   and semiotic accents while honouring locks (global + per-layer).
   ========================================================================== */
(function (S) {
  'use strict';
  const R = S.R;
  const KIND_ORDER = { motif: 0, block: 1, symbol: 2, upload: 2, label: 3, text: 4, arctext: 4 };

  const base = (kind, o) => Object.assign({ id: S.uid(kind.slice(0, 3)), kind, visible: true, locked: false, rot: 0, mirror: false, stitch: 'auto', angle: 45 }, o);
  S.make = {
    symbol: (symbol, o = {}) => base('symbol', Object.assign({ symbol, name: S.symbolById(symbol).name, cell: null, x: 500, y: 500, size: 220, scale: 0.86, colors: [2, 3, 4], tile: { mode: 'none', count: 6 }, frame: 'solid' }, o)),
    upload: (asset, name, o = {}) => base('upload', Object.assign({ asset, name: name || 'Student symbol', cell: null, x: 500, y: 500, size: 300, scale: 0.86, colors: [2, 3, 4], recolor: 'palette', dropBg: true, tile: { mode: 'none', count: 6 } }, o)),
    text: (o = {}) => base('text', Object.assign({ name: 'Text', text: 'MISSION', bind: null, font: 'Barlow Condensed', weight: 700, fontSize: 70, tracking: 120, upper: true, align: 'center', autoFit: true, colors: [2, 0], outline: false, outlineWidth: 6, cell: null, x: 500, y: 500, size: 300, scale: 0.92, stitch: 'satin' }, o)),
    arctext: (o = {}) => base('arctext', Object.assign({ name: 'Arc text', text: 'BARUCH COLLEGE', bind: null, pos: 'top', font: 'Barlow Condensed', weight: 700, fontSize: 70, tracking: 120, upper: true, autoFit: true, fill: 0.6, span: 0, offset: 0, colors: [2, 0], outline: false, outlineWidth: 5, stitch: 'satin' }, o)),
    label: (o = {}) => base('label', Object.assign({ name: 'Semiotic label', text: 'MG-00', bind: null, icon: 'gravity-off', font: 'IBM Plex Mono', weight: 700, tracking: 60, upper: true, cell: null, x: 500, y: 500, size: 240, scale: 0.94, colors: [1, 0, 2], stripes: false }, o)),
    block: (cell, o = {}) => base('block', Object.assign({ name: 'Colour block · ' + cell, cell, colors: [3], angle: 0 }, o)),
    motif: (motif, o = {}) => base('motif', Object.assign({ name: 'Motif · ' + ((S.MOTIFS.find((m) => m.id === motif) || {}).name || motif), motif, colors: [3, 4, 2], seed: 7, density: 0.5, param: 0.5, angle: 0 }, o)),
  };
  S.isTextLayer = (l) => l.kind === 'text' || l.kind === 'arctext' || l.kind === 'label';
  S.sortLayers = (layers) => layers.map((l, i) => [l, i]).sort((a, b) => (KIND_ORDER[a[0].kind] - KIND_ORDER[b[0].kind]) || a[1] - b[1]).map((x) => x[0]);

  S.defaultState = function () {
    const pal = S.paletteById('nasa');
    return {
      v: 1,
      meta: { title: 'BARUCH COLLEGE', subtitle: 'SSEP · ISS 2027', phrase: 'MICROGRAVITY', code: 'MG-27', statement: '', entry: 'A' },
      seed: 271828,
      shape: 'circle', cornerRadius: 0.24, borderWidth: 30, keyline: true, keylineWidth: 9, borderColor: 1, keylineColor: 3,
      bgColor: 0, bgStitch: 'fill', bgAngle: 45,
      grid: { preset: 'seal', gutter: 14, padding: 16, cellRadius: 10, bandRatio: 0.25, overlay: true, snap: true },
      palette: { id: pal.id, threads: pal.threads.map((t) => t.hex), count: pal.threads.length },
      locks: { shape: false, grid: false, palette: false, type: false, text: false, uploads: true, symbols: false, motifs: false, stitches: false },
      assets: {},
      layers: [
        S.make.motif('starfield', { colors: [2, 4, 3], seed: 11, density: 0.32 }),
        S.make.block('band', { colors: [5], angle: 90 }),
        S.make.symbol('orbits', { cell: 'emblem', scale: 0.98, colors: [2, 3, 4], angle: 30 }),
        S.make.symbol('flame', { cell: 'emblem', scale: 0.5, colors: [4, 3, 2], angle: 120 }),
        S.make.symbol('star4', { cell: 'side-l', scale: 0.9, colors: [3, 2] }),
        S.make.symbol('star4', { cell: 'side-r', scale: 0.9, colors: [3, 2] }),
        S.make.arctext({ name: 'Mission title', bind: 'title', pos: 'top', font: 'Barlow Condensed', weight: 700, tracking: 140, colors: [2, 0] }),
        S.make.arctext({ name: 'Mission subtitle', bind: 'subtitle', pos: 'bottom', font: 'Barlow Condensed', weight: 600, tracking: 180, colors: [3, 0] }),
      ],
    };
  };

  /* ---------- helpers ---------- */
  const TITLE_FONTS = ['Barlow Condensed', 'Oswald', 'Archivo Narrow', 'Space Grotesk', 'Saira Condensed', 'Antonio', 'Bebas Neue', 'Michroma', 'Syne', 'Chakra Petch', 'Inter', 'Unbounded'];
  const SUB_FONTS = ['IBM Plex Mono', 'JetBrains Mono', 'Space Mono', 'Space Grotesk', 'Barlow Condensed', 'Rajdhani', 'Archivo Narrow'];
  const heavy = (fam, min) => { const ws = S.Fonts.weights(fam); return ws.filter((w) => w >= min).sort((a, b) => a - b)[0] || ws[ws.length - 1]; };
  const narrow = (fam) => /Condensed|Narrow|Oswald|Antonio|Bebas/.test(fam);

  /** pick a thread index with enough contrast against one or more hex colours */
  function contrastPick(r, color, cands, against, min = 3) {
    const list = Array.isArray(against) ? against.filter(Boolean) : [against];
    const score = (i) => Math.min(...list.map((h) => S.contrast(color(i), h)));
    const ok = cands.filter((i) => score(i) >= min);
    if (ok.length) return R.pick(r, ok);
    return cands.slice().sort((a, b) => score(b) - score(a))[0];
  }

  const GRIDS_FOR = {
    circle: [['seal', 5], ['rings', 3], ['polar-6', 2], ['polar-8', 2], ['polar-12', 1], ['badge-curved', 3], ['swiss-3', 1], ['golden', 1]],
    roundsquare: [['badge-straight', 4], ['badge-telemetry', 3], ['seal', 3], ['badge-curved', 2], ['swiss-3', 2], ['swiss-4', 2], ['golden', 2], ['golden-r', 1], ['swiss-6', 1], ['polar-8', 1]],
    hexagon: [['seal', 3], ['polar-6', 3], ['rings', 2], ['badge-curved', 2], ['badge-straight', 1], ['swiss-3', 1]],
    shield: [['badge-straight', 3], ['seal', 2], ['badge-curved', 3], ['golden', 1], ['badge-telemetry', 2]],
  };
  const MOTIFS_FOR = (preset) => preset.startsWith('polar') ? [['sunburst', 4], ['starfield', 2], ['none', 1], ['concentric', 1]]
    : preset === 'rings' ? [['concentric', 2], ['starfield', 3], ['orbits', 2], ['horizon', 1]]
    : preset.startsWith('badge') ? [['hazard', 2], ['manhattan', 2], ['colorblock', 3], ['starfield', 2], ['horizon', 2], ['lattice', 1], ['none', 1]]
    : preset.startsWith('swiss') || preset.startsWith('golden') ? [['colorblock', 3], ['lattice', 2], ['manhattan', 2], ['none', 2], ['starfield', 1]]
    : [['starfield', 4], ['horizon', 2], ['orbits', 2], ['colorblock', 1], ['lattice', 1], ['none', 1]];

  /**
   * Produce a new variation. Returns a fresh state (input untouched).
   */
  S.generate = function (state, seed) {
    const r = S.rng(seed);
    const s = S.deepClone(state);
    const lk = s.locks || {};
    s.seed = seed;

    if (!lk.shape) {
      s.shape = R.weighted(r, [['circle', 4], ['roundsquare', 3], ['hexagon', 2], ['shield', 2]]);
      s.cornerRadius = +R.range(r, 0.1, 0.42).toFixed(2);
      s.borderWidth = Math.round(R.range(r, 22, 40));
      s.keyline = R.chance(r, 0.65);
      s.keylineWidth = Math.round(R.range(r, 6, 13));
    }
    if (!lk.palette) {
      const pal = R.pick(r, S.PALETTES.filter((p) => p.id !== s.palette.id));
      s.palette = { id: pal.id, threads: pal.threads.map((t) => t.hex), count: pal.threads.length };
    }
    const color = S.colorFn(s), n = S.clamp(s.palette.count, 2, 6);
    const all = Array.from({ length: n }, (_, i) => i);
    if (!lk.palette) {
      s.bgColor = R.chance(r, 0.78) || n < 6 ? 0 : 5;
      const bg = color(s.bgColor);
      s.borderColor = contrastPick(r, color, all.filter((i) => i !== s.bgColor), bg, 2.5);
      s.keylineColor = contrastPick(r, color, all.filter((i) => i !== s.borderColor && i !== s.bgColor), color(s.borderColor), 1.6);
    }
    if (!lk.grid) {
      s.grid.preset = R.weighted(r, GRIDS_FOR[s.shape] || GRIDS_FOR.circle);
      s.grid.gutter = Math.round(R.range(r, 8, 22));
      s.grid.padding = Math.round(R.range(r, 10, 28));
      s.grid.bandRatio = +R.range(r, 0.21, 0.28).toFixed(3);
      s.grid.cellRadius = R.pick(r, [0, 6, 12, 18]);
    }
    if (!lk.stitches) s.bgAngle = R.pick(r, S.STITCH_ANGLES);
    const grid = S.buildGrid(s);
    const bg = color(s.bgColor);
    const angle = () => (lk.stitches ? 45 : R.pick(r, S.STITCH_ANGLES));

    // ---- keep locked material ----
    const keep = s.layers.filter((l) => l.locked
      || (lk.text && S.isTextLayer(l)) || (lk.uploads && l.kind === 'upload')
      || (lk.symbols && l.kind === 'symbol') || (lk.motifs && l.kind === 'motif'));
    const out = [];
    const occupied = new Set(keep.filter((l) => l.cell).map((l) => (S.resolveCell(grid, l.cell) || {}).id));

    // ---- type choices ----
    let tFont = null, sFont = null;
    if (!lk.type) {
      tFont = R.pick(r, TITLE_FONTS); sFont = R.chance(r, 0.5) ? R.pick(r, SUB_FONTS) : tFont;
      keep.filter((l) => S.isTextLayer(l) && !l.locked).forEach((l) => {
        const f = l.kind === 'label' ? R.pick(r, ['IBM Plex Mono', 'JetBrains Mono', 'Space Mono', 'Chakra Petch']) : (l.pos === 'bottom' || l.cell === 'footer' ? sFont : tFont);
        l.font = f; l.weight = heavy(f, l.kind === 'label' ? 600 : 600);
      });
    }

    // ---- background motif ----
    let bandColor = null, under = [bg];
    if (!lk.motifs) {
      const motif = R.weighted(r, MOTIFS_FOR(grid.preset));
      if (motif !== 'none') {
        const others = all.filter((i) => i !== s.bgColor);
        const c0 = motif === 'colorblock' || motif === 'horizon' || motif === 'sunburst' || motif === 'concentric'
          ? R.pick(r, others.filter((i) => S.contrast(color(i), bg) < 6).concat(others).slice(0, 3)) : contrastPick(r, color, others, bg, 2);
        const c1 = R.pick(r, others);
        out.push(S.make.motif(motif, { colors: [c0, c1, R.pick(r, others)], seed: R.int(r, 1, 9999), density: +R.range(r, 0.2, 0.75).toFixed(2), param: +R.range(r, 0.15, 0.9).toFixed(2), angle: angle() }));
        if (['colorblock', 'horizon', 'sunburst', 'concentric'].includes(motif)) under.push(color(c0));
        if (motif === 'colorblock' || motif === 'concentric') under.push(color(c1));
      }
    }

    // ---- colour blocking (Klein geometry) ----
    if (!lk.motifs) {
      if (grid.byId.band && R.chance(r, 0.7)) {
        const ci = R.pick(r, all.filter((i) => i !== s.borderColor));
        bandColor = color(ci);
        out.push(S.make.block('band', { colors: [ci], angle: angle() }));
      }
      if (grid.byId['ring-1'] && R.chance(r, 0.6)) out.push(S.make.block('ring-1', { colors: [R.pick(r, all.slice(1))], angle: angle() }));
      const sectors = S.cellsByRole(grid, 'sector');
      if (sectors.length && R.chance(r, 0.6)) {
        const ci = R.pick(r, all.slice(1)), off = R.int(r, 0, 1);
        sectors.forEach((c, i) => { if (i % 2 === off) out.push(S.make.block(c.id, { colors: [ci], angle: angle() })); });
      }
      const zones = [grid.byId.header, grid.byId.footer, grid.byId.emblem].filter(Boolean);
      const hits = (a, b) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
      const rects = S.cellsByRole(grid, 'cell', 'header', 'footer', 'aux').filter((c) => c.role === 'header' || c.role === 'footer' || !zones.some((z) => hits(c, z)));
      if (rects.length && !grid.byId.band) {
        for (const c of R.shuffle(r, rects).slice(0, R.int(r, 1, Math.min(3, rects.length)))) {
          if (c.role === 'emblem') continue;
          out.push(S.make.block(c.id, { colors: [R.pick(r, all.filter((i) => i !== s.bgColor))], angle: angle() }));
        }
      }
    }

    // ---- emblem: student upload first, else a microgravity motif ----
    const uploads = Object.values(s.assets || {});
    const emblem = grid.byId.emblem || S.cellsByRole(grid, 'cell').sort((a, b) => b.fit - a.fit)[0];
    const auxCells = S.cellsByRole(grid, 'corner', 'aux', 'telemetry', 'sep');
    const eId = emblem && emblem.id;
    if (!lk.uploads && uploads.length) {
      out.push(S.make.upload(uploads[0].id, uploads[0].name, { cell: eId, scale: R.range(r, 0.72, 0.92), colors: [contrastPick(r, color, all, bg, 3), R.pick(r, all), R.pick(r, all)], angle: angle(), rot: 0 }));
      occupied.add(eId);
      uploads.slice(1).forEach((u, i) => {
        const c = auxCells[i % Math.max(1, auxCells.length)];
        out.push(S.make.upload(u.id, u.name, { cell: c ? c.id : eId, scale: 0.8, colors: [contrastPick(r, color, all, bg, 3), R.pick(r, all), R.pick(r, all)], angle: angle() }));
        if (c) occupied.add(c.id);
      });
    }
    if (!lk.symbols) {
      const klein = S.symbolsBySet('klein');
      const hasEmblem = keep.concat(out).some((l) => (l.kind === 'upload' || l.kind === 'symbol') && l.cell && (S.resolveCell(grid, l.cell) || {}).id === eId);
      if (emblem && !hasEmblem) {
        const main = R.pick(r, klein.filter((k) => k.id !== 'star4'));
        const blockUnder = out.filter((l) => l.kind === 'block' && (l.cell === eId || l.cell === 'ring-1')).map((l) => color(l.colors[0]));
        const pick3 = () => { const a = contrastPick(r, color, all, under.concat(blockUnder), 2.4); return [a, R.pick(r, all.filter((i) => i !== a)), R.pick(r, all.filter((i) => i !== a))]; };
        if (R.chance(r, 0.4) && main.id !== 'orbits') {
          out.push(S.make.symbol('orbits', { cell: eId, scale: 0.98, colors: pick3(), angle: angle() }));
          out.push(S.make.symbol(main.id, { cell: eId, scale: R.range(r, 0.45, 0.58), colors: pick3(), angle: angle(), rot: R.pick(r, [0, 0, 15, -15, 30]) }));
        } else out.push(S.make.symbol(main.id, { cell: eId, scale: R.range(r, 0.8, 0.95), colors: pick3(), angle: angle(), rot: R.pick(r, [0, 0, 0, 30, -30, 45]) }));
      }
      // Cobb semiotic accents in auxiliary cells
      const cobb = R.shuffle(r, S.symbolsBySet('cobb'));
      let k = 0;
      const frameC = contrastPick(r, color, all.filter((i) => i !== s.bgColor), under, 1.8);
      const iconC = contrastPick(r, color, all.filter((i) => i !== frameC), color(frameC), 3);
      const accC = R.pick(r, all.filter((i) => i !== frameC));
      for (const c of auxCells) {
        if (occupied.has(c.id)) continue;
        if (c.role === 'sep') { out.push(S.make.symbol('star4', { cell: c.id, scale: 0.9, colors: [contrastPick(r, color, all, bandColor || bg, 2.5), R.pick(r, all)], angle: angle() })); continue; }
        const wide = c.fitW > c.fitH * 1.55;
        if (wide || (c.role === 'telemetry' && R.chance(r, 0.6))) {
          out.push(S.make.label({ cell: c.id, icon: cobb[k++ % cobb.length].id, text: R.pick(r, S.CODES), colors: [frameC, iconC, accC], stripes: R.chance(r, 0.3), font: R.pick(r, ['IBM Plex Mono', 'JetBrains Mono', 'Space Mono']), angle: angle() }));
        } else {
          out.push(S.make.symbol(cobb[k++ % cobb.length].id, { cell: c.id, scale: 0.86, colors: [frameC, iconC, accC], frame: R.weighted(r, [['solid', 5], ['outline', 2]]), angle: angle() }));
        }
      }
      const sectors = S.cellsByRole(grid, 'sector');
      if (sectors.length) {
        const sym = R.chance(r, 0.5) ? R.pick(r, ['star4', 'crystal', 'droplet']) : cobb[k++ % cobb.length].id;
        out.push(S.make.symbol(sym, { cell: sectors[0].id, scale: 0.7, orient: true, tile: { mode: 'cells', count: sectors.length }, frame: 'none', colors: [contrastPick(r, color, all, bg, 2.5), R.pick(r, all), R.pick(r, all)], angle: angle() }));
      }
    }

    // ---- mission type ----
    if (!lk.text) {
      const tf = tFont || 'Barlow Condensed', sf = sFont || tf;
      const trackT = narrow(tf) ? R.int(r, 80, 200) : R.int(r, 30, 120), trackS = R.int(r, 120, 260);
      const onBand = bandColor ? [bandColor] : under;
      const tc = contrastPick(r, color, all.filter((i) => i !== s.bgColor || bandColor), onBand, 3.2);
      const sc = contrastPick(r, color, all, onBand, 3);
      if (grid.bands) {
        out.push(S.make.arctext({ name: 'Mission title', bind: 'title', pos: 'top', font: tf, weight: heavy(tf, 600), tracking: trackT, colors: [tc, 0] }));
        out.push(S.make.arctext({ name: 'Mission subtitle', bind: 'subtitle', pos: 'bottom', font: sf, weight: heavy(sf, 500), tracking: trackS, colors: [sc, 0] }));
      } else {
        const hdr = grid.byId.header, ftr = grid.byId.footer;
        const hdrBg = out.find((l) => l.kind === 'block' && l.cell === 'header');
        const ftrBg = out.find((l) => l.kind === 'block' && l.cell === 'footer');
        if (hdr) out.push(S.make.text({ name: 'Mission title', bind: 'title', cell: 'header', font: tf, weight: heavy(tf, 600), tracking: trackT, colors: [contrastPick(r, color, all, hdrBg ? color(hdrBg.colors[0]) : under, 3.2), 0] }));
        else out.push(S.make.arctext({ name: 'Mission title', bind: 'title', pos: 'top', font: tf, weight: heavy(tf, 600), tracking: trackT, colors: [tc, 0] }));
        if (ftr && ftr.fitW > 260 && s.shape !== 'shield') out.push(S.make.text({ name: 'Mission subtitle', bind: 'subtitle', cell: 'footer', font: sf, weight: heavy(sf, 500), tracking: trackS, colors: [contrastPick(r, color, all, ftrBg ? color(ftrBg.colors[0]) : under, 3), 0] }));
        else out.push(S.make.arctext({ name: 'Mission subtitle', bind: 'subtitle', pos: 'bottom', font: sf, weight: heavy(sf, 500), tracking: trackS, colors: [sc, 0] }));
      }
    }

    // kept type keeps its words but re-checks contrast when the palette moved
    if (!lk.palette) {
      for (const l of keep) {
        if (l.locked || !S.isTextLayer(l) || l.kind === 'label') continue;
        const blk = out.concat(keep).find((b) => b.kind === 'block' && (b.cell === l.cell || (l.kind === 'arctext' && b.cell === 'band')));
        const behind = blk ? color(blk.colors[0]) : bandColor && l.kind === 'arctext' ? bandColor : bg;
        const cs = (l.colors || [2, 0]).slice();
        if (S.contrast(color(cs[0]), behind) < 3) { cs[0] = contrastPick(r, color, all, behind, 3); l.colors = cs; }
      }
    }
    s.layers = S.sortLayers(keep.concat(out));
    return s;
  };
})(window.SSEP = window.SSEP || {});
