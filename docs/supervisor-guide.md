# Supervisor guide

How to keep the emergency cards up to date. You need two things from the site owner:

- **The dashboard link:** https://tenarismccarty.github.io/SUCH-Emergency-Contacts/dashboard.html
- **Your sign-in:** your email and a temporary password (you choose your own the first time). Until the owner switches it off, the **shared supervisors' password** also works.

You don't need a GitHub account, and you don't need to install anything. The dashboard is laid out for a computer (any up-to-date browser); it still works on a phone in a single column. It opens on **Supervisors**. The sections are listed down the left: Supervisors, People (the cards), Print & QR, then History, Settings and Help.

**Contents**

1. [Signing in](#1-signing-in)
2. [The status panel](#2-the-status-panel)
3. [Supervisors](#3-supervisors)
4. [People (cards)](#4-people-cards)
5. [Print & QR](#5-print--qr)
6. [Publishing](#6-publishing)
7. [History](#7-history)
8. [Settings: your name and the password](#8-settings-your-name-and-the-password)
9. [Common jobs, step by step](#9-common-jobs-step-by-step)
10. [When something goes wrong](#10-when-something-goes-wrong)

---

## 1. Signing in

1. Open the dashboard link.
2. Type your **Email** and **Password** and press **Unlock**. Your browser's password manager can save them.
   - **Shared supervisors' password:** leave **Email** empty and type the shared password. (Before anyone has their own sign-in, there's no Email box at all.)
3. When you're done, press **Lock** (top right). This forgets everything on that device. If you have changes you haven't published, the browser warns you first.
4. **It also locks by itself** after 30 minutes without anyone using it (no typing, clicking or scrolling), so a computer left signed in doesn't stay open. It never does this while you have changes waiting to be published; publish or discard them first.

### Your first sign-in

The site owner gives you a **temporary password** (five safety and yard words, two digits and a symbol, e.g. `harness-bayou-muster-flange-teamwork-47!`), in person or by phone.

1. Sign in with your email and the temporary password.
2. **Choose your own password.** Save the suggested one in your password manager (or type your own: at least 10 characters, with a number and a symbol), tick **I've saved it in a password manager**, then **Next**.
3. The dashboard opens with one change waiting: "*Your name* chose a new password". Press **Publish**. **Until you publish, your new password doesn't work** and the temporary one stays in use. If you Lock without publishing, you'll be asked to choose a password again next time.

### Problems signing in

- **"Wrong email or password."** Check both for typos. Suggested and temporary passwords are five lowercase safety and yard words, two digits and a symbol, joined with hyphens like `harness-bayou-muster-flange-teamwork-47!`.
- **Forgot your password?** Type your email, then press **Forgot password?** under Unlock. It writes an email to the site owner asking for a reset; press Send. The owner gives you a new temporary password in person or by phone, and you choose a new password when you sign in. No cards stop working.
- **"The shared supervisors' password is switched off."** Sign in with your own email and password. No sign-in yet? Ask the site owner.
- **Forgot the shared password?** Ask the site owner.
- **The owner link** (`dashboard.html#owner`) is only for the site owner; supervisor sign-ins don't work there.

> Nothing you type is sent anywhere until you press **Publish**, and your password itself never leaves your device.

---

## 2. The status panel

The status panel always shows the current state. On a wide screen (1400 pixels or more) it's the column on the right and stays in view while you scroll; on a smaller screen it's the box at the top.

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

- **Facts line:** how many supervisors and cards there are, and when the last change was published and by whom.
- **Numbers to check:** "*N* phone numbers haven't been checked in 90 days", with an **Open Supervisors** link. Only shown when something is due ([section 3](#3-supervisors)).

When there are unpublished changes and the screen is narrower than that, a dark bar with a **Publish** button also stays at the bottom of the screen.

---

## 3. Supervisors

Everyone on this list receives the group text, and everyone appears on the card page with a Call button. The order of this list doesn't matter: the card page sorts everyone A–Z by name.

The yard's emergency contacts: the supervisors and the manager. On a computer this tab is a table, one row per person, with the column names on top; on a phone each person is a box.

Each person has:

| Field | Shown to families? | Notes |
|---|---|---|
| **Name** | Yes | Required. |
| **Role** | Yes (under the name) | Optional, e.g. "Yard supervisor". |
| **Role in Spanish (optional)** | Yes, on the Spanish page | Leave blank to show the English role on the Spanish page too. |
| **Phone** | No (only used to dial and text) | Required. Any US 10-digit format works, e.g. `(555) 555-0100`, `555.555.0100`, `+1 555 555 0100`. It's tidied to `555-555-0100` when you leave the box. |

- **Add supervisor** adds a row; there's room for up to **10**.
- **×** at the end of a row removes that person (after a confirm).

### Checking numbers every 90 days

Next to each phone number is the date it was last checked, e.g. *Checked Oct 2, 2026*. After 90 days it turns amber: *Not checked since …* Call or text that person, make sure the number still works, then press **Still right** and **Publish**.

- Changing a number counts as checking it.
- Numbers that were there before this feature count as checked on the last publish before it.
- The dates are only seen in the dashboard, never on cards.

### Text message

This is the group text the family sends to everyone. `{driver}` is replaced with the driver's name from their card. Both messages must contain `{driver}`; otherwise publishing stops, because the yard wouldn't know which driver the text is about.

- **English** is used on the English page. Default: *EMERGENCY – need to reach driver {driver}. Please call me back at this number.*
- **Spanish** is used when the family has the page in Spanish. Default: *EMERGENCIA – necesito comunicarme con el conductor {driver}. Por favor llámeme a este número.*

The family sees the message in their Messages app and can edit it before tapping Send. It's sent from their own phone, so the yard can call them back.

### Yard address

Shown at the bottom of every card's page, with a **Directions** button that opens the phone's maps app. It starts as the yard's address, **302 McCarty St, Houston, TX 77029**. To change it, type it the way you'd type it into Google Maps. Empty it to hide it from the page.

---

## 4. People (cards)

Each card (family or school) has its own secret link, written to its NFC tag and printed as its QR code.

- **Add card** (the line at the top; pressing Enter also adds it):
  - **Driver name and ID:** shown on the page and printed on the card, e.g. `Jane Doe (1234)`.
  - **Given to:** a note like "Family" or "School", so you can tell cards apart. Families never see it.

  A new card shows **Not published yet** until you publish. Its link only works after that.
- **Search** (next to *All cards*) narrows the list by driver name, ID or *Given to*.
- **Print & QR** (on each card): opens the Print & QR tab for that card.
- **Rename:** fix the driver name or the note, right in the row; Enter or **Save** keeps it, Escape or **Cancel** doesn't. The card's link doesn't change, so the NFC tag doesn't need rewriting. Publish. If the printed name was wrong, print a new card, with a new tag holding the same link, and destroy the old one.
- **Remove:** permanently switches that card off once you publish. Use it for a lost card. Every other card keeps working. A removed card can't be brought back; make a new one instead.

> A driver can have several cards (e.g. family and school). Each one can be removed on its own.

---

## 5. Print & QR

Everything needed to make the 3D-printed card and its keychain, generated from the card's data.

1. Choose the **Card** at the top. A yellow note warns you if the card isn't published yet; its files only work after you publish.
2. Check the four previews: the card's front and back, and the keychain's front and back, each as seen from its side. The keychain shows the driver's initials; to change them, type 1–3 letters in **Keychain initials**.
3. Choose the **Printer** and **ABS** or **PETG** under **Filament**, then download what you need:

| Button | Gives you |
|---|---|
| **Card (3MF)** | The card ready for the chosen Bambu Lab printer: both colours, settings and the pause for the NFC tag already set |
| **Keychain (3MF)** | The keychain, the same way |
| **Card + keychain, one plate (3MF)** | Both on one plate, with one pause for both tags |
| **STL files and print notes (ZIP)** | The dark and light parts of the card and the keychain as STL files, plus print notes with the settings and the pause height, for setting up the print yourself |

- **NFC tag:** the card's link, with a **Copy link** button, for writing to the tag (an NTAG215 PVC coin tag, 25.4 mm (1 in) across, 0.8 mm thick). The keychain's tag gets the same link.
- **Backup line:** a phone number printed on every card. If the page ever can't load, it tells families to call the backup number on their card, so set this before printing cards. Publish after changing it.

If a driver's name can't print cleanly (too long, or characters the card can't print), the card's download buttons are disabled with a message. Shorten or fix the name with **People → Rename**. If the keychain can't be made (no letters for initials), only its buttons are disabled.

Full printing instructions are in [Cards and printing](cards-and-printing.md).

---

## 6. Publishing

1. Press **Publish** in the status panel (or the bottom bar on a smaller screen).
2. If something is missing, publishing stops and the dashboard takes you to the problem. It checks that:
   - there is at least one person
   - every person has a name and a valid US phone number
   - no two people share a phone number
   - both text messages are filled in and contain `{driver}`
3. With your own sign-in, History shows your name automatically. With the shared password, the first time you publish on a device the dashboard asks for **your name**, for the History tab; you can change it later in **Settings**.
4. The badge goes **Publishing → Updating → Live**.

**If someone else published first:** two people may edit at the same time. If another person publishes after you signed in, your publish is refused with *"Someone else published changes since you signed in, so yours were NOT published."* Nothing is overwritten. Note your changes, press **Lock**, sign in again (you'll see their changes), and redo yours.

**Discard changes:** throws away everything you haven't published and goes back to the published version.

---

## 7. History

Every publish adds an entry with the date and time, who published, and what changed. With a personal sign-in, "who" is the name the site owner gave that sign-in. With the shared password, it's the name typed in Settings, marked *(shared password)*; the owner's entries are marked *(owner)*. Examples of what changed: "Edited Bob Two", "Changed the text message", "Added card: Jane Doe (1234) (Family)". The newest is at the top, and the last 200 entries are kept. History is stored encrypted with the data, so the public can't read it.

---

## 8. Settings: your name and the password

**Signed in with your own email:**

- **Signed in as:** your name and email. History uses this name. If it's wrong, ask the site owner.
- **Change my password:** changes only your own password; nobody else is affected.
  1. Press **Change my password**.
  2. Save the suggested password, or type your own: at least 10 characters, with a number and a symbol.
  3. Tick **I've saved it in a password manager**, then press **Next**.
  4. **Publish.** Your old password stops working the moment you publish.

**Signed in with the shared password:**

- **Your name:** shown in History next to what you publish. It's saved only in this browser on this device; it isn't secret.
- **Change the shared password:** sets a new shared password for **everyone** who uses it (you don't need the old one; you're already signed in). Personal sign-ins aren't affected. The steps are the same as above; then tell everyone who uses it the new password, in person or by phone.

---

## 9. Common jobs, step by step

**A supervisor joins or leaves**
1. **Supervisors** → **Add supervisor** (fill in name, role, phone), or **×** at the end of their row.
2. **Publish.**

**A phone number changed**
**Supervisors** → edit **Phone** → **Publish.** No card needs reprinting.

**A new family or school needs a card**
1. **People** → **Add card** → **Publish.**
2. **Print & QR** → choose the card → **Card (3MF)** (or **Card + keychain, one plate (3MF)**).
3. Write the link to the NFC tag (one per piece) and print. See [Cards and printing](cards-and-printing.md).
4. Test it with a phone before handing it over.

**A card was lost**
**People** → **Remove** next to it → **Publish.** Only that card stops working. Make a replacement with **Add card**.

**A name on a card is misspelled**
**People** → **Rename** → **Publish.** The page shows the corrected name within about a minute. To fix the printed name, print a new card with a new tag holding the same link (Print & QR), and destroy the old card.

**Giving someone dashboard access**
Ask the site owner to add them. The owner gives them a temporary password in person or by phone, and they choose their own at first sign-in.

---

## 10. When something goes wrong

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
| "Put {driver} in the text message…" | **Supervisors → Text message:** put `{driver}` back where the driver's name should go. |
| The sign-in screen appears by itself | The dashboard locks after 30 minutes without use (never with unpublished changes). Sign in again. |
| Badge stuck on **Delayed** | GitHub is slow. It nearly always catches up within 10 minutes. |
| "The driver name is too long to print." (Print & QR) | **People → Rename** to a shorter form, e.g. initials for middle names. |
| "The driver name has characters the card can't print" (Print & QR) | **People → Rename** using letters, digits and . , - ' " ( ) & # / only. |
| "The Bambu Studio project maker (bambu3mf.js) didn't load." (Print & QR) | Reload the page. If it keeps happening, use **STL files and print notes (ZIP)** instead. |
| A family says their card shows "This card couldn't be loaded" | Check the card is listed in **People** and shows **Active**. If it was removed, make a new card. If it's active, ask them to tap **Retry** or check their internet. |
