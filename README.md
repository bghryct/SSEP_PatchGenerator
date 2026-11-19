# SSEP Mission Patch Design Studio

**Live:** https://bghryct.github.io/SSEP_PatchGenerator/

A browser-based generative studio for **Baruch College · ART 3041: A.I. for Designers**.
Students design, iterate, typeset and export a **3.5″ × 3.5″ mission patch** for Baruch's
Spring 2027 SSEP microgravity experiment on the ISS, answering the prompt:

> *What message would Baruch send into space?*

No build step, no backend. Plain HTML/CSS/JS + Three.js from a CDN. Interface type is set in
**Spline Sans** and **Spline Sans Mono** (Google Fonts).

---

## Run it

| Option | How |
|---|---|
| **Double-click** | Open `index.html` in Chrome, Edge, Safari or Firefox. Everything runs from `file://` (needs internet for Google Fonts + Three.js). |
| **Local server** | `python3 -m http.server 8000` in this folder → <http://localhost:8000> |
| **GitHub Pages** | Push the folder to a repo → *Settings → Pages → Deploy from branch (root)*. |

Work autosaves in the browser (three slots: **Entry A / B / C**, one per competition entry; the
thumbnails in the top bar switch between them and show a green/amber status dot).
Use **Save recipe .json** to keep a portable copy, or to move it to another computer.

---

## Submitting: the package

When you're done, click **Submit ↗** (top bar) or **Prepare package →** (07 Export & submit):

1. **Student**: your name (required, labels the package) and section. Stored only in this browser.
2. **Entries**: each entry shows its pre-flight checks and has a box for a **concept statement**
   (50–150 words answering *What message would Baruch send into space?*). Untick an entry to leave
   it out.
3. **Contents**: choose what goes in. The 1000 px flat artwork is always included.
4. **Download submission .zip**: every file is rendered fresh, then zipped:

```
SSEP-Patch_First-Last_2026-11-19/
├─ README.txt              human-readable manifest + checks for every entry
├─ submission.json         machine-readable manifest
├─ SSEP_overview.png       all entries side by side (1:1 art, 3D, 1″/0.5″, statement)
└─ Entry-A_<title>/
   ├─ A_flat_1000px.png       official artwork, 3.5″ at 285.7 ppi
   ├─ A_flat_2000px.png       print resolution
   ├─ A_patch.svg             vector, fonts embedded
   ├─ A_embroidered_2000px.png  3D simulation, standard ¾ view
   ├─ A_proof-sheet.png
   ├─ A_recipe.json           reopen and keep editing
   ├─ A_statement.txt
   └─ source-svgs/*.svg       your uploaded drawings
```

Upload that single `.zip` to the course submission page. The zip is built in the browser (no server),
and text files are compressed when the browser supports it.

---

## What's inside

**Format lock.** Every design renders inside a 1000 × 1000-unit square (= 3.5″). The silhouette can be a
circular seal, rounded square, hexagon or shield, always inside that bounding box. You can set the merrowed
border thickness (shown in mm), an inner keyline, the corner radius, and either a tatami-fill ground or
exposed twill.

**Grid & layout engine.**
- *Swiss modular:* 2×2, 3×3, 4×4, 6×6, and golden section (normal and mirrored).
- *Radial / orbital:* concentric rings, 4/6/8/12 polar sectors, and a seal perimeter band.
- *Hybrid badge:* header/footer bars with Cobb-style corner cells, curved header/footer with side cells,
  and emblem plus telemetry column.
- Gutter, padding, text-band ratio and cell radius are adjustable. The construction overlay can be turned on
  or off, and snap-to-cell is available (hold ⌥ to place freely).

**Symbols.**
- *Microgravity set (after Patricia Klein):* spherical flame, hex crystal lattice, crystal burst, orbital
  ellipses, planet + orbit, Astrobee cube, ISS truss, floating droplet, CubeSat, FME mini-lab tube, star.
- *Semiotic set (after Ron Cobb):* gravity off, life support, containment, optical sensor, propulsion,
  biological sample, data telemetry, Baruch/NYC grid, radiation, pressurized, hazard stripes, arrow, power,
  airlock, crew/EVA. Each has a solid, outline or no frame.
- *Background motifs:* starfield, colour block, concentric bands, Earth limb, sunburst, orbital sweep,
  hex lattice, hazard band, Manhattan grid.

**Student SVG upload.** Drag `.svg` files anywhere onto the page.
- Shapes, transforms, CSS classes and gradients are flattened into paths. A white background rectangle
  is dropped automatically.
- Colour modes: *palette* (ranked onto thread slots), *mono*, *nearest thread* or *original*.
- An upload can be placed in a cell, scaled, rotated and mirrored. It can also be tiled: radial orbit,
  row, column, every cell of a role, or four-way mirror.

