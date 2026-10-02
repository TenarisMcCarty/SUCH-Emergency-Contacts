// dashboard.js — the admin dashboard (dashboard.html).
// Sign in with the shared password → edit people, shifts and cards → Publish.
// Publish saves the encrypted contacts.enc.json straight to GitHub, using the GitHub
// token that is stored (encrypted) inside that same file. Nothing is kept in this
// browser except your name for the History tab.

const REPO = 'TenarisMcCarty/SUCH-Emergency-Contacts';
const API = 'https://api.github.com';
const FILE = 'contacts.enc.json';
const ITERATIONS = 600000; // password stretching: makes guessing the password very slow
const MAX_PEOPLE = 10;
const DEFAULT_MESSAGE = 'EMERGENCY – need to reach driver {driver}. Please call me back at this number.';
const SITE = new URL('./', location.href).href; // card links point at the emergency page next to this one
const COMMON_ZONES = ['America/Chicago', 'America/New_York', 'America/Denver', 'America/Los_Angeles', 'America/Mexico_City'];

const $ = id => document.getElementById(id);

// Everything below lives only in this tab's memory.
let admin = null;       // { key, salt, iterations } made from the password
let github = null;      // { token, addedAt, addedBy }
let state = null;       // what you're editing: { message, contacts, schedule, cards }
let published = null;   // { state, text, admin, github } as last published (null = never published)
let sha = null;         // GitHub's id for the current file (needed to replace it)
let log = [];           // change history
let pending = new Set(); // changes that aren't in `state`: 'password', 'token'
let deployState = 'checking'; // checking | live | deploying | slow
let ghProblem = null;   // text of a GitHub problem, if any
let busy = false;

// ================= Small helpers =================

function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k in e) e[k] = v;
    else e.setAttribute(k, v);
  }
  e.append(...children.filter(c => c != null && c !== false));
  return e;
}

function say(id, text, bad = false) {
  $(id).textContent = text;
  $(id).classList.toggle('bad', bad);
}

const clone = value => JSON.parse(JSON.stringify(value));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const newId = () => toB64(crypto.getRandomValues(new Uint8Array(6)));
const today = () => new Date().toISOString().slice(0, 10);
const when = iso => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const personName = c => c.name.trim() || 'a person with no name';

async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch { // older browsers
    const t = el('textarea', { value: text });
    document.body.append(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
  const label = btn.textContent;
  btn.textContent = 'Copied ✓';
  setTimeout(() => (btn.textContent = label), 1500);
}

function download(link, name, blob) {
  if (link.href.startsWith('blob:')) URL.revokeObjectURL(link.href);
  link.href = URL.createObjectURL(blob);
  link.download = name;
}

// Your name, for History. Kept on this device only (it's not secret).
function myName() {
  try { return localStorage.getItem('dashboard-name') || ''; } catch { return ''; }
}
function setMyName(name) {
  try { localStorage.setItem('dashboard-name', name); } catch {}
}

// Accepts (555) 555-0100, 555.555.0100, +1 555 555 0100, … → "+15555550100", or null if not a US number.
function normalizePhone(text) {
  let digits = (text || '').replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1);
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? '+1' + digits : null;
}

// A strong password: 5 random words (~64 bits). Rejection sampling keeps every word equally likely.
function suggestPassword() {
  const words = [];
  const limit = Math.floor(2 ** 32 / WORDS.length) * WORDS.length;
  while (words.length < 5) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0];
    if (n < limit) words.push(WORDS[n % WORDS.length]);
  }
  return words.join('-');
}

// ================= GitHub =================

async function gh(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (github) headers.Authorization = 'Bearer ' + github.token;
  if (body) headers['Content-Type'] = 'application/json';
  return fetch(API + path, { method, headers, body: body && JSON.stringify(body), cache: 'no-store' });
}

// The latest saved file → { text, sha }, or null if there isn't one yet.
async function loadFile() {
  try { // straight from GitHub: always the newest version (the repo is public, so no sign-in needed)
    const res = await gh(`/repos/${REPO}/contents/${FILE}?ref=main`);
    if (res.status === 404) return null;
    if (res.ok) {
      const j = await res.json();
      return { text: atob(j.content.replace(/\s/g, '')), sha: j.sha };
    }
  } catch {}
  // GitHub's API unreachable or busy: use the copy on the site instead.
  const res = await fetch(FILE + '?t=' + Date.now(), { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Couldn't load the current data (error ${res.status}). Try again in a minute.`);
  return { text: await res.text(), sha: null };
}

function publishError(status) {
  if (status === 401) return 'The GitHub token has expired or was deleted. Replace it in Settings, then publish again.';
  if (status === 403 || status === 404) return "The GitHub token isn't allowed to change this repository. Replace it in Settings (the steps show the right permission).";
  if (status === 409 || status === 422) return 'Someone else published changes since you signed in, so yours were NOT published. Note your changes, Lock, sign in again and redo them.';
  return `GitHub error ${status}. Nothing was published. Try again in a minute.`;
}

// Check the token works and that nobody has published since we loaded.
async function checkGitHub() {
  try {
    const res = await gh(`/repos/${REPO}/contents/${FILE}?ref=main`);
    if (res.status === 401) ghProblem = 'The GitHub token has expired or was deleted. Publishing won\'t work until you replace it in Settings.';
    else if (res.ok) {
      const j = await res.json();
      sha = j.sha;
      ghProblem = published && atob(j.content.replace(/\s/g, '')) !== published.text
        ? 'Someone published a newer version since this page loaded. Lock and sign in again before making changes.'
        : null;
    } else if (res.status === 404) ghProblem = null; // nothing published yet
    else ghProblem = `GitHub answered with error ${res.status}. Publishing may not work right now.`;
  } catch {
    ghProblem = "Can't reach GitHub right now. You can make changes, but publishing may fail.";
  }
  refresh();
}

// After publishing, watch the site until it serves the new file.
let deployRun = 0;
async function watchDeploy() {
  if (!published) return;
  const run = ++deployRun;
  const text = published.text;
  for (let i = 0; i < 120 && run === deployRun; i++) {
    try {
      const res = await fetch(FILE + '?t=' + Date.now(), { cache: 'no-store' });
      if (res.ok && (await res.text()) === text) {
        deployState = 'live';
        return refresh();
      }
    } catch {}
    if (deployState !== 'deploying') { deployState = 'deploying'; refresh(); }
    await sleep(5000);
  }
  if (run === deployRun) { deployState = 'slow'; refresh(); }
}

// ================= Views =================

function show(view) {
  for (const v of ['loading', 'login', 'setup', 'dash']) $(v).hidden = v !== view;
  $('lock').hidden = view !== 'dash';
  if (view !== 'dash') $('publish-bar').hidden = true;
  scrollTo(0, 0);
}

async function start() {
  let file;
  try {
    file = await loadFile();
  } catch (e) {
    return say('loading', e.message, true);
  }
  sha = file && file.sha;
  if (file) {
    show('login');
    $('login-form').onsubmit = e => { e.preventDefault(); signIn(file); };
    $('start-over').onclick = () => {
      if (confirm('Start over? Once you publish, EVERY existing card stops working until it is rewritten with a new link.')) setUp(true);
    };
  } else {
    setUp(false);
  }
}

async function signIn(file) {
  const password = $('password').value.trim();
  if (!password) return;
  say('login-msg', 'Unlocking…');
  try {
    const data = JSON.parse(file.text);
    const key = await passwordKey(password, data.admin.salt, data.admin.iterations);
    let opened;
    try {
      opened = await openAdmin(key, data);
    } catch {
      return say('login-msg', 'Wrong password.', true);
    }
    admin = { key, salt: data.admin.salt, iterations: data.admin.iterations };
    $('password').value = '';
    say('login-msg', '');
    enterDashboard(opened, file.text);
  } catch (e) {
    say('login-msg', "Couldn't unlock: " + e.message, true);
  }
}

// First-time setup (or starting over): password, then GitHub token, then an empty dashboard.
function setUp(startingOver) {
  const cancel = startingOver ? () => show('login') : null;
  passwordStep('Set up · step 1 of 2', cancel, password => {
    tokenStep('Set up · step 2 of 2', cancel, async token => {
      say('token-msg', 'Setting up…');
      const salt = newSalt();
      admin = { key: await passwordKey(password, salt, ITERATIONS), salt, iterations: ITERATIONS };
      say('token-msg', '');
      enterDashboard({ github: { token, addedAt: today(), addedBy: myName() }, log: [], cards: [], data: emptyData() }, null);
    });
  });
}

function emptyData() {
  const contacts = Array.from({ length: 6 }, () => ({ id: newId(), name: '', role: '', phone: '' }));
  const every = [0, 1, 2, 3, 4, 5, 6];
  return {
    message: DEFAULT_MESSAGE,
    contacts,
    schedule: {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      fallback: contacts[0].id,
      shifts: [
        { name: '1st shift', start: '06:00', end: '14:00', days: [...every], people: [] },
        { name: '2nd shift', start: '14:00', end: '22:00', days: [...every], people: [] },
        { name: '3rd shift', start: '22:00', end: '06:00', days: [...every], people: [] },
        { name: 'Day (8–5)', start: '08:00', end: '17:00', days: [0, 1, 2, 3, 4], people: [] },
      ],
    },
  };
}

function passwordStep(stepLabel, cancel, done) {
  show('setup');
  $('setup-password').hidden = false;
  $('setup-token').hidden = true;
  $('setup-step').textContent = stepLabel;
  $('setup-cancel').hidden = !cancel;
  $('setup-cancel').onclick = cancel;
  let suggestion = suggestPassword();
  $('suggested').textContent = suggestion;
  $('own-password').value = '';
  $('pw-saved').checked = false;
  $('pw-next').disabled = true;
  say('pw-msg', '');
  $('suggest-again').onclick = () => { suggestion = suggestPassword(); $('suggested').textContent = suggestion; };
  $('copy-suggested').onclick = e => copy(suggestion, e.currentTarget);
  $('pw-saved').onchange = () => ($('pw-next').disabled = !$('pw-saved').checked);
  $('pw-next').onclick = () => {
    const own = $('own-password').value.trim();
    if (own && own.length < 20) return say('pw-msg', 'Your own password needs at least 20 characters, or clear it to use the suggested one.', true);
    done(own || suggestion);
  };
}

function tokenStep(stepLabel, cancel, done) {
  show('setup');
  $('setup-password').hidden = true;
  $('setup-token').hidden = false;
  $('setup-step').textContent = stepLabel;
  $('setup-cancel').hidden = !cancel;
  $('setup-cancel').onclick = cancel;
  $('token-input').value = '';
  say('token-msg', '');
  $('token-next').onclick = async () => {
    const token = $('token-input').value.trim();
    if (!/^(github_pat_|ghp_)\w+$/.test(token)) return say('token-msg', "That doesn't look like a GitHub token. It should start with github_pat_.", true);
    say('token-msg', 'Checking with GitHub…');
    const res = await fetch(`${API}/repos/${REPO}`, {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }, cache: 'no-store',
    }).catch(() => null);
    if (!res) return say('token-msg', "Couldn't reach GitHub. Check the internet connection and try again.", true);
    if (res.status === 401) return say('token-msg', 'GitHub says this token is not valid. Copy it again and paste it here.', true);
    if (!res.ok) return say('token-msg', `GitHub error ${res.status}. Check the token's repository access.`, true);
    done(token);
  };
}

function enterDashboard(opened, publishedText) {
  github = opened.github;
  log = opened.log || [];
  state = { ...opened.data, cards: opened.cards };
  published = publishedText ? { state: clone(state), text: publishedText, admin, github } : null;
  pending = new Set();
  deployState = published ? 'checking' : 'none';
  show('dash');
  $('my-name').value = myName();
  renderAll();
  checkGitHub();
  watchDeploy();
}

$('lock').onclick = () => location.reload(); // forgets every key (warns about unpublished changes)

addEventListener('beforeunload', e => {
  if (state && changes().length) { e.preventDefault(); e.returnValue = ''; }
});

// ================= Tabs =================

let tab = 'people';
for (const b of document.querySelectorAll('[data-tab]')) b.onclick = () => openTab(b.dataset.tab);

function openTab(name) {
  tab = name;
  for (const b of document.querySelectorAll('[data-tab]')) b.classList.toggle('active', b.dataset.tab === name);
  for (const p of document.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== name;
  renderTab();
}

function renderAll() {
  openTab(tab);
  refresh();
}

function renderTab() {
  ({ people: renderPeople, shifts: renderShifts, cards: renderCards, history: renderHistory, settings: renderSettings, help: () => {} })[tab]();
}

// ================= Status (top of the page) =================

function changes() {
  const out = [];
  if (!published) out.push('First publish: puts everything online');
  else {
    const before = published.state;
    const old = new Map(before.contacts.map(c => [c.id, c]));
    const now = new Set(state.contacts.map(c => c.id));
    for (const c of state.contacts) {
      const o = old.get(c.id);
      if (!o) out.push('Added ' + personName(c));
      else if (o.name !== c.name || o.role !== c.role || o.phone !== c.phone) out.push('Edited ' + personName(c));
    }
    for (const o of before.contacts) if (!now.has(o.id)) out.push('Removed ' + personName(o));
    if (before.message !== state.message) out.push('Changed the text message');
    if (JSON.stringify(before.schedule) !== JSON.stringify(state.schedule)) out.push('Changed shifts');
    const oldCards = new Map(before.cards.map(c => [c.key, c]));
    const nowCards = new Set(state.cards.map(c => c.key));
    for (const c of state.cards) {
      const o = oldCards.get(c.key);
      if (!o) out.push(`Added card: ${cardLabel(c)}`);
      else if (o.driver !== c.driver || o.note !== c.note) out.push(`Renamed card: ${cardLabel(c)}`);
    }
    for (const o of before.cards) if (!nowCards.has(o.key)) out.push(`Removed card: ${cardLabel(o)}`);
  }
  if (pending.has('password')) out.push('Changed the password');
  if (pending.has('token')) out.push('Replaced the GitHub token');
  return out;
}

function refresh() {
  if (!state) return;
  const list = changes();
  const badge = $('pub-badge');
  let label, cls, text;
  if (busy) [label, cls, text] = ['Publishing', 'updating', 'Saving to GitHub…'];
  else if (list.length && !published) [label, cls, text] = ['Not live yet', 'changes', 'Fill in People, Shifts and Cards, then Publish.'];
  else if (list.length) [label, cls, text] = ['Not published', 'changes', `${list.length} change${list.length > 1 ? 's' : ''} only you can see. Publish to update every card.`];
  else if (deployState === 'deploying') [label, cls, text] = ['Updating', 'updating', 'Published. Cards pick it up within about a minute.'];
  else if (deployState === 'slow') [label, cls, text] = ['Delayed', 'problem', 'Published, but the site is slow to update. It usually catches up within 10 minutes.'];
  else if (deployState === 'checking') [label, cls, text] = ['Checking', 'updating', 'Checking the live site…'];
  else [label, cls, text] = ['Live', 'live', 'Every card shows the latest version.'];
  badge.textContent = label;
  badge.className = 'badge ' + cls;
  $('pub-text').textContent = text;

  $('changes').hidden = !list.length;
  $('change-list').replaceChildren(...list.map(t => el('li', { textContent: t })));
  $('publish').disabled = $('discard').disabled = busy;
  $('discard').hidden = !published;
  $('publish-bar').hidden = !list.length;
  $('publish-bar-text').textContent = `${list.length} change${list.length > 1 ? 's' : ''} not published`;
  $('publish-bar-btn').disabled = busy;

  $('gh-problem').hidden = !ghProblem;
  $('gh-problem').textContent = ghProblem || '';

  renderNow();
  const last = log[log.length - 1];
  $('facts').textContent = [
    `${state.contacts.length} people`, `${state.cards.length} cards`,
    last && `last published ${when(last.at)}${last.who ? ' by ' + last.who : ''}`,
  ].filter(Boolean).join(' · ');
}

// Who the cards point to at this moment (with your unpublished changes included).
function renderNow() {
  const tz = state.schedule.timeZone;
  const now = yardNow(tz);
  $('now-time').textContent = `(yard time ${DAYS[now.day]} ${timeLabel(`${Math.floor(now.minutes / 60)}:${now.minutes % 60}`)})`;
  const ready = state.contacts.filter(c => c.name.trim());
  if (!ready.length) {
    $('now-main').textContent = 'Add people to see who the cards will call.';
    $('now-also').textContent = '';
    return;
  }
  const { main, also } = arrange({ contacts: ready, schedule: state.schedule }, now);
  $('now-main').textContent = `Big Call button: ${main.contact.name}` + (main.shift ? ` (${main.shift.name}, until ${timeLabel(main.shift.end)})` : ' (nobody is on shift, so the fallback person)');
  $('now-also').textContent = also.length ? 'Also working: ' + also.map(a => `${a.contact.name} (${a.shift.name})`).join(', ') : '';
}
setInterval(() => state && renderNow(), 30 * 1000);

// ================= People =================

function renderPeople() {
  $('people-list').replaceChildren(...state.contacts.map((c, i) => {
    const input = (label, key, extra = {}) => el('label', {}, label, el('input', {
      value: c[key], autocomplete: 'off', ...extra,
      oninput: e => { c[key] = e.target.value; refresh(); },
    }));
    return el('fieldset', { class: 'person' },
      el('legend', { textContent: `Person ${i + 1}` }),
      el('div', { class: 'field-row' },
        input('Name', 'name'),
        input('Role', 'role', { placeholder: 'e.g. 1st shift lead' })),
      input('Phone', 'phone', {
        type: 'tel', placeholder: '(555) 555-0100',
        onchange: e => { const p = normalizePhone(e.target.value); if (p) { c.phone = e.target.value = p; refresh(); } },
      }),
      el('button', { type: 'button', class: 'link-btn', textContent: 'Remove person', onclick: () => removePerson(c) }));
  }));
  $('add-person').disabled = state.contacts.length >= MAX_PEOPLE;
  $('message').value = state.message;
}

$('add-person').onclick = () => {
  state.contacts.push({ id: newId(), name: '', role: '', phone: '' });
  renderPeople();
  refresh();
  const boxes = document.querySelectorAll('#people-list fieldset');
  boxes[boxes.length - 1].querySelector('input').focus();
};

function removePerson(c) {
  if (!confirm(`Remove ${personName(c)}? They'll also be taken off every shift.`)) return;
  state.contacts = state.contacts.filter(x => x !== c);
  for (const s of state.schedule.shifts) s.people = s.people.filter(id => id !== c.id);
  if (state.schedule.fallback === c.id) state.schedule.fallback = state.contacts[0] ? state.contacts[0].id : null;
  renderPeople();
  refresh();
}

$('message').oninput = e => { state.message = e.target.value; refresh(); };

// ================= Shifts =================

function renderShifts() {
  const s = state.schedule;
  const all = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : COMMON_ZONES;
  const zones = [...new Set([s.timeZone, ...COMMON_ZONES, ...all])];
  $('tz').replaceChildren(...zones.map(z => el('option', { value: z, textContent: z.replace(/_/g, ' '), selected: z === s.timeZone })));
  $('shift-list').replaceChildren(...s.shifts.map(shiftBox));
  $('fallback').replaceChildren(...state.contacts.map(c => el('option', { value: c.id, textContent: personName(c), selected: c.id === s.fallback })));
  if (!$('preview-day').options.length) {
    const now = yardNow(s.timeZone);
    $('preview-day').replaceChildren(...DAYS.map((d, i) => el('option', { value: i, textContent: d, selected: i === now.day })));
  }
  renderPreview();
}

function shiftBox(shift) {
  const changed = () => { refresh(); renderPreview(); };
  const legend = el('legend', { textContent: shift.name || 'Shift' });
  return el('fieldset', { class: 'shift' },
    legend,
    el('label', {}, 'Name', el('input', { value: shift.name, oninput: e => { shift.name = e.target.value; legend.textContent = shift.name || 'Shift'; changed(); } })),
    el('div', { class: 'field-row' },
      el('label', {}, 'Starts', el('input', { type: 'time', value: shift.start, onchange: e => { if (e.target.value) shift.start = e.target.value; changed(); } })),
      el('label', {}, 'Ends', el('input', { type: 'time', value: shift.end, onchange: e => { if (e.target.value) shift.end = e.target.value; changed(); } }))),
    el('p', { class: 'eyebrow', textContent: 'Days' }),
    el('div', { class: 'chips' }, ...DAYS.map((d, i) => el('label', { class: 'chip' },
      el('input', { type: 'checkbox', checked: shift.days.includes(i), onchange: e => {
        shift.days = e.target.checked ? [...shift.days, i].sort() : shift.days.filter(x => x !== i);
        changed();
      } }), d))),
    el('p', { class: 'eyebrow', textContent: 'Who works it' }),
    state.contacts.length
      ? el('div', { class: 'chips' }, ...state.contacts.map(c => el('label', { class: 'chip' },
          el('input', { type: 'checkbox', checked: shift.people.includes(c.id), onchange: e => {
            shift.people = e.target.checked ? [...shift.people, c.id] : shift.people.filter(id => id !== c.id);
            changed();
          } }), personName(c))))
      : el('p', { class: 'small muted', textContent: 'Add people first.' }),
    el('button', { type: 'button', class: 'link-btn', textContent: 'Remove shift', onclick: () => {
      if (!confirm(`Remove ${shift.name || 'this shift'}?`)) return;
      state.schedule.shifts = state.schedule.shifts.filter(x => x !== shift);
      renderShifts();
      refresh();
    } }));
}

$('add-shift').onclick = () => {
  state.schedule.shifts.push({ name: 'New shift', start: '08:00', end: '16:00', days: [0, 1, 2, 3, 4], people: [] });
  renderShifts();
  refresh();
};
$('tz').onchange = e => { state.schedule.timeZone = e.target.value; refresh(); renderPreview(); };
$('fallback').onchange = e => { state.schedule.fallback = e.target.value; refresh(); renderPreview(); };
$('preview-day').onchange = $('preview-time').onchange = () => renderPreview();

// What a card would show at the chosen day and time.
function renderPreview() {
  const [h, m] = ($('preview-time').value || '15:00').split(':').map(Number);
  const ready = state.contacts.filter(c => c.name.trim());
  if (!ready.length) return $('preview').replaceChildren(el('li', { textContent: 'Add people first.' }));
  const { main, also, off } = arrange({ contacts: ready, schedule: state.schedule }, { day: Number($('preview-day').value), minutes: h * 60 + m });
  $('preview').replaceChildren(
    el('li', { class: 'preview-main' }, el('strong', { textContent: 'Big Call button: ' + main.contact.name }), main.shift ? ` (${main.shift.name})` : ' (fallback, nobody on shift)'),
    ...also.map(a => el('li', { textContent: `Also working: ${a.contact.name} (${a.shift.name})` })),
    ...off.map(o => el('li', { class: 'muted', textContent: `Off shift: ${o.contact.name}` })));
}

// ================= Cards =================

const cardLabel = c => c.driver + (c.note ? ` (${c.note})` : '');
const isLive = c => published && published.state.cards.some(p => p.key === c.key);

function renderCards() {
  $('card-list').replaceChildren(...state.cards.map(card => {
    const live = isLive(card);
    return el('li', {},
      el('div', {},
        el('strong', { textContent: card.driver }),
        el('span', { textContent: [card.note, 'added ' + card.added].filter(Boolean).join(' · ') }),
        el('span', { class: 'badge small ' + (live ? 'live' : 'changes'), textContent: live ? 'Active' : 'Not published yet' })),
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'btn btn-light btn-small', textContent: 'Link / QR', onclick: () => showCard(card) }),
        el('button', { type: 'button', class: 'btn btn-light btn-small', textContent: 'Rename', onclick: () => renameCard(card) }),
        el('button', { type: 'button', class: 'btn btn-danger btn-small', textContent: 'Remove', onclick: () => removeCard(card) })));
  }));
  $('card-count').textContent = state.cards.length;
  $('no-cards').hidden = state.cards.length > 0;
}

