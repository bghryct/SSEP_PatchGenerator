/* ==========================================================================
   Minimal ZIP writer (no dependencies, works offline and from file://).
   Text files are deflated with the browser's CompressionStream when
   available; images are stored as-is (PNG is already compressed).
   ========================================================================== */
(function (S) {
  'use strict';
  const enc = new TextEncoder();

  function dosDateTime(d) {
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, date };
  }

  async function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (typeof data === 'string') return enc.encode(data);
    if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    throw new Error('Unsupported zip entry data');
  }

  async function deflateRaw(bytes) {
    if (typeof CompressionStream === 'undefined') return null;
    try {
      const cs = new CompressionStream('deflate-raw');
      const out = new Blob([bytes]).stream().pipeThrough(cs);
      return new Uint8Array(await new Response(out).arrayBuffer());
    } catch (e) { return null; }
  }

  class ZipWriter {
    constructor() { this.entries = []; this.names = new Set(); }

    /** Add a file. path uses forward slashes; duplicates get " (2)" suffixes. */
    add(path, data, opts = {}) {
      let p = path.replace(/^\/+/, '');
      if (this.names.has(p)) {
        const dot = p.lastIndexOf('.'), base = dot > 0 ? p.slice(0, dot) : p, ext = dot > 0 ? p.slice(dot) : '';
        let n = 2; while (this.names.has(`${base} (${n})${ext}`)) n++;
        p = `${base} (${n})${ext}`;
      }
      this.names.add(p);
      this.entries.push({ path: p, data, compress: opts.compress != null ? opts.compress : !/\.(png|jpe?g|gif|webp|zip|woff2?)$/i.test(p), date: opts.date || new Date() });
      return p;
    }

    get size() { return this.entries.length; }

    async generate() {
      const chunks = [], central = [];
      let offset = 0;
      for (const e of this.entries) {
        const raw = await toBytes(e.data);
        const crc = S.crc32(raw);
        let body = raw, method = 0;
        if (e.compress && raw.length > 256) {
          const z = await deflateRaw(raw);
          if (z && z.length < raw.length) { body = z; method = 8; }
        }
        const name = enc.encode(e.path);
        const { time, date } = dosDateTime(e.date);
        const lh = new DataView(new ArrayBuffer(30));
        lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
        lh.setUint16(8, method, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true);
        lh.setUint32(14, crc, true); lh.setUint32(18, body.length, true); lh.setUint32(22, raw.length, true);
        lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
        chunks.push(new Uint8Array(lh.buffer), name, body);
        const ch = new DataView(new ArrayBuffer(46));
        ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
        ch.setUint16(10, method, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true);
        ch.setUint32(16, crc, true); ch.setUint32(20, body.length, true); ch.setUint32(24, raw.length, true);
        ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
        central.push(new Uint8Array(ch.buffer), name);
        offset += 30 + name.length + body.length;
      }
      const cdSize = central.reduce((a, c) => a + c.length, 0);
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true);
      end.setUint16(8, this.entries.length, true); end.setUint16(10, this.entries.length, true);
      end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
      return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
    }
  }
  S.ZipWriter = ZipWriter;
})(window.SSEP = window.SSEP || {});
