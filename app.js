// app.js — the emergency page (index.html), in English or Spanish.
// A card's link ends in #<card key>. Browsers never send the part after # to any
// server, so the key stays on the phone. We download the locked contacts file,
// unlock it with the key (crypto.js), and show who to call, based on who is on
// shift right now (schedule.js).

const $ = id => document.getElementById(id);
let card = null; // what the card unlocked: { driver, message, messageEs, contacts, schedule }

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
    textAll: n => `Text all ${n} contacts`,
    hint: ['Then tap ', 'Send', '. The text comes from your phone, so they can call you back.'],
    retryText: "Didn't get all of them? Try again",
    onShift: 'On shift now',
    mainContact: 'Main contact',
    alsoWorking: 'Also working now',
    offShift: 'Off shift · still emergency contacts',
    others: 'Other contacts',
    call: 'Call',
    callName: name => `Call ${name}`,
    tzNote: tz => `Shift times are yard time (${tz}).`,
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
    textAll: n => `Enviar mensaje a los ${n} contactos`,
    hint: ['Luego toque ', 'Enviar', '. El mensaje sale de su teléfono, así que podrán devolverle la llamada.'],
    retryText: '¿No aparecen todos? Intente de nuevo',
    onShift: 'En turno ahora',
    mainContact: 'Contacto principal',
    alsoWorking: 'También trabajando ahora',
    offShift: 'Fuera de turno · también son contactos de emergencia',
    others: 'Otros contactos',
    call: 'Llamar',
    callName: name => `Llamar a ${name}`,
    tzNote: tz => `Los horarios de turno están en la hora del patio (${tz}).`,
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
function applyLanguage() {
  const t = T();
  document.documentElement.lang = lang;
  document.title = t.title;
  const set = { 't-product': t.product, 't-911': t.lifeThreatening, 't-call911': t.call911, loading: t.loading, 't-for': t.contactFor,
    'text-retry': t.retryText, 't-also': t.alsoWorking, 'offline-note': t.offline, 't-error1': t.error1, 't-error2': t.error2, retry: t.retry };
  for (const [id, words] of Object.entries(set)) $(id).textContent = words;
  const [before, send, after] = t.hint;
  const strong = document.createElement('strong');
  strong.textContent = send;
  $('hint').replaceChildren(before, strong, after);
  $('lang').textContent = t.switchTo;
  $('lang').lang = lang === 'en' ? 'es' : 'en';
  if (card) { renderTextButtons(); renderOrder(); }
}

$('lang').onclick = () => {
  lang = lang === 'en' ? 'es' : 'en';
  try { localStorage.setItem('lang', lang); } catch {}
  applyLanguage();
};

// ================= Loading the card =================

// Show exactly one of the three states.
function show(id) {
  for (const s of ['loading', 'card', 'error']) $(s).hidden = s !== id;
}

async function load() {
  show('loading');
  try {
    // ?v= skips GitHub's 10-minute cache, so changes from the dashboard show up within a minute.
    const res = await fetch('contacts.enc.json?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('No contacts file.');
    card = withSchedule(await openCard(location.hash.slice(1).trim(), await res.json()));
    renderTextButtons();
    renderOrder();
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

function renderTextButtons() {
  const t = T();
  $('driver').textContent = card.driver;
  const numbers = card.contacts.map(c => clean(c.phone));
  const template = (lang === 'es' ? card.messageEs || t.message : card.message) || t.message;
  const body = encodeURIComponent(template.split('{driver}').join(card.driver));
  const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

  // Group text to everyone. iPhone and Android need different link formats.
  $('text-all').textContent = t.textAll(numbers.length);
  $('text-all').href = apple
    ? `sms:/open?addresses=${numbers.join(',')}&body=${body}`
    : `sms:${numbers.join(',')}?body=${body}`;

  // Some Android apps (e.g. Samsung Messages) want ";" between numbers instead of ",".
  $('text-retry').href = `sms:${numbers.join(';')}?body=${body}`;
  $('text-retry').hidden = apple;
}

// Who's on shift now gets the big button, then others working, then everyone off shift.
function renderOrder() {
  const t = T();
  const { main, also, off } = arrange(card, yardNow(card.schedule.timeZone));
  $('main-label').textContent = main.shift ? t.onShift : t.mainContact;
  $('main-name').textContent = main.contact.name;
  $('main-detail').textContent = detailLine(main, lang);
  $('call-main').textContent = t.callName(main.contact.name);
  $('call-main').href = 'tel:' + clean(main.contact.phone);

  $('also-section').hidden = !also.length;
  $('also-list').replaceChildren(...also.map(row));
  $('off-section').hidden = !off.length;
  $('off-heading').textContent = card.schedule.shifts.length ? t.offShift : t.others;
  $('off-list').replaceChildren(...off.map(row));

  const tz = card.schedule.timeZone;
  $('tz-note').hidden = Intl.DateTimeFormat().resolvedOptions().timeZone === tz;
  $('tz-note').textContent = t.tzNote(tz.replace(/_/g, ' '));
}

function row(entry) {
  const t = T();
  const name = document.createElement('strong');
  name.textContent = entry.contact.name;
  const detail = document.createElement('span');
  detail.textContent = detailLine(entry, lang);
  const who = document.createElement('div');
  who.append(name, detail);

  const call = document.createElement('a');
  call.className = 'btn btn-outline';
  call.href = 'tel:' + clean(entry.contact.phone);
  call.textContent = t.call;
  call.setAttribute('aria-label', t.callName(entry.contact.name));

  const li = document.createElement('li');
  li.append(who, call);
  return li;
}

$('retry').onclick = load;
addEventListener('hashchange', load);
setInterval(() => card && renderOrder(), 60 * 1000); // keep the order right across shift changes

// Save a copy on the phone so the page still opens with weak or no data (see sw.js).
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

applyLanguage();
load();
