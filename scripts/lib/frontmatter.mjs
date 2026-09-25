// Front matter contract shared by the site (src/content.config.ts) and the
// Drafta exporter (scripts/import-from-drafta.mjs, wave 2.2). Both sides
// import this module — the site to know what a valid document looks like via
// its zod schemas, the exporter to produce it. Keep the two in sync: any key
// added here must be mirrored in content.config.ts's schemas.
//
// Pure functions only: no filesystem, no Astro runtime. Importable from plain
// Node (tests, the exporter) without pulling in Astro.

export const KEYS = {
  blog: [
    'title',
    'description',
    'lang',
    'slug',
    'date',
    'updated',
    'draftaId',
    'tags',
    'cover',
    'machineTranslated',
    'translation',
  ],
  docs: [
    'title',
    'description',
    'lang',
    'slug',
    'updated',
    'draftaId',
    'order',
    'machineTranslated',
    'translation',
    'banner',
  ],
};

const FRONTMATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function yamlScalar(value) {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  throw new TypeError(`Unsupported YAML scalar: ${String(value)}`);
}

function yamlStringArray(values) {
  if (values.length === 0) return '[]';
  return `[${values.map((value) => JSON.stringify(value)).join(', ')}]`;
}

function pushTranslation(lines, translation) {
  if (!translation) return;
  lines.push('translation:');
  lines.push(`  sourceHash: ${yamlScalar(translation.sourceHash)}`);
  lines.push(`  sourceLang: ${yamlScalar(translation.sourceLang)}`);
  lines.push(`  provider: ${yamlScalar(translation.provider)}`);
  lines.push(`  model: ${yamlScalar(translation.model)}`);
  lines.push(`  at: ${yamlScalar(translation.at)}`);
}

/**
 * Renders front matter for a blog post (src/content/blog/<lang>/<slug>.md).
 * The output must validate against the `blog` collection schema in
 * content.config.ts.
 */
export function renderBlogFrontmatter({
  title,
  description,
  lang,
  slug,
  date,
  updated,
  draftaId,
  tags,
  cover,
  machineTranslated,
  translation,
}) {
  const lines = [
    '---',
    `title: ${yamlScalar(title)}`,
    `description: ${yamlScalar(description)}`,
    `lang: ${yamlScalar(lang)}`,
    `slug: ${yamlScalar(slug)}`,
    `date: ${yamlScalar(date)}`,
    `updated: ${yamlScalar(updated)}`,
    `draftaId: ${yamlScalar(draftaId)}`,
    `tags: ${yamlStringArray(tags ?? [])}`,
  ];
  if (cover !== undefined) lines.push(`cover: ${yamlScalar(cover)}`);
  if (machineTranslated !== undefined) lines.push(`machineTranslated: ${yamlScalar(machineTranslated)}`);
  pushTranslation(lines, translation);
  lines.push('---', '');
  return lines.join('\n');
}

/**
 * Renders front matter for a docs page (src/content/docs/**\/<slug>.md).
 * `order` becomes Starlight's `sidebar: { order }`. The output must validate
 * against the extended `docs` collection schema in content.config.ts.
 */
export function renderDocsFrontmatter({
  title,
  description,
  lang,
  slug,
  updated,
  draftaId,
  order,
  machineTranslated,
  translation,
  banner,
}) {
  const lines = ['---', `title: ${yamlScalar(title)}`, `description: ${yamlScalar(description)}`];
  if (lang !== undefined) lines.push(`lang: ${yamlScalar(lang)}`);
  if (slug !== undefined) lines.push(`slug: ${yamlScalar(slug)}`);
  if (updated !== undefined) lines.push(`updated: ${yamlScalar(updated)}`);
  if (draftaId !== undefined) lines.push(`draftaId: ${yamlScalar(draftaId)}`);
  if (order !== undefined) {
    lines.push('sidebar:');
    lines.push(`  order: ${yamlScalar(order)}`);
  }
  if (machineTranslated !== undefined) lines.push(`machineTranslated: ${yamlScalar(machineTranslated)}`);
  pushTranslation(lines, translation);
  if (banner !== undefined) {
    lines.push('banner:');
    lines.push(`  content: ${yamlScalar(banner.content)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

/**
 * Splits a Markdown document into its front matter data and body. Only
 * understands the flat/nested-object shapes this module itself produces
 * (scalars, string arrays, and the two-level `translation`/`banner`/`sidebar`
 * objects) — it is not a general YAML parser.
 */
export function parseFrontmatter(text) {
  const match = FRONTMATTER_BLOCK.exec(text);
  if (!match) return { data: {}, body: text };

  const [, block, body] = match;
  const data = {};
  const lines = block.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || /^\s/.test(line)) {
      i += 1;
      continue;
    }
    const keyMatch = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!keyMatch) {
      i += 1;
      continue;
    }
    const [, key, rest] = keyMatch;
    if (rest.trim() === '') {
      // Nested object: following indented lines are its fields.
      const nested = {};
      i += 1;
      while (i < lines.length && /^\s+\S/.test(lines[i])) {
        const nestedMatch = /^\s+([A-Za-z0-9_]+):\s*(.*)$/.exec(lines[i]);
        if (nestedMatch) nested[nestedMatch[1]] = parseScalar(nestedMatch[2]);
        i += 1;
      }
      data[key] = nested;
      continue;
    }
    data[key] = parseScalar(rest);
    i += 1;
  }
  return { data, body };
}

function parseScalar(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => parseScalar(item.trim()));
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}
