/* Bambu Studio project (.3mf) exporter for the two-colour emergency card.
 *
 *   <script src="bambu3mf.js" defer></script>      (bambu-template.json must sit next to it)
 *
 *   const bytes = await Bambu3MF.make({ black, white, name, pauseZ, layerHeight: 0.2 });
 *   // bytes: Uint8Array of a .3mf; save it as `${name}.3mf`
 *
 * black / white  binary STL (Uint8Array or ArrayBuffer), same coordinate system: they are kept exactly
 *                where they are relative to each other and become ONE object with TWO parts
 *                (white = filament 1, black = filament 2). The object is centred on the plate.
 * name           object / project name
 * pauseZ         Z (mm) of the pocket roof. The print pauses (Bambu "Add Pause", M400 U1) before the
 *                first layer that reaches above pauseZ, i.e. after the layer whose top is pauseZ.
 * layerHeight    0.2 (default). First layer is always 0.2 mm.
 * Optional:
 * material       'ASA' (default) or 'ABS' (Bambu ASA / Bambu ABS system filament presets)
 * ironing        false (default). true = iron the topmost surface ("topmost"). Off by default: each colour is
 *                ironed by its own filament and the hot nozzle face can drag black onto neighbouring white
 *                QR modules, lowering scan contrast.
 *
 * Printer: Bambu Lab P2S 0.4 nozzle, process "0.20mm Standard @BBL P2S" with overrides
 * (100 % infill, 3 walls, Arachne, no brim, no supports, prime tower on), plate: Textured PEI.
 * Settings come from bambu-template.json (generated from Bambu Studio's own system presets).
 *
 * Bambu3MF.pauseLayer(pauseZ, layerHeight) -> { layer, topZ, afterZ } (1-based layer that the pause
 * precedes, its top Z, and the Z printed before the pause).
 */
