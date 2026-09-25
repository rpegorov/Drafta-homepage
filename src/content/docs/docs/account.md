---
title: Account and trial
description: A Drafta account is required. It uses two passwords, starts a 30-day trial and turns the app read-only when the trial ends without a plan.
sidebar:
  order: 2
---

## The account is required

You need a Drafta account to use the app. You register with an email and a password and confirm the address from the letter Drafta sends; confirming the address is what activates the account.

The account starts your trial, carries your plan and — unless you connect your own CouchDB — keeps an encrypted cloud copy of your notes.

## Two passwords

- **Account password** signs you in. It goes to the server over TLS, like any sign-in.
- **Library password** is separate. It never leaves your Mac, and the encryption key for your notes comes from it.

So the server can tell it is you, but it cannot decrypt your notes.

:::caution[Nobody can reset the library password]
The server never had it, so it cannot be recovered. The notes on your Mac stay plain Markdown files either way, but the encrypted cloud copy opens only with that password. Keep it in a password manager.
:::

## Trial and read-only mode

Every new account gets a 30-day trial, no card required. When it ends without a plan, Drafta becomes read-only: you can open, search and read every note, while creating, editing and exporting wait for a plan — monthly or yearly.

There is one plan; the two billing periods differ in how you pay, not in what you get. Card payment is not connected yet, so nothing is charged today.
