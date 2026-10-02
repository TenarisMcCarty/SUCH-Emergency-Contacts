# Owner guide

The site owner looks after the parts supervisors never touch: the GitHub connection, the recovery code and access control. Everything here happens in the dashboard opened with the **owner link**:

**https://tenarismccarty.github.io/SUCH-Emergency-Contacts/dashboard.html#owner**

Bookmark it. Compared with the supervisor link, the owner link adds:

- an **Owner** badge in the header and an **Owner** tab
- on the sign-in screen, **Lost the password?** offers a reset with your recovery code, and **Start over**

Everything else works exactly as described in the [supervisor guide](supervisor-guide.md).

> The Owner tab is hidden from supervisors to keep their screen simple. It is **not** a security barrier: anyone with the password could open the owner link. See [Security](security.md).

**Contents**

1. [What to keep safe](#1-what-to-keep-safe)
2. [First-time setup](#2-first-time-setup)
3. [The GitHub token](#3-the-github-token)
4. [The recovery code](#4-the-recovery-code)
5. [Your contact for supervisors](#5-your-contact-for-supervisors)
6. [Resetting a forgotten password](#6-resetting-a-forgotten-password)
7. [Taking away someone's access](#7-taking-away-someones-access)
8. [Starting over (last resort)](#8-starting-over-last-resort)
9. [Upgrading data from the first version](#9-upgrading-data-from-the-first-version)
10. [The GitHub repository](#10-the-github-repository)

---

## 1. What to keep safe

| Item | Who has it | If it's lost | If it leaks |
|---|---|---|---|
| **Dashboard password** | You and the supervisors | You reset it with the recovery code ([section 6](#6-resetting-a-forgotten-password)). | Take away access ([section 7](#7-taking-away-someones-access)). |
| **Recovery code** (43 characters) | **Only you**, in your password manager | Make a new one while you can still sign in ([section 4](#4-the-recovery-code)). | Make a new one and publish. |
| **GitHub token** | Only you create it. It's stored encrypted inside the data file, and nobody ever needs to see it again. | Make a new one ([section 3](#3-the-github-token)). | Delete it on GitHub, make a new one ([section 7](#7-taking-away-someones-access)). |
| **GitHub account** (TenarisMcCarty) | You | Recover through GitHub. | Anyone with it can change the website. Keep two-factor authentication on. |

---

## 2. First-time setup

> This repository is already set up. You only need this section if you ever [start over](#8-starting-over-last-resort) or set up a new copy.

When there is no data yet, the dashboard starts setup automatically.

1. **Set up · step 1 of 3: Choose the dashboard password.** Save the suggested password (five random words, about 64 bits of randomness) in a password manager, or type your own of at least 20 characters. Tick the box, then **Next**.
2. **Set up · step 2 of 3: Connect to GitHub.** Make a token as described in [section 3](#3-the-github-token), paste it in and press **Check and continue**.
3. **Set up · step 3 of 3: Save your recovery code.** Copy the code into *your* password manager. Optionally add your name and phone for supervisors. Tick the box, then **Finish**.
4. The dashboard opens with six empty people and the default shifts. Fill in **People** and **Shifts**, add cards, set the **Backup line** (Print & QR), then **Publish**.

---

## 3. The GitHub token

Publishing saves the data file to GitHub, which needs a token with permission to change this one repository. The token is checked when you add it, stored encrypted inside `contacts.enc.json`, and used automatically whenever anyone publishes.

### Making a token

Sign in to GitHub as **TenarisMcCarty**, then:

1. Open **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token** (direct link: https://github.com/settings/personal-access-tokens/new).
2. **Token name:** `Emergency cards dashboard`. **Expiration:** the longest offered.
3. **Repository access:** **Only select repositories** → `SUCH-Emergency-Contacts`.
4. **Permissions → Repository permissions → Contents → Read and write.** Leave everything else as it is. GitHub adds read-only "Metadata" by itself.
5. **Generate token**, then copy it. It starts with `github_pat_`.
6. Paste it where the dashboard asks: during setup, or **Owner tab → Replace GitHub token**.

The dashboard rejects anything that doesn't look like a token. It then asks GitHub whether the token is valid ("GitHub says this token is not valid" means copy it again).

### When the token expires

Supervisors see *"Publishing won't work right now: the site's GitHub connection has expired. Ask the site owner (your contact) to fix it."* They can keep editing, but nothing publishes. **Cards keep working.**

To fix it:

1. Make a new token (above).
2. Owner link → sign in → **Owner** tab → **Replace GitHub token** → paste → **Check and continue**.
3. **Publish.** The change list shows "Replaced the GitHub token".

Tip: put a reminder in your calendar a week before the token's expiry date.

The Owner tab shows the connection status, plus when the current token was added and by whom.

---

## 4. The recovery code

The recovery code is your master key. With it you can reset the dashboard password even if everyone has forgotten it, and **no card stops working**.

How it works: every time anyone publishes, the dashboard also locks a copy of the admin data for your recovery code. It uses the code's public half, which is stored in the file, so supervisors keep your copy current without ever knowing your code. Only the code itself can open it.

### Making one (or replacing it)

1. Owner link → sign in → **Owner** tab.
2. Under **Recovery code**, the status says either "Set up \<date\>…" or **"No recovery code yet."**
3. Press **Make a new recovery code**. A 43-character code appears.
4. Copy it into **your** password manager. Supervisors never need it.
5. Optionally fill in your name and phone (see [section 5](#5-your-contact-for-supervisors)). Tick **I've saved the recovery code**, then **Finish**.
6. **Publish.** The change list shows "Made a new recovery code". The code only takes effect once published.

Making a new code replaces the old one for everything published from then on. Older versions of the data file in the repository's history can still be opened with the old code; see [Security](security.md#known-limits).

---

## 5. Your contact for supervisors

**Owner tab → Your contact for supervisors.** Type something like `Salil, 555-555-0100` and **Publish**. Supervisors see it whenever something needs you, for example: *"Ask the site owner (Salil, 555-555-0100) to fix it."*

---

## 6. Resetting a forgotten password

1. Open the **owner link**.
2. On the sign-in screen, open **Lost the password?**
3. Paste your recovery code into **Your recovery code** and press **Reset the password**. ("Wrong recovery code." means check it; "This data has no recovery code." means one was never made, so see [section 8](#8-starting-over-last-resort).)
4. **Reset the password:** save the new suggested password, tick the box, then **Next**.
5. The dashboard opens with everything intact. The change list shows "Password reset with the recovery code".
6. **Publish**, then tell the supervisors the new password.

All cards, people and shifts are unchanged.

---

## 7. Taking away someone's access

The password is shared, so removing one person means changing it, and also replacing the GitHub token: anyone who knew the old password could have read the old token out of the data.

1. Owner link → sign in → **Owner** tab → **New password and token**.
2. **Take away access · step 1 of 2:** save the new password, tick the box, then **Next**.
3. **Take away access · step 2 of 2:** make a new GitHub token ([section 3](#3-the-github-token)), paste it in, then **Check and continue**.
4. **Publish.** The change list shows "Changed the password" and "Replaced the GitHub token".
5. On GitHub, delete the **old** token: **Settings → Developer settings → Fine-grained tokens** → the older "Emergency cards dashboard" → **Delete**.
6. Tell the remaining supervisors the new password.

If you think the recovery code may also have leaked, make a new one too ([section 4](#4-the-recovery-code)).

---

## 8. Starting over (last resort)

Use this only if **both** the password and the recovery code are lost.

> **Every existing card stops working**, including any already printed or handed out. Starting over creates new card keys, so every NFC tag must be rewritten and every QR code reprinted.

1. Open the **owner link** → **Lost the password?** → **Start over** → confirm.
2. Follow the three setup steps ([section 2](#2-first-time-setup)).
3. Re-enter people and shifts, add every card again, and **Publish**.
4. Rewrite every NFC tag and reprint every card.

---

## 9. Upgrading data from the first version

The first version of this site used a copy-and-paste editor with a 22-character admin key. If the data was made with it, the sign-in screen says **Upgrade** and asks for the **Old admin key**. After the admin key:

1. **Upgrade · step 1 of 3:** choose the dashboard password.
2. **Upgrade · step 2 of 3:** connect GitHub.
3. **Upgrade · step 3 of 3:** save your recovery code.
4. Set up **Shifts**, then **Publish**.

Contacts and cards carry over, and cards already written keep working. This repository has already been upgraded.

---

## 10. The GitHub repository

- **GitHub Pages** must stay on: repository **Settings → Pages → Source: Deploy from a branch → `main` / root**.
- **Don't edit `contacts.enc.json` by hand.** Only the dashboard writes it. Every publish is a commit titled "Update emergency card data". Names never appear in commit messages, because they're public.
- **Who can push to the repository** can change the website itself. Keep that list to yourself, and keep two-factor authentication on the GitHub account.
- **Every published version is kept** in the repository history. If a publish ever goes badly wrong, the simplest fix is to correct it in the dashboard and publish again. Restoring an older file through GitHub also works, but it brings back that version's password, cards and recovery code too.
- **Code changes** (to the pages themselves): see [Technical reference](technical.md#changing-the-code-safely).
