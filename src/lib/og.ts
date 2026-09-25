/* Social card for a blog post — BRANDBOOK «OG-изображение сайтов»: 1200×630 on
   paper (--bg), the Drafta lockup top left, the post title in the display-2
   face (Lora 600), a hairline of --accent-glow along the bottom edge, and the
   product accent (--product-drafta) on the mark. Always the paper theme.

   Colours are read from src/styles/tokens.css (the paper block), so the card
   follows the brand file instead of carrying its own hex values. Fonts are the
   static TTFs in scripts/og-fonts/ (satori cannot read the site's woff2), one
   file per family and weight with Latin and Cyrillic inside — two files under
   one family name would silently drop one of them. Build time only. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { Lang } from './types';

export interface OgInput {
  title: string;
  lang: Lang;
  description: string;
}

const ROOT = process.cwd();
const FONT_DIR = join(ROOT, 'scripts/og-fonts');

const CARD = { width: 1200, height: 630 } as const;
/* Card geometry in px of the 1200-wide image (not page CSS, so not tokens). */
const PADDING = 80;
const HAIRLINE = 6;
const MARK_SIZE = 44;
const LOCKUP_GAP = 16;
const BODY_GAP = 24;
const LOCKUP_TEXT = 34;
const TITLE_SIZE = { long: 60, short: 72 } as const;
const TITLE_LONG_AFTER = 48; // characters; longer titles step down a size
const DESCRIPTION_SIZE = 28;
const TITLE_LINES = 3;
const DESCRIPTION_LINES = 2;
const FOOTER_SIZE = 24;
const TRACKING_DISPLAY = -0.02; // em, the display-2 class

const SECTION: Record<Lang, string> = { en: 'drafta.org/blog', ru: 'drafta.org/ru/blog' };

interface Palette {
  bg: string;
  ink: string;
  muted: string;
  glow: string;
  product: string;
}

/** Reads the paper theme's colours from the brand tokens file. */
function paperPalette(): Palette {
  const css = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8');
  const block = css.match(/\[data-theme="paper"\]\s*\{([^}]*)\}/)?.[1];
  if (!block) throw new Error('og: paper theme block not found in src/styles/tokens.css');
  const token = (name: string): string => {
    const value = block.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim();
    if (!value) throw new Error(`og: token --${name} missing from the paper theme`);
    return value;
  };
  return {
    bg: token('bg'),
    ink: token('ink'),
    muted: token('muted'),
    glow: token('accent-glow'),
    product: token('product-drafta'),
  };
}

/** The Drafta mark (public/favicon.svg) drawn in one colour, as a data URI. */
function markDataUri(colour: string): string {
  const svg = readFileSync(join(ROOT, 'public/favicon.svg'), 'utf8');
  if (!svg.includes('class="a"') || !svg.includes('class="b"')) {
    throw new Error('og: public/favicon.svg no longer has the .a/.b paths the card recolours');
  }
  const flat = svg
    .replace(/<style>[\s\S]*?<\/style>/, '')
    .replace('class="a"', `stroke="${colour}"`)
    .replace('class="b"', `stroke="${colour}" opacity="0.55"`);
  return `data:image/svg+xml;base64,${Buffer.from(flat).toString('base64')}`;
}

function font(file: string, name: string, weight: 400 | 600) {
  return { name, data: readFileSync(join(FONT_DIR, file)), weight, style: 'normal' as const };
}

let cachedFonts: ReturnType<typeof font>[] | undefined;
function fonts() {
  cachedFonts ??= [
    font('Lora-SemiBold.ttf', 'Lora', 600),
    font('GolosText-Regular.ttf', 'Golos Text', 400),
    font('GolosText-SemiBold.ttf', 'Golos Text', 600),
  ];
  return cachedFonts;
}

type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, children, ...extra },
});

function card({ title, lang, description }: OgInput, palette: Palette): Node {
  const titleSize = title.length > TITLE_LONG_AFTER ? TITLE_SIZE.long : TITLE_SIZE.short;
  const lockup = el('div', { display: 'flex', alignItems: 'center', gap: LOCKUP_GAP }, [
    el('img', { width: MARK_SIZE, height: MARK_SIZE }, undefined, {
      src: markDataUri(palette.product),
      width: MARK_SIZE,
      height: MARK_SIZE,
    }),
    el('div', { fontFamily: 'Golos Text', fontWeight: 600, fontSize: LOCKUP_TEXT, color: palette.ink }, 'Drafta'),
  ]);
  const body = el('div', { display: 'flex', flexDirection: 'column', gap: BODY_GAP }, [
    el(
      'div',
      {
        display: 'block',
        fontFamily: 'Lora',
        fontWeight: 600,
        lineClamp: TITLE_LINES,
        fontSize: titleSize,
        lineHeight: 1.08,
        letterSpacing: `${TRACKING_DISPLAY}em`,
        color: palette.ink,
      },
      title,
    ),
    el(
      'div',
      {
        display: 'block',
        fontFamily: 'Golos Text',
        fontSize: DESCRIPTION_SIZE,
        lineHeight: 1.4,
        color: palette.muted,
        lineClamp: DESCRIPTION_LINES,
      },
      description,
    ),
  ]);
  const footer = el(
    'div',
    { display: 'flex', fontFamily: 'Golos Text', fontSize: FOOTER_SIZE, color: palette.muted },
    SECTION[lang],
  );
  return el(
    'div',
    {
      width: CARD.width,
      height: CARD.height,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: PADDING,
      backgroundColor: palette.bg,
      borderBottom: `${HAIRLINE}px solid ${palette.glow}`,
    },
    [lockup, body, footer],
  );
}

/** Renders the social card of one post to a 1200×630 PNG. */
export async function renderOg(input: OgInput): Promise<Buffer> {
  const svg = await satori(card(input, paperPalette()) as never, { ...CARD, fonts: fonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: CARD.width } }).render().asPng();
}
