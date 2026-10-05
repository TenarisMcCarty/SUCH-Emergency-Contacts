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
8. [WhatsApp, yard address, Save to Contacts, home screen](#8-whatsapp-yard-address-save-to-contacts-home-screen)

---

## 1. What's on the page

From top to bottom:

| Part | What it does |
|---|---|
| Header | Tenaris logo, "Driver emergency contact", and a language button (**Español** / **English**) |
| Red banner | "Life-threatening emergency?" with a **Call 911** button. It's built into the page, so it shows even if everything else fails. |
| Driver | "Emergency contact for" as the big heading, in dark capitals, with the driver's name from the card underneath, smaller and in gray. The family knows who the card is for, so the name doesn't need to stand out. |
| **Text All Yard Supervisors (Preferred)** | (Spanish: *Enviar mensaje a todos los supervisores del patio (preferido)*.) Opens the phone's Messages app with a group text to every contact, pre-filled with the message and the driver's name. The family taps Send. |
| **Primary call** | The person who should be called first right now: name, role, which shift and until when, and a big **Call** button. If supervisors switch WhatsApp on, a **WhatsApp** button sits under it ([section 8](#8-whatsapp-yard-address-save-to-contacts-home-screen)). |
| **Also working now** | Others on a shift right now, each with a **Call** button |
| **Not scheduled · still emergency contacts** | Everyone else, each with a **Call** button. It's titled **Other contacts** if no shifts are set up. |
| **Yard** | The yard address (302 McCarty St, Houston, TX 77029, unless supervisors change it) with a **Directions** button. Hidden if supervisors empty the address. |
| Time-zone note | "Shift times are Houston time." Only shown when the phone is set to a time zone other than Houston's (Central). |
| Offline note | Only shown when the page opened from the phone's saved copy (see [section 5](#5-weak-or-no-internet)) |
| Bottom link | **Save yard numbers to Contacts**, small, at the very bottom so it never gets in the way of calling ([section 8](#8-whatsapp-yard-address-save-to-contacts-home-screen)) |

Phone numbers aren't written on the page; the buttons dial or text them. The page re-sorts itself every minute, so it stays correct if it's left open across a shift change.

---

## 2. Who is the primary call

The order follows the **Shifts** tab in the dashboard, always in **Houston time** (Central):

1. Go through the shifts in their order (left to right in the dashboard's **Who works each shift**). The **first shift that is on right now** wins.
2. On that shift, the first person ticked (in Supervisors-list order) is the **primary call**.
3. Anyone else on a shift that's on right now goes under **Also working now**. A person on two shifts appears only once, under the earlier shift.
4. Everyone else goes under **Not scheduled · still emergency contacts**, in Supervisors-list order.
5. If no shift is on, the primary call is the **fallback person** (Shifts → "If nobody is on shift, the primary call is"). If the fallback person is on time off, it's the first person on the Supervisors list who isn't.

**Time off** (Shifts → Time off in the dashboard):

- Someone on time off **isn't shown on the page at all** and **isn't in the group text**, from their first day to their last day (Houston dates).
- Their shifts go to the person **covering** for them, if one was chosen; that person then shows as the primary call or under Also working, with the shift. With nobody covering, the shift simply has one person fewer, and the next shift on (or the fallback person) takes over.
- A night shift belongs to the day it **starts**: someone off from Saturday still works Friday's 22:00–06:00 shift until 06:00 on Saturday, and someone whose last day off is Friday doesn't work Friday's night shift.
- If time off would leave nobody at all, it's ignored, so the page always has someone to call. (The dashboard won't publish that anyway.)
- Nothing needs undoing afterwards: the person comes back on the day after their last day.

**Shift timing rules:**

- A shift is on from its start time up to, but not including, its end time. A 06:00–14:00 shift is on at 13:59 and off at 14:00.
- A shift ending earlier than it starts runs past midnight and belongs to the day it **starts**. A 22:00–06:00 shift ticked for Friday covers Friday 22:00 to Saturday 06:00.
- A shift with the same start and end time runs 24 hours from its start: 06:00–06:00 on Monday covers Monday 06:00 to Tuesday 06:00.

With the default shifts, a weekday at 09:00 gives: primary call = 1st-shift lead; also working = the Day (8–5) staff; not scheduled = everyone else.

---

## 3. The group text

- It goes to **every** person on the Supervisors list except anyone on time off today (someone still finishing last night's shift on their first day off is included until it ends). The text is sent by the family's phone, so it comes from their number and the yard can call or text them back.
- The message comes from the dashboard (**Supervisors → Text message**, or **In Spanish** when the page is in Spanish), with `{driver}` replaced by the driver's name.
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
| Shift names | **Spanish name** if filled in; otherwise a built-in translation for common names (1st shift → 1er turno, 2nd shift → 2º turno, 3rd shift → 3er turno, Day (8–5) → Diurno (8–5), Day → Diurno, Day shift → Turno de día, Night → Nocturno, Night shift → Turno de noche, Weekend → Fin de semana); otherwise the English name |
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
- It stores the language choice, the offline copy (the encrypted data and the page files) and the link of the last card opened, so a home-screen icon can open it ([section 8](#8-whatsapp-yard-address-save-to-contacts-home-screen)).
- **Save yard numbers to Contacts** makes the contact on the phone itself. Nothing is sent anywhere.
- The **WhatsApp** and **Directions** buttons open WhatsApp and the maps app. Like any link, those apps then see what's in the link: the yard's number and the text message, or the yard address.

---

## 8. WhatsApp, yard address, Save to Contacts, home screen

**WhatsApp** (off unless supervisors switch it on in **Supervisors → WhatsApp**)

- A **WhatsApp [name]** button under the primary Call button. It opens a WhatsApp chat with the primary call, with the emergency text already written; the family taps Send.
- Only the primary call gets one: WhatsApp links can't message a group or several people at once.
- Spanish page: **WhatsApp a [name]**, with the Spanish message.

**Yard address** (**Supervisors → Yard address**; starts as 302 McCarty St, Houston, TX 77029; hidden if emptied)

- Shown under the contacts with a **Directions** button (**Cómo llegar** in Spanish). It opens Apple Maps on iPhone and Google Maps everywhere else.

**Save yard numbers to Contacts** (Spanish: *Guardar números del patio en Contactos*)

- Saves **one** contact, **Tenaris Yard Supervisors** (Spanish page: *Supervisores del patio Tenaris*), with everyone's number in it. Each number is labelled with the person's name and role, e.g. *Jane Doe – 1st shift lead* (the Spanish role on the Spanish page). The contact also has the yard address and a note: "Emergency contact for driver *…*", then each name and number.
- It's one contact, not one per person, because an iPhone only saves the first contact in a file. When anyone from the yard calls the family back, their phone shows **Tenaris Yard Supervisors**.
- **iPhone:** the contact opens straight away. Scroll down and tap **Create New Contact**.
- **Android:** the phone downloads *tenaris-yard-supervisors.vcf*. Tap **Open**, and the Contacts app adds it. Some Android phones show every number as "Mobile" instead of the person's name; the note says whose number is whose.
- Both are to be confirmed on real phones (see the [trial checklist](cards-and-printing.md#trial-checklist)).
- The saved numbers don't update themselves. The card page is always current; the saved contact is a backup. To refresh it, delete the old contact and save it again.

**Home screen**

- The page has no button for this. A family can still add it from the browser: on iPhone, **Share** (the square with an arrow), then **Add to Home Screen**; on Android, the menu (⋮), then **Add to Home screen** or **Install**. The icon is the Tenaris mark, named **Emergency**.
- Chrome on Android doesn't pop up its own install offer on this page.
- If the phone drops the card key from the link, the page opens the last card opened on that phone. A phone used for several drivers' cards (a school, say) should open each card from its card, not the icon.
- Search engines are asked not to index the page.
