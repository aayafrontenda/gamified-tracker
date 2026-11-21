// Week card: a 1080×1080 PNG of a week, copied to the clipboard or saved from the Velvet Room.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { launch, tempUserData } = require('./helpers');

let userData, app, page;

test.beforeEach(async () => {
  userData = tempUserData();
  ({ app, page } = await launch(userData));
  await page.evaluate(() => { window.__seedDemo(); closeRankUp(); rankQueue.length = 0; });
});

test.afterEach(async () => {
  await app?.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

const lastWeek = () => page.evaluate(() => prevWeek(weekKey(new Date())));

test('Share week shows only for weeks with actions', async () => {
  await page.evaluate(wk => { velvetWeek = wk; go('velvet'); render(); }, await lastWeek());
  await expect(page.locator('.vr-share')).toBeVisible();
  await page.evaluate(() => { velvetWeek = '2001-01-01'; render(); });
  await expect(page.locator('.vr-share')).toHaveCount(0);
});

test('the card shows the week in numbers and keeps the reflections private', async () => {
  const wk = await lastWeek();
  await page.evaluate(wk => {
    state.reviews[wk] = { grade: 'A', well: 'SECRET-WELL', held: 'SECRET-HELD', next: 'SECRET-NEXT', focus: [state.skills[0].id], completedAt: new Date().toISOString() };
    state.player.name = 'Ren <b>';
  }, wk);
  const { html, xp } = await page.evaluate(wk => ({ html: weekCardHTML(wk), xp: weekStats(wk).xp }), wk);
  expect(html).toContain(`+${xp}`);
  expect(html).toContain('Ren &lt;b&gt;');
  expect(html).toContain('wk-grade');
  expect(html).toContain("NEXT WEEK'S FOCUS");
  expect(html).not.toContain('SECRET');
  expect(html).not.toMatch(/\b0% dailies/);

  await page.evaluate(wk => { velvetWeek = wk; go('velvet'); render(); }, wk);
  await page.locator('.vr-share').click();
  await expect(page.locator('#modal-root .wk-preview .wk-card')).toBeVisible();
  await expect(page.locator('#wk-copy')).toBeVisible();
  await expect(page.locator('#wk-save')).toBeVisible();
});

test('Copy image puts a 1080×1080 PNG on the clipboard', async () => {
  // The test shares the real clipboard with whoever uses this machine: put their text back afterwards.
  const before = await app.evaluate(({ clipboard }) => clipboard.readText());
  try {
    const wk = await lastWeek();
    expect(await page.evaluate(wk => window.api.weekCard(weekCardHTML(wk), 'copy'), wk)).toBe(true);
    const png = await app.evaluate(async ({ clipboard }) => {
      const it = (await clipboard.read()).find(i => i.types.includes('image/png'));
      if (!it) return null;
      const buf = Buffer.from(await (await it.getType('image/png')).arrayBuffer());
      return { sig: buf.toString('hex', 1, 4), w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), bytes: buf.length };
    });
    expect(png).toMatchObject({ sig: '504e47', w: 1080, h: 1080 }); // "PNG"
    expect(png.bytes).toBeGreaterThan(50_000); // a drawn card, not a blank square
  } finally {
    await app.evaluate(({ clipboard }, t) => clipboard.writeText(t), before);
  }
});
