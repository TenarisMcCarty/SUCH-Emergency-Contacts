# SUCH Emergency Contacts

An emergency contact page for the families (and schools) of HLO drivers. Drivers can't carry phones, so each family gets a card with an NFC tag and a QR code. Tapping or scanning it opens a page that shows:

- **Call 911** at the top.
- **Text all**: one group text to every emergency contact, naming the driver.
- **On shift now**: a big Call button for whoever is on shift at that moment.
- **Also working now**, then **Off shift · still emergency contacts**, each with its own Call button.

## Links

- **Supervisors:** https://tenarismccarty.github.io/SUCH-Emergency-Contacts/dashboard.html
- **Site owner:** https://tenarismccarty.github.io/SUCH-Emergency-Contacts/dashboard.html#owner (adds the Owner tab and password reset)
- **Emergency page:** https://tenarismccarty.github.io/SUCH-Emergency-Contacts/ (only works from a card's link)

## Who does what

| | Supervisors | Site owner |
|---|---|---|
| Needs | dashboard link + password | owner link + password + **recovery code** + GitHub |
| People, shifts, cards, publish | ✓ | ✓ |
| Print & QR (all card files) | ✓ | ✓ |
| Change the password (everyone needs the new one) | ✓ | ✓ |
| GitHub token, recovery code, take away access | | ✓ (Owner tab) |
| Reset a forgotten password (no cards break) | ask the owner | ✓ (recovery code on the sign-in screen) |

To hand it off, send supervisors the dashboard link and tell them the password. The **Help** tab covers every job they do.

## First-time setup (owner, once)

Already set up with the first version (the copy-and-paste editor)? Open the owner link and enter that **admin key** once. The steps below follow; contacts and cards carry over, and written cards keep working.

1. Open the owner link.
2. **Password:** save the suggested password.
3. **GitHub token:** follow the steps on screen (about 2 minutes, signed in to GitHub as TenarisMcCarty).
4. **Recovery code:** save it in *your* password manager and add your contact details for supervisors.
5. Fill in **People** and **Shifts**, add a card, set the **Backup line** in Print & QR, then **Publish**.

## Print & QR

Pick a card and download its files, or **Download everything (ZIP)**:

| File | For |
|---|---|
| `…-BLACK.stl`, `…-WHITE.stl` | 3D-printed card, two filament colours, NFC tag sealed inside |
| `…-print-notes.txt` | Slicer settings, the exact pause height for inserting the tag, and the link to write |
| `…-paper-card.pdf` | Three paper copies on a Letter page: print at 100%, cut, fold, laminate |
| `…-qr-label.png` | 4 × 6 in label: logo, name, QR, instructions, 911 line, backup line |
| `…-qr.png`, `…-qr.svg` | Just the QR code |

Write the card link to the tag with NFC Tools (Write → Add a record → URL). Lock the tag only after testing.

### 3D-printed card

- **Size:** 85.6 × 53.98 mm, the same as a credit card. **Thickness:** 1.2, 1.4 or 1.6 mm, set by the NFC sticker thickness you pick in Print & QR.
- **Front:** dark, with the Tenaris logo, "EMERGENCY CONTACT" and the driver's name. A white band carries the instructions and the 911 line.
- **Back:** white, with the QR code, a contactless symbol right over the hidden tag, "TAP PHONE HERE" and the backup line.
- **Core:** white, so white areas stay bright. Thin white PLA over a black core looks grey.
- **Pocket:** 25.6 mm wide, for a 25 mm NTAG215 sticker. The print notes give the pause height.
- **In Bambu Studio:** import both STLs together and load them as **one object with two parts**. Black part → black filament, white → white. Print QR side down.
- **Long names** shrink, or wrap to two lines. If a name still can't print cleanly, the dashboard says so; shorten it with Cards → Rename.

The files were checked digitally:

- each part is watertight
- the colours fill every layer with no gaps or overlaps
- the pocket is sealed
- the QR decodes from the model itself

Nothing has been physically printed yet, so print and scan-test one card before making a batch.

