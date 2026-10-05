# Cards and printing

How a card works, how to write its NFC tag, and how to print the 3D card and its keychain from the dashboard's **Print & QR** tab.

**Contents**

1. [How a card works](#1-how-a-card-works)
2. [Making a new card: the whole process](#2-making-a-new-card-the-whole-process)
3. [Writing the NFC tag](#3-writing-the-nfc-tag)
4. [The card](#4-the-card)
   - [The keychain](#the-keychain)
5. [Printing it](#5-printing-it)
6. [The STL files (ZIP)](#6-the-stl-files-zip)
   - [All cards at once](#all-cards-at-once)
7. [When a card needs reprinting](#7-when-a-card-needs-reprinting)
8. [Trial checklist](#trial-checklist)

---

## 1. How a card works

Every card has its own **card link**:

```
https://tenarismccarty.github.io/SUCH-Emergency-Contacts/#<22-character card key>
```

The same link is written to the card's **NFC tag** and encoded in its **QR code**. A keychain made for the card gets the same link on its own tag. The card key unlocks the contacts and that card's driver name. The part after `#` never leaves the phone, so no server sees it.

- **The link never changes.** Edits to people, shifts, messages or the driver's name reach the card automatically, so the tag and QR never need redoing for those.
- **Removing a card** in the dashboard switches its link off for good.
- **Keep links working:** once a card is printed or handed out, its link must keep working. Don't remove a card that's still in use, and don't "start over" (see the [owner guide](owner-guide.md#11-starting-over-last-resort)) unless you're prepared to remake every card.

---

## 2. Making a new card: the whole process

1. **People → Add card:** enter the driver name and ID (e.g. `Jane Doe (1234)`) and who will hold it (e.g. "Family").
2. **Publish.** The card's link only works after publishing.
3. **Print & QR →** choose the card → check the previews → choose the **Printer** and the **Filament** (ABS or PETG) → **Card (3MF)**, or **Card + keychain, one plate (3MF)** for both.
4. **Write the NFC tag** (one per piece, all with the card link) and test it ([section 3](#3-writing-the-nfc-tag)). Don't lock it yet.
5. **Print** ([section 5](#5-printing-it)). At the pause, put the tag in (on a shared plate, one in each piece).
6. **Test** the finished pieces with an iPhone and an Android phone: tap each one and scan the card's QR. All should open the page with the right driver name.
7. **Lock the tags** (only now, after they work through the plastic), then hand them over.

Before printing your first cards, set the **Backup line** in Print & QR and publish. It's printed on the cards, and the page tells families to call it if the page ever can't load.

---

## 3. Writing the NFC tag

Use the free **NFC Tools** app (iPhone or Android) and an **NTAG215 PVC coin tag, 25.4 mm (1 in) across and 0.8 mm thick**. It's the only tag the card is made for. Measure one tag from each new batch: it must be at most 25.8 mm across and 0.9 mm thick (the pocket is 1.0 mm deep, and the nozzle needs room above the tag). The link is about 80 characters, well within the tag's capacity.

1. In the dashboard, **Print & QR →** choose the card → **Copy link**. The print notes also contain the link.
2. In NFC Tools: **Write → Add a record → URL / URI** → paste the link → **OK**.
3. Tap **Write**, then hold the tag to the back of the phone until it confirms.
4. Test it: with NFC Tools closed, tap the tag with an unlocked phone. The page should open with the right driver name.
5. **Lock it only after testing the finished card:** NFC Tools → **Other → Lock tag**. It works through the card. Locking is **permanent**; it stops anyone rewriting the tag, including you.

Notes:

- iPhones read NFC tags in the background from the iPhone XS onward; the screen must be on. On Android, NFC must be switched on in Settings.
- Write and test the tag **before** it goes into the card, and test it again after printing.
- Metal (and some phone cases or wallets with RFID blocking) stops NFC from working.

---

## 4. The card

### What it looks like

The card has two colours: one **dark** and one **light** filament. Below they're called black and white; any dark + light pair works (for example dark Tenaris blue + white), as long as the light one is white or nearly white so the QR code keeps strong contrast. Both faces are dark with light lettering.

**Front** (printed on top, so every letter is traced by its own walls):

- dark, with the light Tenaris logo at the top left; the edges are dark too, so the whole card is one colour with light lettering
- **EMERGENCY CONTACT** in big light capitals on two lines: the main text
- the driver's name in smaller capitals along the bottom, e.g. JANE DOE (1234); a long name wraps onto two lines
- the upper right is plain: the NFC tag sits inside the card there
- one left edge: the logo, the headline and the name start at exactly the same line, and the name sits as far from the bottom edge as the logo does from the top

**Back** (printed face down on the plate):

- dark, with the QR code on a light square at the right, centred top to bottom
- a left column level with the QR code's top and bottom rows: the contactless symbol (over the hidden tag) with **SCAN / OR TAP** beside it at the top, and at the bottom a small spaced-out **BACKUP** label over the backup number, if one is set

The Print & QR tab shows both faces before you download, each as seen from its own side.

### Specifications

| | |
|---|---|
| Size | 85.6 × 53.98 × **1.7 mm**, the outline of a credit card with 3.18 mm rounded corners |
| Printer | An enclosed Bambu Lab printer with AMS and a **0.4 mm nozzle** (not 0.6: it can't draw 3.5 mm letters; the first trial card was blurred by one): X1 Carbon, X1E, P1S, P2S, H2S, H2D, H2D Pro, H2C or X2D (ABS needs the enclosure, so not the open A1, A1 mini, A2L or P1P) |
| Material | **ABS** (Bambu ABS preset) or **PETG** (Bambu PETG HF preset), one dark and one light filament, the same type for both; **0.1 mm layers** (first layer 0.2 mm), textured PEI plate, bed **90 °C** for ABS, 70 °C for PETG |
| Speeds | outer walls 60 mm/s at 2000 mm/s², inner walls and top surface 150 mm/s, first layer 30 mm/s: the values of Bambu's own "High Quality" presets, for sharp letters |
| Layers, from the build plate up | **back** 0–0.3 mm (2 layers, QR artwork, face down) · **core** 0.3–1.3 mm (10 layers, light colour, with the NFC pocket) · **pause** · **roof** 1.3–1.4 mm (1 solid light layer) · **front** 1.4–1.7 mm (3 layers, front artwork, on top). Round the light core, a **1.2 mm dark rim** from the plate to the top. |
| NFC tag | NTAG215 PVC coin, 25.4 mm (1 in) × 0.8 mm |
| NFC pocket | 26.4 mm round, 1.0 mm deep, centred 67 mm from the left and 38 mm from the bottom of the front (18.6 mm from the left on the back); 2.8 mm of solid card between the pocket and the top edge |
| Pause | after the layer that ends at **Z = 1.3 mm**, before layer 13 of 16 (shown as 1.4 mm in Bambu Studio's layer slider) |
| Covers over the tag | 0.3 mm below (the back) and 0.4 mm above (roof + front) |
| QR code | 40 × 40 mm including its light margin of 4 squares, 5 mm from the right edge and centred top to bottom; error-correction level M (still reads with about 15% damage). Card links give 37 × 37 squares, about 0.89 mm each (the generator never goes below 0.8 mm). |
| Lettering | Source Sans 3 Semibold (a free typeface in the style of Frutiger, the Tenaris typeface), set with the font's own kerning, capitals spaced slightly apart (labels a little more), and lines aligned on their visible left edge. EMERGENCY CONTACT about 5.5–5.9 mm capitals; the name 4 mm on one line, 3.5–3.8 mm on two; SCAN / OR TAP 4.5 mm; the backup number about 3.6 mm; BACKUP 3.5 mm. **Nothing smaller than 3.5 mm.** |
| Smallest details | Semibold stems are 0.18 × the capital height and its thinnest tapered ends about 0.1 ×, so at 3.5 mm every stroke is at least 0.35 mm (Bambu's narrowest line for a 0.4 mm nozzle is 0.34 mm), and its gaps and letter openings are wider than Bold's. Letters are spaced at least 0.6 mm apart, and accents are lifted 0.6 mm clear of their letter. The tap symbol's lines and gaps are 0.8 mm. |
| Logo | The official Tenaris signature, one colour (light on the dark front), 40 mm wide, never stretched: Multibar 7.2 mm tall (brand minimum 5.5 mm), with clear space of 80% of the Multibar height (5.7 mm) all round, kept free of text. Its thinnest bars are about 0.22 mm wide (official artwork, so they're kept as they are); check them in the sliced preview. |

### Why it's built this way

- **Front face up.** The lettering and the logo are the top surface, where the slicer traces every letter with its own walls, at 60 mm/s and on 0.1 mm layers. A face printed on the plate takes the plate's texture and the first layer's squash, which blurred the letters of earlier cards. The back goes on the plate instead: its QR squares are big enough not to mind, and it's printed mirror-image so it reads correctly when you turn the card over.
- **Semibold lettering.** Lighter than the earlier Bold: thinner strokes and wider openings inside and between letters, so letters stay open and crisp at these sizes.
- **One tag size.** The pocket fits an NTAG215 PVC coin tag, 25.4 mm × 0.8 mm. 26.4 mm across is the tag + 1 mm, the same allowance tag sellers give for embedding 25 mm tags (a 26 × 1 mm slot). Printed holes come out 0.1–0.4 mm small and coin tags vary by about ±0.2 mm, so the tag still drops in by hand at the pause; after cooling (ABS shrinks about 0.8%, PETG about 0.3%) the pocket still doesn't squeeze it. 1.0 mm deep is the tag plus 0.2 mm, so the nozzle never touches the tag. Bambu Studio slices the pocket at exactly 26.4 mm (checked in its G-code).
- **Bed at most 90 °C.** From the pause on, the PVC tag sits in a card on the hot bed. PVC softens at about 80 °C, and PVC tags made for embedding are rated for beds up to 90 °C, so the project caps the bed at 90 °C (Bambu's ABS presets use 90 °C on the textured plate; PETG HF uses 70 °C). The NTAG215 chip itself is rated to 125 °C unpowered (NXP datasheet).
- **Light core, dark rim.** The core is light, like the white PVC tag. A dark face shows nothing of a white tag in a white core, and light lettering over a light core stays bright. Round it, a 1.2 mm dark rim keeps the edges dark, so the card reads as one colour; every light letter, the logo and the QR square sit over the light core, never over the rim. Over a dark core, the tag shows through as a pale disc and light lettering looks grey (as on a trial card printed with the filaments swapped), so **filament 1 must be the light one** (the print notes say how to check in Bambu Studio's preview).
- **Roof.** The first layer after the pause is light over the tag (one colour while it spans the pocket), with the dark rim round it. The printer prints the rim, then the prime tower, then the light bridge over the tag. Above it, 0.3 mm of front artwork.
- **1.7 mm thick** (2.2 mm before). That's the 0.8 mm tag with its 0.2 mm clearance and the thinnest covers that keep each face opaque: 0.3 mm on the plate side, 0.4 mm on top. Still stiff in solid (100% infill) ABS or PETG.
- **Big, few words.** Small text doesn't print well. If a name can't fit at its minimum size, even on two lines, the dashboard refuses it and asks you to shorten it (**People → Rename**). A few characters have finer details and need bigger letters: Å and cedillas (Ç, Ş) 3.9 mm, the comma and # 3.7 mm. Curly quotes print as straight ones.

### The keychain

A round key tag with the same NFC tag and the same link as the card, made from the same card in **Print & QR**. Its shape follows popular NFC key tags (MakerWorld and Printables designs, commercial key fobs): a coin with a ring tab, edges rounded so it doesn't dig into a hand or a pocket.

- **Front** (on top): the Tenaris logo across the middle, **EMERGENCY** round the top and **CONTACT** round the bottom, light on the dark coin.
- **Back** (on the plate): the contactless symbol over the owner's **initials**. The initials come from the driver name (first letters of the first and last words, leaving out the ID in brackets: Jane Doe (1234) → JD). To change them, type 1–3 letters in **Keychain initials**; the change is kept for this session only, and the Owner tab's all-cards download uses it too while the page stays open.

| | |
|---|---|
| Size | **41 mm coin** with a ring tab at the top: 41 × 49 × **3.0 mm** |
| Ring tab | 11 mm across, joined to the coin with 3 mm curves; **5 mm key-ring hole** (fits a 25 mm split ring) with 3 mm of plastic all round |
| Edges | 0.6 mm 45° chamfer on the plate side, 1.2 mm round on top (each layer's outline steps in) |
| Layers | **back** 0–0.3 mm (face down) · **core** 0.3–1.3 mm (with the NFC pocket) · **pause** · **light** 1.3–2.7 mm · **front** 2.7–3.0 mm (on top). 29 layers. A 1.2 mm dark rim runs round the light core all the way up, as on the card. |
| Pause | the same as the card's: after Z = 1.3 mm, before layer 13 (1.4 mm in the layer slider) |
| NFC pocket | 26.4 mm round, 1.0 mm deep, at the coin's centre (7.3 mm of plastic round it) |
| Logo | 31 mm wide, the narrowest the brand allows (Multibar 5.5 mm), with 4.4 mm clear space; this sets the coin's size (about 40 mm is the smallest round shape that fits it) |
| Lettering | EMERGENCY and CONTACT 3.5 mm capitals on arcs, at least 0.6 mm between letters after bending, 2 mm or more inside the rounded edge; initials up to 8 mm; the tap symbol 13 mm tall |

Why 3 mm: a key tag gets bent and pulled on its ring, so it's built like a car key fob: stiff, and strong round the hole. The extra thickness is light plastic above the tag, so the pause height matches the card's.

**Card + keychain, one plate (3MF)** puts both on one plate, side by side: one print and **one pause** for both tags (about 1 h 25 min on an H2D in ABS, 1 h 15 min in PETG; about 2 h on a one-nozzle printer).

## 5. Printing it

### With the Bambu Studio project (recommended)

1. **Print & QR →** choose the card → **Printer** (the Bambu Lab model you'll print on; remembered on this computer) → **Filament:** ABS or PETG → **Card (3MF)**, **Keychain (3MF)** or **Card + keychain, one plate (3MF)**. The file name ends with the printer, e.g. `card-Jane-Doe-1234-Family-H2D.3mf`, `keychain-Jane-Doe-1234-Family-H2D.3mf`, `card-Jane-Doe-1234-Family-with-keychain-H2D.3mf`.
2. Open the file in Bambu Studio. It's set for that printer with a 0.4 mm nozzle, from Bambu's own presets for it: a LIGHT part (filament 1, shown white) and a DARK part (filament 2, shown black) for each piece, 0.1 mm layers (first layer 0.2 mm), the detail speeds above, 100% infill, Arachne walls, prime tower on, no supports, no brim, textured PEI plate, bed 90 °C, and the pause for the tag.
3. Put a dark and a light filament of that type in the AMS and match **filament 1 to the light slot** and **filament 2 to the dark slot**. Check the preview: a **dark top with light lettering**. A light top with dark lettering means they're swapped.
   - **Two-nozzle H2D, H2D Pro and X2D:** the light filament prints from the **left** nozzle and the dark one from the **right** nozzle, so the colours never share a nozzle: no purging between colours and no dark tint in the light lettering. Load each filament where its nozzle can use it (that side's AMS or spool). To swap sides, change **Filament grouping** in Bambu Studio before slicing.
   - **H2C:** Bambu Studio's own filament grouping chooses the nozzles (its nozzle changer needs the printer's nozzle list, so the file doesn't fix them).
4. **Slice**, then check the preview: every QR square, every letter, all 7 bars of the Tenaris logo, an empty pocket, and the pause at layer 13.
5. **Print** ([at the pause](#at-the-pause)). On an H2D: about 1 hour for a card and 50 minutes for a keychain in ABS (50 and 40 minutes in PETG). One-nozzle printers swap filament on every layer (the dark rim), so they take longer: about 1 h 20 min for a card, 1 h 30 min for a keychain.

### With the STL files

1. **Print & QR → STL files and print notes (ZIP).** It holds the card's and the keychain's parts.
2. **Import a piece's two STL files at once.** When asked whether to load them as a single object with multiple parts, choose **Yes**. Keep their positions; they're already aligned.
3. Give the **DARK part the dark filament** and the **LIGHT part the light filament**, both the same type (ABS or PETG).
4. **Orientation:** as the files come, front (logo side) face **up**. Don't flip, rotate or mirror anything.
5. **Settings** (starting from the Bambu ABS or Bambu PETG HF profile for your printer and its 0.20 mm Standard process): layer height **0.1 mm**, first layer 0.2 mm; outer walls 60 mm/s at 2000 mm/s², inner walls and top surface 150 mm/s, first layer 30 mm/s; sparse infill 100%; supports off; ironing off; prime tower on; Arachne walls (the default); bed no hotter than 90 °C.
6. **Slice**, then drag the layer slider to **layer 13 (1.40 mm)**, right-click its handle → **Add Pause**. Layer 12 (1.30 mm) should be the last one with the pocket open.

### ABS and PETG

- **ABS:** keep the **enclosure door and top closed** for the whole print, except at the pause. Drafts make ABS warp and crack. Part cooling fan off or low; Bambu's ABS profiles already keep it low.
- **PETG:** no enclosure needed and no chamber heating; follow Bambu's advice for PETG on your printer (on the X1 and P1 series it suggests opening the top or the door so the nozzle doesn't overheat). PETG warps less than ABS and is a little more flexible.
- Both filaments of one print must be the same type (two ABS, or two PETG).
- **Brim:** none needed normally. If corners lift on a test card, add a 3–5 mm brim (or mouse ears) and trim it off afterwards.
- The back takes the plate's finish: a textured PEI plate gives a matte, slightly textured back; a smooth plate a glossy one. Clean the plate; no fingerprints.
- **Ironing off:** it drags one colour into the other.
- Let the card cool on the plate before taking it off.

### At the pause

The printer finishes layer 12 with the pocket open, moves the head away (Bambu printers park it over the waste chute when paused) and waits.

1. Wait until the head has stopped away from the card. Open the door.
2. Drop the **written and tested** tag into the pocket (on a shared plate, one in each) and press it flat. If it has an adhesive back, that side goes down. It must sit fully below the rim: nothing may stick up. Don't touch the nozzle, the edges or the prime tower.
3. Close the door and press **Resume** straight away: PVC softens at about 80 °C and the bed is hot (90 °C for ABS, 70 °C for PETG), so sealing the tag quickly keeps it flat.

The printer then prints the dark rim, the prime tower (purging the light nozzle after the wait) and seals the tag with light layers, the first printed as a bridge in one colour.

Then **test** the finished pieces: scan the card's QR and tap each piece with an iPhone and an Android phone. Only then lock the tags.

### How the files were checked

Without a physical print, the generated files were checked digitally for several names (short, long, accented, punctuation):

- both parts of each piece are watertight
- the dark and light parts fill the piece exactly, with no gaps or overlaps (their volumes add up to the piece's to within 0.01 mm³)
- the pocket is the right size and place, and fully enclosed: closed below by the back and above by the roof; the key-ring hole is open in every layer
- capital heights, letter strokes and gaps and the logo's clear space were checked on the layouts
- the card, the keychain and both on one plate were sliced with Bambu Studio 2.8 for every listed printer in ABS and in PETG and the G-code checked: one pause, after layer 12 (Z 1.3 mm) and before layer 13 (16 layers for the card, 29 for the keychain); the pocket is open at 26.4 mm on layers 3–12 and covered on every other layer; after the pause the dark rim, then the prime tower, then the roof bridging the pocket in the light filament only; the edges are dark on every layer and no light reaches past the light core; layer height 0.1 mm and the detail speeds; the bed is 90 °C (ABS) or 70 °C (PETG); on the H2D, H2D Pro and X2D each colour stays on its own nozzle
- the top and first layers were drawn from the G-code: every letter (also on the keychain's arcs) and all 7 logo bars are traced on both pieces, and the QR code read from the drawn first layer opens the right link

Print and test **one** card and keychain before making a batch.

---

## 6. The STL files (ZIP)

**STL files and print notes (ZIP)** is named after the card, e.g. `card-Jane-Doe-1234-Family-STL.zip`, and contains:

| File | |
|---|---|
| `card-<driver>-DARK.stl` | Card, dark part (both faces' background, the QR code's dots) |
| `card-<driver>-LIGHT.stl` | Card, light part (core, logo, lettering, the QR code's square) |
| `card-<driver>-print-notes.txt` | The card link, the layers, orientation, ABS or PETG settings, the pause height and layer, inserting the tag, testing and locking |
| `keychain-<driver>-DARK.stl`, `-LIGHT.stl`, `-print-notes.txt` | The same for the keychain |

File names use plain letters (José → Jose).

---

### All cards at once

On the owner link: **Owner** tab → **Print files for all cards** → **Download all cards (ZIP)**. One ZIP with a folder per card (Bambu Studio projects for the card, the keychain and both on one plate, STL files and print notes), `NFC-links.csv` with every card's link, and a README. See the [owner guide](owner-guide.md#17-print-files-for-all-cards).

---

## 7. When a card needs reprinting

The tag is sealed inside the card (and the keychain), so a reprint is a new piece with a new tag. Write the **same link** to the new tag, and destroy the old piece.

| Change | Reprint the card? | Tag |
|---|---|---|
| Supervisors, phone numbers, roles, shifts, time off, text messages | No | No change |
| Driver name (People → Rename) | Yes, for the printed name (the keychain only if its initials change) | New tag, same link |
| Backup line | Yes, for the printed number (not the keychain) | New tag, same link |
| Card removed (lost card or keychain) | Make a new card and keychain: the old link is off for both | New tags, new link |
| Start over | Every card | Every tag, new links |

---

## Trial checklist

Do this once, with a real printed card and real phones, before making cards for everyone:

- [ ] **Tag tap** (card and keychain) on an iPhone and an Android phone opens the page with the right driver.
- [ ] **QR scan** with both phones' cameras opens the same page.
- [ ] **Text All Yard Supervisors (Preferred)** opens Messages with every number and the message filled in, on an iPhone **and** a Samsung phone. If a phone leaves numbers out, report it; the link format can be adjusted.
- [ ] The **Primary call** shows the person on shift now, and every Call button dials the right number.
- [ ] **Español** switches the page to Spanish, and the Spanish text message appears.
- [ ] **Save yard numbers to Contacts** saves one contact, "Tenaris Yard Supervisors", with every number, on an iPhone and an Android phone. Note whether the iPhone shows the contact straight away with **Create New Contact**, and whether each number shows the person's name and role or just "Mobile".
- [ ] Adding the page to the home screen from the browser menu puts the Emergency icon on both phones, and the icon opens the right driver's page.
- [ ] If WhatsApp is switched on: the **WhatsApp** button opens a chat with the primary call, with the message filled in.
- [ ] If an address is set: **Directions** opens the maps app at the yard.
- [ ] **Airplane mode** on a phone that has **never** opened the page shows "This card couldn't be loaded". A phone that **has** opened it before shows the saved copy with a note; that's intended.
- [ ] Change something in the dashboard, publish, and confirm the card shows it within about a minute.
- [ ] **The card:** the QR scans, the tag reads through the card, neither face shows a trace of the tag, and the lettering and logo are clean.
- [ ] **The keychain:** the tag reads through it from both sides, the lettering, logo and initials are clean, and a key ring fits the hole.
- [ ] Only then **lock the tag**.
