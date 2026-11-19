// Accessibility: axe-core rules (contrast, labels, landmarks, headings…) on every screen, with demo data.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const { launch, tempUserData } = require('./helpers');

// "screen" or "screen:journalTab"
const SCREENS = ['status', 'skills', 'quests', 'confidants', 'journal', 'journal:calendar', 'journal:charts',
  'compendium', 'velvet', 'shop', 'system'];

let userData, app, page;

test.beforeAll(async () => {
  userData = tempUserData();
  ({ app, page } = await launch(userData));
  await page.evaluate(() => window.__seedDemo());
});

test.afterAll(async () => {
  await app?.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

for (const id of SCREENS) {
  test(`${id} screen has no accessibility violations`, async () => {
    await page.evaluate(([screen, tab]) => { journalTab = tab || 'log'; go(screen); render(); }, id.split(':'));
    await page.waitForTimeout(300); // screen-enter animation
    // Legacy mode runs axe inside the page — the default opens a helper tab, which Electron doesn't allow.
    // Cleared quest sections and rest-day quests are dimmed on purpose (done / not today), so their
    // contrast is exempt.
    const { violations } = await new AxeBuilder({ page }).setLegacyMode(true)
      .exclude('.q-section.cleared .quest').exclude('.quest.rest').analyze();
    const report = violations.map(v => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map(n => n.target.join(' ')).join('\n  ')}`);
    expect(report, report.join('\n')).toEqual([]);
  });
}
