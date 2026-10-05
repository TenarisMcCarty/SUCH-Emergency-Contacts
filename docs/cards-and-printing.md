# Cards and printing

How a card works, how to write its NFC tag, and how to print the 3D card from the dashboard's **Print & QR** tab.

**Contents**

1. [How a card works](#1-how-a-card-works)
2. [Making a new card: the whole process](#2-making-a-new-card-the-whole-process)
3. [Writing the NFC tag](#3-writing-the-nfc-tag)
4. [The card](#4-the-card)
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

The same link is written to the card's **NFC tag** and encoded in its **QR code**. The card key unlocks the contacts and that card's driver name. The part after `#` never leaves the phone, so no server sees it.

- **The link never changes.** Edits to people, shifts, messages or the driver's name reach the card automatically, so the tag and QR never need redoing for those.
- **Removing a card** in the dashboard switches its link off for good.
- **Keep links working:** once a card is printed or handed out, its link must keep working. Don't remove a card that's still in use, and don't "start over" (see the [owner guide](owner-guide.md#11-starting-over-last-resort)) unless you're prepared to remake every card.

---

## 2. Making a new card: the whole process

1. **People → Add card:** enter the driver name and ID (e.g. `Jane Doe (1234)`) and who will hold it (e.g. "Family").
2. **Publish.** The card's link only works after publishing.
3. **Print & QR →** choose the card → check the previews → choose the **Printer** and the **Filament** (ASA or ABS) → **Bambu Studio project (3MF)**.
4. **Write the NFC tag** with the card link and test it ([section 3](#3-writing-the-nfc-tag)). Don't lock it yet.
5. **Print the card** ([section 5](#5-printing-it)). At the pause, put the tag in.
6. **Test** the finished card with an iPhone and an Android phone: tap the card and scan the QR. Both should open the page with the right driver name.
7. **Lock the tag** (only now, after it works through the card), then hand the card over.

Before printing your first cards, set the **Backup line** in Print & QR and publish. It's printed on the cards, and the page tells families to call it if the page ever can't load.

---

## 3. Writing the NFC tag

Use the free **NFC Tools** app (iPhone or Android) and an **NTAG215 PVC coin tag, 25.4 mm (1 in) across and 0.8 mm thick**. It's the only tag the card is made for. Measure one tag from each new batch: it must be at most 25.8 mm across and 1.0 mm thick. The link is about 80 characters, well within the tag's capacity.

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

The card has two colours: one **dark** and one **light** filament. Below they're called black and white; any dark + light pair works (for example dark Tenaris blue + white), as long as the light one is white or nearly white so the QR code keeps strong contrast.

**Front** (printed face down, so it takes the build plate's flat finish):

- black, with the white Tenaris logo at the top left
- **EMERGENCY CONTACT** in big white capitals on two lines: the main text
- the driver's name in smaller white capitals along the bottom, e.g. JANE DOE (1234); a long name wraps onto two lines
- the upper right is plain black: the NFC tag sits inside the card there, with no outline, bump or texture showing
- one left edge: the logo, the headline and the name start at exactly the same line, and the name sits as far from the bottom edge as the logo does from the top

**Back** (printed on top):

- white, with the QR code at the top right
- a left column level with the QR code's top and bottom rows: **SCAN OR TAP** at the top, the contactless symbol under it (over the hidden tag), and at the bottom a small spaced-out **BACKUP** label over the larger backup number, if one is set
- a black band along the bottom edge with **LIFE-THREATENING? CALL 911** in white

The Print & QR tab shows both faces before you download: the front as you'll see it when you turn the card over, and the back as it comes off the printer.

### Specifications

| | |
|---|---|
| Size | 85.6 × 53.98 × **2.2 mm**, the outline of a credit card with 3.18 mm rounded corners |
| Printer | An enclosed Bambu Lab printer with AMS and a 0.4 mm nozzle: X1 Carbon, X1E, P1S, P2S, H2S, H2D, H2D Pro, H2C or X2D (ASA and ABS need the enclosure, so not the open A1, A1 mini, A2L or P1P) |
| Material | ASA or ABS, one dark and one light filament, the same type for both; 0.2 mm layers, textured PEI plate, **bed 90 °C** |
| Layers, from the build plate up | **front** 0–0.6 mm (3 layers, front artwork, face down) · **core** 0.6–1.6 mm (5 layers, light colour, with the NFC pocket) · **pause** · **roof** 1.6–1.8 mm (1 solid light layer) · **back** 1.8–2.2 mm (2 layers, QR artwork) |
| NFC tag | NTAG215 PVC coin, 25.4 mm (1 in) × 0.8 mm |
| NFC pocket | 26.4 mm round, 1.0 mm deep, centred 67 mm from the left and 38 mm from the bottom of the front (18.6 mm from the left on the back); 2.8 mm of solid card between the pocket and the top edge |
| Pause | after the layer that ends at **Z = 1.6 mm**, before layer 9 of 11 (shown as 1.8 mm in Bambu Studio's layer slider) |
| Covers over the tag | 0.6 mm below (the front) and 0.6 mm above (roof + back) |
| QR code | 40 × 40 mm including its white margin of 4 squares; error-correction level M (still reads with about 15% damage). Card links give 37 × 37 squares, about 0.89 mm each (the generator never goes below 0.8 mm). |
| Lettering | Source Sans 3 Bold (a free typeface in the style of Frutiger, the Tenaris typeface), set with the font's own kerning, capitals spaced slightly apart (labels a little more), and lines aligned on their visible left edge. EMERGENCY CONTACT about 5.5–5.8 mm capitals; the name 4 mm on one line, 3.5–3.8 mm on two; SCAN OR TAP 3.8 mm; the backup number 4 mm; BACKUP 3.5 mm; the 911 line 3.6 mm in a 10 mm band. **Nothing smaller than 3.5 mm.** |
| Smallest details | Every letter stroke, and every gap or hole in or between letters, is at least 0.5 mm. Letters are spaced at least 0.6 mm apart, and accents are lifted 0.6 mm clear of their letter. The tap symbol's lines and gaps are 0.8 mm. |
| Logo | The official Tenaris signature, one colour (white on the black front), 40 mm wide, never stretched: Multibar 7.2 mm tall (brand minimum 5.5 mm), with clear space of 80% of the Multibar height (5.7 mm) all round, kept free of text. Its thinnest bars are about 0.22 mm wide (official artwork, so they're kept as they are); check them in the sliced preview. |

### Why it's built this way

- **Front face down.** The front gets the plate's flat finish, and the pocket and the tag are behind 0.6 mm of solid plastic that was printed first, so nothing can sag or show through there. The front is printed mirror-image, so it reads correctly when you turn the card over; the QR code on top is not mirrored.
- **One tag size.** The pocket fits an NTAG215 PVC coin tag, 25.4 mm × 0.8 mm. 26.4 mm across is the tag + 1 mm, the same allowance tag sellers give for embedding 25 mm tags (a 26 × 1 mm slot). Printed holes come out 0.1–0.4 mm small and coin tags vary by about ±0.2 mm, so the tag still drops in by hand at the pause; after cooling (ASA shrinks 0.4–0.7%, ABS about 0.8%) the pocket still doesn't squeeze it. 1.0 mm deep is the tag plus one 0.2 mm layer, so the nozzle never touches the tag. Bambu Studio slices the pocket at exactly 26.4 mm (checked in its G-code).
- **Bed 90 °C.** From the pause on, the PVC tag sits in a card on the hot bed. PVC softens at about 80 °C, and PVC tags made for embedding are rated for beds up to 90 °C, so the project caps the bed at 90 °C for ASA as well as ABS (Bambu's own P2S presets use 90 °C for ABS and Generic ASA; only the Bambu ASA preset says 100 °C). The NTAG215 chip itself is rated to 125 °C unpowered (NXP datasheet).
- **Covers.** 0.6 mm (three layers) under the tag keeps the front flat and opaque. Above it, one solid light layer (the first layer after the pause, printed in one colour so no colour changes happen while it spans the tag) plus the 0.4 mm back: 0.6 mm in all. Equal covers above and below make the card shrink evenly, so it stays flat.
- **2.2 mm thick.** That's the minimum for a 0.8 mm tag with those covers: about three bank cards, still easy in a wallet slot, and stiff and hard to snap in solid (100% infill) ASA or ABS.
- **Light core.** Black plastic hides a white core completely, even at 0.6 mm. White plastic is translucent: over a black core it looks grey, and the QR code would lose contrast. With a white core the white lettering stays bright and the black front shows no trace of the core or the tag.
- **Big, few words.** Small text doesn't print well. At 3.5 mm capitals, every stroke and gap of A–Z, 0–9 and common punctuation is at least 0.5 mm. A few characters have finer details and need bigger letters: Å and cedillas (Ç, Ş) 3.9 mm, the comma and # 3.7 mm. Curly quotes print as straight ones. If a name can't fit at its minimum size, even on two lines, the dashboard refuses it and asks you to shorten it (**People → Rename**).

---

## 5. Printing it

### With the Bambu Studio project (recommended)

1. **Print & QR →** choose the card → **Printer** (the Bambu Lab model you'll print on; remembered on this computer) → **Filament:** ASA or ABS → **Bambu Studio project (3MF)**. The file name ends with the printer, e.g. `card-Jane-Doe-1234-Family-H2D.3mf`.
2. Open the file in Bambu Studio. It's set for that printer with a 0.4 mm nozzle, from Bambu's own presets for it: a LIGHT part (filament 1, shown white) and a DARK part (filament 2, shown black), 0.2 mm layers, 100% infill, Arachne walls, prime tower on, no supports, no brim, textured PEI plate, bed 90 °C, and the pause for the tag.
3. Put a dark and a light filament of that type in the AMS and match filament 1 to the light slot and filament 2 to the dark slot.
   - **Two-nozzle H2D, H2D Pro and X2D:** the light filament prints from the **left** nozzle and the dark one from the **right** nozzle, so the colours never share a nozzle: no purging between colours, no dark tint in the white lettering, and about 8 minutes faster. Load each filament where its nozzle can use it (that side's AMS or spool). To swap sides, change **Filament grouping** in Bambu Studio before slicing.
   - **H2C:** Bambu Studio's own filament grouping chooses the nozzles (its nozzle changer needs the printer's nozzle list, so the file doesn't fix them).
4. **Slice**, then check the preview: every QR square, every letter, all 7 bars of the Tenaris logo, an empty pocket, and the pause at layer 9.
5. **Print** ([at the pause](#at-the-pause)).

### With the STL files

1. **Print & QR → STL files and print notes (ZIP).**
2. **Import both STL files at once.** When asked whether to load them as a single object with multiple parts, choose **Yes**. Keep their positions; they're already aligned.
3. Give the **DARK part the dark filament** and the **LIGHT part the light filament**, both the same type (ASA or ABS).
4. **Orientation:** as the files come, front (logo side) face **down**. Don't flip, rotate or mirror anything.
5. **Settings** (starting from the Bambu ASA or ABS profile for your printer and its 0.20 mm Standard process): layer height 0.2 mm, first layer 0.2 mm; sparse infill 100%; supports off; prime tower on; Arachne walls (the default); bed 90 °C, first layer and other layers (the Bambu ASA profile says 100 °C).
6. **Slice**, then drag the layer slider to **layer 9 (1.80 mm)**, right-click its handle → **Add Pause**. Layer 8 (1.60 mm) should be the last one with the pocket open.

### ASA and ABS

- Keep the **enclosure door and top closed** for the whole print, except at the pause. Drafts make ASA and ABS warp and crack.
- **Part cooling fan off or low.** Bambu's ASA and ABS profiles already keep it low.
- **Brim:** none needed normally. If corners lift on a test card, add a 3–5 mm brim (or mouse ears) and trim it off afterwards.
- The front takes the plate's finish: a textured PEI plate gives a matte, slightly textured front; a smooth plate a glossy one. Clean the plate; no fingerprints.
- Let the card cool on the plate before taking it off.

### At the pause

The printer finishes layer 8 with the pocket open, moves the head away from the card (Bambu printers park it over the waste chute when paused) and waits.

1. Wait until the head has stopped away from the card. Open the door.
2. Drop the **written and tested** tag into the pocket and press it flat. If it has an adhesive back, that side goes down. It must sit fully below the rim: nothing may stick up. Don't touch the nozzle, the card's edges or the prime tower.
3. Close the door and press **Resume** straight away: PVC softens at about 80 °C and the card is near 90 °C, so sealing the tag quickly keeps it flat.

The printer then prints the prime tower first (purging the nozzle after the wait) and seals the tag with one light layer, printed as a bridge in one colour.

Then **test** the finished card: scan the QR and tap it with an iPhone and an Android phone. Only then lock the tag.

### How the files were checked

Without a physical print, the generated files were checked digitally for several names (short, long, accented, punctuation):

- both parts are watertight
- the dark and light parts fill every layer exactly, with no gaps or overlaps, and the total volume is right
- the pocket is the right size and place, and fully enclosed: closed below by the front and above by the roof
- the front, rendered from the model and turned over, reads the right way round; the QR code decodes from the top face
- capital heights, letter strokes and gaps (both colours) and the logo's clear space were measured on renders of the model
- the .3mf was sliced with Bambu Studio 2.8 for every listed printer (ASA; ABS on the H2D and X1 Carbon too) and the G-code checked: the pause comes after layer 8 (Z 1.6 mm) and before layer 9 of 11; the pocket is open at 26.4 mm on layers 4–8 and fully covered on every other layer; after the pause the prime tower prints first, then the roof bridges the pocket in the light filament only; the bed is 90 °C; on the H2D, H2D Pro and X2D each colour stays on its own nozzle

Print and test **one** card before making a batch.

---

## 6. The STL files (ZIP)

**STL files and print notes (ZIP)** is named after the card, e.g. `card-Jane-Doe-1234-Family-STL.zip`, and contains:

| File | |
|---|---|
| `card-<driver>-DARK.stl` | Dark part (front, QR code, back lettering) |
| `card-<driver>-LIGHT.stl` | Light part (core, logo and front lettering, back) |
| `card-<driver>-print-notes.txt` | The card link, the layers, orientation, ASA/ABS settings, the pause height and layer, inserting the tag, testing and locking |

File names use plain letters (José → Jose).

---

### All cards at once

On the owner link: **Owner** tab → **Print files for all cards** → **Download all cards (ZIP)**. One ZIP with a folder per card (its .3mf, STL files and print notes), `NFC-links.csv` with every card's link, and a README. See the [owner guide](owner-guide.md#17-print-files-for-all-cards).

---

## 7. When a card needs reprinting

The tag is sealed inside the card, so a reprint is a new card with a new tag. Write the **same link** to the new tag, and destroy the old card.

| Change | Reprint the card? | Tag |
|---|---|---|
| Supervisors, phone numbers, roles, shifts, time off, text messages | No | No change |
| Driver name (People → Rename) | Yes, for the printed name | New tag, same link |
| Backup line | Yes, for the printed number | New tag, same link |
| Card removed (lost card) | Make a new card | New tag, new link |
| Start over | Every card | Every tag, new links |

---

## Trial checklist

Do this once, with a real printed card and real phones, before making cards for everyone:

- [ ] **Tag tap** on an iPhone and an Android phone opens the page with the right driver.
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
- [ ] **The card:** the QR scans, the tag reads through the card, the front shows no trace of the tag, and the lettering and logo are clean.
- [ ] Only then **lock the tag**.
