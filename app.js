// app.js — the emergency page (index.html), in English or Spanish.
// A card's link ends in #<card key>. Browsers never send the part after # to any
// server, so the key stays on the phone. We download the locked contacts file,
// unlock it with the key (crypto.js), and show every yard supervisor, A–Z, with one group text to all of them.

const $ = id => document.getElementById(id);
let card = null; // what the card unlocked: { driver, message, messageEs, contacts, … }

// ================= Words on the page =================

const TEXT = {
  en: {
    title: 'Driver Emergency Contact',
    product: 'Driver emergency contact',
    switchTo: 'Español',
    lifeThreatening: 'Life-threatening emergency?',
    call911: 'Call 911',
    loading: 'Loading…',
    contactFor: 'Emergency contact for',
    textAll: 'Text All Yard Supervisors (Preferred)',
    supervisors: 'Yard supervisors',
    call: 'Call',
    callName: name => `Call ${name}`,
    yard: 'Yard',
    directions: 'Directions',
    saveContacts: 'Save yard numbers to Contacts',
    testSite: 'Test site',
    contactName: 'Tenaris Yard Supervisors',
    contactCompany: 'Tenaris',
    contactNote: driver => `Emergency contact for driver ${driver}`,
    offline: 'Weak or no internet: showing the copy saved on this phone. Texts and calls still work with normal signal.',
    error1: "This card couldn't be loaded.",
    error2: 'Call the backup number printed on your card.',
    retry: 'Retry',
    message: 'EMERGENCY – need to reach driver {driver}. Please call me back at this number.',
  },
  es: {
    title: 'Contacto de emergencia',
    product: 'Contacto de emergencia',
    switchTo: 'English',
    lifeThreatening: '¿Emergencia que pone en peligro la vida?',
    call911: 'Llame al 911',
    loading: 'Cargando…',
    contactFor: 'Contacto de emergencia para',
    textAll: 'Enviar mensaje a todos los supervisores del patio (preferido)',
    supervisors: 'Supervisores del patio',
    call: 'Llamar',
    callName: name => `Llamar a ${name}`,
    yard: 'Patio',
    directions: 'Cómo llegar',
    saveContacts: 'Guardar números del patio en Contactos',
    testSite: 'Sitio de prueba',
    contactName: 'Supervisores del patio Tenaris',
    contactCompany: 'Tenaris',
    contactNote: driver => `Contacto de emergencia del conductor ${driver}`,
    offline: 'Internet débil o sin conexión: se muestra la copia guardada en este teléfono. Los mensajes y las llamadas funcionan con señal normal.',
    error1: 'No se pudo cargar esta tarjeta.',
    error2: 'Llame al número de respaldo impreso en su tarjeta.',
    retry: 'Reintentar',
    message: 'EMERGENCIA – necesito comunicarme con el conductor {driver}. Por favor llámeme a este número.',
  },
};

// Spanish if chosen before on this phone, otherwise if the phone is set to Spanish.
function startLanguage() {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'en' || saved === 'es') return saved;
  } catch {}
  return (navigator.languages || [navigator.language]).some(l => /^es\b/i.test(l || '')) ? 'es' : 'en';
}

let lang = startLanguage();
const T = () => TEXT[lang];

// Put the fixed words on the page in the current language.
// Every element is optional: for a few minutes after an update, GitHub's cache can pair this
// script with the previous page, and the emergency page must keep working regardless.
function applyLanguage() {
  const t = T();
  document.documentElement.lang = lang;
  document.title = t.title;
  const set = { 't-product': t.product, 't-911': t.lifeThreatening, 't-call911': t.call911, loading: t.loading, 't-for': t.contactFor,
    't-list': t.supervisors, 'offline-note': t.offline, 't-error1': t.error1, 't-error2': t.error2, retry: t.retry,
    't-yard': t.yard, directions: t.directions, 'save-contacts': t.saveContacts, 'test-flag': t.testSite };
  for (const [id, words] of Object.entries(set)) if ($(id)) $(id).textContent = words;
  if ($('lang')) {
    $('lang').textContent = t.switchTo;
    $('lang').lang = lang === 'en' ? 'es' : 'en';
  }
  if (card) render();
}

