/* ==========================================================================
   App shell: state store (undo/redo with coalescing), three entry slots
   (A/B/C, autosaved to localStorage), selection, variation history, boot.
   ========================================================================== */
(function (S) {
  'use strict';
  const MAX_HISTORY = 60;
  const ENTRY_KEY = (e) => 'ssep-patch-entry-' + e;

  const store = S.store = {
    state: null, past: [], future: [], last: { label: null, t: 0 },

    /** Mutate the design. Consecutive edits with the same label within 700 ms share one undo step. */
    set(mut, label = 'Edit', opts = {}) {
      const now = performance.now();
      const coalesce = opts.coalesce !== false && this.last.label === label && now - this.last.t < 700;
      if (opts.history !== false && !coalesce) {
        this.past.push(JSON.stringify(this.state));
        if (this.past.length > MAX_HISTORY) this.past.shift();
        this.future = [];
      }
      this.last = { label, t: now };
      mut(this.state);
      S.bus.emit('change', { label });
    },
    replace(next, label = 'Replace') {
      this.past.push(JSON.stringify(this.state));
      if (this.past.length > MAX_HISTORY) this.past.shift();
      this.future = [];
      this.state = next; this.last = { label, t: 0 };
      S.bus.emit('change', { label, structural: true });
    },
    undo() {
      if (!this.past.length) return;
      this.future.push(JSON.stringify(this.state));
      this.state = JSON.parse(this.past.pop()); this.last = { label: null, t: 0 };
      S.bus.emit('change', { label: 'Undo', structural: true });
    },
    redo() {
      if (!this.future.length) return;
      this.past.push(JSON.stringify(this.state));
      this.state = JSON.parse(this.future.pop()); this.last = { label: null, t: 0 };
      S.bus.emit('change', { label: 'Redo', structural: true });
    },
    layer(id) { return this.state.layers.find((l) => l.id === id) || null; },
  };

  S.ui = { selected: null, view: 'split', variations: [], entry: 'A' };

  /* ---------- student profile (shared by all entries) ---------- */
  S.profile = Object.assign({ name: '', section: '' }, S.store_get('ssep-profile', {}));
  S.setProfile = function (p) {
    Object.assign(S.profile, p);
    S.store_set('ssep-profile', S.profile);
    S.bus.emit('profile');
  };

  /* ---------- access to all three entries ---------- */
  S.ENTRIES = ['A', 'B', 'C'];
  /** Live state for the open entry, stored state for the others (null = never started). */
  S.entryState = function (e) {
    if (e === S.ui.entry) return store.state;
    const st = S.store_get(ENTRY_KEY(e), null);
    if (!st) return null;
    const m = S.migrate(st); m.meta.entry = e; return m;
  };
  S.updateEntryMeta = function (e, patch) {
    if (e === S.ui.entry) { store.set((s) => { Object.assign(s.meta, patch); }, 'Meta ' + Object.keys(patch).join()); return; }
    const st = S.entryState(e); if (!st) return;
    Object.assign(st.meta, patch);
    S.store_set(ENTRY_KEY(e), st);
    S.bus.emit('entries');
  };
  S.select = function (id) {
    if (S.ui.selected === id) return;
    S.ui.selected = id;
    S.bus.emit('select', id);
  };
  S.selectedLayer = () => (S.ui.selected ? store.layer(S.ui.selected) : null);

  /* ---------- layer operations ---------- */
  S.addLayer = function (layer, label = 'Add layer') {
    store.set((s) => { s.layers.push(layer); s.layers = S.sortLayers(s.layers); }, label, { coalesce: false });
    S.select(layer.id);
  };
  S.removeLayer = function (id) {
    store.set((s) => { s.layers = s.layers.filter((l) => l.id !== id); }, 'Delete layer', { coalesce: false });
    if (S.ui.selected === id) S.select(null);
  };
  S.duplicateLayer = function (id) {
    const L = store.layer(id); if (!L) return;
    const c = S.deepClone(L); c.id = S.uid(L.kind.slice(0, 3)); c.locked = false;
    if (c.cell) { c.dx = (c.dx || 0) + 24; c.dy = (c.dy || 0) + 24; } else { c.x += 24; c.y += 24; }
    store.set((s) => { const i = s.layers.findIndex((l) => l.id === id); s.layers.splice(i + 1, 0, c); }, 'Duplicate', { coalesce: false });
    S.select(c.id);
  };
  S.moveLayer = function (id, dir) {
    store.set((s) => {
      const i = s.layers.findIndex((l) => l.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= s.layers.length) return;
      [s.layers[i], s.layers[j]] = [s.layers[j], s.layers[i]];
    }, 'Reorder', { coalesce: false });
  };
  S.patchLayer = function (id, patch, label = 'Edit layer') {
    store.set((s) => { const L = s.layers.find((l) => l.id === id); if (L) Object.assign(L, typeof patch === 'function' ? patch(L) || {} : patch); }, label + ':' + id);
  };

  /* ---------- variations ---------- */
  S.generateVariation = function () {
    const seed = S.newSeed();
    const next = S.generate(store.state, seed);
    store.replace(next, 'Generate variation');
    S.select(null);
    S.pushVariation(next);
  };
  S.pushVariation = function (state) {
    const thumb = S.renderToCanvas(state, 192).toDataURL('image/png');
    S.ui.variations.unshift({ json: JSON.stringify(state), thumb, seed: state.seed });
    S.ui.variations = S.ui.variations.slice(0, 12);
    S.bus.emit('variations');
  };

  /* ---------- entries (up to three competition entries) ---------- */
  S.saveEntry = S.debounce(() => {
    const ok = S.store_set(ENTRY_KEY(S.ui.entry), store.state);
    if (!ok) S.toast('Autosave failed — storage full. Export a JSON recipe to keep your work.', 'warn');
    S.bus.emit('saved');
    S.bus.emit('entries');
  }, 700);
  S.loadEntry = function (entry, fresh) {
    S.store_set(ENTRY_KEY(S.ui.entry), store.state);
    S.ui.entry = entry;
    let st = fresh ? null : S.store_get(ENTRY_KEY(entry), null);
    if (st) st = S.migrate(st);
    else {
      st = entry === 'A' ? S.defaultState() : S.generate(S.migrate(Object.assign(S.defaultState(), { locks: Object.assign(S.defaultState().locks, { text: false }) })), S.newSeed());
      st.meta = Object.assign({}, store.state ? store.state.meta : st.meta, { statement: '' });
    }
    st.meta.entry = entry;
    store.state = st; store.past = []; store.future = [];
    S.select(null);
    S.store_set('ssep-patch-current', entry);
    S.bus.emit('change', { label: 'Load entry', structural: true });
    S.bus.emit('entry', entry);
    S.bus.emit('entries');
  };

  /* ---------- theme ---------- */
  S.setTheme = function (t) {
    document.documentElement.dataset.theme = t;
    S.store_set('ssep-theme', t);
    S.bus.emit('theme', t);
  };

  /* ---------- boot ---------- */
  function boot() {
    const theme = S.store_get('ssep-theme', null) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    S.ui.entry = S.store_get('ssep-patch-current', 'A');
    const saved = S.store_get(ENTRY_KEY(S.ui.entry), null);
    store.state = saved ? S.migrate(saved) : S.defaultState();
    if (store.state.meta.statement == null) store.state.meta.statement = '';
    store.state.meta.entry = S.ui.entry;

    S.Fonts.loadCurated();
    S.Workspace.init();
    S.View3D.init();
    S.Panels.init();

    S.bus.on('change', () => {
      S.saveEntry();
      for (const l of store.state.layers) if (l.font) S.Fonts.ensure(l.font);
    });
    S.bus.on('fonts', () => S.bus.emit('redraw'));
    S.bus.emit('change', { label: 'Boot', structural: true });
    S.bus.emit('entry', S.ui.entry);
    S.pushVariation(store.state);

    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { if (typing) return; e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { if (typing) return; e.preventDefault(); store.redo(); return; }
      if (typing) return;
      const L = S.selectedLayer();
      if (mod && e.key.toLowerCase() === 'd' && L) { e.preventDefault(); S.duplicateLayer(L.id); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && L) { e.preventDefault(); S.removeLayer(L.id); return; }
      if (e.key === 'Escape') { S.select(null); return; }
      if (e.key.toLowerCase() === 'g' && !mod) { S.generateVariation(); return; }
      if (L && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 2;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        S.patchLayer(L.id, (l) => (l.cell ? { dx: (l.dx || 0) + dx, dy: (l.dy || 0) + dy } : { x: (l.x || 500) + dx, y: (l.y || 500) + dy }), 'Nudge');
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.SSEP = window.SSEP || {});
