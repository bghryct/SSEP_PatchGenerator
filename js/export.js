/* ==========================================================================
   Export pipeline
   S.Build.*  → produce Blobs / strings for one design state (used by single
               downloads and by the submission package)
   S.Export.* → download wrappers for the Export panel
   ========================================================================== */
(function (S) {
  'use strict';

  S.fileBase = (state) => `SSEP_${S.slug(state.meta.title)}_Entry-${state.meta.entry || 'A'}`;

  S.renderToCanvas = function (state, px, opts = {}) {
    const c = document.createElement('canvas'); c.width = c.height = px;
    const ctx = c.getContext('2d');
    if (opts.background) { ctx.fillStyle = opts.background; ctx.fillRect(0, 0, px, px); }
    S.renderPatch(state, new S.CanvasBackend(ctx, px));
    return c;
  };

  async function uiFontsReady() {
    await Promise.all([300, 400, 500, 600, 700].flatMap((w) => [
      document.fonts.load(`${w} 20px "${S.UI_SANS}"`), document.fonts.load(`${w} 20px "${S.UI_MONO}"`)])).catch(() => {});
  }
  S.uiFontsReady = uiFontsReady;
  const mono = (sz, wt = 500) => `${wt} ${sz}px "${S.UI_MONO}", monospace`;
  const sans = (sz, wt = 600) => `${wt} ${sz}px "${S.UI_SANS}", sans-serif`;
  S.canvasFonts = { mono, sans };

  /** Wrap text into lines that fit maxW; returns the lines. */
  S.wrapText = function (g, text, maxW, maxLines = 99) {
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ');
    const lines = []; let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
      if (lines.length >= maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + ' …';
    return lines;
  };

  const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  S.loadImg = loadImg;

  S.Build = {
    async flatPNG(state, px = 1000, opts = {}) {
      const c = S.renderToCanvas(state, px, { background: opts.transparent === false ? '#ffffff' : null });
      return S.pngSetDPI(await S.canvasToBlob(c), px / S.INCHES);
    },

    async svg(state, opts = {}) {
      const b = new S.SVGBackend();
      S.renderPatch(state, b);
      let css = '';
      if (opts.embedFonts !== false) { try { css = await S.Fonts.embedCSS(b.fonts); } catch (e) { console.warn(e); } }
      const threads = S.threadList(state).map((h, i) => `T${i}:${h}`).join(' ');
      return b.toString({ fontCSS: css, title: `${state.meta.title} — SSEP mission patch`, desc: `3.5 x 3.5 in · ${state.shape} · grid ${state.grid.preset} · threads ${threads} · seed ${state.seed} · SSEP Mission Patch Design Studio` });
    },

    recipe(state) {
      return JSON.stringify(Object.assign({ app: 'ssep-patch-studio', version: S.VERSION, saved: new Date().toISOString() }, state), null, 1);
    },

    /** 3D embroidered render of any state (temporarily loaded into the viewer). */
    async render3D(state, px = 2000) {
      const url = await S.View3D.renderState(state, px);
      if (!url) return null;
      return S.pngSetDPI(await (await fetch(url)).blob(), px / S.INCHES);
    },

    /** The uploaded original, or a normalised SVG rebuilt from parsed paths. */
    assetSVG(a) {
      if (a.src) return a.src;
      const [x, y, w, h] = a.vb;
      const body = a.items.filter((i) => !i.bg).map((i) => {
        let at = ` fill="${i.fill || 'none'}"`;
        if (i.rule === 'evenodd') at += ' fill-rule="evenodd"';
        if (i.stroke) at += ` stroke="${i.stroke}" stroke-width="${i.sw}" stroke-linecap="${i.cap}" stroke-linejoin="${i.join}"`;
        return `<path d="${i.d}"${at} transform="matrix(${i.m.join(' ')})"/>`;
      }).join('\n');
      return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}">\n${body}\n</svg>\n`;
    },

    /** Proof sheet canvas → Blob. img3D: an image/canvas of the 3D render (optional). */
    async proof(state, img3D) {
      await uiFontsReady();
      const W = 2400, H = 1500, c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      const ink = '#111111', mute = '#6b6b6b', rule = '#c9c9c9';
      g.fillStyle = '#f4f3ef'; g.fillRect(0, 0, W, H);
      g.fillStyle = ink; g.font = sans(44, 700); g.textBaseline = 'alphabetic';
      g.fillText('SSEP MISSION PATCH — PROOF SHEET', 80, 96);
      g.font = mono(20); g.fillStyle = mute;
      const date = new Date().toISOString().slice(0, 10), who = (S.profile.name || '').toUpperCase();
      g.fillText(`BARUCH COLLEGE · ART 3041 A.I. FOR DESIGNERS · ENTRY ${state.meta.entry || 'A'}${who ? ' · ' + who : ''}${S.profile.section ? ' · ' + S.profile.section.toUpperCase() : ''} · ${date}`, 80, 132);
      g.textAlign = 'right'; g.fillText('“WHAT MESSAGE WOULD BARUCH SEND INTO SPACE?”', W - 80, 96); g.textAlign = 'left';
      g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); g.moveTo(80, 160); g.lineTo(W - 80, 160); g.stroke();

      g.drawImage(S.renderToCanvas(state, 1000), 80, 220);
      g.strokeStyle = rule; g.lineWidth = 1; g.setLineDash([6, 6]); g.strokeRect(80.5, 220.5, 1000, 1000); g.setLineDash([]);
      g.font = mono(18); g.fillStyle = mute;
      g.fillText('A · FLAT ARTWORK · 3.5 × 3.5 IN · 1:1 AT 285.7 PPI', 80, 1252);

      g.fillStyle = '#e6e4dd'; g.fillRect(1140, 220, 640, 640);
      if (img3D) g.drawImage(img3D, 1140, 220, 640, 640);
      g.fillStyle = mute; g.fillText(img3D ? 'B · SIMULATED EMBROIDERY' : 'B · 3D RENDER UNAVAILABLE', 1140, 892);

      let x = 1840;
      for (const [inch, label] of [[1, 'C · 1.0 IN'], [0.5, 'D · 0.5 IN']]) {
        const px = Math.round(inch * S.UNITS_PER_IN);
        g.drawImage(S.renderToCanvas(state, px * 2), x, 220, px, px);
        g.fillStyle = mute; g.fillText(label, x, 220 + px + 30);
        x += px + 50;
      }
      const gray = S.renderToCanvas(state, 572), gg = gray.getContext('2d'), id = gg.getImageData(0, 0, 572, 572);
      for (let i = 0; i < id.data.length; i += 4) { const v = 0.2126 * id.data[i] + 0.7152 * id.data[i + 1] + 0.0722 * id.data[i + 2]; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; }
      gg.putImageData(id, 0, 0);
      g.drawImage(gray, 1840, 600, 286, 286);
      g.fillStyle = mute; g.fillText('E · VALUE CHECK 1.0 IN', 1840, 916);

      const an = S.analyze(state);
      let y = 980;
      g.fillStyle = ink; g.font = sans(26, 700); g.fillText('THREADS', 1140, y);
      y += 24;
      const pal = S.paletteById(state.palette.id);
      S.threadList(state).forEach((hex, i) => {
        const yy = y + i * 44, used = an.threads.includes(hex.toLowerCase());
        g.fillStyle = hex; g.fillRect(1140, yy, 34, 34); g.strokeStyle = rule; g.strokeRect(1140.5, yy + 0.5, 34, 34);
        g.fillStyle = used ? ink : mute; g.font = mono(19);
        const name = pal.threads[i] && pal.threads[i].hex.toLowerCase() === hex.toLowerCase() ? pal.threads[i].name : 'Custom';
        g.fillText(`T${i}  ${hex.toUpperCase()}  ${name.toUpperCase()}${used ? '' : '  (unused)'}`, 1190, yy + 24);
      });
      const spec = S.entrySpec(state, an);
      g.fillStyle = ink; g.font = sans(26, 700); g.fillText('SPECIFICATION', 1840, 980);
      spec.forEach(([k, v], i) => {
        const yy = 1024 + i * 44;
        g.fillStyle = mute; g.font = mono(16, 500); g.fillText(k, 1840, yy);
        g.fillStyle = ink; g.font = mono(17, 600);
        g.fillText(S.wrapText(g, v, 470, 1)[0] || '', 1840, yy + 21);
      });
      if (state.meta.statement) {
        g.fillStyle = mute; g.font = mono(16, 500); g.fillText('CONCEPT', 80, 1310);
        g.fillStyle = ink; g.font = sans(22, 400);
        S.wrapText(g, state.meta.statement, 980, 4).forEach((l, i) => g.fillText(l, 80, 1344 + i * 30));
      }
      g.fillStyle = mute; g.font = mono(16);
      g.fillText('SSEP Mission Patch Design Studio · stitch simulation is approximate — confirm with your digitizer.', 1140, H - 60);
      return S.pngSetDPI(await S.canvasToBlob(c), S.UNITS_PER_IN);
    },
  };

  /** Human-readable spec rows shared by proof sheets and the package manifest. */
  S.entrySpec = function (state, an = S.analyze(state)) {
    const fonts = Array.from(new Set(state.layers.filter(S.isTextLayer).filter((l) => l.visible !== false).map((l) => `${l.font} ${l.weight}`)));
    return [
      ['FORMAT', `${state.shape.toUpperCase()} · 3.5 × 3.5 IN`],
      ['BORDER', `MERROWED ${(state.borderWidth * S.MM_PER_UNIT).toFixed(1)} MM${state.keyline ? ' + KEYLINE ' + (state.keylineWidth * S.MM_PER_UNIT).toFixed(1) + ' MM' : ''}`],
      ['GRID', state.grid.preset.toUpperCase()],
      ['GROUND', state.bgStitch === 'twill' ? 'EXPOSED TWILL' : `TATAMI FILL ${state.bgAngle}°`],
      ['THREAD COUNT', `${an.threads.length} OF 6 MAX`],
      ['MIN CAP HEIGHT', an.minCapMM == null ? '—' : `${an.minCapMM.toFixed(1)} MM ${an.minCapMM < 4 ? '(BELOW 4 MM)' : '(OK)'}`],
      ['TYPE', fonts.join(' / ').toUpperCase() || '—'],
      ['SEED', String(state.seed)],
    ];
  };

  /** Pre-flight checks for one entry (used by the checks strip and submission dialog). */
  S.entryChecks = function (state) {
    const an = S.analyze(state), bw = state.borderWidth * S.MM_PER_UNIT;
    const words = String(state.meta.statement || '').trim().split(/\s+/).filter(Boolean).length;
    return {
      an, words,
      items: [
        { k: 'Threads', v: `${an.threads.length} / 6`, ok: an.threads.length <= 6 },
        { k: 'Min cap height', v: an.minCapMM == null ? 'no type' : `${an.minCapMM.toFixed(1)} mm`, ok: an.minCapMM == null ? null : an.minCapMM >= 4 },
        { k: 'Type contrast', v: an.lowContrast.length ? `${an.lowContrast.length} low` : 'OK', ok: an.lowContrast.length === 0 },
        { k: 'Merrow edge', v: `${bw.toFixed(1)} mm`, ok: bw >= 2.5 && bw <= 6.5 ? true : null },
        { k: 'Concept statement', v: words ? `${words} words` : 'missing', ok: words >= 20 ? true : words ? null : false },
      ],
    };
  };

  const guard = async (fn) => { try { S.toast('Exporting…'); await fn(); } catch (e) { console.error(e); S.toast('Export failed: ' + e.message, 'warn'); } };

  S.Export = {
    pngFlat: (state, px = 1000, opts = {}) => guard(async () => { await S.Fonts.loadCurated(); S.download(await S.Build.flatPNG(state, px, opts), `${S.fileBase(state)}_flat_${px}px.png`); }),
    png3D: (state, px = 2000) => guard(async () => {
      const b = await S.Build.render3D(state, px);
      if (!b) { S.toast('3D viewer is not ready yet', 'warn'); return; }
      S.download(b, `${S.fileBase(state)}_embroidered_${px}px.png`);
    }),
    svg: (state, opts) => guard(async () => S.download(new Blob([await S.Build.svg(state, opts)], { type: 'image/svg+xml' }), `${S.fileBase(state)}.svg`)),
    json: (state) => S.download(new Blob([S.Build.recipe(state)], { type: 'application/json' }), `${S.fileBase(state)}_recipe.json`),
    proof: (state) => guard(async () => {
      await S.Fonts.loadCurated();
      const url = await S.View3D.renderState(state, 900);
      const img = url ? await loadImg(url) : null;
      S.download(await S.Build.proof(state, img), `${S.fileBase(state)}_proof.png`);
    }),
    async importJSON(file) {
      const data = JSON.parse(await S.readFileText(file));
      if (!data || !Array.isArray(data.layers) || !data.palette) throw new Error('Not a patch recipe file');
      delete data.app; delete data.version; delete data.saved;
      return S.migrate(data);
    },
  };

  /** Bring older / partial recipes up to the current schema. */
  S.migrate = function (s) {
    const d = S.defaultState();
    const out = Object.assign({}, d, s);
    out.meta = Object.assign({}, d.meta, s.meta || {});
    out.grid = Object.assign({}, d.grid, s.grid || {});
    out.locks = Object.assign({}, d.locks, s.locks || {});
    out.palette = Object.assign({}, d.palette, s.palette || {});
    out.assets = s.assets || {};
    out.layers = (s.layers || []).map((l) => Object.assign({ id: S.uid('l'), visible: true }, l));
    if (out.meta.student && S.profile && !S.profile.name) S.setProfile({ name: out.meta.student });
    delete out.meta.student;
    return out;
  };
})(window.SSEP = window.SSEP || {});
