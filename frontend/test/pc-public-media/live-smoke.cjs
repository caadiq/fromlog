const assert = require('node:assert/strict');
const { launch, artifact, origin, overflow } = require('./base.cjs');
(async () => {
 const browser = await launch();
 try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route('**/*', route => {
    const req = route.request(), u = new URL(req.url());
    if (req.method() !== 'GET' || u.hostname === 'caadiq.co.kr') return route.abort();
    return route.continue();
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  for (const route of ['/video', '/video/variety', '/video/shorts', '/schedule', '/schedule?search=워크돌']) {
    await page.goto(origin + route); await page.waitForTimeout(2200);
    assert.ok(!(await page.locator('body').innerText()).includes('불러오지 못했습니다'), route);
    assert.equal((await overflow(page))[0].x, 0, route);
    await page.screenshot({ path: artifact('live-' + route.replace(/[^a-z0-9]/gi, '-') + '.png') });
    console.log('LIVE', route, { title: await page.title(), viewports: await overflow(page) });
  }
  const row = page.getByRole('button').filter({ hasText: '워크돌' }).filter({ hasText: '2026' }).first();
  await row.click(); await page.waitForTimeout(1800);
  assert.match(page.url(), /\/schedule\/\d+/);
  assert.ok(!(await page.locator('body').innerText()).includes('일정을 찾을 수 없습니다'));
  await page.screenshot({ path: artifact('live-schedule-detail.png') });
  console.log('LIVE detail', page.url(), 'iframes', await page.locator('iframe').count());
  await page.goBack(); await page.waitForTimeout(600); assert.match(page.url(), /search=/);
  console.log('LIVE errors', errors); assert.deepEqual(errors, []);
  await context.close();
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
