# SUCH Emergency Contacts

An emergency contact page for the families (and schools) of HLO drivers. Drivers can't carry phones, so each family gets a card with an NFC tag and a QR code. Tapping or scanning it opens this page, and one button texts all 6 company contacts with the driver's name. The family just taps **Send**.

- **Emergency page:** https://tenarismccarty.github.io/SUCH-Emergency-Contacts/ (only works from a card's link)
- **Editor:** https://tenarismccarty.github.io/SUCH-Emergency-Contacts/edit.html

## First-time setup

1. Open the editor → **First-time setup / start over** → **Start fresh**.
2. Save the **admin key** in your password manager, tick the box → **Continue**.
3. Fill in the 6 contacts, pick the main contact, check the text message.
4. **Add a card** for the trial driver. Copy its link and download its QR.
5. **Create updated file** → **Copy the file** → **First time? Create the file** (opens GitHub) → paste → **Commit changes**.
6. Wait about 10 minutes, then write the link to the tag and test it.

## Change a contact

Editor → paste admin key → **Unlock** → edit → **Create updated file** → **Copy the file** → open **contacts.enc.json on GitHub** → select all, paste over it → **Commit changes**. Cards show the change within about 10 minutes.

## Make a new card

Editor → **Unlock** → **Add a card** (driver name and ID, plus who has it, e.g. Family or School) → **Create updated file** → paste into GitHub → **Commit changes**.
Then write the link to the tag (NFC Tools → Write → Add a record → URL → paste → Write) and use the QR for the print. **Lock the tag only after testing it.**

- Add several cards, then save once.
- A driver can have several cards (family, school). Each can be removed on its own.
- Need the link or QR again? **Unlock** → **Link / QR** next to the card.
- Typo in a name? **Rename**, save, commit. The card itself doesn't need rewriting.

## A card is lost

Editor → **Unlock** → **Remove** next to that card → **Create updated file** → commit. About 10 minutes later that card stops working. **Every other card keeps working.**

Whoever has the lost card could already see the 6 contacts, and old versions of the file stay in GitHub's history. So they can still see the contacts as they were, but none of the changes you make after removing the card.

## The admin key

- It's the only way to edit, and it isn't stored anywhere. Keep it in your password manager.
- **Lost:** the cards keep working, but you can't edit. **Start fresh**, then rewrite every card.
- **Leaked:** **Start fresh** and rewrite every card. (Old versions of the file in GitHub's history can be opened with the old key.)

## How it's protected

- The repo and site are public, but `contacts.enc.json` is encrypted (AES-GCM, 128-bit keys, the browser's built-in Web Crypto). Without a card or the admin key, it's unreadable.
- Each card has its own key, kept only in the card's link after `#`. Browsers never send that part to any server, GitHub included.
- A card unlocks only the contacts and its own driver's name. It can't see other drivers or open the editor.
- Every save uses a fresh encryption key, so removed cards can't read anything saved later.
- The pages run only this site's own files (strict Content-Security-Policy): no outside scripts, trackers, cookies or logging. Search engines are asked not to index them.
- **The real lock is your GitHub account:** anyone who can commit to this repo can change the page. Keep two-factor authentication on and don't give anyone else write access.

## Weak signal

After a phone has opened the page once, it keeps a copy (`sw.js`). If the internet is down or takes more than 4 seconds, the saved copy opens with a note. Texting and calling only need normal cell signal. When online, the page always loads the latest contacts. **Tip:** ask families to tap the card once when they receive it.

## Trial checklist (real phones)

- Tag tap and QR scan both open the page with the right driver, on iPhone and Android.
- **Text all 6** opens Messages with all 6 numbers and the message. On Samsung, if some are missing, try the **Didn't get all of them?** link and note which one worked.
- Call buttons dial the right people.
- Airplane mode on a phone that has *never* opened the page shows the friendly error. A phone that has opened it before shows the saved copy, which is intended.
- Change a contact; the card shows it within about 10 minutes.
- Only then lock the NFC tag.

## Card tips

- 25 mm NTAG215 sticker, inserted by pausing the print 2–3 layers below the top surface. No metal or magnets nearby.
- QR at least 25 mm with a white border. The editor's SVG download imports straight into 3D modelling tools. Test-scan the first print.
- Card text: "EMERGENCY – tap phone here or scan", "Life-threatening: call 911 first", and a backup phone number.

## Files

| File | What it is |
|---|---|
| `index.html`, `app.js` | Emergency page |
| `edit.html`, `edit.js` | Editor |
| `crypto.js` | Encryption, shared by both |
| `sw.js` | Offline copy on the phone |
| `style.css` | Styles |
| `qrcode.js` | QR library: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 2.0.4 by Kazuhiko Arase (MIT), unmodified from npm (checksum verified). SHA-256 `79ec86f82856005b1c887905cfccfcfbec3821ca61c7fd5a952faa5f778f791c` |
| `contacts.enc.json` | Encrypted contacts and cards, created by the editor |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |
