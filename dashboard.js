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
const today = () => new Date().toISOString().slice(0, 10);
const when = iso => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const personName = c => c.name.trim() || 'a person with no name';
const daysSince = iso => Math.floor((Date.parse(today()) - Date.parse(iso)) / 864e5);
const dateLabel = iso => new Date(iso + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
const isDue = c => c.phone && daysSince(c.confirmed) >= CHECK_DAYS;
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
    if (own && own.length < 20) return say('pw-msg', 'Your own password needs at least 20 characters, or clear it to use the suggested one.', true);
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
  // When each number was last checked (kept with the dashboard data, not on the cards).
  // Numbers from before this was tracked count as checked on the last publish.
  const checked = opened.confirmed || {};
  const lastPublish = log.length ? log[log.length - 1].at.slice(0, 10) : today();
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

// The yard address is saved as "yardAddress" ("" hides it). Without one, cards show the built-in YARD_ADDRESS,
// and so does this box. (A few hours' worth of dashboards wrote "address" and saved "" automatically,
// so a non-empty "address" still counts but an empty one doesn't.) undefined = leave it out of the file.
function savedAddress(data) {
  const saved = data.yardAddress ?? (data.address || undefined);
  return saved ?? (typeof YARD_ADDRESS !== 'undefined' ? YARD_ADDRESS : undefined);
}

// ================= Tabs =================

let tab = 'people';
for (const b of document.querySelectorAll('[data-tab]')) b.onclick = () => openTab(b.dataset.tab);

function openTab(name) {
  tab = name;
  for (const b of document.querySelectorAll('[data-tab]')) b.classList.toggle('active', b.dataset.tab === name);
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
    if (JSON.stringify(before.schedule) !== JSON.stringify(state.schedule)) out.push('Changed shifts');
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
  else if (list.length && !published) [label, cls, text] = ['Not live yet', 'changes', 'Fill in People, Shifts and Cards, then Publish.'];
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
    `${state.contacts.length} ${state.contacts.length === 1 ? 'person' : 'people'}`, `${state.cards.length} card${state.cards.length === 1 ? '' : 's'}`,
    last && `last published ${when(last.at)}${last.who ? ' by ' + last.who : ''}`,
  ].filter(Boolean).join(' · ');
}

// Who the cards point to at this moment (with your unpublished changes included).
function renderNow() {
  const now = yardNow(YARD_TIME_ZONE);
  $('now-time').textContent = `(Houston time ${DAYS[now.day]} ${timeLabel(`${Math.floor(now.minutes / 60)}:${now.minutes % 60}`)})`;
  const ready = state.contacts.filter(c => c.name.trim());
  if (!ready.length) {
    $('now-main').textContent = 'Add people to see who the cards will call.';
    $('now-also').textContent = '';
    return;
  }
  const { main, also } = arrange({ contacts: ready, schedule: state.schedule }, now);
  $('now-main').textContent = `Primary call: ${main.contact.name}` + (main.shift ? ` (${main.shift.name}, until ${timeLabel(main.shift.end)})` : ' (fallback, nobody on shift)');
  $('now-also').textContent = also.length ? 'Also working: ' + also.map(a => `${a.contact.name} (${a.shift.name})`).join(', ') : '';
}
setInterval(() => state && renderNow(), 30 * 1000);

// ================= People =================

