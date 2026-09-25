/* English landing copy. A rewrite of the reference page (c497677:index.html) in
   the brand's voice, not a translation of the Russian page; every fact of the
   reference is kept. */

import { releases } from '../../../lib/config';
import type { LandingCopy } from './types';

const mono = (text: string): string => `<span class="mono" translate="no">${text}</span>`;

export const en: LandingCopy = {
  meta: {
    title: 'Drafta — Markdown notes for programmers on macOS',
    description:
      'A native macOS Markdown editor for programmers. CodeMirror 6, 50+ languages, Mermaid and KaTeX preview, notebooks, tags and revision history. Your notes stay plain .md files. macOS 26 or later, Apple Silicon & Intel.',
  },

  hero: {
    eyebrow: 'Native macOS · CodeMirror 6',
    title: 'A Markdown editor built for programmers.',
    lead:
      'Nested notebooks, highlighting for 50+ languages, Mermaid and KaTeX preview, tags, statuses and revision history with diffs. Every note is a plain .md file with YAML front-matter — any editor opens it, today and in ten years.',
    download: 'Download for macOS',
    pricing: 'See pricing',
    platform: 'macOS 26 or later · Apple Silicon & Intel · Apache-2.0',
    shot: {
      slot: 'editor',
      alt: 'Drafta on macOS: notebooks, statuses and tags in the sidebar, the note list, and a Markdown note open in the editor with line numbers and a table of contents.',
      caption: 'Sidebar, note list and editor in one window.',
    },
  },

  factsLabel: 'Drafta in three facts',
  facts: [
    {
      title: 'Native, not Electron',
      html: 'Swift and SwiftUI, with CodeMirror 6 in a WebKit view. A Mac app with no bundled browser engine.',
    },
    {
      title: 'Your notes are files',
      html: `Plain Markdown with YAML front-matter on your disk. Open it in VS Code, ${mono('grep')} it, keep it for good.`,
    },
    {
      title: 'Apache-2.0',
      html: 'The full app source is public under the Apache License 2.0. No proprietary format holds your notes.',
    },
  ],

  inside: {
    eyebrow: 'What’s inside',
    title: 'Everything a programmer needs from a notes app.',
    rows: [
      {
        title: 'Editor, preview, or both at once',
        html: 'Three view modes, one click apart: the editor, the rendered preview, or split with synchronised scrolling. Tables get a grid picker, Mermaid and KaTeX render live, dashes and spacing are tidied as you type.',
        points: [
          'Editor, preview and split modes',
          'Live preview for tables, Mermaid and KaTeX',
          'Table of contents, backlinks, search with ⌘\u00a0F',
        ],
        shot: {
          slot: 'split',
          alt: 'Drafta in split mode: the Markdown of a release checklist on the left, the rendered checklist with ticked tasks on the right.',
          caption: 'Split mode: your Markdown on the left, the rendered note on the right.',
        },
      },
      {
        title: 'Notebooks, tags, statuses',
        html: 'Notebooks nest as deep as you need. Tags are picked up from the text and can be managed by hand, each with its own colour. A note carries a status — Active, On Hold, Completed, Dropped — so a side project waits its turn instead of being deleted.',
        points: [
          'Nested notebooks, no depth limit',
          'Automatic tags, manual control, a colour per tag',
          'Pinned notes, trash, note statuses',
        ],
        shot: {
          slot: 'notebooks',
          alt: 'The sidebar with nested notebooks, four statuses and tag counts, next to a note whose preview renders a diagram.',
          caption: 'Notebooks nest, statuses sort, tags come from the text.',
        },
      },
      {
        title: 'History you can actually read',
        html: 'Drafta keeps up to 30 revisions per note on your disk — including a copy of the old text whenever an assistant rewrites a note through MCP. Open the unified diff, see what changed, restore any version.',
        points: [
          'Up to 30 revisions per note',
          'Unified diff view',
          'Restore any revision in one click',
        ],
        shot: {
          slot: 'history',
          alt: 'Drafta’s Revision History window: a saved revision on the left and its unified diff against the previous version on the right, with Restore This Version.',
          caption: 'Every revision opens as a diff; one click restores it.',
        },
      },
    ],
  },

  box: {
    eyebrow: 'Shipped in 1.0',
    title: 'Everything in the box',
    lead: 'No feature tiers, no locked panels. This is what the app does today.',
    items: [
      {
        title: 'CodeMirror 6, 50+ languages',
        html: `The editor that also powers <span translate="no">Inkdrop</span>, with highlighting for Python, Rust, TypeScript, Go, SQL, YAML, Bash and forty more. Three view modes — editor, preview, or split with synchronised scrolling. A grid picker for tables, live Mermaid and KaTeX, dashes and spacing tidied as you type. A table of contents, backlinks, a graph of linked notes and search with ${mono('⌘&nbsp;F')}. ${mono('$…$')} fences work as you would expect.`,
      },
      {
        title: 'A library you can steer',
        html: `Notebooks nest without limit, and notes drag between them. Tags come from the text automatically, by hand where you want, with a colour each. Statuses — Active, On Hold, Completed, Dropped — pinned notes and trash stay a keystroke away: ${mono('⌘&nbsp;P')} is fuzzy search across every note.`,
      },
      {
        title: 'Your history and your skins',
        html: 'Up to 30 revisions per note, a unified diff and one-click restore. Eleven themes ship: five signature ones — Graphite &amp; Ochre, Vellum, Fjord, Phosphor, Amethyst Glass — plus Default Light, Default Dark, Drafta Dark, Dark Islands, Tokyo Night and Solarized Dark. A JSON theme of your own drops straight in.',
      },
      {
        title: 'In and out, on your terms',
        html: `Import ${mono('.md')} and ${mono('.html')} (Bear format); export PDF, DOCX, HTML or Markdown, with local images carried along as attachments. Updates arrive on their own: Sparkle checks once a day, or on demand from Drafta → Check for Updates…`,
      },
      {
        title: 'An assistant, and an MCP server',
        html: `${mono('⌘&nbsp;J')} opens the assistant with your own API key: Anthropic (${mono('claude-haiku-4-5')}), OpenAI (${mono('gpt-4o-mini')}) or DeepSeek (${mono('deepseek-chat')}). The MCP server ships inside the app and gives Claude and other MCP clients 12 tools to search, read and write your whole library. Run it read-only and the write tools disappear.`,
      },
    ],
  },

  security: {
    eyebrow: 'Security',
    title: 'Encrypted on the way up, plain files on your disk.',
    introHtml:
      'Both halves are the promise: I cannot read the copy in the cloud, and the copy on your Mac is yours to open, read and keep.',
    quote: 'Unreadable in the cloud. Ordinary Markdown on your Mac.',
    quoteSource: 'The same promise, kept twice',
    stats: [
      { value: 'AES-256-GCM', label: 'notes sealed on your Mac before they are sent' },
      { value: '2', label: 'passwords: one signs you in, the library one never leaves your Mac' },
    ],
    items: [
      {
        title: 'End-to-end encrypted sync',
        html: 'Notes are sealed with AES-256-GCM on your Mac before they are sent, under a key derived from your library password through PBKDF2-HMAC-SHA256. The service stores ciphertext and never holds the key. Those are the exact primitives — check them.',
      },
      {
        title: 'Two passwords, two jobs',
        html: 'Your account password signs you in and goes to the server over TLS, like any sign-in. Your library password is separate, never leaves your Mac, and is where the encryption key comes from. The server can tell it is you; it cannot decrypt your notes.',
      },
      {
        title: 'What the cloud can see',
        html: 'Your account email and plan. For each note: its id, its last-updated time — which decides last-writer-wins between your Macs — and the size of the encrypted payload. Title, body, tags and attachments stay ciphertext.',
      },
      {
        title: 'On your disk: ordinary Markdown',
        html: `The library on your Mac stays plain Markdown files. Encryption protects the sync path, not your disk — ${mono('grep')}, ${mono('git')} and Obsidian keep working, and FileVault protects the disk itself.`,
      },
      {
        title: 'A library password nobody can reset',
        html: 'The server never had it, so nobody can recover it for you. Your notes on this Mac stay readable files either way; the encrypted cloud copy opens only with that password.',
      },
      {
        title: 'Two places for the cloud copy',
        html: 'Cloud storage through your Drafta account is the default, and it is what the plan covers. Connect your own CouchDB instead and it stores with no quota — locally or on a server you control.',
      },
    ],
  },

  files: {
    eyebrow: 'Local first',
    title: 'Your notes are files, not rows in someone’s database.',
    paragraphsHtml: [
      'Drafta keeps the library on your disk: one Markdown file per note, YAML front-matter for tags and status, revisions in a folder beside it. No closed format stands between you and your writing, and changing plan cannot strand it. The cloud copy is encrypted under a key you hold, not the service — so it stays yours off your disk too.',
      `Plain text means your toolchain already works: ${mono('grep')} across everything, commit the library to git, open a note in VS Code or Obsidian, ${mono('cat')} it in a terminal. Drafta is a native Swift app — no Electron runtime underneath and no bundled browser to keep hot.`,
    ],
    points: [
      'Plain Markdown with YAML front-matter on your disk',
      'Up to 30 revisions per note, stored locally',
      'No proprietary database, no export-only escape hatch',
      'Version control, grep and any other editor keep working',
      'Licensed under Apache-2.0',
    ],
    stats: [
      { value: '30', label: 'revisions per note kept on disk' },
      { value: '0', label: 'proprietary databases' },
      { value: '50+', label: 'languages highlighted' },
      { value: '.md', label: 'what every note stays', highlight: true },
    ],
  },

  pricing: {
    eyebrow: 'Pricing',
    title: 'One plan, everything included.',
    lead: 'Monthly or annual billing for the same app. Every new account starts with a 30-day trial — no card needed.',
    trialHtml:
      '<strong>30-day trial on every new account</strong> — no card required. When it ends, the app turns read-only until you pick a billing period, monthly or yearly: every note stays on your Mac and stays readable. There is no second tier and no lifetime licence. Card payment is not connected yet, so nothing is charged today.',
    noteHtml:
      'The plan includes the full app: CodeMirror 6 editor, notebooks, tags, statuses, revision history, themes, import and export. The two billing periods differ in how you pay, not in what you get. Prices are in US dollars.',
  },

  faq: {
    eyebrow: 'FAQ',
    title: 'Questions worth answering',
    items: [
      {
        q: 'What does Drafta require?',
        html: 'macOS 26 or later, on Apple Silicon or Intel. It is a native Swift and SwiftUI app — not a web app, not an Electron shell.',
      },
      {
        q: 'How do I install it?',
        html: `Download the DMG from the <a href="${releases}">latest release</a>, open it and drag ${mono('Drafta.app')} into Applications. The build is not notarised yet, so macOS blocks the first launch: open System Settings → Privacy &amp; Security, scroll to the message about Drafta, click <strong>Open Anyway</strong> and confirm. macOS asks only once.`,
      },
      {
        q: 'How do updates work?',
        html: `They arrive by themselves. Sparkle checks ${mono('drafta.org/appcast.xml')} once a day; Drafta → Check for Updates… does it on demand.`,
      },
      {
        q: 'Is there a trial, and does it need a card?',
        html: 'Every new account gets 30 days, and no card is needed to start. When the trial ends, Drafta turns read-only: you can open, search and read every note, while creating, editing and exporting wait for a plan — monthly or yearly. Card payment is not connected yet.',
      },
      {
        q: 'Where do my notes live?',
        html: 'On your disk: one Markdown file per note with YAML front-matter, revisions in a folder beside them. Nothing in the storage format is proprietary — stop using Drafta and your notes still open anywhere.',
      },
      {
        q: 'Do I need an account to use the app?',
        html: 'Yes. The account starts your trial, carries your plan and — unless you connect your own CouchDB — keeps an encrypted cloud copy of your notes. Its password only signs you in; the notes are encrypted with a separate library password that stays on your Mac.',
      },
      {
        q: 'What does a plan include?',
        html: 'There is one plan, paid monthly or yearly. The cards above show storage and note limits read from the accounts API, so this page never quotes a quota the service does not enforce.',
      },
      {
        q: 'Is my data encrypted?',
        html: 'On the way to the cloud, yes — end to end. Notes are sealed with AES-256-GCM on your Mac under a key derived from your library password through PBKDF2-HMAC-SHA256. The boundary, precisely: this protects the sync path, not your disk. The library on your Mac stays ordinary Markdown files any editor reads; FileVault protects the disk.',
      },
      {
        q: 'Can you read my notes?',
        html: 'Not the synced copy. There are two passwords: the account password goes to the server to sign you in; the library password never leaves your Mac, and the encryption key comes from it. The server can authenticate you, but it stores only ciphertext and has no key to open it. For each note it sees the id, the last-updated time — which decides last-writer-wins between your Macs — and the size of the encrypted payload.',
      },
      {
        q: 'What if I forget my library password?',
        html: 'I cannot reset it: it never reached the server. The notes on your Mac stay plain Markdown files, but the encrypted cloud copy opens only with that password — keep it in a password manager.',
      },
      {
        q: 'Which AI providers does the assistant use?',
        html: `The one you bring a key for: Anthropic (${mono('claude-haiku-4-5')}), OpenAI (${mono('gpt-4o-mini')}) or DeepSeek (${mono('deepseek-chat')}). Keys are stored in the macOS Keychain.`,
      },
      {
        q: 'What can the MCP server do?',
        html: 'It ships inside the app and gives Claude and other MCP clients 12 tools over your whole library: search and read notes, list notebooks and tags, read the formatting guide; create, append to, update, tag, re-status and trash notes; create notebooks. A rewrite keeps the previous text as a revision. Want an assistant that only looks? Run the server read-only and the write tools disappear.',
      },
      {
        q: 'Where is my data stored?',
        html: 'In two places, both yours. Locally: plain Markdown files in your library folder, plus revisions. In the cloud: storage through your Drafta account by default, and that is what the plan’s quota covers. Rather not use it? Connect your own CouchDB — no quota, locally or on your own server.',
      },
      {
        q: 'What if I use a PC or Linux?',
        html: 'Not yet. macOS is available today; Windows and Linux are planned on Rust and Tauri. That lives in the <a href="#roadmap">roadmap</a>, not in the app.',
      },
    ],
  },

  roadmap: {
    eyebrow: 'Roadmap',
    title: 'What’s next, stated plainly',
    lead: 'Where things stand, including the parts that are not finished.',
    items: [
      {
        status: 'done',
        statusLabel: 'Available',
        name: 'macOS app',
        html: 'the full editor: CodeMirror 6, notebooks, tags, statuses, themes, revision history, import and export, AI assistant, MCP server, cloud sync and your own CouchDB, auto-update.',
      },
      {
        status: 'progress',
        statusLabel: 'In progress',
        name: 'Notarisation and Developer ID',
        html: 'removes the Open Anyway step on first launch. Until it lands, the DMG is not notarised and macOS asks you to confirm once.',
      },
      {
        status: 'progress',
        statusLabel: 'In progress',
        name: 'iOS',
        html: 'an iOS target alongside macOS. Not released, and I will not put a date on it before it is done.',
      },
      {
        status: 'planned',
        statusLabel: 'Planned',
        name: 'Windows and Linux',
        html: 'a Rust and Tauri build. Planned, not started; the macOS app comes first.',
      },
    ],
  },
};
