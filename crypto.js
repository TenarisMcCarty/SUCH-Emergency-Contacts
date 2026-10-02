// crypto.js — all the encryption, shared by the emergency page and the editor.
//
// The repo is public, so contacts.enc.json is fully encrypted (AES-GCM, 128-bit keys,
// using the browser's built-in Web Crypto). It has three parts:
//
//   "data"   The contacts, shifts and text message, locked with a random data key.
//   "cards"  One entry per card. Each holds the data key plus that card's driver name,
//            locked with that card's own key. A card's key exists only in the card's
//            link (after the #), which browsers never send to any server.
//   "admin"  What the dashboard needs (data key, every card's key and name, the GitHub
//            token, the change history), locked with a key made from the dashboard
//            password. Password stretching (PBKDF2, 600,000 rounds) makes guessing slow.
//   "recovery"  The same as "admin", locked for the site owner's recovery code (a private key
//            only the owner keeps). Anyone publishing keeps it current using the owner's
//            public key, so the owner can always reset a lost password without breaking cards.
//   "ownerLogin"  The owner's recovery code, locked with the owner's own password. Signing in
//            with the owner password unlocks the code, which opens "recovery". The supervisors'
//            password can't open it.
//
// The dashboard makes a brand-new data key on every publish, so a removed card can't
// read anything published after it was removed.

const KEY_BYTES = 16; // 128-bit keys, written as 22 characters

// ---- Bytes <-> text (base64url: letters, digits, - and _ — safe inside links) ----

function toB64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64 + '==='.slice((b64.length + 3) % 4)), c => c.charCodeAt(0));
}

// ---- Keys ----

function newKey() {
  return toB64(crypto.getRandomValues(new Uint8Array(KEY_BYTES)));
}

function isKey(text) {
  return /^[A-Za-z0-9_-]{22}$/.test(text);
}

async function importKey(keyText) {
  if (!isKey(keyText)) throw new Error('Not a valid key.');
  return crypto.subtle.importKey('raw', fromB64(keyText), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

// Turn the dashboard password into a key. The salt is random and stored in the file.
async function passwordKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(salt), iterations }, base, KEY_BYTES * 8);
  return toB64(new Uint8Array(bits));
}

function newSalt() {
  return toB64(crypto.getRandomValues(new Uint8Array(16)));
}

// ---- Owner recovery code (ECDH P-256) ----
const EC = { name: 'ECDH', namedCurve: 'P-256' };

// A new recovery code (the private key, 43 characters) and its public half.
async function newRecovery() {
  const pair = await crypto.subtle.generateKey(EC, true, ['deriveBits']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { code: jwk.d, pub: { x: jwk.x, y: jwk.y } };
}

async function sharedKey(privateKey, pub) {
  const publicKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', ...pub }, EC, false, []);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256));
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array([...bits, ...new TextEncoder().encode('SUCH emergency cards recovery')]));
  return toB64(new Uint8Array(hash).slice(0, KEY_BYTES));
}

// Lock a value so only the holder of the recovery code for `pub` can open it.
async function lockForOwner(pub, value) {
  const once = await crypto.subtle.generateKey(EC, true, ['deriveBits']);
  const epk = await crypto.subtle.exportKey('jwk', once.publicKey);
  return { pub, epk: { x: epk.x, y: epk.y }, ...(await lock(await sharedKey(once.privateKey, pub), value)) };
}

// ---- Lock / unlock any value. A wrong key or a changed file makes unlock() fail. ----

async function lock(keyText, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importKey(keyText), plain);
  return { iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

async function unlock(keyText, box) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(box.iv) }, await importKey(keyText), fromB64(box.ct));
  return JSON.parse(new TextDecoder().decode(plain));
}

// Which "cards" entry belongs to a card key: a one-way fingerprint, so the public
// file doesn't reveal any keys.
async function slotId(cardKey) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('slot:' + cardKey));
  return toB64(new Uint8Array(hash)).slice(0, 12);
}

// ---- The whole file ----

// Dashboard: build a new contacts.enc.json.
//   admin = { key, salt, iterations } from the password
//   extra = anything else only the dashboard should see (GitHub token, history)
async function buildFile(admin, { data, cards, extra }) {
  const dataKey = newKey();
  const slots = [];
  for (const card of cards) {
    slots.push([await slotId(card.key), await lock(card.key, { dataKey, driver: card.driver })]);
  }
  slots.sort(([a], [b]) => (a < b ? -1 : 1)); // order reveals nothing about when cards were added
  return {
    version: 3,
    data: await lock(dataKey, data),
    cards: Object.fromEntries(slots),
    admin: {
      kdf: 'PBKDF2-SHA256', iterations: admin.iterations, salt: admin.salt,
      ...(await lock(admin.key, { ...extra, dataKey, cards })),
    },
    ...(extra.owner && extra.owner.pub ? { recovery: await lockForOwner(extra.owner.pub, { ...extra, dataKey, cards }) } : {}),
    ...(extra.owner && extra.owner.login ? { ownerLogin: extra.owner.login } : {}),
  };
}

// The owner password locks the recovery code. ownerAuth = { key, salt, iterations } from the owner password.
async function makeOwnerLogin(ownerAuth, code) {
  return { kdf: 'PBKDF2-SHA256', iterations: ownerAuth.iterations, salt: ownerAuth.salt, ...(await lock(ownerAuth.key, { code })) };
}

// Owner sign-in: owner password → recovery code → everything. Throws on a wrong password.
async function openOwner(password, file) {
  const login = file.ownerLogin;
  if (!login) throw new Error('Owner access is not set up.');
  const key = await passwordKey(password, login.salt, login.iterations);
  const { code } = await unlock(key, login);
  return { code, auth: { key, salt: login.salt, iterations: login.iterations }, opened: await openRecovery(code, file) };
}

// Emergency page: open the file with a card key → { driver, message, contacts, schedule }.
async function openCard(cardKey, file) {
  const slot = file.cards[await slotId(cardKey)];
  if (!slot) throw new Error('This card is not in the file.');
  const { dataKey, driver } = await unlock(cardKey, slot);
  return { driver, ...(await unlock(dataKey, file.data)) };
}

// Dashboard: open the file with the owner's recovery code → { cards, data, ...extra }.
async function openRecovery(code, file) {
  const r = file.recovery;
  if (!r) throw new Error('This data has no recovery code.');
  const privateKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', ...r.pub, d: code.trim() }, EC, false, ['deriveBits']);
  const { dataKey, ...rest } = await unlock(await sharedKey(privateKey, r.epk), r);
  return { ...rest, data: await unlock(dataKey, file.data) };
}

// Dashboard: open the file with the password's key → { cards, data, ...extra }.
async function openAdmin(adminKey, file) {
  const { dataKey, ...rest } = await unlock(adminKey, file.admin);
  return { ...rest, data: await unlock(dataKey, file.data) };
}
