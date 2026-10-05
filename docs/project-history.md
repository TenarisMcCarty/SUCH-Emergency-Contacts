# Project history, decisions and how the work is done

A complete record of how this site was built, every decision the owner made and why, how changes are made and released safely, how everything was tested, and what is still open. Read this before changing anything; the other guides describe how the site works *today*, this one explains *how it got here*.

**Contents**

1. [What the project is](#1-what-the-project-is)
2. [Timeline of releases](#2-timeline-of-releases)
3. [Decision log](#3-decision-log)
4. [The Tenaris brand work](#4-the-tenaris-brand-work)
5. [The 3D card: design history and final spec](#5-the-3d-card-design-history-and-final-spec)
6. [Individual sign-ins: design notes](#6-individual-sign-ins-design-notes)
7. [How changes are made and released](#7-how-changes-are-made-and-released)
8. [Staying safe during deploys (mixed cached files)](#8-staying-safe-during-deploys-mixed-cached-files)
9. [How everything was tested](#9-how-everything-was-tested)
10. [Incidents and lessons](#10-incidents-and-lessons)
11. [Open items and ideas](#11-open-items-and-ideas)
12. [Things that must never change](#12-things-that-must-never-change)

---

## 1. What the project is

- **Purpose:** drivers at the Tenaris HLO yard in Houston can't carry phones while working. Their families (and schools) get a wallet card with a hidden **NFC tag** and a **QR code**. Tapping or scanning opens a page that reaches the yard's supervisors in one or two taps: a group text to all of them, and Call buttons ordered by who is on shift right now.
- **Who uses what:**
  - Families: the emergency page (`index.html` + `app.js`), opened from their card's own link.
  - Supervisors: the dashboard (`dashboard.html`), each with their own email and password.
  - The site owner: the dashboard's owner link (`dashboard.html#owner`), with a separate owner password and recovery code.
- **How it's built:** a static site on GitHub Pages (repository `TenarisMcCarty/SUCH-Emergency-Contacts`, branch `main`). No server, no database, no build step. All data is in one encrypted file, `contacts.enc.json`, which only the dashboard's **Publish** button writes. See [technical.md](technical.md) for the architecture and file format.
- **Scale it was designed for:** about 50 cards, about 10 contacts, rotating shifts, and hand-off to supervisors who shouldn't need training.

---

## 2. Timeline of releases

All on 2026-10-02 (times are Houston time). Commits named "Update emergency card data" are publishes from the dashboard and are not listed.

| Commit | Time | What changed | Why |
|---|---|---|---|
| `fb0a86b` | 07:36 | First version: encrypted card site, per-card keys, copy-and-paste admin editor | Families need a page that works from a public repository without exposing phone numbers |
| `102959f` | 08:24 | Publishing dashboard (saves straight to GitHub), shift-aware call order, Tenaris styling | Supervisors can't be expected to edit files or commit by hand |
| `4aeb93f` | 08:27 | Upgrade path from the first version's data | Cards already written had to keep working |
| `6ad7d10` | 09:21 | Print & QR generator (3D STL, paper PDF, label, QR), owner recovery code | Make the physical cards from the data; never lose admin access |
| `3c379b8` | 09:32 | Clearer errors (missing name, hung GitHub load) | Supervisors were left guessing |
| `0394b27` | 10:18 | Spanish for everything families see | Many families prefer Spanish |
| `b99e67d` | 10:24 | Emergency page tolerates an older cached page | GitHub's 10-minute cache mixes old and new files after a deploy ([section 8](#8-staying-safe-during-deploys-mixed-cached-files)) |
| `5338ea9` | 11:36 | Full documentation set | Hand-off |
| `ea30339` | 12:08 | Separate owner password; always Houston time; simpler card-page wording | Supervisors shouldn't be able to reach owner functions; the yard is in Houston |
| `274dcb0` | 13:41 | Shift-gap warning, 90-day number checks, yard address, WhatsApp option, Save to Contacts, home-screen icon | Owner's chosen improvements ([section 3](#3-decision-log)) |
| `fa30a33` | 13:55 | Tenaris brand guidelines applied: official signature artwork, colour logos, clear space, minimum sizes, brand colours, Frutiger-style typeface; group-text button renamed "Text All Yard Supervisors (Preferred)" | Owner supplied the *Tenaris Brandmark Basic Guidelines* ([section 4](#4-the-tenaris-brand-work)) |
| `36c5cf2` | 14:27 | Built-in yard address (302 McCarty St, Houston, TX 77029), stored as `yardAddress`; "Test site" label; guards for older cached files | Address should show without anyone typing it; the test copy must never be mistaken for the live site |
| `558fdf0` | 15:59 | Individual email sign-ins; one combined "Tenaris Yard Supervisors" contact; Add to home screen removed; "Emergency contact for" heading leads, driver name smaller | Shared password replaced; iPhone only saved one person; families know who their relative is |
| `3c5c9d8` | 16:41 | Wallet 3D card (2.2 mm, logo face down, tag sealed in, bigger text) with a Bambu Studio project download; paper card, label and plain QR downloads removed; cleaner dashboard screens without explanatory text | Small text didn't suit 3D printing; one card type only; the site should look professional |
| `2493438` | 17:13 | Passwords: 8+ characters with a number and a symbol; shorter suggested and temporary passwords | Owner's choice: the 20-character minimum was too long |

---

## 3. Decision log

Every choice the owner made, with the reason. When in doubt later, these are the requirements.

### Family page

| Decision | Reason / detail |
|---|---|
| Always **Houston time**; no time-zone setting | The yard is in Houston. Families elsewhere see a note. |
| Headings **"Primary call"** and **"Not scheduled · still emergency contacts"** (ES "Llamada principal", "No programados · también son contactos de emergencia") | Owner's wording. |
| Group-text button reads exactly **"Text All Yard Supervisors (Preferred)"** (ES "Enviar mensaje a todos los supervisores del patio (preferido)") | Owner's wording; texting all is the preferred first step. |
| No "Then tap Send" hint, no Samsung retry link | Owner removed them; `#hint` and `#text-retry` stay as hidden placeholders for older cached scripts. |
| **"Emergency contact for"** is the big heading; the driver's name is small and gray | Cards go to the driver's own family, who know who it's for. |
| **Yard address** 302 McCarty St, Houston, TX 77029 with **Directions** (Apple Maps on iPhone, Google Maps elsewhere) | Built in as `YARD_ADDRESS` in `schedule.js`; supervisors can change it or empty it to hide it. |
| **WhatsApp** button for the primary call, **off** unless switched on (Supervisors tab) | WhatsApp links can only message one person; only useful if the yard watches WhatsApp. Off on the live site so far. |
| **Save yard numbers to Contacts** makes **one** contact, "Tenaris Yard Supervisors", every number labelled with name and role | iPhone imported only the first of several contacts. One contact also means any callback from the yard shows as "Tenaris Yard Supervisors". |
| **Add to home screen** link removed | Owner found it useless. The web-app manifest and icons stay, so people can still add it from the browser menu, and the page remembers the last card so the icon works. |
| Spanish follows the phone's language, with a switch | Many families prefer Spanish. Printed cards are English only (Spanish is about 30% longer and doesn't fit at printable sizes). |

### Dashboard and access

| Decision | Reason / detail |
|---|---|
| Supervisors never see GitHub or token settings | Only the owner manages the token. |
| **Individual sign-ins** (email + password) instead of one shared password | Accountability (History shows who published) and removing one person without changing everyone's password. |
| The owner adds, resets and removes people; adding or resetting shows a **temporary password once**; the person must choose their own at first sign-in | No server means no email sending; the owner hands passwords over in person or by phone. |
| **Forgot password?** opens an email to **salil@tenaris.com** from the person's own mail app | No server. The owner confirms by phone, then resets. The address is in `dashboard.js` and `dashboard.html`. |
| The old **shared password** works (Email left empty) until the owner turns it off | Smooth migration; turn it off once everyone has their own sign-in, then replace the GitHub token. |
| **Password rule: at least 10 characters, with a number and a symbol** (8 until 2026-10-05; passwords chosen before still work) | Owner's choice. Suggested and temporary passwords (since 2026-10-05, owner's request: longer, with a symbol, HSE-themed) are five HSE words, two digits and a symbol, e.g. `harness-bayou-muster-flange-teamwork-47!` (about 56 bits); before that `maple-river-47!` (about 36 bits). Trade-off documented in [security.md](security.md). |
| **No explanatory text on screens**; only labels, data and buttons (one short line only where it prevents an irreversible mistake) | Owner: the site must look professional, not homemade. Explanations live in these docs and are given in person. |
| **90-day number checks**: each number shows when it was last checked; amber after 90 days with **Still right** | Keeps numbers current. Dates are stored only in the dashboard's encrypted data, never on cards. Changing a number counts as checking it. |
| **Shift-gap warning** on the Shifts tab | Shows every time in the week with nobody on shift (the fallback person gets the primary call then). Gaps aren't errors. |
| GitHub token set to **never expire** | Owner's setting, so there's no expiry warning feature. |
| **Dashboard laid out for a computer**, opening on **Shifts** | Supervisors use it from a PC; the family page stays phone-first. Shifts is what changes at every rotation. |
| Tabs named **Supervisors** (the emergency contacts) and **People** (the drivers' cards) | Owner's wording (2026-10-05). The tabs' internal names (`people`, `cards`) stay the same for older cached files. |
| **Time off** (Shifts tab): person, first and last day, optional cover; the person is left off the card page and the group text, the cover takes their shifts | A supervisor on holiday shouldn't get emergency calls they may not answer. Kept with the shifts in the card-readable data so the page works it out live, with no republishing when someone comes back. |
| **Locks by itself after 30 minutes without use**, never with unpublished changes | An office computer left signed in shouldn't stay open; nobody should lose unpublished work. |

### Cards and printing

| Decision | Reason / detail |
|---|---|
| **Only the 3D card**; paper card, 4×6 label and plain QR downloads removed | Keep things simple. The Print & QR tab offers the **Bambu Studio project (3MF)** or **STL files with print notes (ZIP)**. |
| One NFC tag: **NTAG215 round sticker, 25 mm, 0.8 mm thick** (white coin stickers, bought in 50s) | Uniform cards; the sticker-thickness choice was removed. |
| Printer: **Bambu Lab P2S, 0.4 mm nozzle, AMS**; material **ASA or ABS** (from 2026-10-05: **ABS or PETG**, ASA dropped by the owner; any enclosed Bambu printer) | Longevity in a wallet. |
| **Two colours** (black + white) on the 3D card | Owner's printer setup; the brand guide allows the one-colour (white on black) signature. |
| **Logo side printed face down**, tag sealed inside, card 2.2 mm (until 2026-10-05; now **face up, 1.7 mm**) | The front gets the plate's flat finish and can never show the pocket; sturdy but still fits a wallet. Changed after the first trial print: on the plate the letters came out grainy; on top they're traced by walls. |
| **Minimal, larger text**: front = logo, EMERGENCY CONTACT, driver name; back = QR, SCAN OR TAP, small tap symbol, backup number, LIFE-THREATENING? CALL 911 | Small text doesn't 3D-print cleanly; the old three-line instruction band and the big "TAP PHONE HERE" ring were removed. Smallest capitals 3.5 mm. |

### Process

| Decision | Reason / detail |
|---|---|
| Changes are made in a **test copy on the owner's Mac** first, and go live only with the owner's approval | The live site must never break, even if a working session is cut off mid-change. No online test site (owner's choice). |
| Exception: small changes the owner explicitly asks to make "directly in the git" | Still tested first, then copied back to the test copy. |
| Never put people's names in commit messages | Commit messages are public. |

---

## 4. The Tenaris brand work

Based on the *Tenaris Brandmark Basic Guidelines* (Tenaris Marketing Communications, 43 pages) supplied by the owner. The rules applied, and where:

- **Official artwork only, never redrawn or altered.**
  - **Finding:** the first logo outlines (from an earlier generated file) had the **wrong bar proportions**: the Multibar's bars were roughly 1 : 1 : 1.9 : 3.8. In both the guide and Tenaris's own website they are graduated, about **1 : 1.5 : 3 : 6** (thin, thin, medium, thick, medium, thin, thin).
  - **Fix:** the signature was replaced with the artwork Tenaris itself publishes on tenaris.com. It's taken unchanged from the site's icon bundle (`logo-tenaris-filled.svg`, full colour, with bar colours fuchsia, green, blue, green, fuchsia, blue, green, and a gray wordmark).
  - `logo.svg` is that file (only a `<title>` added). `logo.js` holds the same outlines, flattened, with each shape's colour and the Multibar's size, for the card maker.
  - If Tenaris updates its logo, replace both from tenaris.com and keep `logo.js`'s format.
- **Minimum size:** Multibar at least **5.5 mm** tall in print. The 3D card uses a 40 mm signature (Multibar 7.2 mm).
- **Clear space:** **80% of the Multibar's height** on every side. `cardmaker.js` computes it (`clearSpace`) and keeps text out of it. On screen, the header's padding and gap give the same.
- **Colour versions:**
  - full colour on white: the page headers and the home-screen icons, which are white with the full signature and clear space
  - one colour (white on black): the 3D card, which the guide allows
  - never on a dark background in full colour at small sizes; never inside a shape
- **Colours on screen** (the guide's on-screen values):
  - Tenaris Green `#009900`
  - Tenaris Blue `#000099`
  - Tenaris Gray `#666666`
  - a darker green `#007a00` only where small white text needs contrast
  - red only for 911 and destructive actions; amber only for dashboard warnings
- **Typeface:** Frutiger is the Tenaris typeface but needs a paid licence, and this site is public.
  - The site and cards use **Source Sans 3** (Adobe, SIL Open Font License), a free humanist sans in the same style. Computers with Frutiger installed show Frutiger.
  - The font files are the **unmodified** release files. The licence reserves the name "Source", so trimmed (subset) copies would count as modified fonts.
- **Header:** white, with the full-colour signature, so the guide's preferred version is the one people see.

---

## 5. The 3D card: design history and final spec

**Versions:**
1. **First design (until 16:41):**
   - 1.4 mm thick, QR side down
   - a choice of three sticker thicknesses
   - a three-line instruction band on the front
   - a big "TAP PHONE HERE" ring on the back
   - small lettering (2.3 mm minimum)
   - a matching paper card and label
2. **Intermediate (staging only):** "EMERGENCY CONTACT" made the big text and the name small. The owner liked the hierarchy, but small text doesn't suit 3D printing.
3. **Wallet card, face down (live from `3c5c9d8` until the 2026-10-05 redesign):** the spec below, kept for the record.
4. **Current: face up, 1.7 mm, with a keychain** (2026-10-05, after the first trial print): see the [2026-10-05 entry](#2026-10-05-thinner-card-with-sharper-lettering-911-line-removed-keychain) and [cards-and-printing.md](cards-and-printing.md) for the current spec.

**Wallet card spec, version 3** (superseded; the current spec is in [cards-and-printing.md](cards-and-printing.md) and [technical.md section 6](technical.md#6-the-card-maker)):

| Item | Value |
|---|---|
| Size | 85.6 × 53.98 × **2.2 mm**, corner radius 3.18 (credit-card outline) |
| Orientation | **Front (logo) face down** on the plate |
| Layers (0.2 mm each) | front skin 0–0.6 (black with white art, mirrored so it reads correctly) · white core 0.6–1.6 with the pocket · **pause at Z 1.6** (before layer 9, shown as 1.8 in Bambu Studio) · one white roof layer 1.6–1.8 · back skin 1.8–2.2 (white with black QR and text) |
| Pocket | 26 mm round, 1.0 mm deep, centred at (67, 39) seen from the front: 0.5 mm clearance around a 25 mm tag for ASA/ABS shrinkage and hand placement; one free layer above the 0.8 mm tag so the nozzle never touches it |
| Covers | 0.6 mm below and above the tag (equal, so the card shrinks evenly and stays flat) |
| Core colour | white (black skins hide it completely; a black core would grey the white areas and the QR) |
| Text | smallest capitals 3.5 mm (3.7 for comma and #, 3.9 for Å and cedillas); strokes and gaps ≥ 0.5 mm; letters ≥ 0.6 mm apart; accents lifted 0.6 mm clear; accented names normalised; overlapping glyph parts merged |
| QR | 40 mm area at the back's top right, at least 0.8 mm squares, 4-square quiet zone; live card links give 37 squares of 0.889 mm |
| Logo | official signature, one colour, 40 mm wide; thinnest bars about 0.22 mm (check them in the sliced preview) |

**The Bambu Studio project (`bambu3mf.js` + `bambu-template.json`):**
- **What it builds:** one object with two parts, white on filament 1 (`#FFFFFF`) and black on filament 2 (`#000000`), for a **P2S 0.4 nozzle** with **Bambu ASA** (or ABS) in both slots.
- **Process:** "0.20mm Standard @BBL P2S" with these changes:
  - 100% zig-zag infill, 3 walls, Arachne walls (for the thin logo bars)
  - supports off, prime tower on, no brim (use Mouse ear if corners lift)
  - Textured PEI plate
  - **ironing off**, because ironing the QR side can drag black onto white squares
- **Pause:** written the same way Bambu Studio's right-click **Add Pause** saves it, so it appears on the layer slider.
- **Template:** built from Bambu Studio's own system presets. Only the 3D shapes and the pause are filled in per card.
- **Checked with the Bambu Studio command-line tool (version 02.08.02.61):**
  - the file loads as a project, keeps per-part filaments, and slices
  - G-code: both filaments used, pause at the right layer, 100% infill
  - about 42 minutes and 9 g per card
- **Commands to re-check a file:**
  ```
  B=/Applications/BambuStudio.app/Contents/MacOS/BambuStudio
  $B --info card.3mf
  $B --slice 1 --outputdir out card.3mf
  grep -n "; Z_HEIGHT\|; PAUSE_PRINTING\|M400 U1\|^T[01]$" out/plate_1.gcode
  ```
- **When Bambu updates its presets, or for a different printer:** the template must be rebuilt from the installed presets and a project saved by Bambu Studio, used as a format reference. Opening the file with another printer selected makes Bambu Studio switch presets; the parts, their filaments and the pause carry over.

---

### 2026-10-05: PVC coin tag, 90 °C bed, colour-neutral files, all-cards download

- **Tag:** the owner's tags are NTAG215 **PVC coin tags, 25.4 mm (1 in) × 0.8 mm** (not 25 mm stickers). Pocket **26.4 × 1.0 mm** (tag + 1 mm across, as tag sellers advise for embedding: a 26 × 1 mm slot for 25 mm tags; printed holes come out 0.1–0.4 mm small). The tag centre moved from y 39 to **38 mm** so 2.8 mm of card stays above the pocket; EMERGENCY CONTACT shrank by about 0.1 mm.
- **Bed capped at 90 °C** in the .3mf for ASA and ABS. PVC softens at about 80 °C; tags made for embedding are rated for beds up to 90 °C; Bambu's own P2S presets use 90 °C for ABS and Generic ASA (only Bambu ASA says 100 °C). The NTAG215 chip is rated to 125 °C unpowered. The changed filament keys are listed in `different_settings_to_system` (entries 1 and 2) so Bambu Studio keeps them.
- **Colours chosen later:** two colours only, one dark and one light. Files and parts are now named DARK / LIGHT (were BLACK / WHITE); the code still calls them `black` / `white`.
- **Pause checked in real G-code:** Bambu Studio 2.8 CLI slices; `M400 U1` sits between layer 8 (Z 1.6) and layer 9; Bambu firmware parks the head over the waste chute on `M400 U1` (same as a pause from the screen); after resume the prime tower prints first, then the roof bridges the tag in the light filament.
- **Owner tab → Print files for all cards:** one ZIP with a folder per card (.3mf, both STLs, print notes), `NFC-links.csv` and a README; unprintable names are left out and listed; unpublished cards need a confirm.
- **Any enclosed Bambu printer (same day):** the owner may print on another Bambu, maybe a two-nozzle one. A **Printer** choice (X1 Carbon, X1E, P1S, P2S, H2S, H2D, H2D Pro, H2C, X2D) picks one of nine settings files that Bambu Studio's own command line makes from its presets (`tools/build_templates.py`). On the H2D, H2D Pro and X2D the light colour is fixed to the left nozzle and the dark to the right: Bambu Studio's default grouping put both on one nozzle in its command-line slicer, which purges every layer (about 3 g and 8 minutes more per card) and risks a dark tint in the white lettering. The H2C keeps automatic grouping (a fixed one fails without the printer's nozzle list). All nine were sliced and their G-code checked.
- **Lettering refined (same day):** the font's kerning (read from GPOS ourselves), tracking for capitals, ink-edge alignment, the name on a bottom margin matching the logo's top margin, a clearer step between headline and name; on the back a left column aligned to the QR code, the tap symbol on that column, BACKUP as a small label over a 4 mm number, and the 911 line in a dark band.

### 2026-10-05: dashboard for a computer, and fixes found on review

- **Layout:** from 820 px wide, the sections are listed on the left and the open section fills the middle; from 1400 px, the status panel (with Publish) stays in view on the right and the bottom bar goes. Narrower windows keep the phone layout. All new styles are under `.dash`, so the family page is pixel-identical (checked by screenshot comparison).
- **Shifts first:** the dashboard opens on Shifts, listed first. **Who works each shift** is a table (person × shift) replacing the tick lists inside each shift box; shift boxes sit two across, with a 7-day toggle row and **←/→** to change the order (the order decides the primary call, and there was no way to change it before).
- **People, Cards, History** as tables; Cards has a search box, adds on Enter and renames in the row (no more browser prompts). Owner tab in boxes.
- **Fixes found on review:**
  - dates were UTC dates, a day ahead every evening in Houston (card "added", number checks, token and recovery dates, the all-cards ZIP name), now Houston dates;
  - phone numbers showed as `+15555550101`; now `555-555-0101`;
  - unticking and re-ticking someone, or emptying a Spanish shift name, showed a phantom "Changed shifts";
  - signing in while GitHub's API was busy (the dashboard falls back to the site's copy) made the next publish fail with a misleading "someone else published"; it now fetches GitHub's file id first;
  - a text message without `{driver}` could be published, so the yard wouldn't know which driver a text was about; publishing now stops;
  - a 24-hour shift (start = end) ran midnight to midnight instead of from its start time;
  - an emptied time box looked empty but kept the old time; it now shows the saved time again;
  - the supervisor guide described the old five-word suggested passwords.
- **Idle lock:** 30 minutes without input locks the dashboard, unless changes are waiting or a publish or all-cards download is running.

### 2026-10-05: time off, tab names, longer passwords

- **Problem:** nothing marked a supervisor or the manager as away, so someone on holiday stayed the primary call for their shift and in the group text.
- **Design:** `schedule.away` entries `{ id, who, from, to, cover }`, whole Houston days, both days included. `arrange` (shared by the card page and the dashboard) leaves the person off their shifts and puts the cover on them; a night shift counts from the day it starts. People away today aren't shown and aren't texted. If time off would leave nobody, it's ignored. The fallback person on time off passes to the first available person.
- **Dashboard:** Shifts → Time off (table), *Away through* / *Covering for* tags in Who works each shift, Away in the status panel, Check a time by date, checks before publishing (complete, in order, under a year, cover not away too, never everyone away). Ended entries are dropped when the dashboard opens (not counted as a change) and on publish.
- **Tab names:** People → **Supervisors**, Cards → **People** (owner's wording); buttons and messages follow (Add supervisor, Open Supervisors).
- **Passwords:** suggested and temporary passwords are five words from a 601-word HSE list (`HSE_WORDS` in `words.js`), two digits and a symbol, about 56 bits (was two words, about 36 bits). The list was pruned after review for reading out by phone: no soundalikes, plurals, spelling variants, often-misspelled words or near-duplicates. People can still choose their own shorter password; the minimum went from 8 to 10 characters (still with a number and a symbol).
- **Older cached files:** time off lives inside `schedule`, which every dashboard version copies as a whole, so an older dashboard publishing in the 10-minute window keeps it. An older `schedule.js` ignores it (the dashboard then hides the section); an older `app.js` with the new `schedule.js` already leaves away people out of the list.

### 2026-10-05: thinner card with sharper lettering, 911 line removed, keychain

- **The first trial print** (owner's photo, beside an older blue card made from a MakerWorld two-part template with a thin sticker tag, printed on a P2S with a 0.4 mm nozzle): the green card was printed on an **H2S with a 0.6 mm nozzle**. Its letters were grainy and soft, and the tag showed through as a pale disc. Causes: the 0.6 mm nozzle (too wide for 3.5 mm letters; the files are made for 0.4 mm); the lettering was the face printed on the textured plate (first-layer squash, the plate's grain); the filaments were swapped (light front, dark core), so the white tag showed through the light face and the back's light lettering looked grey; and Bold capitals were heavy at these sizes.
- **Front face up:** the logo side is now the top surface, where the slicer traces every letter with its own walls, as on the blue card. The back (QR side) goes on the plate, mirrored.
- **0.1 mm layers** (first layer 0.2 mm) and the wall speeds of Bambu's own "High Quality" presets in the .3mf: outer walls 60 mm/s at 2000 mm/s², inner walls and top surface 150 mm/s, first layer 30 mm/s (`DETAIL` in `bambu3mf.js`).
- **Source Sans 3 Semibold** instead of Bold: about 20% thinner strokes, wider openings; still at least 0.35 mm at 3.5 mm capitals.
- **Thinner: 1.7 mm** (was 2.2): back 0.3 · core 1.0 with the pocket · roof 0.1 · front 0.3. Same 1-inch PVC coin tag (the owner prefers it to the thinner black sticker in the blue card). Pause after Z 1.3 mm, before layer 13 of 16.
- **911 line and band removed** from the back (owner's request). The back is now dark with the QR on a light square at the right, centred; the tap symbol with SCAN / OR TAP beside it over the tag, BACKUP and the number at the bottom.
- **Colours:** both faces dark with light lettering (owner's choice, like the blue card). The print notes and the guide say how to spot swapped filaments in Bambu Studio's preview before printing.
- **Materials: ABS or PETG** (owner: "we're doing ABS only", plus a PETG option); ASA removed. The nine printer settings files were rebuilt by Bambu Studio's command line with Bambu ABS as the base (identical to the earlier ABS settings, key for key) and Bambu PETG HF as a patch (bed 70 °C, no chamber heating).
- **Keychain:** a 41 mm coin with a ring tab (owner's pick of three researched shapes: popular MakerWorld/Printables NFC tags and commercial fobs), 3.0 mm thick, 5 mm hole, edges rounded layer by layer (0.6 mm chamfer at the plate, 1.2 mm round on top), the same tag and link as the card. Front: the logo (31 mm, the brand minimum, which is why it can't be smaller than about 40 mm) with EMERGENCY and CONTACT on arcs; back: the tap symbol and the driver's initials (from the name, changeable in Print & QR for the session). An earlier 50 × 32 rounded rectangle was dropped. Its pocket top is at the same 1.3 mm as the card's, so **Card + keychain, one plate (3MF)** prints both side by side with one pause. The Owner tab's all-cards ZIP has the card, keychain and one-plate projects for every card.
- **Whole piece one colour:** a 1.2 mm dark rim round the light core, from the plate to the top, so the edges match the faces (owner: "whole card can be blue or green and text white"). Costs a filament swap per layer on one-nozzle printers (card about 1 h 20 min instead of 1 h); the H2D's two nozzles don't mind.
- **Fixes on review:** the browser could exceed its argument limit building a large .3mf (`push(...lines)`); a two-line name could put the top of EMERGENCY's G into the logo's clear space with Semibold's rounder letters (now fitted on the real ink); old cached scripts now ask for a reload instead of silently leaving out keychains or the detail speeds.
- **Checked:** watertight parts and exact volumes (including the stepped edges); layouts for awkward names; the card, keychain and one-plate files sliced for all nine printers in ABS and PETG with one pause before layer 13, the pocket open on layers 3–12 and sealed in the light filament; the top and first layers drawn from the G-code (every letter and all 7 logo bars traced; the QR read back from the drawn first layer); the dashboard's Print & QR and Owner downloads in a browser test.

## 6. Individual sign-ins: design notes

Details in [technical.md](technical.md) (data file format version 4) and [security.md](security.md). The key ideas:

- Every publish makes a new random **admin key** for the admin data, and wraps it separately for each way in:
  - each person: their own key pair, with the private half locked by their password
  - the shared password (while it's on), which also works as a key pair
  - the owner's recovery code
- **People are listed** under a one-way fingerprint of their email, so the public file shows no emails.
- **Every password change or reset makes a new key pair.** Old file versions stay public in git history, so an old password never opens anything published later.
- **Removing someone** means they can't open anything published afterwards. They may still remember the GitHub token, so replace it after removing anyone.
- **Format versions:** files in the older format (version 3) open as "shared password on, no people", and the first publish writes version 4. Live data has been version 4 since the owner's first publish after `558fdf0`.

**Migration on the live site (as of 2026-10-02 evening):** owner access is set up, 6 people have their own sign-ins, and the shared password is **off**. Remaining: if the GitHub token was ever available to someone through the shared password, **replace the token** and delete the old one on GitHub.

---

## 7. How changes are made and released

### The test copy
- **Where:** `~/SUCH-Emergency-Contacts-staging` on the owner's Mac. It's a separate local git repository and is never pushed anywhere.
- **Fake data:** made-up people with fictional 555-01xx numbers, one demo card, and test-only passwords kept with the test tools.
- **Labelled:** every page of the copy shows a **Test site** label if it's ever served from a repository whose name ends in `-staging`.
- **Data files are never copied** between the copy and the live repository in either direction. A card removed on the live site would still open the copy.

### Release steps
1. Build and test the change in the test copy.
2. Show the owner (screenshots or a description) and get approval.
3. Make a **release folder**: a fresh clone of the live repository.
   - Copy in only the finished code and docs.
   - Exclude `contacts.enc.json` and `.git`.
   - Never include half-finished work.
4. Check the diff against the live site: only the expected files, no test addresses (`127.0.0.1`), no test data.
5. Run every test suite against the release folder ([section 9](#9-how-everything-was-tested)).
6. Pull first (someone may have published data), then commit and push to `main`.
   - The commit message has no people's names and ends with the co-author line.
   - Never force-push.
7. **Verify on the live site:**
   - live files equal the release
   - the printed demo card's link opens on iPhone and Android user agents
   - the dashboard sign-in loads without script errors
8. If anything is broken, `git revert` the commit and push straight away.
9. Copy the released code back into the test copy and commit it there, so both match.

### Working with parallel agents (how the 2026-10-02 work was organised)
- Several AI agents worked at once, each **owning specific files**, so they never edited the same part of a file. Shared files got small targeted edits only.
- Each agent used **its own test folder and network ports**, so test servers didn't collide.
- A **release agent** shipped only finished work, building it in a separate folder; the lead verified every change before and after release.
- Long parallel runs can hit usage limits mid-task. Agents were resumed with their context; nothing half-finished ever reached the live site, thanks to the test copy.

---

## 8. Staying safe during deploys (mixed cached files)

GitHub Pages caches each file for up to **10 minutes**. Right after a deploy, a phone or browser can get the **new** version of one file with the **old** version of another. Rules followed everywhere:

- **New code treats new page elements as optional:**
  - `if ($('x')) …` instead of assuming the element exists
  - `typeof X !== 'undefined'` for new names from other scripts, e.g. `YARD_ADDRESS`, `TEST_SITE`, `Bambu3MF`
- **Removed elements leave hidden placeholders** with class `retired`, because older cached scripts still look them up:
  - `index.html`: `#hint`, `#text-retry`, `#add-home`
  - `dashboard.html`: `#lost-supervisor`, `#tag-thickness`, `#dl-all`, `#dl-black`, `#dl-white`, `#dl-notes`, `#dl-paper`, `#dl-label`, `#dl-qr-png`, `#dl-qr-svg`
- **Data formats only grow:**
  - New fields are optional on read.
  - When an old dashboard could write a misleading value, the field gets a new name. Dashboards from a few hours earlier wrote `address: ""` automatically, so the yard address is stored as `yardAddress`; an empty legacy `address` is ignored.
- **`cardmaker.js` reads both `logo.js` formats** (old flat arrays and new coloured shapes); see [section 10](#10-incidents-and-lessons).
- **After the deploy that introduced sign-ins (format version 4):** an older cached dashboard can't sign in for up to 10 minutes. That's harmless; reload. A new dashboard with an older cached `crypto.js` says it was just updated and asks for a reload.
- **The emergency page reads only the `data` and `cards` parts of the file**, which never changed format. So cards keep working through every dashboard change.
- **The computer layout (2026-10-05) kept every element ID** an older `dashboard.js` uses. The new `#shift-matrix` and `#card-search` are optional in the new script; without `#shift-matrix` (an older cached `dashboard.html`) each shift box gets its own tick list back. All new styles are under `.dash`, so `index.html` can't be affected by the shared `style.css`.

---

## 9. How everything was tested

The automated tests ran on the owner's Mac. They lived in a temporary working folder, **not in this repository**; ask for them to be added under `tests/` if needed again. What they did, so they can be rebuilt:

- **Harness:**
  - A small Python web server served a copy of the site **and** pretended to be GitHub: the Contents API (GET/PUT with sha checks and token checks) and Pages, with a simulated deploy delay.
  - Headless Chrome was driven over the DevTools protocol (Python `websocket-client`).
  - Independent Python code (`cryptography` library) re-implemented the encryption to open every published file: PBKDF2, AES-GCM, ECDH P-256 for formats 3 and 4.
- **Suites and what they covered:**
  - **Emergency page:**
    - call order (checked against a separate Python implementation)
    - iPhone/Android text links
    - English/Spanish
    - WhatsApp link, yard address and Directions links
    - the vCard text, checked exactly against a Python builder
    - offline copy
    - error states
    - remembered card
    - manifest and install checks
    - deploy mixes with older `index.html`/`app.js`/`style.css` in both directions
  - **Dashboard:**
    - sign-in flows: shared, personal, owner, recovery code, reclaim, setup, upgrade
    - publishing, Discard, conflicts, History
    - 90-day checks, shift gaps, yard address and WhatsApp settings
    - owner add/reset/remove, the forced password change, turning off the shared password
    - the password rule and suggestion format
    - deploy mixes
    - **security:** no readable emails, names, numbers or tokens in any published version
  - **3D card**, 8 test cards including long, accented, combined-accent, punctuation and cedilla names:
    - both STL parts watertight
    - layers tile exactly
    - volume correct
    - pocket size, position and sealing
    - `pauseZ`
    - front not mirrored
    - QR decodes from the top face (zxing-cpp)
    - capital heights, stroke and gap widths measured on renders
    - logo size and clear space
  - **Print & QR tab:** every button, both filaments, problem states, behaviour without `bambu3mf.js`, no script errors.
  - **Dashboard for a computer (2026-10-05):**
    - opens on Shifts; three columns at 1440 px, two at 1000–1200 px, tables from 1100 px
    - the who-works-each-shift table, shift order, day buttons, emptied time boxes
    - no phantom changes (re-ticking, emptied Spanish name, retyped phone)
    - phone display, People/Cards/History tables, card search, Enter to add, in-row rename and its focus
    - `{driver}` check, publishing after a sign-in that used the site's copy (and refusing when GitHub has a newer file), notes cleared after publishing
    - Houston dates on a computer set to Tokyo time, including the all-cards ZIP and its README
    - idle lock: locks when idle, not with unpublished changes, not on a setup screen, ignores pointer events without movement
    - 24-hour shifts in `schedule.js`
    - deploy mixes: old `dashboard.html`, old `dashboard.js`, old `style.css`
    - the family page pixel-identical with the new `style.css` at 390 and 1440 px
  - **3MF:** checked in the Bambu Studio command-line tool ([section 5](#5-the-3d-card-design-history-and-final-spec)).
- **Results at the last release:**

  | Suite | Result |
  |---|---|
  | 3D card | 272/0 |
  | Sign-ins | 77/0 |
  | Family page and dashboard | 63/0 |
  | Print & QR | 25/0 |
  | Test data | 6/0 |
  | Dashboard for a computer (2026-10-05) | 89/0 |
  | Time off (2026-10-05) | 49/0 |
  | HSE passwords and tab names (2026-10-05) | 12/0 |
- **Practical notes for this Mac:**
  - Headless Chrome needs the command sandbox off.
  - `--dump-dom` hangs, so use the DevTools protocol.
  - Python's test web server needs `request_queue_size = 128`, or the dashboard's 11 parallel script loads get connection resets.
  - Give each parallel test run its own ports.
  - Turn on `Emulation.setFocusEmulationEnabled`, or headless Chrome never fires `blur` events.
- **Not yet verified on real devices:**
  - group-text formats on iPhone and Samsung
  - NFC reading through the printed card
  - Save to Contacts on iPhone and Android (Android may show the labels as just "Mobile"; the contact's note lists who's who)
  - WhatsApp
  - `mailto:` opening a mail app
  - a physical print of the final card: pocket fit, flatness, thin logo bars

---

## 10. Incidents and lessons

- **"Error on the 3D print option" (after `fa30a33`):**
  - **Cause:** a browser had the new `cardmaker.js` with the old cached `logo.js`, whose format had changed. The result was "Cannot read properties of undefined".
  - **Fix:** `cardmaker.js` now accepts both formats.
  - **Lesson:** a deploy that changes the shape of data shared between two files must keep the reader compatible with the old shape.
- **Empty yard address risk (before `36c5cf2`):**
  - Dashboards deployed earlier wrote `address: ""` on every publish.
  - Making the built-in address the default would have been undone by anyone with an old dashboard open.
  - **Fix:** a new field name, `yardAddress`.
- **Wrong logo proportions:** found during the brand review and replaced with the official artwork ([section 4](#4-the-tenaris-brand-work)).
- **Test server connection resets:** a test harness issue, not a site issue; fixed with a larger listen queue.
- **A risky file deletion was stopped:** a cleanup command with a wildcard ran in the wrong folder and was blocked by a safety check before deleting anything. **Lesson:** use fresh temporary folders, never wildcards after a `cd`.

---

## 11. Open items and ideas

- **Daily self-test with email alerts** (postponed by the owner):
  - A scheduled GitHub Action would open a test card every day and fail loudly if the page breaks.
  - GitHub's failure emails go to the email address on the TenarisMcCarty account, so confirm that's salil@tenaris.com first.
  - No AI is involved; it's a plain scripted check.
- **Bulk card creation from a spreadsheet** ("later"): import ~50 drivers at once, then generate their files.
- **Finish the sign-in migration:** the shared password is already off; replace the GitHub token and delete the old one on GitHub, if not done yet.
- **Second trial print** (face-up, 1.7 mm card and keychain): run the [trial checklist](cards-and-printing.md#trial-checklist), check filament 1 is the light one, check the 7 logo bars (40 mm on the card, 31 mm on the keychain) in the sliced preview, try Mouse-ear brim if corners lift.
- **Real-phone checks** listed in [section 9](#9-how-everything-was-tested).
- **Possible refinements:** remember the ASA/ABS choice between visits; optionally commit the test suites under `tests/`.

---

## 12. Things that must never change

- **Card links:** site address + `#` + the 22-character card key. Printed cards and locked tags can't be updated. The printed demo card's link (`…/#9SZ0cYZrSxAE72l8PfoHOw`) must keep working; check it after every deploy.
- **The slot-id formula and the encryption of card entries,** so existing cards keep opening.
- **The `data` and `cards` parts of the data file** may only gain optional fields.
- **`contacts.enc.json`** is written only by the dashboard's Publish. Never edit it by hand or copy it between repositories.
- **Commit messages contain no people's names.**
