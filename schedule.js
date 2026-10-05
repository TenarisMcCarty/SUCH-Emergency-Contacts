// schedule.js — works out who is working right now, from the shifts set in the dashboard.
// Used by the emergency page (to order the contacts) and by the dashboard (status and preview).
//
// Shifts are always checked in Houston time (YARD_TIME_ZONE), so a family in another
// time zone still sees the right person.

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const YARD_TIME_ZONE = 'America/Chicago'; // the yard is in Houston: shift times are always Houston time
const YARD_ADDRESS = '302 McCarty St, Houston, TX 77029'; // shown until the dashboard saves a different one (or clears it)

// The test copy of the site lives in a repository ending in "-staging"; it says so on every page.
const TEST_SITE = /-staging\//.test(location.pathname);

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// "14:00" → "2:00 PM" (Spanish: "2:00 p. m.")
function timeLabel(hhmm, lang = 'en') {
  const [h, m] = hhmm.split(':').map(Number);
  const time = `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;
  if (lang === 'es') return `${time} ${h < 12 ? 'a. m.' : 'p. m.'}`;
  return `${time} ${h < 12 ? 'AM' : 'PM'}`;
}

// Spanish for the usual shift names, used when no Spanish name was typed in the dashboard.
const SHIFT_NAMES_ES = {
  '1st shift': '1er turno', '2nd shift': '2º turno', '3rd shift': '3er turno',
  'day (8–5)': 'Diurno (8–5)', 'day (8-5)': 'Diurno (8–5)', 'day': 'Diurno', 'day shift': 'Turno de día',
  'night': 'Nocturno', 'night shift': 'Turno de noche', 'weekend': 'Fin de semana',
};

function shiftName(shift, lang = 'en') {
  if (lang !== 'es') return shift.name;
  return (shift.nameEs || '').trim() || SHIFT_NAMES_ES[shift.name.trim().toLowerCase()] || shift.name;
}

// Day (0 = Monday … 6 = Sunday) and minutes since midnight, in the yard's time zone.
function yardNow(timeZone, date = new Date()) {
  const parts = {};
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return { day: DAYS.indexOf(parts.weekday), minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute) };
}

// Is this shift on? A shift that runs past midnight (e.g. 22:00–06:00) belongs to the day it starts.
// Starting and ending at the same time is a 24-hour shift: 06:00–06:00 on Monday runs until Tuesday 06:00.
function shiftOn(shift, { day, minutes }) {
  const start = toMinutes(shift.start);
  const end = toMinutes(shift.end);
  const yesterday = (day + 6) % 7;
  if (start < end) return shift.days.includes(day) && minutes >= start && minutes < end;
  return (shift.days.includes(day) && minutes >= start) || (shift.days.includes(yesterday) && minutes < end);
}

// Put the contacts in calling order for a moment in time:
//   main  who gets the big Call button: the first person on the first shift (in dashboard
//         order) that is on now, or the fallback contact if nobody is on shift
//   also  everyone else working now
//   off   everyone else: home, but still an emergency contact
// Each entry is { contact, shift }; shift is null for anyone not working.
function arrange({ contacts, schedule }, now) {
  const working = [];
  const placed = new Set();
  for (const shift of schedule.shifts) {
    if (!shiftOn(shift, now)) continue;
    for (const contact of contacts) {
      if (shift.people.includes(contact.id) && !placed.has(contact.id)) {
        placed.add(contact.id);
        working.push({ contact, shift });
      }
    }
  }
  let main = working.shift();
  if (!main) {
    const contact = contacts.find(c => c.id === schedule.fallback) || contacts[0];
    if (!contact) return { main: null, also: [], off: [] };
    main = { contact, shift: null };
    placed.add(contact.id);
  }
  const off = contacts.filter(c => !placed.has(c.id)).map(contact => ({ contact, shift: null }));
  return { main, also: working, off };
}

// Data saved by the first version (before shifts existed) has no shifts or contact ids:
// fill them in so it still works. The old main contact becomes the fallback.
function withSchedule(data) {
  const contacts = data.contacts.map((c, i) => ({ ...c, id: c.id || 'c' + i }));
  const main = contacts[data.primary || 0] || contacts[0];
  const schedule = data.schedule || {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    fallback: main ? main.id : null,
    shifts: [],
  };
  return { ...data, contacts, schedule };
}

// "1st shift lead · 1st shift, until 2:00 PM" (Spanish: "… · 1er turno, hasta las 2:00 p. m.")
function detailLine({ contact, shift }, lang = 'en') {
  const role = lang === 'es' ? (contact.roleEs || '').trim() || contact.role : contact.role;
  let until = '';
  if (shift) {
    const hour = Number(shift.end.split(':')[0]) % 12;
    until = lang === 'es'
      ? `${shiftName(shift, lang)}, hasta ${hour === 1 ? 'la' : 'las'} ${timeLabel(shift.end, lang)}`
      : `${shift.name}, until ${timeLabel(shift.end)}`;
  }
  return [role, until].filter(Boolean).join(' · ');
}