const Bambu3MF = (() => {
  'use strict';

  const FIRST_LAYER = 0.2;
  const script = typeof document !== 'undefined' ? document.currentScript : null;
  const TEMPLATE_URL = script && script.src ? new URL('bambu-template.json', script.src).href : 'bambu-template.json';
  const enc = new TextEncoder();
  let templatePromise = null;

  function loadTemplate() {
    if (!templatePromise) {
      templatePromise = fetch(TEMPLATE_URL).then(r => {
        if (!r.ok) throw new Error(`bambu-template.json: HTTP ${r.status}`);
        return r.json();
      }).catch(e => { templatePromise = null; throw e; });
    }
    return templatePromise;
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

  async function zip(files) {
    const parts = [], central = [];
    let offset = 0;
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const put = (dv, list) => list.forEach(([o, v, n]) => (n === 4 ? dv.setUint32(o, v, true) : dv.setUint16(o, v, true)));
    for (const f of files) {
      const name = enc.encode(f.name), crc = crc32(f.data);
      let body = f.data, method = 0;
      if (f.data.length > 256) {
        const z = await deflateRaw(f.data);
        if (z && z.length < f.data.length) { body = z; method = 8; }
      }
      const head = new DataView(new ArrayBuffer(30));
      put(head, [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, method, 2], [10, time, 2], [12, date, 2], [14, crc, 4],
        [18, body.length, 4], [22, f.data.length, 4], [26, name.length, 2], [28, 0, 2]]);
      const cen = new DataView(new ArrayBuffer(46));
      put(cen, [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, method, 2], [12, time, 2], [14, date, 2],
        [16, crc, 4], [20, body.length, 4], [24, f.data.length, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2],
        [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]]);
      parts.push(new Uint8Array(head.buffer), name, body);
      central.push(new Uint8Array(cen.buffer), name);
      offset += 30 + name.length + body.length;
    }
    const cenSize = central.reduce((n, b) => n + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    put(end, [[0, 0x06054b50, 4], [8, files.length, 2], [10, files.length, 2], [12, cenSize, 4], [16, offset, 4]]);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((n, b) => n + b.length, 0));
    let at = 0;
    for (const b of all) { out.set(b, at); at += b.length; }
    return out;
  }

  // ---------- project settings ----------
  function projectSettings(tpl, { material, layerHeight, ironing }) {
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
    s.different_settings_to_system[0] = [...diff].sort().join(';');
    return s;
  }

  // ---------- main ----------
  async function make({ black, white, name = 'card', pauseZ, layerHeight = 0.2, material = 'ASA', ironing = false, template } = {}) {
    if (!black || !white) throw new Error('make(): black and white STL data are required');
    if (typeof pauseZ !== 'number' || !isFinite(pauseZ)) throw new Error('make(): pauseZ (mm) is required');
    if (!(layerHeight >= 0.04 && layerHeight <= 0.32)) throw new Error('make(): layerHeight out of range');
    const tpl = template || await loadTemplate();
    const settings = projectSettings(tpl, { material, layerHeight, ironing });

    const pw = stlMesh(white, 'white'), pb = stlMesh(black, 'black');
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const { pos: p } of [pw, pb]) for (let i = 0; i < p.length; i += 3) for (let c = 0; c < 3; c++) {
      if (p[i + c] < lo[c]) lo[c] = p[i + c];
      if (p[i + c] > hi[c]) hi[c] = p[i + c];
    }
    // Object origin: centre of the combined footprint, bottom of the card. Both parts share it, so their
    // relative position is exactly the STL position.
    const off = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]];
    const height = hi[2] - lo[2];
    const pause = pauseLayer(pauseZ, layerHeight);
    if (pause.topZ > height + 1e-3) throw new Error(`pauseZ ${pauseZ} is above the top of the card (${round4(height)} mm)`);

    const area = settings.printable_area.map(s => s.split('x').map(Number));
    const bedX = (Math.min(...area.map(a => a[0])) + Math.max(...area.map(a => a[0]))) / 2;
    const bedY = (Math.min(...area.map(a => a[1])) + Math.max(...area.map(a => a[1]))) / 2;
    const place = `1 0 0 0 1 0 0 0 1 ${num(bedX)} ${num(bedY)} 0`;

    const OBJ = 3, parts = [{ id: 1, label: 'WHITE', p: pw, filament: 1 }, { id: 2, label: 'BLACK', p: pb, filament: 2 }];
    const objectLines = [];
    for (const part of parts) {
      const m = meshObject(part.p, part.id, `${hex8((OBJ << 16) | (part.id - 1))}-81cb-4c03-9d28-80fed5dfa1dc`, off);
      if (!m.faces) throw new Error(`${part.label} STL has no triangles`);
      part.faces = m.faces;
      objectLines.push(...m.xml);
    }
    const day = new Date().toISOString().slice(0, 10);
    const title = esc(name);

    const objectModel = ['<?xml version="1.0" encoding="UTF-8"?>', `<model ${NS}>`,
      ' <metadata name="BambuStudio:3mfVersion">1</metadata>', ' <resources>', ...objectLines, ' </resources>',
      '</model>', ''].join('\n');

    const meta = [['Application', tpl.app], ['BambuStudio:3mfVersion', '1'], ['Copyright', ''], ['CreationDate', day],
      ['Description', ''], ['Designer', ''], ['DesignerCover', ''], ['DesignerUserId', ''], ['License', ''],
      ['ModificationDate', day], ['Origin', ''], ['ProfileCover', ''], ['ProfileDescription', ''], ['ProfileTitle', ''],
      ['Title', title]];
    const rootModel = ['<?xml version="1.0" encoding="UTF-8"?>', `<model ${NS}>`,
      ...meta.map(([k, v]) => ` <metadata name="${k}">${v}</metadata>`),
      ' <resources>', `  <object id="${OBJ}" p:UUID="${hex8(OBJ)}-61cb-4c03-9d28-80fed5dfa1dc" type="model">`, '   <components>',
      ...parts.map((pt, i) => `    <component p:path="/3D/Objects/object_1.model" objectid="${pt.id}" p:UUID="${hex8((OBJ << 16) | i)}-b206-40ff-9872-83e8017abed1" transform="${IDENT}"/>`),
      '   </components>', '  </object>', ' </resources>',
      ' <build p:UUID="2c7c17d8-22b5-4d84-8835-1976022ea369">',
      `  <item objectid="${OBJ}" p:UUID="${hex8(OBJ)}-b1ec-4553-aec9-835e5b724bb4" transform="${place}" printable="1"/>`,
      ' </build>', '</model>', ''].join('\n');

    const nf = settings.filament_colour.length;
    const modelSettings = ['<?xml version="1.0" encoding="UTF-8"?>', '<config>', `  <object id="${OBJ}">`,
      `    <metadata key="name" value="${title}"/>`, '    <metadata key="extruder" value="1"/>',
      `    <metadata face_count="${parts[0].faces + parts[1].faces}"/>`,
      ...parts.flatMap(pt => [
        `    <part id="${pt.id}" subtype="normal_part">`,
        `      <metadata key="name" value="${title} ${pt.label}"/>`,
        '      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>',
        `      <metadata key="extruder" value="${pt.filament}"/>`,
        `      <mesh_stat face_count="${pt.faces}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>`,
        '    </part>']),
      '  </object>', '  <plate>', '    <metadata key="plater_id" value="1"/>', '    <metadata key="plater_name" value=""/>',
      '    <metadata key="locked" value="false"/>', '    <metadata key="filament_map_mode" value="Auto For Flush"/>',
      `    <metadata key="filament_maps" value="${Array(nf).fill(1).join(' ')}"/>`,
      `    <metadata key="filament_volume_maps" value="${Array(nf).fill(0).join(' ')}"/>`,
      '    <model_instance>', `      <metadata key="object_id" value="${OBJ}"/>`, '      <metadata key="instance_id" value="0"/>',
      '      <metadata key="identify_id" value="100"/>', '    </model_instance>', '  </plate>', '  <assemble>',
      `   <assemble_item object_id="${OBJ}" instance_id="0" transform="${place}" offset="0 0 0" />`, '  </assemble>',
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
        ' <Relationship Target="/3D/Objects/object_1.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>',
        '</Relationships>', ''].join('\n')],
      ['3D/Objects/object_1.model', objectModel],
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

  return { make, pauseLayer, loadTemplate, FIRST_LAYER };
})();
