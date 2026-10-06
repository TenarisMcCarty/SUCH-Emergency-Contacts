/* Bambu Studio project (.3mf) exporter for the two-colour emergency card.
 *
 *   <script src="bambu3mf.js" defer></script>      (the bambu-printers/ folder must sit next to it)
 *
 *   const bytes = await Bambu3MF.make({ black, white, name, pauseZ, layerHeight: 0.1, printer: 'H2D', material: 'ABS' });
 *   // bytes: Uint8Array of a .3mf; save it as `${name}.3mf`
 *
 * black / white  binary STL (Uint8Array or ArrayBuffer) of the dark and the light part, same coordinate system:
 *                they are kept exactly where they are relative to each other and become ONE object with TWO
 *                parts (LIGHT = filament 1, shown white; DARK = filament 2, shown black). The object is centred
 *                on the plate.
 * name           object / project name
 * pauseZ         Z (mm) of the pocket roof. The print pauses (Bambu "Add Pause", M400 U1) before the
 *                first layer that reaches above pauseZ, i.e. after the layer whose top is pauseZ.
 * layerHeight    0.2 (default). First layer is always 0.2 mm.
 * Optional:
 * pieces         [{ black, white, name }, …] instead of black / white / name: several two-part objects on one plate
 *                (a card and its keychain), side by side with 6 mm between them and centred as a group (clear of
 *                the prime tower, which sits behind the middle of the plate).
 *                They share the plate's one pause, so their pockets must have the same roof height (pauseZ).
 * positions      with pieces: [[x, y], …], each piece's centre on the plate (from platePlan()) instead of the row
 * tower          with positions: [x, y], the prime tower's front-left corner (wipe_tower_x / wipe_tower_y)
 * printer        one of Bambu3MF.PRINTERS' ids (default 'P2S'): the enclosed Bambu Lab printers with a 0.4 mm
 *                nozzle, single- and two-nozzle. On the H2D, H2D Pro and X2D each colour gets its own nozzle
 *                (filament grouping "Manual": LIGHT = left nozzle, DARK = right), so the colours never share a
 *                nozzle: no purging, no tint of dark in the light lettering, and a faster print. (Bambu Studio's
 *                default, "Auto For Flush", put both colours on one nozzle in its command-line slicer.) The H2C
 *                keeps the automatic grouping.
 * material       'ABS' (default) or 'PETG' (Bambu ABS / Bambu PETG HF system filament presets for that printer)
 * ironing        false (default). true = iron the topmost surface ("topmost"). Off by default: each colour is
 *                ironed by its own filament and the hot nozzle face can drag black onto neighbouring white
 *                QR modules, lowering scan contrast.
 *
 * Settings: the printer's "0.20mm Standard" process with overrides (100 % infill, 3 walls, Arachne, no brim,
 * no supports, prime tower on), plate: Textured PEI, bed at most 90 °C, and the wall and first-layer speeds of
 * Bambu's "High Quality" presets for sharp lettering (DETAIL). They come from bambu-printers/<id>.json,
 * made by Bambu Studio itself from its system presets (tools/build_templates.py). bambu-template.json (P2S)
 * stays for older cached copies of this script.
 *
 * Bambu3MF.pauseLayer(pauseZ, layerHeight) -> { layer, topZ, afterZ } (1-based layer that the pause
 * precedes, its top Z, and the Z printed before the pause).
 * Bambu3MF.zipWriter() -> { add(name, bytes), finish() }: a deflated ZIP built one file at a time (the
 * dashboard's "all cards" download).
 * Bambu3MF.platePlan(printer, { w, h }) -> { slots: [[x, y], …], tower: [x, y] }: as many w × h footprints as fit
 * on that printer's plate (rows from the front, left to right), clear of the prime tower and of the plate's no-go
 * areas, where every nozzle reaches.
 * Bambu3MF.plateSTL(pieces, positions) -> { black, white }: the pieces' parts as two binary STLs, placed as on the plate.
 */
