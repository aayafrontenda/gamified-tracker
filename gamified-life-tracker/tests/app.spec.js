const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { launch, tempUserData, derived } = require('./helpers');

let userData, app, page;

test.beforeEach(async () => {
  userData = tempUserData();
  ({ app, page } = await launch(userData));
});

test.afterEach(async () => {
  await app?.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

// Logs one action through the Take Action modal: only the given social stat, given effort.
// (A social stat, not a skill, so the daily Mementos ×2 request can't change the numbers.)
async function takeAction(stat, effort = 'normal', { keepPopups = false } = {}) {
  await page.keyboard.press('l');
  const modal = page.locator('#modal-root form#ql');
  await expect(modal).toBeVisible();
  for (const checked of await modal.locator('label:has(input[name="target"]:checked)').all()) await checked.click();
  await modal.locator(`label:has(input[name="target"][value="stat:${stat}"])`).click();
  await modal.locator(`label:has(input[name="int"][value="${effort}"])`).click();
  await modal.locator('button.primary').click();
  await expect(modal).toHaveCount(0);
  if (!keepPopups) await dismissPopups();
}

// Rank-up / new-persona popups queue up after an action and swallow other keys until closed.
async function dismissPopups() {
  const popup = page.locator('#rankup-root > *');
  for (let i = 0; i < 10 && await popup.count(); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
  await expect(popup).toHaveCount(0);
}

test('first action awakens a persona (rank-up popup)', async () => {
  await takeAction('guts', 'normal', { keepPopups: true });
  await expect(page.locator('#rankup-root')).toContainText('Arsène — Log your first action');
});

test('opens on the Status screen with all menu screens', async () => {
  await expect(page.locator('#side .mi')).toHaveCount(8);
  await expect(page.locator('#side .mi.active')).toContainText('Status');
});

test('number keys switch screens', async () => {
  await page.keyboard.press('3');
  await expect(page.locator('#side .mi.active')).toContainText('Quests');
  await page.keyboard.press('5');
  await expect(page.locator('#side .mi.active')).toContainText('Journal');
});

test('taking an action earns XP, stat points and yen', async () => {
  await takeAction('guts', 'heavy'); // Heavy = 50 XP
  const d = await derived(page);
  expect(d.total).toBe(50);
  expect(d.stats.guts).toBe(10); // XP ÷ 5
  expect(d.yen).toBe(500); // ¥10 per XP
});

test('deleting a journal entry undoes it', async () => {
  await takeAction('knowledge');
  expect((await derived(page)).total).toBe(25);

  await page.keyboard.press('5'); // Journal
  await page.locator('[data-act="del-entry"]').first().click();
  await page.locator('#cf-yes').click();

  const d = await derived(page);
  expect(d.total).toBe(0);
  expect(d.stats.knowledge).toBe(0);
});

test('progress is saved and survives a restart', async () => {
  await takeAction('charm', 'epic'); // 100 XP
  await app.close(); // flushes the pending save

  const saved = JSON.parse(fs.readFileSync(path.join(userData, 'save.json'), 'utf8'));
  expect(saved.log).toHaveLength(1);

  ({ app, page } = await launch(userData));
  expect((await derived(page)).total).toBe(100);
});

test('shortcut labels match the platform', async () => {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,');
  await expect(page.locator('#sys-name')).toBeVisible();
  const hotkey = process.platform === 'darwin' ? '⌘⇧L' : 'Ctrl+Shift+L';
  await expect(page.locator('.toggle kbd').first()).toHaveText(hotkey);
});
