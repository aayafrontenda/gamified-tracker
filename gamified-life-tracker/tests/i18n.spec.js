// Russian interface: the language switch, character creation in Russian, and no English left over.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { launch, tempUserData } = require('./helpers');

let userData, app, page;

test.afterEach(async () => {
  await app?.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

const next = () => page.locator('#ng-form button[type=submit]').click();

// Latin words on screen that aren't the player's own data or deliberate (XP, LV, key names, arcana numerals…).
const ALLOWED = ['xp', 'lv', 'png', 'phantom', 'life', 'ctrl', 'shift', 'enter', 'esc', 'rust', 'k8s', 'english', 'language'];
const englishLeft = page => page.evaluate(allowed => {
  const own = new Set(allowed);
  const add = s => String(s || '').toLowerCase().split(/[^a-z0-9]+/).forEach(w => w && own.add(w));
  add(state.player.name);
  state.skills.forEach(s => add(s.name));
  state.quests.forEach(q => { add(q.title); (q.stages || []).forEach(s => add(s.title)); });
  state.confidants.forEach(c => { add(c.name); add(c.notes); });
  state.rewards.forEach(r => add(r.name));
  state.log.forEach(e => add(e.note));
  Object.values(state.reviews).forEach(r => ['well', 'held', 'next'].forEach(k => add(r[k])));
  PERSONAS.forEach(p => add(p.name)); // persona names stay as they are
  const skip = el => el.closest('#sys-path'); // the save's folder on this machine
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let text = '';
  while (walker.nextNode()) if (!skip(walker.currentNode.parentElement)) text += ' ' + walker.currentNode.textContent;
  text += ' ' + [...document.querySelectorAll('[title],[aria-label],[placeholder]')]
    .map(el => [el.title, el.getAttribute('aria-label'), el.placeholder].join(' ')).join(' ');
  return [...new Set(text.match(/[A-Za-z][A-Za-z']{2,}/g) || [])]
    .filter(w => !own.has(w.toLowerCase()) && !/^[IVX]+$/.test(w));
}, ALLOWED);

test('a new game can be played in Russian from the title screen', async () => {
  userData = tempUserData();
  ({ app, page } = await launch(userData, { fresh: true }));
  await page.locator('[data-act=ng-lang][data-lang=ru]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('.ng-menu')).toContainText('Новая игра');
  await page.locator('[data-act=ng-new]').click();
  await page.locator('#ng-name').fill('Джокер');
  await next();
  await page.locator('label:has(#area-reading)').click();
  await page.locator('label:has(#area-fitness)').click();
  await next();
  await expect(page.locator('[data-ng-qt]').first()).toHaveValue('Прочитать 20 страниц');
  await next();
  await next(); // Start
  await expect(page.locator('#newgame-root')).toBeEmpty();
  const s = await page.evaluate(() => ({ lang: state.settings.lang, skills: state.skills.map(x => x.name), quests: state.quests.map(q => q.title), reward: state.rewards[0].name }));
  expect(s.lang).toBe('ru');
  expect(s.skills).toEqual(['Чтение', 'Фитнес']);
  expect(s.quests).toContain('Прочитать 20 страниц');
  expect(s.reward).toBe('Серия аниме / сериала');
  expect(await page.evaluate(() => [...window.__missingRu])).toEqual([]);
});

test('every screen and dialog is translated', async () => {
  userData = tempUserData();
  ({ app, page } = await launch(userData));
  await page.evaluate(() => {
    window.__seedDemo(); closeRankUp(); rankQueue.length = 0;
    state.settings.lang = 'ru'; applyLanguage();
    document.getElementById('toasts').innerHTML = ''; // the demo seed's toast came in English
    startTimer(['skill:' + state.skills[0].id]);
  });
  const left = {};
  for (const id of ['status', 'skills', 'quests', 'confidants', 'journal', 'compendium', 'velvet', 'shop', 'system']) {
    await page.evaluate(id => { closeModal(); go(id); }, id);
    left[id] = await englishLeft(page);
  }
  for (const tab of ['calendar', 'charts']) {
    await page.evaluate(tab => { go('journal'); journalTab = tab; render(); }, tab);
    left['journal-' + tab] = await englishLeft(page);
  }
  const dialogs = {
    quickLog: 'openQuickLog()', skill: 'skillModal(state.skills[0].id)', quest: "questModal(null, 'once')",
    confidant: 'confModal()', hangout: 'hangoutModal()', entry: "entryModal(state.log.find(e => e.kind === 'activity').id)",
    reward: 'rewardModal()', weekCard: 'openWeekCard(prevWeek(weekKey(new Date())))', timerLog: 'stopTimer()',
  };
  for (const [name, call] of Object.entries(dialogs)) {
    await page.evaluate(call => { closeModal(); (0, eval)(call); }, call);
    left[name] = await englishLeft(page);
  }
  await page.evaluate(() => { closeModal(); openNewGame(true); });
  left.newGame = await englishLeft(page);
  for (const step of [1, 2, 3, 4]) {
    await page.evaluate(step => { Object.assign(ng, { step, reached: 4, picked: ['coding', 'music'] }); renderNewGame(true); }, step);
    left['newGame-' + step] = await englishLeft(page);
  }
  for (const k of Object.keys(left)) if (!left[k].length) delete left[k];
  expect(left).toEqual({});
  expect(await page.evaluate(() => [...window.__missingRu])).toEqual([]);
});

test('built-in names in a save follow the language; the player’s own names stay', async () => {
  userData = tempUserData();
  ({ app, page } = await launch(userData)); // sample character, made in English
  await page.evaluate(() => {
    state.skills.push(newSkill('Guitar', 'music', 'charm'));
    completeQuest(state.quests.find(q => q.title === 'Read 20 pages')); closeRankUp(); rankQueue.length = 0;
    state.purchases.push({ id: 'p1', rewardId: state.rewards[2].id, name: 'Cheat meal', price: 1000, icon: 'utensils', ts: new Date().toISOString(), date: dkey() });
  });
  const names = () => page.evaluate(() => ({
    skills: state.skills.map(s => s.name), quests: state.quests.map(q => q.title), reward: state.rewards[2].name,
    bought: state.purchases[0].name, note: state.log.find(e => e.kind === 'quest').note,
  }));
  await page.evaluate(() => go('system'));
  await page.locator('[data-setting=lang]').selectOption('ru');
  expect(await names()).toEqual({
    skills: ['DevOps', 'Frontend', 'Спорт', 'Стиль', 'Чтение', 'Помощь людям', 'Guitar'],
    quests: ['Тренировка', 'Прочитать 20 страниц', 'Запушить коммит в пет-проект', 'Позвонить родным'],
    reward: 'Читмил', bought: 'Читмил', note: 'Прочитать 20 страниц',
  });
  // the save on disk follows too (main.js reads quest titles from it for reminders)
  await expect.poll(() => page.evaluate(() => window.api.load().then(s => s?.skills[4].name))).toBe('Чтение');
  await page.locator('[data-setting=lang]').selectOption('en');
  expect((await names()).skills).toEqual(['DevOps', 'Frontend', 'Sports', 'Style', 'Reading', 'Helping Others', 'Guitar']);
});

test('the title screen language switch saves nothing before Start', async () => {
  userData = tempUserData();
  ({ app, page } = await launch(userData, { fresh: true }));
  await page.locator('[data-act=ng-lang][data-lang=ru]').click();
  await page.waitForTimeout(400); // past persist()'s debounce
  expect(fs.existsSync(require('path').join(userData, 'save.json'))).toBe(false);
});

test('switching the language in System re-renders everything', async () => {
  userData = tempUserData();
  ({ app, page } = await launch(userData));
  await page.evaluate(() => go('system'));
  await page.locator('[data-setting=lang]').selectOption('ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('#side .menu')).toContainText('Навыки');
  await expect(page.locator('.act-btn')).toContainText('ДЕЙСТВУЙ');
  expect(await page.evaluate(() => [fmtMD('2026-11-09'), dow(1), trn(3, '{n} skill', '{n} skills'), trn(5, '{n} skill', '{n} skills')]))
    .toEqual(['9.11', 'ПН', '3 навыка', '5 навыков']);
  await page.locator('[data-setting=lang]').selectOption('auto'); // tests pin the system language to English
  await expect(page.locator('#side .menu')).toContainText('Skills');
});
