/* ==========================================================================
   Built-in symbol library · Set A — Microgravity motifs
   (after the geometry of Patricia Klein's IML / ACME / Astrobee patches)
   Every symbol draws into a 100 × 100 box centred on 0,0 using a "pen":
     pen.fill(d, slot, {satin, rule})   pen.stroke(d, slot, width, {cap, join})
   slot 0..2 → the layer's thread colours.
   ========================================================================== */
(function (S) {
  'use strict';
  const P = S.P;
  S.SYMBOLS = S.SYMBOLS || [];
  const add = (def) => S.SYMBOLS.push(Object.assign({ set: 'klein', slots: 3 }, def));

  add({
    id: 'flame', name: 'Spherical flame', note: 'Combustion without convection',
    draw(p) {
      p.fill(P.circle(0, 0, 47), 0);
      p.fill(P.circle(0, 0, 35), 1);
      p.stroke(P.circle(0, 0, 41), 2, 2.6);
      p.fill(P.circle(0, 0, 18), 2);
      p.stroke(P.line(-50, 0, -18, 0), 0, 2.4, { cap: 'butt' });
      p.stroke(P.line(18, 0, 50, 0), 0, 2.4, { cap: 'butt' });
    },
  });

  add({
    id: 'crystal', name: 'Hex crystal lattice', note: 'Protein crystal growth',
    draw(p) {
      p.fill(P.regPoly(0, 0, 48, 6, -90), 0);
      const inner = P.regPolyPts(0, 0, 30, 6, -90);
      p.stroke(P.poly(inner), 1, 5, { join: 'round' });
      for (const [x, y] of inner) p.stroke(P.line(0, 0, x, y), 1, 3.6);
      for (const [x, y] of inner) p.fill(P.circle(x, y, 5.5), 2, { satin: true });
      p.fill(P.circle(0, 0, 7), 2, { satin: true });
    },
  });

  add({
    id: 'burst', name: 'Crystal burst', note: 'Radiating hexagonal prisms',
    draw(p) {
      const prism = [[0, -49], [8.5, -41], [8.5, -17], [0, -10], [-8.5, -17], [-8.5, -41]];
      for (let i = 0; i < 6; i++) {
        const a = S.rad(i * 60), c = Math.cos(a), s = Math.sin(a);
        p.fill(P.poly(prism.map(([x, y]) => [x * c - y * s, x * s + y * c])), i % 2 ? 1 : 0, { satin: true });
      }
      p.fill(P.regPoly(0, 0, 11, 6, -90), 2);
    },
  });

  add({
    id: 'orbits', name: 'Orbital ellipses', note: 'Three orbital planes',
    draw(p) {
      for (const r of [0, 60, 120]) p.stroke(P.ellipse(0, 0, 46, 15, r), 0, 4.6);
      p.fill(P.circle(0, 0, 11), 1);
      p.fill(P.circle(46 * Math.cos(S.rad(60)) * 1, 46 * Math.sin(S.rad(60)), 5.5), 2, { satin: true });
    },
  });

  add({
    id: 'planet', name: 'Planet + orbit', note: 'Low Earth orbit',
    draw(p) {
      const rx = 49, ry = 14, rot = -18, a = S.rad(rot);
      const L = [-rx * Math.cos(a), -rx * Math.sin(a)], R = [rx * Math.cos(a), rx * Math.sin(a)];
      p.stroke(P.ellipse(0, 0, rx, ry, rot), 1, 5);
      p.fill(P.circle(0, 0, 31), 0);
      p.stroke(`M${S.f(-31)} 6Q0 22 31 6`, 2, 2.6);
      p.stroke(`M${S.f(-26)} -12Q0 -2 26 -12`, 2, 2.6);
      p.stroke(`M${S.f(L[0])} ${S.f(L[1])}A${rx} ${ry} ${rot} 0 0 ${S.f(R[0])} ${S.f(R[1])}`, 1, 5);
    },
  });

  add({
    id: 'astrobee', name: 'Astrobee cube', note: 'Free-flying robotic cube',
    draw(p) {
      const T = [0, -46], UR = [40, -23], LR = [40, 23], B = [0, 46], LL = [-40, 23], UL = [-40, -23], C = [0, 0];
      const rp = (pts) => S.P.roundPoly(pts, 5).d;
      p.fill(rp([UL, C, B, LL]), 0);
      p.fill(rp([C, UR, LR, B]), 2);
      p.fill(rp([T, UR, C, UL]), 1);
      for (const k of [13, 23, 33]) p.stroke(P.line(-33, -19 + k, -7, -4 + k), 1, 3.4, { cap: 'round' });
      p.fill(P.circle(20, 13, 9), 1);
      p.fill(P.circle(20, 13, 4), 0, { satin: true });
    },
  });

  add({
    id: 'iss', name: 'ISS truss + arrays', note: 'International Space Station',
    draw(p) {
      for (const x of [-41, -27, 27, 41]) {
        for (const [y, h] of [[-42, 36], [6, 36]]) {
          p.fill(P.rect(x - 5.5, y, 11, h), 1);
          for (let k = 1; k < 4; k++) p.stroke(P.line(x - 5.5, y + k * h / 4, x + 5.5, y + k * h / 4), 0, 1.6, { cap: 'butt' });
        }
      }
      p.fill(P.rect(-49, -3.2, 98, 6.4), 0, { satin: true });
      p.fill(P.rrect(-17, -9, 34, 18, 8), 2);
      p.fill(P.rrect(-4.5, -22, 9, 44, 4), 2);
      p.fill(P.circle(0, 0, 6.5), 0, { satin: true });
    },
  });

  add({
    id: 'droplet', name: 'Floating droplet', note: 'Surface tension in microgravity',
    draw(p) {
      p.fill(P.circle(-4, 4, 38), 0);
      p.fill(P.ellipse(-17, -10, 11, 7, -40), 1, { satin: true });
      p.stroke(P.arc(-4, 4, 44, S.rad(10), S.rad(80)), 2, 3.4, { cap: 'round' });
      p.stroke(P.arc(-4, 4, 50, S.rad(22), S.rad(68)), 2, 2.6, { cap: 'round' });
      p.fill(P.circle(36, -34, 6), 1, { satin: true });
      p.fill(P.circle(44, -18, 3.4), 2, { satin: true });
    },
  });

  add({
    id: 'cubesat', name: 'CubeSat module', note: '1U modular satellite',
    draw(p) {
      for (const x of [-49, 21]) {
        p.fill(P.rect(x, -13, 28, 26), 1);
        p.stroke(P.line(x + 14, -13, x + 14, 13), 0, 1.8, { cap: 'butt' });
        p.stroke(P.line(x, 0, x + 28, 0), 0, 1.8, { cap: 'butt' });
      }
      p.fill(P.rrect(-18, -18, 36, 36, 4), 0);
      p.stroke(P.rrect(-11, -11, 22, 22, 2), 2, 3);
      p.stroke(P.line(0, -18, 0, -40), 2, 3, { cap: 'round' });
      p.fill(P.circle(0, -42, 4.5), 2, { satin: true });
    },
  });

  add({
    id: 'fme', name: 'FME mini-lab tube', note: 'SSEP Fluids Mixing Enclosure',
    draw(p) {
      p.fill(P.rrect(-49, -15, 98, 30, 15), 0);
      p.fill(P.rrect(-44, -10, 27, 20, 10), 1);
      p.fill(P.rect(-11, -10, 22, 20), 2);
      p.fill(P.rrect(17, -10, 27, 20, 10), 1);
      for (const x of [-14, 14]) p.fill(P.rrect(x - 3, -21, 6, 42, 2), 0, { satin: true });
    },
  });

  add({
    id: 'star4', name: 'Four-point star', note: 'Navigation sparkle', slots: 2,
    draw(p) {
      p.fill(P.star(0, 0, 49, 11, 4, -90), 0, { satin: true });
      p.fill(P.star(0, 0, 22, 6, 4, -45), 1, { satin: true });
    },
  });
})(window.SSEP = window.SSEP || {});
