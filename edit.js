// edit.js — the admin editor (edit.html).
// Everything stays in this tab's memory. The admin key and card keys are never saved
// or sent anywhere; the only output is a file you paste into GitHub yourself.

const GITHUB_REPO = 'TenarisMcCarty/SUCH-Emergency-Contacts';
const CONTACT_COUNT = 6;
const DEFAULT_MESSAGE = 'EMERGENCY – need to reach driver {driver}. Please call me back at this number.';
const SITE = new URL('./', location.href).href; // card links point at the emergency page next to this editor

const $ = id => document.getElementById(id);
let adminKey = null; // set by Unlock or Start fresh
let cards = [];      // [{ driver, note, key, added }]
let dirty = false;   // changes not yet turned into a file

// ---------- Small helpers ----------

function say(id, text, bad = false) {
  $(id).textContent = text;
  $(id).classList.toggle('bad', bad);
}

function markDirty() {
  dirty = true;
  $('unsaved').hidden = false;
  $('save-out').hidden = true; // hide the old file so it can't be pasted by mistake
}

async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch { // older browsers
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
  const label = btn.textContent;
  btn.textContent = 'Copied ✓';
  setTimeout(() => (btn.textContent = label), 1500);
}

function smallButton(label, color, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn btn-small ' + color;
  b.textContent = label;
  b.onclick = onClick;
  return b;
}

function download(link, name, blob) {
  if (link.href.startsWith('blob:')) URL.revokeObjectURL(link.href);
  link.href = URL.createObjectURL(blob);
  link.download = name;
}

