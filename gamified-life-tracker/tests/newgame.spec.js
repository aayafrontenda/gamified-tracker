// Character creation: first launch, the four steps, and New game from System.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { launch, tempUserData } = require('./helpers');

let userData, app, page;

test.afterEach(async () => {
  await app?.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

const SETTINGS_KEY = process.platform === 'darwin' ? 'Meta+,' : 'Control+,';
const ng = () => page.locator('#newgame-root .ng');
const next = () => page.locator('#ng-form button[type=submit]').click();
const pickArea = id => page.locator(`label.ng-tile:has(#area-${id})`).click();

test.describe('first launch', () => {
  test.beforeEach(async () => {
    userData = tempUserData();
    ({ app, page } = await launch(userData, { fresh: true }));
  });

  test('opens on the title screen and saves nothing yet', async () => {
    await expect(page.locator('.ng-title')).toBeVisible();
    await expect(page.locator('.ng-mi', { hasText: 'Back to my game' })).toHaveCount(0);
    expect(fs.existsSync(path.join(userData, 'save.json'))).toBe(false);
  });

  test('creates the character that was set up, then opens Take Action', async () => {
    await page.locator('.ng-mi', { hasText: 'New game' }).click();

    await page.locator('#ng-name').fill('Aslan');
    await expect(page.locator('#ng-card')).toContainText('Transfer Student');
    await page.keyboard.press('Enter'); // Enter moves on

    await pickArea('coding');
    await pickArea('fitness');
    await page.locator('#ng-own-name').fill('Chess');
    await page.locator('#ng-own-stat').selectOption('knowledge');
    await page.locator('#ng-own-name').press('Enter'); // Enter here adds, doesn't move on
    await page.locator('#nm-fitness').fill('Gym');
    await expect(page.locator('#ng-card .ng-card-sk')).toContainText('Gym');
    await next();

    // first suggestion per area is pre-checked; untick "Push a commit", keep "Work out"
    await expect(page.locator('#q-coding-0')).toBeChecked();
    await expect(page.locator('#q-coding-1')).not.toBeChecked();
    await page.locator('label.ng-check:has(#q-coding-0)').click();
    await page.locator('#qt-fitness-0').fill('Gym session');
    await next();

    await page.locator('#ng-dailies').fill('20:30');
    await expect(page.locator('.ng-sum')).toContainText('3 skills');
    await expect(page.locator('.ng-sum')).toContainText('1 quest');
    await next(); // Start

    await expect(ng()).toHaveCount(0);
    await expect(page.locator('#modal-root form#ql')).toBeVisible(); // first move: Take Action

    const s = await page.evaluate(() => ({
      name: state.player.name,
      skills: state.skills.map(x => `${x.name}/${x.stat}`),
      quests: state.quests.map(q => `${q.title}/${q.type}/${state.skills.find(x => 'skill:' + x.id === q.target)?.name}`),
      dailiesAt: state.settings.dailiesAt,
    }));
    expect(s).toEqual({
      name: 'Aslan',
      skills: ['Coding/proficiency', 'Gym/guts', 'Chess/knowledge'],
      quests: ['Gym session/daily/Gym'],
      dailiesAt: '20:30',
    });
    await page.waitForTimeout(400); // debounced save
    const saved = JSON.parse(fs.readFileSync(path.join(userData, 'save.json'), 'utf8'));
    expect(saved.player.name).toBe('Aslan');
  });

  test('needs at least one skill to move on', async () => {
    await page.locator('.ng-mi', { hasText: 'New game' }).click();
    await next();
    await next();
    await expect(page.locator('.ng-error')).toHaveText('Pick at least one thing to train.');
    await expect(page.locator('#ng-h')).toHaveAttribute('aria-label', 'WHAT WILL YOU TRAIN?');
  });

  test('Back returns to earlier steps with the answers kept', async () => {
    await page.locator('.ng-mi', { hasText: 'New game' }).click();
    await page.locator('#ng-name').fill('Mona');
    await next();
    await pickArea('music');
    await page.locator('[data-act=ng-back]').click();
    await expect(page.locator('#ng-name')).toHaveValue('Mona');
    await page.locator('.ng-step', { hasText: 'What you train' }).click();
    await expect(page.locator('#area-music')).toBeChecked();
  });

  test('app shortcuts are off during character creation', async () => {
    await page.locator('.ng-mi', { hasText: 'New game' }).focus();
    await page.keyboard.press('l');
    await page.keyboard.press('3');
    await expect(page.locator('#modal-root form#ql')).toHaveCount(0);
    await expect(ng()).toBeVisible();
  });
});

test.describe('existing save', () => {
  test.beforeEach(async () => {
    userData = tempUserData();
    ({ app, page } = await launch(userData)); // sample character, saved
    await page.waitForTimeout(400);
  });

  test('a saved game skips character creation', async () => {
    await app.close();
    ({ app, page } = await launch(userData, { fresh: true }));
    await expect(ng()).toHaveCount(0);
    expect(await page.evaluate(() => state.skills.length)).toBe(6);
  });

  test('System в†’ New game can go back without losing anything', async () => {
    await page.keyboard.press(SETTINGS_KEY);
    await page.locator('[data-act=reset]').click();
    await page.locator('#cf-yes').click();
    await expect(page.locator('.ng-mi', { hasText: 'Back to my game' })).toBeVisible();
    await page.locator('.ng-mi', { hasText: 'Back to my game' }).click();
    await expect(ng()).toHaveCount(0);
    expect(await page.evaluate(() => state.skills.map(s => s.name))).toContain('DevOps');
  });

  test('System в†’ New game replaces the save only on Start', async () => {
    await page.evaluate(() => { state.settings.sound = false; persist(); });
    await page.keyboard.press(SETTINGS_KEY);
    await page.locator('[data-act=reset]').click();
    await page.locator('#cf-yes').click();
    await page.locator('.ng-mi', { hasText: 'New game' }).click();
    await next();
    await pickArea('writing');
    await next();
    await next();
    expect(await page.evaluate(() => state.skills.length)).toBe(6); // still the old game
    await next(); // Start
    const s = await page.evaluate(() => ({ skills: state.skills.map(x => x.name), log: state.log.length, sound: state.settings.sound }));
    expect(s).toEqual({ skills: ['Writing'], log: 0, sound: false }); // settings carried over
  });
});
