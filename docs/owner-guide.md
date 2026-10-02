# Owner guide

The site owner looks after what supervisors never touch: owner access, the GitHub connection, the supervisors' password and the recovery code. All of it happens on the **owner link**:

**https://tenarismccarty.github.io/SUCH-Emergency-Contacts/dashboard.html#owner**

Bookmark it. On the owner link you sign in with **your own owner password**, not the supervisors' password. Once signed in you get:

- an **Owner** badge in the header and an **Owner** tab
- everything supervisors have (see the [supervisor guide](supervisor-guide.md))
- on the sign-in screen, under **Lost the password?**: the recovery-code reset, reclaiming owner access, and **Start over**

The supervisors' password does **not** work on the owner link and can't open the Owner tab.

**Contents**

1. [The passwords and codes](#1-the-passwords-and-codes)
2. [Setting up owner access on existing data](#2-setting-up-owner-access-on-existing-data)
3. [First-time setup from scratch](#3-first-time-setup-from-scratch)
4. [The GitHub token](#4-the-github-token)
5. [The supervisors' password](#5-the-supervisors-password)
6. [Your owner password](#6-your-owner-password)
7. [The recovery code](#7-the-recovery-code)
8. [Lost both the owner password and the recovery code](#8-lost-both-the-owner-password-and-the-recovery-code)
9. [Taking away someone's access](#9-taking-away-someones-access)
10. [Your contact for supervisors](#10-your-contact-for-supervisors)
11. [Starting over (last resort)](#11-starting-over-last-resort)
12. [Upgrading data from the first version](#12-upgrading-data-from-the-first-version)
13. [The GitHub repository](#13-the-github-repository)

---

## 1. The passwords and codes

| Item | Who has it | Opens | If it's forgotten | If it leaks |
|---|---|---|---|---|
| **Supervisors' password** | Supervisors (and you) | The normal dashboard | You set a new one ([section 5](#5-the-supervisors-password)) | [Take away access](#9-taking-away-someones-access) |
| **Owner password** | **Only you** | The owner link and the Owner tab | Use the recovery code ([section 6](#6-your-owner-password)) | Change it ([section 6](#6-your-owner-password)) |
| **Recovery code** (43 characters) | **Only you**, in your password manager | Same as the owner password; it's the backup | Make a new one while you can still sign in ([section 7](#7-the-recovery-code)) | Make a new one ([section 7](#7-the-recovery-code)) |
| **GitHub token** | Stored encrypted in the data. Nobody needs to see it again. | Publishing | Make a new one ([section 4](#4-the-github-token)) | Delete it on GitHub, make a new one ([section 9](#9-taking-away-someones-access)) |
| **GitHub account** (TenarisMcCarty) | You | The repository, and reclaiming owner access | Recover it through GitHub | Anyone with it can change the website. Keep two-factor authentication on. |

Use the **suggested** passwords (five random words). Your own passwords must be at least 20 characters.

---

## 2. Setting up owner access on existing data

If the data was published before owner passwords existed, the owner link shows **Set up owner access**. This is a one-time step:

1. Open the owner link.
2. **Supervisors' dashboard password:** sign in with it once.
3. **Owner access · step 1 of 2: Choose your owner password.** Save the suggested password in *your* password manager, tick the box, then **Next**.
4. **Owner access · step 2 of 2: Save your recovery code.** Copy the 43-character code into your password manager. Add your name and phone for supervisors if you like. Tick the box, then **Finish**.
5. The dashboard opens with the Owner tab. The change list shows "Set up owner access (your owner password and recovery code)".
6. **Publish.** Until you publish, nothing is saved; **Discard** is hidden in this situation.

From then on, the owner link asks for your **owner password**. Supervisors carry on exactly as before, with the same password.

---

## 3. First-time setup from scratch

> This repository is already set up. You only need this if you [start over](#11-starting-over-last-resort) or set up a new copy.

When there's no data yet, the dashboard starts setup automatically. Whoever completes it becomes the owner.

1. **Set up · step 1 of 4: Choose the supervisors' dashboard password.**
2. **Set up · step 2 of 4: Connect to GitHub.** Paste a token ([section 4](#4-the-github-token)).
3. **Set up · step 3 of 4: Choose your owner password.**
4. **Set up · step 4 of 4: Save your recovery code**, plus your contact details for supervisors.
5. Fill in **People** and **Shifts**, add cards, set the **Backup line** (Print & QR), then **Publish**.

---

## 4. The GitHub token

Publishing saves the data file to GitHub, which needs a token that can change this one repository. The token is checked when you add it, stored encrypted inside `contacts.enc.json`, and used automatically whenever anyone publishes.

### Making a token

Sign in to GitHub as **TenarisMcCarty**, then:

1. Open **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token** (direct link: https://github.com/settings/personal-access-tokens/new).
2. **Token name:** `Emergency cards dashboard`. **Expiration:** the longest offered.
3. **Repository access:** **Only select repositories** → `SUCH-Emergency-Contacts`.
4. **Permissions → Repository permissions → Contents → Read and write.** Leave everything else as it is. GitHub adds read-only "Metadata" by itself.
5. **Generate token**, then copy it. It starts with `github_pat_`.

The dashboard checks three things: the text looks like a token, GitHub accepts it, and it **belongs to the TenarisMcCarty account**. A token from any other account is refused with "This token belongs to GitHub user …".

### When the token expires

Supervisors see *"Publishing won't work right now: the site's GitHub connection has expired. Ask the site owner (your contact) to fix it."* They can keep editing, but nothing publishes. **Cards keep working.**

1. Make a new token (above).
2. Owner link → sign in → **Owner** tab → **Replace GitHub token** → paste → **Check and continue**.
3. **Publish.** The change list shows "Replaced the GitHub token".

Tip: put a reminder in your calendar a week before the expiry date. The Owner tab shows when the current token was added and by whom.

---

## 5. The supervisors' password

You never need to know the current supervisors' password to replace it.

1. Owner link → sign in → **Settings** → **Change password**.
2. Save the new suggested password, tick the box, then **Next**.
3. **Publish.** The old password stops working immediately.
4. Tell the supervisors the new password, in person or by phone.

This is also how you handle "a supervisor forgot the password". Supervisors can change it too, from their own Settings tab.

---

## 6. Your owner password

**Changing it:** Owner link → sign in → **Owner** tab → **Change owner password** → save the new one → **Next** → **Publish**.

**Forgot it?** Use your recovery code:

1. Owner link → **Lost the password?** → paste the code into **Your recovery code** → **Use recovery code**.
   - "Wrong recovery code." means check it.
   - "This data has no recovery code." means owner access was never set up, so see [section 2](#2-setting-up-owner-access-on-existing-data).
2. **Recovery · new owner password:** save the new owner password, tick the box, then **Next**.
3. The dashboard opens as the owner. The change list shows "Changed the owner password". **Publish.**

Nothing else changes: not the supervisors' password, not any card.

---

## 7. The recovery code

The recovery code is your master key, the backup for your owner password.

How it works:

- Every time anyone publishes, the dashboard also locks a copy of the admin data for your recovery code. It uses the code's public half, which is stored in the file. So supervisors keep your copy up to date without ever knowing the code, and only the code itself can open it.
- Your owner password simply unlocks your recovery code.

### Making a new one

1. Owner link → sign in → **Owner** tab → **Make a new recovery code**.
2. Copy the new code into your password manager. Update your contact details if needed, tick the box, then **Finish**.
3. **Publish.** The change list shows "Made a new recovery code".

After you publish, the old code no longer opens anything new. Older versions of the data in the repository's history can still be opened with the old code; see [Security](security.md#known-limits).

---

## 8. Lost both the owner password and the recovery code

You can reclaim owner access with the **supervisors' password** plus a **new GitHub token made on the TenarisMcCarty account**. Only someone who can sign in to that GitHub account can make one. **No cards stop working.**

1. Make a new token on GitHub ([section 4](#4-the-github-token)).
2. Owner link → **Lost the password?** → **Lost the recovery code too?** → type the **supervisors' dashboard password** → **Reclaim owner access**.
3. **Reclaim owner access · step 1 of 3:** paste the new token. The old token, or a token from another account, is refused.
4. **Steps 2 and 3:** choose a new owner password and save a new recovery code.
5. **Publish.** The change list shows "Set up owner access…" and "Replaced the GitHub token".
6. Delete the old token on GitHub (**Settings → Developer settings → Fine-grained tokens**).

If the supervisors' password is lost too, ask a supervisor for it. If nobody knows it, see [section 11](#11-starting-over-last-resort).

---

## 9. Taking away someone's access

The supervisors' password is shared. To remove one person, change it **and** replace the GitHub token, because anyone who knew the old password could have read the old token out of the data.

1. Owner link → sign in → **Owner** tab → **New password and token**.
2. **Step 1 of 2:** save the new supervisors' password, tick the box, then **Next**.
3. **Step 2 of 2:** make a new GitHub token ([section 4](#4-the-github-token)), paste it, then **Check and continue**.
4. **Publish.** The change list shows "Changed the supervisors' password" and "Replaced the GitHub token".
5. On GitHub, delete the **old** token: **Settings → Developer settings → Fine-grained tokens** → the older "Emergency cards dashboard" → **Delete**.
6. Tell the remaining supervisors the new password.

Your owner password and recovery code aren't affected. If you think one of them leaked, change it too ([section 6](#6-your-owner-password), [section 7](#7-the-recovery-code)).

---

## 10. Your contact for supervisors

**Owner tab → Your contact for supervisors.** Type something like `Salil, 555-555-0100` and **Publish**. Supervisors see it whenever something needs you, for example: *"Ask the site owner (Salil, 555-555-0100) to fix it."*

---

## 11. Starting over (last resort)

Use this only if nobody knows the supervisors' password **and** you have neither your owner password nor your recovery code.

> **Every existing card stops working**, including any already printed or handed out. Starting over creates new card keys, so every NFC tag must be rewritten and every QR code reprinted.

1. Owner link → **Lost the password?** → **Start over** → confirm.
2. Follow the four setup steps ([section 3](#3-first-time-setup-from-scratch)).
3. Re-enter people and shifts, add every card again, then **Publish**.
4. Rewrite every NFC tag and reprint every card.

---

## 12. Upgrading data from the first version

The first version of this site used a copy-and-paste editor with a 22-character admin key. If the data was made with it, the sign-in screen says **Upgrade** and asks for the **Old admin key**. Then:

1. **Upgrade · step 1 of 4:** choose the supervisors' password.
2. **Upgrade · step 2 of 4:** connect GitHub.
3. **Upgrade · step 3 of 4:** choose your owner password.
4. **Upgrade · step 4 of 4:** save your recovery code.
5. Set up **Shifts**, then **Publish**.

Contacts and cards carry over, and cards already written keep working. This repository has already been upgraded.

---

## 13. The GitHub repository

- **Keep GitHub Pages on:** repository **Settings → Pages → Source: Deploy from a branch → `main` / root**.
- **Never edit `contacts.enc.json` by hand.** Only the dashboard writes it. Every publish is a commit titled "Update emergency card data". Names never appear in commit messages, because they're public.
- **Limit who can push.** Anyone who can push to the repository can change the website itself, so keep that to yourself. Keep two-factor authentication on the GitHub account.
- **Every published version is kept** in the repository history. If a publish goes badly wrong, the simplest fix is to correct it in the dashboard and publish again. Restoring an older file through GitHub also works, but it brings back that version's passwords, cards and recovery code too.
- **Code changes** (to the pages themselves): see [Technical reference](technical.md#changing-the-code-safely).
