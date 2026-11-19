/* ==========================================================================
   Student SVG upload — parses hand-drawn symbols into flat path lists
   (shape → path data, resolved transforms, computed fill/stroke, CSS classes)
   so they can be recoloured with the thread palette, placed, tiled, stitched.
   ========================================================================== */
(function (S) {
  'use strict';
  const SKIP = new Set(['defs', 'clipPath', 'mask', 'symbol', 'marker', 'pattern', 'linearGradient', 'radialGradient', 'filter', 'title', 'desc', 'metadata', 'style', 'script', 'foreignObject']);
  const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);

  function toD(el) {
    const n = el.localName, v = (a) => (el[a] && el[a].baseVal ? el[a].baseVal.value : parseFloat(el.getAttribute(a)) || 0);
    switch (n) {
      case 'path': return el.getAttribute('d') || '';
      case 'rect': { const rx = v('rx') || v('ry'); return S.P.rrect(v('x'), v('y'), v('width'), v('height'), rx); }
      case 'circle': return S.P.circle(v('cx'), v('cy'), v('r'));
      case 'ellipse': return S.P.ellipse(v('cx'), v('cy'), v('rx'), v('ry'));
      case 'line': return S.P.line(v('x1'), v('y1'), v('x2'), v('y2'));
      case 'polyline': case 'polygon': {
        const nums = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(parseFloat).filter((x) => !isNaN(x));
        const pts = []; for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
        return pts.length ? S.P.poly(pts, n === 'polygon') : '';
      }
    }
    return '';
  }

  function paint(val, root) {
    if (!val || val === 'none') return null;
    const m = val.match(/url\(["']?#([^"')]+)["']?\)/);
    if (m) {
      const g = root.querySelector('#' + CSS.escape(m[1]));
      const stop = g && g.querySelector('stop');
      if (stop) return S.normColor(getComputedStyle(stop).stopColor || stop.getAttribute('stop-color'));
      const fb = val.replace(/url\([^)]*\)/, '').trim();
      return fb ? S.normColor(fb) : '#000000';
    }
    return S.normColor(val);
  }

  /** Parse SVG markup → asset object (throws on invalid SVG). */
  S.parseSVG = function (text, name) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const src = doc.documentElement;
    if (!src || src.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('Not a valid SVG file');
    src.querySelectorAll('script, foreignObject').forEach((n) => n.remove());
    const host = S.el('div', { style: { position: 'absolute', left: '-20000px', top: '0', width: '10px', height: '10px', overflow: 'hidden', visibility: 'hidden' } });
    const svg = document.importNode(src, true);
    svg.removeAttribute('viewBox');
    svg.setAttribute('width', '20000'); svg.setAttribute('height', '20000');
    host.append(svg); document.body.append(host);
    const items = [];
    try {
      const walk = (node) => {
        for (const el of node.children) {
          if (SKIP.has(el.localName)) continue;
          const cs = getComputedStyle(el);
          if (cs.display === 'none') continue;
          if (SHAPES.has(el.localName)) {
            const d = toD(el);
            if (!d || items.length > 4000) continue;
            const fill = paint(cs.fill, svg), stroke = paint(cs.stroke, svg);
            const sw = parseFloat(cs.strokeWidth) || 0;
            if (!fill && !(stroke && sw > 0)) continue;
            const m = el.getCTM() || new DOMMatrix();
            let bb = null;
            try {
              const b = el.getBBox();
              const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
              const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
              const pad = stroke ? sw * Math.hypot(m.a, m.b) / 2 : 0;
              bb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
            } catch (e) { /* ignore */ }
            const op = (parseFloat(cs.opacity) || 1) * (parseFloat(cs.fillOpacity) || 1);
            items.push({
              d, m: [m.a, m.b, m.c, m.d, m.e, m.f].map((x) => +x.toFixed(5)), fill, stroke: stroke && sw > 0 ? stroke : null, sw,
              rule: cs.fillRule === 'evenodd' ? 'evenodd' : 'nonzero', op: op < 1 ? +op.toFixed(3) : undefined,
              cap: cs.strokeLinecap || 'butt', join: cs.strokeLinejoin || 'miter', bb,
            });
          } else if (el.children && el.children.length) walk(el);
        }
      };
      walk(svg);
    } finally { host.remove(); }
    if (!items.length) throw new Error('No drawable shapes found in ' + (name || 'SVG'));

    // content bounds; flag a full-bleed light background rectangle
    const union = (list) => list.reduce((a, it) => (it.bb ? [Math.min(a[0], it.bb[0]), Math.min(a[1], it.bb[1]), Math.max(a[2], it.bb[2]), Math.max(a[3], it.bb[3])] : a), [1e9, 1e9, -1e9, -1e9]);
    let all = union(items);
    const area = (all[2] - all[0]) * (all[3] - all[1]);
    if (items.length > 1) {
      for (const it of items) {
        if (!it.bb || it.stroke || !it.fill) continue;
        const a = (it.bb[2] - it.bb[0]) * (it.bb[3] - it.bb[1]);
        if (a >= area * 0.88 && S.luminance(it.fill) > 0.8) it.bg = true;
      }
    }
    const fg = items.filter((i) => !i.bg);
    all = union(fg.length ? fg : items);
    if (!(all[2] > all[0])) all = [0, 0, 100, 100];
    const colors = Array.from(new Set(fg.flatMap((i) => [i.fill, i.stroke]).filter(Boolean)));
    items.forEach((i) => delete i.bb);
    return {
      id: S.uid('svg'), name: (name || 'symbol.svg').replace(/\.svg$/i, ''), vb: [all[0], all[1], all[2] - all[0], all[3] - all[1]].map((x) => +x.toFixed(3)),
      items, colors, paths: items.length,
      src: text.length <= 400000 ? text : undefined,
    };
  };

  /** Read File objects → assets (skips non-SVG with a toast). */
  S.importSVGFiles = async function (files) {
    const out = [];
    for (const f of Array.from(files)) {
      if (!/\.svg$/i.test(f.name) && f.type !== 'image/svg+xml') { S.toast(`${f.name}: only .svg files can be imported`, 'warn'); continue; }
      try { out.push(S.parseSVG(await S.readFileText(f), f.name)); }
      catch (e) { S.toast(`${f.name}: ${e.message}`, 'warn'); }
    }
    return out;
  };
})(window.SSEP = window.SSEP || {});
