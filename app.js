// app.js — the emergency page (index.html).
// A card's link ends in #<card key>. Browsers never send the part after # to any
// server, so the key stays on the phone. We download the locked contacts file,
// unlock it with the key (crypto.js), and show who to call, based on who is on
// shift right now (schedule.js).

const $ = id => document.getElementById(id);
let card = null; // what the card unlocked: { driver, message, contacts, schedule }

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
  $('driver').textContent = card.driver;
  const numbers = card.contacts.map(c => clean(c.phone));
  const body = encodeURIComponent(card.message.split('{driver}').join(card.driver));
  const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

  // Group text to everyone. iPhone and Android need different link formats.
  $('text-all').textContent = `Text all ${numbers.length} contacts`;
  $('text-all').href = apple
    ? `sms:/open?addresses=${numbers.join(',')}&body=${body}`
    : `sms:${numbers.join(',')}?body=${body}`;

  // Some Android apps (e.g. Samsung Messages) want ";" between numbers instead of ",".
  $('text-retry').href = `sms:${numbers.join(';')}?body=${body}`;
  $('text-retry').hidden = apple;
}

// Who's on shift now gets the big button, then others working, then everyone off shift.
function renderOrder() {
  const { main, also, off } = arrange(card, yardNow(card.schedule.timeZone));
  $('main-label').textContent = main.shift ? 'On shift now' : 'Main contact';
  $('main-name').textContent = main.contact.name;
  $('main-detail').textContent = detailLine(main);
  $('call-main').textContent = 'Call ' + main.contact.name;
  $('call-main').href = 'tel:' + clean(main.contact.phone);

  $('also-section').hidden = !also.length;
  $('also-list').replaceChildren(...also.map(row));
  $('off-section').hidden = !off.length;
  $('off-heading').textContent = card.schedule.shifts.length ? 'Off shift · still emergency contacts' : 'Other contacts';
  $('off-list').replaceChildren(...off.map(row));

  const tz = card.schedule.timeZone;
  $('tz-note').hidden = Intl.DateTimeFormat().resolvedOptions().timeZone === tz;
  $('tz-note').textContent = `Shift times are yard time (${tz.replace(/_/g, ' ')}).`;
}

function row(entry) {
  const name = document.createElement('strong');
  name.textContent = entry.contact.name;
  const detail = document.createElement('span');
  detail.textContent = detailLine(entry);
  const who = document.createElement('div');
  who.append(name, detail);

  const call = document.createElement('a');
  call.className = 'btn btn-outline';
  call.href = 'tel:' + clean(entry.contact.phone);
  call.textContent = 'Call';
  call.setAttribute('aria-label', 'Call ' + entry.contact.name);

  const li = document.createElement('li');
  li.append(who, call);
  return li;
}

$('retry').onclick = load;
addEventListener('hashchange', load);
setInterval(() => card && renderOrder(), 60 * 1000); // keep the order right across shift changes

// Save a copy on the phone so the page still opens with weak or no data (see sw.js).
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

load();
