// dashboard.js — the admin dashboard (dashboard.html).
// Sign in with the shared password → edit people, shifts and cards → Publish.
// Publish saves the encrypted contacts.enc.json straight to GitHub, using the GitHub
// token that is stored (encrypted) inside that same file. Nothing is kept in this
// browser except your name for the History tab.
//
// Supervisors use dashboard.html. The site owner opens dashboard.html#owner, which adds
// the Owner tab (GitHub token, recovery code) and the password reset on the sign-in screen.

const REPO = 'TenarisMcCarty/SUCH-Emergency-Contacts';
const API = 'https://api.github.com';
const FILE = 'contacts.enc.json';
const ITERATIONS = 600000; // password stretching: makes guessing the password very slow
const MAX_PEOPLE = 10;
const DEFAULT_MESSAGE = 'EMERGENCY – need to reach driver {driver}. Please call me back at this number.';
const SITE = new URL('./', location.href).href; // card links point at the emergency page next to this one
const COMMON_ZONES = ['America/Chicago', 'America/New_York', 'America/Denver', 'America/Los_Angeles', 'America/Mexico_City'];
const OWNER = location.hash === '#owner';

const $ = id => document.getElementById(id);

// Everything below lives only in this tab's memory.
let admin = null;       // { key, salt, iterations } made from the password
let github = null;      // { token, addedAt, addedBy }
let owner = null;       // { contact, pub, at } — the site owner's contact and recovery public key
let state = null;       // what you're editing: { message, contacts, schedule, backup, cards }
let published = null;   // { state, text, admin, github, owner } as last published (null = never published)
                        // (admin is null right after an upgrade or password reset: the old key isn't known)
let sha = null;         // GitHub's id for the current file (needed to replace it)
let log = [];           // change history
let pending = new Set(); // changes that aren't in `state`: upgrade, reset, password, token, recovery
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
const askOwner = () => (OWNER ? 'Fix it in the Owner tab.' : `Ask the site owner${owner && owner.contact ? ` (${owner.contact})` : ''} to fix it.`);

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

// Hand a file to the browser to save.
function saveFile(name, blob) {
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60 * 1000);
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

// "+15555550100" → "555-555-0100" (how it's printed on cards)
const formatPhone = p => (p ? p.slice(2).replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') : '');

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

async function setPassword(password) {
  const salt = newSalt();
  admin = { key: await passwordKey(password, salt, ITERATIONS), salt, iterations: ITERATIONS };
}

// ================= GitHub =================

async function gh(path, { method = 'GET', body, timeout = 0 } = {}) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (github) headers.Authorization = 'Bearer ' + github.token;
  if (body) headers['Content-Type'] = 'application/json';
  const stop = new AbortController();
  if (timeout) setTimeout(() => stop.abort(), timeout);
  return fetch(API + path, { method, headers, body: body && JSON.stringify(body), cache: 'no-store', signal: stop.signal });
}

