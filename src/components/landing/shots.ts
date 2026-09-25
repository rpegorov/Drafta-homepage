/* The four product screenshots of the landing (PLAN v2 §12), processed by
   astro:assets. A slot name is the only thing copy and components share. */

import type { ImageMetadata } from 'astro';
import editor from '../../assets/screenshots/editor.png';
import split from '../../assets/screenshots/split.png';
import notebooks from '../../assets/screenshots/notebooks.png';
import history from '../../assets/screenshots/history.png';

export const SHOTS = { editor, split, notebooks, history } satisfies Record<string, ImageMetadata>;

export type ShotSlot = keyof typeof SHOTS;

/** srcset candidates, px; the source is 2400 wide (a 1200 pt window at 2x). */
export const SHOT_WIDTHS = [480, 800, 1200, 1600, 2400];

/* `sizes` per layout: the hero shot spans the page column, a feature-row shot
   takes the media column. Both collapse to the viewport minus the phone gutter
   below the site's single 820px breakpoint (site.css). */
export const SHOT_SIZES = {
  hero: '(max-width: 820px) calc(100vw - 2rem), min(calc(100vw - 3rem), 1092px)',
  row: '(max-width: 820px) calc(100vw - 2rem), 520px',
} as const;

export type ShotLayout = keyof typeof SHOT_SIZES;
