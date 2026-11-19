/* ==========================================================================
   Built-in symbol library · Set B — Industrial semiotic pictograms
   (after the modular signage grammar Ron Cobb drew for the Nostromo)
   Frame (rounded square) = slot 0 · pictogram = slot 1 · signal accent = slot 2
   ========================================================================== */
(function (S) {
  'use strict';
  const P = S.P;
  S.SYMBOLS = S.SYMBOLS || [];

  const add = (def) => S.SYMBOLS.push(Object.assign({ set: 'cobb', slots: 3, framed: true }, def, {
    draw(p, layer) {
      const frame = (layer && layer.frame) || 'solid';
      if (frame === 'solid') p.fill(P.rrect(-49, -49, 98, 98, 15), 0);
      if (frame === 'outline') p.stroke(P.rrect(-46, -46, 92, 92, 13), 1, 6);
      if (frame !== 'none') { p.save(); p.scale(0.8, 0.8); def.icon(p); p.restore(); }
      else def.icon(p);
    },
  }));

  const arrowDown = (p, slot, y0 = -36, y1 = 30, hw = 21, sw = 6.5) => {
    p.fill(P.poly([[-sw, y0], [sw, y0], [sw, y1 - 24], [hw, y1 - 24], [0, y1], [-hw, y1 - 24], [-sw, y1 - 24]]), slot, { satin: true });
  };

  add({ id: 'gravity-off', name: 'Gravity off · 0G', icon(p) {
    arrowDown(p, 1);
    p.stroke(P.circle(0, 0, 42), 2, 8);
    p.stroke(P.line(-29, -29, 29, 29), 2, 8, { cap: 'butt' });
  } });

  add({ id: 'life-support', name: 'Life support', icon(p) {
    p.stroke(P.poly([[-46, 6], [-22, 6], [-12, -26], [2, 34], [13, -8], [20, 6], [46, 6]], false), 1, 7.5, { join: 'miter', cap: 'butt' });
    p.fill(P.circle(30, -26, 8), 2, { satin: true });
  } });

  add({ id: 'containment', name: 'Containment', icon(p) {
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      p.stroke(P.poly([[sx * 42, sy * 20], [sx * 42, sy * 42], [sx * 20, sy * 42]], false), 1, 7, { join: 'miter', cap: 'butt' });
    }
    p.stroke(P.rect(-24, -24, 48, 48), 1, 4.5);
    p.fill(P.rect(-13, -13, 26, 26), 2);
  } });

  add({ id: 'optical', name: 'Optical sensor', icon(p) {
    p.stroke(P.circle(0, 0, 30), 1, 7.5);
    p.fill(P.regPoly(0, 0, 17, 6, 0), 2);
    p.fill(P.circle(0, 0, 6), 1, { satin: true });
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      p.stroke(P.line(Math.cos(a) * 36, Math.sin(a) * 36, Math.cos(a) * 47, Math.sin(a) * 47), 1, 6, { cap: 'butt' });
    }
  } });

  add({ id: 'propulsion', name: 'Propulsion', icon(p) {
    p.fill(P.rect(-14, -44, 28, 10), 1, { satin: true });
    p.fill(P.poly([[-10, -32], [10, -32], [24, 6], [-24, 6]]), 1);
    p.stroke(P.poly([[-22, 15], [0, 28], [22, 15]], false), 2, 7, { join: 'miter', cap: 'butt' });
    p.stroke(P.poly([[-18, 31], [0, 43], [18, 31]], false), 2, 6, { join: 'miter', cap: 'butt' });
  } });

  add({ id: 'bio-sample', name: 'Biological sample', icon(p) {
    p.save(); p.rotate(-30);
    p.fill(P.rect(-15, -46, 30, 9), 1, { satin: true });
    p.stroke(P.rrect(-11, -36, 22, 76, 11), 1, 6);
    p.fill(P.rrect(-6, 2, 12, 33, 6), 2);
    p.restore();
    p.fill(P.circle(26, 24, 6), 2, { satin: true });
    p.fill(P.circle(34, 8, 3.5), 2, { satin: true });
  } });

  add({ id: 'telemetry', name: 'Data telemetry', icon(p) {
    p.fill(P.sector(-10, 10, 0, 28, Math.PI / 4 - Math.PI, Math.PI / 4), 1);
    p.stroke(P.line(-10, 10, 10, -10), 1, 4.5, { cap: 'round' });
    p.fill(P.circle(11, -11, 5), 1, { satin: true });
    p.stroke(P.arc(11, -11, 17, -Math.PI / 2 + 0.25, -0.25), 2, 5.5, { cap: 'butt' });
    p.stroke(P.arc(11, -11, 29, -Math.PI / 2 + 0.25, -0.25), 2, 5.5, { cap: 'butt' });
    p.fill(P.rect(-30, 36, 40, 8), 1, { satin: true });
    p.stroke(P.line(-10, 20, -10, 36), 1, 5, { cap: 'butt' });
  } });

  add({ id: 'nyc-grid', name: 'Baruch / NYC grid', icon(p) {
    p.save();
    p.clip(P.rrect(-46, -46, 92, 92, 10));
    p.rotate(29);
    for (let x = -80; x <= 80; x += 22) p.fill(P.rect(x - 2.8, -80, 5.6, 160), 1, { satin: true });
    for (let y = -80; y <= 80; y += 11) p.fill(P.rect(-80, y - 1.4, 160, 2.8), 1, { satin: true });
    p.restore();
    p.stroke(P.line(-46, 30, 46, -38), 2, 5, { cap: 'butt' }); // Broadway
    p.fill(P.circle(3, -1, 9), 2);
  } });

  add({ id: 'radiation', name: 'Radiation', icon(p) {
    p.fill(P.circle(0, 0, 8), 1, { satin: true });
    for (const c of [-150, -30, 90]) p.fill(P.sector(0, 0, 13, 42, S.rad(c - 30), S.rad(c + 30)), 1);
  } });

  add({ id: 'pressure', name: 'Pressurized', icon(p) {
    p.stroke(P.circle(0, 0, 13), 2, 6);
    for (let i = 0; i < 4; i++) {
      p.save(); p.rotate(i * 90);
      p.fill(P.poly([[-5, -46], [5, -46], [5, -34], [13, -34], [0, -21], [-13, -34], [-5, -34]]), 1, { satin: true });
      p.restore();
    }
  } });

  add({ id: 'hazard', name: 'Hazard stripes', icon(p) {
    p.save();
    p.clip(P.rrect(-46, -46, 92, 92, 10));
    p.rotate(45);
    for (let x = -90; x <= 90; x += 26) p.fill(P.rect(x, -90, 13, 180), 1, { satin: true });
    p.restore();
  } });

  add({ id: 'arrow', name: 'Direction arrow', icon(p) {
    p.fill(P.poly([[-40, -11], [4, -11], [4, -30], [42, 0], [4, 30], [4, 11], [-40, 11]]), 1, { satin: true });
  } });

  add({ id: 'power', name: 'Power bus', icon(p) {
    p.fill(P.poly([[10, -46], [-24, 6], [-3, 6], [-12, 46], [24, -8], [3, -8], [14, -46]]), 1, { satin: true });
  } });

  add({ id: 'airlock', name: 'Airlock hatch', icon(p) {
    p.stroke(P.circle(0, 0, 36), 1, 7);
    p.fill(P.circle(0, 0, 11), 2);
    for (let i = 0; i < 4; i++) {
      const a = S.rad(45 + i * 90);
      p.stroke(P.line(Math.cos(a) * 11, Math.sin(a) * 11, Math.cos(a) * 34, Math.sin(a) * 34), 1, 6, { cap: 'butt' });
    }
  } });

  add({ id: 'helmet', name: 'Crew / EVA', icon(p) {
    p.fill(P.circle(0, -4, 36), 1);
    p.fill(P.rrect(-24, -18, 48, 26, 12), 2);
    p.fill(P.rrect(-22, 30, 44, 10, 3), 1, { satin: true });
  } });

  S.symbolById = (id) => S.SYMBOLS.find((s) => s.id === id) || S.SYMBOLS[0];
  S.symbolsBySet = (set) => S.SYMBOLS.filter((s) => s.set === set);
})(window.SSEP = window.SSEP || {});