// The latest saved file → { text, sha }, or null if there isn't one yet.
async function loadFile() {
  try { // straight from GitHub: always the newest version (the repo is public, so no sign-in needed)
    const res = await gh(`/repos/${REPO}/contents/${FILE}?ref=main`, { timeout: 8000 });
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
  if (status === 401) return `Nothing was published: the site's GitHub connection has expired. ${askOwner()}`;
  if (status === 403 || status === 404) return `Nothing was published: the site's GitHub connection isn't allowed to save. ${askOwner()}`;
  if (status === 409 || status === 422) return 'Someone else published changes since you signed in, so yours were NOT published. Note your changes, Lock, sign in again and redo them.';
  return `GitHub error ${status}. Nothing was published. Try again in a minute.`;
}

// Check the token works and that nobody has published since we loaded.
async function checkGitHub() {
  try {
    const res = await gh(`/repos/${REPO}/contents/${FILE}?ref=main`);
    if (res.status === 401) ghProblem = `Publishing won't work right now: the site's GitHub connection has expired. ${askOwner()}`;
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

$('owner-flag').hidden = !OWNER;
$('lost-owner').hidden = !OWNER;
$('lost-supervisor').hidden = OWNER;
document.querySelector('[data-tab="owner"]').hidden = !OWNER;

async function start() {
  let file;
  try {
    file = await loadFile();
  } catch (e) {
    return say('loading', e.message, true);
  }
  sha = file && file.sha;
  if (!file) return setUp(false);
  show('login');
  if (!JSON.parse(file.text).admin.salt) { // saved by the first version, which used an admin key
    $('login-title').textContent = 'Upgrade';
    $('login-intro').hidden = false;
    $('password-label').textContent = 'Old admin key';
  }
  $('login-form').onsubmit = e => { e.preventDefault(); signIn(file); };
  $('use-recovery').onclick = () => resetWithRecovery(file);
  $('start-over').onclick = () => {
    if (confirm('Start over? Once you publish, EVERY existing card stops working until it is rewritten with a new link.')) setUp(true);
  };
}

async function signIn(file) {
  const password = $('password').value.trim();
  if (!password) return;
  say('login-msg', 'Unlocking…');
  try {
    const data = JSON.parse(file.text);
    if (!data.admin.salt) return upgrade(password, file);
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

// Owner: forgot password → open with the recovery code → choose a new password. Cards keep working.
async function resetWithRecovery(file) {
  const code = $('recovery-input').value.trim();
  if (!code) return;
  say('recovery-msg', 'Checking…');
  let opened;
  try {
    opened = await openRecovery(code, JSON.parse(file.text));
  } catch (e) {
    return say('recovery-msg', /no recovery/.test(e.message) ? e.message : 'Wrong recovery code.', true);
  }
  $('recovery-input').value = '';
  say('recovery-msg', '');
  passwordStep('Reset the password', () => show('login'), async password => {
    await setPassword(password);
    enterDashboard(opened, file.text);
    published.admin = null; // the old password isn't known, so Discard keeps the new one
    pending.add('reset');
    refresh();
  }, { warning: true });
}

// First-time setup (or starting over): password, GitHub token, recovery code, then an empty dashboard.
function setUp(startingOver) {
  const cancel = startingOver ? () => show('login') : null;
  passwordStep('Set up · step 1 of 3', cancel, password => {
    tokenStep('Set up · step 2 of 3', cancel, token => {
      recoveryStep('Set up · step 3 of 3', cancel, async rec => {
        await setPassword(password);
        enterDashboard({ github: { token, addedAt: today(), addedBy: myName() }, owner: rec, log: [], cards: [], data: emptyData() }, null);
      });
    });
  });
}

// First version → this one: open with the old admin key, choose a password, connect GitHub, save a
// recovery code. Contacts and cards carry over unchanged, so cards already written keep working.
async function upgrade(oldKey, file) {
  if (!isKey(oldKey)) return say('login-msg', 'Enter the 22-character admin key from the old editor.', true);
  let opened;
  try {
    opened = await openAdmin(oldKey, JSON.parse(file.text));
  } catch {
    return say('login-msg', 'Wrong admin key.', true);
  }
  $('password').value = '';
  say('login-msg', '');
  const data = withSchedule(opened.data);
  data.schedule = { ...emptyData().schedule, fallback: data.schedule.fallback };
  data.backup = '';
  delete data.primary;
  const back = () => show('login');
  passwordStep('Upgrade · step 1 of 3', back, password => {
    tokenStep('Upgrade · step 2 of 3', back, token => {
      recoveryStep('Upgrade · step 3 of 3', back, async rec => {
        await setPassword(password);
        const cards = opened.cards.map(c => ({ note: '', ...c }));
        enterDashboard({ github: { token, addedAt: today(), addedBy: myName() }, owner: rec, log: [], cards, data }, file.text);
        published.admin = null;
        pending.add('upgrade');
        refresh();
      });
    });
  });
}

function emptyData() {
  const contacts = Array.from({ length: 6 }, () => ({ id: newId(), name: '', role: '', phone: '' }));
  const every = [0, 1, 2, 3, 4, 5, 6];
  return {
    message: DEFAULT_MESSAGE,
    contacts,
    backup: '',
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

function showStep(id, label, cancel) {
  show('setup');
  for (const s of ['setup-password', 'setup-token', 'setup-recovery']) $(s).hidden = s !== id;
  $('setup-step').textContent = label;
  $('setup-cancel').hidden = !cancel;
  $('setup-cancel').onclick = cancel;
}

function passwordStep(label, cancel, done, { warning = false } = {}) {
  showStep('setup-password', label, cancel);
  $('pw-intro').hidden = warning;
  $('pw-warning').hidden = !warning;
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
    say('pw-msg', 'Saving…');
    done(own || suggestion);
  };
}

function tokenStep(label, cancel, done) {
  showStep('setup-token', label, cancel);
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
    say('token-msg', '');
    done(token);
  };
}

function recoveryStep(label, cancel, done) {
  showStep('setup-recovery', label, cancel);
  $('recovery-code').textContent = 'Making…';
  $('recovery-saved').checked = false;
  $('recovery-next').disabled = true;
  $('setup-contact').value = (owner && owner.contact) || '';
  newRecovery().then(rec => {
    $('recovery-code').textContent = rec.code;
    $('copy-recovery').onclick = e => copy(rec.code, e.currentTarget);
    $('recovery-saved').onchange = () => ($('recovery-next').disabled = !$('recovery-saved').checked);
    $('recovery-next').onclick = () => done({ contact: $('setup-contact').value.trim(), pub: rec.pub, at: today() });
  });
}

function enterDashboard(opened, publishedText) {
  github = opened.github;
  owner = opened.owner || null;
  log = opened.log || [];
  state = { backup: '', ...opened.data, cards: opened.cards };
  published = publishedText ? { state: clone(state), text: publishedText, admin, github, owner: clone(owner) } : null;
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
  ({
    people: renderPeople, shifts: renderShifts, cards: renderCards, print: renderPrint,
    history: renderHistory, settings: () => {}, help: () => {}, owner: renderOwner,
  })[tab]();
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
    if ((before.backup || '') !== (state.backup || '')) out.push('Changed the backup line');
    const oldCards = new Map(before.cards.map(c => [c.key, c]));
    const nowCards = new Set(state.cards.map(c => c.key));
    for (const c of state.cards) {
      const o = oldCards.get(c.key);
      if (!o) out.push(`Added card: ${cardLabel(c)}`);
      else if (o.driver !== c.driver || o.note !== c.note) out.push(`Renamed card: ${cardLabel(c)}`);
    }
    for (const o of before.cards) if (!nowCards.has(o.key)) out.push(`Removed card: ${cardLabel(o)}`);
    if (((published.owner && published.owner.contact) || '') !== ((owner && owner.contact) || '')) out.push('Changed the owner contact');
  }
  if (pending.has('upgrade')) out.push('Upgrade from the first version: new password, GitHub connection, recovery code and shifts');
  if (pending.has('reset')) out.push('Password reset with the recovery code');
  if (pending.has('password')) out.push('Changed the password');
  if (pending.has('token')) out.push('Replaced the GitHub token');
  if (pending.has('recovery')) out.push('Made a new recovery code');
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
        el('button', { type: 'button', class: 'btn btn-light btn-small', textContent: 'Print & QR', onclick: () => openPrint(card) }),
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
  say('card-msg', `Added. Publish to switch it on, then get its files in Print & QR.`);
  renderCards();
  refresh();
};

function renameCard(card) {
  const driver = prompt('Driver name and ID (printed on the card and shown on the page):', card.driver);
  if (driver === null || !driver.trim()) return;
  const note = prompt('Who has this card? (only shown here)', card.note);
  card.driver = driver.trim();
  if (note !== null) card.note = note.trim();
  renderCards();
  refresh();
}

function removeCard(card) {
  if (!confirm(`Remove the card for ${cardLabel(card)}? Once you publish, that card stops working for good.`)) return;
  state.cards = state.cards.filter(c => c !== card);
  renderCards();
  refresh();
}

// ================= Print & QR =================

let printKey = null; // which card the Print & QR tab shows

function openPrint(card) {
  printKey = card.key;
  openTab('print');
}

const printCard = () => state.cards.find(c => c.key === printKey);
const printInfo = card => ({ link: SITE + '#' + card.key, driver: card.driver, backup: formatPhone(state.backup) });
const tagThickness = () => Number($('tag-thickness').value);

function renderPrint() {
  const has = state.cards.length > 0;
  $('print-empty').hidden = has;
  $('print-body').hidden = !has;
  if (!has) return;
  if (!printCard()) printKey = state.cards[state.cards.length - 1].key;
  $('print-card').replaceChildren(...state.cards.map(c => el('option', { value: c.key, textContent: cardLabel(c), selected: c.key === printKey })));
  $('backup').value = formatPhone(state.backup);
  renderPrintCard();
}

let printRun = 0;
async function renderPrintCard() {
  const run = ++printRun;
  const card = printCard();
  $('card-link').value = SITE + '#' + card.key;
  $('print-status').hidden = isLive(card);
  $('print-status').textContent = "This card isn't published yet. Its link and files only work after you publish.";
  $('print-msg').hidden = true;
  try {
    await CardMaker.load();
    if (run !== printRun) return;
    const info = printInfo(card);
    const { problems } = CardMaker.layout(info, '3d');
    $('preview-front').replaceChildren(CardMaker.preview(info, 'front'));
    $('preview-back').replaceChildren(CardMaker.preview(info, 'back'));
    if (problems.length) printProblem(problems.join(' '));
    for (const id of ['dl-black', 'dl-white', 'dl-notes']) $(id).disabled = problems.length > 0;
  } catch (e) {
    printProblem(e.message);
  }
}

function printProblem(text) {
  $('print-msg').textContent = text;
  $('print-msg').hidden = false;
}

$('print-card').onchange = e => { printKey = e.target.value; renderPrintCard(); };
$('backup').onchange = e => {
  const p = e.target.value.trim() ? normalizePhone(e.target.value) : '';
  if (p === null) return printProblem('The backup line needs a 10-digit US phone number.');
  state.backup = p;
  e.target.value = formatPhone(p);
  refresh();
  renderPrintCard();
};
$('copy-card-link').onclick = e => copy($('card-link').value, e.currentTarget);

// Make one file (or all of them) for the chosen card and hand it to the browser.
async function download(what) {
  const card = printCard();
  const info = printInfo(card);
  const base = 'card-' + CardMaker.slug(card.driver + (card.note ? ' ' + card.note : ''));
  $('print-msg').hidden = true;
  try {
    await CardMaker.load();
    if (what === 'all') return saveFile(base + '.zip', CardMaker.zip(await CardMaker.files(info, tagThickness())));
    if (what === 'black' || what === 'white' || what === 'notes') {
      const m = CardMaker.model(info, tagThickness());
      if (what === 'notes') return saveFile(base + '-print-notes.txt', new Blob([CardMaker.printNotes(info, m)], { type: 'text/plain' }));
      return saveFile(`${base}-${what.toUpperCase()}.stl`, new Blob([m[what]], { type: 'model/stl' }));
    }
    if (what === 'paper') return saveFile(base + '-paper-card.pdf', await CardMaker.paperPdf(info));
    if (what === 'label') return saveFile(base + '-qr-label.png', await CardMaker.canvasBlob(CardMaker.labelCanvas(info)));
    if (what === 'qr-png') return saveFile(base + '-qr.png', await CardMaker.canvasBlob(CardMaker.qrCanvas(info.link)));
    if (what === 'qr-svg') return saveFile(base + '-qr.svg', new Blob([CardMaker.qrSvg(info.link)], { type: 'image/svg+xml' }));
  } catch (e) {
    printProblem(e.message);
  }
}

for (const [id, what] of [['dl-all', 'all'], ['dl-black', 'black'], ['dl-white', 'white'], ['dl-notes', 'notes'],
  ['dl-paper', 'paper'], ['dl-label', 'label'], ['dl-qr-png', 'qr-png'], ['dl-qr-svg', 'qr-svg']]) {
  $(id).onclick = () => download(what);
}

// ================= History =================

function renderHistory() {
  $('history-list').replaceChildren(...log.slice().reverse().map(entry => el('li', {},
    el('p', { class: 'eyebrow', textContent: `${when(entry.at)}${entry.who ? ' · ' + entry.who : ''}` }),
    el('ul', {}, ...entry.what.map(t => el('li', { textContent: t }))))));
  $('no-history').hidden = log.length > 0;
}

// ================= Settings (everyone) =================

const backToDash = () => { show('dash'); renderAll(); };

$('my-name').oninput = e => setMyName(e.target.value.trim());

$('change-password').onclick = () => {
  passwordStep('Change password', backToDash, async password => {
    await setPassword(password);
    pending.add('password');
    backToDash();
  }, { warning: true });
};

// ================= Owner tab =================

function renderOwner() {
  $('gh-status').textContent = (ghProblem ? ghProblem + ' ' : 'Connected. ') +
    `Token added ${github.addedAt}${github.addedBy ? ' by ' + github.addedBy : ''}${pending.has('token') ? ' (not published yet)' : ''}.`;
  $('recovery-status').textContent = owner && owner.pub
    ? `Set up ${owner.at || ''}${pending.has('recovery') || pending.has('upgrade') ? ' (not published yet)' : ''}. Keep it in your password manager.`
    : 'No recovery code yet. Make one so you can always reset a lost password.';
  $('owner-contact').value = (owner && owner.contact) || '';
}

$('owner-contact').oninput = e => { owner = { ...(owner || {}), contact: e.target.value.trim() }; refresh(); };

$('replace-token').onclick = () => {
  tokenStep('Replace GitHub token', backToDash, token => {
    github = { token, addedAt: today(), addedBy: myName() };
    pending.add('token');
    ghProblem = null;
    backToDash();
  });
};

$('new-recovery').onclick = () => {
  recoveryStep('New recovery code', backToDash, rec => {
    owner = rec;
    pending.add('recovery');
    backToDash();
  });
};

$('revoke-access').onclick = () => {
  passwordStep('Take away access · step 1 of 2', backToDash, password => {
    tokenStep('Take away access · step 2 of 2', backToDash, async token => {
      await setPassword(password);
      github = { token, addedAt: today(), addedBy: myName() };
      pending.add('password');
      pending.add('token');
      backToDash();
      alert('After you publish, delete the OLD token on GitHub: Settings → Developer settings → Fine-grained tokens → the old "Emergency cards dashboard" token → Delete.');
    });
  }, { warning: true });
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
    if (!who) {
      openTab('settings');
      return say('publish-msg', 'Add your name first (Settings → Your name), so History shows who published.', true);
    }
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
      backup: state.backup || '',
    };
    const newLog = [...log, { at: new Date().toISOString(), who, what }].slice(-200);
    const file = await buildFile(admin, { data, cards: state.cards, extra: { github, owner, log: newLog } });
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
    published = { state: clone(state), text, admin, github, owner: clone(owner) };
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
  owner = clone(published.owner);
  if (published.admin) {
    ({ admin, github } = published);
    pending.clear();
  } else {
    // After an upgrade or password reset the new password is needed to publish, so keep it.
    pending = new Set([...pending].filter(p => p === 'upgrade' || p === 'reset'));
  }
  say('publish-msg', '');
  renderAll();
};

start();
