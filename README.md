# SUCH Emergency Contacts

Emergency contact cards for the families (and schools) of Tenaris HLO drivers.

Drivers can't carry phones while working, so each family gets a card with an **NFC tag** and a **QR code**. Tapping the card or scanning the code opens a web page that lets the family reach the right people at the yard in one or two taps. The page works in **English and Spanish**.

The page shows:

1. **Call 911** banner at the top.
2. **Text All Yard Supervisors (Preferred)** button: one group text to every emergency contact, naming the driver. It's sent from the family's own phone, so the yard can call them back.
3. **Primary call**: a big Call button for whoever is on shift at that moment.
4. **Also working now**: others on duty right now, each with a Call button.
5. **Not scheduled · still emergency contacts**: everyone else, each with a Call button.
6. **Yard** address with a Directions button (if set).
7. A small **Save yard numbers to Contacts** link at the bottom: one contact, "Tenaris Yard Supervisors", with every number labelled by name and role.

Supervisors can also switch on a **WhatsApp** button for the primary call.

Supervisors keep the contacts, shifts and cards up to date in a web **dashboard**. Changes reach every card within about a minute, and no card ever needs reprinting for a contact change.

---

## Links

| Who | Link |
|---|---|
| Families (via their card) | `https://tenarismccarty.github.io/SUCH-Emergency-Contacts/#<card key>`: each card has its own link |
| Supervisors (own email + password) | https://tenarismccarty.github.io/SUCH-Emergency-Contacts/dashboard.html |
| Site owner (own password) | https://tenarismccarty.github.io/SUCH-Emergency-Contacts/dashboard.html#owner |

The plain site address (without a card key) shows "This card couldn't be loaded". That's expected, since the page only works from a card's own link.

---

## Documentation

| Guide | For | What's in it |
|---|---|---|
| [Supervisor guide](docs/supervisor-guide.md) | Supervisors | Signing in with your email, your first sign-in, Forgot password?, people, shifts, cards, printing, publishing, history, changing your password, fixing common problems |
| [Owner guide](docs/owner-guide.md) | Site owner | Owner password, recovery code, the GitHub token, people who can sign in (add, reset, remove), switching off the shared password, taking away access, starting over |
| [Cards and printing](docs/cards-and-printing.md) | Whoever makes cards | Writing NFC tags, the 3D-printed card (specs, Bambu Studio project, printing in ASA/ABS), testing |
| [The emergency page](docs/emergency-page.md) | Everyone | Exactly what families see, how the call order is chosen, English/Spanish, offline behaviour, error messages |
| [Security](docs/security.md) | Owner / IT | What's public, what's encrypted, who can see what, and the known limits |
| [Technical reference](docs/technical.md) | Developers | Architecture, the data file format, every file, deployment and caching, how to change things safely |
| [Project history](docs/project-history.md) | Owner / maintainers | Every release and decision with the reasons, the brand and 3D-card work, how changes are tested and released safely, incidents, open items, and what must never change |

---

## Quick start

### Supervisors

1. Open the supervisor link and sign in with your **email and password**. The site owner adds you and gives you a temporary password, which you change at your first sign-in. (Until the owner switches it off, the old shared password also works, with Email left empty.)
2. Make your change: **People**, **Shifts** or **Cards**.
3. Press **Publish**. The status at the top turns **Live** when every card has it.

The dashboard's **Help** tab lists the common jobs. The [supervisor guide](docs/supervisor-guide.md) covers everything step by step.

### Site owner

Open the owner link and sign in with **your own owner password**; supervisor sign-ins don't work there. That gives you the **Owner** tab: people who can sign in, the shared password, GitHub token, owner password, recovery code, your contact details, and taking away access. If the owner link says **"Set up owner access"**, do that first ([owner guide, section 2](docs/owner-guide.md#2-setting-up-owner-access-on-existing-data)).

### Making a new card

**Cards** → **Add card** → **Publish** → **Print & QR** → download the files → write the link to the NFC tag → test with a phone → lock the tag. See [Cards and printing](docs/cards-and-printing.md).

---

