const {
    launch,
    fixture,
    origin,
    artifact
  } = require('./base.cjs'),
  assert = require('node:assert/strict');
(async () => {
  const b = await launch();
  let n = 0;
  const run = async (name, fn) => {
    const f = await fixture(b, {
      width: 1100,
      height: 600
    });
    f.page.setDefaultTimeout(7000);
    try {
      await fn(f);
      assert.deepEqual(f.errors, []);
      console.log('PASS', ++n, name);
    } catch (e) {
      console.error('FAIL', name, e.message);
      await f.page.screenshot({
        path: artifact('extended-fail.png')
      });
      throw e;
    } finally {
      await f.context.close();
    }
  };
  try {
    for (const [path, endpoint] of [['members/송하영/edit', '/members/%EC%86%A1%ED%95%98%EC%98%81'], ['albums/118/edit', '/albums/118'], ['albums/118/photos', '/albums/118/photos'], ['track/196/fanchant', '/fanchant/196/admin'], ['schedule/999/edit', '/schedules/999'], ['schedule/999/edit/youtube', '/schedules/999'], ['schedule/999/edit/event', '/admin/events/999'], ['schedule/999/edit/etc', '/admin/etc/999'], ['schedule/999/edit/variety', '/admin/variety/schedule/999'], ['schedule/concert/999/edit', '/admin/concert/schedule/999'], ['schedule/999/edit/fansign', '/schedules/999'], ['schedule/999/edit/ticketing', '/schedules/999']]) await run('form load failure: ' + path, async ({
      page: p,
      state: s
    }) => {
      s.fail = endpoint;
      await p.goto(origin + '/admin/' + path);
      await p.getByText('정보를 불러오지 못했습니다.', {
        exact: true
      }).waitFor();
      assert.equal(s.writes.length, 0);
    });
    await run('member and album save failure preserves values then retry succeeds', async ({
      page: p,
      state: s
    }) => {
      for (const path of ['members/송하영/edit', 'albums/118/edit']) {
        await p.goto(origin + '/admin/' + path);
        await p.waitForTimeout(400);
        const input = p.locator('input[type=text]').first();
        const value = await input.inputValue();
        assert.ok(value);
        s.override = async ({
          req
        }) => req.method() !== 'GET' ? {
          status: 503,
          body: {
            error: '저장 실패'
          }
        } : null;
        await p.locator('button[type=submit]').click();
        await p.waitForTimeout(200);
        assert.equal(await input.inputValue(), value);
        s.override = null;
        s.delay = 400;
        const before = s.writes.length;
        await p.locator('button[type=submit]').click();
        assert.ok(await p.locator('button[type=submit]').isDisabled());
        await p.waitForTimeout(700);
        assert.equal(s.writes.length, before + 1);
        assert.ok(!p.url().endsWith('/edit'));
      }
    });
    for (const type of ['event', 'etc', 'variety']) await run(type + ' edit populated save', async ({
      page: p,
      state: s
    }) => {
      await p.goto(origin + '/admin/schedule/999/edit/' + type);
      await p.waitForTimeout(450);
      s.delay = 300;
      await p.locator('button[type=submit]').click();
      await p.waitForTimeout(650);
      assert.equal(s.writes.length, 1);
      assert.match(s.writes[0].body, /테스트 일정/);
    });
    await run('logs search, actor filter, page bounds and low height detail', async ({
      page: p,
      state: s
    }) => {
      s.override = async ({
        p: path
      }) => path === '/admin/logs' ? {
        body: {
          logs: [{
            id: 1,
            created_at: '2026-09-26T12:00:00Z',
            actor: 'admin',
            category: 'schedule',
            action: 'create',
            summary: '테스트 일정 등록',
            details: {
              id: 999
            }
          }],
          total: 60,
          totalPages: 2,
          page: 1
        }
      } : null;
      await p.goto(origin + '/admin/logs');
      await p.getByPlaceholder('내용 검색').fill('테스트');
      await p.waitForTimeout(450);
      assert.ok(s.requests.some(x => x.includes('search=') && x.includes('/admin/logs?')));
      await p.getByRole('button', {
        name: '전체 행위자',
        exact: true
      }).click();
      await p.getByRole('button', {
        name: '관리자',
        exact: true
      }).click();
      await p.waitForTimeout(250);
      assert.ok(s.requests.some(x => x.includes('actor=admin')));
      const input = p.getByLabel('페이지 번호 입력');
      await input.fill('999');
      await input.press('Enter');
      assert.equal(await input.inputValue(), '2');
      await p.setViewportSize({
        width: 1440,
        height: 350
      });
      await p.getByRole('row').filter({
        hasText: '테스트 일정 등록'
      }).click();
      await p.waitForTimeout(250);
      const d = p.getByRole('dialog');
      const box = await d.boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= 351);
      await p.screenshot({
        path: artifact('after-log-350.png')
      });
      await p.keyboard.press('Escape');
      await p.waitForTimeout(300);
      await d.waitFor({
        state: 'hidden'
      });
    });
    await run('empty list pages and zero totals', async ({
      page: p,
      state: s
    }) => {
      s.empty = true;
      for (const path of ['members', 'albums', 'videos', 'logs', 'schedule/queue', 'schedule/bots', 'schedule/links']) {
        await p.goto(origin + '/admin/' + path);
        await p.waitForTimeout(350);
        assert.ok((await p.locator('body').innerText()).length > 100);
        assert.equal(s.writes.length, 0);
        assert.equal(await p.getByText('정보를 불러오지 못했습니다.', {
          exact: true
        }).count(), 0);
      }
    });
    await run('reduced motion and mobile shared confirm smoke', async ({
      page: p,
      state: s
    }) => {
      await p.emulateMedia({
        reducedMotion: 'reduce'
      });
      await p.goto(origin + '/admin/videos');
      for (let i = 0; i < 4; i++) {
        await p.getByRole('button', {
          name: '삭제',
          exact: true
        }).first().click();
        await p.keyboard.press('Escape');
        await p.waitForTimeout(50);
        await p.getByRole('alertdialog').waitFor({
          state: 'hidden'
        });
      }
      await p.setViewportSize({
        width: 390,
        height: 844
      });
      await p.goto(origin + '/admin/videos');
      await p.getByRole('button', {
        name: '삭제',
        exact: true
      }).first().click();
      await p.getByRole('alertdialog').waitFor();
      await p.keyboard.press('Escape');
      await p.waitForTimeout(100);
      await p.getByRole('alertdialog').waitFor({
        state: 'hidden'
      });
      assert.equal(s.writes.length, 0);
    });
    console.log('TOTAL', n);
  } finally {
    await b.close();
  }
})().catch(() => process.exitCode = 1);
