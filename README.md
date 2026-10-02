# SUCH Emergency Contacts

An emergency contact page for the families (and schools) of HLO drivers. Drivers can't carry phones, so each family gets a card with an NFC tag and a QR code. Tapping or scanning it opens a page that shows:

- **Call 911** at the top.
- **Text all**: one group text to every emergency contact, naming the driver.
- **On shift now**: a big Call button for whoever is on shift at that moment.
- **Also working now**, then **Off shift · still emergency contacts**, each with its own Call button.

## Links

- **Dashboard (for managers):** https://tenarismccarty.github.io/SUCH-Emergency-Contacts/dashboard.html
- **Emergency page:** https://tenarismccarty.github.io/SUCH-Emergency-Contacts/ (only works from a card's link)

## Handing it off

Send the dashboard link and tell them the password, in person or by phone. That's all they need. The dashboard's **Help** tab covers every common job. Nobody needs a GitHub account except for the one-time token step below.

## First-time setup (once)

Already set up with the first version (the copy-and-paste editor)? The dashboard asks for that **admin key** once, then runs steps 2–3 below. Contacts and cards carry over, and cards already written keep working.

1. Open the dashboard. It starts the setup.
2. **Password:** save the suggested password in your password manager, tick the box → Next.
3. **GitHub token:** follow the steps on screen (about 2 minutes, signed in to GitHub as TenarisMcCarty), paste the token → Check and continue.
4. Fill in **People**, tick who works each shift on the **Shifts** tab, add a trial card on the **Cards** tab.
5. **Publish.** The status turns **Live** within about a minute.

## Day to day

Everything happens in the dashboard: sign in, change things, press **Publish**. The top of the dashboard shows:

- whether everything is **Live** or there are changes **Not published** yet (with a list of them)
- who the cards would call **right now**
- when the last change was published, and by whom (full list in **History**)

## Shifts

The default shifts are 1st 6:00–14:00, 2nd 14:00–22:00, 3rd 22:00–6:00 (all week), and Day 8:00–17:00 (Mon–Fri). Change times, days and people any time. The big Call button goes to the person on the **first** shift in the list that's on right now. If nobody is on shift, it goes to the fallback person. Times use the yard's time zone, wherever the family is. **Check a time** on the Shifts tab shows who a card would call at any day and time.

## How it's protected

- The site and repo are public, but all data is in `contacts.enc.json`, encrypted (AES-GCM, the browser's built-in Web Crypto). Without a card or the dashboard password, it's unreadable.
- Each card has its own key, kept only in the card's link after `#`. Browsers never send that part to any server. A card unlocks only the contacts, the shifts and its own driver's name.
- A lost card can be removed on its own. Every publish uses a fresh encryption key, so a removed card sees nothing published after it was removed.
- The dashboard password is stretched (PBKDF2, 600,000 rounds) and should be the suggested 5-word one: the public file can be attacked offline, and it holds the GitHub token.
- The GitHub token can change only this repository. Commit messages are always "Update emergency card data", so no names appear in the public history.
- The pages run only this site's own files, plus GitHub's API on the dashboard. No trackers or cookies; search engines are asked not to index them.
- **Taking away access:** Settings → tick "Someone who should lose access…" → Change password (this also replaces the token) → Publish → delete the old token on GitHub.
- **Lost password:** "Lost the password?" on the sign-in screen starts over. Every card must then be rewritten.
- Old versions of the file stay in the repo's history. A removed card or an old password can still open those old versions, but nothing newer.

## Weak signal

After a phone has opened the page once, it keeps a copy (`sw.js`). If the internet is down or slow, the saved copy opens with a note. Texting and calling only need normal cell signal. **Tip:** ask families to tap the card once when they receive it.

## Trial checklist (real phones)

- Tag tap and QR scan both open the page with the right driver, on iPhone and Android.
- **Text all** opens Messages with every number and the message. On Samsung, if some numbers are missing, try **Didn't get all of them?** and note which one worked.
- The big Call button shows the person on shift now. Call buttons dial correctly.
- Change something in the dashboard, publish, and check the card shows it within about a minute.
- Only then lock the NFC tag (NFC Tools). Locking is permanent.

## Card tips

- 25 mm NTAG215 sticker, inserted by pausing the print 2–3 layers below the top surface. No metal or magnets nearby.
- QR at least 25 mm with a white border. The dashboard's SVG download imports straight into 3D modelling tools. Test-scan the first print.
- Card text: "EMERGENCY – tap phone here or scan", "Life-threatening: call 911 first", and a backup phone number.

## Files

| File | What it is |
|---|---|
| `index.html`, `app.js` | Emergency page |
| `dashboard.html`, `dashboard.js` | Dashboard |
| `crypto.js` | Encryption, shared by both |
| `schedule.js` | Who's on shift now, shared by both |
| `sw.js` | Offline copy on the phone |
| `style.css` | Tenaris styling (colours from tenaris.com; Frutiger is used only if it's installed on the device) |
| `words.js` | Word list for suggested passwords: [EFF Large Wordlist](https://www.eff.org/dice), CC BY 3.0 US |
| `qrcode.js` | QR library: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 2.0.4 by Kazuhiko Arase (MIT), unmodified from npm (checksum verified). SHA-256 `79ec86f82856005b1c887905cfccfcfbec3821ca61c7fd5a952faa5f778f791c` |
| `contacts.enc.json` | Encrypted data, written by the dashboard's Publish button |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |
