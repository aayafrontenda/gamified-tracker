// Focus timer: start, pause, stop → log, discard, away time, surviving a restart.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { launch, tempUserData } = require('./helpers');

let userData, app, page;

test.beforeEach(async () => {
  userData = tempUserData();
  ({ app, page } = await launch(userData)); // sample character: DevOps, Frontend, Sports…
});

test.afterEach(async () => {
  await app?.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

const MIN = 60 * 1000;
const chip = () => page.locator('.timer-chip');
const quickLog = () => page.locator('#modal-root form#ql');

async function startDevOpsTimer() {
  await page.keyboard.press('2'); // Skills
  await page.locator('[data-act=timer-skill]').first().click();
  await expect(chip()).toContainText('DevOps');
}
// Pretend the timer was started `min` minutes ago.
const backdate = min => page.evaluate(ms => { state.timer.startedAt = new Date(Date.now() - ms).toISOString(); }, min * MIN);
const elapsedMin = () => page.evaluate(() => Math.round(timerMs() / 60000));

test('starts from a skill card and shows in the sidebar', async () => {
  await startDevOpsTimer();
  await expect(page.locator('#timer-clock')).toHaveText(/^0:00:0\d$/);
  await expect(page.locator('[data-act=timer-stop][aria-label="Stop the DevOps timer"]')).toBeVisible();
  expect(await page.evaluate(() => state.timer.tg)).toEqual([await page.evaluate(() => 'skill:' + state.skills[0].id)]);
});

test('stop opens Take Action with the minutes and a matching effort, then logs it', async () => {
  await startDevOpsTimer();
  await backdate(50);
  await page.locator('.timer-chip [data-act=timer-stop]').click();

  await expect(quickLog()).toBeVisible();
  await expect(quickLog().locator('input[name=minutes]')).toHaveValue('50');
  await expect(quickLog().locator('input[name=int][value=normal]')).toBeChecked(); // 25–90 min → Normal
  await quickLog().locator('button.primary').click();

  const last = await page.evaluate(() => { const e = state.log[state.log.length - 1]; return { minutes: e.minutes, intensity: e.intensity, timer: state.timer }; });
  expect(last).toEqual({ minutes: 50, intensity: 'normal', timer: null });
  await expect(chip()).toHaveCount(0);

  await page.keyboard.press('Escape'); // any rank-up popup
  await page.locator('#rankup-root').evaluate(el => { el.innerHTML = ''; });
  await page.evaluate(() => go('journal'));
  await expect(page.locator('.j-min').first()).toHaveText('· 50 min');
});

test('effort follows the minutes until it is picked by hand', async () => {
  await startDevOpsTimer();
  await backdate(10);
  await page.locator('.timer-chip [data-act=timer-stop]').click();
  const minutes = quickLog().locator('input[name=minutes]');
  await expect(quickLog().locator('input[name=int][value=light]')).toBeChecked();
  await minutes.fill('130');
  await expect(quickLog().locator('input[name=int][value=heavy]')).toBeChecked();
  await quickLog().locator('label:has(input[name=int][value=epic])').click();
  await minutes.fill('20');
  await expect(quickLog().locator('input[name=int][value=epic]')).toBeChecked();
});

test('paused time is not counted', async () => {
  await startDevOpsTimer();
  // started 30 min ago, paused for the last 10 → 20 min on the clock, still 20 after resuming
  await page.evaluate(() => {
    state.timer.startedAt = new Date(Date.now() - 30 * 60000).toISOString();
    state.timer.pausedAt = new Date(Date.now() - 10 * 60000).toISOString();
    render();
  });
  await expect(chip()).toHaveClass(/paused/);
  expect(await elapsedMin()).toBe(20);
  await page.locator('.timer-chip [data-act=timer-resume]').click();
  await expect(chip()).not.toHaveClass(/paused/);
  expect(await elapsedMin()).toBe(20);
});

test('cancelling the log leaves the timer paused; discard throws it away', async () => {
  await startDevOpsTimer();
  await page.locator('.timer-chip [data-act=timer-stop]').click();
  await quickLog().locator('[data-act=close-modal]').click();
  await expect(chip()).toHaveClass(/paused/);

  await page.locator('.timer-chip [data-act=timer-stop]').click();
  await quickLog().locator('[data-act=timer-discard]').click();
  await page.locator('#cf-yes').click();
  await expect(chip()).toHaveCount(0);
  expect(await page.evaluate(() => state.log.filter(e => e.minutes).length)).toBe(0);
});

test('away time can be removed', async () => {
  await startDevOpsTimer();
  await backdate(60);
  await page.evaluate(() => timerAway({ from: Date.now() - 40 * 60000, to: Date.now() }));
  await expect(page.locator('#modal-root')).toContainText('You were away for 40 min');
  await page.locator('#away-drop').click();
  expect(await elapsedMin()).toBe(20);
});

test('Take Action can start a timer for the picked skills', async () => {
  await page.keyboard.press('l');
  for (const checked of await quickLog().locator('label:has(input[name="target"]:checked)').all()) await checked.click();
  await quickLog().locator('label:has(input[name="target"][value="stat:guts"])').click();
  await quickLog().locator('#ql-timer').click();
  await expect(chip()).toContainText('Guts');
  expect(await page.evaluate(() => state.timer.tg)).toEqual(['stat:guts']);
});

test('only one timer runs at a time', async () => {
  await startDevOpsTimer();
  await page.evaluate(() => startTimer(['stat:charm']));
  expect(await page.evaluate(() => state.timer.label)).toBe('DevOps');
});

test('a running timer survives closing the app', async () => {
  await startDevOpsTimer();
  await backdate(5);
  await page.waitForTimeout(400); // debounced save
  await app.close();
  ({ app, page } = await launch(userData));
  await expect(chip()).toContainText('DevOps');
  expect(await elapsedMin()).toBe(5);
});
