/* ==========================================================================
   Curated data: thread palettes, Google Fonts, presets
   Thread index semantics are shared by every palette so a design survives
   palette swaps:  0 ground · 1 edge/border · 2 primary figure · 3 secondary
                   4 accent · 5 detail
   ========================================================================== */
(function (S) {
  'use strict';

  const T = (hex, name) => ({ hex, name });

  S.PALETTES = [
    {
      id: 'nasa', name: 'NASA Heritage', note: 'Insignia navy, vector red, flight white',
      threads: [T('#0B3D91', 'Insignia Navy'), T('#C8102E', 'Vector Red'), T('#FFFFFF', 'Flight White'),
        T('#F2B705', 'Apollo Gold'), T('#6CACE4', 'Sky Blue'), T('#0A0A0A', 'Space Black')],
    },
    {
      id: 'nostromo', name: 'Nostromo Industrial', note: 'Ron Cobb semiotic standard — safety orange on black',
      threads: [T('#151515', 'Hull Black'), T('#E9E4D8', 'Stark White'), T('#F26B1D', 'Safety Orange'),
        T('#C9A227', 'Muted Ochre'), T('#1F8A8A', 'Coolant Teal'), T('#B3202A', 'Alarm Crimson')],
    },
    {
      id: 'iml', name: 'IML / Astrobee Neon', note: 'Patricia Klein — neon thread on black twill',
      threads: [T('#0B0B0F', 'Twill Black'), T('#F4F4F4', 'Bright White'), T('#2EE6FF', 'Neon Cyan'),
        T('#FF2E88', 'Neon Magenta'), T('#D4FF3A', 'Neon Lime'), T('#7A4DFF', 'Ultra Violet')],
    },
    {
      id: 'baruch', name: 'Baruch Blue / White / Gold', note: 'Institutional blue with gold accents',
      threads: [T('#0D2C6C', 'Baruch Blue'), T('#C9A54C', 'Bearcat Gold'), T('#FFFFFF', 'White'),
        T('#7FA7D9', 'Lexington Blue'), T('#E8CF85', 'Pale Gold'), T('#061531', 'Midnight')],
    },
    {
      id: 'mono', name: 'High-Contrast Monochrome', note: 'Legibility test — value only',
      threads: [T('#0B0B0B', 'Black'), T('#F5F5F5', 'White'), T('#FFFFFF', 'Optic White'),
        T('#8A8A8A', 'Mid Grey')],
    },
    {
      id: 'solar', name: 'ISS Solar Array', note: 'Deep orbit blue, copper arrays, solar gold',
      threads: [T('#101C3D', 'Orbit Blue'), T('#D9D2C3', 'Truss Silver'), T('#E7A33E', 'Solar Gold'),
        T('#B5562B', 'Copper Array'), T('#4FB3BF', 'Limb Teal'), T('#F7F3E8', 'Ivory')],
    },
    {
      id: 'cleanroom', name: 'Cleanroom', note: 'White twill, black detail, one signal colour',
      threads: [T('#EDEBE6', 'Bone Twill'), T('#151515', 'Black'), T('#151515', 'Black'),
        T('#E4412B', 'Signal Red'), T('#3A6EA5', 'Lab Blue')],
    },
  ];
  S.paletteById = (id) => S.PALETTES.find((p) => p.id === id) || S.PALETTES[0];

  /** Curated Google Fonts — weights listed are the ones the family really ships. */
  S.FONTS = [
    { family: 'Space Grotesk', weights: [300, 400, 500, 600, 700], cat: 'Grotesque', vf: '300..700' },
    { family: 'Spline Sans', weights: [300, 400, 500, 600, 700], cat: 'Grotesque', vf: '300..700' },
    { family: 'Spline Sans Mono', weights: [300, 400, 500, 600, 700], cat: 'Mono', vf: '300..700' },
    { family: 'Barlow Condensed', weights: [400, 500, 600, 700, 800], cat: 'Condensed' },
    { family: 'Archivo Narrow', weights: [400, 500, 600, 700], cat: 'Condensed', vf: '400..700' },
    { family: 'Oswald', weights: [300, 400, 500, 600, 700], cat: 'Condensed', vf: '200..700' },
    { family: 'IBM Plex Mono', weights: [400, 500, 600, 700], cat: 'Mono' },
    { family: 'JetBrains Mono', weights: [400, 500, 600, 700, 800], cat: 'Mono', vf: '100..800' },
    { family: 'Inter', weights: [400, 500, 600, 700, 800, 900], cat: 'Grotesque', vf: '100..900' },
    { family: 'Syne', weights: [400, 500, 600, 700, 800], cat: 'Display', vf: '400..800' },
    { family: 'Chakra Petch', weights: [400, 500, 600, 700], cat: 'Technical' },
    { family: 'Michroma', weights: [400], cat: 'Extended' },
    { family: 'Rajdhani', weights: [500, 600, 700], cat: 'Technical' },
    { family: 'Antonio', weights: [400, 500, 600, 700], cat: 'Condensed', vf: '100..700' },
    { family: 'Saira Condensed', weights: [500, 600, 700, 800], cat: 'Condensed' },
    { family: 'Space Mono', weights: [400, 700], cat: 'Mono' },
    { family: 'Bebas Neue', weights: [400], cat: 'Condensed' },
    { family: 'Unbounded', weights: [400, 500, 600, 700, 800], cat: 'Extended', vf: '200..900' },
  ];

  S.META_PRESETS = [
    'BARUCH COLLEGE', 'SSEP · ISS 2027', 'MICROGRAVITY', 'SPRING 2027', 'CUNY · NEW YORK',
    'STUDENT SPACEFLIGHT', 'ART 3041', 'A.I. FOR DESIGNERS', 'LEXINGTON & 24TH', 'ZERO-G', 'FME MINI-LAB',
  ];

  S.SHAPES = [
    { id: 'circle', name: 'Circular seal' },
    { id: 'roundsquare', name: 'Rounded square' },
    { id: 'hexagon', name: 'Hexagon' },
    { id: 'shield', name: 'Shield' },
  ];

  S.GRID_PRESETS = [
    { id: 'swiss-2', name: '2 × 2', group: 'Swiss modular' },
    { id: 'swiss-3', name: '3 × 3', group: 'Swiss modular' },
    { id: 'swiss-4', name: '4 × 4', group: 'Swiss modular' },
    { id: 'swiss-6', name: '6 × 6', group: 'Swiss modular' },
    { id: 'golden', name: 'Golden section', group: 'Swiss modular' },
    { id: 'golden-r', name: 'Golden section (mirrored)', group: 'Swiss modular' },
    { id: 'rings', name: 'Concentric rings', group: 'Radial / orbital' },
    { id: 'polar-4', name: 'Polar · 4 sectors', group: 'Radial / orbital' },
    { id: 'polar-6', name: 'Polar · 6 sectors', group: 'Radial / orbital' },
    { id: 'polar-8', name: 'Polar · 8 sectors', group: 'Radial / orbital' },
    { id: 'polar-12', name: 'Polar · 12 sectors', group: 'Radial / orbital' },
    { id: 'seal', name: 'Seal perimeter band', group: 'Radial / orbital' },
    { id: 'badge-straight', name: 'Header / footer bars + corner cells', group: 'Hybrid badge' },
    { id: 'badge-curved', name: 'Curved header / footer + side cells', group: 'Hybrid badge' },
    { id: 'badge-telemetry', name: 'Emblem + telemetry column', group: 'Hybrid badge' },
  ];

  S.MOTIFS = [
    { id: 'none', name: 'None' },
    { id: 'starfield', name: 'Starfield' },
    { id: 'colorblock', name: 'Diagonal colour block' },
    { id: 'concentric', name: 'Concentric bands' },
    { id: 'horizon', name: 'Earth limb / horizon' },
    { id: 'sunburst', name: 'Polar sunburst' },
    { id: 'orbits', name: 'Orbital sweep' },
    { id: 'lattice', name: 'Hex crystal lattice' },
    { id: 'hazard', name: 'Hazard stripe band' },
    { id: 'manhattan', name: 'Manhattan street grid' },
  ];

  S.STITCHES = [
    { id: 'auto', name: 'Auto' },
    { id: 'fill', name: 'Tatami fill' },
    { id: 'satin', name: 'Satin' },
    { id: 'twill', name: 'Unstitched (twill)' },
  ];

  S.STITCH_ANGLES = [0, 30, 45, 60, 90, 120, 135, 150];

  /** Cobb-style system codes for semiotic label blocks */
  S.CODES = ['MG-00', 'LS-04', 'CT-02', 'OP-11', 'PR-07', 'BIO-3', 'TX-09', 'NYC-24', 'FME-1', 'ISS-27', 'G-0', 'EVA-2', 'PWR-5', 'AIR-1'];
})(window.SSEP = window.SSEP || {});
