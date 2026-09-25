---
title: 'Privacy Policy'
description: 'What Drafta stores about your account and your synced notes, and how note content is encrypted.'
updated: '2026-09-25'
---

<!-- OWNER: seller identity and contact are placeholders — see the OWNER-tagged lines below. -->

## What we store

To provide an account and cloud sync, Drafta's server stores:

- your email address;
- your current plan (tariff);
- for each note you sync: its id, the time it was last changed, and the size
  of its encrypted data.

We do not read your notes' content — see "Encryption" below.

## Your account password

Your account password is sent to the server so it can verify your sign-ins.
It is a separate secret from the encryption key described below.

## Encryption of note content

Note content is encrypted on your Mac with AES-256-GCM, using a key derived
from your library password. That key never leaves your Mac and is never sent
to the server; the server only ever holds encrypted note data, which it
cannot read.

## Self-hosting

If you connect Drafta to a CouchDB instance you run yourself, your account
and note data stay on your own server instead of Drafta's, and this policy's
server-side storage section does not apply to that data.

## Account deletion

Deleting your account is **irreversible**: it removes your account and its
cloud copy of your notes from our server. Notes already on your Mac are not
affected and remain there.

## Governing law

<!-- OWNER: jurisdiction placeholder — replace with the seller's actual jurisdiction. -->
This policy is governed by the law of the Russian Federation.

## Contact

<!-- OWNER: contact address placeholder. -->
Questions about your data: [support@drafta.org](mailto:support@drafta.org).

---

*This page is a draft. It has not yet been reviewed by a lawyer and is not
legal advice.*
