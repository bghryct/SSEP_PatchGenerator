/* ==========================================================================
   Patch silhouettes — every shape lives inside the locked 3.5″ × 3.5″ box
   (1000 × 1000 units). Returns SVG path data + sampled outline points (used by
   the Three.js mesh and inside/outside tests).
   ========================================================================== */
(function (S) {
  'use strict';

  const cache = new Map();
  const M = 4; // hairline margin so the merrowed edge never touches the export edge

  function build(shape, corner) {
    const p = new S.Path();
    let cx = 500, cy = 500, Ri = 496, centerY = 500;
    switch (shape) {
      case 'roundsquare': {
        const x = M, y = M, w = 1000 - 2 * M, h = w;
        const r = S.clamp(corner, 0, 1) * (w / 2);
        if (r < 1) { p.moveTo(x, y).lineTo(x + w, y).lineTo(x + w, y + h).lineTo(x, y + h).close(); }
        else {
          p.moveTo(x + r, y).lineTo(x + w - r, y).arc(x + w - r, y + r, r, -Math.PI / 2, 0)
            .lineTo(x + w, y + h - r).arc(x + w - r, y + h - r, r, 0, Math.PI / 2)
            .lineTo(x + r, y + h).arc(x + r, y + h - r, r, Math.PI / 2, Math.PI)
            .lineTo(x, y + r).arc(x + r, y + r, r, Math.PI, Math.PI * 1.5).close();
        }
        Ri = 496;
        break;
      }
      case 'hexagon': {
        const R = 496;
        const pts = S.P.regPolyPts(500, 500, R, 6, 0);
        S.P.roundPoly(pts, S.clamp(corner, 0, 1) * R * 0.45, p);
        Ri = R * Math.sin(Math.PI / 3);
        break;
      }
      case 'shield': {
        const L = 30, Rr = 970, T = 14, mid = 560, B = 986;
        const r = 8 + S.clamp(corner, 0, 1) * 160;
        p.moveTo(L + r, T).lineTo(Rr - r, T).quadTo(Rr, T, Rr, T + r).lineTo(Rr, mid)
          .cubicTo(Rr, mid + 240, 640, 900, 500, B)
          .cubicTo(360, 900, L, mid + 240, L, mid)
          .lineTo(L, T + r).quadTo(L, T, L + r, T).close();
        cy = 470; centerY = 470; Ri = 440;
        break;
      }
      default: { // circle
        p.arc(500, 500, 496, -Math.PI, Math.PI).close();
        Ri = 496;
      }
    }
    const pts = p.subs[0];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { shape, d: p.d, pts, bbox: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, cx, cy: centerY, Ri };
  }

  /** Cached outline for a state (shape + corner radius). */
  S.shapeOutline = function (state) {
    const key = state.shape + '|' + (+state.cornerRadius).toFixed(3);
    if (!cache.has(key)) { cache.set(key, build(state.shape, +state.cornerRadius)); if (cache.size > 40) cache.delete(cache.keys().next().value); }
    return cache.get(key);
  };

  /** Point-in-polygon (even-odd) against sampled outline. */
  S.insideOutline = function (outline, x, y) {
    const pts = outline.pts; let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  /** Shortest distance from a point to the outline (for "how far inside the border"). */
  S.distToOutline = function (outline, x, y) {
    const pts = outline.pts; let best = 1e9;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, ay] = pts[j], [bx, by] = pts[i];
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
      const t = S.clamp(((x - ax) * dx + (y - ay) * dy) / L, 0, 1);
      best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
    }
    return best;
  };

  /** Usable geometry inside the merrowed border. */
  S.shapeMetrics = function (state) {
    const o = S.shapeOutline(state);
    const bw = +state.borderWidth + (state.keyline ? +state.keylineWidth : 0);
    const inner = { x: o.bbox.x + bw, y: o.bbox.y + bw, w: o.bbox.w - 2 * bw, h: o.bbox.h - 2 * bw };
    return { outline: o, bw, inner, cx: o.cx, cy: o.cy, Ri: o.Ri - bw };
  };
})(window.SSEP = window.SSEP || {});