if ($('test-flag') && typeof TEST_SITE !== 'undefined') $('test-flag').hidden = !TEST_SITE;

if ($('lang')) $('lang').onclick = () => {
  lang = lang === 'en' ? 'es' : 'en';
  try { localStorage.setItem('lang', lang); } catch {}
  applyLanguage();
};

// ================= Loading the card =================

// Show exactly one of the three states.
function show(id) {
  for (const s of ['loading', 'card', 'error']) $(s).hidden = s !== id;
}

// The card key from the link. Opened from the home screen without one (Android drops the part
// after #), use the card this phone opened last.
function cardKey() {
  const key = location.hash.slice(1).trim();
  if (key) return key;
  try { return localStorage.getItem('card') || ''; } catch { return ''; }
}

async function load() {
  show('loading');
  try {
    // ?v= skips GitHub's 10-minute cache, so changes from the dashboard show up within a minute.
    const res = await fetch('contacts.enc.json?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('No contacts file.');
    const key = cardKey();
    card = await openCard(key, await res.json());
    try { localStorage.setItem('card', key); } catch {}
    render();
    renderExtras();
    $('offline-note').hidden = res.headers.get('X-Offline-Copy') !== '1';
    show('card');
  } catch {
    // Missing, wrong or removed key, no internet, or no file: families only see the friendly message.
    card = null;
    show('error');
  }
}

// Keep only digits and "+" so a phone number can't become anything else inside a link.
const clean = phone => phone.replace(/[^\d+]/g, '');
const apple = () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
const textFor = () => {
  const t = T();
  const template = (lang === 'es' ? card.messageEs || t.message : card.message) || t.message;
  return template.split('{driver}').join(card.driver);
};

// Every supervisor on the card, A–Z by name as written (first name first). Same order in English and Spanish.
const supervisors = () => card.contacts.filter(c => (c.name || '').trim() && clean(c.phone || ''))
  .sort((a, b) => a.name.trim().localeCompare(b.name.trim(), 'en', { sensitivity: 'base', numeric: true }));
const roleOf = c => ((lang === 'es' && (c.roleEs || '').trim()) || c.role || '').trim();

function render() {
  const t = T();
  const people = supervisors();
  $('driver').textContent = card.driver;

  // Group text to everyone. iPhone and Android need different link formats.
  const numbers = people.map(c => clean(c.phone));
  const body = encodeURIComponent(textFor());
  $('text-all').textContent = t.textAll;
  $('text-all').href = apple()
    ? `sms:/open?addresses=${numbers.join(',')}&body=${body}`
    : `sms:${numbers.join(',')}?body=${body}`;

  // Everyone, A–Z, each with a Call button. An older cached page has no #list: use its last list, hide the rest.
  const list = $('list') || $('off-list');
  if (!$('list') && $('off-heading')) {
    $('off-heading').textContent = t.supervisors;
    $('off-section').hidden = false;
  }
  for (const id of ['main-label', 'also-section', 'whatsapp', 'tz-note']) if ($(id)) $(id).hidden = true;
  const oldMain = document.querySelector('.main-contact');
  if (oldMain) oldMain.hidden = true;
  if (list) list.replaceChildren(...people.map(row));
}

function row(contact) {
  const t = T();
  const name = document.createElement('strong');
  name.textContent = contact.name;
  const who = document.createElement('div');
  who.append(name);
  const role = roleOf(contact);
  if (role) {
    const detail = document.createElement('span');
    detail.textContent = role;
    who.append(detail);
  }

  const call = document.createElement('a');
  call.className = 'btn btn-outline';
  call.href = 'tel:' + clean(contact.phone);
  call.textContent = t.call;
  call.setAttribute('aria-label', t.callName(contact.name));

  const li = document.createElement('li');
  li.append(who, call);
  return li;
}

// ================= Yard address, Save to Contacts =================
// Everything here is optional: an older cached page may not have these elements.

// The yard address: what the dashboard saved as yardAddress ("" hides it), or the built-in one if nothing was
// saved. A non-empty "address" (this field's name for a few hours) still counts. The typeof check covers an
// older cached schedule.js for a few minutes after an update.
const yardAddress = () => (card.yardAddress ?? (card.address || undefined) ?? (typeof YARD_ADDRESS !== 'undefined' ? YARD_ADDRESS : '')).trim();

function renderExtras() {
  const address = yardAddress();
  if ($('yard-section')) {
    $('yard-section').hidden = !address;
    $('yard-address').textContent = address;
    const q = encodeURIComponent(address);
    $('directions').href = apple() ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
  }
  if ($('keep')) $('keep').hidden = false;
  // The home-screen button was removed; an older cached page may still have it and its note.
  for (const id of ['add-home', 'home-how']) if ($(id)) $(id).hidden = true;
}

// vCard text needs \ , ; and line breaks escaped.
const vEsc = s => String(s).replace(/[\\,;]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');

// ONE contact, "Tenaris Yard Supervisors", holding everyone's number: iPhone only imports the first contact
// of a file. Each number is labelled with the person's name and role the way iPhone and Google Contacts write
// custom labels (itemN.TEL + itemN.X-ABLabel). Android's Contacts app keeps every number but may drop those
// labels, so the note lists who is who as well. A call back from the yard then shows the contact's name.
function vcard() {
  const t = T();
  const people = supervisors().map(c => {
    const role = roleOf(c);
    return { label: role ? `${c.name} – ${role}` : c.name, phone: clean(c.phone) };
  }).filter(p => p.phone);
  const note = [t.contactNote(card.driver), ...people.map(p => `${p.label}: ${p.phone}`)].join('\n');
  return ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vEsc(t.contactName)}`, `N:;${vEsc(t.contactName)};;;`, `ORG:${vEsc(t.contactCompany)}`,
    ...people.flatMap((p, i) => [`item${i + 1}.TEL;TYPE=CELL:${p.phone}`, `item${i + 1}.X-ABLabel:${vEsc(p.label)}`]),
    yardAddress() ? `ADR;TYPE=WORK:;;${vEsc(yardAddress())};;;;` : '',
    `NOTE:${vEsc(note)}`, 'END:VCARD'].filter(Boolean).join('\r\n') + '\r\n';
}

// iPhone: open the file the way Safari opens a link to a .vcf, so it shows the contact with Create New Contact.
// Elsewhere (Android): download it as a named file; opening the download imports it into Contacts.
// Browsers can't show a .vcf as a page, so the emergency page stays put either way.
// The file is made on the phone; nothing is sent anywhere.
let vcardLink = '';
if ($('save-contacts')) $('save-contacts').onclick = () => {
  if (!card) return;
  if (vcardLink) URL.revokeObjectURL(vcardLink); // the previous tap's file, long since opened
  vcardLink = URL.createObjectURL(new Blob([vcard()], { type: 'text/vcard;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = vcardLink;
  if (!apple()) a.download = 'tenaris-yard-supervisors.vcf';
  document.body.append(a);
  a.click();
  a.remove();
};

// The page has no install button. Stop Chrome on Android from showing its own install bar over the emergency
// page; anyone can still add the page to the home screen from the browser menu.
addEventListener('beforeinstallprompt', e => e.preventDefault());

$('retry').onclick = load;
addEventListener('hashchange', load);

// Save a copy on the phone so the page still opens with weak or no data (see sw.js).
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

applyLanguage();
load();
