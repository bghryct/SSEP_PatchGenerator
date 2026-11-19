/* ==========================================================================
   Right column + chrome: layer list, layer inspector, 3D viewer controls,
   stitch-map inspector, legibility checks, variation strip, top bar.
   ========================================================================== */
(function (S) {
  'use strict';
  const el = S.el, C = S.C, $ = S.$;
  const st = () => S.store.state;
  const KIND_TAG = { symbol: 'SYM', upload: 'SVG', text: 'TXT', arctext: 'ARC', label: 'LBL', block: 'BLK', motif: 'BG' };

  /* ---------- layer list ---------- */
  function renderLayers() {
    const host = $('#layer-list'); host.innerHTML = '';
    const layers = st().layers;
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      const row = el('div', { class: 'layer' + (L.id === S.ui.selected ? ' on' : '') + (L.visible === false ? ' hidden' : '') },
        el('button', { type: 'button', class: 'ic', title: 'Show / hide', html: L.visible === false ? '○' : '●', on: { click: (e) => { e.stopPropagation(); S.patchLayer(L.id, { visible: L.visible === false }, 'Visibility'); } } }),
        el('span', { class: 'tag', text: KIND_TAG[L.kind] || L.kind }),
        el('span', { class: 'lname', text: L.kind === 'text' || L.kind === 'arctext' ? `${L.name} · “${S.layerText(st(), L).slice(0, 18)}”` : L.name }),
        el('button', { type: 'button', class: 'ic' + (L.locked ? ' on' : ''), title: 'Lock for Generate variation', html: L.locked ? '■' : '□', on: { click: (e) => { e.stopPropagation(); S.patchLayer(L.id, { locked: !L.locked }, 'Lock layer'); } } }));
      row.addEventListener('click', () => S.select(L.id));
      host.append(row);
    }
    if (!layers.length) host.append(el('p', { class: 'hint', text: 'Empty patch. Add symbols or generate a variation.' }));
  }

  /* ---------- inspector ---------- */
  function cellOptions() {
    const g = S.buildGrid(st());
    return [['', '— free position —']].concat(g.cells.filter((c) => c.inside).map((c) => [c.id, `${c.id.toUpperCase()} · ${c.role}`]));
  }
  function fontOptions() {
    const groups = {};
    for (const f of S.Fonts.families()) { const meta = S.FONTS.find((x) => x.family === f); const g = meta ? meta.cat : 'Loaded'; (groups[g] = groups[g] || []).push([f, f]); }
    return Object.entries(groups).map(([group, items]) => ({ group, items }));
  }

  function inspector() {
    const host = $('#inspector'); host.innerHTML = '';
    const L = S.selectedLayer();
    if (!L) { host.append(el('div', { class: 'block-head', text: 'INSPECTOR' }), el('p', { class: 'hint', text: 'Select a layer on the artboard or in the list. Double-click type to edit. Arrows nudge, ⌘D duplicates, ⌫ deletes.' })); return; }
    const id = L.id, get = (k, d) => { const l = S.store.layer(id); return l ? (l[k] == null ? d : l[k]) : d; };
    const put = (k, label) => (v) => S.patchLayer(id, { [k]: v }, label || k);
    const kids = [];
    const head = el('div', { class: 'block-head' }, el('span', { text: `INSPECTOR · ${(KIND_TAG[L.kind] || '').toUpperCase()}` }),
      el('span', { class: 'head-actions' },
        C.button('↑', () => S.moveLayer(id, 1), 'small ghost'), C.button('↓', () => S.moveLayer(id, -1), 'small ghost'),
        C.button('Dup', () => S.duplicateLayer(id), 'small ghost'), C.button('Delete', () => S.removeLayer(id), 'small ghost danger')));
    kids.push(C.text({ label: 'Name', get: () => get('name', ''), set: put('name', 'Rename') }));

    const slots = L.kind === 'symbol' ? S.symbolById(L.symbol).slots : L.kind === 'text' || L.kind === 'arctext' ? 2 : L.kind === 'block' ? 1 : 3;
    const slotNames = L.kind === 'text' || L.kind === 'arctext' ? ['Type', 'Outline'] : L.kind === 'label' ? ['Plate', 'Ink', 'Stripe'] : L.kind === 'symbol' && S.symbolById(L.symbol).set === 'cobb' ? ['Frame', 'Icon', 'Signal'] : ['Thread A', 'Thread B', 'Thread C'];
    const colorRows = [];
    for (let i = 0; i < slots; i++) {
      colorRows.push(C.thread({ label: slotNames[i], get: () => (get('colors', []) || [])[i], set: (v) => S.patchLayer(id, (l) => { const c = (l.colors || []).slice(); c[i] = v; return { colors: c }; }, 'Colour') }));
    }

    if (S.isTextLayer(L)) {
      const ta = C.text({ label: 'Text', multiline: L.kind === 'text', get: () => { const b = get('bind', null); return b ? st().meta[b] : get('text', ''); },
        set: (v) => { const b = get('bind', null); if (b) S.store.set((s) => { s.meta[b] = v; }, 'Meta ' + b); else S.patchLayer(id, { text: v }, 'Text'); } });
      kids.push(C.select({ label: 'Bind to', options: [['', 'Custom text'], ['title', 'Title'], ['subtitle', 'Subtitle'], ['phrase', 'Phrase'], ['code', 'System code']], get: () => get('bind', '') || '', set: (v) => S.patchLayer(id, (l) => ({ bind: v || null, text: v ? l.text : S.layerText(st(), l) }), 'Bind') }), ta);
      S.Inspector.focusText = () => ta.input && ta.input.focus();
      kids.push(C.select({ label: 'Font', dynamic: true, options: fontOptions, get: () => get('font'), set: (v) => { S.Fonts.ensure(v); const ws = S.Fonts.weights(v); S.patchLayer(id, (l) => ({ font: v, weight: ws.includes(l.weight) ? l.weight : ws.reduce((a, b) => (Math.abs(b - 700) < Math.abs(a - 700) ? b : a)) }), 'Font'); } }));
      kids.push(C.select({ label: 'Weight', dynamic: true, options: () => S.Fonts.weights(get('font')).map((w) => [w, String(w)]), get: () => get('weight', 700), set: (v) => S.patchLayer(id, { weight: +v }, 'Weight') }));
      kids.push(C.slider({ label: 'Tracking', min: -60, max: 420, step: 5, get: () => get('tracking', 0), set: put('tracking', 'Tracking'), fmt: (v) => v + '/1000 em' }));
      if (L.kind !== 'label') {
        kids.push(el('div', { class: 'row-pair' },
          C.toggle({ label: 'Uppercase', get: () => get('upper', true) !== false, set: put('upper', 'Case') }),
          C.toggle({ label: 'Auto-fit', get: () => get('autoFit', true) !== false, set: put('autoFit', 'Autofit') })));
        kids.push(C.slider({ label: 'Size (pt-ish)', min: 10, max: 260, step: 1, get: () => get('fontSize', 60), set: (v) => S.patchLayer(id, { fontSize: v, autoFit: false }, 'Size'), fmt: (v) => `${v}u · ${(v * S.MM_PER_UNIT).toFixed(1)} mm` }));
        kids.push(C.toggle({ label: 'Outline (keyline around letters)', get: () => get('outline', false), set: put('outline', 'Outline') }));
        kids.push(C.slider({ label: 'Outline width', min: 1, max: 20, get: () => get('outlineWidth', 6), set: put('outlineWidth', 'Outline w') }));
      }
      if (L.kind === 'text') kids.push(C.seg({ label: 'Align', options: [['left', 'L'], ['center', 'C'], ['right', 'R']], get: () => get('align', 'center'), set: put('align', 'Align') }));
      if (L.kind === 'arctext') {
        kids.push(C.seg({ label: 'Position', options: [['top', 'Top arc'], ['bottom', 'Bottom arc']], get: () => get('pos', 'top'), set: put('pos', 'Arc pos') }));
        kids.push(C.slider({ label: 'Band fill', min: 0.3, max: 0.95, step: 0.01, get: () => get('fill', 0.6), set: put('fill', 'Band fill'), fmt: (v) => (v * 100).toFixed(0) + '%' }));
        kids.push(C.slider({ label: 'Max span', min: 0, max: 300, step: 2, get: () => get('span', 0), set: put('span', 'Span'), fmt: (v) => (v ? v + '°' : 'auto') }));
        kids.push(C.slider({ label: 'Radius offset', min: -200, max: 60, step: 1, get: () => get('offset', 0), set: put('offset', 'Offset') }));
        kids.push(C.slider({ label: 'Rotate', min: -180, max: 180, step: 1, get: () => get('rot', 0), set: put('rot', 'Rotate'), fmt: (v) => v + '°' }));
      }
      if (L.kind === 'label') {
        const cobb = S.symbolsBySet('cobb').map((s) => [s.id, s.name]);
        kids.push(C.select({ label: 'Pictogram', options: [['', '— none —']].concat(cobb), get: () => get('icon', '') || '', set: (v) => S.patchLayer(id, { icon: v || null }, 'Icon') }));
        kids.push(C.toggle({ label: 'Hazard stripe tab', get: () => get('stripes', false), set: put('stripes', 'Stripes') }));
      }
    }

    if (L.kind === 'symbol') {
      const groups = [{ group: 'Microgravity (Klein)', items: S.symbolsBySet('klein').map((s) => [s.id, s.name]) }, { group: 'Semiotic (Cobb)', items: S.symbolsBySet('cobb').map((s) => [s.id, s.name]) }];
      kids.push(C.select({ label: 'Symbol', options: groups, get: () => get('symbol'), set: (v) => S.patchLayer(id, { symbol: v, name: S.symbolById(v).name }, 'Symbol') }));
      if (S.symbolById(L.symbol).set === 'cobb') kids.push(C.seg({ label: 'Frame', options: [['solid', 'Solid'], ['outline', 'Outline'], ['none', 'None']], get: () => get('frame', 'solid'), set: put('frame', 'Frame') }));
    }
    if (L.kind === 'upload') {
      kids.push(C.seg({ label: 'Colour', options: [['palette', 'Palette'], ['mono', 'Mono'], ['nearest', 'Nearest'], ['original', 'Original']], get: () => get('recolor', 'palette'), set: put('recolor', 'Recolour') }));
      kids.push(C.toggle({ label: 'Drop white background shape', get: () => get('dropBg', true) !== false, set: put('dropBg', 'Drop bg') }));
      kids.push(C.slider({ label: 'Stroke weight', min: 0.25, max: 4, step: 0.05, get: () => get('strokeBoost', 1), set: put('strokeBoost', 'Stroke'), fmt: (v) => '×' + v.toFixed(2) }));
    }
    if (L.kind === 'motif') {
      kids.push(C.select({ label: 'Motif', options: S.MOTIFS.filter((m) => m.id !== 'none').map((m) => [m.id, m.name]), get: () => get('motif'), set: (v) => S.patchLayer(id, { motif: v, name: 'Motif · ' + S.MOTIFS.find((m) => m.id === v).name }, 'Motif') }));
      kids.push(C.slider({ label: 'Density', min: 0, max: 1, step: 0.01, get: () => get('density', 0.5), set: put('density', 'Density') }));
      kids.push(C.slider({ label: 'Position / angle', min: 0, max: 1, step: 0.01, get: () => get('param', 0.5), set: put('param', 'Param') }));
      kids.push(C.row('Seed', C.button('Re-roll motif', () => S.patchLayer(id, { seed: Math.floor(Math.random() * 9999) + 1 }, 'Reroll'), 'small')));
    }

    kids.push(C.sub('Threads', ...colorRows));

    if (L.kind !== 'motif' && L.kind !== 'arctext') {
      const place = [C.select({ label: 'Grid cell', dynamic: true, options: cellOptions, get: () => get('cell', '') || '', set: (v) => {
        const g = S.buildGrid(st());
        S.patchLayer(id, (l) => { if (!v) { const fr = S.layerFrame(l, g); return { cell: null, x: fr.x, y: fr.y, size: Math.round(fr.size) }; } return { cell: v, dx: 0, dy: 0 }; }, 'Cell');
      } })];
      if (L.kind !== 'block') {
        place.push(C.slider({ label: 'Scale in cell', min: 0.1, max: 1.6, step: 0.01, get: () => get('scale', 0.86), set: put('scale', 'Scale'), fmt: (v) => (v * 100).toFixed(0) + '%' }));
        place.push(C.slider({ label: 'Free size', min: 20, max: 1000, step: 1, get: () => get('size', 200), set: (v) => S.patchLayer(id, (l) => { if (l.cell) { const fr = S.layerFrame(l, S.buildGrid(st())); return { cell: null, x: fr.x, y: fr.y, size: v }; } return { size: v }; }, 'Size'), fmt: (v) => (v / S.UNITS_PER_IN).toFixed(2) + '″' }));
        place.push(C.slider({ label: 'Rotate', min: -180, max: 180, step: 1, get: () => get('rot', 0), set: put('rot', 'Rotate'), fmt: (v) => v + '°' }));
        place.push(el('div', { class: 'row-pair' },
          C.toggle({ label: 'Mirror', get: () => get('mirror', false), set: put('mirror', 'Mirror') }),
          C.toggle({ label: 'Orient to sector', get: () => get('orient', false), set: put('orient', 'Orient') })));
      }
      kids.push(C.sub('Placement', ...place));
    }
    if (L.kind === 'symbol' || L.kind === 'upload') {
      kids.push(C.sub('Procedural repeat',
        C.select({ label: 'Tile', options: [['none', 'None'], ['radial', 'Radial orbit'], ['row', 'Row'], ['column', 'Column'], ['cells', 'Every cell of this role'], ['mirror', 'Four-way mirror']], get: () => (get('tile', {}) || {}).mode || 'none', set: (v) => S.patchLayer(id, (l) => ({ tile: Object.assign({ count: 6 }, l.tile, { mode: v }) }), 'Tile') }),
        C.slider({ label: 'Count', min: 2, max: 24, get: () => (get('tile', {}) || {}).count || 6, set: (v) => S.patchLayer(id, (l) => ({ tile: Object.assign({}, l.tile, { count: v }) }), 'Tile count') }),
        C.slider({ label: 'Spacing', min: 0.6, max: 2.5, step: 0.05, get: () => (get('tile', {}) || {}).spacing || 1.15, set: (v) => S.patchLayer(id, (l) => ({ tile: Object.assign({}, l.tile, { spacing: v }) }), 'Tile spacing'), fmt: (v) => '×' + v.toFixed(2) }),
        C.toggle({ label: 'Rotate copies with orbit', get: () => (get('tile', {}) || {}).orient !== false, set: (v) => S.patchLayer(id, (l) => ({ tile: Object.assign({}, l.tile, { orient: v }) }), 'Tile orient') })));
    }
    kids.push(C.sub('Stitch',
      C.seg({ label: 'Type', small: true, options: S.STITCHES.map((x) => [x.id, x.name]), get: () => get('stitch', 'auto'), set: put('stitch', 'Stitch') }),
      C.slider({ label: 'Fill angle', min: 0, max: 175, step: 5, get: () => get('angle', 45), set: put('angle', 'Angle'), fmt: (v) => v + '°' })));
    kids.push(C.toggle({ label: 'Lock this layer for Generate', cls: 'lock', get: () => get('locked', false), set: put('locked', 'Lock layer') }));
    host.append(head, el('div', { class: 'insp-body' }, ...kids));
  }

  /* ---------- 3D controls, maps ---------- */
  function viewerControls() {
    const host = $('#viewer-controls'); const V = S.View3D;
    const pad = el('canvas', { class: 'lightpad', width: 160, height: 160, title: 'Drag to move the key light' });
    const drawPad = () => {
      const c = pad.getContext('2d'), L = V.viewer.light, cs = getComputedStyle(document.documentElement);
      c.clearRect(0, 0, 160, 160);
      c.strokeStyle = cs.getPropertyValue('--line').trim(); c.lineWidth = 2;
      for (const r of [74, 50, 26]) { c.beginPath(); c.arc(80, 80, r, 0, Math.PI * 2); c.stroke(); }
      c.beginPath(); c.moveTo(6, 80); c.lineTo(154, 80); c.moveTo(80, 6); c.lineTo(80, 154); c.stroke();
      const rr = (1 - L.el / 90) * 74, a = S.rad(L.az);
      const x = 80 + rr * Math.cos(a), y = 80 - rr * Math.sin(a);
      c.fillStyle = cs.getPropertyValue('--accent').trim(); c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.fill();
    };
    const setFrom = (e) => {
      const r = pad.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 160 - 80, y = 80 - (e.clientY - r.top) / r.height * 160;
      const d = Math.min(74, Math.hypot(x, y));
      V.viewer.setLight({ az: S.deg(Math.atan2(y, x)), el: Math.max(4, 90 * (1 - d / 74)) }); drawPad();
    };
    pad.addEventListener('pointerdown', (e) => { pad.setPointerCapture(e.pointerId); setFrom(e); pad.onpointermove = setFrom; });
    pad.addEventListener('pointerup', () => { pad.onpointermove = null; });
    S.bus.on('theme', drawPad);
    const o = V.viewer.opts;
    host.append(
      el('div', { class: 'vc-row' },
        el('div', { class: 'seg small' }, ...[['front', 'Front'], ['tilt', 'Tilt'], ['edge', 'Edge'], ['raking', 'Raking']].map(([v, t]) => el('button', { type: 'button', text: t, on: { click: () => { V.viewer.view(v); drawPad(); } } }))),
        C.toggle({ label: 'Orbit', get: () => V.viewer.controls && V.viewer.controls.autoRotate, set: (x) => V.viewer.setAutoRotate(x) })),
      el('div', { class: 'vc-grid' }, el('div', { class: 'padwrap' }, pad, el('span', { class: 'cap', text: 'KEY LIGHT' })),
        el('div', { class: 'vc-sliders' },
          C.slider({ label: 'Light', min: 0, max: 6, step: 0.1, get: () => V.viewer.light.intensity, set: (v) => V.viewer.setLight({ intensity: v }), fmt: (v) => v.toFixed(1) }),
          C.slider({ label: 'Relief', min: 0, max: 2.5, step: 0.05, get: () => V.relief, set: (v) => { V.relief = v; V.schedule(); }, fmt: (v) => v.toFixed(2) }),
          C.slider({ label: 'Thread sheen', min: 0, max: 1, step: 0.01, get: () => o.anisotropy, set: (v) => V.viewer.setOptions({ anisotropy: v }), fmt: (v) => v.toFixed(2) }),
          C.slider({ label: 'Fibre sheen', min: 0, max: 1, step: 0.01, get: () => o.sheen, set: (v) => V.viewer.setOptions({ sheen: v }), fmt: (v) => v.toFixed(2) }),
          C.seg({ label: 'Maps', small: true, options: [[1024, '1K'], [2048, '2K']], get: () => V.quality, set: (v) => { V.quality = +v; C.refreshAll(); V.synth(); } }))));
    V.viewer.ready.then(drawPad).catch(() => {});
    const maps = $('#maps');
    S.bus.on('maps', (m) => {
      maps.innerHTML = '';
      for (const [k, t] of [['color', 'COLOUR'], ['height', 'HEIGHT'], ['normal', 'NORMAL'], ['rough', 'ROUGH'], ['aniso', 'ANISO']]) {
        const c = el('canvas', { width: 128, height: 128 }); c.getContext('2d').drawImage(m[k], 0, 0, 128, 128);
        maps.append(el('figure', { title: t + ' map' }, c, el('figcaption', { text: t })));
      }
    });
  }

  /* ---------- legibility checks + variation strip ---------- */
  function checks(a) {
    const host = $('#checks'); host.innerHTML = '';
    const item = (ok, k, v) => host.append(el('div', { class: 'check ' + (ok === true ? 'ok' : ok === false ? 'bad' : 'info') }, el('span', { class: 'dot' }), el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v })));
    item(a.threads.length <= 6, 'THREADS', `${a.threads.length} / 6`);
    if (a.minCapMM != null) {
      item(a.minCapMM >= 4, 'MIN CAP HEIGHT', `${a.minCapMM.toFixed(1)} mm @ 3.5″`);
      item(a.minCapMM * (1 / 3.5) * 3.78 >= 1.6 ? true : null, 'AT 1″ PREVIEW', `${(a.minCapMM / 3.5 * 3.78).toFixed(1)} px cap`);
    } else item(null, 'TYPE', 'none');
    item(a.lowContrast.length === 0, 'TYPE CONTRAST', a.lowContrast.length ? `${a.lowContrast.length} low` : 'OK');
    const bw = st().borderWidth * S.MM_PER_UNIT;
    item(bw >= 2.5 && bw <= 6.5 ? true : null, 'MERROW EDGE', `${bw.toFixed(1)} mm`);
  }
  function variations() {
    const host = $('#history-strip'); host.innerHTML = '';
    host.append(el('span', { class: 'strip-label', text: 'VARIATIONS' }));
    S.ui.variations.forEach((v, i) => {
      const b = el('button', { type: 'button', class: 'var', title: `Seed ${v.seed} — click to restore` }, el('img', { src: v.thumb, alt: '' }), el('span', { text: String(v.seed).slice(-4) }));
      b.addEventListener('click', () => { S.store.replace(JSON.parse(v.json), 'Restore variation'); S.select(null); });
      host.append(b);
      if (i === 0) b.classList.add('latest');
    });
  }

  /* ---------- top bar ---------- */
  function topbar() {
    $('#btn-undo').addEventListener('click', () => S.store.undo());
    $('#btn-redo').addEventListener('click', () => S.store.redo());
    $('#btn-generate').addEventListener('click', () => S.generateVariation());
    $('#btn-theme').addEventListener('click', () => S.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
    S.$$('#view-mode button').forEach((b) => b.addEventListener('click', () => S.setView(b.dataset.view)));
    $('#btn-submit').addEventListener('click', () => S.Package.open());
    S.$$('#entries button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.entry !== S.ui.entry) S.loadEntry(b.dataset.entry); }));
    const thumbs = S.debounce(() => {
      for (const b of S.$$('#entries button')) {
        const e = b.dataset.entry, st = S.entryState(e);
        b.classList.toggle('on', e === S.ui.entry);
        b.innerHTML = '';
        if (st) {
          const img = new Image(); img.alt = ''; img.src = S.renderToCanvas(st, 64).toDataURL('image/png'); b.append(img);
          const fails = S.entryChecks(st).items.filter((i) => i.ok === false).length;
          b.append(el('span', { class: 'el', text: e }), el('i', { class: 'dot ' + (fails ? 'review' : 'ready') }));
          b.title = `Entry ${e} — ${st.meta.title}${fails ? ` · ${fails} check(s) to review` : ' · ready'}`;
        } else { b.append(el('span', { class: 'ph' }), el('span', { class: 'el', text: e })); b.title = `Entry ${e} — not started`; }
      }
    }, 350);
    S.bus.on('entry', thumbs); S.bus.on('entries', thumbs); S.bus.on('fonts', thumbs);
    const status = $('#save-status');
    S.bus.on('saved', () => { status.textContent = 'SAVED · ENTRY ' + S.ui.entry; });
    S.bus.on('change', () => {
      $('#btn-undo').disabled = !S.store.past.length; $('#btn-redo').disabled = !S.store.future.length;
      const s = st(), g = S.GRID_PRESETS.find((x) => x.id === s.grid.preset);
      $('#ws-grid').textContent = `${(S.SHAPES.find((x) => x.id === s.shape) || {}).name || s.shape} · ${g ? g.name : s.grid.preset}`.toUpperCase();
      $('#ws-seed').textContent = 'SEED ' + s.seed;
    });
  }

  S.Inspector = {
    focusText: null,
    init() {
      topbar(); viewerControls();
      const rebuild = S.rafOnce(() => { renderLayers(); inspector(); });
      let listSig = '', inspSig = '';
      const list = S.rafOnce(renderLayers);
      const sigOf = (L) => (L ? L.id + L.kind + (L.symbol || '') + (L.bind || '') : '');
      S.bus.on('select', (id) => {
        inspSig = sigOf(S.selectedLayer()); rebuild();
        if (!id) return;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const panel = $('.panel.right'), insp = $('#inspector');
          if (!panel || !insp || S.ui.view === '3d') return;
          const top = insp.offsetTop - panel.scrollTop;
          if (top > panel.clientHeight * 0.6 || top < 0) panel.scrollTo({ top: Math.max(0, insp.offsetTop - panel.clientHeight * 0.18), behavior: 'smooth' });
        }));
      });
      S.bus.on('change', (d) => {
        const L = S.selectedLayer();
        if (S.ui.selected && !L) S.select(null);
        const ls = st().layers.map((l) => l.id + (l.visible === false) + l.locked + l.name + S.layerText(st(), l)).join('|');
        const is = sigOf(L);
        if ((d && d.structural) || is !== inspSig) { listSig = ls; inspSig = is; rebuild(); }
        else if (ls !== listSig) { listSig = ls; list(); }
      });
      S.bus.on('font-list', rebuild);
      S.bus.on('analysis', checks);
      S.bus.on('variations', variations);
      S.bus.on('focus-text', (id) => { S.select(id); setTimeout(() => S.Inspector.focusText && S.Inspector.focusText(), 50); });
    },
  };
})(window.SSEP = window.SSEP || {});