$('add-card').onclick = () => {
  const driver = $('new-driver').value.trim();
  if (!driver) return say('card-msg', 'Enter the driver name and ID first.', true);
  const card = { driver, note: $('new-note').value.trim(), key: newKey(), added: today() };
  state.cards.push(card);
  $('new-driver').value = $('new-note').value = '';
  say('card-msg', '');
  renderCards();
  refresh();
  showCard(card);
};

function renameCard(card) {
  const driver = prompt('Driver name and ID (shown on the page):', card.driver);
  if (driver === null || !driver.trim()) return;
  const note = prompt('Who has this card? (only shown here)', card.note);
  card.driver = driver.trim();
  if (note !== null) card.note = note.trim();
  renderCards();
  refresh();
  if ($('card-out').dataset.key === card.key) showCard(card);
}

function removeCard(card) {
  if (!confirm(`Remove the card for ${cardLabel(card)}? Once you publish, that card stops working for good.`)) return;
  state.cards = state.cards.filter(c => c !== card);
  if ($('card-out').dataset.key === card.key) $('card-out').hidden = true;
  renderCards();
  refresh();
}

function showCard(card) {
  const link = SITE + '#' + card.key;
  const fileName = 'card-' + (card.driver + ' ' + card.note).trim().replace(/[^\w-]+/g, '-');
  $('card-out').dataset.key = card.key;
  $('card-out-title').textContent = cardLabel(card);
  $('card-out-status').textContent = isLive(card) ? 'Active.' : 'Starts working once you publish.';
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

// One black square per dark module, on white. 1 unit = 1 module.
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

// ================= History =================

function renderHistory() {
  $('history-list').replaceChildren(...log.slice().reverse().map(entry => el('li', {},
    el('p', { class: 'eyebrow', textContent: `${when(entry.at)}${entry.who ? ' · ' + entry.who : ''}` }),
    el('ul', {}, ...entry.what.map(t => el('li', { textContent: t }))))));
  $('no-history').hidden = log.length > 0;
}

// ================= Settings =================

function renderSettings() {
  $('gh-status').textContent = (ghProblem ? ghProblem + ' ' : 'Connected. ') +
    `Token added ${github.addedAt}${github.addedBy ? ' by ' + github.addedBy : ''}${pending.has('token') ? ' (not published yet)' : ''}.`;
}

$('my-name').oninput = e => setMyName(e.target.value.trim());

$('replace-token').onclick = () => {
  tokenStep('Replace GitHub token', () => { show('dash'); renderAll(); }, token => {
    github = { token, addedAt: today(), addedBy: myName() };
    pending.add('token');
    ghProblem = null;
    show('dash');
    renderAll();
  });
};

$('change-password').onclick = () => {
  const revoke = $('pw-revoke').checked;
  const back = () => { show('dash'); renderAll(); };
  passwordStep(revoke ? 'Change password · step 1 of 2' : 'Change password', back, password => {
    const finish = async () => {
      const salt = newSalt();
      admin = { key: await passwordKey(password, salt, ITERATIONS), salt, iterations: ITERATIONS };
      pending.add('password');
      $('pw-revoke').checked = false;
      back();
      if (revoke) alert('After you publish, delete the OLD token on GitHub: Settings → Developer settings → Fine-grained tokens → old "Emergency cards dashboard" token → Delete.');
    };
    if (!revoke) return finish();
    tokenStep('Change password · step 2 of 2: new GitHub token', back, token => {
      github = { token, addedAt: today(), addedBy: myName() };
      pending.add('token');
      finish();
    });
  });
};

// ================= Publish =================

function problems() {
  const out = []; // [tab, message]
  if (!state.contacts.length) out.push(['people', 'Add at least one person.']);
  state.contacts.forEach((c, i) => {
    const who = c.name.trim() || `Person ${i + 1}`;
    if (!c.name.trim()) out.push(['people', `Person ${i + 1} needs a name.`]);
    if (!normalizePhone(c.phone)) out.push(['people', `${who} needs a 10-digit US phone number.`]);
  });
  const phones = state.contacts.map(c => normalizePhone(c.phone)).filter(Boolean);
  if (new Set(phones).size !== phones.length) out.push(['people', 'Two people have the same phone number.']);
  if (!state.message.trim()) out.push(['people', 'Write the text message.']);
  for (const s of state.schedule.shifts) {
    if (!s.name.trim()) out.push(['shifts', 'Every shift needs a name.']);
    if (!s.days.length) out.push(['shifts', `${s.name || 'A shift'} has no days ticked.`]);
  }
  return out;
}

async function publish() {
  const issues = problems();
  if (issues.length) {
    openTab(issues[0][0]);
    return say('publish-msg', 'Fix these first: ' + issues.map(i => i[1]).join(' '), true);
  }
  let who = myName();
  if (!who) {
    who = (prompt('Your name, for the History tab:') || '').trim();
    if (!who) return;
    setMyName(who);
    $('my-name').value = who;
  }
  const what = changes();
  busy = true;
  say('publish-msg', '');
  refresh();
  try {
    const data = {
      message: state.message.trim(),
      contacts: state.contacts.map(c => ({ id: c.id, name: c.name.trim(), role: c.role.trim(), phone: normalizePhone(c.phone) })),
      schedule: { ...state.schedule, fallback: state.contacts.some(c => c.id === state.schedule.fallback) ? state.schedule.fallback : state.contacts[0].id },
    };
    const newLog = [...log, { at: new Date().toISOString(), who, what }].slice(-200);
    const file = await buildFile(admin, { data, cards: state.cards, extra: { github, log: newLog } });
    // Double-check before sending: the new file opens with the password and with every card.
    await openAdmin(admin.key, file);
    for (const card of state.cards) await openCard(card.key, file);
    const text = JSON.stringify(file, null, 2) + '\n';

    const res = await gh(`/repos/${REPO}/contents/${FILE}`, {
      method: 'PUT',
      // A plain message on purpose: commit messages are public, so no names in them.
      body: { message: 'Update emergency card data', content: btoa(text), branch: 'main', ...(sha ? { sha } : {}) },
    });
    if (!res.ok) throw new Error(publishError(res.status));
    sha = (await res.json()).content.sha;

    log = newLog;
    pending.clear();
    state = { ...data, cards: state.cards };
    published = { state: clone(state), text, admin, github };
    deployState = 'deploying';
    ghProblem = null;
    busy = false;
    renderAll();
    watchDeploy();
  } catch (e) {
    busy = false;
    say('publish-msg', e.message, true);
    refresh();
  }
}

$('publish').onclick = $('publish-bar-btn').onclick = () => { if (!busy) publish(); };

$('discard').onclick = () => {
  if (!confirm('Throw away all changes that are not published?')) return;
  state = clone(published.state);
  ({ admin, github } = published);
  pending.clear();
  say('publish-msg', '');
  $('card-out').hidden = true;
  renderAll();
};

start();
