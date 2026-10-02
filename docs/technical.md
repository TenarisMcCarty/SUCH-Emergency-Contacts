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
- **One data file**, `contacts.enc.json`, fully encrypted in the browser. The emergency page reads it with a card key. The dashboard reads it with a supervisor's own email and password, the shared supervisors' password, or the owner password or recovery code, and writes it back through the GitHub REST API.
- **Two pages:**
  - `index.html` + `app.js`: the emergency page. It loads `crypto.js` and `schedule.js`.
  - `dashboard.html` + `dashboard.js`: the dashboard. It also loads `cardmaker.js` and its dependencies.

```
family phone ──(card link #key)──► index.html ──fetch──► contacts.enc.json ──decrypt with card key──► page
supervisor ──(email + password)──► dashboard.html ──GitHub API PUT──► contacts.enc.json (commit) ──► GitHub Pages
```

---

## 2. Files

| File | Role | Notes |
|---|---|---|
| `index.html` | Emergency page markup | The 911 banner is static, so it shows even if scripts fail. Every text element has an id for translation. `#hint` and `#text-retry` are empty, permanently hidden placeholders: older cached `app.js` versions still write to them. |
| `app.js` | Emergency page logic | English/Spanish strings, loading and decrypting, group-text links, call order, WhatsApp button, yard address and directions link, Save to Contacts (one vCard 3.0 contact with labelled numbers, made in the browser; opened directly on iPhone, downloaded elsewhere), remembering the last card key, offline note, service worker registration. Must tolerate missing elements ([section 7](#changing-the-code-safely)). |
| `schedule.js` | Shift logic, shared | `YARD_TIME_ZONE` (`America/Chicago`, Houston), `yardNow`, `shiftOn`, `arrange` (call order), `withSchedule` (fills in shifts for first-version data), `timeLabel`, `shiftName`, `detailLine`, the Spanish shift-name table |
| `crypto.js` | Encryption, shared | Keys, AES-GCM `lock`/`unlock`, PBKDF2 `passwordKey`, ECDH (`newRecovery`, `lockForOwner`), `openCard`; version 4: `personSlot`, `newSignIn`, `openLogin`, `openWithWrap`, `openForSignIn`, `openWithCode`, `openWithOwnerPassword`, `fromVersion3`, `buildFile4`; version 3, kept unchanged for older cached dashboards: `buildFile`, `openAdmin`, `openOwner`, `openRecovery`, `makeOwnerLogin`. Loaded by both pages into one global scope, so new names must not clash with `app.js` or `dashboard.js`. |
| `manifest.json`, `icon-*.png`, `apple-touch-icon.png` | Home-screen app | Name "Emergency", Tenaris mark on charcoal. `start_url` is `./` (no card key), so `app.js` falls back to the last card key saved in `localStorage` when the link has no `#`. |
| `sw.js` | Service worker | Offline copy of the emergency page ([section 5](#5-caching-deploys-and-the-offline-copy)) |
| `dashboard.html` | Dashboard markup | Sign-in (Email, password, Forgot password?), setup steps (including the one-time temporary password), tabs, Owner tab |
| `dashboard.js` | Dashboard logic | GitHub API, the sign-in flows (personal, shared password, first sign-in password change, owner, owner-access setup, recovery code, reclaim, first-time setup, upgrade), editing state, change list, validation, 90-day number checks, shift-gap warning, publishing (with a self-check), deploy watching, Print & QR, Owner tab (people who can sign in, shared password, token, owner password, recovery code). Elements added for personal sign-ins are optional, for cache mixes with an older `dashboard.html`. |
| `cardmaker.js` | Print files | Card layout, 3D model and STL writer, canvas drawing, PDF writer, ZIP writer, print notes ([section 6](#6-the-card-maker)) |
| `style.css` | Styling | Brand colours and type ([Tenaris brand](#tenaris-brand)). Frutiger if installed locally, otherwise Source Sans 3. |
| `logo.svg` | Tenaris signature | The official full-colour artwork from tenaris.com, unchanged (only a `<title>` added). Used in both page headers and for the home-screen icons. |
| `logo.js` | Tenaris signature outlines | The same artwork as flattened outlines with their colours, for the card maker (paper in colour, 3D in one colour). Also records the Multibar's size for clear-space and minimum-size checks. |
| `source-sans-3-regular.woff2`, `source-sans-3-bold.woff2` | Page typeface | Source Sans 3 (Adobe, SIL Open Font License), unmodified release files. Also kept in the offline copy. |
| `source-sans-3-bold.ttf` | Card lettering | Source Sans 3 Bold, unmodified, read by opentype.js |
| `qrcode.js` | QR encoder | qrcode-generator 2.0.4 (MIT), unmodified. SHA-256 `79ec86f82856005b1c887905cfccfcfbec3821ca61c7fd5a952faa5f778f791c` |
| `opentype.js` | Font reader | opentype.js 2.0.0 (MIT), unmodified `dist/opentype.min.js`. SHA-256 `b39d7bf9661481cec5c118a0d92b02951171d99c30d4d11252a72ecb0285439e` |
| `earcut.js` | Polygon triangulation | earcut 3.2.4 (ISC), unmodified `dist/earcut.min.js`. SHA-256 `29df76691215df89bf904051f35eb7aae1831011093d9783e843c3421931a334` |
| `words.js` | Password word list | EFF Large Wordlist (CC BY 3.0 US), minus the 4 hyphenated words: 7,772 words |
| `contacts.enc.json` | Data | Written only by the dashboard |
| `THIRD-PARTY-NOTICES.txt` | Licences | Licences for qrcode-generator, opentype.js, earcut, Source Sans 3 and the EFF list, plus the logo's source |

---

## The data file (contacts.enc.json)

Version 4, pretty-printed JSON. All binary values (keys, nonces, ciphertext) are **base64url without padding**. AES keys are 16 bytes, which is 22 characters. `data` and `cards` are exactly as in version 3, so every `app.js`, old or new, reads both versions.

```jsonc
{
  "version": 4,
  "data":  { "iv": "…", "ct": "…" },                  // AES-GCM(dataKey)
  "cards": { "<slotId>": { "iv": "…", "ct": "…" } },     // one per card, AES-GCM(cardKey), sorted by slotId
  "admin": { "iv": "…", "ct": "…" },                  // AES-GCM(K), the admin key: new on every publish
  "wraps": {                                          // {} when the shared password is switched off
    "password": { "login": { …login… }, "wrap": { …wrap… } }   // the shared supervisors' password
  },
  "people": { "<personSlot>": { "login": { …login… }, "wrap": { …wrap… } } },  // one per personal sign-in, sorted
  "recovery": { …wrap… },                             // K for the owner's recovery code (once owner access exists)
  "ownerLogin": { "kdf": "PBKDF2-SHA256", "iterations": 600000, "salt": "…", "iv": "…", "ct": "…" }
}
// login = { "kdf": "PBKDF2-SHA256", "iterations": 600000, "salt": "…", "iv": "…", "ct": "…" }
//         AES-GCM(PBKDF2-SHA256(password, salt)) of { "d": "<P-256 private key>", "pub": { "x", "y" } }
// wrap  = { "pub": { "x", "y" }, "epk": { "x", "y" }, "iv": "…", "ct": "…" }
//         AES-GCM of { "k": "<K>" } with key = first 16 bytes of SHA-256(ECDH-P256(d, epk) ‖ "SUCH emergency cards recovery");
//         pub is the sign-in's public key, epk a one-time public key made on each publish (lockForOwner in crypto.js)
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
  "backup": "+15555550199",  // optional, "" if unset
  "yardAddress": "302 McCarty St, Houston, TX 77029",  // optional: absent = the built-in YARD_ADDRESS, "" = hidden
                                                     // (an older non-empty "address" field is still read)
  "whatsapp": false          // optional, WhatsApp button for the primary call
}
```

**Each card entry** (opened with that card's key): `{ "dataKey": "…", "driver": "Jane Doe (1234)" }`.
The entry's name `slotId` is the first 12 characters of base64url(SHA-256(`"slot:" + cardKey`)).

**Each person entry** is filed under `personSlot`: the first 16 characters of base64url(SHA-256(`"person:" + email.trim().toLowerCase()`)). Its `login` holds that person's private key, locked with their own password.

**`admin`** (opened with K):

```jsonc
{
  "dataKey": "…",
  "cards":  [ { "driver": "…", "note": "Family", "key": "<cardKey>", "added": "2026-10-02" } ],
  "github": { "token": "github_pat_…", "addedAt": "2026-10-02", "addedBy": "…" },
  "owner":  { "contact": "…", "pub": { "x": "…", "y": "…" }, "at": "2026-10-02", "login": { …same as ownerLogin… } },  // may be absent
  "shared": { "pub": { "x", "y" }, "login": { …login… } },  // the shared password's sign-in, or null when switched off
  "people": [ { "email": "jane.doe@example.com", "name": "Jane Doe", "pub": { "x", "y" }, "login": { …login… },
                "mustChange": true, "addedAt": "2026-10-02", "addedBy": "…" } ],
  "log":    [ { "at": "ISO time", "who": "Jane Doe", "email": "…", "via": "person", "what": ["Changed shifts", "…"] } ],  // last 200
                // via: "person" (who = the name the owner gave), "shared" or "owner" (who = typed in Settings); email only for "person"
  "confirmed": { "<contact id>": "2026-10-02" }  // when each number was last checked; may be absent
}
```

Whoever publishes rebuilds the whole file from the admin block: a new data key and a new K, K wrapped to `shared.pub`, to each `people[].pub` and to `owner.pub`, and every `login` copied unchanged. So publishing needs only public keys, and a person removed from `people` never receives a later K.

**`ownerLogin`** is `{ "code": "<recovery code>" }`, AES-GCM-encrypted with PBKDF2-SHA256(owner password). It lives inside the admin block (`owner.login`) and `buildFile4` copies it to the top level, where owner sign-in reads it before anything else is unlocked. The recovery code is the owner's P-256 private scalar `d` (43 characters); `recovery` wraps K for its public key `owner.pub`.

**Passwords and key pairs:** adding a person, resetting their password, a person changing their own password, and setting a new shared password all make a **new key pair**. Re-locking the old private key wouldn't do: old file versions stay public, so an old (or temporary) password would keep opening the old `login`, and its private key would keep opening every later wrap.

**Sign-in paths:**

| Path | Opens | Then |
|---|---|---|
| Email + password | `people[personSlot(email)].login` → d → `wrap` → K → `admin` | normal session; History uses the person's `name`; `mustChange` forces a new password (and a publish) first |
| Shared password (Email empty) | `wraps.password.login` → d → `wrap` → K → `admin` | normal session |
| Owner password | `ownerLogin` → code → `recovery` → K → `admin` | owner session |
| Recovery code | `recovery` → K → `admin` | choose a new owner password (new `ownerLogin`) |
| Owner link without `ownerLogin` | either supervisor sign-in | create the owner password and recovery code |
| Reclaim | either supervisor sign-in | requires a new token whose `GET /user` login is the repository owner and which differs from the stored token; then create a new owner password and recovery code |

**Version 3 data** (before personal sign-ins): no `wraps` or `people`; `admin` is `{ "kdf", "iterations", "salt", "iv", "ct" }`, AES-GCM-encrypted directly with PBKDF2-SHA256(supervisors' password), and `recovery` holds a copy of the whole admin block (with `adminKey`, the password-derived key) instead of K. The dashboard still opens it (`openForSignIn`, `openWithCode`): it reads it as "shared password on, nobody else", turning the shared password into a sign-in locked with the same password key (same salt), so the same password keeps working. The next publish writes version 4. An older cached `dashboard.js` can't open version 4: it shows its "Upgrade / Old admin key" screen or "Wrong password", and can't publish. `buildFile`, `openAdmin`, `openOwner` and `openRecovery` stay in `crypto.js` unchanged, so an older cached `dashboard.js` paired with the new `crypto.js` behaves exactly as before.

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
2. `buildFile4`: new data key and admin key K; encrypt `data`; one entry per card; the admin block (new log entry appended); K wrapped for the shared password (if on), each person and the owner.
3. Self-check: the new file must open with every card key, and with every private key the tab knows (the sign-in used, the owner's recovery code, sign-ins made in this session), at least one; and there must be one `people` entry per person. Otherwise nothing is sent.
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

## Tenaris brand

Everything follows the *Tenaris Brandmark Basic Guidelines* (Tenaris Marketing Communications):

- **Signature:** only the official artwork (`logo.svg` / `logo.js`, from tenaris.com), never redrawn, stretched, recoloured or boxed in. Full colour on white (page headers, home-screen icons, paper card, QR label); one colour (white on black) on the two-colour 3D card, which the guide allows.
- **Minimum size:** Multibar at least 5.5 mm tall in print. The 3D and paper card use a 44 mm signature (Multibar 7.9 mm) and the label 48 mm (8.6 mm). The paper card's back has no logo, because it would be too small there.
- **Clear space:** 80% of the Multibar's height on every side. `cardmaker.js` computes it (`clearSpace`) and places the logo and the text below it accordingly. On screen, the header's padding and gap give the same.
- **Colours:** on screen, the guide's values: Tenaris Green `#009900`, Tenaris Blue `#000099`, Tenaris Gray `#666666`. A darker green `#007a00` is used only where small white text needs more contrast. Red stays for 911 and amber for dashboard warnings, for safety. The signature keeps the colours of its own artwork.
- **Type:** Frutiger is the Tenaris typeface but needs a paid licence, so the site and the cards use Source Sans 3, a free typeface in the same humanist style. Computers with Frutiger installed show Frutiger.

## The test copy (staging)

Code changes are tried on a separate **test copy** before they go live, so a half-finished change can never break the cards.

- **Local folder:** `~/SUCH-Emergency-Contacts-staging`, its own git repository with **fake data** (made-up people with fictional 555-01xx numbers, one demo card, test-only passwords). It is never connected to the live repository.
- **Online (optional):** a separate repository `TenarisMcCarty/SUCH-Emergency-Contacts-staging` with its own GitHub Pages site. Every page there shows a **Test site** label. `dashboard.js` works out which repository it belongs to from the page address, so the same code runs on both. Publishing on the test site needs its own GitHub token for that repository (Owner tab → Replace GitHub token).
- **Going live:** only with the owner's approval. Copy the code files (everything except `contacts.enc.json` and `.git`) from the test copy to the live repository, commit and push, then open the printed demo card's link to check.
- The test copy's data file must never be copied to the live site, and the live data file must never be copied to the test copy: a card removed on the live site would still open the copy.

## Changing the code safely

Try every change on the test copy first ([above](#the-test-copy-staging)), and go live only with the owner's approval. Then:

1. **Never break existing card links.** Printed cards and locked tags can't be updated. The very first printed demo card already depends on these staying exactly as they are:
   - the link format: site + `#` + 22-character base64url key
   - the slot-id formula
   - the encryption of card entries
2. **Only ever add to the data format.** Phones may run a cached older `app.js`, so never rename or remove fields it reads: `message`, `contacts[].{id,name,role,phone}`, `schedule`, `cards`, and the card-entry fields. New fields must be optional on read.
3. **Expect mixed versions for up to 10 minutes after a deploy.** `app.js` must work with an older `index.html`: treat any new element as optional, as `applyLanguage` does. Likewise, an older `app.js` must not break on a newer `index.html`. A dashboard tab still running an older `dashboard.js` drops fields it doesn't know (e.g. `address`, `whatsapp`, `confirmed`) if it publishes, so re-check them after a deploy that adds fields. A `dashboard.js` from before version 4 can't open a version 4 file at all; the new `dashboard.js` says "just updated, reload" if it meets an older cached `crypto.js`.
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
  - personal sign-ins: a version 3 file opens and its first publish writes version 4 (same shared password, owner password, recovery code and card); the owner adds a person and the temporary password shown signs in; a new password is required first, Discard is hidden, and it only takes effect after publishing; the person publishes and History shows their name (not a typed one); changing one's own password leaves every other sign-in untouched; reset; remove (the removed person's private key opens nothing newer, and they can't sign in); switching the shared password off (refused at sign-in, people still work) and back on; reclaiming owner access with a personal sign-in; **Forgot password?** writes the right email
  - older cached code: a pre-version-4 `dashboard.js` can't sign in to a version 4 file and publishes nothing; the new `dashboard.js` with an older `crypto.js` or `dashboard.html` behaves safely
  - upgrading from first-version data
  - 90-day number checks: missing dates count from the last publish, **Still right**, a changed number counts as checked, dates kept only in the admin block
  - shift gaps: overnight and weekend gaps merged across Sunday→Monday, listed Monday first, ✓ when covered
  - yard address (trimmed) and the WhatsApp switch in the change list and the published data
- **Emergency page:**
  - iPhone and Android link formats
  - call order against an independent Python implementation
  - time-zone note
  - error states
  - HTML in names shown as text
  - English/Spanish: auto-detection, toggle, remembered choice, Spanish message and roles
  - offline copy and recovery once back online
  - deploy mixes: an older cached `index.html` with the new `app.js`, and the reverse
  - WhatsApp link (number and message, English and Spanish), hidden when off or on older data
  - yard address with Apple Maps (iPhone) / Google Maps (others) links
  - the vCard: one contact, every number labelled (itemN.TEL + X-ABLabel), escaping, Spanish name and roles, address and note; iPhone opens it, Android downloads it
  - the manifest loads under the CSP, Chrome's installability check passes, the plain address reopens the last card, and a wrong key isn't remembered
- **Encryption:** the published file was opened independently with Python's `cryptography` library: each sign-in's `login` via PBKDF2, its `wrap` and the recovery block via ECDH P-256, the admin block and the card entries via AES-GCM. It was also checked that no readable names, emails, numbers or tokens appear in any published version.
- **Print files:**
  - both STL parts watertight (every edge paired)
  - black + white areas tile each layer exactly, and the volume equals the card minus the sealed pocket
  - the QR decodes (with zxing-cpp) from the STL's back face, the PDF's embedded image, the label and the PNG
  - the ZIP is valid

**Not yet verified:** real phones (group-text formats, NFC through the card, Save to Contacts, WhatsApp), a physical 3D print, and a paper print.

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
- **Links out (only when a family taps them):** `wa.me` (WhatsApp), `maps.apple.com` and `google.com/maps` (directions). Nothing is loaded from them.
- **No other services:** no analytics, fonts, CDNs or third-party scripts.
