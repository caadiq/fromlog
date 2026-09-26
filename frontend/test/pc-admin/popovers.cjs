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
    const f = await fixture(b);
    f.page.setDefaultTimeout(7000);
    try {
      await fn(f);
      assert.deepEqual(f.errors, []);
      console.log('PASS', ++n, name);
    } catch (e) {
      console.error('FAIL', name, e.message);
      await f.page.screenshot({
        path: artifact('popovers-fail.png')
      });
      throw e;
    } finally {
      await f.context.close();
    }
  };
  try {
    for (const height of [600, 350]) for (const name of ['2026년 10월 1일', '오후 9:00']) await run(`queue picker ${name} at ${height}`, async ({
      page: p,
      state: s
    }) => {
      await p.setViewportSize({
        width: 1440,
        height
      });
      await p.goto(origin + '/admin/schedule/queue');
      await p.getByRole('button', {
        name: '등록',
        exact: true
      }).click();
      await p.getByRole('button', {
        name,
        exact: true
      }).click();
      await p.waitForTimeout(550);
      const fit = await p.locator('[data-picker-panel]').evaluate(el => {
        const a = el.getBoundingClientRect(),
          b = el.closest('[role=dialog]').getBoundingClientRect();
        return a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
      });
      assert.ok(fit);
      const panel = p.locator('[data-picker-panel]');
      if (name.includes('오후')) {
        await panel.getByRole('button', {
          name: '저장',
          exact: true
        }).click();
        await p.waitForTimeout(500);
        await panel.waitFor({
          state: 'hidden'
        });
      } else {
        await panel.getByRole('button', {
          name: '15',
          exact: true
        }).click();
        await p.getByRole('button', {
          name: '2026년 10월 15일',
          exact: true
        }).waitFor();
      }
      await p.screenshot({
        path: artifact(`picker-${height}-${name.includes('오후') ? 'time' : 'date'}.png`)
      });
      assert.equal(s.writes.length, 0);
    });
    await run('link save error toast and retry, update and delete', async ({
      page: p,
      state: s
    }) => {
      await p.goto(origin + '/admin/schedule/links');
      await p.getByRole('button', {
        name: '수정',
        exact: true
      }).click();
      await p.getByLabel('제목', {
        exact: true
      }).fill('변경 링크');
      s.override = async ({
        req
      }) => req.method() !== 'GET' ? {
        status: 503,
        body: {
          error: '링크 저장 실패'
        }
      } : null;
      await p.getByRole('button', {
        name: '저장',
        exact: true
      }).click();
      await p.getByText('링크 저장 실패', {
        exact: true
      }).waitFor();
      assert.equal(await p.getByLabel('제목', {
        exact: true
      }).inputValue(), '변경 링크');
      s.override = null;
      await p.getByRole('button', {
        name: '저장',
        exact: true
      }).click();
      await p.getByText('수정했습니다.', {
        exact: true
      }).waitFor();
      assert.equal(s.writes[0].method, 'PUT');
      await p.getByRole('button', {
        name: '삭제',
        exact: true
      }).click();
      await p.getByRole('alertdialog').getByRole('button', {
        name: '삭제',
        exact: true
      }).click();
      await p.getByText('삭제했습니다.', {
        exact: true
      }).waitFor();
      assert.equal(s.writes[1].method, 'DELETE');
    });
    await run('dictionary add and delete confirmation, search', async ({
      page: p,
      state: s
    }) => {
      await p.goto(origin + '/admin/schedule/dict');
      await p.getByPlaceholder('추가할 단어를 입력하세요').fill('검증용단어');
      await p.getByPlaceholder('추가할 단어를 입력하세요').press('Enter');
      await p.getByRole('alertdialog').getByRole('button', {
        name: '추가',
        exact: true
      }).click();
      await p.waitForTimeout(300);
      await p.getByPlaceholder('단어 검색').fill('검증용단어');
      await p.getByRole('row').filter({
        hasText: '검증용단어'
      }).getByRole('button', {
        name: '삭제',
        exact: true
      }).click();
      await p.getByRole('alertdialog').getByRole('button', {
        name: '삭제',
        exact: true
      }).click();
      await p.waitForTimeout(300);
      assert.equal(s.writes.length, 2);
      assert.ok(s.writes.every(w => w.p === '/schedules/suggestions/dict'));
    });
    await run('fanchant editor explicit save', async ({
      page: p,
      state: s
    }) => {
      await p.goto(origin + '/admin/track/196/fanchant');
      await p.getByPlaceholder('응원법 영상 YouTube ID').fill('testvideo01');
      await p.getByRole('button', {
        name: '저장',
        exact: true
      }).click();
      await p.waitForTimeout(400);
      assert.equal(s.writes.length, 1);
      assert.equal(s.writes[0].p, '/fanchant/196');
    });
    await run('PC boundary and CSS 125 percent zoom', async ({
      page: p
    }) => {
      for (const width of [1099, 1100, 1440]) {
        await p.setViewportSize({
          width,
          height: 700
        });
        for (const path of ['videos', 'schedule', 'schedule/bots']) {
          await p.goto(origin + '/admin/' + path);
          await p.waitForTimeout(300);
          await p.evaluate(() => document.documentElement.style.zoom = '1.25');
          await p.waitForTimeout(100);
          assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          await p.evaluate(() => document.documentElement.style.zoom = '');
        }
      }
    });
    console.log('TOTAL', n);
  } finally {
    await b.close();
  }
})().catch(() => process.exitCode = 1);
