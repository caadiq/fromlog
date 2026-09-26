const { launch, fixture, origin } = require('./base.cjs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await launch();
  const { page, context, state, errors } = await fixture(browser);
  page.setDefaultTimeout(7000);
  try {
    await page.clock.setFixedTime(new Date('2026-09-26T12:00:00+09:00'));
    await page.goto(origin + '/admin/schedule');
    const category = page.getByRole('button', { name: /^행사\s*1$/ });
    await category.click();
    await page.getByRole('button', { name: '편집', exact: true }).click();
    await page.getByRole('button', { name: '수정', exact: true }).click();
    assert.match(page.url(), /999\/edit\/event/);
    await page.goBack();
    await category.waitFor();
    assert.match(await category.getAttribute('class'), /bg-ink/);
    await page.reload();
    await category.waitFor();
    assert.match(await category.getAttribute('class'), /bg-ink/);
    await page.getByRole('button', { name: '편집', exact: true }).click();
    await page.getByRole('button', { name: '삭제', exact: true }).click();
    await page.goBack();
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
    assert.match(page.url(), /admin\/schedule$/);
    assert.equal(state.writes.length, 0);
    assert.deepEqual(errors, []);
    console.log('PASS schedule edit/back/reload preserves category; Back cancels deletion');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
