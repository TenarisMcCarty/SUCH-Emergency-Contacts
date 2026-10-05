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
- from the file's structure: roughly how many cards exist (one encrypted entry each), how many people have their own sign-in (one entry each), whether the shared supervisors' password is on, and when each change was published (commit times)
- commit messages, which are always just "Update emergency card data"

Nobody can read names, emails, phone numbers, roles, shifts, driver names, messages, the change history or the GitHub token without one of the keys described below.

---

## 2. How the data is protected

All encryption happens in the browser, using the standard Web Crypto API. Nothing is decrypted on any server.

### Keys

| Key | Where it lives | What it opens |
|---|---|---|
| **Card key** (128-bit, random, one per card) | Only in that card's link, after `#`. Browsers never send this part to a server, GitHub included. | That card's entry: the current data key and that card's driver name |
| **Data key** (128-bit, random) | Inside each card's entry and the admin block. **A new one is made on every publish.** | The shared data: people, phone numbers, roles, shifts, messages, backup line |
| **Admin key** (128-bit, random) | Locked separately for each way in (the rows below). **A new one is made on every publish.** | The admin block: everything above, plus every card's key and label, the GitHub token, the owner's contact, the list of people who can sign in and the change history |
| **Personal sign-in** (email + password) | One supervisor each | Their own private key (P-256), which opens the admin key |
| **Shared supervisors' password** | Supervisors (and the owner), until the owner switches it off | Its own private key, which opens the admin key |
| **Owner password** | Only the site owner | The owner login, which holds the recovery code |
| **Recovery code** (P-256 private key) | Only the site owner | The recovery block, which holds the admin key (so the owner can always get in, publish, and reset anyone's password without knowing it) |

### Algorithms

| Item | How it's done |
|---|---|
| Encryption | AES-GCM with 128-bit keys and a fresh random 96-bit nonce for every encrypted item. GCM also detects any tampering. |
| Passwords (personal, shared and owner) | PBKDF2-HMAC-SHA-256, 600,000 iterations, random 128-bit salt, separately for each password. Each guess is deliberately slow. |
| Personal and shared sign-ins | Each has its own ECDH P-256 key pair; the private key is AES-GCM-encrypted with the key made from its password. Changing or resetting a password makes a **new key pair**, so an old password (still in the repository history) opens nothing published later. |
| Admin key | Each publish locks the new admin key separately for every sign-in's public key and the owner's, the same way as the recovery block. Publishing needs only public keys, so nobody needs anyone else's password, and someone removed never receives a later admin key. |
| Person lookup | Each person's entry is filed under the first 16 characters of SHA-256("person:" + email in lower case), so the file shows no emails. |
| Owner login | The recovery code, AES-GCM-encrypted with the key made from the owner password |
| Suggested and temporary passwords | Five words from a 601-word health, safety, environment and yard list, two digits and a symbol, e.g. `harness-bayou-muster-flange-teamwork-47!`, chosen with secure randomness (about 56 bits). Custom passwords need at least 10 characters, with a number and a symbol. Because the data file is public, someone could try to guess a password offline; the 600,000-round stretching slows that down, but a short or common password (like `Password1!`) could still be guessed. Prefer the suggested ones. |
| Card lookup | Each card's entry is filed under the first 12 characters of SHA-256("slot:" + card key), so the file never reveals card keys. |
| Recovery block | The admin key, locked to the owner's ECDH P-256 public key. Each publish uses a fresh one-time key pair; the AES key is SHA-256(shared secret + label). Anyone publishing can keep the owner's copy current, but only the recovery code can open it. |

The full file format is in the [technical reference](technical.md#the-data-file-contactsencjson).

---

## 3. Who can see and do what

| | Read contacts and shifts | See other drivers' names | Publish changes | Read the GitHub token | Change the supervisors' password | Owner sign-in / Owner tab |
|---|---|---|---|---|---|---|
| Anyone on the internet | No | No | No | No | No | No |
| Holder of a card (or its link) | **Yes** (all contacts) | No (only their own driver) | No | No | No | No |
| Removed card | Only versions from before it was removed | No | No | No | No | No |
| Personal sign-in | Yes | Yes | **Yes** | Yes (it's in the admin block) | Only their own password | **No** |
| Removed personal sign-in | Only versions from before it was removed (and the contacts through any card link they copied) | No | Not through the dashboard. With a copied token, yes, until it's replaced | Only the old token | No | No |
| Shared supervisors' password (while on) | Yes | Yes | **Yes** | Yes (it's in the admin block) | Yes (the shared one) | **No** |
| Owner password or recovery code | Yes | Yes | Yes | Yes | Yes, without knowing the current one; resets anyone's | **Yes** |
| A supervisor sign-in + a new token from the TenarisMcCarty GitHub account | Yes | Yes | Yes | Yes | Yes | Yes (reclaim) |
| GitHub account / repository write access | Encrypted only | Encrypted only | Can replace the whole website | No | No | Only with the supervisors' password (reclaim) |

Notes:

- **A card holder can see every contact's name and phone number.** That's the purpose of the card. Treat a card like a business card with private numbers on it.
- **Time off is in the same part of the file.** The page doesn't show it, but someone with a card and technical skill could read the dates a supervisor is away and who covers. Ended time off is dropped at the next publish (it stays in older versions in the repository history, like everything else).
- **Removing a card** stops it working for everything published afterwards, because a new data key is made on every publish and the removed card never receives it.
- **Publishing needs the GitHub token**, which is stored in the admin block. Anyone who can sign in can therefore publish. That's what lets supervisors work without GitHub accounts. It's also why removing someone should come with a new token.
- **Removing a personal sign-in** stops it for everything published afterwards: the admin key is new on every publish and is never locked for that person again. Nobody else's password changes.
- **Supervisor sign-ins can't open owner access:** the owner login and the recovery block need the owner password or the recovery code. The only way back to owner access without them is to reclaim it, which needs a fresh token that only the TenarisMcCarty GitHub account can create.
- **History names:** for personal sign-ins, History shows the name the owner gave that sign-in. For the shared password, it's whatever name was typed in Settings.

---

## 4. The pages themselves

- **Strict Content-Security-Policy** on both pages:
  - Only this site's own scripts run; there are no outside scripts, fonts, trackers or analytics.
  - The emergency page connects only to this site. Its WhatsApp and Directions buttons are ordinary links: they hand the yard's number and message, or the address, to WhatsApp or the maps app only when tapped.
  - The dashboard additionally connects to `api.github.com`, to publish.
- **No cookies.** The emergency page stores only the language choice, its offline copy and the last card link opened (so the home-screen icon can reopen it; that link is already in the phone's browser history). The dashboard stores only "Your name" for History. Passwords, the recovery code, the token and card keys stay in memory and are forgotten on **Lock**, reload or close.
- **Referrer** headers are switched off, so following a link from these pages doesn't leak the address, and search engines are asked not to index them.
- **Text is never treated as code:** names and messages are inserted as plain text, so a name containing HTML just shows as text.
- **Third-party code** is copied into the repository, not loaded from other servers:
  - qrcode-generator, opentype.js and earcut are unmodified npm releases, with checksums verified when they were added.
  - Licences are in `THIRD-PARTY-NOTICES.txt`.

---

## 5. Operational advice

- Keep **two-factor authentication** on the GitHub account that owns the repository, and keep write access to the repository limited to the owner.
- Give every supervisor their **own sign-in**, then **switch off the shared password** and replace the GitHub token.
- Use the **suggested** passwords. Hand over temporary passwords in person or by phone, never by email or chat.
- **"Forgot password?" emails aren't verified.** Confirm with the person (e.g. by phone) before resetting their password.
- Keep the **owner password** and **recovery code** only in the owner's password manager, separate from the supervisors' password.
- When someone should lose access, **Remove** their sign-in and replace the GitHub token. If they knew the shared password, use **Owner tab → New password and token** instead. Then delete the old token on GitHub ([owner guide](owner-guide.md#9-taking-away-someones-access)).
- Set the GitHub token to the longest expiry offered, and put a reminder in a calendar before it expires.
- **Lock** the dashboard when you've finished, especially on shared computers. It also locks by itself after 30 minutes without use, unless changes are waiting to be published (so nobody loses work); a computer left open with unpublished changes stays signed in.

---

## Known limits

- **History keeps old versions.** Every published version of `contacts.enc.json` stays in the public repository history. Anything that could open an old version still can, though only that old version:
  - an old password, including a temporary one
  - an old recovery code
  - a removed card or a removed sign-in

  For example, a removed card can still read the contacts as they were before it was removed, but nothing published later.

  One exception: the owner password only unlocks the recovery code, which doesn't change when the owner password does. An old owner password still opens the code in old versions, and that code keeps working. So if the owner password leaks, also make a new recovery code.
- **Every sign-in lets you publish.** Anyone who can sign in can change contacts, remove cards or change the shared password. History names personal sign-ins automatically, but shared-password names are self-reported.
- **A removed person keeps what they already copied.** While signed in they could have copied:
  - the **GitHub token**: until it's replaced, they could still change the data file or the website itself. Replace it and delete the old one on GitHub.
  - **card links**: each still shows the current contact list, like any card. If that matters, remove those cards and make new ones.
  - older versions of the data, which stay in the repository history.
- **Emails are hidden, not secret.** Someone who guesses a person's email can work out whether it has a sign-in, because the fingerprint is just a hash of the email. The number of sign-ins is visible too.
- **Reset requests aren't checked.** **Forgot password?** just writes an email; anyone could send one. The owner should confirm by phone before resetting.
- **A temporary password works until it's replaced.** Until the person chooses their own password and publishes, the temporary one opens the dashboard. Hand it over in person or by phone.
- **Owner access relies on honest publishing.** Each publish carries the owner login, the recovery block and every sign-in forward. A technically skilled supervisor running modified code could publish a file that drops or replaces them, adds a sign-in, or writes a false name in History. The owner would notice dropped owner access, because owner sign-in would fail, and could reclaim access with the GitHub account ([owner guide, section 8](owner-guide.md#8-lost-both-the-owner-password-and-the-recovery-code)) or restore an earlier version from the history. An added sign-in would show in the Owner tab.
- **Offline guessing:** the encrypted file is public, so someone could try passwords against it offline, one sign-in at a time. The 600,000-iteration stretching slows each guess down. A suggested password (about 56 bits) would take a single fast graphics card tens of thousands of years; a short or common custom password could be guessed much sooner. Any one weak password opens the whole admin data, including the GitHub token.
- **Repository access beats everything.** Anyone who can push to the repository, or who controls the GitHub account, can replace the website's code, for example to capture passwords typed into a modified dashboard.
- **Not reviewed by a third party.** The design uses standard, well-known building blocks, but hasn't had an independent security review.
- **Trademarks:** the Tenaris name and logo are Tenaris trademarks. The logo comes from the official media kit and is used here for an internal Tenaris purpose.