// Load the current file from the site; null if there isn't one yet.
// The ?t= part skips every cache, so you always edit the latest version.
async function fetchFile() {
  const res = await fetch('contacts.enc.json?t=' + Date.now(), { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Could not load the contacts file (error ' + res.status + ').');
  return res.json();
}

// ---------- Unlock / first-time setup ----------

$('unlock').onclick = async () => {
  const key = $('admin-key').value.trim();
  if (!isKey(key)) return say('unlock-msg', "That isn't an admin key. It should be 22 characters long.", true);
  say('unlock-msg', 'Unlocking…');
  try {
    const file = await fetchFile();
    if (!file) return say('unlock-msg', 'There is no contacts file on the site yet. Use First-time setup below.', true);
    const admin = await openAdmin(key, file);
    adminKey = key;
    cards = admin.cards;
    $('admin-key').value = '';
    openWorkspace(admin.data);
  } catch (e) {
    say('unlock-msg', e.name === 'OperationError' ? 'Wrong admin key.' : e.message, true);
  }
};

$('admin-key').onkeydown = e => { if (e.key === 'Enter') $('unlock').click(); };

$('start-fresh').onclick = async () => {
  let exists = true;
  try { exists = !!(await fetchFile()); } catch {}
  if (exists && !confirm('This replaces the current contacts file. Once you commit it, EVERY existing card stops working until it is rewritten with a new link. Continue?')) return;
  adminKey = newKey();
  cards = [];
  $('new-admin-key').textContent = adminKey;
  $('step-unlock').hidden = true;
  $('step-admin-key').hidden = false;
};

$('copy-admin-key').onclick = e => copy(adminKey, e.currentTarget);
$('saved-key').onchange = () => ($('admin-key-done').disabled = !$('saved-key').checked);
$('admin-key-done').onclick = () => {
  $('step-admin-key').hidden = true;
  openWorkspace({ message: DEFAULT_MESSAGE, primary: 0, contacts: [] });
  markDirty();
};

$('lock').onclick = () => location.reload(); // clears every key from memory (warns if unsaved)

function openWorkspace(data) {
  $('step-unlock').hidden = true;
  $('workspace').hidden = false;
  fillForm(data);
  renderCards();
}

// ---------- Contacts ----------

$('contact-count').textContent = CONTACT_COUNT;
for (let i = 0; i < CONTACT_COUNT; i++) {
  const box = document.createElement('fieldset');
  box.innerHTML = `
    <legend>Contact ${i + 1}</legend>
    <label>Name <input data-f="name" autocomplete="off"></label>
    <label>Role <input data-f="role" autocomplete="off" placeholder="e.g. Yard supervisor"></label>
    <label>Phone <input data-f="phone" type="tel" autocomplete="off" placeholder="(555) 555-0100"></label>
    <label class="check"><input type="radio" name="primary" value="${i}"> Main contact (gets the big Call button)</label>
    <p class="field-error" hidden></p>`;
  $('contact-fields').append(box);
}
$('contact-fields').addEventListener('input', markDirty);
$('message').addEventListener('input', markDirty);

const contactBoxes = () => [...document.querySelectorAll('#contact-fields fieldset')];

function fillForm({ message, primary, contacts }) {
  contactBoxes().forEach((box, i) => {
    const c = contacts[i] || {};
    for (const f of ['name', 'role', 'phone']) box.querySelector(`[data-f="${f}"]`).value = c[f] || '';
  });
  document.querySelector(`input[name="primary"][value="${primary || 0}"]`).checked = true;
  $('message').value = message || DEFAULT_MESSAGE;
}

// Accepts (555) 555-0100, 555.555.0100, +1 555 555 0100, … → "+15555550100", or null if not a US number.
function normalizePhone(text) {
  let digits = text.replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1);
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? '+1' + digits : null;
}

// Read and check the form → { errors, data }.
function readForm() {
  const errors = [];
  const contacts = contactBoxes().map((box, i) => {
    const field = f => box.querySelector(`[data-f="${f}"]`);
    const c = { name: field('name').value.trim(), role: field('role').value.trim(), phone: normalizePhone(field('phone').value) };
    const problems = [];
    if (!c.name) problems.push('needs a name');
    if (!c.phone) problems.push('needs a 10-digit US phone number');
    else field('phone').value = c.phone;
    const err = box.querySelector('.field-error');
    err.textContent = problems.length ? `Contact ${i + 1} ${problems.join(' and ')}.` : '';
    err.hidden = !problems.length;
    if (problems.length) errors.push(err.textContent);
    return c;
  });
  const phones = contacts.map(c => c.phone).filter(Boolean);
  if (new Set(phones).size !== phones.length) errors.push('Two contacts have the same phone number.');
  const message = $('message').value.trim();
  if (!message) errors.push('Write a text message.');
  const primary = Number(document.querySelector('input[name="primary"]:checked').value);
  return { errors, data: { message, primary, contacts } };
}

// ---------- Cards ----------

function renderCards() {
  $('card-list').replaceChildren(...cards.map(card => {
    const name = document.createElement('strong');
    name.textContent = card.driver;
    const info = document.createElement('span');
    info.textContent = [card.note, 'added ' + card.added].filter(Boolean).join(' · ');
    const who = document.createElement('div');
    who.append(name, info);

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(
      smallButton('Link / QR', 'light', () => showCard(card)),
      smallButton('Rename', 'light', () => renameCard(card)),
      smallButton('Remove', 'red', () => removeCard(card)));

    const li = document.createElement('li');
    li.append(who, actions);
    return li;
  }));
  $('card-count').textContent = cards.length;
  $('no-cards').hidden = cards.length > 0;
}

$('add-card').onclick = () => {
  const driver = $('new-driver').value.trim();
  if (!driver) return say('card-msg', 'Enter the driver name and ID first.', true);
  const card = { driver, note: $('new-note').value.trim(), key: newKey(), added: new Date().toISOString().slice(0, 10) };
  cards.push(card);
  $('new-driver').value = $('new-note').value = '';
  say('card-msg', '');
  renderCards();
  markDirty();
  showCard(card);
};

function renameCard(card) {
  const driver = prompt('Driver name and ID (shown on the page):', card.driver);
  if (driver === null || !driver.trim()) return;
  const note = prompt('Who has this card? (only you see this)', card.note);
  card.driver = driver.trim();
  if (note !== null) card.note = note.trim();
  renderCards();
  markDirty();
  if ($('card-out').dataset.key === card.key) showCard(card);
}

function removeCard(card) {
  if (!confirm(`Remove the card for ${card.driver}${card.note ? ` (${card.note})` : ''}? Once you create the file and commit it, that card stops working for good.`)) return;
  cards = cards.filter(c => c !== card);
  if ($('card-out').dataset.key === card.key) $('card-out').hidden = true;
  renderCards();
  markDirty();
}

function showCard(card) {
  const link = SITE + '#' + card.key;
  const fileName = 'card-' + (card.driver + ' ' + card.note).trim().replace(/[^\w-]+/g, '-');
  $('card-out').dataset.key = card.key;
  $('card-out-title').textContent = card.driver + (card.note ? ` (${card.note})` : '');
  $('card-link').value = link;

  const qr = qrcode(0, 'M'); // 0 = smallest QR that fits; M = survives ~15% damage
  qr.addData(link);
  qr.make();
  drawQR(qr, $('qr'));
  $('qr').toBlob(png => download($('qr-png'), fileName + '.png', png));
  download($('qr-svg'), fileName + '.svg', new Blob([qrSvg(qr)], { type: 'image/svg+xml' }));

  $('card-out').hidden = false;
  $('card-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('copy-card-link').onclick = e => copy($('card-link').value, e.currentTarget);

const QUIET = 4; // white border around the QR, in squares (scanners need it)

function drawQR(qr, canvas) {
  const n = qr.getModuleCount();
  const px = 16;
  canvas.width = canvas.height = (n + QUIET * 2) * px;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c)) ctx.fillRect((c + QUIET) * px, (r + QUIET) * px, px, px);
}

// One black shape per dark square, on a white background. 1 unit = 1 square.
function qrSvg(qr) {
  const n = qr.getModuleCount();
  const size = n + QUIET * 2;
  let d = '';
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c)) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>\n`;
}

// ---------- Save ----------

$('gh-edit').href = `https://github.com/${GITHUB_REPO}/edit/main/contacts.enc.json`;
$('gh-new').href = `https://github.com/${GITHUB_REPO}/new/main?filename=contacts.enc.json`;

$('save').onclick = async () => {
  const { errors, data } = readForm();
  if (errors.length) return say('save-msg', errors.join(' '), true);
  try {
    say('save-msg', 'Encrypting…');
    const file = await buildFile(adminKey, { data, cards });
    // Double-check the new file opens with the admin key and with every card before showing it.
    await openAdmin(adminKey, file);
    for (const card of cards) await openCard(card.key, file);

    const text = JSON.stringify(file, null, 2) + '\n';
    $('file-text').value = text;
    download($('download-file'), 'contacts.enc.json', new Blob([text], { type: 'application/json' }));
    dirty = false;
    $('unsaved').hidden = true;
    $('save-out').hidden = false;
    say('save-msg', cards.length
      ? `File ready: ${CONTACT_COUNT} contacts, ${cards.length} card${cards.length > 1 ? 's' : ''}. Follow the steps below.`
      : 'File ready, with no cards yet. You can commit it now, or add cards first and create it again.');
  } catch (e) {
    say('save-msg', 'Something went wrong: ' + e.message, true);
  }
};

$('copy-file').onclick = e => copy($('file-text').value, e.currentTarget);

addEventListener('beforeunload', e => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});
