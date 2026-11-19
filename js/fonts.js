/* ==========================================================================
   Google Fonts — curated loader, live search for any family by name, and
   subset embedding (base64 WOFF2) so exported SVGs are self-contained.
   ========================================================================== */
(function (S) {
  'use strict';
  const API = 'https://fonts.googleapis.com/css2?family=';
  const enc = (fam) => encodeURIComponent(fam).replace(/%20/g, '+');
  const known = new Map(S.FONTS.map((f) => [f.family, f.weights.slice()]));
  const pending = new Map();
  const notify = S.debounce(() => { S.clearTextCaches(); S.bus.emit('fonts'); }, 60);

  function addLink(family, weights) {
    return new Promise((res, rej) => {
      const href = API + enc(family) + ':wght@' + weights.join(';') + '&display=block';
      if (document.querySelector(`link[data-font="${CSS.escape(family)}"]`)) return res();
      const l = S.el('link', { rel: 'stylesheet', href, 'data-font': family });
      l.onload = () => res(); l.onerror = () => rej(new Error('Font stylesheet failed: ' + family));
      document.head.append(l);
    });
  }

  S.Fonts = {
    weights: (family) => known.get(family) || [400, 700],
    families: () => Array.from(known.keys()),
    isKnown: (family) => known.has(family),

    /** Load a family (all of its known weights). Resolves when faces are ready. */
    ensure(family) {
      if (!family) return Promise.resolve();
      if (pending.has(family)) return pending.get(family);
      const ws = known.get(family) || [400, 700];
      const p = addLink(family, ws)
        .then(() => Promise.all(ws.map((w) => document.fonts.load(`${w} 40px "${family}"`, 'BARUCH 0123'))))
        .then(() => notify())
        .catch((e) => { console.warn(e); notify(); });
      pending.set(family, p);
      return p;
    },

    loadCurated() { return Promise.all(S.FONTS.map((f) => this.ensure(f.family))); },

    /** Look up any Google Font by name; discovers which weights exist. */
    async search(name) {
      const family = String(name || '').trim().replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      if (!family) throw new Error('Type a font family name');
      if (known.has(family)) { await this.ensure(family); return family; }
      // legacy CSS API: one request, silently ignores weights the family does not ship
      const css = await fetch('https://fonts.googleapis.com/css?family=' + enc(family) + ':100,200,300,400,500,600,700,800,900')
        .then((r) => (r.ok ? r.text() : '')).catch(() => '');
      const ws = Array.from(new Set(Array.from(css.matchAll(/font-weight:\s*(\d+)/g)).map((m) => +m[1]))).sort((a, b) => a - b);
      if (!ws.length) throw new Error(`“${family}” was not found on Google Fonts`);
      known.set(family, ws);
      S.bus.emit('font-list');
      await this.ensure(family);
      return family;
    },

    /** CSS with base64 WOFF2 subsets for the glyphs an SVG actually uses. */
    async embedCSS(usage) {
      let css = '', imports = '';
      for (const [key, chars] of usage) {
        const [family, weight] = key.split('|');
        const text = Array.from(chars).join('');
        if (!text.trim()) continue;
        const url = API + enc(family) + ':wght@' + weight + '&text=' + encodeURIComponent(text);
        try {
          let sheet = await fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); });
          const urls = Array.from(sheet.matchAll(/url\((https:[^)]+)\)/g)).map((m) => m[1]);
          for (const u of urls) {
            const buf = await fetch(u).then((r) => r.arrayBuffer());
            const bytes = new Uint8Array(buf); let bin = '';
            for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
            const fmt = /woff2/.test(u) || bytes[0] === 0x77 ? 'woff2' : 'truetype';
            sheet = sheet.split(u).join(`data:font/${fmt};base64,${btoa(bin)}`);
          }
          css += sheet;
        } catch (e) {
          imports += `@import url('${API + enc(family)}:wght@${weight}&display=swap');`;
        }
      }
      return imports + css;
    },
  };
})(window.SSEP = window.SSEP || {});
