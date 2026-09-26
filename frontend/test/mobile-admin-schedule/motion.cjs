const {
  run,
  create,
  origin,
  assert
} = require('./base.cjs');
const wait = ms => new Promise(r => setTimeout(r, ms));
run([['drawer intermediate backdrop and panel motion', async f => {
  const p = f.page;
  await p.goto(origin + '/admin');
  await p.getByLabel('관리 메뉴 열기').click();
  await wait(60);
  const opening = await p.locator('.mobile-admin-menu-backdrop').evaluate(el => +getComputedStyle(el).opacity);
  assert(opening > 0 && opening < 1, 'intermediate opacity ' + opening);
  await wait(250);
  await p.getByLabel('관리 메뉴 닫기').click();
  await wait(50);
  assert.equal(await p.locator('dialog[open]').getAttribute('data-state'), 'closing');
  await wait(250);
  assert.equal(await p.locator('dialog[open]').count(), 0);
  await p.getByLabel('관리 메뉴 열기').click();
  await p.goBack();
  await wait(300);
  assert.equal(await p.locator('dialog[open]').count(), 0);
}], ['form exit slides down and releases modal', async f => {
  await create(f);
  const p = f.page;
  await wait(300);
  await p.getByLabel('추가 닫기').click();
  await wait(70);
  const y = await p.locator('dialog.mobile-queue-review').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42);
  assert(y > 0 && y < 844, 'intermediate exit ' + y);
  await wait(400);
  assert(p.url().endsWith('/admin/schedule'));
  assert.equal(await p.locator('dialog[open]').count(), 0);
}], ['rotation and larger text preserve form draft', async f => {
  await create(f, '행사');
  const p = f.page;
  await p.setViewportSize({
    width: 844,
    height: 390
  });
  await wait(250);
  assert.equal(await p.getByLabel('일정 제목 *', {
    exact: true
  }).inputValue(), '검증 일정');
  await p.setViewportSize({
    width: 320,
    height: 568
  });
  await p.addStyleTag({
    content: 'html{font-size:20px}'
  });
  await p.getByLabel('학교 *', {
    exact: true
  }).fill('회전대학교');
  await p.getByLabel('포스터 추가', {
    exact: true
  }).click();
  await wait(300);
  const m = await p.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    box: document.querySelector('dialog[aria-labelledby=poster-dialog-title]').getBoundingClientRect().toJSON()
  }));
  assert(!m.overflow);
  assert(m.box.x >= 0 && m.box.x + m.box.width <= 320 && m.box.y >= 0 && m.box.y + m.box.height <= 568);
  await p.goBack();
  await wait(250);
  assert.equal(await p.getByLabel('학교 *', {
    exact: true
  }).inputValue(), '회전대학교');
}]]).catch(() => process.exitCode = 1);
