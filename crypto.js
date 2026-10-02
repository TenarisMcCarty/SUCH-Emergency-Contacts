// crypto.js — all the encryption, shared by the emergency page and the editor.
//
// The repo is public, so contacts.enc.json is fully encrypted (AES-GCM, 128-bit keys,
// using the browser's built-in Web Crypto). It has three parts:
//
//   "data"   The contacts and the text message, locked with a random data key.
//   "cards"  One entry per card. Each holds the data key plus that card's driver name,
//            locked with that card's own key. A card's key exists only in the card's
//            link (after the #), which browsers never send to any server.
//   "admin"  What the editor needs (data key, every card's key and name), locked with
//            the admin key, which only the admin keeps.
//
// The editor makes a brand-new data key on every save, so a removed card can't read
// anything saved after it was removed.

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

// Editor: build a new contacts.enc.json from { data, cards }.
async function buildFile(adminKey, { data, cards }) {
  const dataKey = newKey();
  const slots = [];
  for (const card of cards) {
    slots.push([await slotId(card.key), await lock(card.key, { dataKey, driver: card.driver })]);
  }
  slots.sort(([a], [b]) => (a < b ? -1 : 1)); // order reveals nothing about when cards were added
  return {
    version: 2,
    data: await lock(dataKey, data),
    cards: Object.fromEntries(slots),
    admin: await lock(adminKey, { dataKey, cards }),
  };
}

// Emergency page: open the file with a card key → { driver, message, primary, contacts }.
async function openCard(cardKey, file) {
  const slot = file.cards[await slotId(cardKey)];
  if (!slot) throw new Error('This card is not in the file.');
  const { dataKey, driver } = await unlock(cardKey, slot);
  return { driver, ...(await unlock(dataKey, file.data)) };
}

// Editor: open the file with the admin key → { cards, data }.
async function openAdmin(adminKey, file) {
  const { dataKey, cards } = await unlock(adminKey, file.admin);
  return { cards, data: await unlock(dataKey, file.data) };
}
