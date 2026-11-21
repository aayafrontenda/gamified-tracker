// Editing journal entries: actions fully (XP recomputed), quests/stages/hangouts note + day only.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { launch, tempUserData } = require('./helpers');

let userData, app, page;

test.beforeEach(async () => {
  userData = tempUserData();
  ({ app, page } = await launch(userData)); // sample character
});

test.afterEach(async () => {
  await app?.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

const modal = () => page.locator('#modal-root form#ee');
const openEdit = async () => {
  await page.evaluate(() => { closeRankUp(); rankQueue.length = 0; go('journal'); render(); });
  await page.locator('[data-act=edit-entry]').first().click();
  await expect(modal()).toBeVisible();
};
const last = () => page.evaluate(() => state.log[state.log.length - 1]);

test('an action can change what it trained, its effort, day and note — XP follows', async () => {
  await page.evaluate(() => logActivity(['stat:guts'], 'light', 'oops'));
  await openEdit();
  await modal().locator('label:has(input[name="target"][value="stat:guts"])').click(); // untick
  await modal().locator('label:has(input[name="target"][value="stat:charm"])').click();
  await modal().locator('label:has(input[name="int"][value="heavy"])').click();
  await expect(modal().locator('.gain-preview')).toContainText('Player +50 XP');
  const yesterday = await page.evaluate(() => dkey(addDays(new Date(), -1)));
  await modal().locator('input[name=date]').fill(yesterday);
  await modal().locator('textarea[name=note]').fill('Speech at the meetup');
  await modal().locator('button.primary').click();

  const e = await last();
  expect(e).toMatchObject({ tg: ['stat:charm'], intensity: 'heavy', xp: 50, date: yesterday, note: 'Speech at the meetup' });
  expect(e.stats).toEqual({ charm: 10 });
  const d = await page.evaluate(() => derive());
  expect(d.stats.guts).toBe(0);
  expect(d.stats.charm).toBe(10);
  expect(await page.evaluate(ts => dkey(new Date(ts)), e.ts)).toBe(yesterday);
});

test('an old-format entry is rewritten in the new format when edited', async () => {
  await page.evaluate(() => {
    const s = state.skills[0];
    state.log.push({ id: 'old1', ts: new Date().toISOString(), date: dkey(), kind: 'activity', skillId: s.id, stat: s.stat, xp: 25, statPts: 5, intensity: 'normal', note: '' });
    render();
  });
  await openEdit();
  await modal().locator('button.primary').click();
  const e = await last();
  expect(e.skillId).toBeUndefined();
  expect(e.statPts).toBeUndefined();
  expect(e.tg).toHaveLength(1);
  expect(e.xp).toBe(25);
});

test('a Mementos ×2 the entry earned survives an edit while its skill stays', async () => {
  const id = await page.evaluate(() => todaysRequest().skillId);
  await page.evaluate(id => logActivity(['skill:' + id], 'normal'), id);
  expect((await last()).xp).toBe(50);
  await openEdit();
  await modal().locator('textarea[name=note]').fill('still doubled');
  await modal().locator('button.primary').click();
  expect(await last()).toMatchObject({ xp: 50, note: 'still doubled' });
  expect((await last()).req).toBeTruthy();
});

test('timer minutes can be corrected', async () => {
  await page.evaluate(() => logActivity(['stat:knowledge'], 'normal', '', { minutes: 45 }));
  await openEdit();
  await modal().locator('input[name=minutes]').fill('30');
  await modal().locator('button.primary').click();
  expect((await last()).minutes).toBe(30);
});

test('quests only change note and day; their reward stays', async () => {
  await page.evaluate(() => { const q = state.quests.find(x => x.type === 'weekly'); completeQuest(q); });
  const before = await last();
  await openEdit();
  await expect(modal().locator('input[name=target]')).toHaveCount(0);
  await modal().locator('textarea[name=note]').fill('called on Sunday');
  await modal().locator('button.primary').click();
  const e = await last();
  expect(e).toMatchObject({ kind: 'quest', xp: before.xp, note: 'called on Sunday' });
});

test('a future day is refused', async () => {
  await page.evaluate(() => logActivity(['stat:guts'], 'light'));
  await openEdit();
  const tomorrow = await page.evaluate(() => dkey(addDays(new Date(), 1)));
  await modal().locator('input[name=date]').evaluate((el, v) => { el.removeAttribute('max'); el.value = v; }, tomorrow);
  await modal().locator('button.primary').click();
  await expect(modal()).toBeVisible();
  expect((await last()).date).toBe(await page.evaluate(() => dkey()));
});
