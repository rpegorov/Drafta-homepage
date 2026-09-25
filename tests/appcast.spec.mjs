// The Sparkle update feed: installed apps read /appcast.xml for updates, and
// scripts/release.sh in the Drafta repo writes public/appcast.xml.
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const SPARKLE_NS = 'http://www.andymatuschak.org/xml-namespaces/sparkle';
const FEED = new URL('../public/appcast.xml', import.meta.url);

const parse = () => new new JSDOM('').window.DOMParser().parseFromString(readFileSync(FEED, 'utf8'), 'application/xml');

describe('appcast', () => {
  it('[+] is well-formed XML: an RSS channel with the Sparkle namespace', () => {
    const doc = parse();
    expect(doc.getElementsByTagName('parsererror').length, 'appcast.xml is not well-formed XML').toBe(0);
    expect(doc.documentElement.nodeName).toBe('rss');
    expect(doc.documentElement.lookupNamespaceURI('sparkle')).toBe(SPARKLE_NS);
    expect(doc.getElementsByTagName('channel').length).toBe(1);
  });

  it('[-] keeps the released versions: apps already in the field read this feed for updates', () => {
    const items = [...parse().getElementsByTagName('item')];
    expect(items.length, 'the feed has no releases, so installed apps would never see an update').toBeGreaterThan(0);
    for (const item of items) {
      const version = item.getElementsByTagNameNS(SPARKLE_NS, 'version')[0]?.textContent?.trim();
      const enclosure = item.getElementsByTagName('enclosure')[0]?.getAttribute('url');
      expect(version, 'every release names its sparkle:version').toBeTruthy();
      expect(enclosure, `release ${version} links its download`).toMatch(/^https:\/\//);
    }
  });
});
