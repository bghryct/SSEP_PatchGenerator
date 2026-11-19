/* ==========================================================================
   Three.js simulated-embroidery viewer
   Extruded patch silhouette (≈ 2.7 mm thick, bevelled merrowed edge), physical
   thread material with normal, roughness, anisotropy (thread direction) and
   sheen maps from S.Embroidery; orbit camera + steerable key light.
   ========================================================================== */
(function (S) {
  'use strict';

  const waitThree = () => new Promise((res, rej) => {
    if (window.THREE_LIB) return res(window.THREE_LIB);
    if (window.THREE_LIB_ERR) return rej(window.THREE_LIB_ERR);
    window.addEventListener('three-ready', () => res(window.THREE_LIB), { once: true });
    window.addEventListener('three-failed', (e) => rej(e.detail || new Error('Three.js failed to load')), { once: true });
  });

  const DEPTH = 0.014, BEVEL_T = 0.008, BEVEL_S = 0.007, SCALE = 3.5;

  class Viewer3D {
    constructor(host) {
      this.host = host;
      this.light = { az: 135, el: 38, intensity: 2.4 };
      this.opts = { anisotropy: 0.65, sheen: 0.45, relief: 1 };
      this.shapeKey = null; this.visible = true; this.dirty = true;
      this.ready = waitThree().then((lib) => this.init(lib)).catch((e) => {
        host.innerHTML = '';
        host.append(S.el('div', { class: 'viewer-msg', text: '3D viewer unavailable — Three.js could not be loaded (offline?). 2D design and exports still work.' }));
        throw e;
      });
    }

    init(lib) {
      const { THREE, OrbitControls, RoomEnvironment } = lib;
      this.T = THREE;
      const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.LinearToneMapping; r.toneMappingExposure = 0.9; // linear keeps thread colours closest to the flat artwork
      r.setClearColor(0x000000, 0);
      this.host.append(r.domElement);

      this.scene = new THREE.Scene();
      const pm = new THREE.PMREMGenerator(r);
      this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
      this.camera.position.set(1.6, -2.4, 7.3);
      this.controls = new OrbitControls(this.camera, r.domElement);
      this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
      this.controls.minDistance = 3.2; this.controls.maxDistance = 16;
      this.controls.autoRotateSpeed = 1.6;
      this.controls.addEventListener('change', () => { this.dirty = true; });

      this.key = new THREE.DirectionalLight(0xffffff, this.light.intensity);
      this.scene.add(this.key, new THREE.HemisphereLight(0xffffff, 0x1a1a22, 0.35));
      this.setLight();

      this.front = new THREE.MeshPhysicalMaterial({ roughness: 1, metalness: 0, sheen: this.opts.sheen, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.55 });
      this.side = new THREE.MeshPhysicalMaterial({ roughness: 0.6, metalness: 0, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.5 });
      this.back = new THREE.MeshStandardMaterial({ color: 0xcdc7b8, roughness: 1, metalness: 0 });
      this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), [this.front, this.side, this.back]);
      this.scene.add(this.mesh);

      new ResizeObserver(() => this.resize()).observe(this.host);
      new IntersectionObserver((es) => { this.visible = es[0].isIntersecting; }).observe(this.host);
      this.resize();
      const loop = () => {
        requestAnimationFrame(loop);
        if (!this.visible || document.hidden) return;
        const moving = this.controls.update();
        if (this.controls.autoRotate || moving || this.dirty) { r.render(this.scene, this.camera); this.dirty = false; }
      };
      loop();
      return this;
    }

    resize() {
      if (!this.renderer) return;
      const w = Math.max(50, this.host.clientWidth), h = Math.max(50, this.host.clientHeight);
      this.renderer.setSize(w, h, false);
      this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px';
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      this.dirty = true;
    }

    setLight(o) {
      Object.assign(this.light, o || {});
      if (!this.key) return;
      const az = S.rad(this.light.az), el = S.rad(this.light.el);
      this.key.position.set(Math.cos(el) * Math.cos(az) * 10, Math.cos(el) * Math.sin(az) * 10, Math.sin(el) * 10);
      this.key.intensity = this.light.intensity;
      this.dirty = true;
    }

    setOptions(o) {
      Object.assign(this.opts, o);
      if (!this.front) return;
      this.front.anisotropy = this.opts.anisotropy;
      this.front.sheen = this.opts.sheen;
      this.front.needsUpdate = true;
      this.dirty = true;
    }

    setAutoRotate(on) { if (this.controls) { this.controls.autoRotate = !!on; this.dirty = true; } }

    view(name) {
      if (!this.camera) return;
      const p = { front: [0, 0, 8.4], tilt: [1.6, -2.4, 7.3], edge: [6.2, -1.2, 2.6], raking: [0, -0.6, 8.2], hero: [1.45, -2.25, 7.7] }[name] || [0, 0, 8.4];
      this.camera.position.set(...p); this.controls.target.set(0, 0, 0); this.controls.update();
      if (name === 'raking') this.setLight({ el: 12, az: 160 });
      if (name === 'hero') this.setLight({ el: 38, az: 135, intensity: 2.4 });
      this.dirty = true;
    }

    buildGeometry(state) {
      const THREE = this.T, o = S.shapeOutline(state);
      const pts = o.pts.slice();
      const a = pts[0], z = pts[pts.length - 1];
      if (Math.hypot(a[0] - z[0], a[1] - z[1]) < 0.5) pts.pop();
      const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x / 1000, 1 - y / 1000)));
      const cx = o.cx / 1000, cy = 1 - o.cy / 1000, zr = DEPTH + 2 * BEVEL_T, REP = 140;
      const uvGen = {
        generateTopUV: (g, v, ia, ib, ic) => [ia, ib, ic].map((i) => new THREE.Vector2(v[i * 3], v[i * 3 + 1])),
        generateSideWallUV: (g, v, ia, ib, ic, id) => {
          const ang = (i) => (Math.atan2(v[i * 3 + 1] - cy, v[i * 3] - cx) / (Math.PI * 2) + 0.5) * REP;
          const u0 = ang(ia);
          return [ia, ib, ic, id].map((i) => {
            let u = ang(i); if (u - u0 > REP / 2) u -= REP; if (u0 - u > REP / 2) u += REP;
            return new THREE.Vector2(u, (v[i * 3 + 2] + BEVEL_T) / zr);
          });
        },
      };
      const geo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL_T, bevelSize: BEVEL_S, bevelSegments: 5, curveSegments: 1, steps: 1, UVGenerator: uvGen });
      // split the lid group into back (first half) and front (second half)
      const caps = geo.groups[0], sides = geo.groups[1], half = caps.count / 2;
      const pos = geo.attributes.position;
      const firstZ = pos.getZ(caps.start);
      const bottomFirst = firstZ < DEPTH / 2;
      geo.clearGroups();
      geo.addGroup(caps.start, half, bottomFirst ? 2 : 0);
      geo.addGroup(caps.start + half, half, bottomFirst ? 0 : 2);
      geo.addGroup(sides.start, sides.count, 1);
      geo.translate(-0.5, -0.5, -DEPTH / 2);
      geo.scale(SCALE, SCALE, SCALE);
      geo.computeVertexNormals();
      return geo;
    }

    tex(canvas, srgb, repeat) {
      const THREE = this.T, t = new THREE.CanvasTexture(canvas);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; }
      t.needsUpdate = true;
      return t;
    }

    /** Push freshly synthesised maps + geometry for the current design. */
    update(state, maps) {
      if (!this.renderer) return;
      const key = state.shape + '|' + state.cornerRadius;
      if (key !== this.shapeKey) { this.mesh.geometry.dispose(); this.mesh.geometry = this.buildGeometry(state); this.shapeKey = key; }
      const f = this.front;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'anisotropyMap']) if (f[k]) f[k].dispose();
      f.map = this.tex(maps.color, true);
      f.normalMap = this.tex(maps.normal, false);
      f.roughnessMap = this.tex(maps.rough, false);
      f.anisotropyMap = this.tex(maps.aniso, false);
      f.anisotropy = this.opts.anisotropy;
      f.normalScale.set(1, 1);
      f.needsUpdate = true;
      const border = S.colorFn(state)(state.borderColor);
      const sm = S.Embroidery.sideMaps(border);
      if (this.side.map) this.side.map.dispose();
      if (this.side.normalMap) this.side.normalMap.dispose();
      this.side.map = this.tex(sm.color, true, true);
      this.side.normalMap = this.tex(sm.normal, false, true);
      this.side.needsUpdate = true;
      this.dirty = true;
    }

    /** Render the current view to a square PNG data URL at the given size. */
    snapshot(size = 2000) {
      if (!this.renderer) return null;
      const r = this.renderer, prevPR = r.getPixelRatio(), prev = new this.T.Vector2(); r.getSize(prev);
      const prevAspect = this.camera.aspect;
      r.setPixelRatio(1); r.setSize(size, size, false);
      this.camera.aspect = 1; this.camera.updateProjectionMatrix();
      r.render(this.scene, this.camera);
      const url = r.domElement.toDataURL('image/png');
      r.setPixelRatio(prevPR); r.setSize(prev.x, prev.y, false);
      this.camera.aspect = prevAspect; this.camera.updateProjectionMatrix();
      this.dirty = true;
      return url;
    }
  }
  S.Viewer3D = Viewer3D;
})(window.SSEP = window.SSEP || {});
