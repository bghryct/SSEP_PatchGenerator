/* ==========================================================================
   Submission package
   One dialog that gathers the student profile, all three entries (with
   pre-flight checks + concept statements) and builds a single .zip:

   SSEP-Patch_<name>_<date>/
     README.txt · submission.json · SSEP_overview.png
     Entry-A_<title>/
       A_flat_1000px.png  A_flat_2000px.png  A_patch.svg
       A_embroidered_2000px.png  A_proof-sheet.png  A_recipe.json
       A_statement.txt  source-svgs/*.svg
   ========================================================================== */
(function (S) {
  'use strict';
  const el = S.el, $ = S.$;

  const OPTS_KEY = 'ssep-package-options';
  const OPTIONS = [
    ['flat1000', 'Flat artwork PNG · 1000 px', 'Official 3.5″ submission artwork', true],
    ['flat2000', 'Flat artwork PNG · 2000 px', 'High-resolution print copy'],
    ['svg', 'Vector SVG', 'Fonts embedded, stitch hints on every shape'],
    ['render3d', '3D embroidered render', 'Standard ¾ hero view, transparent background'],
    ['proof', 'Proof sheet', '1:1 art, 3D, 1″ / 0.5″ legibility, threads, specs'],
    ['recipe', 'Recipe .json', 'Re-open and keep iterating in the studio'],
    ['sources', 'Uploaded source SVGs', 'Your original Session 1 drawings'],
    ['overview', 'Overview board', 'All entries side by side on one sheet'],
  ];
  const opts = Object.assign({ flat1000: true, flat2000: true, svg: true, render3d: true, proof: true, recipe: true, sources: true, overview: true, size3d: 2000, include: { A: true, B: true, C: true } },
    S.store_get(OPTS_KEY, {}));
  opts.flat1000 = true;
  const saveOpts = () => S.store_set(OPTS_KEY, opts);

  const today = () => { const d = new Date(); return d.toISOString().slice(0, 10); };
  const rootName = () => `SSEP-Patch_${S.slug(S.profile.name || 'student')}_${today()}`;
  const entryDir = (e, st) => `Entry-${e}_${S.slug(st.meta.title)}`;

  function statusOf(st) {
    if (!st) return { key: 'empty', label: 'NOT STARTED' };
    const ch = S.entryChecks(st);
    const fails = ch.items.filter((i) => i.ok === false);
    return fails.length ? { key: 'review', label: `REVIEW · ${fails.length}`, ch } : { key: 'ready', label: 'READY', ch };
  }

  /** Files that will be written for one entry (paths only, used for the preview + build). */
  function plan(e, st) {
    const d = entryDir(e, st), f = [];
    if (opts.flat1000) f.push(['flat1000', `${d}/${e}_flat_1000px.png`]);
    if (opts.flat2000) f.push(['flat2000', `${d}/${e}_flat_2000px.png`]);
    if (opts.svg) f.push(['svg', `${d}/${e}_patch.svg`]);
    if (opts.render3d) f.push(['render3d', `${d}/${e}_embroidered_${opts.size3d}px.png`]);
    if (opts.proof) f.push(['proof', `${d}/${e}_proof-sheet.png`]);
    if (opts.recipe) f.push(['recipe', `${d}/${e}_recipe.json`]);
    f.push(['statement', `${d}/${e}_statement.txt`]);
    if (opts.sources) for (const a of Object.values(st.assets || {})) f.push(['source', `${d}/source-svgs/${S.slug(a.name)}.svg`, a]);
    return f;
  }

  /* ---------------- dialog ---------------- */
  let root = null, busy = false, lastZip = null;

  function close() { if (busy || !root) return; root.remove(); root = null; document.removeEventListener('keydown', onKey, true); }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }

  function entryCard(e) {
    const st = S.entryState(e), stat = statusOf(st);
    const card = el('article', { class: 'ecard ' + stat.key });
    const inc = el('input', { type: 'checkbox', checked: !!(st && opts.include[e]), disabled: !st });
    inc.addEventListener('change', () => { opts.include[e] = inc.checked; saveOpts(); refreshTree(); card.classList.toggle('off', !inc.checked); });
    card.classList.toggle('off', !(st && opts.include[e]));
    card.append(el('header', null,
      el('b', { text: `ENTRY ${e}` }), el('span', { class: 'pill ' + stat.key, text: stat.label }),
      el('label', { class: 'toggle' }, inc, el('span', { class: 'box' }), el('span', { class: 'tl', text: 'Include' }))));
    if (!st) {
      card.append(el('div', { class: 'ecard-empty' },
        el('p', { text: 'This entry hasn’t been started. You can submit up to three different patches.' }),
        S.C.button(`Start entry ${e} →`, () => { busy = false; close(); S.loadEntry(e); }, 'small')));
      return card;
    }
    const art = el('div', { class: 'ecard-art' });
    const img = new Image(); img.alt = `Entry ${e} patch`; img.src = S.renderToCanvas(st, 440).toDataURL('image/png');
    art.append(img);
    const words = el('span', { class: 'wc' });
    const ta = el('textarea', { rows: 5, placeholder: 'What message would Baruch send into space? Describe the idea, the symbols you chose and why (50–150 words).' });
    ta.value = st.meta.statement || '';
    const count = () => { const n = ta.value.trim().split(/\s+/).filter(Boolean).length; words.textContent = `${n} WORDS`; words.classList.toggle('warn', n < 20 || n > 200); };
    count();
    ta.addEventListener('input', S.debounce(() => { S.updateEntryMeta(e, { statement: ta.value }); updateChecks(); }, 250));
    ta.addEventListener('input', count);
    const list = el('ul', { class: 'ecard-checks' });
    const updateChecks = () => {
      const s2 = S.entryState(e), ch = S.entryChecks(s2), sStat = statusOf(s2);
      list.innerHTML = '';
      for (const it of ch.items) list.append(el('li', { class: it.ok === true ? 'ok' : it.ok === false ? 'bad' : 'info' }, el('i'), el('span', { text: it.k }), el('b', { text: it.v })));
      const pill = card.querySelector('.pill'); pill.className = 'pill ' + sStat.key; pill.textContent = sStat.label;
      card.classList.remove('ready', 'review'); card.classList.add(sStat.key);
    };
    updateChecks();
    card.append(art,
      el('div', { class: 'ecard-title' }, el('b', { text: st.meta.title || 'Untitled' }), el('span', { text: `${st.meta.subtitle || ''} · ${(S.SHAPES.find((x) => x.id === st.shape) || {}).name || st.shape}`.replace(/^ · /, '') })),
      list,
      el('label', { class: 'ecard-stmt' }, el('span', { class: 'lbl' }, el('span', { text: 'CONCEPT STATEMENT' }), words), ta),
      el('footer', null, S.C.button('Open in editor', () => { close(); if (e !== S.ui.entry) S.loadEntry(e); }, 'small ghost')));
    return card;
  }

  function refreshTree() {
    const pre = root && root.querySelector('.tree'); if (!pre) return;
    const r = rootName(), lines = [`${r}/`, '├─ README.txt', '├─ submission.json'];
    if (opts.overview) lines.push('├─ SSEP_overview.png');
    const inc = S.ENTRIES.filter((e) => opts.include[e] && S.entryState(e));
    inc.forEach((e, ei) => {
      const st = S.entryState(e), files = plan(e, st), lastE = ei === inc.length - 1;
      lines.push(`${lastE ? '└─' : '├─'} ${entryDir(e, st)}/`);
      files.forEach((f, i) => lines.push(`${lastE ? '   ' : '│  '}${i === files.length - 1 ? '└─' : '├─'} ${f[1].split('/').slice(1).join('/')}`));
    });
    pre.textContent = lines.join('\n');
    const n = inc.reduce((a, e) => a + plan(e, S.entryState(e)).length, 0) + 2 + (opts.overview ? 1 : 0);
    root.querySelector('.pkg-count').textContent = `${inc.length} ENTR${inc.length === 1 ? 'Y' : 'IES'} · ${n} FILES`;
    root.querySelector('.pkg-go').disabled = !inc.length;
  }

  function open() {
    if (root) return;
    S.saveEntry && S.store_set('ssep-patch-entry-' + S.ui.entry, S.store.state);
    root = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Submission package' });
    const name = el('input', { type: 'text', placeholder: 'First Last', value: S.profile.name || '', spellcheck: false });
    const section = el('input', { type: 'text', placeholder: 'e.g. ART 3041 · Section MW2', value: S.profile.section || '', spellcheck: false });
    name.addEventListener('input', () => { S.setProfile({ name: name.value }); refreshTree(); });
    section.addEventListener('input', () => S.setProfile({ section: section.value }));
    const optsBox = el('div', { class: 'pkg-opts' });
    for (const [k, t, sub, req] of OPTIONS) {
      const cb = el('input', { type: 'checkbox', checked: !!opts[k], disabled: !!req });
      cb.addEventListener('change', () => { opts[k] = cb.checked; saveOpts(); refreshTree(); });
      optsBox.append(el('label', { class: 'toggle opt' }, cb, el('span', { class: 'box' }), el('span', { class: 'tl' }, el('b', { text: t + (req ? ' · required' : '') }), el('span', { text: sub }))));
    }
    const size = S.C.seg({ label: '3D render size', small: true, options: [[1000, '1000 px'], [2000, '2000 px']], get: () => opts.size3d, set: (v) => { opts.size3d = +v; saveOpts(); S.C.refreshAll(); refreshTree(); } });
    const bar = el('div', { class: 'bar' }, el('i'));
    const log = el('div', { class: 'pkg-log', text: 'Ready when you are. Packaging renders every file fresh, so it takes a few seconds per entry.' });
    const go = S.C.button('Download submission .zip', () => build(name, bar, log), 'primary wide pkg-go');
    const again = el('div', { class: 'pkg-again' });
    const cards = el('div', { class: 'entry-cards' }, ...S.ENTRIES.map(entryCard));
    root.append(el('div', { class: 'modal-card' },
      el('header', { class: 'modal-head' },
        el('div', null, el('span', { class: 'kicker', text: 'SSEP · ISS SPRING 2027 · ART 3041' }), el('h2', { text: 'Submission package' }),
          el('p', { text: 'Bundle your entries into one .zip: artwork, vector file, 3D render, proof sheet, recipe and concept statement for each patch.' })),
        el('button', { type: 'button', class: 'btn ghost close', title: 'Close (Esc)', text: '×', on: { click: close } })),
      el('div', { class: 'modal-body' },
        el('section', { class: 'pkg-side' },
          el('div', { class: 'pkg-step' }, el('span', { class: 'num', text: '01' }), 'Student'),
          S.C.row('Name', name), S.C.row('Section', section),
          el('p', { class: 'hint', text: 'Your name appears on proof sheets and in the package name. Stored only in this browser.' }),
          el('div', { class: 'pkg-step' }, el('span', { class: 'num', text: '03' }), 'Contents'),
          optsBox, size,
          el('div', { class: 'pkg-step' }, el('span', { class: 'num', text: '04' }), 'Package', el('span', { class: 'pkg-count' })),
          el('pre', { class: 'tree' }),
          go, bar, log, again),
        el('section', { class: 'pkg-main' },
          el('div', { class: 'pkg-step' }, el('span', { class: 'num', text: '02' }), 'Entries', el('span', { class: 'sub', text: 'Up to three patches · write a concept statement for each' })),
          cards))));
    root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.append(root);
    refreshTree();
    if (lastZip) showAgain();
    setTimeout(() => (S.profile.name ? null : name.focus()), 50);
  }

  function showAgain() {
    const box = root && root.querySelector('.pkg-again'); if (!box || !lastZip) return;
    box.innerHTML = '';
    box.append(el('span', { text: `Last package: ${lastZip.name} · ${(lastZip.blob.size / 1048576).toFixed(1)} MB` }), S.C.button('Save again', () => S.download(lastZip.blob, lastZip.name), 'small'));
  }

  /* ---------------- build ---------------- */
  const tick = () => new Promise((r) => setTimeout(r, 0));

  async function build(nameInput, bar, log) {
    if (busy) return;
    if (!S.profile.name.trim()) { nameInput.focus(); nameInput.classList.add('invalid'); S.toast('Add your name first — it labels the package.', 'warn'); return; }
    nameInput.classList.remove('invalid');
    const entries = S.ENTRIES.filter((e) => opts.include[e]).map((e) => [e, S.entryState(e)]).filter(([, st]) => st).map(([e, st]) => [e, S.deepClone(st)]);
    if (!entries.length) return;
    busy = true; root.classList.add('busy');
    const fill = bar.firstChild;
    const steps = entries.reduce((a, [e, st]) => a + plan(e, st).length, 0) + (opts.overview ? 1 : 0) + 3;
    let done = 0;
    const step = async (msg) => { done++; fill.style.width = `${Math.min(100, done / steps * 100)}%`; log.textContent = msg; await tick(); };
    try {
      log.textContent = 'Loading fonts…';
      await S.Fonts.loadCurated(); await S.uiFontsReady();
      const zip = new S.ZipWriter(), r = rootName(), summary = [];
      for (const [e, st] of entries) {
        for (const l of st.layers) if (l.font) await S.Fonts.ensure(l.font);
        const files = plan(e, st), checks = S.entryChecks(st), info = { e, st, checks, files: [], img3D: null };
        for (const [kind, path, asset] of files) {
          const full = `${r}/${path}`;
          if (kind === 'flat1000') { await step(`Entry ${e} · flat artwork 1000 px`); zip.add(full, await S.Build.flatPNG(st, 1000)); }
          if (kind === 'flat2000') { await step(`Entry ${e} · flat artwork 2000 px`); zip.add(full, await S.Build.flatPNG(st, 2000)); }
          if (kind === 'svg') { await step(`Entry ${e} · vector SVG + font subsets`); zip.add(full, await S.Build.svg(st, { embedFonts: true })); }
          if (kind === 'render3d') {
            await step(`Entry ${e} · stitching 3D render (${opts.size3d} px)…`);
            const url = await S.View3D.renderState(st, opts.size3d);
            if (url) { zip.add(full, await S.pngSetDPI(await (await fetch(url)).blob(), opts.size3d / S.INCHES)); info.img3D = await S.loadImg(url); }
            else { info.missing3D = true; continue; }
          }
          if (kind === 'proof') {
            await step(`Entry ${e} · proof sheet`);
            if (!info.img3D) { const url = await S.View3D.renderState(st, 900); info.img3D = url ? await S.loadImg(url) : null; }
            zip.add(full, await S.Build.proof(st, info.img3D));
          }
          if (kind === 'recipe') { await step(`Entry ${e} · recipe`); zip.add(full, S.Build.recipe(st)); }
          if (kind === 'statement') { await step(`Entry ${e} · statement`); zip.add(full, statementTxt(e, st)); }
          if (kind === 'source') { await step(`Entry ${e} · source ${asset.name}.svg`); zip.add(full, S.Build.assetSVG(asset)); }
          info.files.push(path);
        }
        if (opts.overview && !info.img3D) { const url = await S.View3D.renderState(st, 900); info.img3D = url ? await S.loadImg(url) : null; }
        summary.push(info);
      }
      if (opts.overview) { await step('Overview board'); zip.add(`${r}/SSEP_overview.png`, await overview(summary)); }
      await step('Manifest');
      zip.add(`${r}/README.txt`, readme(summary, r));
      zip.add(`${r}/submission.json`, JSON.stringify(manifest(summary), null, 2));
      await step('Compressing…');
      const blob = await zip.generate();
      fill.style.width = '100%';
      const name = `${r}.zip`;
      lastZip = { blob, name };
      S.download(blob, name);
      log.textContent = `Done · ${zip.size} files · ${(blob.size / 1048576).toFixed(1)} MB — check your Downloads folder, then upload ${name} to the course submission page.`;
      showAgain();
      S.toast('Submission package downloaded');
    } catch (err) {
      console.error(err);
      log.textContent = 'Packaging failed: ' + err.message;
      S.toast('Packaging failed: ' + err.message, 'warn');
    } finally {
      busy = false; if (root) root.classList.remove('busy');
    }
  }

  function statementTxt(e, st) {
    return [`SSEP MISSION PATCH — ENTRY ${e}`, `${st.meta.title} / ${st.meta.subtitle}`, `${S.profile.name}${S.profile.section ? ' · ' + S.profile.section : ''}`, '',
      'What message would Baruch send into space?', '', (st.meta.statement || '(no statement written)').trim(), ''].join('\n');
  }

  function manifest(summary) {
    return {
      app: 'SSEP Mission Patch Design Studio', version: S.VERSION, packaged: new Date().toISOString(),
      course: 'Baruch College · ART 3041 A.I. for Designers', program: 'SSEP · ISS Spring 2027',
      prompt: 'What message would Baruch send into space?',
      student: { name: S.profile.name, section: S.profile.section },
      format: { inches: [3.5, 3.5], artwork_px: 1000, ppi: +(S.UNITS_PER_IN).toFixed(1) },
      entries: summary.map(({ e, st, checks, files }) => ({
        entry: e, title: st.meta.title, subtitle: st.meta.subtitle, phrase: st.meta.phrase, statement: st.meta.statement || '',
        shape: st.shape, grid: st.grid.preset, seed: st.seed,
        threads: checks.an.threads, palette: st.palette.id,
        typefaces: Array.from(new Set(st.layers.filter(S.isTextLayer).map((l) => `${l.font} ${l.weight}`))),
        checks: checks.items.map((i) => ({ check: i.k, value: i.v, status: i.ok === true ? 'pass' : i.ok === false ? 'review' : 'info' })),
        files,
      })),
    };
  }

  function readme(summary, r) {
    const L = [];
    const line = '='.repeat(72);
    L.push(line, 'SSEP MISSION PATCH — SUBMISSION PACKAGE', 'Baruch College · ART 3041 A.I. for Designers · SSEP ISS Spring 2027', 'Prompt: "What message would Baruch send into space?"', line, '');
    L.push(`Student : ${S.profile.name}`, `Section : ${S.profile.section || '—'}`, `Packaged: ${new Date().toLocaleString()}`, `Entries : ${summary.map((s) => s.e).join(', ')}`, '');
    for (const { e, st, checks, files, missing3D } of summary) {
      L.push('-'.repeat(72), `ENTRY ${e} — ${st.meta.title} / ${st.meta.subtitle}`, '-'.repeat(72));
      if (st.meta.statement) { L.push('Concept:'); L.push(...wrap(st.meta.statement.trim(), 70).map((x) => '  ' + x)); L.push(''); }
      for (const [k, v] of S.entrySpec(st, checks.an)) L.push(`${(k + ':').padEnd(16)}${v}`);
      L.push(`${'THREADS:'.padEnd(16)}${checks.an.threads.map((h) => h.toUpperCase()).join('  ')}`);
      L.push('', 'Checks:');
      for (const i of checks.items) L.push(`  [${i.ok === true ? 'PASS' : i.ok === false ? 'REVIEW' : 'INFO'}] ${i.k} — ${i.v}`);
      if (missing3D) L.push('  [INFO] 3D render skipped — viewer unavailable (offline?)');
      L.push('', 'Files:');
      for (const f of files) L.push('  ' + f.split('/').slice(1).join('/') + describe(f));
      L.push('');
    }
    L.push(line, 'NOTES', line,
      '* *_flat_1000px.png is the official artwork: 3.5 × 3.5 in at 285.7 ppi.',
      '* *_patch.svg is vector artwork with embedded font subsets; data-stitch',
      '  attributes hint satin / tatami / merrow for the embroidery digitizer.',
      '* To keep working: open the studio, then drag *_recipe.json onto the page.',
      '* The 3D render is a simulation for review only, not a production proof.', '',
      `Folder: ${r}/`, '');
    return L.join('\n');
  }
  const describe = (f) => (/flat_1000px/.test(f) ? '   (official artwork)' : /flat_2000px/.test(f) ? '   (print resolution)' : /\.svg$/.test(f) && /source-svgs/.test(f) ? '   (uploaded source)' : /\.svg$/.test(f) ? '   (vector artwork)' : /embroidered/.test(f) ? '   (3D simulation)' : /proof/.test(f) ? '   (proof sheet)' : /recipe/.test(f) ? '   (editable recipe)' : /statement/.test(f) ? '   (concept statement)' : '');
  function wrap(t, n) { const out = []; let cur = ''; for (const w of t.split(/\s+/)) { if ((cur + ' ' + w).trim().length > n) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) out.push(cur); return out; }

  /** Presentation board: every entry side by side at 1:1, with 3D, legibility and statement. */
  async function overview(summary) {
    const { mono, sans } = S.canvasFonts;
    const n = summary.length, colW = 1000, gap = 60, M = 90;
    const W = M * 2 + n * colW + (n - 1) * gap, H = 2140;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const ink = '#111111', mute = '#6b6b6b', line = '#cfccc4', acc = '#ff5a1f';
    g.fillStyle = '#f4f3ef'; g.fillRect(0, 0, W, H);
    g.fillStyle = ink; g.font = sans(58, 700); g.fillText('SSEP MISSION PATCH — SUBMISSION', M, 120);
    g.font = mono(22, 500); g.fillStyle = mute;
    g.fillText(`${(S.profile.name || '').toUpperCase()}${S.profile.section ? ' · ' + S.profile.section.toUpperCase() : ''} · BARUCH COLLEGE · ART 3041 A.I. FOR DESIGNERS · ${today()}`, M, 164);
    g.textAlign = 'right'; g.fillText('“WHAT MESSAGE WOULD BARUCH SEND INTO SPACE?”', W - M, 120); g.textAlign = 'left';
    g.fillStyle = ink; g.fillRect(M, 196, W - 2 * M, 3);
    summary.forEach(({ e, st, checks, img3D }, i) => {
      const x = M + i * (colW + gap); let y = 270;
      g.fillStyle = acc; g.font = mono(22, 700); g.fillText(`ENTRY ${e}`, x, y);
      g.fillStyle = ink; g.font = sans(34, 700); g.fillText(S.wrapText(g, `${st.meta.title}`, colW - 170, 1)[0] || '', x + 150, y);
      y += 30;
      g.drawImage(S.renderToCanvas(st, 1000), x, y);
      g.strokeStyle = line; g.setLineDash([6, 6]); g.strokeRect(x + 0.5, y + 0.5, 1000, 1000); g.setLineDash([]);
      y += 1040;
      g.font = mono(16, 500); g.fillStyle = mute; g.fillText('3.5 × 3.5 IN · 1:1 AT 285.7 PPI', x, y); y += 30;
      g.fillStyle = '#e6e4dd'; g.fillRect(x, y, 380, 380);
      if (img3D) g.drawImage(img3D, x, y, 380, 380);
      const p1 = Math.round(S.UNITS_PER_IN), p05 = Math.round(S.UNITS_PER_IN / 2);
      g.drawImage(S.renderToCanvas(st, p1 * 2), x + 420, y, p1, p1);
      g.drawImage(S.renderToCanvas(st, p05 * 2), x + 420 + p1 + 40, y, p05, p05);
      g.fillStyle = mute; g.font = mono(15, 500);
      g.fillText('3D SIMULATION', x, y + 404); g.fillText('1.0 IN', x + 420, y + p1 + 24); g.fillText('0.5 IN', x + 420 + p1 + 40, y + p05 + 24);
      let cy = y + p1 + 46;
      for (const it of checks.items) {
        g.fillStyle = it.ok === true ? '#1f9d55' : it.ok === false ? '#d93025' : '#8a8a85';
        g.beginPath(); g.arc(x + 426, cy - 5, 5, 0, Math.PI * 2); g.fill();
        g.fillStyle = ink; g.font = mono(15, 500); g.fillText(`${it.k.toUpperCase()}  ${it.v.toUpperCase()}`, x + 440, cy); cy += 20;
      }
      y += 462;
      g.fillStyle = mute; g.font = mono(15, 600); g.fillText('CONCEPT', x, y); y += 30;
      g.fillStyle = ink; g.font = sans(22, 400);
      S.wrapText(g, st.meta.statement || '—', colW, 7).forEach((l, k) => g.fillText(l, x, y + k * 31));
    });
    g.fillStyle = mute; g.font = mono(16, 500);
    g.fillText('Generated with the SSEP Mission Patch Design Studio · 3D stitch simulation is approximate.', M, H - 40);
    return S.pngSetDPI(await S.canvasToBlob(c), S.UNITS_PER_IN);
  }

  S.Package = { open, close };
})(window.SSEP = window.SSEP || {});
