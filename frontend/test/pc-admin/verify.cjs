const {
  launch,
  fixture,
  origin,
  artifact
} = require('./base.cjs');
const assert = require('node:assert/strict');
(async () => {
  const b = await launch();
  let passed = 0;
  const run = async (name, fn) => {
    try {
      await fn();
      console.log('PASS', ++passed, name);
    } catch (e) {
      console.error('FAIL', name, e.message);
      throw e;
    }
  };
  try {
    await run('preview invalidated by URL changes, stale responses and repeated close/open', async () => {
      const f = await fixture(b, {
          width: 1440,
          height: 450
        }),
        p = f.page;
      await p.goto(origin + '/admin/videos');
      await p.getByRole('button', {
        name: '영상 등록',
        exact: true
      }).click();
      const input = p.getByPlaceholder('https://youtu.be/... 또는 쇼츠 URL');
      await input.fill('https://youtu.be/aaaaaaaaaaa');
      await p.getByRole('button', {
        name: '조회',
        exact: true
      }).click();
      await p.getByText('조회한 영상 A').waitFor();
      await input.fill('https://youtu.be/bbbbbbbbbbb');
      assert.ok(await p.getByRole('button', {
        name: '등록',
        exact: true
      }).isDisabled());
      assert.equal(await p.getByText('조회한 영상 A').count(), 0);
      f.state.override = async ({
        p
      }) => {
        if (p === '/admin/videos/preview') {
          await new Promise(r => setTimeout(r, 300));
          return {
            body: {
              videoId: 'old',
              title: '늦은 응답',
              videoType: 'video'
            }
          };
        }
      };
      await p.getByRole('button', {
        name: '조회',
        exact: true
      }).click();
      await input.fill('https://youtu.be/ccccccccccc');
      await p.waitForTimeout(450);
      assert.equal(await p.getByText('늦은 응답').count(), 0);
      await p.keyboard.press('Escape');
      await p.waitForTimeout(350);
      await p.getByRole('dialog').waitFor({
        state: 'hidden'
      });
      for (let i = 0; i < 4; i++) {
        await p.getByRole('button', {
          name: '영상 등록',
          exact: true
        }).click();
        await p.waitForTimeout(50);
        await p.keyboard.press('Escape');
        await p.waitForTimeout(330);
      }
      await p.getByRole('dialog').waitFor({
        state: 'hidden'
      });
      assert.match(p.url(), /admin\/videos$/);
      assert.deepEqual(f.errors, []);
      await f.context.close();
    });
    await run('video preview/save visible at low height; save blocks close and duplicate submission', async () => {
      const f = await fixture(b, {
          width: 1440,
          height: 350
        }),
        p = f.page;
      await p.goto(origin + '/admin/videos');
      await p.getByRole('button', {
        name: '영상 등록',
        exact: true
      }).click();
      await p.getByPlaceholder('https://youtu.be/... 또는 쇼츠 URL').fill('https://youtu.be/aaaaaaaaaaa');
      await p.getByRole('button', {
        name: '조회',
        exact: true
      }).click();
      await p.getByText('조회한 영상 A').waitFor();
      await p.waitForTimeout(350);
      const box = await p.getByRole('dialog').boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= 350);
      await p.screenshot({
        path: artifact('after-video-350.png')
      });
      f.state.delay = 450;
      await p.getByRole('button', {
        name: '등록',
        exact: true
      }).click();
      await p.keyboard.press('Escape');
      assert.ok(await p.getByRole('dialog').isVisible());
      assert.ok(await p.getByRole('button', {
        name: '취소',
        exact: true
      }).isDisabled());
      await p.waitForTimeout(650);
      assert.equal(f.state.writes.filter(r => r.p === '/admin/videos').length, 1);
      await f.context.close();
    });
    await run('video deletion keeps dialog after error, locks while saving, corrects empty last page', async () => {
      const f = await fixture(b),
        p = f.page;
      await p.goto(origin + '/admin/videos');
      await p.getByRole('button', {
        name: '다음 페이지'
      }).click();
      await p.getByText('테스트 영상 30', {
        exact: true
      }).waitFor();
      await p.getByRole('button', {
        name: '삭제',
        exact: true
      }).click();
      f.state.override = async ({
        req
      }) => req.method() === 'DELETE' ? {
        status: 503,
        body: {
          error: '삭제 실패 테스트'
        }
      } : null;
      await p.getByRole('alertdialog').getByRole('button', {
        name: '삭제',
        exact: true
      }).click();
      await p.getByRole('alertdialog').getByText('삭제 실패 테스트').waitFor();
      f.state.override = null;
      f.state.delay = 400;
      await p.getByRole('alertdialog').getByRole('button', {
        name: '삭제',
        exact: true
      }).click();
      assert.ok(await p.getByRole('button', {
        name: '삭제 중...'
      }).isDisabled());
      await p.waitForTimeout(900);
      await p.getByText('테스트 영상 1', {
        exact: true
      }).waitFor();
      assert.equal(await p.getByRole('button', {
        name: '이전 페이지'
      }).count(), 0);
      assert.equal(f.state.writes.length, 1);
      await f.context.close();
    });
    await run('link modal low height scroll, Escape and keyboard focus containment', async () => {
      const f = await fixture(b, {
          width: 1440,
          height: 350
        }),
        p = f.page;
      await p.goto(origin + '/admin/schedule/links');
      await p.getByRole('button', {
        name: /링크 추가/
      }).click();
      await p.waitForTimeout(300);
      const dialog = p.getByRole('dialog');
      const box = await dialog.boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= 351);
      for (let i = 0; i < 12; i++) {
        await p.keyboard.press('Tab');
        assert.ok(await dialog.evaluate(el => el.contains(document.activeElement)));
      }
      await p.getByRole('button', {
        name: '저장',
        exact: true
      }).scrollIntoViewIfNeeded();
      await p.screenshot({
        path: artifact('after-link-350.png')
      });
      await p.keyboard.press('Escape');
      await p.waitForTimeout(350);
      await p.getByRole('dialog').waitFor({
        state: 'hidden'
      });
      assert.deepEqual(f.errors, []);
      await f.context.close();
    });
    for (const [path, endpoint] of Object.entries({
      dashboard: '/stats',
      members: '/members',
      albums: '/albums',
      videos: '/admin/videos',
      logs: '/admin/logs',
      theme: '/admin/theme',
      'schedule/queue': '/admin/pending',
      'schedule/bots': '/admin/bots',
      'schedule/links': '/admin/schedule-links',
      'schedule/dict': '/schedules/suggestions/dict',
      schedule: '/schedules'
    })) {
      await run('read failure and retry: ' + path, async () => {
        const f = await fixture(b);
        f.state.fail = endpoint;
        await f.page.goto(origin + '/admin/' + path);
        await f.page.getByText('정보를 불러오지 못했습니다.', {
          exact: true
        }).waitFor();
        f.state.fail = null;
        await f.page.getByRole('button', {
          name: '다시 시도',
          exact: true
        }).click();
        await f.page.waitForTimeout(400);
        assert.equal(await f.page.getByText('정보를 불러오지 못했습니다.', {
          exact: true
        }).count(), 0);
        assert.deepEqual(f.errors, []);
        assert.equal(f.state.writes.length, 0);
        await f.context.close();
      });
    }
    console.log('TOTAL', passed);
  } finally {
    await b.close();
  }
})().catch(() => process.exitCode = 1);
