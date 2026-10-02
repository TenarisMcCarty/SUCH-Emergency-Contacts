// schedule.js — works out who is working right now, from the shifts set in the dashboard.
// Used by the emergency page (to order the contacts) and by the dashboard (status and preview).
//
// Shifts are checked in the yard's time zone, so a family in another time zone still
// sees the right person.

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// "14:00" → "2:00 PM"
function timeLabel(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// Day (0 = Monday … 6 = Sunday) and minutes since midnight, in the yard's time zone.
function yardNow(timeZone, date = new Date()) {
  const parts = {};
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return { day: DAYS.indexOf(parts.weekday), minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute) };
}

// Is this shift on? A shift that runs past midnight (e.g. 22:00–06:00) belongs to the day it starts.
function shiftOn(shift, { day, minutes }) {
  const start = toMinutes(shift.start);
  const end = toMinutes(shift.end);
  const yesterday = (day + 6) % 7;
  if (start === end) return shift.days.includes(day); // 24-hour shift
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

// "1st shift lead · 1st shift, until 2:00 PM"
function detailLine({ contact, shift }) {
  return [contact.role, shift && `${shift.name}, until ${timeLabel(shift.end)}`].filter(Boolean).join(' · ');
}
