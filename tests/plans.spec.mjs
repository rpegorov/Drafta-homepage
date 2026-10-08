import { describe, expect, it, vi } from 'vitest';

vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
const { renderPlans } = await import('../src/scripts/plans.ts');

async function render(lang) {
  const el = { innerHTML: '', classList: { add() {} } };
  await renderPlans(el, { lang });
  return el.innerHTML.replace(/[  ]/g, ' ');
}

describe('pricing cards', () => {
  it('shows roubles on the Russian page', async () => {
    const html = await render('ru');
    expect(html).toContain('792 ₽');
    expect(html).toContain('990 ₽');
    expect(html).toContain('9 500 ₽ при оплате за год');
    expect(html).not.toContain('$');
  });

  it('shows US dollars on the English page', async () => {
    const html = await render('en');
    expect(html).toContain('$7.99');
    expect(html).toContain('$9.99');
    expect(html).toContain('$95.88 billed annually');
    expect(html).not.toContain('₽');
  });
});