**Typography.**
- Curated Google Fonts: Space Grotesk, Spline Sans, Spline Sans Mono, IBM Plex Mono, Archivo Narrow, Barlow Condensed, Syne, Inter,
  JetBrains Mono, Oswald, Chakra Petch, Michroma, Rajdhani, Antonio, Saira Condensed, Space Mono,
  Bebas Neue and Unbounded. You can also load **any Google Font by name**.
- Text types: top/bottom arc text, straight text in cells, and Cobb label blocks (pictogram + system code).
- Controls: weight, tracking, uppercase, alignment, auto-fit to cell or band, and letter outline.
- Mission metadata fields (title, subtitle, phrase, code) with quick-fill chips. Text layers *bind* to
  these fields, so changing the title updates every variation.

**Generate variation** (`G`).
- A seeded generator permutes shape, grid, palette, typefaces, motifs, colour blocks, semiotic accents and
  stitch angles. It picks thread colours that keep enough contrast.
- Lock any category, or single layers with the padlock in the layer list.
- Every variation is kept in the strip under the artboard; click one to restore it.

**Thread palettes.** NASA Heritage, Nostromo Industrial, IML/Astrobee Neon, Baruch Blue/White/Gold,
High-Contrast Monochrome, ISS Solar Array and Cleanroom. Each has 4–6 editable threads, and the readout
counts the threads actually used.

**Small-scale legibility.** Live previews at 1″ (96 px), 0.5″ and a greyscale value check, plus automatic
checks: thread count, minimum cap height in mm (warns below 4 mm), cap height at 1″, type contrast and
merrow width.

**3D embroidery simulation (Three.js).** The design is rendered a second time as a stitch height field:
- **Satin** (dashed thread columns) on type, strokes and borders.
- **Tatami** (staggered brick rows at each layer's stitch angle) on fills.
- **Merrowed** roll on the edge, and **twill** weave where the ground is unstitched.

From that height field the studio derives normal, roughness, anisotropy (thread direction from the
structure tensor) and cavity-shaded colour maps. These feed a `MeshPhysicalMaterial` with sheen on an
extruded, bevelled patch, with merrow texture on the sides and a backing on the reverse. You get orbit,
zoom and tilt, presets (front / tilt / edge / raking light), a draggable key-light pad, relief, thread
sheen, fibre sheen and 1K/2K maps.

**Export.**
- Flat PNG at 1000 or 2000 px, with a DPI tag so it prints at exactly 3.5″.
- 3D embroidered render PNG.
- Proof sheet: 1:1 art, 3D render, 1″ and 0.5″ previews, value check, thread list and spec table.
- Vector SVG with subset fonts embedded (base64 WOFF2) and `data-stitch` hints on each element.
- JSON recipe, import and export.

---

## Shortcuts

| Key | Action |
|---|---|
| `G` | Generate variation |
| `⌘/Ctrl Z`, `⇧⌘Z` | Undo / redo |
| `⌘/Ctrl D` | Duplicate layer |
| `⌫` | Delete layer |
| Arrows (+⇧) | Nudge 2 (10) units |
| Drag the square handle | Scale |
| Drag the round handle | Rotate (⇧ snaps to 15°) |
| Drag arc text | Rotate it around the seal |
| Double-click type | Edit it in the inspector |

---

## Code map

```
index.html            layout + Three.js ESM loader (importmap → jsDelivr, three@0.160.0)
css/studio.css        Swiss/technical UI, light + dark tokens
js/core.js            RNG, colour, path builder, DOM, events, PNG DPI chunk
js/data.js            palettes, fonts, presets
js/shapes.js          patch silhouettes (path + sampled outline)
js/grids.js           grid & layout engine (cells, bands, overlay, snaps)
js/symbols-*.js       built-in vector symbol sets
js/backends.js        text layout + Canvas / SVG drawing backends
js/renderer.js        draws a design state through any backend
js/motifs.js          procedural background motifs
js/uploads.js         SVG → flat path list parser
js/fonts.js           Google Fonts loader, search, SVG font embedding
js/generator.js       layer factories, default design, variation engine
js/embroidery.js      stitch backend + height/normal/roughness/anisotropy synthesis
js/viewer3d.js        Three.js viewer
js/zip.js             dependency-free ZIP writer (store + deflate-raw)
js/export.js          PNG / SVG / JSON / proof sheet builders, entry checks
js/package.js         submission dialog, package build, overview board, manifests
js/controls.js        form-control kit
js/workspace.js       artboard, overlay, direct manipulation, rulers, previews
js/panels.js          left control panel
js/inspector.js       layers, inspector, 3D controls, checks, top bar
js/app.js             store (undo/redo), entries, boot
```

The stitch simulation is an approximation for design review. Confirm stitch types, densities and minimum
sizes with your embroidery digitizer before production.
