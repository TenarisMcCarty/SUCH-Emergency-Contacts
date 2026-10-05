// dashboard.js — the admin dashboard (dashboard.html).
// Sign in → edit people, shifts and cards → Publish.
// Publish saves the encrypted contacts.enc.json straight to GitHub, using the GitHub
// token that is stored (encrypted) inside that same file. Nothing is kept in this
// browser except your name for the History tab (shared-password and owner sign-ins).
//
// Supervisors use dashboard.html with their own email and password (or, until the owner switches it
// off, the shared supervisors' password with Email left empty). The site owner opens dashboard.html#owner
// and signs in with their own owner password (or recovery code); only then does the Owner tab
// (people who can sign in, shared password, GitHub token, owner password, recovery code) appear.

// The repository this copy of the site is published from: the live site, or the test copy ("-staging").
const REPO = 'TenarisMcCarty/' + (location.hostname.endsWith('.github.io') ? location.pathname.split('/')[1] : 'SUCH-Emergency-Contacts');
const API = 'https://api.github.com';
const FILE = 'contacts.enc.json';
const ITERATIONS = 600000; // password stretching: makes guessing the password very slow
const MAX_PEOPLE = 10;
const CHECK_DAYS = 90; // ask supervisors to re-check each phone number this often
const DEFAULT_MESSAGE = 'EMERGENCY – need to reach driver {driver}. Please call me back at this number.';
const DEFAULT_MESSAGE_ES = 'EMERGENCIA – necesito comunicarme con el conductor {driver}. Por favor llámeme a este número.';
const SITE = new URL('./', location.href).href; // card links point at the emergency page next to this one
const OWNER = location.hash === '#owner'; // the owner link: shows the owner sign-in
const RESET_TO = 'salil@tenaris.com'; // "Forgot password?" emails go here

const $ = id => document.getElementById(id);
// For a few minutes after an update, GitHub's cache can pair this script with an older dashboard.html,
// so elements added for personal sign-ins are optional.
const onClick = (id, fn) => { if ($(id)) $(id).onclick = fn; };
const showIf = (id, on) => { if ($(id)) $(id).hidden = !on; };

// Everything below lives only in this tab's memory.
let role = 'supervisor'; // 'owner' after signing in with the owner password, recovery code or setup
let me = '';            // your email if you signed in with your own sign-in ('' = shared password or owner)
let shared = null;      // the shared supervisors' password: { pub, login } (a key pair, private half locked
                        // with the password), or null when switched off
let accounts = [];      // people with their own sign-in: [{ email, name, pub, login, mustChange, addedAt, addedBy }]
const keyRing = new Map(); // private keys this tab knows, by public key x (for the check before publishing)
let tokenAdvice = '';   // why the GitHub token should be replaced (after removing someone), shown in the Owner tab
let ownerAuth = null;   // owner session only: { key, salt, iterations } made from the owner password
let ownerCode = null;   // owner session only: the recovery code (never published in readable form)
let mustPublish = false; // the session began with changes that can't be discarded
let github = null;      // { token, addedAt, addedBy }
let owner = null;       // { contact, pub, at, login } — owner's contact, recovery public key, locked owner login
let state = null;       // what you're editing: { message, contacts, schedule, backup, cards }
let published = null;   // { state, text, github, owner, shared, accounts, … } as last published (null = never published)
                        // (shared is undefined when the file didn't say: very old data)
let sha = null;         // GitHub's id for the current file (needed to replace it)
let log = [];           // change history
let pending = new Set(); // changes that aren't in `state`: upgrade, owner access, password, token, recovery
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
// Today's date in Houston, e.g. "2026-10-05". (Not toISOString: that's the UTC date, a day ahead every evening.)
function houstonDate(date) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: YARD_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}
const today = () => houstonDate(new Date());
const when = iso => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const personName = c => c.name.trim() || 'a supervisor with no name';
const daysSince = iso => Math.floor((Date.parse(today()) - Date.parse(iso)) / 864e5);
const dateLabel = iso => (/^\d{4}-\d\d-\d\d$/.test(iso || '') ? new Date(iso + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : iso || '');
const isDue = c => c.phone && daysSince(c.confirmed) >= CHECK_DAYS;
const isDate = d => /^\d{4}-\d\d-\d\d$/.test(d || '');
const shortDate = iso => (isDate(iso) ? new Date(iso + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric' }) : '');
// "Oct 10 – Oct 14, 2026", "Oct 10, 2026"
const rangeLabel = (from, to) => (!isDate(from) || !isDate(to) ? 'dates not set'
  : from === to ? dateLabel(from)
  : from.slice(0, 4) === to.slice(0, 4) ? `${shortDate(from)} – ${dateLabel(to)}` : `${dateLabel(from)} – ${dateLabel(to)}`);
// Time off needs a schedule.js that knows it. (For a few minutes after an update, an older cached one may load.)
const TIME_OFF = typeof awayOn === 'function' && typeof addDays === 'function';
// Time off that hasn't ended, each entry with an id: [{ id, who, from, to, cover }].
const currentAway = list => (list || []).filter(a => a && !(isDate(a.to) && a.to < today()))
  .map(a => ({ id: a.id || newId(), who: a.who || '', from: a.from || '', to: a.to || '', cover: a.cover || '' }));
const askOwner = () => (role === 'owner' ? 'Fix it in the Owner tab.' : `Ask the site owner${owner && owner.contact ? ` (${owner.contact})` : ''} to fix it.`);

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
// A saved number the way people write it; anything else (half-typed) as typed.
const showPhone = p => (/^\+1\d{10}$/.test(p || '') ? formatPhone(p) : p || '');

// Passwords people choose: at least 10 characters, with at least one number and one symbol (owner's choice;
// 8 until 2026-10-05). Only checked when a password is chosen, so older, shorter ones keep working.
const PASSWORD_RULE = 'at least 10 characters, with a number and a symbol';
const passwordOk = pw => pw.length >= 10 && /\d/.test(pw) && /[^\p{L}\p{N}\s]/u.test(pw);

// A random whole number below `max`. Rejection sampling keeps every value equally likely.
function randomBelow(max) {
  const limit = Math.floor(2 ** 32 / max) * max;
  for (;;) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0];
    if (n < limit) return n % max;
  }
}

// A suggested or temporary password: five random HSE words (words.js), two digits and a symbol, e.g.
// "harness-bayou-muster-flange-teamwork-47!" (about 55 bits): easy to read out, very slow to guess.
// People may still choose a shorter password of their own (PASSWORD_RULE).
function suggestPassword() {
  const list = typeof HSE_WORDS !== 'undefined' ? HSE_WORDS : WORDS; // an older cached words.js has only WORDS
  const words = new Set();
  while (words.size < 5) words.add(list[randomBelow(list.length)]); // five different words
  return `${[...words].join('-')}-${randomBelow(10)}${randomBelow(10)}${'!#$%&*?@'[randomBelow(8)]}`;
}

// A new sign-in for a password: a new key pair, its private half locked with the password → { pub, login }.
// (A new pair every time, so an old password, still in the repository history, opens nothing published later.)
async function makeSignIn(password) {
  const salt = newSalt();
  const s = await newSignIn({ key: await passwordKey(password, salt, ITERATIONS), salt, iterations: ITERATIONS });
  keyRing.set(s.pub.x, s.d);
  return { pub: s.pub, login: s.login };
}

// A new shared supervisors' password (also switches it back on).
async function setPassword(password) {
  shared = await makeSignIn(password);
}

// The email typed on a sign-in screen, lower case: '' = none (the shared password), null = not an email address.
// "Emergency Cards" is what password managers saved as the user name before there were personal sign-ins.
function typedEmail(id = 'email') {
  const text = $(id) ? $(id).value.trim().toLowerCase() : '';
  if (!text || text === 'emergency cards') return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : null;
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
let ghRun = 0; // a check that started before the latest publish is out of date when it answers
async function checkGitHub() {
  const run = ++ghRun;
  try {
    const res = await gh(`/repos/${REPO}/contents/${FILE}?ref=main`, { timeout: 15000 });
    if (run !== ghRun) return;
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
    if (run !== ghRun) return;
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

$('lost-owner').hidden = !OWNER;
// For a few minutes after an update, GitHub's cache can pair this script with an older page or
// schedule.js, so the test-site label and yard address are optional here.
const TEST = typeof TEST_SITE !== 'undefined' && TEST_SITE;
if ($('test-flag')) $('test-flag').hidden = !TEST;
if ($('repo-name')) $('repo-name').textContent = REPO.split('/')[1];
if (TEST) document.title = 'Test · ' + document.title;
showIf('forgot-row', !OWNER);

// "Forgot password?" writes an email to the site owner asking for a reset, for the email typed above.
function updateForgot() {
  if (!$('forgot')) return;
  const email = $('email') ? $('email').value.trim() : '';
  const subject = 'Emergency Cards: password reset' + (email ? ' for ' + email : '');
  const body = `Hello,\n\nPlease reset my Emergency Cards dashboard password.\n\nMy email: ${email || '(the email I sign in with)'}\n\nThank you.`;
  $('forgot').href = `mailto:${RESET_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
if ($('email')) $('email').addEventListener('input', updateForgot);
updateForgot();

// The Owner tab and badge appear only after signing in as the owner (owner password, recovery code or setup).
function applyRole() {
  $('owner-flag').hidden = role !== 'owner';
  document.querySelector('[data-tab="owner"]').hidden = role !== 'owner';
}

const OWNER_PW_INTRO = 'For the owner link only.';

async function start() {
  if (typeof buildFile4 !== 'function') { // an older cached crypto.js, right after an update
    return say('loading', 'The dashboard was just updated. Wait a few minutes, then reload this page.', true);
  }
  let file;
  try {
    file = await loadFile();
  } catch (e) {
    return say('loading', e.message, true);
  }
  sha = file && file.sha;
  if (!file) return setUp(false);
  const data = JSON.parse(file.text);
  const v4 = data.version >= 4;
  const firstVersion = !v4 && !data.admin.salt;
  const ownerLogin = OWNER && !firstVersion && !!data.ownerLogin;
  const sharedOn = !v4 || !!(data.wraps && data.wraps.password);
  // Email is only asked for once someone has a personal sign-in (or the shared password is off).
  const emails = v4 && (!sharedOn || Object.keys(data.people || {}).length > 0);
  show('login');
  showIf('email-box', emails && !firstVersion && !ownerLogin);
  showIf('reclaim-email-box', emails);
  if (emails && $('reclaim-label')) $('reclaim-label').textContent = 'Password';
  if (firstVersion) { // saved by the first version, which used an admin key
    $('login-title').textContent = 'Upgrade';
    $('login-intro').hidden = false;
    $('password-label').textContent = 'Old admin key';
  } else if (ownerLogin) {
    $('login-title').textContent = 'Owner sign-in';
    $('password-label').textContent = 'Owner password';
  } else if (OWNER) {
    $('login-title').textContent = 'Set up owner access';
    $('password-label').textContent = emails ? 'Password' : "Supervisors' password";
    $('owner-intro').textContent = 'Sign in with a supervisor password first.';
    $('owner-intro').hidden = false;
  }
  $('reclaim-box').hidden = !data.ownerLogin;
  $('login-form').onsubmit = e => { e.preventDefault(); (ownerLogin ? ownerSignIn : signIn)(file); };
  $('use-recovery').onclick = () => useRecovery(file);
  $('reclaim').onclick = () => reclaimOwner(file);
  $('start-over').onclick = () => {
    if (confirm('Start over? Once you publish, EVERY existing card stops working until it is rewritten with a new link.')) setUp(true);
  };
}

// Sign in with an email and password, or the supervisors' shared password (Email empty).
// On the owner link before owner access exists, this then sets up owner access.
async function signIn(file) {
  const email = typedEmail();
  const password = $('password').value.trim();
  if (!password) return;
  if (email === null) return say('login-msg', 'Enter your whole email address.', true);
  say('login-msg', 'Unlocking…');
  try {
    const data = JSON.parse(file.text);
    if (!(data.version >= 4) && !data.admin.salt) return upgrade(password, file);
    let result;
    try {
      result = await openForSignIn(email, password, data);
    } catch (e) {
      if (e.code === 'shared-off') return say('login-msg', "The shared supervisors' password is switched off. Sign in with your own email and password.", true);
      if (e.code === 'no-people') return say('login-msg', 'Nobody has a personal sign-in yet. Leave Email empty.', true);
      return say('login-msg', email ? 'Wrong email or password.' : 'Wrong password.', true);
    }
    const { opened, keys } = result;
    keyRing.set(keys.pub.x, keys.d);
    const account = email && (opened.people || []).find(a => a.email === email);
    if (email && !account) return say('login-msg', "Your sign-in isn't set up properly. Ask the site owner to reset your password.", true);
    $('password').value = '';
    say('login-msg', '');
    if (!OWNER) {
      if (account && account.mustChange) return firstPassword(opened, file.text, email);
      return enterDashboard(opened, file.text, { me: email });
    }
    owner = opened.owner || null; // keeps the owner's contact details in the next steps
    ownerAccessSteps('Owner access · step 1 of 2', 'Owner access · step 2 of 2', () => show('login'), async (rec, auth) => {
      enterDashboard(opened, file.text, { mustPublish: true });
      await becomeOwner(rec, auth);
      pending.add('owner-access');
      refresh();
    });
  } catch (e) {
    say('login-msg', "Couldn't unlock: " + e.message, true);
  }
}

const FIRST_PW_INTRO = 'Replace your temporary password with your own.';

// First sign-in with a temporary password: choose your own before anything else. It takes effect when you publish,
// so the dashboard opens with that change waiting and no Discard.
function firstPassword(opened, publishedText, email) {
  passwordStep('First sign-in', () => show('login'), async password => {
    const s = await makeSignIn(password); // before the dashboard opens, so it opens with the change waiting
    enterDashboard(opened, publishedText, { mustPublish: true, me: email });
    useMySignIn(s);
    refresh();
    say('publish-msg', 'Publish now to save your new password.');
  }, { title: 'Choose your own password', intro: FIRST_PW_INTRO });
}

// Your own sign-in gets a new key pair, locked with the new password. Nobody else is affected.
async function changeMyPassword(password) {
  useMySignIn(await makeSignIn(password));
}
function useMySignIn(s) {
  accounts = accounts.map(a => (a.email === me ? { ...a, pub: s.pub, login: s.login, mustChange: false } : a));
}

// Owner sign-in: owner password → recovery code → everything.
async function ownerSignIn(file) {
  const password = $('password').value.trim();
  if (!password) return;
  say('login-msg', 'Unlocking…');
  let result;
  try {
    result = await openWithOwnerPassword(password, JSON.parse(file.text));
  } catch {
    return say('login-msg', 'Wrong owner password.', true);
  }
  $('password').value = '';
  say('login-msg', '');
  ownerAuth = result.auth;
  ownerCode = result.code;
  enterDashboard(result.opened, file.text);
  role = 'owner';
  applyRole();
}

// Owner forgot the owner password: the recovery code opens everything; choose a new owner password.
async function useRecovery(file) {
  const code = $('recovery-input').value.trim();
  if (!code) return;
  say('recovery-msg', 'Checking…');
  let opened;
  try {
    opened = await openWithCode(code, JSON.parse(file.text));
  } catch (e) {
    return say('recovery-msg', /no recovery/.test(e.message) ? e.message : 'Wrong recovery code.', true);
  }
  $('recovery-input').value = '';
  say('recovery-msg', '');
  const back = () => show('login');
  passwordStep('Recovery · new owner password', back, async ownerPassword => {
    const auth = await ownerAuthFrom(ownerPassword);
    const finish = async () => {
      ownerAuth = auth;
      ownerCode = code;
      enterDashboard(opened, file.text, { mustPublish: true });
      role = 'owner';
      applyRole();
      owner = { ...(opened.owner || {}), login: await makeOwnerLogin(auth, code) };
      pending.add('owner-password');
      refresh();
    };
    if (opened.shared !== undefined) return finish();
    // Older data doesn't carry the supervisors' password key: set a new supervisors' password too.
    passwordStep("Recovery · new supervisors' password", back, async password => {
      await finish();
      await setPassword(password);
      refresh();
    }, { warning: true });
  }, { title: 'Choose a new owner password', intro: OWNER_PW_INTRO });
}

// Owner lost both the owner password and the recovery code: a supervisor sign-in (own email and password, or the
// shared password) plus a NEW GitHub token from the repository's own account (which supervisors can't make)
// restores owner access.
async function reclaimOwner(file) {
  const email = typedEmail('reclaim-email');
  const password = $('reclaim-password').value.trim();
  if (!password) return;
  if (email === null) return say('reclaim-msg', 'Enter a whole email address.', true);
  say('reclaim-msg', 'Checking…');
  let opened;
  try {
    const result = await openForSignIn(email, password, JSON.parse(file.text));
    opened = result.opened;
    keyRing.set(result.keys.pub.x, result.keys.d);
  } catch {
    return say('reclaim-msg', email ? 'Wrong email or password.' : 'Wrong password.', true);
  }
  $('reclaim-password').value = '';
  say('reclaim-msg', '');
  owner = opened.owner || null; // keeps the owner's contact details in the next steps
  const back = () => show('login');
  tokenStep('Reclaim owner access · step 1 of 3: a new GitHub token', back, token => {
    if (opened.github && token === opened.github.token) {
      return say('token-msg', 'Use a NEW token, made on GitHub just now.', true);
    }
    ownerAccessSteps('Reclaim owner access · step 2 of 3', 'Reclaim owner access · step 3 of 3', back, async (rec, auth) => {
      enterDashboard(opened, file.text, { mustPublish: true });
      github = { token, addedAt: today(), addedBy: myName() };
      await becomeOwner(rec, auth);
      pending.add('owner-access');
      pending.add('token');
      refresh();
    });
  });
}

// First-time setup (or starting over): supervisors' password, GitHub token, owner password, recovery code.
function setUp(startingOver) {
  const cancel = startingOver ? () => show('login') : null;
  passwordStep('Set up · step 1 of 4', cancel, password => {
    tokenStep('Set up · step 2 of 4', cancel, token => {
      ownerAccessSteps('Set up · step 3 of 4', 'Set up · step 4 of 4', cancel, async (rec, auth) => {
        await setPassword(password);
        enterDashboard({ github: { token, addedAt: today(), addedBy: myName() }, owner: null, log: [], cards: [], data: emptyData(), shared, people: [] }, null);
        await becomeOwner(rec, auth);
        refresh();
      });
    });
  }, { title: "Choose the supervisors' dashboard password" });
}

// First version → this one: open with the old admin key, then set up passwords, GitHub and owner access.
// Contacts and cards carry over unchanged, so cards already written keep working.
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
  data.messageEs = DEFAULT_MESSAGE_ES;
  delete data.primary;
  const back = () => show('login');
  passwordStep('Upgrade · step 1 of 4', back, password => {
    tokenStep('Upgrade · step 2 of 4', back, token => {
      ownerAccessSteps('Upgrade · step 3 of 4', 'Upgrade · step 4 of 4', back, async (rec, auth) => {
        await setPassword(password);
        const cards = opened.cards.map(c => ({ note: '', ...c }));
        enterDashboard({ github: { token, addedAt: today(), addedBy: myName() }, owner: null, log: [], cards, data, shared, people: [] }, file.text, { mustPublish: true });
        await becomeOwner(rec, auth);
        pending.add('upgrade');
        refresh();
      });
    });
  }, { title: "Choose the supervisors' dashboard password" });
}

function emptyData() {
  const contacts = Array.from({ length: 6 }, () => ({ id: newId(), name: '', role: '', roleEs: '', phone: '' }));
  const every = [0, 1, 2, 3, 4, 5, 6];
  return {
    message: DEFAULT_MESSAGE,
    messageEs: DEFAULT_MESSAGE_ES,
    contacts,
    backup: '',
    schedule: {
      timeZone: YARD_TIME_ZONE,
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
  for (const s of ['setup-password', 'setup-token', 'setup-recovery', 'setup-temp']) showIf(s, s === id);
  $('setup-step').textContent = label;
  $('setup-cancel').hidden = !cancel;
  $('setup-cancel').onclick = cancel;
}

const DEFAULT_PW_INTRO = 'Shared by everyone who manages the cards.';

function passwordStep(label, cancel, done, { warning = false, title = 'Choose the dashboard password', intro = DEFAULT_PW_INTRO } = {}) {
  showStep('setup-password', label, cancel);
  $('pw-title').textContent = title;
  $('pw-intro').textContent = intro;
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
    if (own && !passwordOk(own)) return say('pw-msg', `Use ${PASSWORD_RULE}, or clear it to use the suggested one.`, true);
    say('pw-msg', 'Saving…');
    done(own || suggestion);
  };
}

const REPO_OWNER = REPO.split('/')[0];

function tokenStep(label, cancel, done) {
  showStep('setup-token', label, cancel);
  $('token-input').value = '';
  say('token-msg', '');
  $('token-next').onclick = async () => {
    const token = $('token-input').value.trim();
    if (!/^(github_pat_|ghp_)\w+$/.test(token)) return say('token-msg', "That doesn't look like a GitHub token. It should start with github_pat_.", true);
    say('token-msg', 'Checking with GitHub…');
    const ask = path => fetch(API + path, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }, cache: 'no-store' }).catch(() => null);
    const res = await ask(`/repos/${REPO}`);
    if (!res) return say('token-msg', "Couldn't reach GitHub. Check the internet connection and try again.", true);
    if (res.status === 401) return say('token-msg', 'GitHub says this token is not valid. Copy it again and paste it here.', true);
    if (!res.ok) return say('token-msg', `GitHub error ${res.status}. Check the token's repository access.`, true);
    // The token must belong to the account that owns the repository.
    const me = await ask('/user');
    const login = me && me.ok ? (await me.json()).login : null;
    if (!login || login.toLowerCase() !== REPO_OWNER.toLowerCase()) {
      return say('token-msg', `This token belongs to ${login ? 'GitHub user ' + login : 'another account'}. Make it while signed in to GitHub as ${REPO_OWNER}.`, true);
    }
    say('token-msg', '');
    done(token);
  };
}

// Returns { code, pub, contact, at }. The code is the owner's secret: it is never stored in `owner`.
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
    $('recovery-next').onclick = () => done({ code: rec.code, pub: rec.pub, contact: $('setup-contact').value.trim(), at: today() });
  });
}

// Owner password, then recovery code → done(rec, ownerAuth).
function ownerAccessSteps(label1, label2, cancel, done) {
  passwordStep(label1, cancel, ownerPassword => {
    recoveryStep(label2, cancel, async rec => done(rec, await ownerAuthFrom(ownerPassword)));
  }, { title: 'Choose your owner password', intro: OWNER_PW_INTRO });
}

async function ownerAuthFrom(password) {
  const salt = newSalt();
  return { key: await passwordKey(password, salt, ITERATIONS), salt, iterations: ITERATIONS };
}

// After the owner steps: remember the owner's secrets in memory and record the public parts in `owner`.
async function becomeOwner(rec, auth) {
  ownerAuth = auth;
  ownerCode = rec.code;
  owner = { contact: rec.contact, pub: rec.pub, at: rec.at, login: await makeOwnerLogin(auth, rec.code) };
  role = 'owner';
  applyRole();
}

// mustPublish: the session started with changes that can't be undone (upgrade, owner access, recovery),
// so Discard is hidden; publish them or Lock.
// me: your email, if you signed in with your own sign-in.
function enterDashboard(opened, publishedText, { mustPublish: must = false, me: email = '' } = {}) {
  github = opened.github;
  owner = opened.owner || null;
  log = opened.log || [];
  shared = opened.shared || null;
  accounts = opened.people || [];
  me = email;
  tokenAdvice = '';
  state = { backup: '', messageEs: DEFAULT_MESSAGE_ES, whatsapp: false, ...opened.data, address: savedAddress(opened.data), cards: opened.cards };
  state.schedule.timeZone = YARD_TIME_ZONE;
  const listed = new Set(state.contacts.map(c => c.id));
  state.schedule.away = currentAway(state.schedule.away).filter(a => listed.has(a.who)).map(a => (a.cover && !listed.has(a.cover) ? { ...a, cover: '' } : a));
  // When each number was last checked (kept with the dashboard data, not on the cards).
  // Numbers from before this was tracked count as checked on the last publish.
  const checked = opened.confirmed || {};
  const lastPublish = log.length ? houstonDate(new Date(log[log.length - 1].at)) : today();
  for (const c of state.contacts) {
    c.roleEs = c.roleEs || '';
    c.confirmed = checked[c.id] || lastPublish;
  }
  published = publishedText ? snapshot(publishedText) : null;
  if (published && opened.shared === undefined) published.shared = undefined; // very old data: not known
  mustPublish = must;
  pending = new Set();
  deployState = published ? 'checking' : 'none';
  show('dash');
  applyRole();
  $('my-name').value = myName();
  renderAll();
  checkGitHub();
  watchDeploy();
}

// What was last published (for the change list and Discard).
function snapshot(text) {
  return { state: clone(state), text, github, owner: clone(owner), ownerAuth, ownerCode, shared: clone(shared), accounts: clone(accounts) };
}

$('lock').onclick = () => location.reload(); // forgets every key (warns about unpublished changes)

addEventListener('beforeunload', e => {
  if (state && changes().length) { e.preventDefault(); e.returnValue = ''; }
});

// Lock by itself after 30 minutes without use (an office computer left signed in), but never with changes waiting
// to be published or while publishing.
const IDLE_LOCK_MS = 30 * 60 * 1000;
let lastUse = Date.now();
for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll']) {
  addEventListener(type, e => {
    if (type === 'pointermove' && !e.movementX && !e.movementY) return; // the page moved under a resting pointer
    lastUse = Date.now();
  }, { passive: true, capture: true });
}
// Setup steps (a recovery code, a temporary password, a GitHub token in another tab) are never interrupted.
setInterval(() => {
  if (Date.now() - lastUse < IDLE_LOCK_MS || busy || allCardsBusy || $('dash').hidden) return;
  if (state && changes().length) return;
  location.reload();
}, 60 * 1000);

// The yard address is saved as "yardAddress" ("" hides it). Without one, cards show the built-in YARD_ADDRESS,
// and so does this box. (A few hours' worth of dashboards wrote "address" and saved "" automatically,
// so a non-empty "address" still counts but an empty one doesn't.) undefined = leave it out of the file.
function savedAddress(data) {
  const saved = data.yardAddress ?? (data.address || undefined);
  return saved ?? (typeof YARD_ADDRESS !== 'undefined' ? YARD_ADDRESS : undefined);
}

// ================= Tabs =================

let tab = 'shifts'; // the tab supervisors change most often
for (const b of document.querySelectorAll('[data-tab]')) {
  b.onclick = () => {
    openTab(b.dataset.tab);
    if (matchMedia('(min-width: 820px)').matches) scrollTo(0, 0); // computer layout: start the section at its top
  };
}

function openTab(name) {
  tab = name;
  renaming = null;
  for (const b of document.querySelectorAll('[data-tab]')) {
    b.classList.toggle('active', b.dataset.tab === name);
    if (b.dataset.tab === name) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  for (const p of document.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== name;
  showTab(document.querySelector(`[data-tab="${name}"]`));
  renderTab();
}

// On a phone the tab row scrolls sideways: bring the open tab fully into view (sideways only).
function showTab(b) {
  const row = b && b.parentElement;
  if (!row || row.scrollWidth <= row.clientWidth) return;
  if (b.offsetLeft < row.scrollLeft) row.scrollLeft = b.offsetLeft;
  else if (b.offsetLeft + b.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = b.offsetLeft + b.offsetWidth - row.clientWidth;
}

function renderAll() {
  openTab(tab);
  refresh();
}

function renderTab() {
  ({
    people: renderPeople, shifts: renderShifts, cards: renderCards, print: renderPrint,
    history: renderHistory, settings: renderSettings, help: () => {}, owner: renderOwner,
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
      else if (o.name !== c.name || o.role !== c.role || o.roleEs !== c.roleEs || o.phone !== c.phone) out.push('Edited ' + personName(c));
      else if (o.confirmed !== c.confirmed) out.push(`Checked ${personName(c)}'s number`);
    }
    for (const o of before.contacts) if (!now.has(o.id)) out.push('Removed ' + personName(o));
    if (before.message !== state.message) out.push('Changed the text message');
    if (before.messageEs !== state.messageEs) out.push('Changed the Spanish text message');
    if (scheduleKey(before.schedule) !== scheduleKey(state.schedule)) out.push('Changed shifts');
    out.push(...awayChanges(before.schedule.away || [], state.schedule.away || []));
    if ((before.backup || '') !== (state.backup || '')) out.push('Changed the backup line');
    if ((before.address || '') !== (state.address || '')) out.push('Changed the yard address');
    if (!!before.whatsapp !== !!state.whatsapp) out.push(state.whatsapp ? 'Switched the WhatsApp button on' : 'Switched the WhatsApp button off');
    const oldCards = new Map(before.cards.map(c => [c.key, c]));
    const nowCards = new Set(state.cards.map(c => c.key));
    for (const c of state.cards) {
      const o = oldCards.get(c.key);
      if (!o) out.push(`Added card: ${cardLabel(c)}`);
      else if (o.driver !== c.driver || o.note !== c.note) out.push(`Renamed card: ${cardLabel(c)}`);
    }
    for (const o of before.cards) if (!nowCards.has(o.key)) out.push(`Removed card: ${cardLabel(o)}`);
    if (((published.owner && published.owner.contact) || '') !== ((owner && owner.contact) || '')) out.push('Changed the owner contact');
    out.push(...accountChanges());
  }
  if (pending.has('upgrade')) out.push('Upgrade from the first version: new password, GitHub connection, owner access and shifts');
  if (pending.has('owner-access')) out.push('Set up owner access (your owner password and recovery code)');
  if (pending.has('owner-password')) out.push('Changed the owner password');
  if (published) {
    const was = published.shared, now = shared;
    if (was === undefined) { if (now) out.push("Changed the supervisors' password"); } // very old data
    else if (!now !== !was) out.push(now ? 'Switched the shared password back on' : 'Switched off the shared password');
    else if (now && now.pub.x !== was.pub.x) out.push("Changed the supervisors' password");
  }
  if (pending.has('token')) out.push('Replaced the GitHub token');
  if (pending.has('recovery')) out.push('Made a new recovery code');
  return out;
}

// The schedule as text for comparing: unticking and re-ticking someone, or emptying a Spanish name, isn't a change.
function scheduleKey(s) {
  return JSON.stringify({
    fallback: s.fallback,
    shifts: s.shifts.map(x => ({ name: x.name, nameEs: x.nameEs || '', start: x.start, end: x.end, days: [...x.days].sort(), people: [...x.people].sort() })),
  });
}

// Time off added, changed or removed since the last publish.
function awayChanges(before, now) {
  const name = id => { const c = state.contacts.find(x => x.id === id) || published.state.contacts.find(x => x.id === id); return c ? personName(c) : 'someone'; };
  const label = a => `${name(a.who)}, ${rangeLabel(a.from, a.to)}${a.cover ? `, covered by ${name(a.cover)}` : ''}`;
  const out = [], old = new Map(before.map(a => [a.id, a]));
  for (const a of now) {
    const o = old.get(a.id);
    if (!o) out.push('Time off: ' + label(a));
    else if (o.who !== a.who || o.from !== a.from || o.to !== a.to || o.cover !== a.cover) out.push('Changed time off: ' + label(a));
  }
  for (const o of before) if (!now.some(a => a.id === o.id)) out.push('Removed time off: ' + label(o));
  return out;
}

// Personal sign-ins added, reset, changed or removed since the last publish.
function accountChanges() {
  const out = [];
  const before = new Map(published.accounts.map(a => [a.email, a]));
  for (const a of accounts) {
    const o = before.get(a.email);
    if (!o) out.push(`Added a sign-in for ${a.name} (${a.email})`);
    else if (o.pub.x !== a.pub.x) out.push(a.mustChange ? `Reset the password for ${a.name}` : `${a.name} chose a new password`);
  }
  for (const o of published.accounts) if (!accounts.some(a => a.email === o.email)) out.push(`Removed the sign-in for ${o.name} (${o.email})`);
  return out;
}

function refresh() {
  if (!state) return;
  const list = changes();
  const badge = $('pub-badge');
  let label, cls, text;
  if (busy) [label, cls, text] = ['Publishing', 'updating', 'Saving to GitHub…'];
  else if (list.length && !published) [label, cls, text] = ['Not live yet', 'changes', 'Fill in Supervisors, Shifts and People, then Publish.'];
  else if (list.length) [label, cls, text] = ['Not published', 'changes', `${list.length} change${list.length > 1 ? 's' : ''} waiting. Publish to update every card.`];
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
  $('discard').hidden = !published || mustPublish;
  $('publish-bar').hidden = !list.length;
  $('publish-bar-text').textContent = `${list.length} change${list.length > 1 ? 's' : ''} not published`;
  $('publish-bar-btn').disabled = busy;

  $('gh-problem').hidden = !ghProblem;
  $('gh-problem').textContent = ghProblem || '';

  const due = state.contacts.filter(isDue).length;
  $('due-note').hidden = !due;
  $('due-text').textContent = due === 1 ? `1 phone number hasn't been checked in ${CHECK_DAYS} days.` : `${due} phone numbers haven't been checked in ${CHECK_DAYS} days.`;

  renderNow();
  const last = log[log.length - 1];
  $('facts').textContent = [
    `${state.contacts.length} supervisor${state.contacts.length === 1 ? '' : 's'}`, `${state.cards.length} card${state.cards.length === 1 ? '' : 's'}`,
    last && `last published ${when(last.at)}${last.who ? ' by ' + last.who : ''}`,
  ].filter(Boolean).join(' · ');
}

// Who the cards point to at this moment (with your unpublished changes included).
function renderNow() {
  const now = yardNow(YARD_TIME_ZONE);
  $('now-time').textContent = `(Houston time ${DAYS[now.day]} ${timeLabel(`${Math.floor(now.minutes / 60)}:${now.minutes % 60}`)})`;
  const ready = state.contacts.filter(c => c.name.trim());
  if (!ready.length) {
    $('now-main').textContent = 'Add supervisors to see who the cards will call.';
    $('now-also').textContent = '';
    return;
  }
  const { main, also, away = [] } = arrange({ contacts: ready, schedule: state.schedule }, now);
  $('now-main').textContent = `Primary call: ${main.contact.name}` + (main.shift ? ` (${main.shift.name}, until ${timeLabel(main.shift.end)})` : ' (fallback, nobody on shift)');
  const lines = [
    also.length && 'Also working: ' + also.map(a => `${a.contact.name} (${a.shift.name})`).join(', '),
    away.length && 'Away: ' + away.map(a => `${a.contact.name} (through ${shortDate(a.until)})`).join(', '),
  ].filter(Boolean);
  $('now-also').replaceChildren(...lines.flatMap((line, i) => (i ? [el('br'), line] : [line])));
}
setInterval(() => state && renderNow(), 30 * 1000);

// ================= People =================

// One row per person: a table on a computer (column names in the header row), labelled boxes on a phone.
function renderPeople() {
  $('people-list').replaceChildren(...state.contacts.map(c => {
    const was = { phone: c.phone, confirmed: c.confirmed };
    const remove = el('button', { type: 'button', class: 'icon-btn row-remove', textContent: '×', title: 'Remove supervisor', 'aria-label': `Remove ${personName(c)}`, onclick: () => removePerson(c) });
    const input = (label, key, extra = {}) => el('label', {}, el('span', { class: 'lbl', textContent: label }), el('input', {
      value: key === 'phone' ? showPhone(c.phone) : c[key], autocomplete: 'off', ...extra,
      oninput: e => {
        if (key === 'phone') { // saved as +1…; a new number counts as checked, the same number typed again doesn't
          const p = normalizePhone(e.target.value);
          c.phone = p || e.target.value;
          c.confirmed = p === was.phone ? was.confirmed : today();
        } else c[key] = e.target.value;
        if (key === 'name') remove.setAttribute('aria-label', `Remove ${personName(c)}`);
        refresh();
      },
    }));
    const due = isDue(c);
    const checked = el('div', { class: 'check-cell' + (due ? ' due' : '') },
      c.phone && el('span', { textContent: due ? `Not checked since ${dateLabel(c.confirmed)}` : c.confirmed === today() ? 'Checked today' : `Checked ${dateLabel(c.confirmed)}` }),
      due && el('button', { type: 'button', class: 'btn btn-light btn-small', textContent: 'Still right', onclick: () => {
        c.confirmed = today();
        renderPeople();
        refresh();
      } }));
    return el('div', { class: 'person-row' },
      input('Name', 'name'),
      input('Role', 'role', { placeholder: 'e.g. 1st shift lead' }),
      input('Role in Spanish (optional)', 'roleEs', { placeholder: 'e.g. Supervisor del 1er turno', lang: 'es' }),
      input('Phone', 'phone', {
        type: 'tel', placeholder: '(555) 555-0100',
        onchange: e => { const p = normalizePhone(e.target.value); if (p) e.target.value = showPhone(p); },
      }),
      checked,
      remove);
  }));
  $('add-person').disabled = state.contacts.length >= MAX_PEOPLE;
  $('message').value = state.message;
  $('message-es').value = state.messageEs;
  $('address').value = state.address || '';
  $('whatsapp-on').checked = !!state.whatsapp;
}

$('add-person').onclick = () => {
  state.contacts.push({ id: newId(), name: '', role: '', roleEs: '', phone: '', confirmed: today() });
  renderPeople();
  refresh();
  const rows = $('people-list').children;
  rows[rows.length - 1].querySelector('input').focus();
};

function removePerson(c) {
  if (!confirm(`Remove ${personName(c)}? They'll also be taken off every shift and out of time off.`)) return;
  state.contacts = state.contacts.filter(x => x !== c);
  for (const s of state.schedule.shifts) s.people = s.people.filter(id => id !== c.id);
  state.schedule.away = (state.schedule.away || []).filter(a => a.who !== c.id).map(a => (a.cover === c.id ? { ...a, cover: '' } : a));
  if (state.schedule.fallback === c.id) state.schedule.fallback = state.contacts[0] ? state.contacts[0].id : null;
  renderPeople();
  refresh();
  $('add-person').focus();
}

$('message').oninput = e => { state.message = e.target.value; refresh(); };
$('message-es').oninput = e => { state.messageEs = e.target.value; refresh(); };
$('address').oninput = e => { state.address = e.target.value; refresh(); };
$('whatsapp-on').onchange = e => { state.whatsapp = e.target.checked; refresh(); };
$('due-open').onclick = () => openTab('people');

// ================= Shifts =================

function renderShifts() {
  const s = state.schedule;
  $('shift-list').replaceChildren(...s.shifts.map(shiftBox));
  renderMatrix();
  renderAway();
  $('fallback').replaceChildren(...state.contacts.map(c => el('option', { value: c.id, textContent: personName(c), selected: c.id === s.fallback })));
  if ($('preview-day') && !$('preview-day').options.length) {
    const now = yardNow(YARD_TIME_ZONE);
    $('preview-day').replaceChildren(...DAYS.map((d, i) => el('option', { value: i, textContent: d, selected: i === now.day })));
  }
  renderPreview();
  renderGaps();
}

// Times in the week when nobody (with a name) is on any shift → [[start, end), …] in minutes from Monday 0:00.
const WEEK = 7 * 1440;
function scheduleGaps() {
  const named = new Set(state.contacts.filter(c => c.name.trim()).map(c => c.id));
  const staffed = state.schedule.shifts.filter(s => s.people.some(id => named.has(id)));
  const gaps = [];
  for (let i = 0; i < WEEK; i++) {
    if (staffed.some(s => shiftOn(s, { day: Math.floor(i / 1440), minutes: i % 1440 }))) continue;
    const last = gaps[gaps.length - 1];
    if (last && last[1] === i) last[1] = i + 1;
    else gaps.push([i, i + 1]);
  }
  // A gap running from Sunday night into Monday morning is one gap.
  if (gaps.length > 1 && gaps[0][0] === 0 && gaps[gaps.length - 1][1] === WEEK) gaps[0][0] = gaps.pop()[0] - WEEK;
  return gaps.sort((x, y) => (x[0] + WEEK) % WEEK - (y[0] + WEEK) % WEEK); // in week order, Monday first
}

function weekTime(i) {
  const m = ((i % WEEK) + WEEK) % WEEK;
  return `${DAYS[Math.floor(m / 1440)]} ${timeLabel(`${Math.floor((m % 1440) / 60)}:${m % 60}`)}`;
}

// Warn about hours with nobody on shift: the fallback person gets the primary call then.
function renderGaps() {
  const gaps = scheduleGaps();
  const fb = state.contacts.find(c => c.id === state.schedule.fallback) || state.contacts[0];
  const who = fb ? personName(fb) : 'the fallback person';
  if (!gaps.length) return $('gaps').replaceChildren(el('p', { class: 'small ok', textContent: '✓ Someone is on shift at every hour of the week.' }));
  if (gaps[0][1] - gaps[0][0] >= WEEK) {
    return $('gaps').replaceChildren(el('p', { class: 'warn small', textContent: `Nobody is on any shift, so ${who} is always the primary call.` }));
  }
  const shown = gaps.slice(0, 8);
  $('gaps').replaceChildren(el('div', { class: 'warn small' },
    el('span', { textContent: `Nobody on shift at these times, so ${who} gets the primary call:` }),
    el('ul', {}, ...shown.map(([a, b]) => el('li', { textContent: `${weekTime(a)} to ${weekTime(b)}` })),
      gaps.length > shown.length && el('li', { textContent: `and ${gaps.length - shown.length} more` }))));
}

// "Every day", "Mon–Fri", "Sat, Sun", "Mon, Wed, Fri"
function daysLabel(days) {
  const d = [...new Set(days)].sort((a, b) => a - b);
  if (!d.length) return 'No days';
  if (d.length === 7) return 'Every day';
  if (d.length >= 3 && d[d.length - 1] - d[0] === d.length - 1) return `${DAYS[d[0]]}–${DAYS[d[d.length - 1]]}`;
  return d.map(i => DAYS[i]).join(', ');
}

const togglePerson = (shift, id, on) => { shift.people = on ? [...shift.people.filter(x => x !== id), id] : shift.people.filter(x => x !== id); };
const shiftChanged = () => { refresh(); renderPreview(); renderGaps(); };

// Who works each shift: a person per row, a shift per column (in order: the first shift on gets the primary call).
// An older cached dashboard.html has no table: then each shift box has its own "Who works it" ticks instead.
function renderMatrix() {
  const table = $('shift-matrix');
  if (!table) return;
  const shifts = state.schedule.shifts;
  if (!state.contacts.length || !shifts.length) {
    return table.replaceChildren(el('tbody', {}, el('tr', {}, el('td', { class: 'muted small empty', textContent: state.contacts.length ? 'Add a shift first.' : 'Add supervisors first.' }))));
  }
  const head = el('tr', {}, el('th', { scope: 'col', class: 'corner', textContent: 'Supervisor' }),
    ...shifts.map(s => el('th', { scope: 'col' },
      s.name || 'Shift',
      el('span', { textContent: `${timeLabel(s.start)} – ${timeLabel(s.end)}` }),
      el('span', { textContent: daysLabel(s.days) }))));
  const away = TIME_OFF ? awayOn(state.schedule, today()) : new Map();
  const nameOf = id => personName(state.contacts.find(x => x.id === id) || { name: '' });
  const covering = new Map(); // cover id → the names they cover for
  for (const a of away.values()) if (a.cover) covering.set(a.cover, [...(covering.get(a.cover) || []), nameOf(a.who)]);
  const rows = state.contacts.map(c => el('tr', { class: away.has(c.id) ? 'is-away' : '' },
    el('th', { scope: 'row' }, personName(c), c.role.trim() && el('span', { textContent: c.role.trim() }),
      away.has(c.id) && el('em', { class: 'tag tag-away', textContent: `Away through ${shortDate(away.get(c.id).to)}` }),
      covering.has(c.id) && el('em', { class: 'tag', textContent: `Covering for ${covering.get(c.id).join(', ')}` })),
    ...shifts.map(s => {
      const on = s.people.includes(c.id);
      const cell = el('td', { class: on ? 'on' : '' });
      cell.append(el('label', {}, el('input', { type: 'checkbox', checked: on, 'aria-label': `${personName(c)} works ${s.name || 'this shift'}`, onchange: e => {
        togglePerson(s, c.id, e.target.checked);
        cell.classList.toggle('on', e.target.checked);
        shiftChanged();
      } })));
      return cell;
    })));
  table.replaceChildren(el('thead', {}, head), el('tbody', {}, ...rows));
}

// Time off: a row per entry (person, first and last day, who covers), soonest first as entered.
function renderAway() {
  if (!$('away-list') || !TIME_OFF) return;
  showIf('away-box', true);
  $('away-list').replaceChildren(...state.schedule.away.map(awayRow));
  showIf('no-away', !state.schedule.away.length);
  showIf('away-head', state.schedule.away.length > 0);
}

function awayRow(a) {
  const opt = (c, chosen) => el('option', { value: c.id, textContent: personName(c), selected: c.id === chosen });
  const status = el('div', { class: 'away-status' });
  const showStatus = () => {
    const t = today(), n = -daysSince(a.from);
    status.replaceChildren(!isDate(a.from) || !isDate(a.to) ? ''
      : a.from <= t && t <= a.to ? el('span', { class: 'badge small changes', textContent: 'Away now' })
      : n > 0 ? el('span', { textContent: `Starts in ${n} day${n === 1 ? '' : 's'}` }) : '');
  };
  const update = () => { showStatus(); refresh(); renderPreview(); renderMatrix(); };
  const cover = el('select', { onchange: e => { a.cover = e.target.value; update(); } });
  const fillCover = () => cover.replaceChildren(el('option', { value: '', textContent: 'Nobody', selected: !a.cover }),
    ...state.contacts.filter(c => c.id !== a.who).map(c => opt(c, a.cover)));
  fillCover();
  const who = el('select', { onchange: e => { a.who = e.target.value; if (a.cover === a.who) a.cover = ''; fillCover(); update(); } },
    el('option', { value: '', textContent: 'Choose supervisor', disabled: true, selected: !a.who }), ...state.contacts.map(c => opt(c, a.who)));
  const last = el('input', { type: 'date', value: a.to, min: a.from, onchange: e => { a.to = e.target.value; update(); } });
  // A one-day entry (or one without a last day) moves with its first day. Otherwise the last day stays put: a date
  // box reports each part as it's typed, and a half-typed first day mustn't push the last day out.
  const first = el('input', { type: 'date', value: a.from, onchange: e => {
    const was = a.from;
    a.from = e.target.value;
    if (isDate(a.from) && (!isDate(a.to) || a.to === was)) last.value = a.to = a.from;
    last.min = a.from;
    update();
  } });
  const label = (text, input) => el('label', {}, el('span', { class: 'lbl', textContent: text }), input);
  const row = el('div', { class: 'away-row' },
    label('Supervisor', who), label('First day', first), label('Last day', last), label('Covered by', cover), status,
    el('button', { type: 'button', class: 'icon-btn row-remove', textContent: '×', title: 'Remove time off', 'aria-label': `Remove time off for ${a.who ? personName(state.contacts.find(c => c.id === a.who) || { name: '' }) : 'nobody chosen yet'}`, onclick: () => {
      state.schedule.away = state.schedule.away.filter(x => x !== a);
      renderAway();
      update();
      $('add-away').focus();
    } }));
  showStatus();
  return row;
}

onClick('add-away', () => {
  state.schedule.away.push({ id: newId(), who: '', from: today(), to: today(), cover: '' });
  renderAway();
  refresh();
  renderMatrix();
  $('away-list').lastElementChild.querySelector('select').focus();
});

function moveShift(shift, by) {
  const list = state.schedule.shifts, i = list.indexOf(shift), j = i + by;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  renderShifts();
  refresh();
  // Keep the keyboard on the moved box: the same arrow, or the other one once it reaches the end.
  const box = $('shift-list').children[j];
  const btn = box.querySelector(by < 0 ? '.move-up' : '.move-down');
  (btn.disabled ? box.querySelector(by < 0 ? '.move-down' : '.move-up') : btn).focus();
}

function shiftBox(shift, index, all) {
  const changed = () => { shiftChanged(); renderMatrix(); };
  const label = () => shift.name.trim() || 'this shift'; // read when used: the name can change after this is drawn
  const legend = el('legend', { textContent: shift.name || 'Shift' });
  const autoEs = () => { const es = shiftName({ ...shift, nameEs: '' }, 'es'); return es !== shift.name ? `${es} (automatic)` : 'e.g. Turno de noche'; };
  const esName = el('input', { value: shift.nameEs || '', placeholder: autoEs(), lang: 'es', oninput: e => { shift.nameEs = e.target.value; changed(); } });
  // Each part of a time box counts as a change while it's typed in, so an emptied box gets the saved time back
  // only when you leave it.
  const time = key => el('input', {
    type: 'time', value: shift[key],
    onchange: e => { if (e.target.value) { shift[key] = e.target.value; changed(); } },
    onblur: e => { if (!e.target.value) e.target.value = shift[key]; },
  });
  const up = el('button', { type: 'button', class: 'icon-btn move-up', textContent: '←', title: 'Move earlier', disabled: index === 0, onclick: () => moveShift(shift, -1) });
  const down = el('button', { type: 'button', class: 'icon-btn move-down', textContent: '→', title: 'Move later', disabled: index === all.length - 1, onclick: () => moveShift(shift, 1) });
  const remove = el('button', { type: 'button', class: 'icon-btn row-remove', textContent: '×', title: 'Remove shift', onclick: () => {
    if (!confirm(`Remove ${label()}?`)) return;
    state.schedule.shifts = state.schedule.shifts.filter(x => x !== shift);
    renderShifts();
    refresh();
    $('add-shift').focus();
  } });
  const names = () => {
    up.setAttribute('aria-label', `Move ${label()} earlier`);
    down.setAttribute('aria-label', `Move ${label()} later`);
    remove.setAttribute('aria-label', `Remove ${label()}`);
  };
  names();
  return el('fieldset', { class: 'box shift' },
    legend,
    el('div', { class: 'box-tools' }, up, down, remove),
    el('div', { class: 'field-row' },
      el('label', {}, 'Name', el('input', { value: shift.name, oninput: e => { shift.name = e.target.value; legend.textContent = shift.name || 'Shift'; esName.placeholder = autoEs(); names(); changed(); } })),
      el('label', {}, 'Spanish name (optional)', esName)),
    el('div', { class: 'field-row' },
      el('label', {}, 'Starts', time('start')),
      el('label', {}, 'Ends', time('end'))),
    el('p', { class: 'eyebrow', textContent: 'Days' }),
    el('div', { class: 'days', role: 'group', 'aria-label': `Days for ${label()}` }, ...DAYS.map((d, i) => el('label', { class: 'day' },
      el('input', { type: 'checkbox', checked: shift.days.includes(i), onchange: e => {
        shift.days = e.target.checked ? [...shift.days, i].sort((a, b) => a - b) : shift.days.filter(x => x !== i);
        changed();
      } }), el('span', { textContent: d })))),
    !$('shift-matrix') && el('p', { class: 'eyebrow', textContent: 'Who works it' }),
    !$('shift-matrix') && (state.contacts.length
      ? el('div', { class: 'chips' }, ...state.contacts.map(c => el('label', { class: 'chip' },
          el('input', { type: 'checkbox', checked: shift.people.includes(c.id), onchange: e => { togglePerson(shift, c.id, e.target.checked); changed(); } }), personName(c))))
      : el('p', { class: 'small muted', textContent: 'Add supervisors first.' })));
}

$('add-shift').onclick = () => {
  state.schedule.shifts.push({ name: 'New shift', start: '08:00', end: '16:00', days: [0, 1, 2, 3, 4], people: [] });
  renderShifts();
  refresh();
  const boxes = $('shift-list').children;
  boxes[boxes.length - 1].querySelector('input:not([type=checkbox])').select();
};
$('fallback').onchange = e => { state.schedule.fallback = e.target.value; refresh(); renderPreview(); renderGaps(); };
$('preview-time').onchange = () => renderPreview();
if ($('preview-day')) $('preview-day').onchange = () => renderPreview();
if ($('preview-date')) $('preview-date').onchange = () => renderPreview();

// What a card would show at the chosen day and time.
function renderPreview() {
  const [h, m] = ($('preview-time').value || '15:00').split(':').map(Number);
  const ready = state.contacts.filter(c => c.name.trim());
  if (!ready.length) return $('preview').replaceChildren(el('li', { textContent: 'Add supervisors first.' }));
  // A date (time off depends on it); an older cached dashboard.html only has a weekday.
  let at = { day: $('preview-day') ? Number($('preview-day').value) : yardNow(YARD_TIME_ZONE).day, minutes: h * 60 + m };
  if ($('preview-date')) {
    if (!isDate($('preview-date').value)) $('preview-date').value = today();
    const date = $('preview-date').value;
    at = { day: (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7, minutes: h * 60 + m, date };
  }
  const { main, also, off, away = [] } = arrange({ contacts: ready, schedule: state.schedule }, at);
  $('preview').replaceChildren(
    el('li', { class: 'preview-main' }, el('strong', { textContent: 'Primary call: ' + main.contact.name }), main.shift ? ` (${main.shift.name})` : ' (fallback, nobody on shift)'),
    ...also.map(a => el('li', { textContent: `Also working: ${a.contact.name} (${a.shift.name})` })),
    ...off.map(o => el('li', { class: 'muted', textContent: `Not scheduled: ${o.contact.name}` })),
    ...away.map(o => el('li', { class: 'muted', textContent: `Away: ${o.contact.name}` })));
}

// ================= Cards =================

const cardLabel = c => c.driver + (c.note ? ` (${c.note})` : '');
const isLive = c => published && published.state.cards.some(p => p.key === c.key);

let renaming = null;      // the card being renamed in its row
let renameFocus = false;  // put the cursor in its name box on the next draw

// A row per card: driver (and when it was added), who has it, status, buttons. Search narrows the list.
function renderCards() {
  const q = $('card-search') ? $('card-search').value.trim().toLowerCase() : '';
  const shown = state.cards.filter(c => !q || `${c.driver} ${c.note}`.toLowerCase().includes(q));
  $('card-list').replaceChildren(...shown.map(card => (card === renaming ? renameRow(card) : cardRow(card))));
  $('card-count').textContent = state.cards.length;
  $('no-cards').hidden = shown.length > 0;
  $('no-cards').textContent = state.cards.length ? 'No cards match.' : 'No cards yet.';
}

function cardRow(card) {
  const live = isLive(card);
  return el('li', { 'data-key': card.key },
    el('div', { class: 'c-driver' },
      el('strong', { textContent: card.driver }),
      el('span', { textContent: 'Added ' + dateLabel(card.added) })),
    el('div', { class: 'c-note' }, el('span', { textContent: card.note || '—' })),
    el('div', { class: 'c-status' }, el('span', { class: 'badge small ' + (live ? 'live' : 'changes'), textContent: live ? 'Active' : 'Not published yet' })),
    el('div', { class: 'actions' },
      el('button', { type: 'button', class: 'btn btn-light btn-small', textContent: 'Print & QR', onclick: () => openPrint(card) }),
      el('button', { type: 'button', class: 'btn btn-light btn-small', textContent: 'Rename', onclick: () => renameCard(card) }),
      el('button', { type: 'button', class: 'btn btn-danger btn-small', textContent: 'Remove', onclick: () => removeCard(card) })));
}

// Rename in place: Enter saves, Escape cancels.
function renameRow(card) {
  const keys = e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); };
  const driver = el('input', { value: card.driver, autocomplete: 'off', 'aria-label': 'Driver name and ID', onkeydown: keys });
  const note = el('input', { value: card.note, autocomplete: 'off', 'aria-label': 'Given to', placeholder: 'Given to', onkeydown: keys });
  const done = () => {
    renaming = null;
    renderCards();
    const row = $('card-list').querySelector(`[data-key="${card.key}"]`); // back to that card's Rename button
    if (row) row.querySelectorAll('.actions .btn')[1].focus();
  };
  const cancel = done;
  const save = () => {
    if (!driver.value.trim()) return driver.focus();
    card.driver = driver.value.trim();
    card.note = note.value.trim();
    done();
    refresh();
  };
  const li = el('li', { class: 'renaming' },
    el('div', { class: 'c-driver' }, driver),
    el('div', { class: 'c-note' }, note),
    el('div', { class: 'c-status' }),
    el('div', { class: 'actions' },
      el('button', { type: 'button', class: 'btn btn-primary btn-small', textContent: 'Save', onclick: save }),
      el('button', { type: 'button', class: 'btn btn-light btn-small', textContent: 'Cancel', onclick: cancel })));
  if (renameFocus) { renameFocus = false; setTimeout(() => driver.select()); }
  return li;
}

function addCard() {
  renaming = null;
  const driver = $('new-driver').value.trim();
  if (!driver) return say('card-msg', 'Enter the driver name and ID first.', true);
  const card = { driver, note: $('new-note').value.trim(), key: newKey(), added: today() };
  state.cards.push(card);
  $('new-driver').value = $('new-note').value = '';
  if ($('card-search')) $('card-search').value = '';
  say('card-msg', `Added ${cardLabel(card)}. Publish to switch it on, then get its files in Print & QR.`);
  renderCards();
  refresh();
  $('new-driver').focus();
}
$('add-card').onclick = addCard;
for (const id of ['new-driver', 'new-note']) $(id).onkeydown = e => { if (e.key === 'Enter' && !e.repeat) addCard(); };
if ($('card-search')) $('card-search').oninput = () => { renaming = null; renderCards(); };

function renameCard(card) {
  renaming = card;
  renameFocus = true;
  renderCards();
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
const PRINT_DOWNLOADS = ['dl-3mf', 'dl-stl'];

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
  $('print-status').textContent = 'Not published yet. The link and files work after you publish.';
  $('print-msg').hidden = true;
  try {
    await CardMaker.load();
    if (run !== printRun) return;
    const info = printInfo(card);
    const { problems } = CardMaker.layout(info);
    $('preview-front').replaceChildren(CardMaker.preview(info, 'front'));
    $('preview-back').replaceChildren(CardMaker.preview(info, 'back'));
    if (problems.length) printProblem(problems.join(' '));
    for (const id of PRINT_DOWNLOADS) if ($(id)) $(id).disabled = problems.length > 0;
  } catch (e) {
    for (const id of PRINT_DOWNLOADS) if ($(id)) $(id).disabled = true;
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

// The Bambu printer the .3mf files are made for: one choice for both tabs, remembered on this device. Nothing is
// preselected the first time, so a project is never made for a printer nobody chose.
const PRINTER_KEY = 'print-printer';
const printerSelects = ['print-printer', 'all-printer'];
function fillPrinters() {
  if (typeof Bambu3MF === 'undefined' || !Bambu3MF.PRINTERS) return; // an older cached bambu3mf.js
  let saved = '';
  try { saved = localStorage.getItem(PRINTER_KEY) || ''; } catch {}
  if (!Bambu3MF.PRINTERS.some(p => p.id === saved)) saved = '';
  for (const id of printerSelects) {
    if (!$(id)) continue;
    $(id).replaceChildren(el('option', { value: '', textContent: 'Choose printer', disabled: true, selected: !saved }),
      ...Bambu3MF.PRINTERS.map(p => el('option', { value: p.id, textContent: 'Bambu Lab ' + p.label, selected: p.id === saved })));
    $(id).onchange = e => {
      try { localStorage.setItem(PRINTER_KEY, e.target.value); } catch {}
      for (const other of printerSelects) if ($(other)) $(other).value = e.target.value;
    };
  }
}
fillPrinters();
// The chosen printer, or a message saying what's missing.
function chosenPrinter(selectId) {
  if (typeof Bambu3MF === 'undefined' || !Bambu3MF.PRINTERS) return { problem: 'The dashboard was just updated. Reload the page.' };
  const p = $(selectId) && Bambu3MF.PRINTERS.find(x => x.id === $(selectId).value);
  return p ? { printer: p } : { problem: 'Choose the printer first.' };
}

// Make the chosen card's print files and hand them to the browser:
// '3mf' = Bambu Studio project (bambu3mf.js), 'stl' = ZIP with both STL parts and the print notes.
async function download(what) {
  const card = printCard();
  const info = printInfo(card);
  const base = 'card-' + CardMaker.slug(card.driver + (card.note ? ' ' + card.note : ''));
  $('print-msg').hidden = true;
  try {
    await CardMaker.load();
    if (what === 'stl') return saveFile(base + '-STL.zip', CardMaker.zip(await CardMaker.files(info)));
    if (typeof Bambu3MF === 'undefined') {
      return printProblem("The Bambu Studio project maker (bambu3mf.js) didn't load. Reload the page, or use the STL files.");
    }
    const { printer, problem } = chosenPrinter('print-printer');
    if (problem) return printProblem(problem);
    const m = CardMaker.model(info);
    const bytes = await Bambu3MF.make({ black: m.black, white: m.white, name: base, pauseZ: m.pauseZ, layerHeight: m.layerHeight, printer: printer.id, material: $('print-material') ? $('print-material').value : 'ASA' });
    saveFile(`${base}-${printer.id}.3mf`, new Blob([bytes], { type: 'model/3mf' }));
  } catch (e) {
    printProblem(e.message);
  }
}

// Optional: for a few minutes after an update, GitHub's cache can pair this script with an older dashboard.html.
onClick('dl-3mf', () => download('3mf'));
onClick('dl-stl', () => download('stl'));

// Owner tab: every card's print files in one ZIP. A folder per card (Bambu Studio project, STL parts, print
// notes), NFC-links.csv (each card's link, for writing the tags) and README.txt. Cards whose name can't be
// printed are left out and listed. Files are compressed one at a time, so 50+ cards fit in memory.
let allCardsBusy = false;
onClick('dl-all-cards', async () => {
  if (allCardsBusy) return;
  const cards = state.cards.slice();
  if (!cards.length) return say('all-cards-msg', 'No cards yet.', true);
  if (typeof Bambu3MF === 'undefined' || typeof Bambu3MF.zipWriter !== 'function' || typeof CardMaker.batchNotes !== 'function') {
    return say('all-cards-msg', 'The card maker is out of date in this browser. Reload the page and try again.', true);
  }
  const { printer, problem } = chosenPrinter('all-printer');
  if (problem) return say('all-cards-msg', problem, true);
  const waiting = cards.filter(c => !isLive(c)).length;
  if (waiting && !confirm(`${waiting} of ${cards.length} cards aren't published yet. Their links (tag and QR code) only work after you publish.\n\nDownload anyway?`)) return;
  allCardsBusy = true;
  $('dl-all-cards').disabled = true;
  const material = $('all-material') ? $('all-material').value : 'ASA';
  const root = `Tenaris-cards-${today()}-${printer.id}-${material}/`, zip = Bambu3MF.zipWriter(), enc = new TextEncoder();
  const made = [], skipped = [], used = new Set();
  try {
    await CardMaker.load();
    for (const [i, card] of cards.entries()) {
      say('all-cards-msg', `Making card ${i + 1} of ${cards.length}…`);
      const info = printInfo(card);
      const base = 'card-' + CardMaker.slug(card.driver + (card.note ? ' ' + card.note : ''));
      let name = base;
      for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base}-${n}`;
      used.add(name.toLowerCase());
      let m;
      try { m = CardMaker.model(info); } catch (e) { skipped.push(`${cardLabel(card)}: ${e.message}`); continue; }
      const dir = root + name + '/';
      await zip.add(`${dir}${name}-${printer.id}.3mf`, await Bambu3MF.make({ black: m.black, white: m.white, name, pauseZ: m.pauseZ, layerHeight: m.layerHeight, printer: printer.id, material }));
      await zip.add(dir + name + '-DARK.stl', m.black);
      await zip.add(dir + name + '-LIGHT.stl', m.white);
      await zip.add(dir + name + '-print-notes.txt', enc.encode(CardMaker.printNotes(info, m, { printer })));
      made.push({ driver: card.driver, holder: card.note || '', link: info.link, folder: name, live: isLive(card) });
    }
    if (!made.length) throw new Error(`None of the cards can be printed: ${skipped.join(' ')}`);
    const cell = v => { const t = /^[=+\-@]/.test(v) ? "'" + v : v; return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const csv = [['Driver', 'Holder', 'Card link', 'Folder', 'Published'], ...made.map(c => [c.driver, c.holder, c.link, c.folder, c.live ? 'Yes' : 'No'])];
    await zip.add(root + 'NFC-links.csv', enc.encode('\uFEFF' + csv.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n'));
    await zip.add(root + 'README.txt', enc.encode(CardMaker.batchNotes(made, material, skipped, printer)));
    saveFile(`Tenaris-cards-${today()}-${printer.id}-${material}.zip`, new Blob(zip.finish(), { type: 'application/zip' }));
    say('all-cards-msg', `Downloaded ${made.length} card${made.length === 1 ? '' : 's'}.` + (skipped.length ? ` Left out: ${skipped.join(' ')}` : ''), skipped.length > 0);
  } catch (e) {
    say('all-cards-msg', e.message, true);
  } finally {
    allCardsBusy = false;
    $('dl-all-cards').disabled = false;
  }
});

// ================= History =================

// Personal sign-ins: the name the owner gave them. Shared password and owner: the name typed in Settings.
const VIA = { shared: ' (shared password)', owner: ' (owner)' };

// Date and time, with the year when it isn't this year.
const whenFull = iso => {
  const d = new Date(iso);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
};

function renderHistory() {
  $('history-list').replaceChildren(...log.slice().reverse().map(entry => el('li', {},
    el('p', { class: 'eyebrow h-when', textContent: whenFull(entry.at) }),
    el('p', { class: 'h-who', textContent: entry.who ? entry.who + (VIA[entry.via] || '') : '' }),
    el('ul', {}, ...entry.what.map(t => el('li', { textContent: t }))))));
  $('no-history').hidden = log.length > 0;
}

// ================= Settings (everyone) =================

const backToDash = () => { show('dash'); renderAll(); };

// Your own sign-in: your name (set by the owner) and your password. Shared password: a typed name, and the
// shared password (which the owner can also switch off).
function renderSettings() {
  const account = me && accounts.find(a => a.email === me);
  showIf('name-box', !account);
  showIf('me-box', !!account);
  if (account && $('me-text')) $('me-text').textContent = `${account.name} (${account.email})`;
  showIf('shared-box', !account && !!shared);
}

$('my-name').oninput = e => setMyName(e.target.value.trim());

$('change-password').onclick = () => {
  passwordStep('Change the shared password', backToDash, async password => {
    await setPassword(password);
    backToDash();
  }, { warning: true, title: "Choose the new supervisors' password" });
};

const MY_PW_INTRO = 'Changes only your own sign-in.';

onClick('change-my-password', () => {
  passwordStep('Change my password', backToDash, async password => {
    await changeMyPassword(password);
    backToDash();
    say('publish-msg', 'Publish to save your new password.');
  }, { title: 'Choose your new password', intro: MY_PW_INTRO });
});

// ================= Owner tab =================

function renderOwner() {
  $('gh-status').textContent = (ghProblem ? ghProblem + ' ' : 'Connected. ') +
    `Token added ${dateLabel(github.addedAt)}${github.addedBy ? ' by ' + github.addedBy : ''}${pending.has('token') ? ' (not published yet)' : ''}.`;
  const unpublished = ['recovery', 'upgrade', 'owner-access'].some(p => pending.has(p));
  $('recovery-status').textContent = `Set up ${dateLabel(owner.at)}${unpublished ? ' (not published yet)' : ''}.`;
  $('owner-contact').value = (owner && owner.contact) || '';
  renderAccounts();
}

// People who can sign in with their own email and password, the shared password, and token advice.
function renderAccounts() {
  if (!$('account-list')) return;
  const before = new Map((published ? published.accounts : []).map(a => [a.email, a]));
  $('account-list').replaceChildren(...accounts.map(a => {
    const o = before.get(a.email);
    const status = !o ? 'Not published yet' : o.pub.x !== a.pub.x ? 'New password not published yet' : a.mustChange ? 'Not signed in yet' : 'Active';
    return el('li', {},
      el('div', {},
        el('strong', { textContent: a.name }),
        el('span', { textContent: a.email }),
        el('span', { textContent: `Added ${dateLabel(a.addedAt)}${a.addedBy ? ' by ' + a.addedBy : ''}` }),
        el('span', { class: 'badge small ' + (status === 'Active' ? 'live' : 'changes'), textContent: status })),
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'btn btn-light btn-small', textContent: 'Reset password', onclick: () => resetAccount(a) }),
        el('button', { type: 'button', class: 'btn btn-danger btn-small', textContent: 'Remove', onclick: () => removeAccount(a) })));
  }));
  showIf('no-accounts', !accounts.length);
  if ($('shared-status')) {
    $('shared-status').textContent = shared
      ? 'On' + (accounts.length ? '' : ' · add a sign-in above before turning it off')
      : 'Off';
  }
  showIf('shared-off', !!shared);
  if ($('shared-off')) $('shared-off').disabled = !accounts.length;
  showIf('shared-on', !shared);
  showIf('token-advice', !!tokenAdvice);
  if ($('token-advice-text')) $('token-advice-text').textContent = tokenAdvice;
}

async function addAccount() {
  const email = typedEmail('new-email');
  const name = $('new-name').value.trim();
  if (!email) return say('account-msg', email === null ? "That doesn't look like an email address." : 'Enter their email address.', true);
  if (!name) return say('account-msg', 'Enter their name.', true);
  if (accounts.some(a => a.email === email)) return say('account-msg', `${email} already has a sign-in. Use Reset password instead.`, true);
  say('account-msg', '');
  await issuePassword('Add sign-in', { email, name, addedAt: today(), addedBy: myName() || 'the owner' }, () => {
    $('new-email').value = $('new-name').value = '';
    say('account-msg', `Added ${name}. Publish to switch on their sign-in.`);
  });
}
onClick('add-account', addAccount);
for (const id of ['new-email', 'new-name']) if ($(id)) $(id).onkeydown = e => { if (e.key === 'Enter' && !e.repeat) addAccount(); };

function resetAccount(a) {
  if (!confirm(`Reset the password for ${a.name}?\n\nYou'll get a new temporary password to give them. Their current password stops working once you publish.`)) return;
  issuePassword('Reset password', a, () => say('account-msg', `New temporary password for ${a.name}. Publish to switch it on.`));
}

// A new key pair and temporary password (see suggestPassword) for someone. The password is shown once; their
// sign-in changes only when the owner confirms, and they must choose their own password at first sign-in.
async function issuePassword(label, account, done) {
  const password = suggestPassword();
  const s = await makeSignIn(password);
  showStep('setup-temp', label, backToDash);
  $('temp-for').textContent = `${account.name} (${account.email})`;
  $('temp-password').textContent = password;
  $('temp-saved').checked = false;
  $('temp-next').disabled = true;
  $('copy-temp').onclick = e => copy(password, e.currentTarget);
  $('temp-saved').onchange = () => ($('temp-next').disabled = !$('temp-saved').checked);
  $('temp-next').onclick = () => {
    const entry = { email: account.email, name: account.name, pub: s.pub, login: s.login, mustChange: true, addedAt: account.addedAt, addedBy: account.addedBy };
    accounts = accounts.some(a => a.email === entry.email) ? accounts.map(a => (a.email === entry.email ? entry : a)) : [...accounts, entry];
    $('temp-password').textContent = ''; // shown once
    done();
    backToDash();
  };
}

function removeAccount(a) {
  if (!confirm(`Remove the sign-in for ${a.name} (${a.email})?\n\nOnce you publish, they can't open anything published after that.`)) return;
  accounts = accounts.filter(x => x.email !== a.email);
  tokenAdvice = `${a.name} could have seen the GitHub token. Replace it.` +
    (shared ? ' If they know the shared password, use New password and token instead.' : '');
  say('account-msg', `Removed ${a.name}. Publish to switch off their sign-in.`);
  renderAccounts();
  refresh();
}

onClick('shared-off', () => {
  if (!accounts.length) return;
  if (!confirm("Turn off the shared supervisors' password?\n\nOnce you publish, everyone must sign in with their own email. Check that every supervisor has a sign-in first.")) return;
  shared = null;
  tokenAdvice = 'Anyone who knew the shared password could have seen the GitHub token. Replace it.';
  renderAccounts();
  refresh();
});

const SHARED_PW_INTRO = 'For supervisors without their own sign-in.';

onClick('shared-on', () => {
  passwordStep('Shared password', backToDash, async password => {
    await setPassword(password);
    backToDash();
  }, { title: "Choose a new shared supervisors' password", intro: SHARED_PW_INTRO });
});

$('owner-contact').oninput = e => { owner = { ...(owner || {}), contact: e.target.value.trim() }; refresh(); };

function replaceToken() {
  const advised = !!tokenAdvice;
  tokenStep('Replace GitHub token', backToDash, token => {
    github = { token, addedAt: today(), addedBy: myName() };
    pending.add('token');
    ghProblem = null;
    tokenAdvice = '';
    backToDash();
    if (advised) alert(DELETE_OLD_TOKEN);
  });
}
$('replace-token').onclick = replaceToken;
onClick('token-advice-btn', replaceToken);

const DELETE_OLD_TOKEN = 'After you publish, delete the old token on GitHub: Settings → Developer settings → Fine-grained tokens → the older "Emergency cards dashboard" token → Delete.';

$('change-owner-password').onclick = () => {
  passwordStep('Change owner password', backToDash, async ownerPassword => {
    ownerAuth = await ownerAuthFrom(ownerPassword);
    owner = { ...owner, login: await makeOwnerLogin(ownerAuth, ownerCode) };
    pending.add('owner-password');
    backToDash();
  }, { title: 'Choose a new owner password', intro: OWNER_PW_INTRO });
};

$('new-recovery').onclick = () => {
  recoveryStep('New recovery code', backToDash, async rec => {
    ownerCode = rec.code;
    owner = { contact: rec.contact, pub: rec.pub, at: rec.at, login: await makeOwnerLogin(ownerAuth, rec.code) };
    pending.add('recovery');
    backToDash();
  });
};

// A new shared password and a new GitHub token. With the shared password switched off, just the token.
$('revoke-access').onclick = () => {
  const newToken = password => tokenStep(password ? 'Take away access · step 2 of 2' : 'Take away access: new GitHub token', backToDash, async token => {
    if (password) await setPassword(password);
    github = { token, addedAt: today(), addedBy: myName() };
    pending.add('token');
    tokenAdvice = '';
    backToDash();
    alert(DELETE_OLD_TOKEN);
  });
  if (!shared) return newToken(null);
  passwordStep("Take away access · step 1 of 2: new supervisors' password", backToDash, newToken, { warning: true, title: "Choose the new supervisors' password" });
};

// ================= Publish =================

function problems() {
  const out = []; // [tab, message]
  if (!state.contacts.length) out.push(['people', 'Add at least one supervisor.']);
  state.contacts.forEach((c, i) => {
    const who = c.name.trim() || `Supervisor ${i + 1}`;
    if (!c.name.trim()) out.push(['people', `Supervisor ${i + 1} needs a name.`]);
    if (!normalizePhone(c.phone)) out.push(['people', `${who} needs a 10-digit US phone number.`]);
  });
  const phones = state.contacts.map(c => normalizePhone(c.phone)).filter(Boolean);
  if (new Set(phones).size !== phones.length) out.push(['people', 'Two supervisors have the same phone number.']);
  if (!state.message.trim()) out.push(['people', 'Write the text message.']);
  else if (!state.message.includes('{driver}')) out.push(['people', "Put {driver} in the text message, so the yard knows which driver it's about."]);
  if (!state.messageEs.trim()) out.push(['people', 'Write the Spanish text message.']);
  else if (!state.messageEs.includes('{driver}')) out.push(['people', 'Put {driver} in the Spanish text message.']);
  for (const s of state.schedule.shifts) {
    if (!s.name.trim()) out.push(['shifts', 'Every shift needs a name.']);
    if (!s.days.length) out.push(['shifts', `${s.name || 'A shift'} has no days ticked.`]);
  }
  if (TIME_OFF) out.push(...awayProblems().map(t => ['shifts', t]));
  if (!shared && !accounts.length) out.push(['owner', "Nobody but you could sign in: add a sign-in or set a shared password (Owner tab)."]);
  return out;
}

// Time off: complete, in order, not longer than a year, the cover not away too, and never everyone away at once.
function awayProblems() {
  const out = [];
  const byId = new Map(state.contacts.map(c => [c.id, c]));
  const away = state.schedule.away;
  const ok = a => byId.has(a.who) && isDate(a.from) && isDate(a.to) && a.from <= a.to && daysSince(a.from) - daysSince(a.to) <= 366;
  const overlap = (a, b) => ok(b) && b.from <= a.to && a.from <= b.to;
  for (const a of away) {
    if (!byId.has(a.who)) { out.push('Time off: choose who is away.'); continue; }
    const name = personName(byId.get(a.who));
    if (!isDate(a.from) || !isDate(a.to)) out.push(`Time off for ${name}: enter the first and last day.`);
    else if (a.to < a.from) out.push(`Time off for ${name}: the last day is before the first day.`);
    else if (!ok(a)) out.push(`Time off for ${name} is longer than a year.`);
    else if (a.to < today()) out.push(`Time off for ${name} has already ended. Check the dates.`);
    else if (away.some(b => b !== a && b.who === a.who && overlap(a, b))) out.push(`${name} has two time off entries for the same days. Combine them.`);
    else if (a.cover && byId.has(a.cover) && away.some(b => b.who === a.cover && overlap(a, b))) {
      out.push(`${personName(byId.get(a.cover))} covers for ${name} but is away then too.`);
    }
  }
  const days = new Set();
  for (const a of away.filter(ok)) for (let d = a.from; d <= a.to; d = addDays(d, 1)) days.add(d);
  const everyone = [...days].sort().find(d => { const off = awayOn(state.schedule, d); return state.contacts.every(c => off.has(c.id)); });
  if (everyone) out.push(`Everyone is away on ${dateLabel(everyone)}. Keep at least one supervisor available.`);
  return [...new Set(out)];
}

// Before sending: the new file must open with every card, and with every private key this tab knows
// (your own sign-in, the owner's recovery code, sign-ins made in this session). At least one must.
async function checkFile(file) {
  let opened = 0;
  const ways = [...Object.values(file.people), ...(file.wraps.password ? [file.wraps.password] : [])];
  for (const { wrap } of ways) {
    if (keyRing.has(wrap.pub.x)) { await openWithWrap(keyRing.get(wrap.pub.x), wrap, file); opened++; }
  }
  if (file.recovery && ownerCode) { await openWithWrap(ownerCode, file.recovery, file); opened++; }
  if (!opened || Object.keys(file.people).length !== accounts.length) throw new Error('The new file failed its check, so nothing was published. Lock, sign in again and redo your changes.');
  for (const card of state.cards) await openCard(card.key, file);
}

async function publish() {
  const issues = problems();
  if (issues.length) {
    openTab(issues[0][0]);
    return say('publish-msg', 'Fix these first: ' + issues.map(i => i[1]).join(' '), true);
  }
  // Your own sign-in: History shows the name the owner gave you. Otherwise the name typed in Settings.
  const account = me && accounts.find(a => a.email === me);
  let who = account ? account.name : myName();
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
    // Signed in while GitHub's API was busy (the data came from the site's copy): GitHub's id for the file is
    // still needed to replace it, and the check that nobody published since.
    if (!sha) {
      const res = await gh(`/repos/${REPO}/contents/${FILE}?ref=main`, { timeout: 15000 }).catch(() => null);
      if (res && res.ok) {
        const j = await res.json();
        if (published && atob(j.content.replace(/\s/g, '')) !== published.text) throw new Error(publishError(409));
        sha = j.sha;
      } else if (!res || res.status !== 404) { // 404: no file yet, so this publish creates it
        throw new Error(res ? publishError(res.status) : "Couldn't reach GitHub, so nothing was published. Check the internet connection and try again.");
      }
    }
    const data = {
      message: state.message.trim(),
      messageEs: state.messageEs.trim(),
      contacts: state.contacts.map(c => ({ id: c.id, name: c.name.trim(), role: c.role.trim(), roleEs: c.roleEs.trim(), phone: normalizePhone(c.phone) })),
      schedule: {
        ...state.schedule, timeZone: YARD_TIME_ZONE,
        fallback: state.contacts.some(c => c.id === state.schedule.fallback) ? state.schedule.fallback : state.contacts[0].id,
        ...(state.schedule.away ? { away: currentAway(state.schedule.away) } : {}),
      },
      backup: state.backup || '',
      ...(state.address === undefined ? {} : { yardAddress: state.address.trim() }),
      whatsapp: !!state.whatsapp,
    };
    const confirmed = Object.fromEntries(state.contacts.map(c => [c.id, c.confirmed || today()]));
    const via = account ? 'person' : role === 'owner' ? 'owner' : 'shared';
    const newLog = [...log, { at: new Date().toISOString(), who, ...(account ? { email: account.email } : {}), via, what }].slice(-200);
    // Every sign-in is carried forward by its public key, so publishing needs nobody else's password.
    const file = await buildFile4({ data, cards: state.cards, extra: { github, owner, log: newLog, confirmed, shared, people: accounts } });
    await checkFile(file);
    const text = JSON.stringify(file, null, 2) + '\n';

    const res = await gh(`/repos/${REPO}/contents/${FILE}`, {
      method: 'PUT',
      // A plain message on purpose: commit messages are public, so no names in them.
      body: { message: 'Update emergency card data', content: btoa(text), branch: 'main', ...(sha ? { sha } : {}) },
    });
    if (!res.ok) throw new Error(publishError(res.status));
    sha = (await res.json()).content.sha;
    ghRun++; // a GitHub check still under way is about the old file

    log = newLog;
    pending.clear();
    state = { ...data, address: savedAddress(data), contacts: data.contacts.map(c => ({ ...c, confirmed: confirmed[c.id] })), cards: state.cards };
    published = snapshot(text);
    mustPublish = false;
    deployState = 'deploying';
    ghProblem = null;
    busy = false;
    clearNotes();
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
  shared = published.shared ? clone(published.shared) : null;
  accounts = clone(published.accounts);
  ({ github, ownerAuth, ownerCode } = published);
  tokenAdvice = '';
  pending.clear();
  say('publish-msg', '');
  clearNotes();
  renderAll();
};

// "Added …. Publish to …" notes are out of date once changes are published or thrown away.
function clearNotes() {
  for (const id of ['card-msg', 'account-msg']) if ($(id)) say(id, '');
}

start();
