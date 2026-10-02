# SUCH Emergency Contacts

Emergency contact cards for the families (and schools) of Tenaris HLO drivers.

Drivers can't carry phones while working, so each family gets a card with an **NFC tag** and a **QR code**. Tapping the card or scanning the code opens a web page that lets the family reach the right people at the yard in one or two taps. The page works in **English and Spanish**.

The page shows:

1. **Call 911** banner at the top.
2. **Text all contacts** button: one group text to every emergency contact, naming the driver. It's sent from the family's own phone, so the yard can call them back.
3. **On shift now**: a big Call button for whoever is on shift at that moment.
4. **Also working now**: others on duty right now, each with a Call button.
5. **Off shift · still emergency contacts**: everyone else, each with a Call button.

Supervisors keep the contacts, shifts and cards up to date in a web **dashboard**. Changes reach every card within about a minute, and no card ever needs reprinting for a contact change.

---

## Links

| Who | Link |
|---|---|
| Families (via their card) | `https://tenarismccarty.github.io/SUCH-Emergency-Contacts/#<card key>`: each card has its own link |
| Supervisors | https://tenarismccarty.github.io/SUCH-Emergency-Contacts/dashboard.html |
| Site owner | https://tenarismccarty.github.io/SUCH-Emergency-Contacts/dashboard.html#owner |

The plain site address (without a card key) shows "This card couldn't be loaded". That's expected, since the page only works from a card's own link.

---

## Documentation

| Guide | For | What's in it |
|---|---|---|
| [Supervisor guide](docs/supervisor-guide.md) | Supervisors | Signing in, people, shifts, cards, printing, publishing, history, changing the password, fixing common problems |
| [Owner guide](docs/owner-guide.md) | Site owner | First-time setup, the GitHub token, the recovery code, resetting a lost password, taking away access, starting over |
| [Cards and printing](docs/cards-and-printing.md) | Whoever makes cards | Writing NFC tags, the 3D-printed card (specs and Bambu Studio steps), the paper card, QR labels, testing |
| [The emergency page](docs/emergency-page.md) | Everyone | Exactly what families see, how the call order is chosen, English/Spanish, offline behaviour, error messages |
| [Security](docs/security.md) | Owner / IT | What's public, what's encrypted, who can see what, and the known limits |
| [Technical reference](docs/technical.md) | Developers | Architecture, the data file format, every file, deployment and caching, how to change things safely |

---

## Quick start

### Supervisors

1. Open the supervisor link and sign in with the dashboard password (ask the site owner for it).
2. Make your change: **People**, **Shifts** or **Cards**.
3. Press **Publish**. The status at the top turns **Live** when every card has it.

The dashboard's **Help** tab lists the common jobs. The [supervisor guide](docs/supervisor-guide.md) covers everything step by step.

### Site owner

Open the owner link. It adds an **Owner** tab (GitHub token, recovery code, your contact details, taking away access) and a password reset on the sign-in screen. If the Owner tab says **"No recovery code yet"**, make one now and publish. See the [owner guide](docs/owner-guide.md).

### Making a new card

**Cards** → **Add card** → **Publish** → **Print & QR** → download the files → write the link to the NFC tag → test with a phone → lock the tag. See [Cards and printing](docs/cards-and-printing.md).

---

## Features at a glance

- **Shift-aware calling:** the big Call button follows the shift schedule, in the yard's time zone.
- **English and Spanish:** phones set to Spanish open in Spanish, a header button switches language, and the text message is translated too.
- **One-click publishing:** the dashboard saves straight to GitHub. There's no copying, pasting or committing by hand.
- **Per-card keys:** a lost card can be switched off on its own; every other card keeps working.
- **Print & QR generator:** from a card's data, the dashboard makes:
  - a two-colour 3D-printable card (2 STL files, NFC tag sealed inside)
  - a paper card PDF and a QR label
  - plain QR images
  - all of these in one ZIP
- **Works with weak signal:** after a phone has opened its card once, the page opens from a saved copy when the internet is down. Texts and calls only need normal signal.
- **Encrypted:** the repository is public, but every contact, name and setting is encrypted. Without a card or the password, the data file is unreadable.
- **Recovery code:** the site owner can reset a forgotten password without breaking any cards.

---

## Repository contents

| File | What it is |
|---|---|
| `index.html`, `app.js` | The emergency page families see |
| `dashboard.html`, `dashboard.js` | The dashboard for supervisors and the owner |
| `cardmaker.js` | Makes the print files (STL, PDF, PNG, SVG, ZIP) in the browser |
| `crypto.js` | Encryption, shared by both pages |
| `schedule.js` | Works out who is on shift; Spanish shift names and times |
| `sw.js` | Keeps an offline copy of the emergency page on phones |
| `style.css` | Styling for both pages (Tenaris colours) |
| `contacts.enc.json` | The encrypted data. **Written only by the dashboard's Publish button; never edit it by hand.** |
| `logo.js`, `logo.svg` | Tenaris logo outlines (from the official Tenaris media kit) |
| `dejavu-sans-bold.ttf` | Lettering used on printed cards (DejaVu Sans Bold, Latin subset) |
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
  - NFC reading through the 3D-printed card
  - a physical print of the 3D card

  Run the trial checklist in [Cards and printing](docs/cards-and-printing.md#trial-checklist) before making a batch.
- **Printed cards are English only.** Spanish text is about 30% longer and doesn't fit at a size a 0.4 mm nozzle prints cleanly.
- **The paper card is laid out for US Letter paper.**
- Anyone with the dashboard password can publish changes. See [Security](docs/security.md) for what that means and how to take access away.
