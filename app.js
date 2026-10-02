// app.js — the emergency page (index.html).
// A card's link ends in #<card key>. Browsers never send the part after # to any
// server, so the key stays on the phone. We download the locked contacts file,
// unlock it with the key (see crypto.js) and fill in the buttons.

const $ = id => document.getElementById(id);

// Show exactly one of the three states.
function show(id) {
  for (const s of ['loading', 'card', 'error']) $(s).hidden = s !== id;
}

async function load() {
  show('loading');
  try {
    const res = await fetch('contacts.enc.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('No contacts file.');
    const card = await openCard(location.hash.slice(1).trim(), await res.json());
    render(card, res.headers.get('X-Offline-Copy') === '1');
    show('card');
  } catch {
    // Missing, wrong or removed key, no internet, or no file: families only see the friendly message.
    show('error');
  }
}

// Keep only digits and "+" so a phone number can't become anything else inside a link.
const clean = phone => phone.replace(/[^\d+]/g, '');

function render({ driver, message, primary, contacts }, offline) {
  $('driver').textContent = driver;

  const numbers = contacts.map(c => clean(c.phone));
  const body = encodeURIComponent(message.split('{driver}').join(driver));
  const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

  // Group text. iPhone and Android need different link formats.
  $('text-all').textContent = `Text all ${contacts.length} contacts`;
  $('text-all').href = apple
    ? `sms:/open?addresses=${numbers.join(',')}&body=${body}`
    : `sms:${numbers.join(',')}?body=${body}`;

  // Some Android apps (e.g. Samsung Messages) want ";" between numbers instead of ",".
  $('text-retry').href = `sms:${numbers.join(';')}?body=${body}`;
  $('text-retry').hidden = apple;

  const main = contacts[primary] || contacts[0];
  $('call-primary').textContent = `Call ${main.name}`;
  $('call-primary').href = 'tel:' + clean(main.phone);

  $('contacts').replaceChildren(...contacts.map(contactRow));
  $('offline-note').hidden = !offline;
}

function contactRow(c) {
  const name = document.createElement('strong');
  name.textContent = c.name;
  const role = document.createElement('span');
  role.textContent = c.role;
  const who = document.createElement('div');
  who.append(name, role);

  const call = document.createElement('a');
  call.className = 'btn btn-small blue';
  call.href = 'tel:' + clean(c.phone);
  call.textContent = 'Call';
  call.setAttribute('aria-label', 'Call ' + c.name);

  const li = document.createElement('li');
  li.append(who, call);
  return li;
}

$('retry').onclick = load;
addEventListener('hashchange', load);

// Save a copy on the phone so the page still opens with weak or no data (see sw.js).
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

load();
