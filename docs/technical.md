# Technical reference

For anyone maintaining or changing the code.

**Contents**

1. [Architecture](#1-architecture)
2. [Files](#2-files)
3. [The data file (contacts.enc.json)](#the-data-file-contactsencjson)
4. [Publishing and loading](#4-publishing-and-loading)
5. [Caching, deploys and the offline copy](#5-caching-deploys-and-the-offline-copy)
6. [The card maker](#6-the-card-maker)
7. [Changing the code safely](#changing-the-code-safely)
8. [How it was verified](#8-how-it-was-verified)
9. [Browser support and external services](#9-browser-support-and-external-services)

---

## 1. Architecture

- **Static site** on GitHub Pages (`main` branch, repository root). There's no server code, build step, framework or package manager; every file is served as-is (`.nojekyll`).
- **One data file**, `contacts.enc.json`, fully encrypted in the browser. The emergency page reads it with a card key. The dashboard reads it with the supervisors' password, or the owner password or recovery code, and writes it back through the GitHub REST API.
- **Two pages:**
  - `index.html` + `app.js`: the emergency page. It loads `crypto.js` and `schedule.js`.
  - `dashboard.html` + `dashboard.js`: the dashboard. It also loads `cardmaker.js` and its dependencies.

```
family phone ──(card link #key)──► index.html ──fetch──► contacts.enc.json ──decrypt with card key──► page
supervisor ──(password)──► dashboard.html ──GitHub API PUT──► contacts.enc.json (commit) ──► GitHub Pages
```

---

## 2. Files

| File | Role | Notes |
|---|---|---|
| `index.html` | Emergency page markup | The 911 banner is static, so it shows even if scripts fail. Every text element has an id for translation. `#hint` and `#text-retry` are empty, permanently hidden placeholders: older cached `app.js` versions still write to them. |
| `app.js` | Emergency page logic | English/Spanish strings, loading and decrypting, group-text links, call order, offline note, service worker registration. Must tolerate missing elements ([section 7](#changing-the-code-safely)). |
| `schedule.js` | Shift logic, shared | `YARD_TIME_ZONE` (`America/Chicago`, Houston), `yardNow`, `shiftOn`, `arrange` (call order), `withSchedule` (fills in shifts for first-version data), `timeLabel`, `shiftName`, `detailLine`, the Spanish shift-name table |
| `crypto.js` | Encryption, shared | Keys, AES-GCM `lock`/`unlock`, PBKDF2 `passwordKey`, recovery-code ECDH (`newRecovery`, `lockForOwner`, `openRecovery`), owner login (`makeOwnerLogin`, `openOwner`), `buildFile`, `openCard`, `openAdmin` |
| `sw.js` | Service worker | Offline copy of the emergency page ([section 5](#5-caching-deploys-and-the-offline-copy)) |
| `dashboard.html` | Dashboard markup | Sign-in, setup steps, tabs, Owner tab |
| `dashboard.js` | Dashboard logic | GitHub API, the sign-in flows (supervisor, owner, owner-access setup, recovery code, reclaim, first-time setup, upgrade), editing state, change list, validation, publishing, deploy watching, Print & QR, Owner tab |
| `cardmaker.js` | Print files | Card layout, 3D model and STL writer, canvas drawing, PDF writer, ZIP writer, print notes ([section 6](#6-the-card-maker)) |
| `style.css` | Styling | Tenaris colours from tenaris.com. Frutiger only if installed locally. |
| `logo.js`, `logo.svg` | Tenaris logo | Outlines from the official media kit: `logo.js` for drawing and 3D, `logo.svg` for the page headers |
| `dejavu-sans-bold.ttf` | Card lettering | DejaVu Sans Bold, subset to Basic Latin + Latin-1 + common punctuation |
| `qrcode.js` | QR encoder | qrcode-generator 2.0.4 (MIT), unmodified. SHA-256 `79ec86f82856005b1c887905cfccfcfbec3821ca61c7fd5a952faa5f778f791c` |
| `opentype.js` | Font reader | opentype.js 2.0.0 (MIT), unmodified `dist/opentype.min.js`. SHA-256 `b39d7bf9661481cec5c118a0d92b02951171d99c30d4d11252a72ecb0285439e` |
| `earcut.js` | Polygon triangulation | earcut 3.2.4 (ISC), unmodified `dist/earcut.min.js`. SHA-256 `29df76691215df89bf904051f35eb7aae1831011093d9783e843c3421931a334` |
| `words.js` | Password word list | EFF Large Wordlist (CC BY 3.0 US), minus the 4 hyphenated words: 7,772 words |
| `contacts.enc.json` | Data | Written only by the dashboard |
| `THIRD-PARTY-NOTICES.txt` | Licences | Licences for qrcode-generator, opentype.js, earcut, DejaVu and the EFF list, plus the logo's source |

---

## The data file (contacts.enc.json)

Version 3, pretty-printed JSON. All binary values (keys, nonces, ciphertext) are **base64url without padding**. Keys are 16 bytes, which is 22 characters.

```jsonc
{
  "version": 3,
  "data":  { "iv": "…", "ct": "…" },               // AES-GCM(dataKey)
  "cards": { "<slotId>": { "iv": "…", "ct": "…" } },  // one per card, AES-GCM(cardKey), sorted by slotId
  "admin": { "kdf": "PBKDF2-SHA256", "iterations": 600000, "salt": "…", "iv": "…", "ct": "…" },
  "recovery": { "pub": { "x": "…", "y": "…" }, "epk": { "x": "…", "y": "…" }, "iv": "…", "ct": "…" },  // once owner access exists
  "ownerLogin": { "kdf": "PBKDF2-SHA256", "iterations": 600000, "salt": "…", "iv": "…", "ct": "…" }  // once owner access exists
}
```

**`data`** (opened with the data key):

```jsonc
{
  "message": "EMERGENCY – need to reach driver {driver}. …",
  "messageEs": "EMERGENCIA – necesito comunicarme con el conductor {driver}. …",  // optional
  "contacts": [ { "id": "short id", "name": "…", "role": "…", "roleEs": "…", "phone": "+15555550100" } ],  // ids: 8 chars (dashboard) or c0, c1… (upgraded)
  "schedule": {
    "timeZone": "America/Chicago",            // always Houston; kept so older cached app.js versions work
    "fallback": "<contact id>",
    "shifts": [ { "name": "1st shift", "nameEs": "", "start": "06:00", "end": "14:00",
                  "days": [0,1,2,3,4,5,6],      // 0 = Monday … 6 = Sunday
                  "people": ["<contact id>"] } ]
  },
  "backup": "+15555550199"   // optional, "" if unset
}
```

**Each card entry** (opened with that card's key): `{ "dataKey": "…", "driver": "Jane Doe (1234)" }`.
The entry's name `slotId` is the first 12 characters of base64url(SHA-256(`"slot:" + cardKey`)).

**`admin`** (opened with PBKDF2-SHA256(supervisors' password, salt, iterations), 16-byte output):

```jsonc
{
  "dataKey": "…",
  "cards":  [ { "driver": "…", "note": "Family", "key": "<cardKey>", "added": "2026-10-02" } ],
  "github": { "token": "github_pat_…", "addedAt": "2026-10-02", "addedBy": "…" },
  "owner":  { "contact": "…", "pub": { "x": "…", "y": "…" }, "at": "2026-10-02", "login": { …same as ownerLogin… } },  // may be absent
  "adminKey": { "key": "…", "salt": "…", "iterations": 600000 },  // the supervisors'-password key, for the owner (via recovery)
  "log":    [ { "at": "ISO time", "who": "…", "what": ["Changed shifts", "…"] } ]  // last 200
}
```

**`recovery`** has the same plaintext as `admin`. It's encrypted with the AES key = first 16 bytes of SHA-256(ECDH-P256(recovery private key, `epk`) ‖ `"SUCH emergency cards recovery"`). `pub` is the owner's public key; the recovery code is its private scalar `d` (43 characters, base64url). `epk` is a one-time public key made on each publish.

**`ownerLogin`** is `{ "code": "<recovery code>" }`, AES-GCM-encrypted with PBKDF2-SHA256(owner password). It lives inside the admin payload (`owner.login`), so every publish, including a supervisor's, carries it forward unchanged. `buildFile` copies it to the top level, where owner sign-in reads it before anything else is unlocked. The recovery code itself is never stored anywhere a supervisor can read it.

**Sign-in paths:**

| Path | Opens | Then |
|---|---|---|
| Supervisors' password | `admin` | normal session |
| Owner password | `ownerLogin` → code → `recovery` | owner session; `adminKey` lets the owner publish |
| Recovery code | `recovery` | choose a new owner password (new `ownerLogin`) |
| Owner link without `ownerLogin` | `admin` with the supervisors' password | create the owner password and recovery code |
| Reclaim | `admin` with the supervisors' password | requires a new token whose `GET /user` login is the repository owner and which differs from the stored token; then create a new owner password and recovery code |

**First-version data (version 2)** came from the original copy-and-paste editor:

- `admin` is AES-GCM with a random 22-character admin key, containing `{ dataKey, cards }`.
- `data` is `{ message, primary, contacts: [{ name, role, phone }] }`, with no ids, schedule or Spanish fields.

`app.js` still reads it (`withSchedule` gives contacts ids and makes `primary` the fallback), and the dashboard upgrades it.

---

## 4. Publishing and loading

**Loading (dashboard):**

1. `GET https://api.github.com/repos/TenarisMcCarty/SUCH-Emergency-Contacts/contents/contacts.enc.json?ref=main` without authentication, with an 8-second timeout. This gives the newest commit and its `sha`.
2. If that fails (no network, or GitHub's unauthenticated limit of 60 requests per hour per IP address), it falls back to the site's copy, `contacts.enc.json?t=<time>`.
3. After sign-in, the same request is made with the token. That confirms the token works, records the `sha`, and warns if a newer version was published since the page loaded.

**Publishing:**

1. Validate: names, US phone numbers, no duplicate phones, both messages, shift names and days.
2. `buildFile`: new data key; encrypt `data`; one entry per card; the admin block (new log entry appended); the recovery block if the owner has a public key.
3. Self-check: the new file must open with the password **and** with every card key, or nothing is sent.
4. `PUT …/contents/contacts.enc.json` with `{ message: "Update emergency card data", content: base64, branch: "main", sha }`.
   - **409 / 422:** someone else published since sign-in. It's refused, and nothing is overwritten.
   - **401 / 403 / 404:** token problem. Supervisors are told to ask the owner.
5. GitHub Pages rebuilds, usually in under a minute. The dashboard polls `contacts.enc.json?t=<time>` every 5 seconds, for up to 10 minutes, until the site serves exactly the published text. The badge then goes Updating → Live, or Delayed if it times out.

The emergency page always fetches `contacts.enc.json?v=<time>`, which bypasses GitHub's CDN cache, so families see a publish within about a minute.

---

## 5. Caching, deploys and the offline copy

**GitHub Pages CDN:** every file is cached for up to **10 minutes** (`max-age=600`). Data is fetched with a unique query string, so it skips this cache. **Code is not**: after a code deploy, a phone can get the new `index.html` with the old `app.js`, or the reverse, for up to 10 minutes. See [section 7](#changing-the-code-safely).

**Service worker (`sw.js`)**, registered by the emergency page:

- **Files kept:** `''`, `index.html`, `app.js`, `crypto.js`, `schedule.js`, `style.css`, `logo.svg` and `contacts.enc.json`. They're saved on first visit, in cache `emergency-v4`.
- **Network first:** each request goes to the network. If that fails, takes longer than 4 seconds, or returns a 5xx error, the saved copy is used instead.
- **Saved copies are marked** with the response header `X-Offline-Copy: 1`; `app.js` then shows the offline note.
- **The network wins** whenever it gives a real answer, including "not found", so a removed card doesn't come back from the saved copy.
- **Data requests:** only `contacts.enc.json?v=…` is handled, saved under one name. The dashboard's `?t=` checks go straight to the network.
- **Activation:** a new cache name clears old caches when the worker updates (`skipWaiting` + `clients.claim`).

---

## 6. The card maker

`cardmaker.js` exposes a `CardMaker` object; everything runs in the browser.

1. **Layout** (`layout(card, '3d' | 'paper')`): builds the front and back as *zones*, areas of one base colour, holding *items*, outlines in the other colour. All in millimetres with y pointing up; the back is laid out as seen from the back.
   - Text outlines come from `opentype.js` and the font, with curves flattened to about 0.15 mm.
   - Text is fitted to width, and names wrap onto two lines if needed.
   - Text placement respects a circular keep-out around the NFC pocket.
   - `checkClearances` refuses designs where front art would cover the pocket, art leaves its zone, or back art enters the QR margin.
2. **Filling** (`fillZone`): nests the outlines by containment. Alternate levels get alternate colours (zone → letter → letter hole → …).
3. **3D model** (`model(card, tagThickness)`):
   - **Layers:** each filled region becomes a prism. The back skin goes at z 0–0.4 (mirrored, because it's printed face down), then the white core with a 25.6 mm pocket, then the front skin.
   - **QR:** drawn as rows of same-colour rectangles.
   - **Caps** are triangulated with `earcut`. Every point is nudged by up to 2 × 10⁻⁵ mm, always identically for the same point. Without this, letters sharing a baseline create collinear points and T-junctions.
   - **Output** is binary STL, one file per colour. Each part is a set of closed solids that touch along shared faces.
4. **Drawing** (`drawFace`, `labelCanvas`, `qrCanvas`): renders the same layout onto canvas, for the paper card at 600 dpi, the previews and the label. QR squares are snapped to whole pixels, so no seams appear.
5. **PDF** (`paperPdf`): a minimal PDF 1.4 writer. It embeds two RGB images, compressed with the browser's `CompressionStream('deflate')`, and draws cut marks and Helvetica text.
6. **ZIP** (`zip`): stored (uncompressed) ZIP with CRC-32 and UTF-8 names.

**Design constants** (top of the file):

| Constant | Value |
|---|---|
| Card size | 85.6 × 53.98 mm, corner radius 3.18 |
| Skins | 0.4 mm |
| Tag pocket | 25.6 mm, centred at (67, 39) on the front |
| Front white band | bottom 16.5 mm |
| QR area | 40 mm, at (40.6, 7) on the back |
| Smallest QR square | 0.8 mm |
| Smallest capital height | 2.3 mm |
| Pocket depth by tag thickness | ≤ 0.3 mm tag → 0.4 mm · ≤ 0.5 mm → 0.6 mm · ≤ 0.7 mm → 0.8 mm |

---

## Changing the code safely

1. **Never break existing card links.** Printed cards and locked tags can't be updated. The very first printed demo card already depends on these staying exactly as they are:
   - the link format: site + `#` + 22-character base64url key
   - the slot-id formula
   - the encryption of card entries
2. **Only ever add to the data format.** Phones may run a cached older `app.js`, so never rename or remove fields it reads: `message`, `contacts[].{id,name,role,phone}`, `schedule`, `cards`, and the card-entry fields. New fields must be optional on read.
3. **Expect mixed versions for up to 10 minutes after a deploy.** `app.js` must work with an older `index.html`: treat any new element as optional, as `applyLanguage` does. Likewise, an older `app.js` must not break on a newer `index.html`.
4. **If you change emergency-page files:** add new ones to `PATHS` in `sw.js`, and optionally bump `CACHE` so phones drop old copies.
5. **Never hand-edit `contacts.enc.json`.** The dashboard's `sha` check would refuse the next publish anyway, but a broken file would break every card.
6. **Keep names out of commit messages.** They're public.
7. **After deploying, open a real card link** on a phone, ideally after the 10-minute CDN window too, and run the relevant parts of the [trial checklist](cards-and-printing.md#trial-checklist).
8. **If you vendor a new third-party file,** verify its checksum against the npm registry, and add its licence to `THIRD-PARTY-NOTICES.txt`.

---

## 8. How it was verified

An automated suite was used during development. It isn't included in this repository, because it depends on a local Chrome, Python and a simulated GitHub. It drove headless Chrome against the site plus a simulated GitHub API and Pages, and covered:

- **Shift logic:** unit tests for overnight shifts, weekdays, 24-hour shifts, people on two shifts, time zones and daylight saving, and Spanish times and shift names.
- **Dashboard flows:**
  - first-time setup (supervisors' password, token checked against the repository owner, owner password, recovery code) and validation errors
  - owner sign-in with the owner password, and the supervisors' password refused on the owner link
  - owner access set up on data that had none (like the live site's data)
  - the owner setting a new supervisors' password without knowing the old one
  - owner access surviving supervisor publishes and supervisor password changes
  - reclaiming owner access (another account's token and the old token both refused)
  - the recovery code never readable with the supervisors' password
  - publishing: Updating → Live, history, generic commit messages
  - Discard
  - removing a card (data key rotated, removed card refused)
  - conflict detection
  - expired token, both as a supervisor ("ask the owner") and as the owner (replace it)
  - supervisor password change
  - owner "take away access"
  - owner password reset with the recovery code
  - upgrading from first-version data
- **Emergency page:**
  - iPhone and Android link formats
  - call order against an independent Python implementation
  - time-zone note
  - error states
  - HTML in names shown as text
  - English/Spanish: auto-detection, toggle, remembered choice, Spanish message and roles
  - offline copy and recovery once back online
  - deploy mixes: an older cached `index.html` with the new `app.js`, and the reverse
- **Encryption:** the published file was opened independently with Python's `cryptography` library: the password via PBKDF2, the card entries, and the recovery block via ECDH. It was also checked that no readable names, numbers or tokens appear in the file.
- **Print files:**
  - both STL parts watertight (every edge paired)
  - black + white areas tile each layer exactly, and the volume equals the card minus the sealed pocket
  - the QR decodes (with zxing-cpp) from the STL's back face, the PDF's embedded image, the label and the PNG
  - the ZIP is valid

**Not yet verified:** real phones (group-text formats, NFC through the card), a physical 3D print, and a paper print.

---

## 9. Browser support and external services

- **Browsers:**
  - Emergency page: Safari on iOS 14 or later, and any current Android browser. It uses Web Crypto (AES-GCM, SHA-256), service workers and modern JavaScript.
  - Dashboard: any current browser. It also uses PBKDF2 and ECDH P-256.
  - The paper-card PDF needs `CompressionStream` (Safari 16.4+, Chrome 80+, Firefox 113+).
- **GitHub Pages:** hosting, with deploys triggered by commits to `main` (usually under a minute).
- **GitHub REST API:** used only by the dashboard (the contents endpoint).
  - Loading works without authentication (60 requests per hour per IP address), falling back to the site copy.
  - Publishing uses the fine-grained token (5,000 requests per hour).
- **No other services:** no analytics, fonts, CDNs or third-party scripts.