function renderPeople() {
  $('people-list').replaceChildren(...state.contacts.map((c, i) => {
    const input = (label, key, extra = {}) => el('label', {}, label, el('input', {
      value: c[key], autocomplete: 'off', ...extra,
      oninput: e => {
        c[key] = e.target.value;
        if (key === 'phone') c.confirmed = today(); // a new number counts as checked
        refresh();
      },
    }));
    const due = isDue(c);
    const checked = c.phone && el('p', { class: 'checked' + (due ? ' due' : '') },
      due ? `Number not checked since ${dateLabel(c.confirmed)}.`
        : `Number checked ${c.confirmed === today() ? 'today' : dateLabel(c.confirmed)}.`,
      due && el('button', { type: 'button', class: 'btn btn-light btn-small', textContent: 'Still right', onclick: () => {
        c.confirmed = today();
        renderPeople();
        refresh();
      } }));
    return el('fieldset', { class: 'box person' },
      el('legend', { textContent: `Person ${i + 1}` }),
      el('div', { class: 'field-row' },
        input('Name', 'name'),
        input('Role', 'role', { placeholder: 'e.g. 1st shift lead' }),
        input('Role in Spanish (optional)', 'roleEs', { placeholder: 'e.g. Supervisor del 1er turno', lang: 'es' }),
        input('Phone', 'phone', {
          type: 'tel', placeholder: '(555) 555-0100',
          onchange: e => { const p = normalizePhone(e.target.value); if (p) { c.phone = e.target.value = p; refresh(); } },
        })),
      checked,
      el('button', { type: 'button', class: 'link-btn box-remove', textContent: 'Remove person', onclick: () => removePerson(c) }));
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
$('message-es').oninput = e => { state.messageEs = e.target.value; refresh(); };
$('address').oninput = e => { state.address = e.target.value; refresh(); };
$('whatsapp-on').onchange = e => { state.whatsapp = e.target.checked; refresh(); };
$('due-open').onclick = () => openTab('people');

// ================= Shifts =================

function renderShifts() {
  const s = state.schedule;
  $('shift-list').replaceChildren(...s.shifts.map(shiftBox));
  $('fallback').replaceChildren(...state.contacts.map(c => el('option', { value: c.id, textContent: personName(c), selected: c.id === s.fallback })));
  if (!$('preview-day').options.length) {
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

function shiftBox(shift) {
  const changed = () => { refresh(); renderPreview(); renderGaps(); };
  const legend = el('legend', { textContent: shift.name || 'Shift' });
  const autoEs = () => { const es = shiftName({ ...shift, nameEs: '' }, 'es'); return es !== shift.name ? `${es} (automatic)` : 'e.g. Turno de noche'; };
  const esName = el('input', { value: shift.nameEs || '', placeholder: autoEs(), lang: 'es', oninput: e => { shift.nameEs = e.target.value; changed(); } });
  return el('fieldset', { class: 'box shift' },
    legend,
    el('div', { class: 'field-row' },
      el('label', {}, 'Name', el('input', { value: shift.name, oninput: e => { shift.name = e.target.value; legend.textContent = shift.name || 'Shift'; esName.placeholder = autoEs(); changed(); } })),
      el('label', {}, 'Spanish name (optional)', esName)),
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
    el('button', { type: 'button', class: 'link-btn box-remove', textContent: 'Remove shift', onclick: () => {
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
$('fallback').onchange = e => { state.schedule.fallback = e.target.value; refresh(); renderPreview(); renderGaps(); };
$('preview-day').onchange = $('preview-time').onchange = () => renderPreview();

// What a card would show at the chosen day and time.
function renderPreview() {
  const [h, m] = ($('preview-time').value || '15:00').split(':').map(Number);
  const ready = state.contacts.filter(c => c.name.trim());
  if (!ready.length) return $('preview').replaceChildren(el('li', { textContent: 'Add people first.' }));
  const { main, also, off } = arrange({ contacts: ready, schedule: state.schedule }, { day: Number($('preview-day').value), minutes: h * 60 + m });
  $('preview').replaceChildren(
    el('li', { class: 'preview-main' }, el('strong', { textContent: 'Primary call: ' + main.contact.name }), main.shift ? ` (${main.shift.name})` : ' (fallback, nobody on shift)'),
    ...also.map(a => el('li', { textContent: `Also working: ${a.contact.name} (${a.shift.name})` })),
    ...off.map(o => el('li', { class: 'muted', textContent: `Not scheduled: ${o.contact.name}` })));
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
  const driver = prompt('Driver name and ID:', card.driver);
  if (driver === null || !driver.trim()) return;
  const note = prompt('Given to (only shown here):', card.note);
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
    const m = CardMaker.model(info);
    const bytes = await Bambu3MF.make({ black: m.black, white: m.white, name: base, pauseZ: m.pauseZ, layerHeight: m.layerHeight, material: $('print-material') ? $('print-material').value : 'ASA' });
    saveFile(base + '.3mf', new Blob([bytes], { type: 'model/3mf' }));
  } catch (e) {
    printProblem(e.message);
  }
}

// Optional: for a few minutes after an update, GitHub's cache can pair this script with an older dashboard.html.
onClick('dl-3mf', () => download('3mf'));
onClick('dl-stl', () => download('stl'));

// ================= History =================

// Personal sign-ins: the name the owner gave them. Shared password and owner: the name typed in Settings.
const VIA = { shared: ' (shared password)', owner: ' (owner)' };

function renderHistory() {
  $('history-list').replaceChildren(...log.slice().reverse().map(entry => el('li', {},
    el('p', { class: 'eyebrow', textContent: `${when(entry.at)}${entry.who ? ' · ' + entry.who + (VIA[entry.via] || '') : ''}` }),
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
    `Token added ${github.addedAt}${github.addedBy ? ' by ' + github.addedBy : ''}${pending.has('token') ? ' (not published yet)' : ''}.`;
  const unpublished = ['recovery', 'upgrade', 'owner-access'].some(p => pending.has(p));
  $('recovery-status').textContent = `Set up ${owner.at || ''}${unpublished ? ' (not published yet)' : ''}.`;
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
        el('span', { textContent: `Added ${a.addedAt}${a.addedBy ? ' by ' + a.addedBy : ''}` }),
        el('span', { class: 'badge small ' + (status === 'Active' ? 'live' : 'changes'), textContent: status })),
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'btn btn-light btn-small', textContent: 'Reset password', onclick: () => resetAccount(a) }),
        el('button', { type: 'button', class: 'btn btn-danger btn-small', textContent: 'Remove', onclick: () => removeAccount(a) })));
  }));
  showIf('no-accounts', !accounts.length);
  if ($('shared-status')) {
    $('shared-status').textContent = shared
      ? 'On' + (accounts.length ? '' : ' · add a person above before turning it off')
      : 'Off';
  }
  showIf('shared-off', !!shared);
  if ($('shared-off')) $('shared-off').disabled = !accounts.length;
  showIf('shared-on', !shared);
  showIf('token-advice', !!tokenAdvice);
  if ($('token-advice-text')) $('token-advice-text').textContent = tokenAdvice;
}

onClick('add-account', async () => {
  const email = typedEmail('new-email');
  const name = $('new-name').value.trim();
  if (!email) return say('account-msg', email === null ? "That doesn't look like an email address." : 'Enter their email address.', true);
  if (!name) return say('account-msg', 'Enter their name.', true);
  if (accounts.some(a => a.email === email)) return say('account-msg', `${email} already has a sign-in. Use Reset password instead.`, true);
  say('account-msg', '');
  await issuePassword('Add person', { email, name, addedAt: today(), addedBy: myName() || 'the owner' }, () => {
    $('new-email').value = $('new-name').value = '';
    say('account-msg', `Added ${name}. Publish to switch on their sign-in.`);
  });
});

function resetAccount(a) {
  if (!confirm(`Reset the password for ${a.name}?\n\nYou'll get a new temporary password to give them. Their current password stops working once you publish.`)) return;
  issuePassword('Reset password', a, () => say('account-msg', `New temporary password for ${a.name}. Publish to switch it on.`));
}

// A new key pair and temporary password (5 random words) for someone. The password is shown once; their
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
  if (!state.contacts.length) out.push(['people', 'Add at least one person.']);
  state.contacts.forEach((c, i) => {
    const who = c.name.trim() || `Person ${i + 1}`;
    if (!c.name.trim()) out.push(['people', `Person ${i + 1} needs a name.`]);
    if (!normalizePhone(c.phone)) out.push(['people', `${who} needs a 10-digit US phone number.`]);
  });
  const phones = state.contacts.map(c => normalizePhone(c.phone)).filter(Boolean);
  if (new Set(phones).size !== phones.length) out.push(['people', 'Two people have the same phone number.']);
  if (!state.message.trim()) out.push(['people', 'Write the text message.']);
  if (!state.messageEs.trim()) out.push(['people', 'Write the Spanish text message.']);
  for (const s of state.schedule.shifts) {
    if (!s.name.trim()) out.push(['shifts', 'Every shift needs a name.']);
    if (!s.days.length) out.push(['shifts', `${s.name || 'A shift'} has no days ticked.`]);
  }
  if (!shared && !accounts.length) out.push(['owner', "Nobody but you could sign in: add a person or set a shared password (Owner tab)."]);
  return out;
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
    const data = {
      message: state.message.trim(),
      messageEs: state.messageEs.trim(),
      contacts: state.contacts.map(c => ({ id: c.id, name: c.name.trim(), role: c.role.trim(), roleEs: c.roleEs.trim(), phone: normalizePhone(c.phone) })),
      schedule: { ...state.schedule, timeZone: YARD_TIME_ZONE, fallback: state.contacts.some(c => c.id === state.schedule.fallback) ? state.schedule.fallback : state.contacts[0].id },
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

    log = newLog;
    pending.clear();
    state = { ...data, address: savedAddress(data), contacts: data.contacts.map(c => ({ ...c, confirmed: confirmed[c.id] })), cards: state.cards };
    published = snapshot(text);
    mustPublish = false;
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
  shared = published.shared ? clone(published.shared) : null;
  accounts = clone(published.accounts);
  ({ github, ownerAuth, ownerCode } = published);
  tokenAdvice = '';
  pending.clear();
  say('publish-msg', '');
  renderAll();
};

start();
