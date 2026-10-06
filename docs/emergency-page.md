# The emergency page

What a family sees after tapping their card or scanning its QR code, and the rules behind it.

**Contents**

1. [What's on the page](#1-whats-on-the-page)
2. [The group text](#2-the-group-text)
3. [English and Spanish](#3-english-and-spanish)
4. [Weak or no internet](#4-weak-or-no-internet)
5. [When a card can't be loaded](#5-when-a-card-cant-be-loaded)
6. [Privacy on the family's phone](#6-privacy-on-the-familys-phone)
7. [Yard address, Save to Contacts, home screen](#7-yard-address-save-to-contacts-home-screen)

---

## 1. What's on the page

From top to bottom:

| Part | What it does |
|---|---|
| Header | Tenaris logo, "Driver emergency contact", and a language button (**Español** / **English**) |
| Red banner | "Life-threatening emergency?" with a **Call 911** button. It's built into the page, so it shows even if everything else fails. |
| Driver | "Emergency contact for" as the big heading, in dark capitals, with the driver's name from the card underneath, smaller and in gray. The family knows who the card is for, so the name doesn't need to stand out. |
| **Text All Yard Supervisors (Preferred)** | (Spanish: *Enviar mensaje a todos los supervisores del patio (preferido)*.) The big green button, and the main action. Opens the phone's Messages app with a group text to **every** supervisor, pre-filled with the message and the driver's name. The family taps Send. |
| **Yard supervisors** | (Spanish: *Supervisores del patio*.) Every supervisor, each with their name, their role or title (the Spanish role on the Spanish page, if one is set) and a small outlined **Call** button. Sorted A–Z by name, as written. |
| **Yard** | The yard address (302 McCarty St, Houston, TX 77029, unless supervisors change it) with a **Directions** button. Hidden if supervisors empty the address. |
| Offline note | Only shown when the page opened from the phone's saved copy (see [section 4](#4-weak-or-no-internet)) |
| Bottom link | **Save yard numbers to Contacts**, small, at the very bottom so it never gets in the way of calling ([section 7](#7-yard-address-save-to-contacts-home-screen)) |

Phone numbers aren't written on the page; the buttons dial or text them. Nothing on the page depends on the time of day, so it looks the same whenever it's opened.

**The order of the list:** A–Z by the name as written, which is normally first name first, so *Alex Rivera* comes before *Sam Adams*. The Spanish page uses the same order. The order of the Supervisors tab in the dashboard doesn't matter; the page sorts the list itself.

---

## 2. The group text

- It goes to **every** person on the Supervisors list. The text is sent by the family's phone, so it comes from their number and the yard can call or text them back.
- The message comes from the dashboard (**Supervisors → Text message**, or **In Spanish** when the page is in Spanish), with `{driver}` replaced by the driver's name.
- The family sees the message in Messages and must tap **Send** themselves. Nothing is sent automatically.
- How the link is built:

  | Phone | Format |
  |---|---|
  | iPhone / iPad | `sms:/open?addresses=+1…,+1…&body=…` |
  | Android | `sms:+1…,+1…?body=…` |

  These formats are the common ones but are still to be confirmed on real phones (see the [trial checklist](cards-and-printing.md#trial-checklist)).

---

## 3. English and Spanish

Everything the family sees is available in English and Spanish:

- the header and the 911 banner
- every heading, button and note, and the error screen
- the heading **Supervisores del patio** (yard supervisors)
- the pre-filled text message

**Which language opens:**

1. The language last chosen on that phone, if any (remembered in the browser).
2. Otherwise Spanish, if the phone's language is Spanish.
3. Otherwise English.

The header button (**Español** / **English**) switches instantly and is remembered.

**What supervisors type:**

| Item | On the Spanish page |
|---|---|
| Names of people | Shown as typed, and sorted A–Z by that name, the same as on the English page |
| Roles | **Role in Spanish** if filled in, otherwise the English role |
| Text message | **In Spanish** message; the default is "EMERGENCIA – necesito comunicarme con el conductor {driver}. Por favor llámeme a este número." |

Printed cards are English only.

---

## 4. Weak or no internet

After a phone has opened its card **once**, the page keeps a copy of itself and the (encrypted) contact data on that phone.

- **Online:** the page always fetches the latest version first, so changes from the dashboard show up within about a minute.
- **No internet, or the internet takes more than 4 seconds:** the saved copy opens, with the note *"Weak or no internet: showing the copy saved on this phone. Texts and calls still work with normal signal."*
- **A phone that has never opened the page, with no internet:** the page can't load ([section 5](#5-when-a-card-cant-be-loaded)).

Texting and calling use the phone network, not the internet, so they work wherever there's signal.

**Tip for families:** tap the card once when you receive it. That saves the copy, and also tests the card.

---

## 5. When a card can't be loaded

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

## 6. Privacy on the family's phone

- The card key stays on the phone; the part of the link after `#` is never sent to any server.
- The page uses no cookies, trackers or analytics, and loads nothing from other websites.
- It stores the language choice, the offline copy (the encrypted data and the page files) and the link of the last card opened, so a home-screen icon can open it ([section 7](#7-yard-address-save-to-contacts-home-screen)).
- **Save yard numbers to Contacts** makes the contact on the phone itself. Nothing is sent anywhere.
- The **Directions** button opens the maps app. Like any link, that app then sees what's in the link: the yard address.

---

## 7. Yard address, Save to Contacts, home screen

**Yard address** (**Supervisors → Yard address**; starts as 302 McCarty St, Houston, TX 77029; hidden if emptied)

- Shown under the contacts with a **Directions** button (**Cómo llegar** in Spanish). It opens Apple Maps on iPhone and Google Maps everywhere else.

**Save yard numbers to Contacts** (Spanish: *Guardar números del patio en Contactos*)

- Saves **one** contact, **Tenaris Yard Supervisors** (Spanish page: *Supervisores del patio Tenaris*), with everyone's number in it, listed A–Z by name. Each number is labelled with the person's name and role, e.g. *Jane Doe – Yard supervisor* (the Spanish role on the Spanish page). The contact also has the yard address and a note: "Emergency contact for driver *…*", then each name and number.
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
