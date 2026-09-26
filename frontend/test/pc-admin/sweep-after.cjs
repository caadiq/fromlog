const {
  launch,
  fixture,
  origin,
  artifact
} = require('./base.cjs');
const fs = require('fs');
(async () => {
  const browser = await launch();
  const results = [];
  const paths = ['dashboard', 'members', 'members/송하영/edit', 'albums', 'albums/new', 'albums/118/edit', 'albums/118/photos', 'track/196/fanchant', 'schedule', 'schedule/new', 'schedule/queue', 'schedule/bots', 'schedule/dict', 'schedule/links', 'videos', 'logs', 'theme', 'schedule/999/edit/event', 'schedule/999/edit/etc', 'schedule/999/edit/variety', 'schedule/concert/999/edit', 'schedule/999/edit/fansign', 'schedule/999/edit/ticketing'];
  for (const viewport of [{
    width: 1440,
    height: 900
  }, {
    width: 1100,
    height: 600
  }, {
    width: 1440,
    height: 450
  }]) {
    const f = await fixture(browser, viewport);
    for (const path of paths) {
      f.errors.length = 0;
      await f.page.goto(origin + '/admin/' + path);
      await f.page.waitForTimeout(600);
      const report = await f.page.evaluate(() => ({
        text: document.body.innerText.slice(0, 450),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        outerScroll: document.documentElement.scrollHeight > innerHeight + 1,
        scrolls: [...document.querySelectorAll('[data-overlayscrollbars-viewport]')].map(e => ({
          h: e.clientHeight,
          sh: e.scrollHeight,
          w: e.clientWidth,
          sw: e.scrollWidth
        }))
      }));
      results.push({
        path,
        viewport,
        ...report,
        errors: [...f.errors]
      });
    }
    await f.context.close();
  }
  fs.writeFileSync(artifact('sweep-after.json'), JSON.stringify(results, null, 2));
  if (results.some(r => r.overflow || r.outerScroll || r.errors.length)) process.exitCode = 1;
  console.log(results.map(r => ({
    path: r.path,
    w: r.viewport.width,
    overflow: r.overflow,
    outer: r.outerScroll,
    errors: r.errors
  })));
  await browser.close();
})();
