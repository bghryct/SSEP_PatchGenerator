/* ==========================================================================
   Minimal control kit — Swiss/technical form controls bound to the store.
   Every control exposes .refresh() so panels re-sync after any change.
   ========================================================================== */
(function (S) {
  'use strict';
  const el = S.el;
  const C = S.C = {};
  let refreshers = [];
  C.track = (fn) => { refreshers.push(fn); return fn; };
  C.refreshAll = () => { refreshers = refreshers.filter((f) => f.alive === undefined || f.alive()); refreshers.forEach((f) => { try { f(); } catch (e) { console.warn(e); } }); };
  const alive = (node) => () => node.isConnected;

  C.section = function (num, title, open, ...kids) {
    const d = el('details', { class: 'sec', open: open ? '' : null }, el('summary', null, el('span', { class: 'num', text: num }), el('span', { class: 'ttl', text: title })), el('div', { class: 'sec-body' }, ...kids));
    return d;
  };
  C.sub = (title, ...kids) => el('div', { class: 'sub' }, el('div', { class: 'sub-ttl', text: title }), ...kids);

  C.row = (label, control, out) => el('div', { class: 'row' }, el('label', { text: label }), control, out || null);

  C.slider = function (o) {
    const input = el('input', { type: 'range', min: o.min, max: o.max, step: o.step || 1 });
    const out = el('output');
    const fmt = o.fmt || ((v) => String(v));
    input.addEventListener('input', () => { const v = +input.value; out.textContent = fmt(v); o.set(v); });
    const node = C.row(o.label, input, out);
    const r = () => { if (document.activeElement === input && input.matches(':active')) return; const v = o.get(); input.value = v; out.textContent = fmt(+v); };
    r.alive = alive(node); C.track(r); r();
    if (o.disabled) r.dis = o.disabled;
    return node;
  };

  C.select = function (o) {
    const s = el('select');
    const fill = () => {
      s.innerHTML = '';
      const opts = typeof o.options === 'function' ? o.options() : o.options;
      for (const op of opts) {
        if (op.group) { const g = el('optgroup', { label: op.group }); op.items.forEach(([v, t]) => g.append(el('option', { value: v, text: t }))); s.append(g); }
        else s.append(el('option', { value: op[0], text: op[1] }));
      }
    };
    fill();
    s.addEventListener('change', () => o.set(s.value));
    const node = o.label ? C.row(o.label, s) : s;
    const r = () => { if (o.dynamic) fill(); const v = String(o.get() == null ? '' : o.get()); if (s.value !== v) s.value = v; };
    r.alive = alive(node); C.track(r); r();
    return node;
  };

  C.seg = function (o) {
    const wrap = el('div', { class: 'seg' + (o.small ? ' small' : '') });
    const btns = o.options.map(([v, t, title]) => {
      const b = el('button', { type: 'button', title: title || t, html: t });
      b.addEventListener('click', () => o.set(v));
      b.dataset.v = String(v); wrap.append(b); return b;
    });
    const node = o.label ? C.row(o.label, wrap) : wrap;
    const r = () => { const v = String(o.get()); btns.forEach((b) => b.classList.toggle('on', b.dataset.v === v)); };
    r.alive = alive(node); C.track(r); r();
    return node;
  };

  C.toggle = function (o) {
    const cb = el('input', { type: 'checkbox' });
    cb.addEventListener('change', () => o.set(cb.checked));
    const node = el('label', { class: 'toggle' + (o.cls ? ' ' + o.cls : '') }, cb, el('span', { class: 'box' }), el('span', { class: 'tl', text: o.label }));
    const r = () => { cb.checked = !!o.get(); };
    r.alive = alive(node); C.track(r); r();
    return node;
  };

  C.text = function (o) {
    const t = el(o.multiline ? 'textarea' : 'input', { type: 'text', placeholder: o.placeholder || '', spellcheck: false, rows: o.multiline ? 2 : null });
    t.addEventListener('input', () => o.set(t.value));
    if (o.onfocus) t.addEventListener('focus', () => o.onfocus(t));
    const node = o.label ? C.row(o.label, t) : t;
    const r = () => { if (document.activeElement === t) return; const v = o.get(); t.value = v == null ? '' : v; };
    r.alive = alive(node); C.track(r); r();
    node.input = t;
    return node;
  };

  C.button = (label, onclick, cls = '') => el('button', { type: 'button', class: 'btn ' + cls, html: label, on: { click: onclick } });

  /** Choose one thread from the active palette. */
  C.thread = function (o) {
    const wrap = el('div', { class: 'threads-pick' });
    const r = () => {
      const st = S.store.state, list = S.threadList(st), v = o.get();
      if (wrap.childElementCount !== list.length + (o.allowNone ? 1 : 0)) {
        wrap.innerHTML = '';
        if (o.allowNone) wrap.append(el('button', { type: 'button', class: 'sw none', title: 'None', on: { click: () => o.set(null) } }));
        list.forEach((hex, i) => wrap.append(el('button', { type: 'button', class: 'sw', title: `T${i}`, on: { click: () => o.set(i) } })));
      }
      const bs = Array.from(wrap.children).filter((b) => !b.classList.contains('none'));
      bs.forEach((b, i) => { b.style.background = list[i]; b.classList.toggle('on', v === i); });
      if (o.allowNone) wrap.firstChild.classList.toggle('on', v == null);
    };
    const node = o.label ? C.row(o.label, wrap) : wrap;
    r.alive = alive(node); C.track(r); r();
    return node;
  };

  /** Inline SVG preview of a built-in symbol. */
  C.symbolSVG = function (id, colors, frame) {
    const b = new S.SVGBackend(), sym = S.symbolById(id);
    b.idp = S.uid('pv') + '-';
    b.translate(50, 50);
    const pen = {
      fill: (d, s, o = {}) => b.path(d, { fill: colors[s] || colors[0], rule: o.rule }),
      stroke: (d, s, w, o = {}) => b.path(d, { stroke: colors[s] || colors[0], width: w, cap: o.cap, join: o.join }),
      save: () => b.save(), restore: () => b.restore(), translate: (x, y) => b.translate(x, y), rotate: (d) => b.rotate(d), scale: (x, y) => b.scale(x, y), clip: (d, r) => b.clip(d, r),
    };
    sym.draw(pen, { frame: frame || 'solid' });
    while (b.open > 0) { b.out.push('</g>'); b.open--; }
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>${b.defs.join('')}</defs>${b.out.join('')}</svg>`;
  };
})(window.SSEP = window.SSEP || {});