## Features at a glance

- **Shift-aware calling:** the primary call follows the shift schedule, always in Houston time. The dashboard lists any times when nobody is on shift.
- **Numbers kept current:** the dashboard asks supervisors to re-check each phone number every 90 days.
- **For families:** optional WhatsApp button, yard address with directions, and the yard's numbers saved to Contacts as one contact.
- **English and Spanish:** phones set to Spanish open in Spanish, a header button switches language, and the text message is translated too.
- **One-click publishing:** the dashboard saves straight to GitHub. There's no copying, pasting or committing by hand.
- **Per-card keys:** a lost card can be switched off on its own; every other card keeps working.
- **3D card files:** from a card's data, the dashboard makes a two-colour, wallet-size 3D card (2.2 mm, NFC tag sealed inside), as a ready-to-print **Bambu Studio project (3MF)** for the chosen enclosed Bambu Lab printer (single- or two-nozzle) with the tag pause already set, or as **STL files** with print notes.
- **Works with weak signal:** after a phone has opened its card once, the page opens from a saved copy when the internet is down. Texts and calls only need normal signal.
- **Tenaris brand:** follows the Tenaris Brandmark Basic Guidelines: the official signature (full colour on screen; one colour on the two-colour 3D card), minimum sizes and clear space, Tenaris Green, Blue and Gray, and a Frutiger-style typeface.
- **Encrypted:** the repository is public, but every contact, name and setting is encrypted. Without a card or a sign-in, the data file is unreadable.
- **Personal sign-ins:** each supervisor has their own email and password, and History shows who published. The site owner (own password plus a recovery code) adds, resets and removes people and can switch off the old shared password. Nothing breaks any cards.

---

## Repository contents

| File | What it is |
|---|---|
| `index.html`, `app.js` | The emergency page families see |
| `dashboard.html`, `dashboard.js` | The dashboard for supervisors and the owner |
| `cardmaker.js` | Makes the 3D card (two STL parts, previews, print notes, ZIP) in the browser |
| `bambu3mf.js`, `bambu-template.json` | Turns the two STL parts into a ready-to-print Bambu Studio project (3MF) |
| `crypto.js` | Encryption, shared by both pages |
| `schedule.js` | Works out who is on shift; Spanish shift names and times |
| `sw.js` | Keeps an offline copy of the emergency page on phones |
| `manifest.json`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png` | Home-screen name and icon for the emergency page |
| `style.css` | Styling for both pages (Tenaris colours) |
| `contacts.enc.json` | The encrypted data. **Written only by the dashboard's Publish button; never edit it by hand.** |
| `logo.svg`, `logo.js` | The Tenaris signature: official full-colour artwork from tenaris.com, and the same outlines for the card maker |
| `source-sans-3-*.woff2`, `source-sans-3-bold.ttf` | Source Sans 3 (free, in the style of Frutiger, the Tenaris typeface), for the pages and the printed cards |
| `qrcode.js`, `opentype.js`, `earcut.js` | Third-party libraries: QR encoder, font reader, shape triangulation (unmodified npm releases) |
| `words.js` | Word list for suggested passwords (EFF Large Wordlist, minus 4 hyphenated words) |
| `THIRD-PARTY-NOTICES.txt` | Licences and credits for everything above that came from elsewhere |
| `.nojekyll` | Tells GitHub Pages to serve the files exactly as they are |
| `docs/` | This documentation |

Hosting is **GitHub Pages**, from the `main` branch, repository root. There is no server, build step or database.

---

## Status and known limits

- **Not yet tested on real phones or a real printer:**
  - the group-text links (iPhone and Samsung)
  - Save to Contacts and the WhatsApp button
  - NFC reading through the 3D-printed card
  - a physical print of the 3D card

  Run the trial checklist in [Cards and printing](docs/cards-and-printing.md#trial-checklist) before making a batch.
- **Printed cards are English only.** Spanish text is about 30% longer and doesn't fit at a size a 0.4 mm nozzle prints cleanly.
- Anyone who can sign in can publish changes. See [Security](docs/security.md) for what that means and how to take access away.
