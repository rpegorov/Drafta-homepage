---
title: Encryption
description: Notes are sealed with AES-256-GCM on your Mac under a key derived with PBKDF2-HMAC-SHA256; the server stores only ciphertext.
sidebar:
  order: 4
---

## End-to-end encrypted sync

Notes are sealed with **AES-256-GCM** on your Mac before they are sent, under a key that comes from your library password through **PBKDF2-HMAC-SHA256**. The service stores ciphertext and never holds the key.

## What the server sees

- your account email and plan;
- for each note: its id, its last-updated time and the size of the encrypted payload.

Title, body, tags and attachments stay ciphertext.

## The boundary

Encryption protects the sync path, not your disk. The library on your Mac stays ordinary Markdown files — `grep`, git and other editors keep working. FileVault is what protects the disk itself.

## The library password

The key comes from your library password, which never leaves your Mac. Nobody can reset it for you — see [Account and trial](/docs/account/).
