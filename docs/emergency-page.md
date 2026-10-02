# The emergency page

What a family sees after tapping their card or scanning its QR code, and the rules behind it.

**Contents**

1. [What's on the page](#1-whats-on-the-page)
2. [Who is the primary call](#2-who-is-the-primary-call)
3. [The group text](#3-the-group-text)
4. [English and Spanish](#4-english-and-spanish)
5. [Weak or no internet](#5-weak-or-no-internet)
6. [When a card can't be loaded](#6-when-a-card-cant-be-loaded)
7. [Privacy on the family's phone](#7-privacy-on-the-familys-phone)

---

## 1. What's on the page

From top to bottom:

| Part | What it does |
|---|---|
| Header | Tenaris logo, "Driver emergency contact", and a language button (**Español** / **English**) |
| Red banner | "Life-threatening emergency?" with a **Call 911** button. It's built into the page, so it shows even if everything else fails. |
| Driver | "Emergency contact for" and the driver's name from the card |
| **Text all N contacts** | Opens the phone's Messages app with a group text to every contact, pre-filled with the message and the driver's name. The family taps Send. |
| **Primary call** | The person who should be called first right now: name, role, which shift and until when, and a big **Call** button |
| **Also working now** | Others on a shift right now, each with a **Call** button |
| **Not scheduled · still emergency contacts** | Everyone else, each with a **Call** button. It's titled **Other contacts** if no shifts are set up. |
| Time-zone note | "Shift times are Houston time." Only shown when the phone is set to a time zone other than Houston's (Central). |
| Offline note | Only shown when the page opened from the phone's saved copy (see [section 5](#5-weak-or-no-internet)) |

Phone numbers aren't written on the page; the buttons dial or text them. The page re-sorts itself every minute, so it stays correct if it's left open across a shift change.

---

## 2. Who is the primary call

The order follows the **Shifts** tab in the dashboard, always in **Houston time** (Central):

1. Go down the shift list from the top. The **first shift that is on right now** wins.
2. On that shift, the first person ticked (in People-list order) is the **primary call**.
3. Anyone else on a shift that's on right now goes under **Also working now**. A person on two shifts appears only once, under the earlier shift.
4. Everyone else goes under **Not scheduled · still emergency contacts**, in People-list order.
5. If no shift is on, the primary call is the **fallback person** (Shifts → "If nobody is on shift, the primary call is").

**Shift timing rules:**

- A shift is on from its start time up to, but not including, its end time. A 06:00–14:00 shift is on at 13:59 and off at 14:00.
- A shift ending earlier than it starts runs past midnight and belongs to the day it **starts**. A 22:00–06:00 shift ticked for Friday covers Friday 22:00 to Saturday 06:00.
- A shift with the same start and end time runs all day on its ticked days.

With the default shifts, a weekday at 09:00 gives: primary call = 1st-shift lead; also working = the Day (8–5) staff; not scheduled = everyone else.

---

## 3. The group text

- It goes to **every** person on the People list. The text is sent by the family's phone, so it comes from their number and the yard can call or text them back.
- The message comes from the dashboard (**People → Text message**, or **In Spanish** when the page is in Spanish), with `{driver}` replaced by the driver's name.
- The family sees the message in Messages and must tap **Send** themselves. Nothing is sent automatically.
- How the link is built:

  | Phone | Format |
  |---|---|
  | iPhone / iPad | `sms:/open?addresses=+1…,+1…&body=…` |
  | Android | `sms:+1…,+1…?body=…` |

  These formats are the common ones but are still to be confirmed on real phones (see the [trial checklist](cards-and-printing.md#trial-checklist)).

---

## 4. English and Spanish

Everything the family sees is available in English and Spanish:

- the header and the 911 banner
- every heading, button and note, and the error screen
- the headings **Llamada principal** (primary call), **También trabajando ahora** (also working now) and **No programados · también son contactos de emergencia** (not scheduled · still emergency contacts)
- shift times ("hasta las 2:00 p. m.")
- the pre-filled text message

**Which language opens:**

1. The language last chosen on that phone, if any (remembered in the browser).
2. Otherwise Spanish, if the phone's language is Spanish.
3. Otherwise English.

The header button (**Español** / **English**) switches instantly and is remembered.

**What supervisors type:**

| Item | On the Spanish page |
|---|---|
| Names of people | Shown as typed |
| Roles | **Role in Spanish** if filled in, otherwise the English role |
| Shift names | **Name in Spanish** if filled in; otherwise a built-in translation for common names (1st shift → 1er turno, 2nd shift → 2º turno, 3rd shift → 3er turno, Day (8–5) → Diurno (8–5), Day → Diurno, Day shift → Turno de día, Night → Nocturno, Night shift → Turno de noche, Weekend → Fin de semana); otherwise the English name |
| Text message | **In Spanish** message; the default is "EMERGENCIA – necesito comunicarme con el conductor {driver}. Por favor llámeme a este número." |

Printed cards are English only.

---

## 5. Weak or no internet

After a phone has opened its card **once**, the page keeps a copy of itself and the (encrypted) contact data on that phone.

- **Online:** the page always fetches the latest version first, so changes from the dashboard show up within about a minute.
- **No internet, or the internet takes more than 4 seconds:** the saved copy opens, with the note *"Weak or no internet: showing the copy saved on this phone. Texts and calls still work with normal signal."*
- **A phone that has never opened the page, with no internet:** the page can't load ([section 6](#6-when-a-card-cant-be-loaded)).

Texting and calling use the phone network, not the internet, so they work wherever there's signal.

**Tip for families:** tap the card once when you receive it. That saves the copy, and also tests the card.

---

## 6. When a card can't be loaded

The page shows the 911 banner and:

> **This card couldn't be loaded.**
> **Call the backup number printed on your card.**
> [Retry]

This happens when:

- the card has been removed in the dashboard, or the link is incomplete or mistyped
- the phone has no internet and has never opened the page before
- the site itself is unreachable

The family never sees a technical error message. The backup number is printed on the card (Print & QR → Backup line), which is why it's worth setting before cards are made.

---

## 7. Privacy on the family's phone

- The card key stays on the phone; the part of the link after `#` is never sent to any server.
- The page uses no cookies, trackers or analytics, and loads nothing from other websites.
- It stores only the language choice and the offline copy (the encrypted data and the page files).
- Search engines are asked not to index the page.
