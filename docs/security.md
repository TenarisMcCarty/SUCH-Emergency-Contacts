# Security

This repository and website are **public**. This page explains what that means, how the data is protected, who can see what, and the limits of the design.

**Contents**

1. [What's public](#1-whats-public)
2. [How the data is protected](#2-how-the-data-is-protected)
3. [Who can see and do what](#3-who-can-see-and-do-what)
4. [The pages themselves](#4-the-pages-themselves)
5. [Operational advice](#5-operational-advice)
6. [Known limits](#known-limits)

---

## 1. What's public

Anyone on the internet can see:

- all the website code in this repository, and this documentation
- the file `contacts.enc.json` and every earlier version of it in the repository history. **Everything inside it is encrypted.**
- from the file's structure: roughly how many cards exist (one encrypted entry each), and when each change was published (commit times)
- commit messages, which are always just "Update emergency card data"

Nobody can read names, phone numbers, roles, shifts, driver names, messages, the change history or the GitHub token without one of the keys described below.

---

## 2. How the data is protected

All encryption happens in the browser, using the standard Web Crypto API. Nothing is decrypted on any server.

### Keys

| Key | Where it lives | What it opens |
|---|---|---|
| **Card key** (128-bit, random, one per card) | Only in that card's link, after `#`. Browsers never send this part to a server, GitHub included. | That card's entry: the current data key and that card's driver name |
| **Data key** (128-bit, random) | Inside each card's entry and the admin block. **A new one is made on every publish.** | The shared data: people, phone numbers, roles, shifts, messages, backup line |
| **Dashboard password** | Supervisors and the owner | The admin block: everything above, plus every card's key and label, the GitHub token, the owner's contact and the change history |
| **Recovery code** (P-256 private key) | Only the site owner | The recovery block: the same contents as the admin block |

### Algorithms

| Item | How it's done |
|---|---|
| Encryption | AES-GCM with 128-bit keys and a fresh random 96-bit nonce for every encrypted item. GCM also detects any tampering. |
| Password | PBKDF2-HMAC-SHA-256, 600,000 iterations, random 128-bit salt. Each password guess is deliberately slow. |
| Suggested passwords | 5 words chosen with secure randomness from a 7,772-word list, about 64 bits. Custom passwords must be at least 20 characters. |
| Card lookup | Each card's entry is filed under the first 12 characters of SHA-256("slot:" + card key), so the file never reveals card keys. |
| Recovery block | Locked to the owner's ECDH P-256 public key. Each publish uses a fresh one-time key pair; the AES key is SHA-256(shared secret + label). Anyone publishing can keep the owner's copy current, but only the recovery code can open it. |

The full file format is in the [technical reference](technical.md#the-data-file-contactsencjson).

---

## 3. Who can see and do what

| | Read contacts and shifts | See other drivers' names | Publish changes | Read the GitHub token | Reset the password |
|---|---|---|---|---|---|
| Anyone on the internet | No | No | No | No | No |
| Holder of a card (or its link) | **Yes** (all contacts) | No (only their own driver) | No | No | No |
| Removed card | Only versions from before it was removed | No | No | No | No |
| Dashboard password holder | Yes | Yes | **Yes** | Yes (it's in the admin block) | No (but can *change* it) |
| Recovery code holder (owner) | Yes | Yes | Yes | Yes | **Yes** |
| GitHub account / repository write access | Encrypted only | Encrypted only | Can replace the whole website | No | No |

Notes:

- **A card holder can see every contact's name and phone number.** That's the purpose of the card. Treat a card like a business card with private numbers on it.
- **Removing a card** stops it working for everything published afterwards, because a new data key is made on every publish and the removed card never receives it.
- **Publishing needs the GitHub token**, which is stored in the admin block. Anyone with the dashboard password can therefore publish. That's what lets supervisors work without GitHub accounts.

---

## 4. The pages themselves

- **Strict Content-Security-Policy** on both pages:
  - Only this site's own scripts run; there are no outside scripts, fonts, trackers or analytics.
  - The emergency page connects only to this site.
  - The dashboard additionally connects to `api.github.com`, to publish.
- **No cookies.** The emergency page stores only the language choice and its offline copy. The dashboard stores only "Your name" for History. The password, recovery code, token and card keys stay in memory and are forgotten on **Lock**, reload or close.
- **Referrer** headers are switched off, so following a link from these pages doesn't leak the address, and search engines are asked not to index them.
- **Text is never treated as code:** names and messages are inserted as plain text, so a name containing HTML just shows as text.
- **Third-party code** is copied into the repository, not loaded from other servers:
  - qrcode-generator, opentype.js and earcut are unmodified npm releases, with checksums verified when they were added.
  - Licences are in `THIRD-PARTY-NOTICES.txt`.

---

## 5. Operational advice

- Keep **two-factor authentication** on the GitHub account that owns the repository, and keep write access to the repository limited to the owner.
- Use the **suggested** password, and share it in person or by phone, never by email or chat.
- Keep the **recovery code** only in the owner's password manager.
- When someone should lose access, use **Owner tab → New password and token**, then delete the old token on GitHub ([owner guide](owner-guide.md#7-taking-away-someones-access)).
- Set the GitHub token to the longest expiry offered, and put a reminder in a calendar before it expires.
- **Lock** the dashboard when you've finished, especially on shared computers.

---

## Known limits

- **History keeps old versions.** Every published version of `contacts.enc.json` stays in the public repository history. Anything that could open an old version still can, though only that old version:
  - an old password
  - an old recovery code
  - a removed card

  For example, a removed card can still read the contacts as they were before it was removed, but nothing published later.
- **The password lets you publish.** Anyone with it can change contacts, remove cards or change the password. The History tab shows who published what (by the name they entered), but that name is self-reported.
- **The Owner tab is hidden, not locked.** It only appears with `#owner` in the address, to keep the supervisor view simple. Anyone with the password could open it, but the password already gives full publishing power.
- **Offline guessing:** the encrypted file is public, so someone could try passwords against it offline. The 600,000-iteration stretching and a 5-word random password make this impractical. A short, guessable custom password would not.
- **Repository access beats everything.** Anyone who can push to the repository, or who controls the GitHub account, can replace the website's code, for example to capture passwords typed into a modified dashboard.
- **Not reviewed by a third party.** The design uses standard, well-known building blocks, but hasn't had an independent security review.
- **Trademarks:** the Tenaris name and logo are Tenaris trademarks. The logo comes from the official media kit and is used here for an internal Tenaris purpose.
