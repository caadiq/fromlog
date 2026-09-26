const assert = require('node:assert/strict');
const { launch, fixture, artifact, overflow, origin } = require('./base.cjs');
(async () => {
 const browser = await launch();
 try {
  const f = await fixture(browser, { width: 1280, height: 600 });
  const { page, state, go } = f;
  await go('/video/shorts');
  assert.equal(await page.locator('a[href*="youtube.com/shorts/"]').count(), 24);
  assert.equal((await overflow(page))[0].x, 0);
  await page.getByRole('button', { name: '전체 채널' }).click(); await page.waitForTimeout(250);
  let box = await page.getByRole('listbox').boundingBox(); assert.ok(box.y + box.height < 600);
  await page.keyboard.press('End'); await page.keyboard.press('Enter');
  assert.match(page.url(), /channel=/);
  await page.waitForTimeout(600);
  const title = page.locator('a[href*="youtube.com/shorts/"] b').first();
  await title.hover(); await page.getByRole('tooltip').waitFor();
  box = await page.getByRole('tooltip').boundingBox(); assert.ok(box.y >= 0 && box.y + box.height <= 600);
  await page.mouse.wheel(0, 200); await page.waitForTimeout(100);
  assert.equal(await page.getByRole('tooltip').count(), 0);
  console.log('PASS shorts/channel/long tooltip/scroll dismissal');
  await go('/schedule');
  await page.getByRole('button', { name: '2026. 9' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '8', exact: true }).click();
  await page.locator('[data-calendar-month="2026-8"]').waitFor();
  assert.equal(await page.locator('[data-calendar-month]').getAttribute('data-calendar-month'), '2026-8');
  assert.equal(await page.locator('[data-calendar-month] button').count(), 31);
  const august = await overflow(page); assert.ok(august[0].y > 0);
  await page.setViewportSize({ width: 1920, height: 1080 }); await page.waitForTimeout(650);
  assert.ok((await overflow(page))[0].y <= 2, 'six-week month fits after resize');
  await page.setViewportSize({ width: 1280, height: 400 }); await page.waitForTimeout(300);
  await page.getByRole('button', { name: '2026. 8' }).click(); await page.waitForTimeout(300);
  box = await page.getByRole('dialog').boundingBox(); assert.ok(box.y + box.height <= 400);
  await page.getByRole('dialog').getByRole('button', { name: '2', exact: true }).click(); await page.locator('[data-calendar-month="2026-2"]').waitFor();
  assert.equal(await page.locator('[data-calendar-month] button').count(), 28);
  await page.setViewportSize({ width: 1440, height: 900 });
  state.empty = true; await go('/schedule'); await page.getByText(/이 날의 일정이 없습니다|이 달의 일정이 없습니다/).waitFor();
  state.empty = false;
  console.log('PASS four/six-week calendar/resize/short viewport picker/empty');

  const categories = ['유튜브', 'X', '행사', '예능', '기타', '팬사인회', '티켓팅', '콘서트', '사용자 분류'];
  for (const name of categories) {
    state.detail = { category: { name, color: '#141613' }, title: '긴 일정 제목 '.repeat(15), description: '긴 상세 설명 '.repeat(30), content: '긴 X 본문 https://example.com/' + 'a'.repeat(180), videoType: name === '유튜브' ? 'shorts' : 'video', broadcaster: '검증 방송사', stage: 'general', postUrls: ['https://example.com/post'], posters: [{ id: 1, originalUrl: origin + '/test-poster.svg', mediumUrl: origin + '/test-poster.svg' }, { id: 2, originalUrl: origin + '/test-poster.svg', mediumUrl: origin + '/test-poster.svg' }] };
    await go('/schedule/9000');
    assert.deepEqual(state.errors, [], name + ' runtime');
    const sizes = await overflow(page);
    console.log('detail', name, sizes[0]);
    assert.equal(sizes[0].x, 0, name + ' horizontal overflow');
    if (name === '행사') {
      await page.getByRole('button', { name: /포스터 1/ }).first().click();
      await page.getByRole('dialog', { name: '이미지 뷰어' }).waitFor();
      await page.keyboard.press('ArrowRight'); await page.keyboard.press('Escape');
      await page.getByRole('dialog', { name: '이미지 뷰어' }).waitFor({ state: 'hidden' });
      assert.match(page.url(), /schedule\/9000$/);
      await page.screenshot({ path: artifact('event-detail.png') });
    }
  }
  state.detail = { date: null, category: { name: '사용자 분류' } }; await go('/schedule/9000');
  await page.getByText('날짜 미정', { exact: true }).waitFor();
  state.detail = { date: '2026-10-01', time: '19:00', datePrecision: 'month', category: { name: '기타' } }; await go('/schedule/9000');
  assert.ok((await page.locator('body').innerText()).includes('2026. 10. (날짜 미정)'));
  assert.equal(await page.getByText('19:00', { exact: true }).count(), 0); // Month precision must not imply a confirmed day or time.
  assert.deepEqual(state.errors, []);
  console.log('PASS detail categories/long content/poster gallery/unknown date');
  await f.context.close();
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
