// Window hardening from main.js: no navigation away, no new windows, no web permissions.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { launch, tempUserData } = require('./helpers');

let userData, app, page;

test.beforeEach(async () => {
  userData = tempUserData();
  ({ app, page } = await launch(userData));
});

test.afterEach(async () => {
  await app?.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

test('the window cannot navigate away from the app', async () => {
  const before = page.url();
  await page.evaluate(() => { location.href = 'https://example.com/'; });
  await page.waitForTimeout(500);
  // Asked from the main process: Playwright's page keeps waiting on the cancelled navigation.
  const after = await app.evaluate(async ({ BrowserWindow }) => {
    const wc = BrowserWindow.getAllWindows()[0].webContents;
    return { url: wc.getURL(), menu: await wc.executeJavaScript("!!document.querySelector('#side .menu')") };
  });
  expect(after).toEqual({ url: before, menu: true });
});

test('the app cannot open new windows', async () => {
  const opened = await page.evaluate(() => window.open('https://example.com/') === null);
  expect(opened).toBe(true);
  expect(app.windows()).toHaveLength(1);
});

test('web permissions are denied', async () => {
  const state = await page.evaluate(() => navigator.permissions.query({ name: 'geolocation' }).then(r => r.state));
  expect(state).toBe('denied');
});

test('the renderer has no Node.js access', async () => {
  const exposed = await page.evaluate(() => ({ require: typeof require, process: typeof process, api: typeof window.api }));
  expect(exposed).toEqual({ require: 'undefined', process: 'undefined', api: 'object' });
});
