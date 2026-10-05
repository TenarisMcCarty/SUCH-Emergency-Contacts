// cardmaker.js — the 3D-printed NFC emergency card, made in the browser from the card's link:
//   • two STL files (a dark and a light filament) for a two-colour print with a sealed pocket for the NFC tag.
//     In the code "black" means the dark filament and "white" the light one (files: *-DARK.stl, *-LIGHT.stl).
//   • print notes, and the STL files and notes in one ZIP
//   • previews of the front and back
// model() also gives the pause height, so bambu3mf.js can turn the same two STL files into a Bambu Studio project.
// Needs qrcode.js, opentype.js, earcut.js, logo.js and source-sans-3-bold.ttf.
// The Tenaris signature follows the Tenaris Brandmark Basic Guidelines: official artwork only, Multibar at least
// 5.5 mm tall, clear space of 80% of the Multibar height all round, one colour (white on black) on the card.
// Units are millimetres with y pointing up. The front is laid out as seen from the front, the back as seen from the back.

const CardMaker = (() => {
  // ================= Card design =================
  // Credit-card size (ISO/IEC 7810 ID-1). Printed in ASA or ABS, black + white, 0.4 mm nozzle, 0.2 mm layers,
  // FRONT FACE DOWN on the build plate. Layers from the plate up (all multiples of the layer height):
  //   front skin  0.6  front artwork; also the cover under the tag. Black carbon-black plastic is opaque well
  //                    before 0.6 mm, the face is flat from the plate, and nothing is printed over the tag there.
  //   core        1.0  white, with the pocket: 0.8 mm tag + 0.2 mm (one layer) so the nozzle never touches it
  //   — pause: insert the tag —
  //   roof        0.2  one solid white layer over the tag (no colour changes while bridging over it)
  //   back skin   0.4  back artwork (QR code). Roof + back skin = 0.6 mm over the tag.
  // 2.2 mm in all: about three bank cards, still fits a wallet slot, and stiff in 100%-infill ASA/ABS.
  // The 0.6 mm covers above and below the pocket are equal, so shrinkage pulls evenly and the card stays flat.
  // The core is white: white plastic is translucent (it would look grey over a black core, and the QR would
  // lose contrast), while black hides a white core completely.
  const W = 85.6, H = 53.98, R = 3.18;
  const LAYER = 0.2;
  const FRONT = 0.6, CORE = 1.0, ROOF = 0.2, BACK = 0.4;
  const PAUSE_Z = FRONT + CORE;                  // the Z where the roof starts: pause after this layer
  const T = FRONT + CORE + ROOF + BACK;          // 2.2 mm
  // NTAG215 PVC coin tag, 1 in (25.4 mm) across and 0.8 mm thick, centred here on the front. 38 mm up leaves
  // 2.8 mm of solid card between the pocket and the top edge.
  const TAG = { x: 67, y: 38, d: 25.4, thick: 0.8 };
  // Pocket: 26.4 mm across and 1.0 mm deep: the tag + 1.0 mm across and + 0.2 mm (one layer) deep, the same
  // allowance tag sellers give for embedding 25 mm tags (a 26 × 1 mm slot). Printed holes come out 0.1–0.4 mm
  // small and coin tags are cut to about ±0.2 mm, so at the pause the tag still drops in by hand; after cooling
  // (ASA shrinks 0.4–0.7%, ABS about 0.8%) the pocket still doesn't squeeze it. Bambu Studio slices the pocket
  // at exactly this size (checked in its G-code).
  const POCKET = { d: 26.4, depth: CORE };
  const TAG_BACK_X = W - TAG.x;                  // the same spot seen from the back
  const MARGIN = 6.4;                            // front left margin (≥ the logo's clear space from the edge)
  const EDGE = 5;                                // other text margins
  const QR_SIZE = 40;                            // QR area including its 4-square white margin
  const QRBOX = { x: W - 1.6 - QR_SIZE, y: H - 1.6 - QR_SIZE, size: QR_SIZE }; // top right of the back
  const MIN_MODULE = 0.8;                        // smallest QR square a 0.4 mm nozzle prints reliably
  // Smallest capital height on the card. In Source Sans 3 Bold the thinnest stroke is 0.19 × the capital height
  // and the smallest counter (inside the 4) 0.147 ×, so at 3.5 mm every stroke, gap and counter of A–Z, 0–9 and
  // the usual punctuation is at least 0.5 mm. (At 3.0 mm the 4's counter would be 0.44 mm.)
  const MIN_CAP = 3.5;
  // A few characters have finer details and need bigger letters: the ring of Å (its hole is 0.13 × the capital
  // height), cedillas (Ç, Ş), the comma's tail and the #. Names may only use letters, digits and . , - ' " ( ) & # /.
  const minCapFor = ch => (/[\u030A\u0327]/.test(ch.normalize('NFD')) ? 3.9 : ch === ',' || ch === '#' ? 3.7 : MIN_CAP);
  const NAME_CHARS = /^[\p{L}\p{N} .,'"()&#\/-]$/u;
  const GAP = 0.6;                               // smallest gap between letters and between lines
  const BAND = 10;                               // height of the dark band along the bottom of the back

  // The signature at `width` mm with its bottom-left corner at (x, y), in one colour.
  const LOGO_LINE = 0.8; // clear space = 80% of the Multibar height
  // For a few minutes after a deploy the CDN can still serve the older cached logo.js: { height, contours: [[x0,y0,…]] },
  // with no colours and no Multibar size. Accept both formats: the older one has no colours (the card only needs
  // one), and the Multibar takes its official share of the signature width (0.17915).
  const logo = () => ({
    height: LOGO.height,
    multibar: LOGO.multibar ? LOGO.multibar.height : 0.17915,
    colors: LOGO.colors || { gray: '#807e82' },
    contours: LOGO.contours.map(c => (Array.isArray(c) ? { color: 'gray', points: c } : c)),
  });
  const logoItem = (x, y, width) => ({ contours: move(logo().contours.map(c => pairs(c.points)), x, y, width), kind: 'logo' });
  const logoHeight = width => logo().height * width;
  const clearSpace = width => LOGO_LINE * logo().multibar * width;

  // ================= Lettering =================
  let font = null;
  let capRatio = 0.66;

  async function load() {
    if (font) return;
    const bytes = await (await fetch('source-sans-3-bold.ttf')).arrayBuffer();
    font = opentype.parse(bytes);
    capRatio = font.charToGlyph('H').getBoundingBox().y2 / font.unitsPerEm;
    try { kernPair = gposKerning(new DataView(bytes)); } catch (e) { kernPair = () => 0; } // spacing without kerning
  }

  // The font's own kerning (GPOS 'kern' feature: pair adjustments, also inside extension lookups, which
  // opentype.js can't read). Returns (leftGlyphIndex, rightGlyphIndex) => horizontal adjustment in font units.
  // Subtables are tried in order and the first that covers the left glyph decides, as in HarfBuzz.
  let kernPair = () => 0;
  function gposKerning(dv) {
    const u16 = o => dv.getUint16(o), s16 = o => dv.getInt16(o), u32 = o => dv.getUint32(o);
    let gpos = -1;
    for (let i = 0, n = u16(4); i < n; i++) {
      const r = 12 + 16 * i;
      if (String.fromCharCode(dv.getUint8(r), dv.getUint8(r + 1), dv.getUint8(r + 2), dv.getUint8(r + 3)) === 'GPOS') gpos = u32(r + 8);
    }
    if (gpos < 0) return () => 0;
    const features = gpos + u16(gpos + 6), lookupList = gpos + u16(gpos + 8);
    const lookups = new Set();
    for (let i = 0, n = u16(features); i < n; i++) {
      const r = features + 2 + 6 * i;
      if (String.fromCharCode(dv.getUint8(r), dv.getUint8(r + 1), dv.getUint8(r + 2), dv.getUint8(r + 3)) !== 'kern') continue;
      const f = features + u16(r + 4);
      for (let k = 0, m = u16(f + 2); k < m; k++) lookups.add(u16(f + 4 + 2 * k));
    }
    const coverage = (o, g) => {
      if (u16(o) === 1) {
        for (let lo = 0, hi = u16(o + 2) - 1; lo <= hi;) {
          const mid = (lo + hi) >> 1, v = u16(o + 4 + 2 * mid);
          if (v === g) return mid; if (v < g) lo = mid + 1; else hi = mid - 1;
        }
        return -1;
      }
      for (let i = 0, n = u16(o + 2); i < n; i++) {
        const r = o + 4 + 6 * i;
        if (g >= u16(r) && g <= u16(r + 2)) return u16(r + 4) + g - u16(r);
      }
      return -1;
    };
    const classOf = (o, g) => {
      if (u16(o) === 1) { const start = u16(o + 2), n = u16(o + 4); return g >= start && g < start + n ? u16(o + 6 + 2 * (g - start)) : 0; }
      for (let i = 0, n = u16(o + 2); i < n; i++) { const r = o + 4 + 6 * i; if (g >= u16(r) && g <= u16(r + 2)) return u16(r + 4); }
      return 0;
    };
    const bits = v => { let c = 0; for (; v; v >>= 1) c += v & 1; return c; };
    const xAdvance = (o, fmt) => (fmt & 4 ? s16(o + 2 * bits(fmt & 3)) : 0);
    const pairPos = [];
    for (const li of [...lookups].sort((a, b) => a - b)) {
      const L = lookupList + u16(lookupList + 2 + 2 * li), type = u16(L);
      for (let i = 0, n = u16(L + 4); i < n; i++) {
        let st = L + u16(L + 6 + 2 * i);
        if (type === 9) { if (u16(st + 2) !== 2) continue; st += u32(st + 4); } else if (type !== 2) continue;
        pairPos.push(st);
      }
    }
    return (a, b) => {
      for (const st of pairPos) {
        const ci = coverage(st + u16(st + 2), a);
        if (ci < 0) continue;
        const f1 = u16(st + 4), f2 = u16(st + 6), size = 2 * (bits(f1) + bits(f2));
        if (u16(st) === 1) {
          const set = st + u16(st + 10 + 2 * ci);
          for (let lo = 0, hi = u16(set) - 1; lo <= hi;) {
            const mid = (lo + hi) >> 1, r = set + 2 + mid * (2 + size), g = u16(r);
            if (g === b) return xAdvance(r + 2, f1); if (g < b) lo = mid + 1; else hi = mid - 1;
          }
          continue; // pair not listed: the next subtable may have it
        }
        const c1 = classOf(st + u16(st + 8), a), c2 = classOf(st + u16(st + 10), b), n2 = u16(st + 14);
        return xAdvance(st + 16 + (c1 * n2 + c2) * size, f1);
      }
      return 0;
    };
  }

  // A pasted name can carry accents as separate marks (e + ◌́), which would draw on top of the letter. Curly quotes
  // taper to 0.4 mm, so they print as straight ones.
  const cleanName = s => s.normalize('NFC').toUpperCase().normalize('NFC').replace(/\p{M}/gu, '')
    .replace(/[‘’ʼ`´]/g, "'").replace(/[“”„]/g, '"').replace(/\s+/g, ' ').trim();

  // One line of text at a capital height: glyph outlines relative to the pen (baseline at y = 0) and the
  // line's width. Spaced as the font intends (its kerning), plus `track` (em) between letters, and never closer
  // than GAP mm (some pairs, like AA or KA, touch in the font itself, and kerning can bring others too close).
  // Cached, because fitting the layout asks for the same lines many times.
  const shaped = new Map();
  function shape(str, cap, track = 0) {
    const key = `${str}|${cap}|${track}`;
    if (shaped.has(key)) return shaped.get(key);
    const em = cap / capRatio, glyphs = [];
    let pen = 0, prev = null, width = 0, last = null;
    for (const g of font.stringToGlyphs(str)) {
      if (last) pen += (kernPair(last.index, g.index) / font.unitsPerEm) * em;
      last = g;
      const contours = raiseMarks(unionContours(flatten(g.getPath(0, 0, em).commands, 0, 0.15)), cap);
      const glyph = { contours, x: pen, box: bounds(contours) };
      if (contours.length && prev) {
        for (let i = 0; i < 8; i++) { // nudge right until the gap is wide enough (the gap grows at most as fast)
          const d = minDistance(prev, glyph);
          if (d >= GAP) break;
          glyph.x += GAP - d + 0.01;
        }
      }
      if (contours.length) prev = glyph;
      glyphs.push(glyph);
      width = glyph.x + (g.advanceWidth / font.unitsPerEm) * em;
      pen = width + track * em;
    }
    const inked = glyphs.filter(g => g.contours.length);
    const ink = inked.length ? [Math.min(...inked.map(g => g.x + g.box[0])), Math.max(...inked.map(g => g.x + g.box[2]))] : [0, width];
    const out = { glyphs, width, ink };
    shaped.set(key, out);
    return out;
  }
  const textWidth = (str, cap, track = 0) => shape(str, cap, track).width;

  // Accents on capitals (É, Ñ, Ü…) sit only 0.2–0.4 mm above the letter at these sizes, too close to print
  // apart. Lift the marks that are wholly above the capital height until they clear the letter by GAP.
  function raiseMarks(cs, cap) {
    const marks = cs.filter(c => c.every(([, y]) => y > cap * 0.98)), base = cs.filter(c => !marks.includes(c));
    if (!marks.length || !base.length) return cs;
    const M = { contours: marks, box: bounds(marks), y: 0 }, Bs = { contours: base, box: bounds(base) };
    for (let i = 0; i < 8; i++) {
      const d = minDistance(Bs, M);
      if (d >= GAP) break;
      M.y += GAP - d + 0.01;
    }
    return [...base, ...move(marks, 0, M.y)];
  }

  // Outlines of a line of text. x is where the ink starts (or its centre, with align 'center'), so lines and the
  // logo share one visible left edge whatever letter they start with; y is the baseline.
  function text(str, cap, x, y, { align = 'left', track = 0 } = {}) {
    const s = shape(str, cap, track);
    const x0 = align === 'center' ? x - (s.ink[0] + s.ink[1]) / 2 : x - s.ink[0];
    return s.glyphs.flatMap(g => move(g.contours, x0 + g.x, y));
  }

  // Largest capital height (up to `max`) at which every line fits its width.
  function fit(lines, max, widths, track = 0) {
    let cap = max;
    for (let i = 0; i < 6; i++) { // letter gaps don't scale with the size, so settle it
      const over = Math.max(...lines.map((s, k) => textWidth(s, cap, track) / widths[k]));
      if (over <= 1) break;
      cap = Math.floor((cap / over) * 1000) / 1000;
    }
    return cap;
  }

  // Font curves → straight segments about `step` mm long. Font paths have y pointing down from the baseline.
  function flatten(commands, baseline, step) {
    const out = [];
    let cur = null, x0 = 0, y0 = 0;
    const P = (x, y) => [x, baseline - y];
    const close = () => { if (cur && cur.length > 2) { const c = clean(cur); if (c.length > 2) out.push(c); } cur = null; };
    for (const c of commands) {
      if (c.type === 'M') { close(); cur = [P(c.x, c.y)]; }
      else if (c.type === 'L') cur.push(P(c.x, c.y));
      else if (c.type === 'Q' || c.type === 'C') {
        const pts = c.type === 'Q' ? [[x0, y0], [c.x1, c.y1], [c.x, c.y]] : [[x0, y0], [c.x1, c.y1], [c.x2, c.y2], [c.x, c.y]];
        let len = 0;
        for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        const n = Math.max(2, Math.min(64, Math.ceil(len / step)));
        for (let i = 1; i <= n; i++) cur.push(P(...bezier(pts, i / n)));
      } else if (c.type === 'Z') close();
      if (c.x !== undefined) { x0 = c.x; y0 = c.y; }
    }
    close();
    return out;
  }

  function bezier(pts, t) {
    let p = pts;
    while (p.length > 1) p = p.slice(1).map((q, i) => [p[i][0] + (q[0] - p[i][0]) * t, p[i][1] + (q[1] - p[i][1]) * t]);
    return p[0];
  }

  // Some accented capitals are built from overlapping pieces (the cedilla of Ç and Ş overlaps the letter).
  // Merge them into one outline (non-zero fill, as fonts use), so the black and white parts get clean edges.
  // Glyphs whose outlines don't cross are returned unchanged.
  function unionContours(cs) {
    if (cs.length < 2) return cs;
    const edges = [];
    for (const c of cs) for (let i = 0; i < c.length; i++) edges.push({ a: c[i], b: c[(i + 1) % c.length], cuts: [] });
    let crossings = 0;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      for (let j = i + 1; j < edges.length; j++) {
        const f = edges[j];
        if (Math.max(e.a[0], e.b[0]) < Math.min(f.a[0], f.b[0]) || Math.max(f.a[0], f.b[0]) < Math.min(e.a[0], e.b[0]) ||
            Math.max(e.a[1], e.b[1]) < Math.min(f.a[1], f.b[1]) || Math.max(f.a[1], f.b[1]) < Math.min(e.a[1], e.b[1])) continue;
        const rx = e.b[0] - e.a[0], ry = e.b[1] - e.a[1], sx = f.b[0] - f.a[0], sy = f.b[1] - f.a[1];
        const den = rx * sy - ry * sx;
        if (Math.abs(den) < 1e-15) continue;
        const qx = f.a[0] - e.a[0], qy = f.a[1] - e.a[1];
        const t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
        if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) continue;
        const p = [e.a[0] + t * rx, e.a[1] + t * ry];
        e.cuts.push([t, p]); f.cuts.push([u, p]); crossings++;
      }
    }
    if (!crossings) return cs;
    const winding = ([x, y]) => {
      let w = 0;
      for (const c of cs) for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
        const [xa, ya] = c[j], [xb, yb] = c[i], s = (xb - xa) * (y - ya) - (x - xa) * (yb - ya);
        if (ya <= y) { if (yb > y && s > 0) w++; } else if (yb <= y && s < 0) w--;
      }
      return w;
    };
    const kept = [];
    for (const e of edges) {
      const pts = [e.a, ...e.cuts.sort((p, q) => p[0] - q[0]).map(c => c[1]), e.b];
      for (let k = 0; k + 1 < pts.length; k++) {
        const a = pts[k], b = pts[k + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 1e-12) continue;
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n = [(-(b[1] - a[1]) / len) * 1e-5, ((b[0] - a[0]) / len) * 1e-5];
        const left = winding([m[0] + n[0], m[1] + n[1]]) !== 0, right = winding([m[0] - n[0], m[1] - n[1]]) !== 0;
        if (left && !right) kept.push([a, b]); else if (right && !left) kept.push([b, a]);
      }
    }
    const key = p => p[0] + ',' + p[1];
    const from = new Map();
    for (const s of kept) { const k = key(s[0]); if (!from.has(k)) from.set(k, []); from.get(k).push(s); }
    const used = new Set(), out = [];
    for (const s of kept) {
      if (used.has(s)) continue;
      const loop = [];
      for (let cur = s; cur && !used.has(cur);) {
        used.add(cur);
        loop.push(cur[0]);
        cur = (from.get(key(cur[1])) || []).find(n => !used.has(n));
      }
      if (loop.length > 2) { const c = clean(loop); if (c.length > 2) out.push(c); }
    }
    return out;
  }

  // ================= 2D shapes =================
  function area(c) {
    let a = 0;
    for (let i = 0, j = c.length - 1; i < c.length; j = i++) a += c[j][0] * c[i][1] - c[i][0] * c[j][1];
    return a / 2;
  }

  function inside([x, y], c) {
    let r = false;
    for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
      const [xi, yi] = c[i], [xj, yj] = c[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
    }
    return r;
  }

  // Drop repeated and exactly-in-line points, so caps and walls of a solid share the same edges.
  function clean(c) {
    let pts = c.filter((p, i) => { const q = c[(i + 1) % c.length]; return Math.abs(p[0] - q[0]) > 1e-9 || Math.abs(p[1] - q[1]) > 1e-9; });
    let changed = true;
    while (changed && pts.length > 3) {
      changed = false;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[(i + pts.length - 1) % pts.length], b = pts[i], d = pts[(i + 1) % pts.length];
        if (Math.abs((b[0] - a[0]) * (d[1] - a[1]) - (d[0] - a[0]) * (b[1] - a[1])) < 1e-12) { pts.splice(i, 1); changed = true; break; }
      }
    }
    return pts;
  }

  function bounds(cs) {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const c of cs) for (const [x, y] of c) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    return b;
  }

  // Distance from point p to segment ab.
  function segDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }

  // Smallest distance between two sets of outlines ({ contours, x, box }: outlines relative to x), or Infinity
  // if they are further apart than `reach`. Only the parts facing each other are compared.
  function minDistance(A, B, reach = 2) {
    const ax = A.x || 0, bx = B.x || 0, ay = A.y || 0, by = B.y || 0;
    const ab = [A.box[0] + ax, A.box[1] + ay, A.box[2] + ax, A.box[3] + ay], bb = [B.box[0] + bx, B.box[1] + by, B.box[2] + bx, B.box[3] + by];
    const lo = [Math.max(ab[0], bb[0]) - reach, Math.max(ab[1], bb[1]) - reach], hi = [Math.min(ab[2], bb[2]) + reach, Math.min(ab[3], bb[3]) + reach];
    if (lo[0] > hi[0] || lo[1] > hi[1]) return Infinity;
    const near = ([x, y]) => x >= lo[0] && x <= hi[0] && y >= lo[1] && y <= hi[1];
    const pts = (S, dx, dy) => S.contours.flatMap(c => c.map(([x, y]) => [x + dx, y + dy])).filter(near);
    const segs = (S, dx, dy) => S.contours.flatMap(c => c.map((p, i) => [[p[0] + dx, p[1] + dy], [c[(i + 1) % c.length][0] + dx, c[(i + 1) % c.length][1] + dy]]))
      .filter(([a, b]) => near(a) || near(b));
    let best = Infinity;
    const sA = segs(A, ax, ay), sB = segs(B, bx, by);
    for (const p of pts(A, ax, ay)) for (const [a, b] of sB) best = Math.min(best, segDist(p, a, b));
    for (const p of pts(B, bx, by)) for (const [a, b] of sA) best = Math.min(best, segDist(p, a, b));
    // Outlines that cross have no gap at all.
    if (best > 0 && best < reach) for (const [a, b] of sA) if (sB.some(([c, d]) => crosses(a, b, c, d))) return 0;
    return best;
  }
  function crosses(a, b, c, d) {
    const s = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
    return s(c, d, a) * s(c, d, b) < 0 && s(a, b, c) * s(a, b, d) < 0;
  }

  const orient = (c, ccw) => ((area(c) > 0) === ccw ? c : c.slice().reverse());
  const move = (cs, dx, dy, s = 1) => cs.map(c => c.map(([x, y]) => [dx + x * s, dy + y * s]));
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const circle = (cx, cy, r, n = 96) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);

  // A ring segment (for the contactless waves), angles in degrees.
  function arcBand(cx, cy, r0, r1, a0, a1, n = 24) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; pts.push([cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)]); }
    for (let i = n; i >= 0; i--) { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; pts.push([cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)]); }
    return pts;
  }

  // The card's outline with rounded corners.
  function outline() {
    const pts = [];
    const corner = (cx, cy, a0) => { for (let i = 0; i <= 12; i++) { const a = ((a0 + (90 * i) / 12) * Math.PI) / 180; pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); } };
    corner(W - R, R, 270); corner(W - R, H - R, 0); corner(R, H - R, 90); corner(R, R, 180);
    return clean(pts);
  }

  // The card outline cut by the line y = cut (above R, so it crosses the straight sides): [above, below].
  function splitOutline(cut) {
    const pts = outline(), up = [], down = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      (a[1] >= cut ? up : down).push(a);
      if ((a[1] - cut) * (b[1] - cut) < 0) {
        const p = [a[0] + ((cut - a[1]) * (b[0] - a[0])) / (b[1] - a[1]), cut];
        up.push(p); down.push(p);
      }
    }
    return [clean(up), clean(down)];
  }

  // ================= QR =================
  function qrMatrix(link) {
    const qr = qrcode(0, 'M'); // M: the code still reads with ~15% damage
    qr.addData(link);
    qr.make();
    const n = qr.getModuleCount();
    return { n, dark: (r, c) => r >= 0 && c >= 0 && r < n && c < n && qr.isDark(r, c) };
  }

  // The QR area as rows of same-colour rectangles: [{ contour, color }]. Includes the 4-square white margin.
  function qrRuns(m, box) {
    const N = m.n + 8, p = box.size / N, runs = [];
    for (let r = 0; r < N; r++) {
      let start = 0;
      for (let c = 1; c <= N; c++) {
        if (c === N || m.dark(r - 4, c - 4) !== m.dark(r - 4, start - 4)) {
          runs.push({ contour: rect(box.x + start * p, box.y + box.size - (r + 1) * p, (c - start) * p, p), color: m.dark(r - 4, start - 4) ? 'black' : 'white' });
          start = c;
        }
      }
    }
    return runs;
  }

  // ================= Layout =================
  // Splits a long name into the two most even lines (never inside the "(ID)").
  function splitName(name) {
    const open = name.indexOf('(');
    const spaces = [...name.matchAll(/ /g)].map(m => m.index).filter(i => open < 0 || i < open || i > name.indexOf(')', open));
    if (!spaces.length) return [name];
    const widest = i => Math.max(textWidth(name.slice(0, i), 5), textWidth(name.slice(i + 1), 5));
    const best = spaces.reduce((a, b) => (widest(b) < widest(a) ? b : a));
    return [name.slice(0, best), name.slice(best + 1)];
  }

  // Right-most x that front text between heights y0 and y1 may reach without coming near the tag pocket.
  function pocketLimit(y0, y1, gap = 1.2) {
    const r = POCKET.d / 2 + gap;
    const dy = TAG.y >= y0 && TAG.y <= y1 ? 0 : Math.min(Math.abs(TAG.y - y0), Math.abs(TAG.y - y1));
    if (dy >= r) return W - EDGE;
    return TAG.x - Math.sqrt(r * r - dy * dy);
  }

  function textItem(str, cap, x, y, kind, opts = {}) {
    const contours = text(str, cap, x, y, opts);
    return { contours, kind, text: str, cap, baseline: y, box: bounds(contours) };
  }

  // Everything drawn on the card. Each face: zones (areas of one base colour) holding items (outlines in the
  // other colour). Returns the faces, any problems that stop the card being printed, and sizes for the notes.
  function layout({ link, driver, backup }) {
    const m = qrMatrix(link);
    if (QRBOX.size / (m.n + 8) < MIN_MODULE) throw new Error('This card link is too long to print as a QR code on the card.');
    const problems = [];

    // ---- Front: logo, EMERGENCY / CONTACT, the driver's name ----
    const front = [];
    // Signature 40 mm wide: Multibar 7.2 mm (minimum 5.5), clear space 5.7 mm to the top edge and to the text below.
    const LOGO_W = 40, cs = clearSpace(LOGO_W);
    const logoBox = { x: MARGIN, y: H - cs - logoHeight(LOGO_W) - 0.05, w: LOGO_W, h: logoHeight(LOGO_W) };
    front.push(logoItem(logoBox.x, logoBox.y, LOGO_W));
    const textTop = logoBox.y - cs - 0.05; // nothing above this: the logo's clear space

    // The name along the bottom, full width (the tag pocket is higher up). A long name wraps onto two lines.
    const name = cleanName(driver);
    const missing = [...new Set([...name].filter(ch => !NAME_CHARS.test(ch) || font.charToGlyphIndex(ch) === 0))];
    if (missing.length) problems.push(`The driver name has characters the card can't print (${missing.join(' ')}). Rename the card (Cards → Rename).`);
    const nameMin = Math.max(MIN_CAP, ...[...name].map(minCapFor));
    const nameW = W - EDGE - MARGIN;
    const max2 = Math.max(3.8, nameMin); // two lines: a little smaller, so EMERGENCY CONTACT stays the big text
    // Capitals read best a little spaced out (0.04 em); a name that only fits tighter gets 0.02 em.
    let lines, cap, nameTrack;
    for (nameTrack of [0.04, 0.02]) {
      lines = [name];
      cap = fit(lines, 4.0, [nameW], nameTrack);
      if (cap < max2) {
        const split = splitName(name);
        const cap2 = split.length > 1 ? fit(split, max2, [nameW, nameW], nameTrack) : 0;
        if (cap2 > cap + 0.1 || (cap < nameMin && cap2 > cap)) { lines = split; cap = cap2; }
      }
      if (cap >= nameMin) break;
    }
    if (cap < nameMin) problems.push('The driver name is too long to print. Shorten it (Cards → Rename).');
    cap = Math.max(cap, nameMin);
    // Two lines: far enough apart that accents on the lower line clear brackets or a cedilla on the upper one.
    const ink = lines.map(l => bounds(text(l, cap, 0, 0, { track: nameTrack })));
    const lineStep = lines.length > 1 ? Math.max(cap * 1.5, ink[1][3] - ink[0][1] + GAP + 0.2) : 0;
    const NAME_BASE = Math.round(cs * 100) / 100; // bottom margin = the logo's top margin
    lines.forEach((l, i) => front.push(textItem(l, cap, MARGIN, NAME_BASE + (lines.length - 1 - i) * lineStep, 'name', { track: nameTrack })));
    const nameTop = NAME_BASE + (lines.length - 1) * lineStep + Math.max(cap, ink[0][3] - 0.6);

    // EMERGENCY / CONTACT: the big text, as big as fits between the name, the logo's clear space and the pocket.
    // A clear step above the name (0.75 of its capital height), lines 1.32 capital heights apart.
    const head = ['EMERGENCY', 'CONTACT'], headTrack = 0.03;
    let headCap = MIN_CAP, b1 = 0, b2 = 0;
    for (let c = 7.5; c >= MIN_CAP; c = Math.round((c - 0.05) * 100) / 100) {
      const y2 = nameTop + 0.75 * c, y1 = y2 + 1.32 * c;
      if (y1 + c > textTop) continue;
      if ([y1, y2].every((y, i) => MARGIN + textWidth(head[i], c, headTrack) <= pocketLimit(y, y + c))) { headCap = c; b1 = y1; b2 = y2; break; }
    }
    if (!b1) problems.push("The front text doesn't fit on the card.");
    front.push(textItem(head[0], headCap, MARGIN, b1, 'headline', { track: headTrack }));
    front.push(textItem(head[1], headCap, MARGIN, b2, 'headline', { track: headTrack }));

    // ---- Back (as seen from the back) ----
    // A left column level with the QR code's dark squares: SCAN OR TAP at the top, the tap symbol under it (over the
    // hidden tag), BACKUP and the number at the bottom. Along the bottom edge, a dark band with the 911 line.
    const back = [], band = [];
    const qrPitch = QRBOX.size / (m.n + 8), qrTop = QRBOX.y + QRBOX.size - 4 * qrPitch, qrBottom = QRBOX.y + 4 * qrPitch;
    const colW = QRBOX.x - 1.2 - EDGE;
    const scanCap = fit(['SCAN OR TAP'], 3.8, [colW], 0.06);
    back.push(textItem('SCAN OR TAP', scanCap, EDGE, qrTop - scanCap, 'scan', { track: 0.06 }));
    // The contactless symbol (a dot and three waves), lined up with the column's left edge, over the tag.
    const wx = EDGE + 0.9, wy = TAG.y;
    back.push({ contours: [circle(wx, wy, 0.9, 32)], kind: 'tap' });
    for (const [r0, r1] of [[2.1, 2.9], [3.7, 4.5], [5.3, 6.1]]) back.push({ contours: [arcBand(wx, wy, r0, r1, -45, 45)], kind: 'tap' });
    if (backup) {
      const numCap = fit([backup], 4.0, [colW], 0.03);
      if (numCap < MIN_CAP) problems.push('The backup number is too long to print.');
      back.push(textItem(backup, Math.max(numCap, MIN_CAP), EDGE, qrBottom, 'backup', { track: 0.03 }));
      back.push(textItem('BACKUP', MIN_CAP, EDGE, qrBottom + Math.max(numCap, MIN_CAP) + 1.6, 'backup', { track: 0.12 }));
    }
    const sos = 'LIFE-THREATENING? CALL 911';
    const sosCap = fit([sos], 3.6, [W - 8], 0.02);
    if (sosCap < MIN_CAP) problems.push("The 911 line doesn't fit on the card.");
    band.push(textItem(sos, Math.max(sosCap, MIN_CAP), W / 2, (BAND - Math.max(sosCap, MIN_CAP)) / 2, '911', { align: 'center', track: 0.02 }));

    const [above, below] = splitOutline(BAND);
    const L = {
      front: { zones: [{ contour: outline(), color: 'black', items: front }] },
      back: {
        zones: [{ contour: above, color: 'white', items: back, windows: [rect(QRBOX.x, QRBOX.y, QRBOX.size, QRBOX.size)] },
          { contour: below, color: 'black', items: band }],
        qr: { m, box: QRBOX },
      },
      problems, qrModules: m.n, modulePitch: QRBOX.size / (m.n + 8), qrBox: QRBOX,
      logo: { ...logoBox, multibar: logo().multibar * LOGO_W, clear: cs },
      band: BAND,
      text: [...front, ...back, ...band].filter(i => i.text).map(i => ({ text: i.text, cap: i.cap, kind: i.kind, baseline: i.baseline, box: i.box, face: front.includes(i) ? 'front' : 'back' })),
      minCap: Math.min(...[...front, ...back, ...band].filter(i => i.text).map(i => i.cap)),
    };
    if (!problems.length) checkClearances(L, problems); // (a name that's too long would only repeat itself here)
    return L;
  }

  const pairs = flat => { const c = []; for (let i = 0; i < flat.length; i += 2) c.push([flat[i], flat[i + 1]]); return c; };

  // Refuses a design that wouldn't print cleanly: text over the tag pocket, in the logo's clear space, too near
  // the edge, in the QR code's area, or closer than GAP to other art.
  function checkClearances(L, problems) {
    const say = msg => { if (!problems.includes(msg)) problems.push(msg); };
    const front = L.front.zones[0].items, back = L.back.zones[0].items, band = L.back.zones[1].items, lg = L.logo;
    const inCard = ([x, y]) => x >= 2 && x <= W - 2 && y >= 2 && y <= H - 2;
    for (const item of [...front, ...back, ...band]) if (!item.contours.every(c => c.every(inCard))) say(`The ${item.kind} text doesn't fit on the card.`);
    // Nothing within 1 mm of the band's edge, on either side.
    for (const item of back) if (item.contours.some(c => c.some(([, y]) => y < L.band + 1))) say(`The ${item.kind} text runs into the bottom band.`);
    for (const item of band) if (item.contours.some(c => c.some(([, y]) => y > L.band - 1))) say(`The ${item.kind} text doesn't fit in the bottom band.`);
    for (const item of front) {
      if (item.kind === 'logo') continue;
      if (item.contours.some(c => c.some(([x, y]) => Math.hypot(x - TAG.x, y - TAG.y) < POCKET.d / 2 + 0.8))) say(`The ${item.kind} text would sit over the NFC tag.`);
      if (item.contours.some(c => c.some(([x, y]) => x > lg.x - lg.clear && x < lg.x + lg.w + lg.clear && y > lg.y - lg.clear && y < lg.y + lg.h + lg.clear))) say(`The ${item.kind} text is too close to the logo.`);
    }
    const q = L.qrBox;
    for (const item of back)
      if (item.contours.some(c => c.some(([x, y]) => x > q.x - 0.5 && y > q.y - 0.5))) say(`The ${item.kind} text runs into the QR code's margin.`);
    for (const items of [front, back, band]) {
      const art = items.map(i => ({ contours: i.contours, box: i.box || bounds(i.contours), kind: i.kind }));
      for (let i = 0; i < art.length; i++) for (let j = i + 1; j < art.length; j++)
        if ((art[i].kind !== 'tap' || art[j].kind !== 'tap') && minDistance(art[i], art[j], 1) < GAP) say(`The ${art[i].kind} and ${art[j].kind} text are too close together.`);
    }
  }

  // ================= Filling shapes =================
  // A zone's outline is filled with the zone colour; each outline inside alternates colour
  // (letter → hole in the letter → …). Outlines must not cross each other.
  function fillZone(zone) {
    const base = zone.color, other = base === 'black' ? 'white' : 'black';
    const windows = zone.windows || [];
    const all = [zone.contour, ...windows, ...zone.items.flatMap(i => i.contours)];
    const info = all.map(c => ({ a: Math.abs(area(c)), parent: -1, kids: [] }));
    for (let i = 1; i < all.length; i++) {
      let best = -1;
      for (let j = 0; j < all.length; j++) {
        if (j !== i && info[j].a > info[i].a && inside(all[i][0], all[j]) && (best < 0 || info[j].a < info[best].a)) best = j;
      }
      if (best < 0) throw new Error('A design element is outside the card.');
      info[i].parent = best;
      info[best].kids.push(i);
    }
    const depth = i => (info[i].parent < 0 ? 0 : 1 + depth(info[i].parent));
    const regions = [];
    for (let i = 0; i < all.length; i++) {
      if (i >= 1 && i <= windows.length) continue; // windows are filled separately (the QR)
      regions.push({ outer: all[i], holes: info[i].kids.map(k => all[k]), color: depth(i) % 2 ? other : base });
    }
    return regions;
  }

  // ================= 3D model =================
  // Moves a point by a few hundred-thousandths of a millimetre, always the same way for the same point.
  // Letters sharing a baseline otherwise put several points exactly in line, and the triangulation then
  // leaves T-shaped joins (tiny open seams). Neighbouring black and white shapes move identically.
  function nudge([x, y]) {
    const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, k = Math.sin(x * 39.3468 + y * 11.135) * 24634.6345;
    return [x + (h - Math.floor(h) - 0.5) * 4e-5, y + (k - Math.floor(k) - 0.5) * 4e-5];
  }

  function prism(region, z0, z1, tris) {
    const outer = orient(region.outer, true).map(nudge);
    const rings = [outer, ...region.holes.map(h => orient(h, false).map(nudge))];
    const flat = [], holes = [];
    rings.forEach((r, k) => { if (k) holes.push(flat.length / 2); for (const [x, y] of r) flat.push(x, y); });
    const idx = earcut.default(flat, holes);
    const pt = i => [flat[2 * i], flat[2 * i + 1]];
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    // earcut winds every triangle the same way; turn them all to face up. Zero-area triangles
    // (letters sharing a baseline) are kept, so every edge still meets its neighbour (watertight).
    let flip = false;
    for (let t = 0; t < idx.length; t += 3) {
      const cr = cross(pt(idx[t]), pt(idx[t + 1]), pt(idx[t + 2]));
      if (cr !== 0) { flip = cr < 0; break; }
    }
    for (let t = 0; t < idx.length; t += 3) {
      const a = pt(idx[t]), b = pt(idx[flip ? t + 2 : t + 1]), c = pt(idx[flip ? t + 1 : t + 2]);
      tris.push([[a[0], a[1], z1], [b[0], b[1], z1], [c[0], c[1], z1]]); // top, facing up
      tris.push([[a[0], a[1], z0], [c[0], c[1], z0], [b[0], b[1], z0]]); // bottom, facing down
    }
    for (const r of rings) {
      for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length];
        tris.push([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1]], [[a[0], a[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]]);
      }
    }
  }

  // The front is printed face down, so it is mirrored left to right: turned over, it reads the right way round.
  const mirrorX = c => c.map(([x, y]) => [W - x, y]).reverse();

  function faceRegions(face, mirrored) {
    const flip = mirrored ? mirrorX : c => c;
    const regions = [];
    for (const zone of face.zones) {
      const z = { color: zone.color, contour: flip(zone.contour), windows: (zone.windows || []).map(flip), items: zone.items.map(i => ({ contours: i.contours.map(flip) })) };
      for (const r of fillZone(z)) regions.push(r);
    }
    if (face.qr) for (const run of qrRuns(face.qr.m, face.qr.box)) regions.push({ outer: flip(run.contour), holes: [], color: run.color });
    return regions;
  }

  // Two STL files in one coordinate system: everything printed in black, and everything printed in white.
  function model(card) {
    const L = layout(card);
    if (L.problems.length) throw new Error(L.problems.join(' '));
    const tris = { black: [], white: [] };
    // The pocket polygon is drawn round the circle, so it is at least POCKET.d across everywhere.
    const n = 120, pocket = circle(TAG_BACK_X, TAG.y, POCKET.d / 2 / Math.cos(Math.PI / n), n);
    for (const r of faceRegions(L.front, true)) prism(r, 0, FRONT, tris[r.color]);                 // front, face down
    prism({ outer: outline(), holes: [pocket] }, FRONT, PAUSE_Z, tris.white);                       // core with the pocket
    prism({ outer: outline(), holes: [] }, PAUSE_Z, PAUSE_Z + ROOF, tris.white);                    // roof, after the pause
    for (const r of faceRegions(L.back, false)) prism(r, PAUSE_Z + ROOF, T, tris[r.color]);         // back, on top
    return {
      black: stl(tris.black, 'Tenaris card DARK'), white: stl(tris.white, 'Tenaris card LIGHT'),
      thickness: T, pauseZ: PAUSE_Z, pauseLayer: Math.round(PAUSE_Z / LAYER) + 1, layerHeight: LAYER,
      layers: { front: [0, FRONT], core: [FRONT, PAUSE_Z], roof: [PAUSE_Z, PAUSE_Z + ROOF], back: [PAUSE_Z + ROOF, T] },
      pocket: { x: TAG_BACK_X, y: TAG.y, d: POCKET.d, depth: POCKET.depth, z0: FRONT, z1: PAUSE_Z },
      layout: L,
    };
  }

  function stl(tris, title) {
    const buf = new ArrayBuffer(84 + 50 * tris.length);
    const dv = new DataView(buf);
    for (let i = 0; i < Math.min(80, title.length); i++) dv.setUint8(i, title.charCodeAt(i));
    dv.setUint32(80, tris.length, true);
    let o = 84;
    for (const [a, b, c] of tris) {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const len = Math.hypot(...n) || 1;
      for (const x of [...n.map(x => x / len), ...a, ...b, ...c]) { dv.setFloat32(o, x, true); o += 4; }
      o += 2;
    }
    return new Uint8Array(buf);
  }

  // ================= Previews =================
  // QR squares snapped to whole pixels, row by row, so no hairline seams appear between them.
  // box is in millimetres (y up); s = pixels per millimetre.
  function drawQR(ctx, m, box, s) {
    const N = m.n + 8, p = box.size / N, Hpx = ctx.canvas.height;
    const X = mm => Math.round(mm * s), Y = mm => Hpx - Math.round(mm * s);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    for (let r = 0; r < m.n; r++) {
      const top = Y(box.y + box.size - (r + 4) * p), bottom = Y(box.y + box.size - (r + 5) * p);
      for (let c = 0; c < m.n; c++) {
        if (!m.dark(r, c)) continue;
        let e = c;
        while (e + 1 < m.n && m.dark(r, e + 1)) e++;
        const x0 = X(box.x + (c + 4) * p), x1 = X(box.x + (e + 5) * p);
        ctx.fillRect(x0, top, x1 - x0, bottom - top);
        c = e;
      }
    }
    ctx.restore();
  }

  // Draws a face onto a transparent canvas at `pxPerMm`, in the print's colours.
  function drawFace(face, pxPerMm) {
    const palette = { black: '#141414', white: '#f4f4f2' };
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * pxPerMm);
    canvas.height = Math.round(H * pxPerMm);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(pxPerMm, 0, 0, -pxPerMm, 0, canvas.height); // millimetres, y up
    const fill = (contours, color) => {
      ctx.beginPath();
      for (const c of contours) { ctx.moveTo(...c[0]); for (const p of c.slice(1)) ctx.lineTo(...p); ctx.closePath(); }
      ctx.fillStyle = color;
      ctx.fill('evenodd');
    };
    for (const zone of face.zones) {
      fill([zone.contour], palette[zone.color]);
      for (const item of zone.items) fill(item.contours, palette[zone.color === 'black' ? 'white' : 'black']);
    }
    if (face.qr) drawQR(ctx, face.qr.m, face.qr.box, pxPerMm);
    return canvas;
  }

  // How the finished card looks: the front as seen when the card is turned over, the back as it comes off the plate.
  function preview(card, side, pxPerMm = 8) {
    return drawFace(layout(card)[side], pxPerMm);
  }

  // ================= ZIP =================
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

  // Stored (uncompressed) ZIP: files = [{ name, data: Uint8Array }].
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0;
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const f of files) {
      const name = enc.encode(f.name), crc = crc32(f.data);
      const head = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, crc, 4], [18, f.data.length, 4], [22, f.data.length, 4], [26, name.length, 2], [28, 0, 2]]
        .forEach(([o, v, n]) => (n === 4 ? head.setUint32(o, v, true) : head.setUint16(o, v, true)));
      const cen = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, crc, 4], [20, f.data.length, 4], [24, f.data.length, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]]
        .forEach(([o, v, n]) => (n === 4 ? cen.setUint32(o, v, true) : cen.setUint16(o, v, true)));
      parts.push(new Uint8Array(head.buffer), name, f.data);
      central.push(new Uint8Array(cen.buffer), name);
      offset += 30 + name.length + f.data.length;
    }
    const cenSize = central.reduce((n, b) => n + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [8, files.length, 2], [10, files.length, 2], [12, cenSize, 4], [16, offset, 4]]
      .forEach(([o, v, n]) => (n === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true)));
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  // ================= Print notes =================
  // opts.printer: { id, label, nozzles } of the Bambu printer the .3mf next to these notes was made for (bambu3mf.js
  // PRINTERS); without it the notes are for the STL files, any Bambu printer.
  const SPLIT_NOZZLES = ['H2D', 'H2DP', 'X2D']; // two fixed nozzles: LIGHT left, DARK right (bambu3mf.js)
  function printNotes(card, m, opts = {}) {
    const z = v => v.toFixed(1);
    const roofLayer = m.pauseLayer, lastLayer = Math.round(m.thickness / LAYER);
    const pr = opts.printer;
    const printerLines = pr
      ? [`PRINTER  Bambu Lab ${pr.label}, 0.4 mm nozzle, AMS. The .3mf is made for this printer only (its name is in`,
        '  the file name); for another Bambu printer, download it again in the dashboard with that printer chosen.',
        ...(SPLIT_NOZZLES.includes(pr.id)
          ? ['  Two nozzles: the LIGHT filament prints from the LEFT nozzle and the DARK one from the RIGHT nozzle, so',
            '  the colours never share a nozzle (no purging, clean light lettering). Load each filament where that',
            '  nozzle can use it (its AMS or spool). To swap sides, change Filament grouping in Bambu Studio.']
          : pr.nozzles > 1 ? ['  Two nozzles: Bambu Studio chooses which nozzle prints each colour (its filament grouping).'] : [])]
      : ['PRINTER  Any enclosed Bambu Lab printer with AMS and a 0.4 mm nozzle (ASA and ABS need the enclosure):',
        '  X1 Carbon, X1E, P1S, P2S, H2S, H2D, H2D Pro, H2C or X2D. Not the open A1 / A1 mini / A2L / P1P.'];
    return [
      `TENARIS EMERGENCY CARD — ${card.driver.trim()}`,
      '',
      'Card link (write this exact text to the NFC tag as a URL record):',
      card.link,
      '',
      'NFC TAG',
      `  NTAG215 PVC coin tag, ${TAG.d} mm (1 in) across, ${TAG.thick} mm thick. Before printing, write the link to it`,
      '  (NFC Tools: Write > Add a record > URL > paste > Write) and test it with a phone. Do NOT lock it yet.',
      `  Measure one tag from each new batch: at most ${(POCKET.d - 0.6).toFixed(1)} mm across and ${z(POCKET.depth)} mm thick, or it won't fit the pocket.`,
      '',
      'COLOURS  Two filaments of the same type: one DARK and one LIGHT, e.g. black (or dark Tenaris blue) and white.',
      '  DARK: the front, the QR code and the back lettering. LIGHT: the core, the logo and front lettering, the back.',
      '  The QR code needs strong contrast, so keep the dark one dark and the light one white or nearly white.',
      '',
      'FILES',
      '  Bambu Studio project (.3mf, from the dashboard): parts, settings and the pause are already set.',
      '  Filament 1 = LIGHT (shown white), filament 2 = DARK (shown black). Open it, set the two filaments to',
      '  your AMS slots, slice, print.',
      '  STL files: *-DARK.stl and *-LIGHT.stl. Import BOTH into Bambu Studio at once and answer "Yes" to',
      '  loading them as ONE object with multiple parts. Keep their positions. Give the DARK part the dark',
      '  filament and the LIGHT part the light one. Then add the settings and the pause below yourself.',
      '',
      `CARD  ${W} x ${H} x ${z(m.thickness)} mm (credit-card outline), ${lastLayer} layers of ${LAYER} mm. From the build plate up:`,
      `  ${z(m.layers.front[0])}-${z(m.layers.front[1])} mm  front (logo side), FACE DOWN on the plate`,
      `  ${z(m.layers.core[0])}-${z(m.layers.core[1])} mm  LIGHT core with the NFC pocket, ${POCKET.d} mm across, ${z(POCKET.depth)} mm deep`,
      '  -------------- PAUSE: insert the tag --------------',
      `  ${z(m.layers.roof[0])}-${z(m.layers.roof[1])} mm  LIGHT layer that seals the tag in`,
      `  ${z(m.layers.back[0])}-${z(m.layers.back[1])} mm  back (QR code side), on top`,
      '',
      'ORIENTATION',
      '  Print exactly as the files come: front (logo side) face DOWN on the plate, QR code side up.',
      '  Do not flip, rotate onto an edge or mirror anything. The front reads correctly when you turn the',
      '  finished card over.',
      '',
      ...printerLines,
      '',
      'MATERIAL AND SETTINGS  Both filaments ASA, or both ABS (never mixed).',
      `  ${pr ? 'Already set in the .3mf; with the STL files, set them yourself' : 'Set them yourself'}, starting from the Bambu ASA (or ABS) profile`,
      '  for your printer and its 0.20 mm Standard process:',
      `  - Layer height ${LAYER} mm, first layer ${LAYER} mm (the pause height depends on it).`,
      '  - Sparse infill density 100%: a solid, stiff card.',
      '  - Bed 90 C for ASA and ABS, textured PEI plate. The .3mf sets it; with the STL files set it yourself',
      '    (the Bambu ASA profile says 100 C). PVC tags made for embedding are rated for beds up to 90 C.',
      '  - Enclosure door and top CLOSED for the whole print (except at the pause); ASA/ABS warp in drafts.',
      '  - Part cooling fan off or low (the ASA/ABS profiles already keep it low).',
      '  - Supports OFF. Prime tower ON (needed for the colour changes, and it purges the nozzle after the pause).',
      '  - Brim off; add a 3-5 mm brim (or mouse ears) only if corners lift on a test card; trim it after.',
      '  - Wall generator Arachne (the default), so the thinnest Tenaris logo bars (about 0.22 mm) print.',
      '  - The front takes the plate\'s finish: textured PEI gives a matte, textured front; a smooth plate a',
      '    glossy one. Clean the plate (no fingerprints) and use glue if Bambu\'s guide says so for the plate.',
      '',
      'INSERT THE NFC TAG',
      `  The print pauses after layer ${roofLayer - 1} (top at Z = ${z(m.pauseZ)} mm), before layer ${roofLayer} of ${lastLayer}`,
      `  (layer ${roofLayer} shows as ${z(m.pauseZ + LAYER)} mm in Bambu Studio's layer slider).`,
      '  - Bambu Studio project (.3mf): the pause is already in it. After slicing, the layer slider shows it',
      `    on layer ${roofLayer} (${z(m.pauseZ + LAYER)} mm), and layer ${roofLayer - 1} (${z(m.pauseZ)} mm) shows the pocket still open.`,
      `  - STL files: slice, drag the layer slider to layer ${roofLayer} (${z(m.pauseZ + LAYER)} mm), right-click its handle >`,
      `    Add Pause. Check that layer ${roofLayer - 1} (${z(m.pauseZ)} mm) still shows the pocket open.`,
      '  At the pause:',
      '  1. Wait until the head has moved away from the card and stopped (it parks over the waste chute).',
      '  2. Open the door. Drop the written and tested tag into the pocket and press it flat. If it has an',
      '     adhesive back, that side goes down. It must sit fully below the rim: nothing may stick up.',
      '     Don\'t touch the nozzle, the card\'s edges or the prime tower.',
      '  3. Close the door and press Resume straight away. PVC softens at about 80 C and the card is near',
      '     90 C: sealing the tag quickly keeps it flat.',
      '  The printer then prints the prime tower (purging the nozzle) and seals the tag with one LIGHT layer.',
      '',
      'AFTER PRINTING',
      '  Let the plate cool before taking the card off (ASA/ABS can warp if pulled off hot).',
      '  Test: scan the QR code and tap the card with an iPhone and an Android phone. Both must open the page',
      '  with the right driver name.',
      '  Only then lock the tag, through the card: NFC Tools > Other > Lock tag. Locking is permanent.',
      '',
    ].join('\n');
  }

  // README for the owner's "all cards" ZIP. cards: [{ driver, holder, link, folder, live }].
  function batchNotes(cards, material, skipped = [], printer = null) {
    const p = {}; // Houston date, YYYY-MM-DD
    for (const x of new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())) p[x.type] = x.value;
    const day = `${p.year}-${p.month}-${p.day}`;
    return [
      `TENARIS EMERGENCY CARDS — print files for ${cards.length} card${cards.length === 1 ? '' : 's'} (${printer ? 'Bambu Lab ' + printer.label + ', ' : ''}${material}, made ${day})`,
      '',
      'Each folder is one card:',
      `  <card>-${printer ? printer.id : '<printer>'}.3mf          Bambu Studio project${printer ? ' for the Bambu Lab ' + printer.label : ''}: parts, settings and the tag pause already set`,
      '  <card>-DARK.stl / -LIGHT.stl   the same card as two STL parts',
      '  <card>-print-notes.txt   the card\'s link, settings, the pause, inserting the tag, testing, locking',
      'NFC-links.csv lists every card\'s link, for writing the tags.',
      '',
      `CARD  ${W} x ${H} x ${T.toFixed(1)} mm, two colours: one DARK and one LIGHT ${material} filament.`,
      `NFC TAG  NTAG215 PVC coin, ${TAG.d} mm (1 in) x ${TAG.thick} mm. Pocket ${POCKET.d} mm x ${POCKET.depth.toFixed(1)} mm.`,
      `PAUSE  After layer ${Math.round(PAUSE_Z / LAYER)} (Z ${PAUSE_Z.toFixed(1)} mm), before layer ${Math.round(PAUSE_Z / LAYER) + 1} of ${Math.round(T / LAYER)} (${(PAUSE_Z + LAYER).toFixed(1)} mm in the layer slider).`,
      '',
      'EVERY CARD HAS ITS OWN LINK. A tag in the wrong card opens the wrong driver\'s page. For each card:',
      '  1. Write THIS card\'s link (from its print notes or NFC-links.csv) to a tag and test it with a phone.',
      '  2. Print THIS card\'s .3mf. At the pause, put that tag in.',
      '  3. Tap and scan the finished card: it must show this driver\'s name. Then lock the tag.',
      'Print and test one card before the rest.',
      ...(cards.some(c => !c.live) ? ['', 'NOT PUBLISHED YET (links work only after publishing): ' + cards.filter(c => !c.live).map(c => c.driver).join(', ')] : []),
      ...(skipped.length ? ['', 'LEFT OUT (fix in Cards > Rename, then download again):', ...skipped.map(t => '  ' + t)] : []),
      '',
      'CARDS',
      ...cards.map(c => `  ${c.folder}  ${c.driver}${c.holder ? ' (' + c.holder + ')' : ''}`),
      '',
    ].join('\n');
  }

  // ================= Public =================
  // File names: plain letters (José → Jose), digits and hyphens.
  const PLAIN = { Ø: 'O', ø: 'o', Ł: 'L', ł: 'l', Đ: 'D', đ: 'd', Æ: 'AE', æ: 'ae', Œ: 'OE', œ: 'oe', ß: 'ss', Þ: 'Th', þ: 'th' };
  const slug = s => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[ØøŁłĐđÆæŒœßÞþ]/g, c => PLAIN[c])
    .trim().replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '') || 'card';

  // The STL route in one ZIP: both parts and the print notes.
  async function files(card) {
    await load();
    const base = 'card-' + slug(card.driver);
    const m = model(card);
    return [
      { name: `${base}-DARK.stl`, data: m.black },
      { name: `${base}-LIGHT.stl`, data: m.white },
      { name: `${base}-print-notes.txt`, data: new TextEncoder().encode(printNotes(card, m)) },
    ];
  }

  return {
    load, layout, model, preview, printNotes, batchNotes, files, zip, slug,
    LAYER, CARD: { W, H, R, T, FRONT, CORE, ROOF, BACK, PAUSE_Z, TAG, POCKET, MIN_CAP, MIN_MODULE, GAP },
  };
})();
