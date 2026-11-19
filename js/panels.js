/* ==========================================================================
   Left control panel: 01 Format · 02 Grid · 03 Threads · 04 Type ·
   05 Symbols · 06 Generate · 07 Export
   ========================================================================== */
(function (S) {
  'use strict';
  const el = S.el, C = S.C, $ = S.$;
  const st = () => S.store.state;
  const set = (label, fn) => S.store.set(fn, label);
  const mm = (u) => `${(u * S.MM_PER_UNIT).toFixed(1)} mm`;

  const SHAPE_ICONS = {
    circle: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/></svg>',
    roundsquare: '<svg viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="16" rx="4"/></svg>',
    hexagon: '<svg viewBox="0 0 20 20"><path d="M2 10 6 3.1h8L18 10l-4 6.9H6Z"/></svg>',
    shield: '<svg viewBox="0 0 20 20"><path d="M3 2.5h14v7.5c0 4-3.5 6.5-7 8-3.5-1.5-7-4-7-8Z"/></svg>',
  };

  function formatSection() {
    return C.section('01', 'Format · 3.5″ × 3.5″', true,
      C.seg({ label: 'Silhouette', options: S.SHAPES.map((s) => [s.id, SHAPE_ICONS[s.id], s.name]), get: () => st().shape, set: (v) => set('Shape', (s) => { s.shape = v; }) }),
      C.slider({ label: 'Corner radius', min: 0, max: 1, step: 0.01, get: () => st().cornerRadius, set: (v) => set('Corner', (s) => { s.cornerRadius = v; }), fmt: (v) => (v * 100).toFixed(0) + '%' }),
      C.slider({ label: 'Merrow border', min: 0, max: 80, step: 1, get: () => st().borderWidth, set: (v) => set('Border', (s) => { s.borderWidth = v; }), fmt: mm }),
      C.thread({ label: 'Border thread', get: () => st().borderColor, set: (i) => set('Border colour', (s) => { s.borderColor = i; }) }),
      C.toggle({ label: 'Inner keyline', get: () => st().keyline, set: (v) => set('Keyline', (s) => { s.keyline = v; }) }),
      C.slider({ label: 'Keyline width', min: 2, max: 30, step: 1, get: () => st().keylineWidth, set: (v) => set('Keyline w', (s) => { s.keylineWidth = v; }), fmt: mm }),
      C.thread({ label: 'Keyline thread', get: () => st().keylineColor, set: (i) => set('Keyline colour', (s) => { s.keylineColor = i; }) }),
      C.sub('Ground',
        C.seg({ label: 'Ground', options: [['fill', 'Tatami fill'], ['twill', 'Exposed twill']], get: () => st().bgStitch, set: (v) => set('Ground', (s) => { s.bgStitch = v; }) }),
        C.thread({ label: 'Ground colour', get: () => st().bgColor, set: (i) => set('Ground colour', (s) => { s.bgColor = i; }) }),
        C.slider({ label: 'Fill angle', min: 0, max: 175, step: 5, get: () => st().bgAngle, set: (v) => set('Ground angle', (s) => { s.bgAngle = v; }), fmt: (v) => v + '°' })));
  }

  function gridSection() {
    const groups = [];
    for (const g of S.GRID_PRESETS) { let grp = groups.find((x) => x.group === g.group); if (!grp) groups.push(grp = { group: g.group, items: [] }); grp.items.push([g.id, g.name]); }
    return C.section('02', 'Grid & layout', true,
      C.select({ label: 'Grid preset', options: groups, get: () => st().grid.preset, set: (v) => set('Grid', (s) => { s.grid.preset = v; }) }),
      C.slider({ label: 'Gutter', min: 0, max: 60, get: () => st().grid.gutter, set: (v) => set('Gutter', (s) => { s.grid.gutter = v; }), fmt: mm }),
      C.slider({ label: 'Padding', min: 0, max: 90, get: () => st().grid.padding, set: (v) => set('Padding', (s) => { s.grid.padding = v; }), fmt: mm }),
      C.slider({ label: 'Text band', min: 0.12, max: 0.4, step: 0.005, get: () => st().grid.bandRatio, set: (v) => set('Band', (s) => { s.grid.bandRatio = v; }), fmt: (v) => (v * 100).toFixed(0) + '% R' }),
      C.slider({ label: 'Cell radius', min: 0, max: 60, get: () => st().grid.cellRadius, set: (v) => set('Cell radius', (s) => { s.grid.cellRadius = v; }), fmt: mm }),
      el('div', { class: 'row-pair' },
        C.toggle({ label: 'Construction grid', get: () => st().grid.overlay, set: (v) => set('Overlay', (s) => { s.grid.overlay = v; }) }),
        C.toggle({ label: 'Snap to grid', get: () => st().grid.snap, set: (v) => set('Snap', (s) => { s.grid.snap = v; }) })),
      el('p', { class: 'hint', text: 'Drag a symbol onto a cell centre to dock it. Hold ⌥ while dragging to place freely.' }));
  }

  function threadsSection() {
    const list = el('div', { class: 'palettes' });
    for (const p of S.PALETTES) {
      const b = el('button', { type: 'button', class: 'pal', title: p.note },
        el('span', { class: 'pal-sw' }, ...p.threads.map((t) => el('i', { style: { background: t.hex } }))),
        el('span', { class: 'pal-name', text: p.name }));
      b.addEventListener('click', () => set('Palette', (s) => { s.palette = { id: p.id, threads: p.threads.map((t) => t.hex), count: p.threads.length }; }));
      list.append(b);
    }
    const r = () => { Array.from(list.children).forEach((b, i) => b.classList.toggle('on', S.PALETTES[i].id === st().palette.id && !st().palette.custom)); };
    r.alive = () => list.isConnected; C.track(r); r();

    const editor = el('div', { class: 'thread-edit' });
    const re = () => {
      const s = st(), n = s.palette.count, pal = S.paletteById(s.palette.id);
      editor.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const hex = s.palette.threads[i] || '#888888';
        const input = el('input', { type: 'color', value: hex });
        input.addEventListener('input', () => set('Thread ' + i, (x) => { x.palette.threads[i] = input.value; x.palette.custom = true; }));
        const role = ['GROUND', 'EDGE', 'PRIMARY', 'SECOND', 'ACCENT', 'DETAIL'][i];
        const nm = pal.threads[i] && pal.threads[i].hex.toLowerCase() === hex.toLowerCase() ? pal.threads[i].name : 'Custom';
        editor.append(el('label', { class: 'thread' }, el('span', { class: 'chip', style: { background: hex } }, input), el('span', { class: 'tmeta' }, el('b', { text: `T${i} · ${role}` }), el('span', { text: `${hex.toUpperCase()} ${nm}` }))));
      }
    };
    re.alive = () => editor.isConnected; C.track(re); re();
    const used = el('div', { class: 'readout', id: 'thread-used' });
    S.bus.on('analysis', (a) => { used.innerHTML = `THREADS IN USE <b>${a.threads.length}</b> / 6 MAX`; used.classList.toggle('warn', a.threads.length > 6); });
    return C.section('03', 'Thread palette', true, list,
      C.seg({ label: 'Thread count', options: [[4, '4'], [5, '5'], [6, '6']], get: () => st().palette.count, set: (v) => set('Thread count', (s) => { s.palette.count = v; while (s.palette.threads.length < v) s.palette.threads.push(s.palette.threads[s.palette.threads.length - 1] || '#888888'); }) }),
      editor, used);
  }

  function typeSection() {
    let lastField = 'title';
    const field = (key, label, ph) => C.text({ label, placeholder: ph, get: () => st().meta[key], set: (v) => set('Meta ' + key, (s) => { s.meta[key] = v; }), onfocus: () => { lastField = key; } });
    const chips = el('div', { class: 'chips' }, ...S.META_PRESETS.map((t) => el('button', { type: 'button', class: 'chip-btn', text: t, on: { click: () => set('Quick fill', (s) => { s.meta[lastField] = t; }) } })));
    const fontIn = el('input', { type: 'text', placeholder: 'Any Google Font, e.g. Sora', spellcheck: false });
    const load = async () => {
      try {
        const fam = await S.Fonts.search(fontIn.value);
        S.toast(`Loaded ${fam}`);
        const L = S.selectedLayer();
        if (L && S.isTextLayer(L)) S.patchLayer(L.id, { font: fam, weight: S.Fonts.weights(fam).includes(700) ? 700 : S.Fonts.weights(fam)[0] }, 'Font');
        fontIn.value = '';
      } catch (e) { S.toast(e.message, 'warn'); }
    };
    fontIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
    const add = (kind, o) => () => S.addLayer(kind === 'arctext' ? S.make.arctext(o) : kind === 'label' ? S.make.label(o) : S.make.text(o), 'Add text');
    return C.section('04', 'Typography', true,
      C.sub('Mission metadata',
        field('title', 'Title', 'BARUCH COLLEGE'), field('subtitle', 'Subtitle', 'SSEP · ISS 2027'),
        field('phrase', 'Phrase', 'Your message to space'), field('code', 'System code', 'MG-27'),
        C.text({ label: 'Concept', multiline: true, placeholder: 'Your message to space — what does this patch say? (50–150 words, goes in your submission)', get: () => st().meta.statement, set: (v) => set('Meta statement', (s) => { s.meta.statement = v; }) }),
        el('div', { class: 'hint', text: 'Quick-fill the last focused field:' }), chips),
      C.sub('Add type',
        el('div', { class: 'btn-grid' },
          C.button('+ Arc · top', add('arctext', { name: 'Arc · top', bind: 'title', pos: 'top' })),
          C.button('+ Arc · bottom', add('arctext', { name: 'Arc · bottom', bind: 'subtitle', pos: 'bottom', tracking: 180 })),
          C.button('+ Straight line', add('text', { name: 'Phrase', bind: 'phrase', x: 500, y: 500, fontSize: 56, autoFit: false })),
          C.button('+ Semiotic label', add('label', { bind: 'code', x: 500, y: 760, size: 260 })))),
      C.sub('Google Fonts', el('div', { class: 'inline' }, fontIn, C.button('Load', load)),
        el('p', { class: 'hint', text: 'Curated: Space Grotesk, Spline Sans, IBM Plex Mono, Spline Sans Mono, Archivo Narrow, Barlow Condensed, Syne, Inter, JetBrains Mono, Oswald + more. Loaded fonts appear in each text layer’s font menu.' })));
  }

  function symbolsSection() {
    const fileIn = $('#file-svg');
    const drop = el('div', { class: 'dropzone', tabindex: 0 },
      el('b', { text: 'Drop student SVG symbols' }), el('span', { text: 'or click to choose files · multiple allowed' }));
    drop.addEventListener('click', () => fileIn.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter') fileIn.click(); });
    const assets = el('div', { class: 'assets' });
    const ra = () => {
      const s = st(); assets.innerHTML = '';
      for (const a of Object.values(s.assets || {})) {
        const b = new S.SVGBackend(); b.idp = S.uid('as') + '-';
        const k = 100 / Math.max(a.vb[2], a.vb[3]);
        b.translate(50, 50); b.scale(k, k); b.translate(-(a.vb[0] + a.vb[2] / 2), -(a.vb[1] + a.vb[3] / 2));
        for (const it of a.items) { if (it.bg) continue; b.save(); b.transform(...it.m); if (it.fill) b.path(it.d, { fill: it.fill, rule: it.rule }); if (it.stroke) b.path(it.d, { stroke: it.stroke, width: it.sw, cap: it.cap, join: it.join }); b.restore(); }
        const thumb = el('span', { class: 'thumb', html: `<svg viewBox="0 0 100 100">${b.out.join('')}</svg>` });
        assets.append(el('div', { class: 'asset' }, thumb,
          el('span', { class: 'aname' }, el('b', { text: a.name }), el('span', { text: `${a.paths} paths · ${a.colors.length} colours` })),
          C.button('Place', () => S.placeAsset(a.id), 'small'),
          C.button('×', () => { set('Remove upload', (x) => { delete x.assets[a.id]; x.layers = x.layers.filter((l) => l.asset !== a.id); }); }, 'small ghost')));
      }
      if (!assets.childElementCount) assets.append(el('p', { class: 'hint', text: 'No uploads yet. Export your Session 1 sketches as .svg (Illustrator, Figma, Inkscape or vectorised scans).' }));
    };
    ra.alive = () => assets.isConnected; C.track(ra); ra();

    const lib = (set_, title) => {
      const grid = el('div', { class: 'symgrid' });
      for (const sym of S.symbolsBySet(set_)) {
        const b = el('button', { type: 'button', class: 'sym', title: sym.name + (sym.note ? ' — ' + sym.note : ''), html: C.symbolSVG(sym.id, set_ === 'cobb' ? ['#f26b1d', '#151515', '#e9e4d8'] : ['#2ee6ff', '#ff2e88', '#f4f4f4']) });
        b.addEventListener('click', () => S.placeSymbol(sym.id));
        grid.append(b);
      }
      return C.sub(title, grid);
    };
    const motifSel = el('select', null, ...S.MOTIFS.filter((m) => m.id !== 'none').map((m) => el('option', { value: m.id, text: m.name })));
    return C.section('05', 'Symbols & assets', true, drop, assets,
      lib('klein', 'A · Microgravity set (after Patricia Klein)'),
      lib('cobb', 'B · Semiotic set (after Ron Cobb)'),
      C.sub('Background motif', el('div', { class: 'inline' }, motifSel, C.button('+ Add', () => {
        S.addLayer(S.make.motif(motifSel.value, { seed: S.R.int(Math.random, 1, 9999), colors: [3, 4, 2] }), 'Add motif');
      }))));
  }

  function generateSection() {
    const locks = [['shape', 'Silhouette & border'], ['grid', 'Grid'], ['palette', 'Palette'], ['type', 'Typefaces'], ['text', 'Mission type'], ['uploads', 'Uploaded SVGs'], ['symbols', 'Symbols'], ['motifs', 'Motifs & blocks'], ['stitches', 'Stitch angles']];
    const seedIn = el('input', { type: 'number', min: 1 });
    const r = () => { if (document.activeElement !== seedIn) seedIn.value = st().seed; };
    r.alive = () => seedIn.isConnected; C.track(r); r();
    return C.section('06', 'Generate variation', true,
      C.button('Generate variation <kbd>G</kbd>', () => S.generateVariation(), 'primary wide'),
      el('div', { class: 'hint', text: 'Locked items survive every variation. Lock single layers with the padlock in the layer list.' }),
      el('div', { class: 'locks' }, ...locks.map(([k, t]) => C.toggle({ label: t, cls: 'lock', get: () => st().locks[k], set: (v) => S.store.set((s) => { s.locks[k] = v; }, 'Lock', { coalesce: false }) }))),
      C.row('Seed', el('div', { class: 'inline' }, seedIn, C.button('Re-roll', () => {
        const seed = parseInt(seedIn.value, 10) || 1;
        S.store.replace(S.generate(st(), seed), 'Seed'); S.pushVariation(S.store.state);
      }, 'small'))));
  }

  function exportSection() {
    let transparent = true, embed = true;
    const guard = (fn) => () => fn();
    return C.section('07', 'Export & submit', true,
      el('div', { class: 'submit-cta' },
        el('div', null, el('b', { text: 'Submission package' }), el('span', { text: 'All entries · PNG, SVG, 3D renders, proof sheets, recipes, statements — one .zip.' })),
        C.button('Prepare package →', () => S.Package.open(), 'primary')),
      C.sub('Single files · this entry'),
      el('div', { class: 'btn-grid' },
        C.button('PNG · 1000 px', guard(() => S.Export.pngFlat(st(), 1000, { transparent }))),
        C.button('PNG · 2000 px', guard(() => S.Export.pngFlat(st(), 2000, { transparent }))),
        C.button('3D render PNG', guard(() => S.Export.png3D(st(), 2000))),
        C.button('Proof sheet', guard(() => S.Export.proof(st()))),
        C.button('Vector SVG', guard(() => S.Export.svg(st(), { embedFonts: embed }))),
        C.button('Save recipe .json', () => S.Export.json(st())),
        C.button('Load recipe .json', () => $('#file-json').click()),
        C.button('New blank entry', () => { if (confirm('Replace this entry with a fresh starting design? (Undo is available.)')) S.store.replace(Object.assign(S.defaultState(), { meta: st().meta }), 'Reset'); })),
      C.toggle({ label: 'Transparent PNG outside silhouette', get: () => transparent, set: (x) => { transparent = x; } }),
      C.toggle({ label: 'Embed font subsets in SVG', get: () => embed, set: (x) => { embed = x; } }),
      el('p', { class: 'hint', text: 'PNGs carry a DPI tag so they print at exactly 3.5″ (1000 px = 285.7 ppi, 2000 px = 571.4 ppi).' }));
  }

  /* ---------- placement helpers used by the library ---------- */
  function freeCell(roles) {
    const s = st(), g = S.buildGrid(s);
    const used = new Set(s.layers.filter((l) => l.cell && (l.kind === 'symbol' || l.kind === 'upload' || l.kind === 'label')).map((l) => (S.resolveCell(g, l.cell) || {}).id));
    return S.cellsByRole(g, ...roles).find((c) => !used.has(c.id)) || null;
  }
  S.placeSymbol = function (id) {
    const sym = S.symbolById(id);
    const c = sym.set === 'cobb' ? freeCell(['corner', 'aux', 'telemetry', 'sector', 'cell']) : freeCell(['emblem']) || freeCell(['cell', 'aux']);
    const o = c ? { cell: c.id, scale: 0.86 } : { x: 500, y: 500, size: 220 };
    S.addLayer(S.make.symbol(id, Object.assign(o, { colors: sym.set === 'cobb' ? [1, 0, 2] : [2, 3, 4], angle: S.R.pick(Math.random, S.STITCH_ANGLES) })), 'Add symbol');
  };
  S.placeAsset = function (assetId) {
    const a = st().assets[assetId]; if (!a) return;
    const c = freeCell(['emblem']) || freeCell(['cell', 'aux', 'corner']);
    S.addLayer(S.make.upload(assetId, a.name, c ? { cell: c.id, scale: 0.86 } : { x: 500, y: 500, size: 320 }), 'Place upload');
  };
  S.addAssets = function (assets, place = true) {
    if (!assets.length) return;
    S.store.set((s) => { for (const a of assets) s.assets[a.id] = a; }, 'Upload', { coalesce: false });
    S.toast(`Imported ${assets.length} symbol${assets.length > 1 ? 's' : ''}`);
    if (place) assets.forEach((a) => S.placeAsset(a.id));
  };

  S.Panels = {
    init() {
      const left = $('#panel-left');
      left.append(formatSection(), gridSection(), threadsSection(), typeSection(), symbolsSection(), generateSection(), exportSection());
      S.bus.on('change', () => C.refreshAll());
      S.bus.on('font-list', () => C.refreshAll());
      // files
      $('#file-svg').addEventListener('change', async (e) => { S.addAssets(await S.importSVGFiles(e.target.files)); e.target.value = ''; });
      $('#file-json').addEventListener('change', async (e) => {
        const f = e.target.files[0]; e.target.value = '';
        if (!f) return;
        try { const s = await S.Export.importJSON(f); s.meta.entry = S.ui.entry; S.store.replace(s, 'Load recipe'); S.toast('Recipe loaded into entry ' + S.ui.entry); }
        catch (err) { S.toast(err.message, 'warn'); }
      });
      // drag & drop anywhere
      const hint = $('#drop-hint'); let depth = 0;
      window.addEventListener('dragenter', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) { depth++; hint.classList.add('on'); } });
      window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) hint.classList.remove('on'); });
      window.addEventListener('dragover', (e) => e.preventDefault());
      window.addEventListener('drop', async (e) => {
        e.preventDefault(); depth = 0; hint.classList.remove('on');
        const files = Array.from(e.dataTransfer.files || []);
        const json = files.find((f) => /\.json$/i.test(f.name));
        if (json) { try { const s = await S.Export.importJSON(json); s.meta.entry = S.ui.entry; S.store.replace(s, 'Load recipe'); } catch (err) { S.toast(err.message, 'warn'); } return; }
        S.addAssets(await S.importSVGFiles(files));
      });
      S.Inspector.init();
    },
  };
})(window.SSEP = window.SSEP || {});
