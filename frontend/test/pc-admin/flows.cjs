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
      width: 1440,
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
        path: artifact('flow-fail.png')
      });
      throw e;
    } finally {
      await f.context.close();
    }
  };
  try {
    await run('queue ignore cancel, failed mutation and retry', async ({
      page: p,
      state: s
    }) => {
      await p.goto(origin + '/admin/schedule/queue');
      await p.getByRole('button', {
        name: '무시',
        exact: true
      }).click();
      await p.keyboard.press('Escape');
      await p.waitForTimeout(350);
      assert.equal(s.writes.length, 0);
      await p.getByRole('button', {
        name: '무시',
        exact: true
      }).click();
      s.override = async ({
        req
      }) => req.method() !== 'GET' ? {
        status: 503,
        body: {
          error: '무시 실패 테스트'
        }
      } : null;
      await p.getByRole('alertdialog').getByRole('button', {
        name: '무시',
        exact: true
      }).click();
      await p.getByText('무시 실패 테스트').waitFor();
      s.override = null;
      s.delay = 350;
      await p.getByRole('alertdialog').getByRole('button', {
        name: '무시',
        exact: true
      }).click();
      await p.keyboard.press('Escape');
      assert.ok(await p.getByRole('alertdialog').isVisible());
      await p.waitForTimeout(750);
      assert.equal(s.writes.length, 1);
      await p.getByRole('alertdialog').waitFor({
        state: 'hidden'
      });
    });
    await run('queue required fields, failed register keeps values, delayed save blocks close', async ({
      page: p,
      state: s
    }) => {
      await p.goto(origin + '/admin/schedule/queue');
      await p.getByRole('button', {
        name: '등록',
        exact: true
      }).click();
      const d = p.getByRole('dialog'),
        submit = d.getByRole('button', {
          name: '등록',
          exact: true
        });
      assert.ok(await submit.isDisabled());
      await d.locator('input[type=text]').nth(1).fill('JTBC');
      s.override = async ({
        req
      }) => req.method() !== 'GET' ? {
        status: 503,
        body: {
          error: '등록 실패'
        }
      } : null;
      await submit.click();
      await p.waitForTimeout(250);
      assert.ok(await d.isVisible());
      assert.equal(await d.locator('input[type=text]').nth(1).inputValue(), 'JTBC');
      s.override = null;
      s.delay = 400;
      await submit.click();
      await p.keyboard.press('Escape');
      assert.ok(await d.isVisible());
      assert.ok(await d.getByRole('button', {
        name: '닫기',
        exact: true
      }).isDisabled());
      await p.waitForTimeout(800);
      assert.equal(s.writes.length, 1);
      assert.match(s.writes[0].body, /JTBC/);
    });
    await run('bot stop/start, sync single flight, delete failed and retry', async ({
      page: p,
      state: s
    }) => {
      await p.goto(origin + '/admin/schedule/bots');
      const r = p.getByRole('row').filter({
        hasText: '테스트 youtube'
      });
      await r.getByRole('button', {
        name: '정지',
        exact: true
      }).click();
      await r.getByRole('button', {
        name: '시작',
        exact: true
      }).click();
      s.delay = 350;
      await r.getByRole('button', {
        name: '동기화',
        exact: true
      }).click();
      assert.ok(await r.getByRole('button', {
        name: '정지',
        exact: true
      }).isDisabled());
      await p.waitForTimeout(600);
      await r.getByRole('button', {
        name: '삭제',
        exact: true
      }).click();
      s.override = async ({
        req
      }) => req.method() === 'DELETE' ? {
        status: 503,
        body: {
          error: '봇 삭제 실패'
        }
      } : null;
      await p.getByRole('alertdialog').getByRole('button', {
        name: '삭제',
        exact: true
      }).click();
      await p.getByText('봇 삭제 실패', {
        exact: true
      }).waitFor();
      s.override = null;
      await p.getByRole('alertdialog').getByRole('button', {
        name: '삭제',
        exact: true
      }).click();
      await p.waitForTimeout(650);
      assert.equal(s.writes.length, 4);
      assert.ok(s.writes.every(w => !w.p.includes('undefined')));
    });
    for (const type of ['youtube', 'x', 'festival']) await run(type + ' bot edit low height, dropdown keyboard, Escape', async ({
      page: p
    }) => {
      await p.setViewportSize({
        width: 1440,
        height: 450
      });
      await p.goto(origin + '/admin/schedule/bots');
      await p.getByRole('row').filter({
        hasText: '테스트 ' + type
      }).getByRole('button', {
        name: '수정',
        exact: true
      }).click();
      const d = p.getByRole('dialog');
      await p.waitForTimeout(500);
      const box = await d.boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= 451);
      const select = d.locator('[aria-haspopup=listbox]').first();
      await select.click();
      await p.waitForTimeout(200);
      const menu = p.getByRole('listbox'),
        mb = await menu.boundingBox();
      assert.ok(mb.y >= 0 && mb.y + mb.height <= 451);
      await p.keyboard.press('End');
      await p.keyboard.press('Enter');
      await p.waitForTimeout(200);
      await menu.waitFor({
        state: 'hidden'
      });
      await p.keyboard.press('Escape');
      await p.waitForTimeout(350);
      await d.waitFor({
        state: 'hidden'
      });
    });
    await run('link required/title URL/date validation and save lock', async ({
      page: p,
      state: s
    }) => {
      await p.goto(origin + '/admin/schedule/links');
      await p.getByRole('button', {
        name: /링크 추가/
      }).click();
      const d = p.getByRole('dialog');
      await d.getByRole('button', {
        name: '저장',
        exact: true
      }).click();
      await p.getByText('제목을 입력해주세요.', {
        exact: true
      }).waitFor();
      await p.getByLabel('제목', {
        exact: true
      }).fill('검증 링크');
      await p.getByLabel('URL', {
        exact: true
      }).fill('https://example.com');
      await p.getByLabel('시작일 (선택)').fill('2026-09-30T10:00');
      await p.getByLabel('종료일 (선택)').fill('2026-09-29T10:00');
      await d.getByRole('button', {
        name: '저장',
        exact: true
      }).click();
      await p.getByText('종료일이 시작일보다 빠릅니다.').waitFor();
      assert.equal(s.writes.length, 0);
      await p.getByLabel('종료일 (선택)').fill('');
      s.delay = 400;
      await d.getByRole('button', {
        name: '저장',
        exact: true
      }).click();
      await p.keyboard.press('Escape');
      assert.ok(await d.isVisible());
      assert.ok(await d.getByRole('button', {
        name: '취소'
      }).isDisabled());
      await p.waitForTimeout(750);
      assert.equal(s.writes.length, 1);
    });
    await run('theme invalid manual color, partial reextract preserves draft and mutual lock', async ({
      page: p,
      state: s
    }) => {
      await p.goto(origin + '/admin/theme');
      await p.getByRole('button', {
        name: /수동 직접 지정/
      }).click();
      const input = p.locator('input[type=text]');
      await input.fill('#xx');
      await p.getByRole('button', {
        name: '저장',
        exact: true
      }).click();
      await p.getByText('색상 코드를 #RRGGBB 형식으로 입력해주세요.').waitFor();
      assert.equal(s.writes.length, 0);
      await input.fill('#112233');
      s.override = async ({
        p: path
      }) => {
        if (path === '/admin/theme/reextract') {
          await new Promise(r => setTimeout(r, 400));
          return {
            body: {
              updated: 2,
              failed: 1
            }
          };
        }
      };
      await p.getByRole('button', {
        name: '앨범 색 재추출'
      }).click();
      assert.ok(await p.getByRole('button', {
        name: '저장',
        exact: true
      }).isDisabled());
      await p.getByText('2개 앨범 색을 다시 추출했습니다. 1개 실패: 다시 시도해주세요.').waitFor();
      assert.equal(await input.inputValue(), '#112233');
      s.override = null;
      await p.getByRole('button', {
        name: '저장',
        exact: true
      }).click();
      await p.waitForTimeout(400);
      assert.deepEqual(JSON.parse(s.writes[0].body), {
        mode: 'manual',
        manualColor: '#112233'
      });
    });
    console.log('TOTAL', n);
  } finally {
    await b.close();
  }
})().catch(() => process.exitCode = 1);
