# Owner guide

The site owner looks after what supervisors never touch: who can sign in, owner access, the GitHub connection, the shared supervisors' password and the recovery code. All of it happens on the **owner link**:

**https://tenarismccarty.github.io/SUCH-Emergency-Contacts/dashboard.html#owner**

Bookmark it. On the owner link you sign in with **your own owner password**, not the supervisors' password. Once signed in you get:

- an **Owner** badge in the header and an **Owner** tab, starting with **People who can sign in** ([section 14](#14-people-who-can-sign-in))
- everything supervisors have (see the [supervisor guide](supervisor-guide.md))
- on the sign-in screen, under **Forgot owner password?**: the recovery-code reset, reclaiming owner access, and **Start over**

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
14. [People who can sign in](#14-people-who-can-sign-in)
15. [Switching off the shared password](#15-switching-off-the-shared-password)
16. [Moving to personal sign-ins (once)](#16-moving-to-personal-sign-ins-once)

---

## 1. The passwords and codes

| Item | Who has it | Opens | If it's forgotten | If it leaks |
|---|---|---|---|---|
| **Personal sign-in** (email + password) | One supervisor each | The normal dashboard; History shows their name | You reset it ([section 14](#14-people-who-can-sign-in)) | Reset it, and replace the GitHub token ([section 14](#14-people-who-can-sign-in)) |
| **Shared supervisors' password** | Supervisors (and you), until you switch it off | The normal dashboard, with Email left empty | You set a new one ([section 5](#5-the-supervisors-password)) | [Take away access](#9-taking-away-someones-access) |
| **Owner password** | **Only you** | The owner link and the Owner tab | Use the recovery code ([section 6](#6-your-owner-password)) | Change it **and** make a new recovery code ([section 7](#7-the-recovery-code)): old versions of the data stay public, and the old owner password still opens the code in them |
| **Recovery code** (43 characters) | **Only you**, in your password manager | Same as the owner password; it's the backup | Make a new one while you can still sign in ([section 7](#7-the-recovery-code)) | Make a new one ([section 7](#7-the-recovery-code)) |
| **GitHub token** | Stored encrypted in the data. Nobody needs to see it again. | Publishing | Make a new one ([section 4](#4-the-github-token)) | Delete it on GitHub, make a new one ([section 9](#9-taking-away-someones-access)) |
| **GitHub account** (TenarisMcCarty) | You | The repository, and reclaiming owner access | Recover it through GitHub | Anyone with it can change the website. Keep two-factor authentication on. |

Use the **suggested** passwords (five random words). Your own passwords must be at least 20 characters.

---

## 2. Setting up owner access on existing data

If the data was published before owner passwords existed, the owner link shows **Set up owner access**. This is a one-time step:

1. Open the owner link.
2. **Supervisors' dashboard password:** sign in with it once. (If people already have their own sign-in, you can use one of those instead.)
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

This is the one password supervisors share. They sign in with it by leaving **Email** empty. Once everyone has their own sign-in ([section 14](#14-people-who-can-sign-in)), you can switch it off ([section 15](#15-switching-off-the-shared-password)).

You never need to know the current shared password to replace it.

1. Owner link → sign in → **Settings** → **Change the shared password**.
2. Save the new suggested password, tick the box, then **Next**.
3. **Publish.** The old password stops working immediately. Personal sign-ins aren't affected.
4. Tell the supervisors who use it the new password, in person or by phone.

This is also how you handle "a supervisor forgot the shared password". Anyone signed in with the shared password can change it too, from their own Settings tab. (Someone who forgot their **own** password: reset it, [section 14](#14-people-who-can-sign-in).)

---

## 6. Your owner password

**Changing it:** Owner link → sign in → **Owner** tab → **Change owner password** → save the new one → **Next** → **Publish**.

**Forgot it?** Use your recovery code:

1. Owner link → **Forgot owner password?** → paste the code into **Recovery code** → **Use recovery code**.
   - "Wrong recovery code." means check it.
   - "This data has no recovery code." means owner access was never set up, so see [section 2](#2-setting-up-owner-access-on-existing-data).
2. **Recovery · new owner password:** save the new owner password, tick the box, then **Next**.
3. The dashboard opens as the owner. The change list shows "Changed the owner password". **Publish.**

Nothing else changes: not the supervisors' password, not any card.

---

## 7. The recovery code

The recovery code is your master key, the backup for your owner password.

How it works:

- Every time anyone publishes, the dashboard also locks that version's admin key for your recovery code. It uses the code's public half, which is stored in the file. So supervisors keep your way in up to date without ever knowing the code, and only the code itself can use it.
- Your owner password simply unlocks your recovery code.

### Making a new one

1. Owner link → sign in → **Owner** tab → **Make a new recovery code**.
2. Copy the new code into your password manager. Update your contact details if needed, tick the box, then **Finish**.
3. **Publish.** The change list shows "Made a new recovery code".

After you publish, the old code no longer opens anything new. Older versions of the data in the repository's history can still be opened with the old code; see [Security](security.md#known-limits).

---

## 8. Lost both the owner password and the recovery code

You can reclaim owner access with a **supervisor sign-in** (a personal email and password, or the shared supervisors' password) plus a **new GitHub token made on the TenarisMcCarty account**. Only someone who can sign in to that GitHub account can make one. **No cards stop working.**

1. Make a new token on GitHub ([section 4](#4-the-github-token)).
2. Owner link → **Forgot owner password?** → **Lost the recovery code too?** → type the email and password of a personal sign-in, or leave **Email** empty and type the shared password → **Reclaim owner access**. (The Email box only appears once someone has a personal sign-in.)
3. **Reclaim owner access · step 1 of 3:** paste the new token. The old token, or a token from another account, is refused.
4. **Steps 2 and 3:** choose a new owner password and save a new recovery code.
5. **Publish.** The change list shows "Set up owner access…" and "Replaced the GitHub token".
6. Delete the old token on GitHub (**Settings → Developer settings → Fine-grained tokens**).

If you have no sign-in of your own, ask a supervisor to type theirs for you. If nobody can sign in at all, see [section 11](#11-starting-over-last-resort).

---

## 9. Taking away someone's access

**Someone with their own sign-in:** remove it and replace the GitHub token ([section 14, Removing someone](#removing-someone)). If they also know the shared password, do the steps below as well.

**Someone who knows the shared password:** the shared password is shared. To remove one person, change it **and** replace the GitHub token, because anyone who knew the old password could have read the old token out of the data. (If the shared password is switched off, this button only replaces the token.)

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

Use this only if nobody can sign in (no shared password, no personal sign-in) **and** you have neither your owner password nor your recovery code.

> **Every existing card stops working**, including any already printed or handed out. Starting over creates new card keys, so every NFC tag must be rewritten and every QR code reprinted.

1. Owner link → **Forgot owner password?** → **Start over** → confirm.
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

---

## 14. People who can sign in

Each supervisor can have their own sign-in: their email and their own password. History then shows their name automatically. Nobody needs anyone else's password, and you can take one person's access away without changing anything for the others.

It's all on the owner link → **Owner** tab → **People who can sign in**. Each person shows a status: **Active**, **Not signed in yet** (still on the temporary password), or **Not published yet**.

### Adding someone

1. Type their **Email** and their **Name**, the way History should show it (e.g. `Jane Doe`) → **Add person**.
2. **Temporary password for Jane Doe:** copy it (five random words), tick **I've copied it or written it down**, then **Done**. It's shown only this once. **Cancel** adds nobody.
3. **Publish.** The change list shows "Added a sign-in for Jane Doe (…)". Until you publish, the temporary password doesn't work.
4. Give them the normal dashboard link, their email and the temporary password, in person or by phone. Never by email or chat.
5. At their first sign-in they must choose their own password, then publish it. Until they publish, only the temporary password works.

### Resetting a password

1. **Reset password** next to them → confirm.
2. Copy the new temporary password, tick the box, **Done**, then **Publish**. Their old password stops working.
3. Give them the temporary password in person or by phone. They choose a new one when they sign in.

### Reset emails

The sign-in screen's **Forgot password?** link writes an email to **salil@tenaris.com**, with the email the person typed and a request to reset. Nothing checks that it really comes from them, so confirm it first (e.g. call them). Then reset their password (above) and give them the temporary password in person or by phone. Never reply with it by email.

### Removing someone

1. **Remove** next to them → confirm. The change list shows "Removed the sign-in for …".
2. The Owner tab then reminds you to replace the GitHub token, because they could have seen it while signed in. Press **Replace GitHub token** and paste a new one ([section 4](#4-the-github-token)).
3. **Publish.** They can't open anything published from then on.
4. On GitHub, delete the **old** token (**Settings → Developer settings → Fine-grained tokens**).
5. If they also know the shared password, change it too, or switch it off ([section 9](#9-taking-away-someones-access), [section 15](#15-switching-off-the-shared-password)).

What they saw before stays seen: older versions of the data in the repository history, and any card links they copied (a card link always shows the contact list, like any card). See [Security](security.md#known-limits).

---

## 15. Switching off the shared password

Once everyone has their own sign-in, switch off the shared supervisors' password, so only personal sign-ins (and you, on the owner link) can get in.

1. Check that every supervisor is listed under **People who can sign in** and shows **Active**.
2. **Owner** tab → **Shared supervisors' password** → **Turn off the shared password** → confirm. This is only possible once at least one person has their own sign-in.
3. The Owner tab reminds you to replace the GitHub token, because anyone who knew the shared password could have seen it. Do that ([section 4](#4-the-github-token)).
4. **Publish.** The change list shows "Switched off the shared password". From then on, signing in with Email empty says *"The shared supervisors' password is switched off."*

**Switching it back on:** **Owner** tab → **Set a new shared password** → save it → **Next** → **Publish**. The old shared password doesn't come back; tell supervisors the new one.

You can always get in on the owner link, whatever happens to the other sign-ins. Publishing is refused if nobody but you could sign in.

---

## 16. Moving to personal sign-ins (once)

The first publish with this version of the dashboard saves the data file in a new format (version 4). The shared password, your owner password, your recovery code and every card keep working.

1. After the new code goes live, wait **10 minutes** (GitHub's cache), so nobody is still running the old dashboard.
2. Owner link → sign in → add each supervisor ([section 14](#14-people-who-can-sign-in)) → **Publish**.
3. Give each one their temporary password. Each signs in on the normal link, chooses a password and publishes.
4. When everyone shows **Active**, switch off the shared password and replace the GitHub token ([section 15](#15-switching-off-the-shared-password)).

Right after an update, a browser may briefly still run the old dashboard. If it asks for an **Old admin key**, says the password is wrong, or says *"The dashboard was just updated"*, wait a few minutes and reload. The old dashboard can't change the new file.
