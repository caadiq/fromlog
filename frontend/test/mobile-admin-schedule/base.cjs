const base = require('../pc-admin/base.cjs');
const assert = require('node:assert/strict');
async function fixture(browser, viewport = {
  width: 390,
  height: 844
}) {
  const f = await base.fixture(browser, viewport),
    {
      page,
      state,
      context
    } = f;
  page.setDefaultTimeout(7000);
  await page.clock.setFixedTime(new Date('2026-09-26T12:00:00+09:00'));
  state.rows = [{
    id: 999,
    title: '테스트대학교 별빛',
    date: '2026-09-26',
    time: '19:00',
    category: {
      id: 11,
      name: '행사',
      color: '#ffdd00'
    }
  }, {
    id: 998,
    title: '전날 일정',
    date: '2026-09-25',
    time: '18:00',
    category: {
      id: 1,
      name: '기타',
      color: '#888888'
    }
  }, {
    id: 997,
    title: '테스트 예능',
    date: '2026-09-26',
    time: '21:00',
    category: {
      id: 10,
      name: '예능',
      color: '#00aaaa'
    }
  }, {
    id: 996,
    title: '테스트 영상',
    date: '2026-09-26',
    time: '20:00',
    category: {
      id: 2,
      name: '유튜브',
      color: '#ff0033'
    }
  }, {
    id: 995,
    title: '복잡한 콘서트',
    date: '2026-09-26',
    time: '17:00',
    category: {
      id: 6,
      name: '콘서트',
      color: '#ff8800'
    }
  }];
  state.queue = [{
    id: 1,
    title: '테스트대학교 별빛',
    date: '2026-10-01',
    time: '19:00',
    category: '행사',
    members: ['하영'],
    description: '원래 내용',
    status: 'pending'
  }];
  state.calls = [];
  state.respond = null;
  state.override = async info => {
    const {
      req,
      p
    } = info;
    state.calls.push({
      path: p,
      method: req.method(),
      body: req.postData()
    });
    if (state.respond) {
      const custom = await state.respond(info);
      if (custom) return custom;
    }
    if (state.fail === p) return {
      status: 503,
      body: {
        error: '검증용 조회 실패'
      }
    };
    if (req.method() === 'GET') {
      if (p === '/schedules') return {
        body: {
          schedules: state.rows
        }
      };
      if (p === '/admin/pending') return {
        body: {
          items: state.queue
        }
      };
      if (p === '/admin/pending/count') return {
        body: {
          count: state.queue.length
        }
      };
      if (/^\/admin\/(events|etc|variety)/.test(p) || /^\/schedules\/\d+$/.test(p)) return {
        body: {
          id: 999,
          title: '테스트대학교 별빛',
          date: '2026-09-26',
          time: '19:00',
          description: '원래 내용',
          category: {
            id: 11,
            name: '행사'
          },
          subtype: 'university',
          schoolName: '테스트대학교',
          broadcaster: 'JTBC',
          venue: {
            name: '테스트 장소',
            lat: 37,
            lng: 127
          },
          posters: [],
          postUrls: []
        }
      };
    }
    return null;
  };
  return f;
}
async function run(suites) {
  const b = await base.launch();
  let n = 0;
  try {
    for (const [name, fn] of suites) {
      const f = await fixture(b);
      try {
        await fn(f);
        assert.deepEqual(f.errors, []);
        console.log('PASS', ++n, name);
      } catch (e) {
        await f.page.screenshot({
          path: base.artifact('mobile-failure.png')
        });
        console.error('FAIL', name, e.stack);
        throw e;
      } finally {
        await f.context.close();
      }
    }
    console.log('TOTAL', n);
  } finally {
    await b.close();
  }
}
async function create(f, category = '기타') {
  const p = f.page;
  await p.goto(base.origin + '/admin/schedule/new');
  await p.getByRole('button', {
    name: '유튜브',
    exact: true
  }).click();
  await p.getByRole('button', {
    name: category,
    exact: true
  }).last().click();
  await p.getByLabel('일정 제목 *', {
    exact: true
  }).fill('검증 일정');
}
module.exports = {
  ...base,
  fixture,
  run,
  create,
  assert
};