## English and Spanish

Everything families see after tapping or scanning comes in English and Spanish. That covers the 911 banner, buttons, headings, shift times, notes, the error screen and the pre-filled text message.

- **Which language opens:** phones set to Spanish open the page in Spanish. A button in the header switches language, and the phone remembers the choice.
- **Dashboard fields:** **People** has a Spanish text message and an optional Spanish role per person. **Shifts** has an optional Spanish name per shift.
- **Shift names:** common names like "1st shift" and "Day (8–5)" translate automatically. Anything else left blank shows in English.
- **Printed cards:** still English only.

## Shifts

The default shifts are 1st 6:00–14:00, 2nd 14:00–22:00, 3rd 22:00–6:00 (all week), and Day 8:00–17:00 (Mon–Fri). Change them any time. The big Call button goes to the person on the **first** shift in the list that's on right now. If nobody is on shift, it goes to the fallback person. Times use the yard's time zone, wherever the family is. **Check a time** on the Shifts tab shows who a card would call at any moment.

## How it's protected

- The site and repo are public, but all data is in `contacts.enc.json`, encrypted (AES-GCM, the browser's Web Crypto). Without a card, the password or the recovery code, it's unreadable.
- Each card has its own key, kept only in the card's link after `#`, which browsers never send to any server. A card unlocks only the contacts, the shifts and its own driver's name. A lost card can be removed on its own.
- Every publish uses a fresh encryption key, so a removed card sees nothing published after it was removed.
- The dashboard password is stretched (PBKDF2, 600,000 rounds) and should be the suggested 5-word one: the public file can be attacked offline, and it holds the GitHub token.
- The recovery copy is encrypted to the owner's public key (ECDH P-256). Anyone can publish without knowing the recovery code, and only the owner can open it.
- The GitHub token can change only this repository. Commit messages are always "Update emergency card data", so no names appear in the public history.
- The pages run only this site's own files, plus GitHub's API on the dashboard. There are no trackers or cookies, and search engines are asked not to index the pages.
- **Limits:**
  - Anyone with the password can publish, and so can change the site. Take access away from the Owner tab.
  - Old file versions stay in the repo's history. An old password, a removed card or an old recovery code can still open those old versions, but nothing newer.
  - The Owner tab is hidden from supervisors to keep things simple, not to stop them reaching it. The password already lets them publish.

## Weak signal

After a phone has opened the page once, it keeps a copy (`sw.js`). If the internet is down or slow, the saved copy opens with a note. Texting and calling only need normal cell signal. **Tip:** ask families to tap the card once when they receive it.

## Trial checklist (real phones)

- Tag tap and QR scan both open the page with the right driver, on iPhone and Android.
- **Text all** opens Messages with every number. On Samsung, if some are missing, try **Didn't get all of them?** and note which one worked.
- The big Call button shows the person on shift now. Call buttons dial correctly.
- Change something, publish, and check the card shows it within about a minute.
- Print one 3D card and check that the QR scans and the tag reads through the card. Only then lock the tag.

## Files

| File | What it is |
|---|---|
| `index.html`, `app.js` | Emergency page |
| `dashboard.html`, `dashboard.js` | Dashboard |
| `cardmaker.js` | Makes the STL, PDF, PNG, SVG and ZIP files in the browser |
| `crypto.js` | Encryption, shared by all pages |
| `schedule.js` | Who's on shift now |
| `sw.js` | Offline copy on the phone |
| `style.css` | Tenaris styling (colours from tenaris.com; Frutiger only if it's installed) |
| `logo.js`, `logo.svg` | Tenaris logo outlines from the official media kit |
| `dejavu-sans-bold.ttf` | Lettering on the cards (DejaVu Sans Bold, Latin subset) |
| `qrcode.js`, `opentype.js`, `earcut.js`, `words.js` | QR encoder, font reader, shape filler, password word list. Unmodified copies from npm/EFF with checksums verified; licences in `THIRD-PARTY-NOTICES.txt` |
| `contacts.enc.json` | Encrypted data, written by Publish |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |
