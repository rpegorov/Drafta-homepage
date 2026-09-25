/* The landing's copy, one object per language. Section components render it and
   decide nothing: every string here is final text.

   Fields named `html` (and `*Html`) carry trusted, hand-written inline markup —
   <span class="mono">, <a>, <kbd>-like spans — and are rendered with set:html.
   Everything else is plain text. */

import type { ShotSlot } from '../shots';

export interface Shot {
  slot: ShotSlot;
  alt: string;
  caption: string;
}

export interface Fact {
  title: string;
  html: string;
}

export interface Stat {
  value: string;
  label: string;
  /** Carries the page's one vermilion highlight (brand rule 4). */
  highlight?: boolean;
}

export interface FeatureRow {
  title: string;
  html: string;
  points: string[];
  shot: Shot;
}

export interface SectionHead {
  eyebrow: string;
  title: string;
  lead?: string;
}

export interface FaqItem {
  q: string;
  html: string;
}

export type RoadmapStatus = 'done' | 'progress' | 'planned';

export interface RoadmapItem {
  status: RoadmapStatus;
  statusLabel: string;
  name: string;
  html: string;
}

export interface LandingCopy {
  meta: { title: string; description: string };
  hero: {
    eyebrow: string;
    title: string;
    lead: string;
    download: string;
    pricing: string;
    platform: string;
    shot: Shot;
  };
  factsLabel: string;
  facts: Fact[];
  inside: SectionHead & { rows: FeatureRow[] };
  box: SectionHead & { items: Fact[] };
  security: SectionHead & {
    introHtml: string;
    quote: string;
    quoteSource: string;
    stats: Stat[];
    items: Fact[];
  };
  files: SectionHead & {
    paragraphsHtml: string[];
    points: string[];
    stats: Stat[];
  };
  pricing: SectionHead & {
    trialHtml: string;
    noteHtml: string;
  };
  faq: SectionHead & { items: FaqItem[] };
  roadmap: SectionHead & { items: RoadmapItem[] };
}
