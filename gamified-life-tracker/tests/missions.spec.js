// Missions with stages: ticking stages, auto-clear on the last one, undo, pace, editing.
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

// A mission on the first skill with `n` stages; returns its id.
const addMission = (n, extra = {}) => page.evaluate(([n, extra]) => {
  const q = {
    id: uid(), title: 'Ship the side project', type: 'once', target: 'skill:' + state.skills[0].id, intensity: 'epic',
    deadline: '', createdAt: new Date().toISOString(),
    stages: Array.from({ length: n }, (_, i) => ({ id: 'st' + i, title: 'Step ' + (i + 1), deadline: '' })), ...extra,
  };
  state.quests.push(q); persist(); go('quests'); render();
  return q.id;
}, [n, extra]);
const mission = id => page.evaluate(id => {
  const q = state.quests.find(x => x.id === id);
  return { done: stagesOf(q).filter(s => stageDone(q, s)).length, cleared: !!questCompletion(q), pace: missionPace(q) };
}, id);
const stageBtn = (i, name = 'Step ' + (i + 1)) => page.getByRole('button', { name: new RegExp(`stage: ${name}$`) });
const dismissPopups = async () => { while (await page.locator('#rankup-root > *').count()) await page.keyboard.press('Escape'); };

test('creates a mission with stages from the quest dialog', async () => {
  await page.keyboard.press('3');
  await page.locator('[data-act=add-quest][data-type=once]').click();
  const modal = page.locator('#modal-root .modal');
  await modal.locator('input[name=title]').fill('Run a half marathon');
  for (const t of ['Run 5 km', 'Run 10 km', 'Run 15 km']) {
    await modal.locator('#add-stage').click();
    await modal.locator('input[name=stage-title]').last().fill(t);
  }
  await modal.locator('input[name=stage-deadline]').first().fill('2030-01-15');
  await modal.locator('button.primary').click();
  const q = await page.evaluate(() => state.quests.find(x => x.title === 'Run a half marathon'));
  expect(q.stages.map(s => s.title)).toEqual(['Run 5 km', 'Run 10 km', 'Run 15 km']);
  expect(q.stages[0].deadline).toBe('2030-01-15');
  await expect(page.locator('.quest.staged .ms-prog')).toContainText('0/3 stages');
});

test('a stage pays Normal XP and shows progress; the last one clears the mission', async () => {
  const id = await addMission(2);
  const before = await page.evaluate(() => state.log.length);
  await stageBtn(0).click();
  await dismissPopups();
  expect(await mission(id)).toMatchObject({ done: 1, cleared: false });
  const e = await page.evaluate(() => state.log[state.log.length - 1]);
  expect(e).toMatchObject({ kind: 'stage', intensity: 'normal' });
  await expect(page.locator('.quest.staged .ms-prog')).toContainText('1/2 stages');

  await stageBtn(1).click();
  // popups queue up (a first-mission persona may come first); the mission's own is among them
  const seen = [];
  while (await page.locator('#rankup-root > *').count()) {
    seen.push(await page.locator('#rankup-root').innerText());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  expect(seen.some(t => t.toLowerCase().includes('ship the side project'))).toBe(true); // CSS uppercases it
  expect(await mission(id)).toMatchObject({ done: 2, cleared: true });
  expect(await page.evaluate(() => state.log.length)).toBe(before + 3); // 2 stages + the mission
});

test('unticking a stage reopens a cleared mission', async () => {
  const id = await addMission(1);
  await stageBtn(0).click();
  await dismissPopups();
  expect(await mission(id)).toMatchObject({ cleared: true });
  await page.evaluate(id => toggleStage(id, 'st0'), id);
  expect(await mission(id)).toMatchObject({ done: 0, cleared: false });
});

test('clearing a mission with open stages asks first', async () => {
  const id = await addMission(3);
  const check = page.locator(`.quest.staged [data-act=toggle-quest][data-id="${id}"]`);
  await check.click();
  await page.locator('#cf-no').click();
  expect(await mission(id)).toMatchObject({ cleared: false });
  await check.click();
  await page.locator('#cf-yes').click();
  await dismissPopups();
  expect(await mission(id)).toMatchObject({ cleared: true, done: 0 });
});

test('deleting the journal entry unticks the stage', async () => {
  const id = await addMission(2);
  await stageBtn(0).click();
  await dismissPopups();
  await page.evaluate(() => go('journal'));
  await page.locator('[data-act=del-entry]').first().click();
  await page.locator('#cf-yes').click();
  expect(await mission(id)).toMatchObject({ done: 0 });
});

test('pace: on track vs behind', async () => {
  const day = 86400000;
  // set 10 days ago, due in 10: halfway through time
  const base = { createdAt: new Date(Date.now() - 10 * day).toISOString(), deadline: await page.evaluate(() => dkey(addDays(new Date(), 10))) };
  const id = await addMission(4, base);
  expect((await mission(id)).pace).toBe('behind'); // 0 of 4 done, ~2 expected
  await page.evaluate(id => { toggleStage(id, 'st0'); toggleStage(id, 'st1'); }, id);
  expect((await mission(id)).pace).toBe('on');
  await expect(page.locator('.chip.pace-on')).toBeVisible();
  // the next stage's own deadline has passed → behind
  await page.evaluate(id => { state.quests.find(q => q.id === id).stages[2].deadline = dkey(addDays(new Date(), -1)); }, id);
  expect((await mission(id)).pace).toBe('behind');
});

test('editing a mission keeps its ticked stages', async () => {
  const id = await addMission(2);
  await stageBtn(0).click();
  await dismissPopups();
  await page.evaluate(id => questModal(id), id);
  const modal = page.locator('#modal-root .modal');
  await modal.locator('input[name=stage-title]').nth(1).fill('Step 2, renamed');
  await modal.locator('#add-stage').click();
  await modal.locator('input[name=stage-title]').last().fill('Step 3');
  await modal.locator('button.primary').click();
  const q = await page.evaluate(id => state.quests.find(x => x.id === id), id);
  expect(q.stages.map(s => s.title)).toEqual(['Step 1', 'Step 2, renamed', 'Step 3']);
  expect(await mission(id)).toMatchObject({ done: 1 });
});

test('editing a weekday-only daily quest does not duplicate it', async () => {
  const count = () => page.evaluate(() => state.quests.length);
  const n = await count();
  const id = await page.evaluate(() => { state.quests[0].days = [1, 2, 3, 4, 5]; return state.quests[0].id; });
  await page.evaluate(id => questModal(id), id);
  await page.locator('#modal-root .modal button.primary').click();
  expect(await count()).toBe(n);
});

test('clearing a 5-stage mission awakens Anubis', async () => {
  const id = await addMission(5);
  await page.evaluate(id => { for (let i = 0; i < 5; i++) toggleStage(id, 'st' + i); }, id);
  expect(await page.evaluate(() => !!state.compendium.anubis)).toBe(true);
});
