// Turns GitHub-style callout blockquotes into <aside class="callout callout--<kind>">.
//
//   > [!NOTE]
//   > text
//
// becomes an <aside> with a heading (the callout's label) followed by the
// blockquote's remaining content. A blockquote whose first line does not
// match one of the known markers is left untouched, so plain quotes are
// unaffected.
//
// Registered as a remark plugin in astro.config.mjs so it runs for both the
// blog collection and Starlight's docs (both go through the same Astro
// markdown pipeline).
import { visit } from 'unist-util-visit';

const MARKER = /^\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*$/;

const LABELS = {
  NOTE: 'Note',
  TIP: 'Tip',
  WARNING: 'Warning',
  IMPORTANT: 'Important',
  CAUTION: 'Caution',
};

function markerFromFirstParagraph(node) {
  const [first] = node.children;
  if (!first || first.type !== 'paragraph') return null;
  const [firstText, ...rest] = first.children;
  if (!firstText || firstText.type !== 'text') return null;

  const lines = firstText.value.split('\n');
  const match = MARKER.exec(lines[0]);
  if (!match) return null;

  // Strip the marker line from the paragraph; keep whatever text followed it
  // on the same line (rare, but valid Markdown) plus the rest of the node.
  const remainder = lines.slice(1).join('\n');
  const remainingChildren = [...rest];
  if (remainder) remainingChildren.unshift({ type: 'text', value: remainder });
  first.children = remainingChildren;

  return { kind: match[1], paragraphEmptied: remainingChildren.length === 0 };
}

export function remarkCallouts() {
  return function transformer(tree) {
    visit(tree, 'blockquote', (node) => {
      const marker = markerFromFirstParagraph(node);
      if (!marker) return;

      const kind = marker.kind.toLowerCase();
      const bodyChildren = marker.paragraphEmptied ? node.children.slice(1) : node.children;

      node.data = node.data || {};
      node.data.hName = 'aside';
      node.data.hProperties = { className: ['callout', `callout--${kind}`] };
      node.children = [
        {
          type: 'paragraph',
          data: { hName: 'p', hProperties: { className: ['callout__title'] } },
          children: [{ type: 'text', value: LABELS[marker.kind] }],
        },
        ...bodyChildren,
      ];
    });
  };
}

export default remarkCallouts;
