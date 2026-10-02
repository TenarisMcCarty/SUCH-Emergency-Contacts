// cardmaker.js — every printable file for one card, made in the browser from the card's link:
//   • QR code (PNG, SVG)
//   • QR label: the code with the driver's name and short instructions (PNG)
//   • Paper card: front and back side by side, three copies on a Letter page, to cut and fold (PDF)
//   • 3D-print card: two STL files (black and white filament) with a sealed pocket for a 25 mm NFC tag
//   • all of it in one ZIP, with print notes.
// Needs qrcode.js, opentype.js, earcut.js, logo.js and source-sans-3-bold.ttf.
// The Tenaris signature follows the Tenaris Brandmark Basic Guidelines: official artwork only, Multibar at least
// 5.5 mm tall, clear space of 80% of the Multibar height all round, colour only on paper (one colour on the 3D card).
// Units are millimetres with y pointing up. The back is laid out as seen from the back.

const CardMaker = (() => {
  // ================= Card design =================
  // Credit-card size (ISO/IEC 7810 ID-1), printed in two colours with a 0.4 mm nozzle.
  const W = 85.6, H = 53.98, R = 3.18;
  const SKIN = 0.4;                         // front and back colour layers (2 × 0.2 mm layers)
  const TAG = { x: 67, y: 39, d: 25.6 };    // NFC pocket, front coordinates: 25 mm sticker + 0.6 mm clearance
  const TAG_BACK_X = W - TAG.x;             // the same spot seen from the back
  const BAND = 16.5;                        // white band along the bottom of the front
  const QRBOX = { x: 40.6, y: 7, size: 40 }; // QR area on the back, including its white margin
  const MARGIN = 6.4;                       // left margin on the front (also the logo's clear space from the edge)
  const MIN_MODULE = 0.8;                   // smallest QR square a 0.4 mm nozzle prints reliably
  const MIN_CAP = 2.3;                      // smallest capital height that prints cleanly
  const POCKETS = { 0.3: 0.4, 0.5: 0.6, 0.7: 0.8 }; // tag thickness (max) → pocket depth

  // Paper colours: Tenaris Green and Tenaris Gray (brand guide), dark text, and red kept for 911.
  const PAPER = { black: '#2b2f33', white: '#ffffff', green: '#009900', red: '#c8102e', grey: '#666666' };

  // The signature at `width` mm with its bottom-left corner at (x, y). One item per colour for paper,
  // or a single one-colour item (white on the black 3D face).
  const LOGO_LINE = 0.8; // clear space = 80% of the Multibar height
  function logoItems(x, y, width, colour) {
    const groups = colour ? Object.keys(LOGO.colors) : [null];
    return groups.map(g => ({
      contours: move(LOGO.contours.filter(c => !g || c.color === g).map(c => pairs(c.points)), x, y, width),
      kind: 'logo', color: g && LOGO.colors[g],
    }));
  }
  const logoHeight = width => LOGO.height * width;
  const clearSpace = width => LOGO_LINE * LOGO.multibar.height * width;

  // ================= Lettering =================
  let font = null;
  let capRatio = 0.66;

  async function load() {
    if (font) return;
    font = opentype.parse(await (await fetch('source-sans-3-bold.ttf')).arrayBuffer());
    capRatio = font.charToGlyph('H').getBoundingBox().y2 / font.unitsPerEm;
  }

  // Width of a line of text at a given capital-letter height (no kerning, so letters never touch).
  function textWidth(str, cap, track = 0) {
    const em = cap / capRatio;
    const glyphs = font.stringToGlyphs(str);
    return glyphs.reduce((w, g) => w + (g.advanceWidth / font.unitsPerEm) * em, 0) + track * em * Math.max(0, glyphs.length - 1);
  }

  // Outlines of a line of text. x is the left edge (or the centre, with align 'center'); y is the baseline.
  function text(str, cap, x, y, { align = 'left', track = 0, step = 0.15 } = {}) {
    const em = cap / capRatio;
    let pen = align === 'center' ? x - textWidth(str, cap, track) / 2 : x;
    const contours = [];
    for (const g of font.stringToGlyphs(str)) {
      contours.push(...flatten(g.getPath(pen, 0, em).commands, y, step));
      pen += (g.advanceWidth / font.unitsPerEm) * em + track * em;
    }
    return contours;
  }

  // Largest capital height (up to `max`) at which every line fits its width.
  function fit(lines, max, widths, track = 0) {
    return Math.min(max, ...lines.map((s, i) => (max * widths[i]) / textWidth(s, max, track)));
  }

  // Font curves → straight segments about `step` mm long. Font paths have y pointing down from the baseline.
  function flatten(commands, baseline, step) {
    const out = [];
    let cur = null, x0 = 0, y0 = 0;
    const P = (x, y) => [x, baseline - y];
    const close = () => { if (cur && cur.length > 2) out.push(clean(cur)); cur = null; };
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

  const orient = (c, ccw) => ((area(c) > 0) === ccw ? c : c.slice().reverse());
  const move = (cs, dx, dy, s = 1) => cs.map(c => c.map(([x, y]) => [dx + x * s, dy + y * s]));
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const circle = (cx, cy, r, n = 96) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);

  // A ring segment (for the contactless waves), angles in degrees.
  function arcBand(cx, cy, r0, r1, a0, a1, n = 28) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; pts.push([cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)]); }
    for (let i = n; i >= 0; i--) { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; pts.push([cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)]); }
    return pts;
  }

  // The card's outline (rounded for 3D, square for paper), optionally cut to a band of heights.
  function outline(yMin = 0, yMax = H, r = R) {
    if (!r) return clean(clipY(clipY(rect(0, 0, W, H), yMin, 1), yMax, -1));
    const pts = [];
    const corner = (cx, cy, a0) => { for (let i = 0; i <= 12; i++) { const a = ((a0 + (90 * i) / 12) * Math.PI) / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
    corner(W - r, r, 270); corner(W - r, H - r, 0); corner(r, H - r, 90); corner(r, r, 180);
    return clean(clipY(clipY(pts, yMin, 1), yMax, -1));
  }

  // Keep the part of a convex polygon above (dir 1) or below (dir -1) a horizontal line.
  function clipY(poly, y0, dir) {
    const out = [];
    const keep = p => (p[1] - y0) * dir >= 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (keep(a)) out.push(a);
      if (keep(a) !== keep(b)) { const t = (y0 - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, y0]); }
    }
    return out;
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

  // Right-most x that text at height yTop may reach on the front without crossing the tag pocket.
  function pocketLimit(yTop, gap = 1) {
    const r = TAG.d / 2 + gap;
    if (yTop < TAG.y - r) return W - MARGIN;
    return TAG.x - Math.sqrt(Math.max(0, r * r - (TAG.y - yTop) ** 2));
  }

  // Everything drawn on the card, for both the 3D print ('3d') and the paper card ('paper').
  // Each face: zones (areas of one base colour) holding items (outlines in the other colour).
  function layout({ link, driver, backup }, medium = '3d') {
    const m = qrMatrix(link);
    if (QRBOX.size / (m.n + 8) < MIN_MODULE) throw new Error('This card link is too long to print as a QR code on the card.');
    const problems = [];

    // ---- Front ----
    const upper = [], band = [];
    // Signature 44 mm wide: Multibar 7.9 mm (minimum 5.5), clear space 6.3 mm to the top edge and the text below.
    const LOGO_W = 44, logoY = H - clearSpace(LOGO_W) - logoHeight(LOGO_W) - 0.05;
    upper.push(...logoItems(MARGIN, logoY, LOGO_W, medium === 'paper'));

    const name = driver.trim().toUpperCase();
    let lines = [name];
    let cap = fit(lines, 5, [W - 2 * MARGIN]);
    if (cap < 3.4) {
      // Two lines, both kept below the tag pocket so they can use the full width.
      const split = splitName(name);
      const cap2 = split.length > 1 ? fit(split, 3.0, [W - 2 * MARGIN, W - 2 * MARGIN]) : 0;
      if (cap2 > cap) { lines = split; cap = cap2; }
    }
    if (cap < MIN_CAP) problems.push('The driver name is too long to print. Shorten it (Cards → Rename).');
    if (lines.length > 1) {
      upper.push({ contours: text(lines[0], cap, MARGIN, 18.2 + cap + 1.2), kind: 'name' });
      upper.push({ contours: text(lines[1], cap, MARGIN, 18.2), kind: 'name' });
    } else {
      upper.push({ contours: text(name, cap, MARGIN, 20.2), kind: 'name' });
    }
    const eyebrowY = Math.min(28.6, logoY - clearSpace(LOGO_W) - 2.4 - 0.05); // stays out of the logo's clear space
    const eyebrowCap = fit(['EMERGENCY CONTACT'], 2.4, [pocketLimit(eyebrowY + 2.4) - MARGIN], 0.1);
    upper.push({ contours: text('EMERGENCY CONTACT', eyebrowCap, MARGIN, eyebrowY, { track: 0.1 }), kind: 'eyebrow' });

    const bandLines = ['Tap this card or scan the QR code', 'to reach Tenaris emergency contacts.', 'Life-threatening? Call 911 first.'];
    const bandCap = Math.max(MIN_CAP, fit(bandLines, 2.6, bandLines.map(() => W - 2 * MARGIN)));
    bandLines.forEach((s, i) => band.push({ contours: text(s, bandCap, MARGIN, 12.4 - i * 4.0), kind: i === 2 ? 'urgent' : 'band' }));

    const radius = medium === '3d' ? R : 0;
    const front = {
      zones: [
        // Paper is white all over so the full-colour signature sits on white, as the brand guide prefers.
        { contour: outline(BAND, H, radius), color: medium === 'paper' ? 'white' : 'black', items: upper },
        { contour: outline(0, BAND, radius), color: 'white', items: band },
      ],
    };

    // ---- Back (as seen from the back) ----
    const items = [];
    const cx = TAG_BACK_X, cy = TAG.y;
    if (medium === '3d') {
      // Contactless symbol in a ring, right over the hidden tag.
      items.push({ contours: [circle(cx, cy, 12.6), circle(cx, cy, 12.0)], kind: 'ring' });
      const wx = cx - 3.6;
      items.push({ contours: [circle(wx, cy, 0.85, 32)], kind: 'icon' });
      for (const [r0, r1] of [[2.6, 3.4], [4.8, 5.6], [7.0, 7.8]]) items.push({ contours: [arcBand(wx, cy, r0, r1, -48, 48)], kind: 'icon' });
      const tapCap = fit(['TAP PHONE'], 2.8, [29], 0.06);
      items.push({ contours: text('TAP PHONE', tapCap, cx, 21.6, { align: 'center', track: 0.06 }), kind: 'label' });
      items.push({ contours: text('HERE', tapCap, cx, 17.8, { align: 'center', track: 0.06 }), kind: 'label' });
    } else {
      // Paper has no tag: point people at the code instead. (No logo here: at this width it would be
      // below the brand guide's minimum size, and the front already carries the signature.)
      const sCap = fit(['SCAN WITH YOUR', 'PHONE CAMERA'], 3.2, [29, 29], 0.06);
      items.push({ contours: text('SCAN WITH YOUR', sCap, cx, 38.5, { align: 'center', track: 0.06 }), kind: 'label' });
      items.push({ contours: text('PHONE CAMERA', sCap, cx, 33.5, { align: 'center', track: 0.06 }), kind: 'label' });
      items.push({ contours: [[[cx - 7, 23.8], [cx + 3, 23.8], [cx + 3, 21.3], [cx + 9, 25], [cx + 3, 28.7], [cx + 3, 26.2], [cx - 7, 26.2]]], kind: 'arrow' });
    }
    if (backup) {
      items.push({ contours: [rect(cx - 8, 14.7, 16, 0.5)], kind: 'rule' });
      const bCap = fit(['BACKUP LINE'], 2.3, [29], 0.12);
      items.push({ contours: text('BACKUP LINE', Math.max(MIN_CAP, bCap), cx, 10.6, { align: 'center', track: 0.12 }), kind: 'eyebrow' });
      const nCap = fit([backup], 2.8, [29]);
      if (nCap < MIN_CAP) problems.push('The backup number is too long to print.');
      items.push({ contours: text(backup, nCap, cx, 6.0, { align: 'center' }), kind: 'label' });
    }
    const back = { zones: [{ contour: outline(0, H, radius), color: 'white', items, windows: [rect(QRBOX.x, QRBOX.y, QRBOX.size, QRBOX.size)] }], qr: { m, box: QRBOX } };

    if (medium === '3d') checkClearances(front, back, problems);
    return { front, back, problems, qrModules: m.n, modulePitch: QRBOX.size / (m.n + 8) };
  }

  const pairs = flat => { const c = []; for (let i = 0; i < flat.length; i += 2) c.push([flat[i], flat[i + 1]]); return c; };

  // Nothing printed in the front skin may sit over the tag pocket, and art must stay inside its zone.
  function checkClearances(front, back, problems) {
    const r = TAG.d / 2 + 0.4;
    for (const item of front.zones[0].items)
      for (const c of item.contours)
        for (const [x, y] of c)
          if (Math.hypot(x - TAG.x, y - TAG.y) < r) { problems.push(`Front ${item.kind} would cover the NFC tag.`); return; }
    for (const zone of [...front.zones, ...back.zones])
      for (const item of zone.items)
        for (const c of item.contours)
          if (!c.every(p => inside(p, zone.contour))) { problems.push(`The ${item.kind} doesn't fit on the card.`); return; }
    for (const item of back.zones[0].items)
      for (const c of item.contours)
        if (c.some(([x]) => x > QRBOX.x - 0.5)) { problems.push(`The ${item.kind} runs into the QR code's margin.`); return; }
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

  const mirrorX = c => c.map(([x, y]) => [W - x, y]);

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

  // Two STL files: everything printed in black, and everything printed in white.
  // Layers (z, bottom up): back skin 0–0.4 (printed face down), white core with the tag pocket, front skin.
  function model(card, tagThickness = 0.5) {
    const depth = POCKETS[tagThickness] || 0.6;
    const L = layout(card, '3d');
    if (L.problems.length) throw new Error(L.problems.join(' '));
    const T = 2 * SKIN + depth;
    const tris = { black: [], white: [] };
    for (const r of faceRegions(L.back, true)) prism(r, 0, SKIN, tris[r.color]);
    prism({ outer: outline(), holes: [circle(TAG.x, TAG.y, TAG.d / 2)], color: 'white' }, SKIN, SKIN + depth, tris.white);
    for (const r of faceRegions(L.front, false)) prism(r, SKIN + depth, T, tris[r.color]);
    return { black: stl(tris.black, 'Tenaris card BLACK'), white: stl(tris.white, 'Tenaris card WHITE'), thickness: T, depth, layout: L };
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

  // ================= Drawing (paper card, label, previews) =================
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

  // Draws a face onto a canvas at `pxPerMm`. palette maps 'black'/'white' (and item kinds) to colours.
  function drawFace(face, pxPerMm, palette, transparent = false) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * pxPerMm);
    canvas.height = Math.round(H * pxPerMm);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(pxPerMm, 0, 0, -pxPerMm, 0, canvas.height); // millimetres, y up
    if (!transparent) { ctx.fillStyle = palette.white; ctx.fillRect(0, 0, W, H); }
    const fill = (contours, color) => {
      ctx.beginPath();
      for (const c of contours) { ctx.moveTo(...c[0]); for (const p of c.slice(1)) ctx.lineTo(...p); ctx.closePath(); }
      ctx.fillStyle = color;
      ctx.fill('evenodd');
    };
    for (const zone of face.zones) {
      fill([zone.contour], palette[zone.color]);
      const ink = zone.color === 'black' ? 'white' : 'black';
      for (const item of zone.items) fill(item.contours, item.color || palette[item.kind] && palette[item.kind][zone.color] || palette[ink]);
    }
    if (palette.bandLine && face.zones.length > 1) fill([rect(0, BAND - 0.35, W, 0.7)], palette.bandLine);
    if (face.qr) drawQR(ctx, face.qr.m, face.qr.box, pxPerMm);
    return canvas;
  }

  const PAPER_PALETTE = {
    black: PAPER.black, white: PAPER.white, bandLine: PAPER.green,
    eyebrow: { white: PAPER.grey }, urgent: { white: PAPER.red }, arrow: { white: PAPER.green }, rule: { white: PAPER.green },
  };
  const PRINT_PALETTE = { black: '#141414', white: '#f4f4f2' }; // how the 3D print will look

  function preview(card, side) {
    const L = layout(card, '3d');
    return drawFace(L[side], 8, PRINT_PALETTE, true);
  }

  function canvasBlob(canvas, type = 'image/png') {
    return new Promise(resolve => canvas.toBlob(resolve, type));
  }

  // Just the QR code, with its white margin.
  function qrCanvas(link, px = 20) {
    const m = qrMatrix(link), N = m.n + 8;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = N * px;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) if (m.dark(r, c)) ctx.fillRect((c + 4) * px, (r + 4) * px, px, px);
    return canvas;
  }

  function qrSvg(link) {
    const m = qrMatrix(link), N = m.n + 8;
    let d = '';
    for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) if (m.dark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges">` +
      `<rect width="${N}" height="${N}" fill="#fff"/><path d="${d}" fill="#000"/></svg>\n`;
  }

  // A 4 × 6 inch label (300 dpi): logo, name, QR and short instructions.
  function labelCanvas({ link, driver, backup }) {
    const Wl = 101.6, Hl = 152.4, s = 300 / 25.4;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(Wl * s);
    canvas.height = Math.round(Hl * s);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(s, 0, 0, -s, 0, canvas.height);
    const fill = (contours, color) => {
      ctx.beginPath();
      for (const c of contours) { ctx.moveTo(...c[0]); for (const p of c.slice(1)) ctx.lineTo(...p); ctx.closePath(); }
      ctx.fillStyle = color;
      ctx.fill('evenodd');
    };
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, Wl, Hl);
    // Full-colour signature on white, 48 mm wide (Multibar 8.6 mm), with its clear space kept free.
    const lw = 48, ly = Hl - 8 - logoHeight(lw);
    for (const item of logoItems((Wl - lw) / 2, ly, lw, true)) fill(item.contours, item.color);
    fill([rect(12, ly - clearSpace(lw) - 1.2, Wl - 24, 0.8)], PAPER.green);
    const center = (str, cap, y, color, opts = {}) => fill(text(str, cap, Wl / 2, y, { align: 'center', step: 0.05, ...opts }), color);
    center('EMERGENCY CONTACT FOR', 3, 118, PAPER.grey, { track: 0.12 });
    const name = driver.trim().toUpperCase();
    center(name, fit([name], 6, [Wl - 12]), 107.5, PAPER.black);
    // QR with its white margin from y 32 to 100; nothing else may enter that area.
    drawQR(ctx, qrMatrix(link), { x: (Wl - 68) / 2, y: 32, size: 68 }, s);
    const info = ['Scan with your phone camera to reach', 'Tenaris emergency contacts.'];
    const iCap = fit(info, 3.4, [Wl - 12, Wl - 12]);
    center(info[0], iCap, 25.5, PAPER.black);
    center(info[1], iCap, 20.5, PAPER.black);
    center('Life-threatening? Call 911 first.', iCap, 13.5, PAPER.red);
    if (backup) center(`Backup line: ${backup}`, iCap * 0.9, 7.5, PAPER.grey);
    return canvas;
  }

  // ================= PDF (paper card sheet) =================
  // Letter page with three copies: front | back side by side. Cut on the outer marks, fold on the middle marks.
  async function paperPdf(card) {
    const L = layout(card, 'paper');
    const dpi = 600, s = dpi / 25.4;
    const front = drawFace(L.front, s, PAPER_PALETTE), back = drawFace(L.back, s, PAPER_PALETTE);
    const pt = mm => (mm * 72) / 25.4;
    const cw = pt(W), ch = pt(H), x0 = (612 - 2 * cw) / 2;
    const ys = [792 - 108 - ch, 792 - 108 - 2 * ch - 42, 792 - 108 - 3 * ch - 84];
    let ops = '0.5 w 0.3 0.3 0.3 RG\n';
    const line = (x1, y1, x2, y2) => { ops += `${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`; };
    for (const y of ys) {
      ops += `q ${cw.toFixed(3)} 0 0 ${ch.toFixed(3)} ${x0.toFixed(3)} ${y.toFixed(3)} cm /Im1 Do Q\n`;
      ops += `q ${cw.toFixed(3)} 0 0 ${ch.toFixed(3)} ${(x0 + cw).toFixed(3)} ${y.toFixed(3)} cm /Im2 Do Q\n`;
      for (const [x, dir] of [[x0, -1], [x0 + 2 * cw, 1]]) { line(x + dir * 4, y, x + dir * 16, y); line(x + dir * 4, y + ch, x + dir * 16, y + ch); }
      for (const x of [x0, x0 + cw, x0 + 2 * cw]) { line(x, y - 4, x, y - 14); line(x, y + ch + 4, x, y + ch + 14); }
    }
    const say = (x, y, size, str) => { ops += `BT /F1 ${size} Tf ${x} ${y} Td (${pdfText(str)}) Tj ET\n`; };
    say(x0, 750, 12, `Tenaris emergency card - ${card.driver.trim()}`);
    say(x0, 734, 9, 'Print at 100% / Actual size. Cut on the outer marks, fold on the middle marks so the back is behind the front,');
    say(x0, 723, 9, 'then glue or laminate. Test the QR code with a phone before handing the card out.');
    return pdf([{ images: [front, back], content: ops }]);
  }

  function pdfText(str) {
    let out = '';
    for (const ch of str) {
      const c = ch.codePointAt(0);
      const b = c < 256 ? c : ch === '–' || ch === '—' ? 45 : 63;
      out += b === 40 || b === 41 || b === 92 ? '\\' + String.fromCharCode(b) : b > 126 ? '\\' + b.toString(8).padStart(3, '0') : String.fromCharCode(b);
    }
    return out;
  }

  async function deflate(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  // Minimal PDF writer: one Letter page, RGB images (Flate) + drawing operators + Helvetica text.
  async function pdf([page]) {
    const enc = new TextEncoder();
    const chunks = [], offsets = [];
    let size = 0;
    const put = x => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); size += b.length; };
    const obj = (n, body, stream) => {
      offsets[n] = size;
      put(`${n} 0 obj\n${body}\n`);
      if (stream) { put('stream\n'); put(stream); put('\nendstream\n'); }
      put('endobj\n');
    };
    put('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
    const imgNames = page.images.map((_, i) => `/Im${i + 1} ${5 + i} 0 R`).join(' ');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    const contentNo = 5 + page.images.length;
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> /XObject << ${imgNames} >> >> /Contents ${contentNo} 0 R >>`);
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    for (let i = 0; i < page.images.length; i++) {
      const c = page.images[i];
      const rgba = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const rgb = new Uint8Array((rgba.length / 4) * 3);
      for (let p = 0, q = 0; p < rgba.length; p += 4) { rgb[q++] = rgba[p]; rgb[q++] = rgba[p + 1]; rgb[q++] = rgba[p + 2]; }
      const data = await deflate(rgb);
      obj(5 + i, `<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${data.length} >>`, data);
    }
    const content = enc.encode(page.content);
    obj(contentNo, `<< /Length ${content.length} >>`, content);
    const xref = size;
    let table = `xref\n0 ${contentNo + 1}\n0000000000 65535 f \n`;
    for (let n = 1; n <= contentNo; n++) table += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
    put(table + `trailer\n<< /Size ${contentNo + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(chunks, { type: 'application/pdf' });
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
  function printNotes(card, m) {
    const pause = (SKIN + m.depth).toFixed(1);
    const layer = Math.round((SKIN + m.depth) / 0.2) + 1;
    return [
      `TENARIS EMERGENCY CARD — ${card.driver.trim()}`,
      '',
      `Card link (write this exact text to the NFC tag as a URL record):`,
      card.link,
      '',
      'FILES',
      '  *-BLACK.stl  black filament',
      '  *-WHITE.stl  white filament',
      '  Import BOTH into Bambu Studio at once and answer "Yes" to loading them as ONE object with',
      '  two parts. Keep their positions. Give the black part black filament, the white part white.',
      '',
      `CARD  85.6 × 53.98 × ${m.thickness.toFixed(1)} mm · NFC pocket ${TAG.d} mm wide × ${m.depth} mm deep`,
      '',
      'PRINT SETTINGS (0.4 mm nozzle, starting point)',
      '  Print flat with the QR side DOWN. Do not mirror.',
      '  Layer height 0.2 mm (first layer 0.2 mm), 100% infill, supports OFF, by-layer sequence.',
      '  Smooth plate for a clean QR face. Slow first layer (about 20 mm/s).',
      '  Tenaris logo: its thinnest bars are 0.27 mm wide (official proportions). Keep Arachne walls on',
      '  (the default) so they print; check in the sliced preview that all 7 bars are there.',
      '',
      'INSERT THE NFC TAG',
      `  Add a pause after Z = ${pause} mm (before layer ${layer}). At the pause, press the tested`,
      '  tag into the pocket, sticky side down, flat and below the rim, then resume.',
      '',
      'BEFORE GIVING IT OUT',
      '  Scan the QR and tap the tag with an iPhone and an Android phone.',
      '  Lock the tag in NFC Tools only after it works.',
      '',
    ].join('\n');
  }

  // ================= Public =================
  const slug = s => s.trim().replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'card';

  async function files(card, tagThickness) {
    await load();
    const base = 'card-' + slug(card.driver);
    const m = model(card, tagThickness);
    const bytes = async blob => new Uint8Array(await blob.arrayBuffer());
    return [
      { name: `${base}-BLACK.stl`, data: m.black },
      { name: `${base}-WHITE.stl`, data: m.white },
      { name: `${base}-print-notes.txt`, data: new TextEncoder().encode(printNotes(card, m)) },
      { name: `${base}-paper-card.pdf`, data: await bytes(await paperPdf(card)) },
      { name: `${base}-qr-label.png`, data: await bytes(await canvasBlob(labelCanvas(card))) },
      { name: `${base}-qr.png`, data: await bytes(await canvasBlob(qrCanvas(card.link))) },
      { name: `${base}-qr.svg`, data: new TextEncoder().encode(qrSvg(card.link)) },
      { name: `${base}-link.txt`, data: new TextEncoder().encode(card.link + '\n') },
    ];
  }

  return {
    load, layout, model, preview, printNotes, files, zip, slug,
    qrCanvas, qrSvg, labelCanvas, paperPdf, canvasBlob,
    TAG_THICKNESS: Object.keys(POCKETS).map(Number),
  };
})();