const Bambu3MF = (() => {
  'use strict';

  const FIRST_LAYER = 0.2;
  const BED_MAX = 90; // °C, for the PVC NFC tag (see projectSettings)
  // Slower walls for sharp lettering: the values of Bambu's own "0.12mm High Quality" process presets (outer walls
  // 60 mm/s at 2000 mm/s², inner walls and top surface 150 mm/s), and a slower first layer for the face on the plate.
  // Per extruder variant, never faster than the printer's preset.
  const DETAIL = { outer_wall_speed: 60, outer_wall_acceleration: 2000, inner_wall_speed: 150, top_surface_speed: 150, initial_layer_speed: 30, initial_layer_infill_speed: 60 };
  const script = typeof document !== 'undefined' ? document.currentScript : null;
  const BASE_URL = script && script.src ? new URL('./', script.src).href : '';
  const enc = new TextEncoder();
  // Enclosed Bambu Lab printers (ABS needs an enclosure), 0.4 mm nozzle.
  const PRINTERS = [
    { id: 'H2D', label: 'H2D (two nozzles)', nozzles: 2 },
    { id: 'H2DP', label: 'H2D Pro (two nozzles)', nozzles: 2 },
    { id: 'H2C', label: 'H2C (two nozzles)', nozzles: 2 },
    { id: 'X2D', label: 'X2D (two nozzles)', nozzles: 2 },
    { id: 'H2S', label: 'H2S', nozzles: 1 },
    { id: 'X1C', label: 'X1 Carbon', nozzles: 1 },
    { id: 'X1E', label: 'X1E', nozzles: 1 },
    { id: 'P2S', label: 'P2S', nozzles: 1 },
    { id: 'P1S', label: 'P1S', nozzles: 1 },
  ];
  const templates = new Map();

  function loadTemplate(printer = 'P2S') {
    if (!PRINTERS.some(p => p.id === printer)) return Promise.reject(new Error(`Unknown printer "${printer}"`));
    if (!templates.has(printer)) {
      templates.set(printer, fetch(`${BASE_URL}bambu-printers/${printer}.json`).then(r => {
        if (!r.ok) throw new Error(`bambu-printers/${printer}.json: HTTP ${r.status}`);
        return r.json();
      }).catch(e => { templates.delete(printer); throw e; }));
    }
    return templates.get(printer);
  }

  // ---------- layers / pause ----------
  const round4 = v => Math.round(v * 1e4) / 1e4;

  function pauseLayer(pauseZ, layerHeight = 0.2) {
    const h = layerHeight, eps = 1e-4;
    if (!(pauseZ > FIRST_LAYER - eps)) throw new Error('pauseZ must be at least the first layer height');
    // Layer k (1-based) spans [top(k-1), top(k)] and is sliced at its middle. The pause goes before the
    // first layer whose slice plane is at or above pauseZ, so nothing above pauseZ is printed before it.
    const top = k => (k === 1 ? FIRST_LAYER : FIRST_LAYER + (k - 1) * h);
    let k = 2;
    while (top(k) - h / 2 < pauseZ - eps) k++;
    return { layer: k, topZ: round4(top(k)), afterZ: round4(top(k - 1)) };
  }

  // ---------- STL -> indexed mesh XML ----------
  // Binary STL -> { pos: Float64Array of unique positions (xyz), tri: Int32Array of position ids }.
  // Corners are merged only when their float32 coordinates are bit-identical.
  function stlMesh(stl, label) {
    const u8 = stl instanceof Uint8Array ? stl : new Uint8Array(stl);
    if (u8.length < 84) throw new Error(`${label} STL is too short`);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const n = dv.getUint32(80, true);
    if (84 + n * 50 !== u8.length) throw new Error(`${label} STL is not a binary STL (size mismatch)`);
    const ids = new Map(), pos = [], tri = [];
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12, t = [];
      for (let k = 0; k < 3; k++) {
        const q = o + k * 12;
        const key = dv.getUint32(q, true) + ',' + dv.getUint32(q + 4, true) + ',' + dv.getUint32(q + 8, true);
        let id = ids.get(key);
        if (id === undefined) {
          id = pos.length / 3; ids.set(key, id);
          pos.push(dv.getFloat32(q, true), dv.getFloat32(q + 4, true), dv.getFloat32(q + 8, true));
        }
        t.push(id);
      }
      if (t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2]) tri.push(t[0], t[1], t[2]); // drop degenerate
    }
    return { pos: Float64Array.from(pos), tri: Int32Array.from(tri) };
  }

  // Give every triangle corner its own vertex unless two triangles are neighbours across an edge, so
  // that solids touching only along an edge (diagonal QR modules, letters) do not create edges with 4
  // faces. Faces around such an edge are paired the way they enclose solid material (like admesh does
  // for STL import). Returns Int32Array vertex id per corner + positions per vertex id.
  function splitNonManifold({ pos, tri }) {
    const nc = tri.length, parent = new Int32Array(nc);
    for (let i = 0; i < nc; i++) parent[i] = i;
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const union = (x, y) => { x = find(x); y = find(y); if (x !== y) parent[x] = y; };
    const np = pos.length / 3, edges = new Map();
    for (let t = 0; t < nc / 3; t++) for (let k = 0; k < 3; k++) {
      const a = tri[3 * t + k], b = tri[3 * t + (k + 1) % 3];
      const key = a < b ? a * np + b : b * np + a;
      let list = edges.get(key);
      if (!list) edges.set(key, list = []);
      list.push(3 * t + k); // half-edge = corner index of its start vertex
    }
    const end = h => h - (h % 3) + ((h % 3) + 1) % 3, third = h => h - (h % 3) + ((h % 3) + 2) % 3;
    const P = i => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];
    const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
    const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const join = (h1, h2) => { union(h1, end(h2)); union(end(h1), h2); }; // h1: a->b, h2: b->a
    for (const list of edges.values()) {
      if (list.length === 2) { join(list[0], list[1]); continue; }
      if (list.length < 2 || list.length % 2) continue; // open or odd edge: leave it open
      const a = tri[list[0]], pa = P(a), d = sub(P(tri[end(list[0])]), pa);
      const dl = Math.hypot(...d); d[0] /= dl; d[1] /= dl; d[2] /= dl;
      const u0 = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      const u = cross(d, u0), v = cross(d, u);
      const faces = list.map(h => {
        const w = sub(P(tri[third(h)]), pa), wp = sub(w, d.map(x => x * dot(w, d)));
        const n = cross(sub(P(tri[end(h)]), P(tri[h])), sub(P(tri[third(h)]), P(tri[h])));
        // s < 0: the material lies in the wedge on the increasing-angle side of this face
        return { h, ang: Math.atan2(dot(wp, v), dot(wp, u)), s: dot(n, cross(d, wp)), fwd: tri[h] === a };
      }).sort((x, y) => (Math.abs(x.ang - y.ang) > 2e-3 ? x.ang - y.ang : (x.s < 0) - (y.s < 0))); // coincident faces (two solids touching face to face): the one with material below comes first
      const m = faces.length, i0 = faces.findIndex(f => f.s < 0);
      let ok = i0 >= 0;
      for (let i = 0; ok && i < m; i += 2) ok = faces[(i0 + i) % m].fwd !== faces[(i0 + i + 1) % m].fwd;
      if (ok) for (let i = 0; i < m; i += 2) join(faces[(i0 + i) % m].h, faces[(i0 + i + 1) % m].h);
      else { // fallback: pair opposite half-edges in order
        const f = list.filter(h => tri[h] === a), r = list.filter(h => tri[h] !== a);
        for (let i = 0; i < Math.min(f.length, r.length); i++) join(f[i], r[i]);
      }
    }
    const vid = new Int32Array(nc), root = new Map(), out = [];
    for (let c = 0; c < nc; c++) {
      const r = find(c);
      let id = root.get(r);
      if (id === undefined) { id = out.length / 3; root.set(r, id); const p = tri[c]; out.push(pos[3 * p], pos[3 * p + 1], pos[3 * p + 2]); }
      vid[c] = id;
    }
    return { vid, pos: out };
  }

  const num = v => { const r = Math.round(v * 1e6) / 1e6; return r === 0 ? '0' : String(r); };

  // Returns { xml: string[] (object element lines), faces }
  function meshObject(mesh, id, uuid, off) {
    const { vid, pos } = splitNonManifold(mesh), verts = [], tris = [];
    for (let i = 0; i < pos.length; i += 3)
      verts.push(`     <vertex x="${num(pos[i] - off[0])}" y="${num(pos[i + 1] - off[1])}" z="${num(pos[i + 2] - off[2])}"/>`);
    for (let c = 0; c < vid.length; c += 3) tris.push(`     <triangle v1="${vid[c]}" v2="${vid[c + 1]}" v3="${vid[c + 2]}"/>`);
    return {
      faces: tris.length,
      xml: [`  <object id="${id}" p:UUID="${uuid}" type="model">`, '   <mesh>', '    <vertices>', ...verts,
        '    </vertices>', '    <triangles>', ...tris, '    </triangles>', '   </mesh>', '  </object>'],
    };
  }

  // ---------- XML helpers ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const hex8 = n => n.toString(16).padStart(8, '0');
  const NS = 'unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" ' +
    'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" ' +
    'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p"';
  const IDENT = '1 0 0 0 1 0 0 0 1 0 0 0';

  // ---------- ZIP (stored or deflated entries, CRC-32) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

  async function deflateRaw(data) {
    if (typeof CompressionStream === 'undefined') return null;
    try {
      const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) { return null; }
  }

  // A ZIP built one file at a time, so a big batch keeps only the compressed bytes:
  //   const z = zipWriter(); await z.add(name, bytes); …; new Blob(z.finish(), { type: 'application/zip' })
  function zipWriter() {
    const parts = [], central = [];
    let offset = 0, count = 0;
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const put = (dv, list) => list.forEach(([o, v, n]) => (n === 4 ? dv.setUint32(o, v, true) : dv.setUint16(o, v, true)));
    return {
      async add(fileName, data) {
        const name = enc.encode(fileName), crc = crc32(data);
        let body = data, method = 0;
        if (data.length > 256) {
          const z = await deflateRaw(data);
          if (z && z.length < data.length) { body = z; method = 8; }
        }
        const head = new DataView(new ArrayBuffer(30));
        put(head, [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, method, 2], [10, time, 2], [12, date, 2], [14, crc, 4],
          [18, body.length, 4], [22, data.length, 4], [26, name.length, 2], [28, 0, 2]]);
        const cen = new DataView(new ArrayBuffer(46));
        put(cen, [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, method, 2], [12, time, 2], [14, date, 2],
          [16, crc, 4], [20, body.length, 4], [24, data.length, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2],
          [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]]);
        parts.push(new Uint8Array(head.buffer), name, body);
        central.push(new Uint8Array(cen.buffer), name);
        offset += 30 + name.length + body.length;
        count++;
      },
      // All the ZIP's pieces, in order.
      finish() {
        const cenSize = central.reduce((n, b) => n + b.length, 0);
        const end = new DataView(new ArrayBuffer(22));
        put(end, [[0, 0x06054b50, 4], [8, count, 2], [10, count, 2], [12, cenSize, 4], [16, offset, 4]]);
        return [...parts, ...central, new Uint8Array(end.buffer)];
      },
    };
  }

  async function zip(files) {
    const z = zipWriter();
    for (const f of files) await z.add(f.name, f.data);
    const all = z.finish();
    const out = new Uint8Array(all.reduce((n, b) => n + b.length, 0));
    let at = 0;
    for (const b of all) { out.set(b, at); at += b.length; }
    return out;
  }

  // ---------- project settings ----------
  function projectSettings(tpl, { material, layerHeight, ironing, towerWidth }) {
    const s = JSON.parse(JSON.stringify(tpl.settings));
    const patch = tpl.materials[material];
    if (!patch) throw new Error(`Unknown material "${material}" (use ${Object.keys(tpl.materials).join(' or ')})`);
    Object.assign(s, patch);
    // Every process key that differs from the system preset must be listed here, otherwise Bambu Studio
    // replaces it with the system value when the project is opened.
    const diff = new Set(s.different_settings_to_system[0].split(';').filter(Boolean));
    const setProcess = (key, value) => {
      s[key] = value;
      if (value === tpl.system[key]) diff.delete(key); else diff.add(key);
    };
    setProcess('layer_height', String(round4(layerHeight)));
    setProcess('ironing_type', ironing ? 'topmost' : 'no ironing');
    // Full plates: the tower's real size (about 35 mm, Bambu Studio's rib-wall tower), so Bambu Studio doesn't move it
    // onto the pieces to make room for a wider one.
    if (towerWidth) setProcess('prime_tower_width', String(towerWidth));
    for (const [key, max] of Object.entries(DETAIL)) {
      if (!Array.isArray(s[key])) continue;
      const v = s[key].map(x => String(Math.min(Number(x), max)));
      if (v.some((x, i) => x !== s[key][i])) { s[key] = v; diff.add(key); }
    }
    s.different_settings_to_system[0] = [...diff].sort().join(';');
    // Bed at most 90 C: the PVC NFC tag sits in the card from the pause on, and PVC tags made for embedding are
    // rated for beds up to 90 C. Bambu's ABS presets use 90 C on the textured plate, PETG HF 70 C.
    // Filament keys changed from the system preset are listed per filament (entries 1…n), like process keys.
    const nf = s.filament_colour.length;
    for (const key of ['textured_plate_temp', 'textured_plate_temp_initial_layer', 'hot_plate_temp', 'hot_plate_temp_initial_layer', 'eng_plate_temp', 'eng_plate_temp_initial_layer']) {
      if (!Array.isArray(s[key])) continue;
      const before = s[key];
      s[key] = before.map(v => String(Math.min(Number(v), BED_MAX)));
      s[key].forEach((v, i) => {
        if (v === before[i] || i >= nf) return;
        const list = new Set((s.different_settings_to_system[i + 1] || '').split(';').filter(Boolean));
        list.add(key);
        s.different_settings_to_system[i + 1] = [...list].sort().join(';');
      });
    }
    return s;
  }

  // ---------- main ----------
  async function make({ black, white, name = 'card', pieces, positions, tower, pauseZ, layerHeight = 0.2, printer = 'P2S', material = 'ABS', ironing = false, template } = {}) {
    const list = pieces || [{ black, white, name }];
    if (!list.length || list.some(p => !p.black || !p.white)) throw new Error('make(): black and white STL data are required');
    if (typeof pauseZ !== 'number' || !isFinite(pauseZ)) throw new Error('make(): pauseZ (mm) is required');
    if (!(layerHeight >= 0.04 && layerHeight <= 0.32)) throw new Error('make(): layerHeight out of range');
    const tpl = template || await loadTemplate(printer);
    const settings = projectSettings(tpl, { material, layerHeight, ironing, towerWidth: positions && tower ? TOWER : 0 });
    // Two fixed nozzles (H2D, H2D Pro, X2D): filament 1 (LIGHT) on the left nozzle, filament 2 (DARK) on the right.
    // These are project options (Bambu Studio keeps them from the file), repeated in the plate's metadata below.
    // The H2C's right side is a nozzle changer: a fixed grouping needs the printer's own nozzle list, so it keeps
    // Bambu Studio's automatic grouping (a fixed one fails to slice: "Group error in manual mode").
    const twoNozzles = settings.nozzle_diameter.length > 1 && (settings.extruder_max_nozzle_count || []).every(n => n === '1');
    if (twoNozzles) {
      settings.filament_map_mode = 'Manual';
      settings.filament_map = ['1', '2'];
      settings.filament_nozzle_map = ['0', '1'];
    }

    // Each piece: one object with a LIGHT part (filament 1) and a DARK part (filament 2). Its origin is the centre
    // of its footprint at the bottom, so both parts keep exactly their STL positions relative to each other.
    const pause = pauseLayer(pauseZ, layerHeight);
    const objs = list.map((pc, i) => {
      const pw = stlMesh(pc.white, 'white'), pb = stlMesh(pc.black, 'black');
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const { pos: p } of [pw, pb]) for (let k = 0; k < p.length; k += 3) for (let c = 0; c < 3; c++) {
        if (p[k + c] < lo[c]) lo[c] = p[k + c];
        if (p[k + c] > hi[c]) hi[c] = p[k + c];
      }
      if (pause.topZ > hi[2] - lo[2] + 1e-3) throw new Error(`pauseZ ${pauseZ} is above the top of the piece (${round4(hi[2] - lo[2])} mm)`);
      const n = list.length;
      return { pw, pb, name: pc.name || name, off: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]], width: hi[0] - lo[0],
        id: 2 * n + 1 + i, file: `3D/Objects/object_${i + 1}.model`,
        parts: [{ id: 2 * i + 1, label: 'LIGHT', p: pw, filament: 1 }, { id: 2 * i + 2, label: 'DARK', p: pb, filament: 2 }] };
    });

    const area = settings.printable_area.map(s => s.split('x').map(Number));
    const bedX = (Math.min(...area.map(a => a[0])) + Math.max(...area.map(a => a[0]))) / 2;
    const bedY = (Math.min(...area.map(a => a[1])) + Math.max(...area.map(a => a[1]))) / 2;
    // Left to right (the first piece on the left), 6 mm apart, centred as a group. Side by side keeps them low on
    // the plate, clear of the prime tower behind (stacked front to back, a card and a keychain reach it on the H2S).
    const GAP = 6, total = objs.reduce((t, o) => t + o.width, 0) + GAP * (objs.length - 1);
    let x = bedX - total / 2;
    for (const o of objs) { o.place = `1 0 0 0 1 0 0 0 1 ${num(x + o.width / 2)} ${num(bedY)} 0`; x += o.width + GAP; }
    // A full plate (platePlan): each piece where it was planned, the prime tower in the room kept for it.
    if (positions) {
      if (positions.length !== objs.length) throw new Error('make(): one position per piece');
      objs.forEach((o, i) => { o.place = `1 0 0 0 1 0 0 0 1 ${num(positions[i][0])} ${num(positions[i][1])} 0`; });
      if (tower) { settings.wipe_tower_x = [num(tower[0])]; settings.wipe_tower_y = [num(tower[1])]; }
    }

    const objectModels = objs.map(o => {
      const lines = [];
      for (const part of o.parts) {
        const m = meshObject(part.p, part.id, `${hex8((o.id << 16) | (part.id - 1))}-81cb-4c03-9d28-80fed5dfa1dc`, o.off);
        if (!m.faces) throw new Error(`${part.label} STL has no triangles`);
        part.faces = m.faces;
        for (const l of m.xml) lines.push(l); // one at a time: a spread of 100 000+ lines exceeds the browser's argument limit
      }
      return ['<?xml version="1.0" encoding="UTF-8"?>', `<model ${NS}>`,
        ' <metadata name="BambuStudio:3mfVersion">1</metadata>', ' <resources>', ...lines, ' </resources>',
        '</model>', ''].join('\n');
    });
    const day = new Date().toISOString().slice(0, 10);
    const title = esc(name);

    const meta = [['Application', tpl.app], ['BambuStudio:3mfVersion', '1'], ['Copyright', ''], ['CreationDate', day],
      ['Description', ''], ['Designer', ''], ['DesignerCover', ''], ['DesignerUserId', ''], ['License', ''],
      ['ModificationDate', day], ['Origin', ''], ['ProfileCover', ''], ['ProfileDescription', ''], ['ProfileTitle', ''],
      ['Title', title]];
    const rootModel = ['<?xml version="1.0" encoding="UTF-8"?>', `<model ${NS}>`,
      ...meta.map(([k, v]) => ` <metadata name="${k}">${v}</metadata>`),
      ' <resources>',
      ...objs.flatMap(o => [`  <object id="${o.id}" p:UUID="${hex8(o.id)}-61cb-4c03-9d28-80fed5dfa1dc" type="model">`, '   <components>',
        ...o.parts.map((pt, i) => `    <component p:path="/${o.file}" objectid="${pt.id}" p:UUID="${hex8((o.id << 16) | i)}-b206-40ff-9872-83e8017abed1" transform="${IDENT}"/>`),
        '   </components>', '  </object>']),
      ' </resources>',
      ' <build p:UUID="2c7c17d8-22b5-4d84-8835-1976022ea369">',
      ...objs.map(o => `  <item objectid="${o.id}" p:UUID="${hex8(o.id)}-b1ec-4553-aec9-835e5b724bb4" transform="${o.place}" printable="1"/>`),
      ' </build>', '</model>', ''].join('\n');

    const nf = settings.filament_colour.length;
    const modelSettings = ['<?xml version="1.0" encoding="UTF-8"?>', '<config>',
      ...objs.flatMap(o => [`  <object id="${o.id}">`,
        `    <metadata key="name" value="${esc(o.name)}"/>`, '    <metadata key="extruder" value="1"/>',
        `    <metadata face_count="${o.parts[0].faces + o.parts[1].faces}"/>`,
        ...o.parts.flatMap(pt => [
          `    <part id="${pt.id}" subtype="normal_part">`,
          `      <metadata key="name" value="${esc(o.name)} ${pt.label}"/>`,
          '      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>',
          `      <metadata key="extruder" value="${pt.filament}"/>`,
          `      <mesh_stat face_count="${pt.faces}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>`,
          '    </part>']),
        '  </object>']),
      '  <plate>', '    <metadata key="plater_id" value="1"/>', '    <metadata key="plater_name" value=""/>',
      '    <metadata key="locked" value="false"/>', `    <metadata key="filament_map_mode" value="${esc(settings.filament_map_mode)}"/>`,
      `    <metadata key="filament_maps" value="${settings.filament_map.join(' ')}"/>`,
      `    <metadata key="filament_volume_maps" value="${Array(nf).fill(0).join(' ')}"/>`,
      ...objs.flatMap((o, i) => ['    <model_instance>', `      <metadata key="object_id" value="${o.id}"/>`, '      <metadata key="instance_id" value="0"/>',
        `      <metadata key="identify_id" value="${100 + i}"/>`, '    </model_instance>']),
      '  </plate>', '  <assemble>',
      ...objs.map(o => `   <assemble_item object_id="${o.id}" instance_id="0" transform="${o.place}" offset="0 0 0" />`), '  </assemble>',
      '</config>', ''].join('\n');

    // Same element the GUI writes for layer slider -> right click -> "Add Pause" (type 1 = PausePrint).
    const customGcode = ['<?xml version="1.0" encoding="utf-8"?>', '<custom_gcodes_per_layer>', '<plate>', '<plate_info id="1"/>',
      `<layer top_z="${pause.topZ}" type="1" extruder="1" color="" extra="" gcode="${esc(settings.machine_pause_gcode)}"/>`,
      '<mode value="MultiAsSingle"/>', '</plate>', '</custom_gcodes_per_layer>', ''].join('\n');

    const files = [
      ['[Content_Types].xml', ['<?xml version="1.0" encoding="UTF-8"?>',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
        ' <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        ' <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>',
        ' <Default Extension="png" ContentType="image/png"/>',
        ' <Default Extension="gcode" ContentType="text/x.gcode"/>', '</Types>', ''].join('\n')],
      ['_rels/.rels', ['<?xml version="1.0" encoding="UTF-8"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        ' <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>',
        '</Relationships>', ''].join('\n')],
      ['3D/3dmodel.model', rootModel],
      ['3D/_rels/3dmodel.model.rels', ['<?xml version="1.0" encoding="UTF-8"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        ...objs.map((o, i) => ` <Relationship Target="/${o.file}" Id="rel-${i + 1}" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>`),
        '</Relationships>', ''].join('\n')],
      ...objs.map((o, i) => [o.file, objectModels[i]]),
      ['Metadata/project_settings.config', JSON.stringify(settings, null, 4) + '\n'],
      ['Metadata/model_settings.config', modelSettings],
      ['Metadata/custom_gcode_per_layer.xml', customGcode],
      ['Metadata/slice_info.config', ['<?xml version="1.0" encoding="UTF-8"?>', '<config>', '  <header>',
        '    <header_item key="X-BBL-Client-Type" value="slicer"/>',
        `    <header_item key="X-BBL-Client-Version" value="${esc(tpl.app.replace(/^BambuStudio-/, ''))}"/>`,
        '  </header>', '</config>', ''].join('\n')],
    ];
    return zip(files.map(([n, text]) => ({ name: n, data: enc.encode(text) })));
  }

  // ---------- full plates ----------
  // The prime tower: about 35 × 35 mm from its front-left corner on every printer (Bambu Studio's rib-wall tower; measured
  // in its G-code), plus room for its brim.
  const TOWER = 35, TOWER_ROOM = 5, EDGE = 8, SPACING = 6;
  const rectOf = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
  const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  // As many w × h footprints as fit: inside the plate less EDGE, where every nozzle reaches (two-nozzle printers),
  // SPACING apart, clear of the plate's no-go area and the prime tower. Rows from the front, left to right; the
  // block is centred on the plate. The tower goes beside the block, behind it, or in the back row's last place.
  async function platePlan(printer, { w, h }) {
    const s = (await loadTemplate(printer)).settings;
    let [x0, y0, x1, y1] = rectOf(s.printable_area.map(p => p.split('x').map(Number)));
    for (const a of s.extruder_printable_area || []) {
      const r = rectOf(a.split(',').map(p => p.split('x').map(Number)));
      x0 = Math.max(x0, r[0]); y0 = Math.max(y0, r[1]); x1 = Math.min(x1, r[2]); y1 = Math.min(y1, r[3]);
    }
    const nogo = [];
    if ((s.bed_exclude_area || []).length > 2) nogo.push(rectOf(s.bed_exclude_area.map(p => p.split('x').map(Number))));
    x0 += EDGE; y0 += EDGE; x1 -= EDGE; y1 -= EDGE;
    const T = TOWER + 2 * TOWER_ROOM, cols = Math.floor((x1 - x0 + SPACING) / (w + SPACING)), rows = Math.floor((y1 - y0 + SPACING) / (h + SPACING));
    if (cols < 1 || rows < 1) throw new Error(`A ${w} x ${h} mm set doesn't fit on the ${printer} plate.`);
    const bw = cols * w + (cols - 1) * SPACING, bh = rows * h + (rows - 1) * SPACING;
    let layout;
    if (x1 - x0 - bw >= T + SPACING) {           // beside the block, on the right
      const left = x0 + (x1 - x0 - bw - SPACING - T) / 2, bottom = y0 + (y1 - y0 - bh) / 2;
      layout = { left, bottom, rows, tower: [left + bw + SPACING + TOWER_ROOM, bottom + bh / 2 - TOWER / 2] };
    } else if (y1 - y0 - bh >= T + SPACING) {    // behind the block
      const left = x0 + (x1 - x0 - bw) / 2, bottom = y0 + (y1 - y0 - bh - SPACING - T) / 2;
      layout = { left, bottom, rows, tower: [left + bw / 2 - TOWER / 2, bottom + bh + SPACING + TOWER_ROOM] };
    } else {                                     // in the back row's last place
      const left = x0 + (x1 - x0 - bw) / 2, bottom = y0 + (y1 - y0 - bh) / 2, top = bottom + bh;
      layout = { left, bottom, rows, tower: [left + bw - w / 2 - TOWER / 2, top - h / 2 - TOWER / 2], drop: [rows - 1, cols - 1] };
    }
    const towerRect = [layout.tower[0] - TOWER_ROOM, layout.tower[1] - TOWER_ROOM, layout.tower[0] + TOWER + TOWER_ROOM, layout.tower[1] + TOWER + TOWER_ROOM];
    const slots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (layout.drop && layout.drop[0] === r && layout.drop[1] === c) continue;
      const cx = layout.left + c * (w + SPACING) + w / 2, cy = layout.bottom + r * (h + SPACING) + h / 2;
      const box = [cx - w / 2 - SPACING / 2, cy - h / 2 - SPACING / 2, cx + w / 2 + SPACING / 2, cy + h / 2 + SPACING / 2];
      if (overlap(box, towerRect) || nogo.some(n => overlap(box, n))) continue;
      slots.push([round4(cx), round4(cy)]);
    }
    if (!slots.length) throw new Error(`No room for a set on the ${printer} plate.`);
    return { slots, tower: layout.tower.map(round4) };
  }

  // The pieces' parts in two binary STLs (all DARK parts, all LIGHT parts), each piece placed like make() places it:
  // the middle of its footprint at its position, its bottom on the plate. Bambu Studio moves an imported object to
  // the middle of the plate, so it also returns `centre`: the middle of all the pieces' footprint, the object's
  // Position X / Y that puts every piece back where it was planned (clear of the prime tower).
  function plateSTL(pieces, positions) {
    const all = [Infinity, Infinity, -Infinity, -Infinity];
    const parts = { black: [], white: [] };
    pieces.forEach((pc, i) => {
      const bufs = { black: pc.black instanceof Uint8Array ? pc.black : new Uint8Array(pc.black), white: pc.white instanceof Uint8Array ? pc.white : new Uint8Array(pc.white) };
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const u8 of Object.values(bufs)) {
        const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), n = dv.getUint32(80, true);
        for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++) {
          const v = dv.getFloat32(84 + t * 50 + 12 + k * 12 + c * 4, true);
          if (v < lo[c]) lo[c] = v;
          if (v > hi[c]) hi[c] = v;
        }
      }
      const shift = [positions[i][0] - (lo[0] + hi[0]) / 2, positions[i][1] - (lo[1] + hi[1]) / 2, -lo[2]];
      all[0] = Math.min(all[0], lo[0] + shift[0]); all[1] = Math.min(all[1], lo[1] + shift[1]);
      all[2] = Math.max(all[2], hi[0] + shift[0]); all[3] = Math.max(all[3], hi[1] + shift[1]);
      for (const key of ['black', 'white']) parts[key].push({ u8: bufs[key], shift });
    });
    const out = {};
    for (const key of ['black', 'white']) {
      const total = parts[key].reduce((t, p) => t + new DataView(p.u8.buffer, p.u8.byteOffset, p.u8.byteLength).getUint32(80, true), 0);
      const buf = new Uint8Array(84 + 50 * total), dv = new DataView(buf.buffer);
      enc.encodeInto(`Tenaris plate ${key === 'black' ? 'DARK' : 'LIGHT'}`, buf.subarray(0, 80));
      dv.setUint32(80, total, true);
      let o = 84;
      for (const { u8, shift } of parts[key]) {
        const sv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), n = sv.getUint32(80, true);
        for (let t = 0; t < n; t++, o += 50) {
          const q = 84 + t * 50;
          for (let c = 0; c < 3; c++) dv.setFloat32(o + c * 4, sv.getFloat32(q + c * 4, true), true); // normal
          for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++)
            dv.setFloat32(o + 12 + k * 12 + c * 4, sv.getFloat32(q + 12 + k * 12 + c * 4, true) + shift[c], true);
        }
      }
      out[key] = buf;
    }
    out.centre = [round4((all[0] + all[2]) / 2), round4((all[1] + all[3]) / 2)];
    return out;
  }

  return { make, pauseLayer, loadTemplate, zipWriter, platePlan, plateSTL, PRINTERS, FIRST_LAYER, PIECES: true };
})();
