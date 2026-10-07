---
title: 'Privacy Policy'
description: 'What Drafta stores about your account and your synced notes, and how note content is encrypted.'
updated: '2026-10-07'
noindex: true
owner:
  - 'jurisdiction (Russian law) is pending confirmation; the text is not reviewed by a lawyer.'
  - 'support@drafta.org works only once mail is set up on the domain.'
---

## What we store

To provide an account and cloud sync, Drafta's server stores:

- your email address;
- your current plan (tariff);
- for each note you sync: its id, the time it was last changed, and the size
  of its encrypted data.

We do not read your notes' content — see "Encryption" below.

## Payment

Payments are taken by the Robokassa payment service. Your card details are
entered on its side; we neither receive nor store them, and only get the
confirmation of the payment and its amount.

## Your account password

Your account password is sent to the server so it can verify your sign-ins.
It is a separate secret from the encryption key described below.

## Encryption of note content

Note content is encrypted on your Mac with AES-256-GCM, using a key derived
from your library password. That key never leaves your Mac and is never sent
to the server; the server only ever holds encrypted note data, which it
cannot read.

## Self-hosting

If you connect Drafta to a CouchDB instance you run yourself, your notes are
stored on your own server instead of Drafta's. Your account — email, plan and
subscription status — is still stored by the Drafta service, and an account is
still required.

## Account deletion

Deleting your account is **irreversible**: it removes your account and its
cloud copy of your notes from our server. Notes already on your Mac are not
affected and remain there.

## Governing law

This policy is governed by the law of the Russian Federation.

## Contact

The data operator is Rostislav Pavlovich Egorov, self-employed, INN 110117757200.
Questions about your data: [support@drafta.org](mailto:support@drafta.org).

---

*This page is a draft. It has not yet been reviewed by a lawyer and is not
legal advice.*
