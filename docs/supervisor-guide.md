# Supervisor guide

How to keep the emergency cards up to date. You need two things from the site owner:

- **The dashboard link:** https://tenarismccarty.github.io/SUCH-Emergency-Contacts/dashboard.html
- **Your sign-in:** your email and a temporary password (you choose your own the first time). Until the owner switches it off, the **shared supervisors' password** also works.

You don't need a GitHub account, and you don't need to install anything. The dashboard works in any up-to-date browser on a phone or computer.

**Contents**

1. [Signing in](#1-signing-in)
2. [The status panel](#2-the-status-panel)
3. [People](#3-people)
4. [Shifts](#4-shifts)
5. [Cards](#5-cards)
6. [Print & QR](#6-print--qr)
7. [Publishing](#7-publishing)
8. [History](#8-history)
9. [Settings: your name and the password](#9-settings-your-name-and-the-password)
10. [Common jobs, step by step](#10-common-jobs-step-by-step)
11. [When something goes wrong](#11-when-something-goes-wrong)

---

## 1. Signing in

1. Open the dashboard link.
2. Type your **Email** and **Password** and press **Unlock**. Your browser's password manager can save them.
   - **Shared supervisors' password:** leave **Email** empty and type the shared password. (Before anyone has their own sign-in, there's no Email box at all.)
3. When you're done, press **Lock** (top right). This forgets everything on that device. If you have changes you haven't published, the browser warns you first.

### Your first sign-in

The site owner gives you a **temporary password** (two words, two digits and a symbol, e.g. maple-river-47!), in person or by phone.

1. Sign in with your email and the temporary password.
2. **Choose your own password.** Save the suggested one in your password manager (or type your own: at least 8 characters, with a number and a symbol), tick **I've saved it in a password manager**, then **Next**.
3. The dashboard opens with one change waiting: "*Your name* chose a new password". Press **Publish**. **Until you publish, your new password doesn't work** and the temporary one stays in use. If you Lock without publishing, you'll be asked to choose a password again next time.

### Problems signing in

- **"Wrong email or password."** Check both for typos. The suggested passwords are five lowercase words joined by hyphens, like `maple-orbit-canyon-lantern-fizzy`.
- **Forgot your password?** Type your email, then press **Forgot password?** under Unlock. It writes an email to the site owner asking for a reset; press Send. The owner gives you a new temporary password in person or by phone, and you choose a new password when you sign in. No cards stop working.
- **"The shared supervisors' password is switched off."** Sign in with your own email and password. No sign-in yet? Ask the site owner.
- **Forgot the shared password?** Ask the site owner.
- **The owner link** (`dashboard.html#owner`) is only for the site owner; supervisor sign-ins don't work there.

> Nothing you type is sent anywhere until you press **Publish**, and your password itself never leaves your device.

---

## 2. The status panel

The box at the top of the dashboard always shows the current state.

| Badge | Meaning |
|---|---|
| **Live** | Every card shows the latest version. |
| **Not published** | You have changes that only you can see. The list underneath shows exactly what changed. Press **Publish** to send them to every card, or **Discard changes** to throw them away. |
| **Publishing** | Saving to GitHub right now. |
| **Updating** | Published. The website is picking up the change, which usually takes under a minute. |
| **Delayed** | Published, but the website is slow to update. It usually catches up within 10 minutes. You don't need to do anything. |
| **Not live yet** | Nothing has ever been published (first-time setup only). |
| **Checking** | Briefly, right after you sign in. |

Below the badge:

- **Right now (Houston time …):** who the cards would call at this moment: the primary call and anyone else working. It includes your unpublished changes, so you can check a change before publishing. It refreshes every 30 seconds.
- **Facts line:** how many people and cards there are, and when the last change was published and by whom.
- **Numbers to check:** "*N* phone numbers haven't been checked in 90 days", with an **Open People** link. Only shown when something is due ([section 3](#3-people)).

When there are unpublished changes, a dark bar with a **Publish** button also stays at the bottom of the screen.

---

## 3. People

Everyone on this list receives the group text, and everyone appears on the card page with a Call button.

Each person has:

| Field | Shown to families? | Notes |
|---|---|---|
| **Name** | Yes | Required. |
| **Role** | Yes (under the name) | Optional, e.g. "1st shift lead". |
| **Role in Spanish (optional)** | Yes, on the Spanish page | Leave blank to show the English role on the Spanish page too. |
| **Phone** | No (only used to dial and text) | Required. Any US 10-digit format works, e.g. `(555) 555-0100`, `555.555.0100`, `+1 555 555 0100`. It's tidied to `+15555550100` when you leave the box. |

- **Add person** adds a row; there's room for up to **10 people**.
- **Remove person** deletes them and also takes them off every shift.

### Checking numbers every 90 days

Under each phone number is the date it was last checked, e.g. *Number checked Oct 2, 2026.* After 90 days it turns amber: *Number not checked since …* Call or text that person, make sure the number still works, then press **Still right** and **Publish**.

- Changing a number counts as checking it.
- Numbers that were there before this feature count as checked on the last publish before it.
- The dates are only seen in the dashboard, never on cards.

### Text message

This is the group text the family sends to everyone. `{driver}` is replaced with the driver's name from their card.

- **English** is used on the English page. Default: *EMERGENCY – need to reach driver {driver}. Please call me back at this number.*
- **Spanish** is used when the family has the page in Spanish. Default: *EMERGENCIA – necesito comunicarme con el conductor {driver}. Por favor llámeme a este número.*

The family sees the message in their Messages app and can edit it before tapping Send. It's sent from their own phone, so the yard can call them back.

### Yard address

Shown at the bottom of every card's page, with a **Directions** button that opens the phone's maps app. It starts as the yard's address, **302 McCarty St, Houston, TX 77029**. To change it, type it the way you'd type it into Google Maps. Empty it to hide it from the page.

### WhatsApp

Tick **Show a WhatsApp button for the primary call** to add a WhatsApp button under the big Call button. It opens a WhatsApp chat with whoever is the primary call at that moment, with the emergency text already written. WhatsApp links can only message one person, so only the primary call gets one.

Only switch it on if the people on shift actually watch WhatsApp. It's off by default.

---

## 4. Shifts

This tab decides **who is the primary call** (the big Call button on the card page) at any moment.

### How the order works

1. The dashboard looks down the shift list **from the top** and finds the first shift that is on right now.
2. The first person ticked on that shift (in the order of the People list) is the **primary call**.
3. Everyone else on a shift that's on right now is listed under **Also working now**.
4. Everyone else is listed under **Not scheduled · still emergency contacts**.
5. If **nobody** is on shift, the primary call is the person chosen in **If nobody is on shift, the primary call is**.

### Times with nobody on shift

Above the shift list, an amber box lists every time in the week when nobody is on any shift, e.g. *Fri 10:00 PM to Mon 6:00 AM*, and who gets the primary call then (the fallback person). A shift with nobody ticked doesn't count. When every hour is covered it says *✓ Someone is on shift at every hour of the week.*

Gaps aren't errors (the fallback person covers them), and you can still publish. The box just makes sure they're on purpose.

Keep the rotating shifts (1st, 2nd, 3rd) **above** the Day shift. Then the shift lead is the primary call and the day staff appear as "Also working".

### Settings on this tab

- **All times are Houston time** (Central), even if a family is somewhere else. Their card page then adds a note: "Shift times are Houston time."
- **Each shift has:**
  - **Name** and an optional **Spanish name**. The usual names (1st shift, 2nd shift, 3rd shift, Day (8–5), Day, Night) translate automatically; the grey hint shows the automatic Spanish.
  - **Starts** and **Ends**. A shift that ends earlier than it starts runs past midnight, e.g. 22:00–06:00. It counts as belonging to the day it **starts**: a Friday 22:00–06:00 shift covers Saturday 02:00. A shift that starts and ends at the same time runs 24 hours.
  - **Days:** tick the days the shift runs.
  - **Who works it:** tick the people on that shift. A person can be on more than one shift.
- **Add shift** / **Remove shift**.

The defaults for a new setup are:

| Shift | Time | Days |
|---|---|---|
| 1st shift | 06:00–14:00 | every day |
| 2nd shift | 14:00–22:00 | every day |
| 3rd shift | 22:00–06:00 | every day |
| Day (8–5) | 08:00–17:00 | Monday–Friday |

### Check a time

Pick a **Day** and **Time** to see exactly who a card would show then: the primary call, also working, and not scheduled. Use it after every rotation change.

---

## 5. Cards

Each card (family or school) has its own secret link, written to its NFC tag and printed as its QR code.

- **Add card:**
  - **Driver name and ID:** shown on the page and printed on the card, e.g. `Jane Doe (1234)`.
  - **Given to:** a note like "Family" or "School", so you can tell cards apart. Families never see it.

  A new card shows **Not published yet** until you publish. Its link only works after that.
- **Print & QR** (on each card): opens the Print & QR tab for that card.
- **Rename:** fix the driver name or the note. The card's link doesn't change, so the NFC tag doesn't need rewriting. Publish. If the printed name was wrong, print a new card, with a new tag holding the same link, and destroy the old one.
- **Remove:** permanently switches that card off once you publish. Use it for a lost card. Every other card keeps working. A removed card can't be brought back; make a new one instead.

> A driver can have several cards (e.g. family and school). Each one can be removed on its own.

---

## 6. Print & QR

Everything needed to make the 3D-printed card, generated from the card's data.

1. Choose the **Card** at the top. A yellow note warns you if the card isn't published yet; its files only work after you publish.
2. Check the two previews: the front (printed face down) and the back (printed on top).
3. Download what you need:

| Button | Gives you |
|---|---|
| **Bambu Studio project (3MF)** | The card ready for the chosen Bambu Lab printer: both colours, settings and the pause for the NFC tag already set. Choose the **Printer** and **ASA** or **ABS** under **Filament** first. |
| **STL files and print notes (ZIP)** | The dark and light parts as STL files, plus print notes with the settings and the pause height, for setting up the print yourself |

- **NFC tag:** the card's link, with a **Copy link** button, for writing to the tag (an NTAG215 PVC coin tag, 25.4 mm (1 in) across, 0.8 mm thick).
- **Backup line:** a phone number printed on every card. If the page ever can't load, it tells families to call the backup number on their card, so set this before printing cards. Publish after changing it.

If a driver's name can't print cleanly (too long, or characters the card can't print), both download buttons are disabled with a message. Shorten or fix the name with **Cards → Rename**.

Full printing instructions are in [Cards and printing](cards-and-printing.md).

---

## 7. Publishing

1. Press **Publish** in the status panel or the bottom bar.
2. If something is missing, publishing stops and the dashboard takes you to the problem. It checks that:
   - there is at least one person
   - every person has a name and a valid US phone number
   - no two people share a phone number
   - both text messages are filled in
   - every shift has a name and at least one day
3. With your own sign-in, History shows your name automatically. With the shared password, the first time you publish on a device the dashboard asks for **your name**, for the History tab; you can change it later in **Settings**.
4. The badge goes **Publishing → Updating → Live**.

**If someone else published first:** two people may edit at the same time. If another person publishes after you signed in, your publish is refused with *"Someone else published changes since you signed in, so yours were NOT published."* Nothing is overwritten. Note your changes, press **Lock**, sign in again (you'll see their changes), and redo yours.

**Discard changes:** throws away everything you haven't published and goes back to the published version.

---

## 8. History

Every publish adds an entry with the date and time, who published, and what changed. With a personal sign-in, "who" is the name the site owner gave that sign-in. With the shared password, it's the name typed in Settings, marked *(shared password)*; the owner's entries are marked *(owner)*. Examples of what changed: "Edited Bob Two", "Changed shifts", "Added card: Jane Doe (1234) (Family)". The newest is at the top, and the last 200 entries are kept. History is stored encrypted with the data, so the public can't read it.

---

## 9. Settings: your name and the password

**Signed in with your own email:**

- **Signed in as:** your name and email. History uses this name. If it's wrong, ask the site owner.
- **Change my password:** changes only your own password; nobody else is affected.
  1. Press **Change my password**.
  2. Save the suggested password, or type your own: at least 8 characters, with a number and a symbol.
  3. Tick **I've saved it in a password manager**, then press **Next**.
  4. **Publish.** Your old password stops working the moment you publish.

**Signed in with the shared password:**

- **Your name:** shown in History next to what you publish. It's saved only in this browser on this device; it isn't secret.
- **Change the shared password:** sets a new shared password for **everyone** who uses it (you don't need the old one; you're already signed in). Personal sign-ins aren't affected. The steps are the same as above; then tell everyone who uses it the new password, in person or by phone.

---

## 10. Common jobs, step by step

**The shift rotation changed**
1. **Shifts** → untick and tick people under **Who works it**.
2. **Check a time** for a couple of moments to confirm.
3. **Publish.**

**Someone new joined / someone left**
1. **People** → **Add person** (fill in name, role, phone) or **Remove person**.
2. **Shifts** → tick the new person on their shift.
3. **Publish.**

**A phone number changed**
**People** → edit **Phone** → **Publish.** No card needs reprinting.

**A new family or school needs a card**
1. **Cards** → **Add card** → **Publish.**
2. **Print & QR** → choose the card → **Bambu Studio project (3MF)**.
3. Write the link to the NFC tag and print the card. See [Cards and printing](cards-and-printing.md).
4. Test it with a phone before handing it over.

**A card was lost**
**Cards** → **Remove** next to it → **Publish.** Only that card stops working. Make a replacement with **Add card**.

**A name on a card is misspelled**
**Cards** → **Rename** → **Publish.** The page shows the corrected name within about a minute. To fix the printed name, print a new card with a new tag holding the same link (Print & QR), and destroy the old card.

**Giving someone dashboard access**
Ask the site owner to add them. The owner gives them a temporary password in person or by phone, and they choose their own at first sign-in.

---

## 11. When something goes wrong

| What you see | What to do |
|---|---|
| "Wrong email or password." / "Wrong password." | Check spelling. Still stuck? Press **Forgot password?** (your own sign-in) or ask the site owner (shared password). |
| "The shared supervisors' password is switched off." | Sign in with your own email and password. |
| Asked to choose a password right after signing in | You signed in with a temporary password. Choose your own, then **Publish** ([section 1](#your-first-sign-in)). |
| "The dashboard was just updated…", or it asks for an "Old admin key" | The site was just updated. Wait a few minutes and reload. |
| "Wrong owner password." | You're on the owner link. Supervisors use the normal dashboard link (without `#owner`). |
| "Publishing won't work right now: the site's GitHub connection has expired. Ask the site owner … to fix it." | Only the site owner can fix this. You can keep editing; publish once they've fixed it. |
| "Nothing was published: …" | Read the rest of the message. It says whether to try again or ask the site owner. |
| "Someone else published changes since you signed in…" | Note your changes, **Lock**, sign in again and redo them. |
| "Someone published a newer version since this page loaded." | **Lock** and sign in again before making changes. |
| "Can't reach GitHub right now." | Check your internet connection. You can still edit; publish when you're back online. |
| "Fix these first: …" | The message lists what's missing (a name, a phone number, …) and opens the right tab. |
| "Add your name first (Settings → Your name)…" | Type your name in **Settings → Your name**, then publish again. |
| Badge stuck on **Delayed** | GitHub is slow. It nearly always catches up within 10 minutes. |
| "The driver name is too long to print." (Print & QR) | **Cards → Rename** to a shorter form, e.g. initials for middle names. |
| "The driver name has characters the card can't print" (Print & QR) | **Cards → Rename** using letters, digits and . , - ' " ( ) & # / only. |
| "The Bambu Studio project maker (bambu3mf.js) didn't load." (Print & QR) | Reload the page. If it keeps happening, use **STL files and print notes (ZIP)** instead. |
| A family says their card shows "This card couldn't be loaded" | Check the card is listed in **Cards** and shows **Active**. If it was removed, make a new card. If it's active, ask them to tap **Retry** or check their internet. |
