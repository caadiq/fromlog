const {
  launch,
  fixture,
  origin,
  artifact,
  assert
} = require('./base.cjs');
const fs = require('node:fs');
(async () => {
  const b = await launch(),
    results = [];
  try {
    for (const viewport of [{
      width: 320,
      height: 568
    }, {
      width: 390,
      height: 844
    }, {
      width: 430,
      height: 932
    }, {
      width: 768,
      height: 1024
    }, {
      width: 844,
      height: 390
    }, {
      width: 1099,
      height: 700
    }]) {
      const f = await fixture(b, viewport),
        p = f.page;
      f.state.rows.push(...Array.from({
        length: 20
      }, (_, i) => ({
        ...f.state.rows[0],
        id: 2000 + i,
        title: '아주 긴 일정 제목 '.repeat(10)
      })));
      for (const route of ['/admin', '/admin/schedule', '/admin/schedule/queue', '/admin/schedule/new']) {
        await p.goto(origin + route);
        if (route === '/admin') await p.getByRole('heading', {
          name: '오늘의 관리'
        }).waitFor();
        if (route === '/admin/schedule') await p.getByRole('link', {
          name: '테스트대학교 별빛 상세 보기'
        }).waitFor();
        if (route === '/admin/schedule/queue') await p.getByRole('button', {
          name: '검토 후 등록'
        }).waitFor();
        if (route === '/admin/schedule/new') await p.locator('#create-video-url').waitFor();
        await p.waitForFunction(() => [...document.querySelectorAll('main [style]')].filter(el => el.style.opacity).every(el => Number(getComputedStyle(el).opacity) === 1));
        await p.waitForTimeout(100);
        const m = await p.evaluate(() => ({
          width: innerWidth,
          height: innerHeight,
          horizontal: document.documentElement.scrollWidth > innerWidth + 1,
          outer: document.documentElement.scrollHeight > innerHeight + 1,
          text: document.body.innerText.slice(0, 100)
        }));
        results.push({
          viewport,
          route,
          ...m
        });
        assert(!m.horizontal && !m.outer, JSON.stringify(results.at(-1)));
        assert.deepEqual(f.errors, []);
        if (viewport.width === 390) await p.screenshot({
          path: artifact(route.split('/').filter(Boolean).join('-') + '.png')
        });
      }
      await p.goto(origin + '/admin/schedule/queue');
      await p.getByRole('button', {
        name: '검토 후 등록'
      }).click();
      await p.waitForTimeout(400);
      const box = await p.locator('dialog.mobile-queue-review').boundingBox();
      assert(box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1);
      results.push({
        viewport,
        route: 'queue-review',
        box
      });
      if (viewport.width === 390) await p.screenshot({
        path: artifact('queue-review.png')
      });
      await f.context.close();
    }
    fs.writeFileSync(artifact('layout.json'), JSON.stringify(results, null, 2));
    console.log('PASS', results.length, 'mobile viewport/page combinations');
  } finally {
    await b.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
