const assert = require('node:assert/strict');
const { launch, fixture, artifact, overflow } = require('./base.cjs');
async function eventually(check, message) {
  let error;
  for (let i = 0; i < 60; i++) { try { await check(); return; } catch (e) { error = e; await new Promise(r => setTimeout(r, 100)); } }
  throw new Error(message + ': ' + error?.message);
}
(async () => {
 const browser = await launch();
 try {
  // Real routes with intercepted read-only API responses.
  let f = await fixture(browser), { page, state, go } = f;
  state.fail = p => p === '/videos/home'; await go('/video');
  await page.getByText('영상을 불러오지 못했습니다.').waitFor();
  state.fail = null; await page.getByRole('button', { name: '다시 시도' }).click();
  await page.locator('a[href*="watch?v="]').first().waitFor();
  await page.getByRole('img', { name: /썸네일 없음/ }).first().waitFor();
  assert.equal((await overflow(page))[0].x, 0);
  assert.equal(await page.locator('a[href*="watch?v="]').first().getAttribute('target'), '_blank');
  assert.match(await page.locator('a[href*="watch?v="]').first().getAttribute('rel'), /noopener/);
  await page.waitForTimeout(800);
  await page.screenshot({ path: artifact('video-home.png') });
  state.empty = true; await go('/video'); await page.getByText('등록된 영상이 없습니다.').waitFor();
  state.fail = p => p === '/videos'; await go('/video/variety');
  await page.getByText('영상을 불러오지 못했습니다.').waitFor();
  state.fail = null; await page.getByRole('button', { name: '다시 시도' }).click();
  await page.getByText('조건에 맞는 영상이 없습니다.').waitFor();
  state.empty = false; await go('/video/variety');
  const channel = page.getByRole('button', { name: '전체 채널', exact: true });
  await channel.click(); await page.waitForTimeout(250); await page.getByRole('option', { name: /VeryLong/ }).click();
  await eventually(async () => assert.match(page.url(), /channel=/), 'channel URL');
  assert.equal((await overflow(page))[0].x, 0);
  await page.reload(); await page.waitForTimeout(1200);
  const trigger = page.getByRole('button', { name: /VeryLong/ });
  await trigger.focus(); await page.keyboard.press('ArrowDown');
  await page.getByRole('listbox').waitFor();
  await page.keyboard.press('Escape');
  await eventually(async () => assert.equal(await page.getByRole('listbox').count(), 0), 'escape closes channel');
  assert.equal(await trigger.evaluate(e => e === document.activeElement), true);
  await page.goBack(); await channel.waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: artifact('video-list.png') });
  await f.context.close(); console.log('PASS video home/error/empty/external/filter/refresh/history/keyboard');

  f = await fixture(browser); ({ page, state, go } = f);
  state.fail = (p, u) => p === '/videos' && Number(u.searchParams.get('offset')) > 0;
  await go('/video/variety');
  const scroll = page.locator('.pc-public [data-overlayscrollbars-viewport]').first();
  await scroll.evaluate(e => e.scrollTop = e.scrollHeight);
  await page.getByText('다음 영상을 불러오지 못했습니다.').waitFor();
  const calls = state.requests.filter(x => x.startsWith('/videos?')).length;
  await page.waitForTimeout(1800);
  assert.equal(state.requests.filter(x => x.startsWith('/videos?')).length, calls, 'failed pagination must stop retrying');
  state.fail = null; await page.getByRole('button', { name: '다시 시도' }).click();
  await eventually(async () => assert.equal(await page.locator('a[href*="watch?v="]').count(), 48), 'pagination retry');
  assert.equal(new Set(await page.locator('a[href*="watch?v="]').evaluateAll(es => es.map(e => e.href))).size, 48);
  assert.deepEqual(state.errors, []); await f.context.close(); console.log('PASS pagination failure/retry/no duplicate');

  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1100, height: 700 }, { width: 1280, height: 600 }]) {
    f = await fixture(browser, viewport); ({ page, state, go } = f);
    await go('/schedule');
    await page.getByRole('button', { name: 'TODAY', exact: true }).click();
    await page.getByRole('button', { name: /9월 26일/ }).click();
    await page.waitForTimeout(650);
    const sizes = await overflow(page); console.log('schedule', viewport, sizes);
    assert.equal(sizes[0].x, 0);
    if (viewport.height >= 900) assert.ok(sizes[0].y <= 2, 'no page overflow when calendar fits');
    assert.ok(sizes.at(-1).y > 0, 'long list scrolls internally');
    await page.getByRole('button', { name: '다음 달', exact: true }).click();
    await page.locator('[data-calendar-month="2026-10"]').waitFor();
    await page.getByRole('button', { name: '다음 달', exact: true }).click();
    await page.getByRole('button', { name: '다음 달', exact: true }).click();
    await eventually(async () => assert.equal(await page.locator('[data-calendar-month]').count(), 1), 'calendar exit completes');
    await page.waitForTimeout(400);
    assert.equal(await page.locator('[data-calendar-month]').getAttribute('data-calendar-month'), '2026-12');
    await page.getByRole('button', { name: '이전 달', exact: true }).click();
    await page.waitForTimeout(350); assert.equal(await page.locator('[data-calendar-month]').getAttribute('data-calendar-month'), '2026-11');
    await page.getByRole('button', { name: 'TODAY', exact: true }).click();
    await page.waitForTimeout(350);
    await page.getByRole('button', { name: '2026. 9' }).click();
    await page.waitForTimeout(300);
    const box = await page.getByRole('dialog', {name:'연도와 월 선택'}).boundingBox();
    console.log('picker', viewport, box);
    assert.ok(box.y + box.height <= viewport.height + 1, 'month picker is visible');
    await page.keyboard.press('Escape');
    await eventually(async () => assert.equal(await page.getByRole('dialog').count(), 0), 'Escape closes month picker');
    await page.screenshot({ path: artifact(`schedule-${viewport.width}x${viewport.height}.png`) });
    assert.deepEqual(state.errors, []); await f.context.close();
  }
  console.log('PASS schedule viewport/calendar/rapid navigation');

  f = await fixture(browser); ({ page, state, go } = f);
  state.fail = p => p === '/schedules'; await go('/schedule');
  await page.getByText('일정을 불러오지 못했습니다.').waitFor();
  state.fail = null; await page.getByRole('button', { name: '다시 시도' }).click();
  await page.getByRole('button', { name: /검증 일정 0/ }).waitFor();
  const categoryChip = page.getByRole('button', { name: /^유튜브 / });
  await categoryChip.click();
  await page.getByRole('button', { name: /검증 일정 0/ }).click();
  await page.getByRole('heading', { name: '검증 일정 상세' }).waitFor();
  await page.goBack(); await categoryChip.waitFor();
  assert.match(await categoryChip.getAttribute('class'), /bg-ink/);
  assert.equal(await page.getByRole('button', { name: /검증 일정 1 / }).count(), 0);
  await page.getByRole('button', { name: /^전체 / }).click();
  await page.getByRole('button', { name: '검색', exact: true }).click();
  const input = page.locator('input').first(); await input.fill('검증'); await input.press('Enter');
  await page.getByRole('button', { name: /검증 일정 0/ }).click();
  await page.getByRole('heading', { name: '검증 일정 상세' }).waitFor();
  const embed = page.locator('iframe[src*="youtube.com/embed"]'); assert.match(await embed.getAttribute('src'), /testvid0000/);
  assert.match(await embed.getAttribute('allow'), /encrypted-media/);
  assert.notEqual(await embed.getAttribute('allowfullscreen'), null);
  await page.goBack(); await input.waitFor(); assert.equal(await input.inputValue(), '검증');
  await page.goBack(); await eventually(async () => assert.equal(await input.inputValue(), ''), 'result back to empty search');
  state.fail = p => p === '/schedules/9000'; await go('/schedule/9000');
  await page.getByText('일정을 불러오지 못했습니다.').waitFor(); assert.equal(await page.getByText('404', { exact: true }).count(), 0);
  state.fail = null; await page.getByRole('button', { name: '다시 시도' }).click(); await page.getByRole('heading', { name: '검증 일정 상세' }).waitFor();
  state.fail = p => p === '/schedules/9000' ? 404 : false; await go('/schedule/9000'); await page.getByText('404', { exact: true }).waitFor();
  assert.deepEqual(state.errors, []); await f.context.close(); console.log('PASS schedule error/search/detail/back/404');

  f = await fixture(browser, { width: 1440, height: 900 }, 'reduce'); ({ page, go } = f);
  await go('/schedule'); await page.getByRole('button', { name: '다음 달', exact: true }).click(); await page.waitForTimeout(50);
  assert.equal(await page.locator('[data-calendar-month]').count(), 1);
  assert.equal(await page.locator('[data-calendar-month]').evaluate(e => getComputedStyle(e).transform), 'none');
  await f.context.close(); console.log('PASS reduced motion');
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
