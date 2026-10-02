# Cards and printing

How a card works, how to write its NFC tag, and how to make each kind of printed card from the dashboard's **Print & QR** tab.

**Contents**

1. [How a card works](#1-how-a-card-works)
2. [Making a new card: the whole process](#2-making-a-new-card-the-whole-process)
3. [Writing the NFC tag](#3-writing-the-nfc-tag)
4. [The 3D-printed card](#4-the-3d-printed-card)
5. [The paper card](#5-the-paper-card)
6. [QR label and QR images](#6-qr-label-and-qr-images)
7. [The ZIP download](#7-the-zip-download)
8. [When a card needs reprinting](#8-when-a-card-needs-reprinting)
9. [Trial checklist](#trial-checklist)

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

1. **Cards → Add card:** enter the driver name and ID (e.g. `Jane Doe (1234)`) and who will hold it (e.g. "Family").
2. **Publish.** The card's link only works after publishing.
3. **Print & QR →** choose the card → check the previews → **Download everything (ZIP)**.
4. **Write the NFC tag** with the card link ([section 3](#3-writing-the-nfc-tag)).
5. **Print the card:** 3D ([section 4](#4-the-3d-printed-card)) or paper ([section 5](#5-the-paper-card)).
6. **Test** with an iPhone and an Android phone: tap the tag and scan the QR. Both should open the page with the right driver name.
7. **Lock the tag** (only after it works), then hand the card over.

Before printing your first cards, set the **Backup line** in Print & QR and publish. It's printed on the cards, and the page tells families to call it if the page ever can't load.

---

## 3. Writing the NFC tag

Use the free **NFC Tools** app (iPhone or Android) and an **NTAG215** sticker; the 25 mm round ones fit the 3D card. The link is about 80 characters, well within the tag's capacity.

1. In the dashboard, **Print & QR →** choose the card → **Copy link**. Or open `…-link.txt` from the ZIP.
2. In NFC Tools: **Write → Add a record → URL / URI** → paste the link → **OK**.
3. Tap **Write**, then hold the sticker to the back of the phone until it confirms.
4. Test it: with NFC Tools closed, tap the sticker with an unlocked phone. The page should open with the right driver name.
5. **Lock it only after testing:** NFC Tools → **Other → Lock tag**. Locking is **permanent**; it stops anyone rewriting the tag, including you.

Notes:

- iPhones read NFC tags in the background from the iPhone XS onward; the screen must be on. On Android, NFC must be switched on in Settings.
- On a 3D-printed card, write and test the sticker **before** sealing it inside. Test it again after printing.
- Metal (and some phone cases or wallets with RFID blocking) stops NFC from working.

---

## 4. The 3D-printed card

**Print & QR → Black part (STL)** and **White part (STL)**, plus **Print notes**. Or take them from the ZIP.

### What it looks like

**Front** (printed facing up):

- dark background with the white Tenaris logo
- "EMERGENCY CONTACT" and the driver's name in white
- a white band along the bottom with three lines in black:
  > Tap this card or scan the QR code
  > to reach Tenaris emergency contacts.
  > Life-threatening? Call 911 first.
- the upper-right area is left plain: the NFC tag sits underneath it

**Back** (printed facing down, onto the build plate):

- white background with the QR code on the right
- on the left, a contactless symbol in a ring, sitting exactly over the hidden tag, with **TAP PHONE HERE** below it
- **BACKUP LINE** and the number, if a backup line is set

The Print & QR tab shows both faces before you download.

### Specifications

| | |
|---|---|
| Size | 85.6 × 53.98 mm, the same as a credit card, with 3.18 mm rounded corners |
| Thickness | 1.2, 1.4 or 1.6 mm, set by **NFC sticker thickness** (table below) |
| Layers, bottom to top | back skin 0.4 mm (QR side) · white core with the NFC pocket · front skin 0.4 mm |
| Colours | two STL files that fit together exactly: **black part** (dark front, black lettering, QR squares, back artwork) and **white part** (core, white lettering and band, white back) |
| NFC pocket | 25.6 mm round (for a 25 mm sticker), centred 67 mm from the left and 39 mm from the bottom of the front; sealed above and below by 0.4 mm |
| QR code | 40 × 40 mm including its white margin of 4 squares; error-correction level M (still reads with about 15% damage). Current card links give 37 × 37 squares, about 0.89 mm each. |
| Smallest details | the generator never makes a QR square smaller than 0.8 mm, or a capital letter shorter than 2.3 mm; both print cleanly with a 0.4 mm nozzle |
| Logo | The official Tenaris signature, one colour (white on the black face), 44 mm wide: Multibar 7.9 mm tall (brand minimum 5.5 mm), with clear space of 80% of the Multibar height all round. Its thinnest bars are 0.27 mm wide; the slicer prints them at its narrowest line, so check them in the preview. |
| Driver name | up to 5 mm capital height; long names shrink, then wrap onto two lines. If a name still can't print cleanly, the dashboard refuses and asks you to shorten it. Lettering never sits over the tag. |
| Lettering | Source Sans 3 Bold (a free typeface in the style of Frutiger, the Tenaris typeface) |
| Core colour | white, so white areas stay bright (thin white PLA over a black core looks grey) |

### Choosing the NFC sticker thickness

Measure the sticker at its thickest point (the chip), without its backing paper, and pick the matching option. It leaves at least 0.1 mm of clearance.

| Sticker thickness | Pocket depth | Card thickness | Pause after Z | Pause before layer (0.2 mm layers) |
|---|---|---|---|---|
| up to 0.3 mm | 0.4 mm | 1.2 mm | 0.8 mm | 5 |
| up to 0.5 mm *(default)* | 0.6 mm | 1.4 mm | 1.0 mm | 6 |
| up to 0.7 mm | 0.8 mm | 1.6 mm | 1.2 mm | 7 |

The **Print notes** file states the right numbers for the thickness you picked.

### Printing in Bambu Studio (two colours, 0.4 mm nozzle)

1. **Import both STL files at once.** When asked whether to load them as a single object with multiple parts, choose **Yes**. Keep their positions; they're already aligned.
2. Give the **black part black filament** and the **white part white filament**. Use the same type of PLA for both.
3. **Orientation:** QR side **down**, as the files come. Don't flip or mirror anything.
4. **Suggested starting settings:**
   - layer height 0.2 mm (first layer 0.2 mm)
   - 100% infill; supports off; raft off
   - a smooth build plate, for a cleaner QR face
   - a slow first layer (about 20 mm/s)
   - keep normal purging, but don't flush into the card itself

   These are starting points, not a tested profile.
5. **Slice**, then check the preview: every QR square, every letter, all 7 bars of the Tenaris logo, and an empty pocket (no support inside). If thin logo bars are missing, check that **Quality → Wall generator** is **Arachne** (the default).
6. **Add the pause:** in the sliced preview, drag the layer slider to the layer given in the table above (the first layer that covers the pocket). Right-click its handle → **Add Pause**. Check it sits right after Z = 0.8 / 1.0 / 1.2 mm.
7. **Print.** At the pause, press the written and tested sticker into the pocket, sticky side down, flat and below the rim. Then resume. The next layers seal it in.
8. When it's cool, **test**: scan the QR and tap the card with an iPhone and an Android phone.

### How the files were checked

Without a physical print, the generated files were checked digitally:

- both parts are watertight
- the black and white parts fill every layer exactly, with no gaps or overlaps
- the pocket is fully enclosed
- the QR code decodes correctly from the model's back face

Print and test **one** card before making a batch.

---

## 5. The paper card

**Print & QR → Paper card (PDF).** It's a US Letter page with **three copies** of the card. Each copy is the **front and back side by side** at actual card size, ready to cut out and fold.

1. Print at **100% / Actual size**, not "fit to page". Card stock gives the best result.
2. Cut along the **outer marks**.
3. Fold on the **middle marks**, so the back sits behind the front.
4. Glue the halves together, or laminate.
5. Scan the QR with a phone before handing it out.

The paper card has the same layout as the 3D card's front, but on white with the **full-colour Tenaris signature** (the brand guide's preferred version), a Tenaris Green line above the instructions and the 911 line in red. A paper card has no NFC tag, so its back says **SCAN WITH YOUR PHONE CAMERA** with a green arrow pointing to the QR code, plus the backup line, if set. The back has no logo: at that size it would be below the brand guide's minimum, and the front already carries it. The card images are 600 dpi.

You can stick an NFC sticker to a paper card and write the same link to it; it works the same way.

---

## 6. QR label and QR images

- **QR label with name (PNG):** a 4 × 6 inch label at 300 dpi (1200 × 1800 pixels). It has the full-colour Tenaris signature on white with its clear space, a Tenaris Green line, "EMERGENCY CONTACT FOR" and the driver's name, a large QR code, then:
  > Scan with your phone camera to reach Tenaris emergency contacts.
  >
  > Life-threatening? Call 911 first.

  plus the backup line, if set. Prints on standard 4 × 6 shipping-label printers, or on paper.
- **QR only (PNG):** the bare QR code with its white margin, 20 pixels per square (900 × 900 pixels for current links).
- **QR only (SVG):** the same as a vector file (one unit per square). Use it to put the code into another design.

Keep the white margin around any QR code you place elsewhere; scanners need it.

---

## 7. The ZIP download

**Download everything (ZIP)** is named after the card, e.g. `card-Jane-Doe-1234-Family.zip`, and contains:

| File | |
|---|---|
| `card-<driver>-BLACK.stl` | 3D card, black part |
| `card-<driver>-WHITE.stl` | 3D card, white part |
| `card-<driver>-print-notes.txt` | Settings, the pause height and the card link |
| `card-<driver>-paper-card.pdf` | Paper card sheet |
| `card-<driver>-qr-label.png` | 4 × 6 label |
| `card-<driver>-qr.png` | QR image |
| `card-<driver>-qr.svg` | QR vector |
| `card-<driver>-link.txt` | The exact card link, for writing the NFC tag |

The 3D files in the ZIP use the **NFC sticker thickness** selected in the Print & QR tab at the time.

---

## 8. When a card needs reprinting

| Change | Reprint the card? | Rewrite the tag? |
|---|---|---|
| People, phone numbers, roles, shifts, text messages | No | No |
| Driver name (Cards → Rename) | Yes, for the printed name | No |
| Backup line | Yes, for the printed number | No |
| Card removed (lost card) | Make a new card | New tag |
| Start over | Every card | Every tag |

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
- [ ] **3D card:** the QR scans, the tag reads through the card, and the lettering is clean.
- [ ] Only then **lock the tag**.
