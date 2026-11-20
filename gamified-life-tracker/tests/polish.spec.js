// Undo after an action, logging an earlier day, the player's name in texts, new-player screens.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { launch, tempUserData } = require('./helpers');

let userData, app, page;

test.beforeEach(async () => {
  userData = tempUserData();
  ({ app, page } = await launch(userData)); // sample character, empty journal
});

test.afterEach(async () => {
  await app?.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

const quickLog = () => page.locator('#modal-root form#ql');
const dismissPopups = async () => { while (await page.locator('#rankup-root > *').count()) await page.keyboard.press('Escape'); };
async function logGuts({ when } = {}) {
  await page.keyboard.press('l');
  for (const c of await quickLog().locator('label:has(input[name="target"]:checked)').all()) await c.click();
  await quickLog().locator('label:has(input[name="target"][value="stat:guts"])').click();
  if (when) await quickLog().locator(`label:has(input[name="when"][value="${when}"])`).click();
  return quickLog();
}

test('the toast after an action can undo it', async () => {
  const form = await logGuts();
  await form.locator('button.primary').click();
  await dismissPopups();
  expect(await page.evaluate(() => state.log.length)).toBe(1);
  await page.locator('.toast-act', { hasText: 'Undo' }).first().click();
  expect(await page.evaluate(() => state.log.length)).toBe(0);
  await expect(page.locator('#toasts')).toContainText('UNDONE');
});

test('an action can be logged for yesterday', async () => {
  const form = await logGuts({ when: 'yesterday' });
  await form.locator('button.primary').click();
  const e = await page.evaluate(() => { const e = state.log[0]; return { date: e.date, tsDay: dkey(new Date(e.ts)), yesterday: dkey(addDays(new Date(), -1)) }; });
  expect(e.date).toBe(e.yesterday);
  expect(e.tsDay).toBe(e.yesterday);
});

test('an earlier date is picked from the calendar; the field shows only for "Earlier"', async () => {
  const form = await logGuts();
  await expect(form.locator('input[name=whenDate]')).toBeHidden();
  await form.locator('label:has(input[name="when"][value="date"])').click();
  await expect(form.locator('input[name=whenDate]')).toBeVisible();
  const day = await page.evaluate(() => dkey(addDays(new Date(), -5)));
  await form.locator('input[name=whenDate]').fill(day);
  await form.locator('button.primary').click();
  expect(await page.evaluate(() => state.log[0].date)).toBe(day);
});

test("today's Mementos request doesn't pay double for an earlier day", async () => {
  const skill = await page.evaluate(() => todaysRequest().skillId);
  const xp = await page.evaluate(id => [buildGains(['skill:' + id], 25).xp, buildGains(['skill:' + id], 25, dkey(addDays(new Date(), -1))).xp], skill);
  expect(xp).toEqual([50, 25]);
});

test("texts use the player's codename, not Joker", async () => {
  await page.evaluate(() => { state.player.name = 'Mona'; });
  expect(await page.evaluate(() => head('status', 'Looking cool, {name}!'))).toContain('Looking cool, Mona!');
});

test('a brand-new player is not asked to appraise an empty week', async () => {
  expect(await page.evaluate(() => pendingReviewWeek())).toBeNull();
  await expect(page.locator('.vr-badge')).toHaveCount(0);
});

test('journal charts explain themselves before the first action', async () => {
  await page.evaluate(() => { journalTab = 'charts'; go('journal'); render(); });
  await expect(page.locator('.empty')).toContainText('No charts yet.');
});
