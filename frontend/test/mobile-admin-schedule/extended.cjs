const {
  run,
  create,
  origin,
  assert,
  artifact
} = require('./base.cjs');
const wait = ms => new Promise(r => setTimeout(r, ms));
async function check(fn) {
  for (let i = 0; i < 40; i++) {
    try {
      await fn();
      return;
    } catch (e) {
      if (i === 39) throw e;
      await wait(100);
    }
  }
}
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
run([...['유튜브', 'X'].map(category => ['remote create ' + category, async f => {
  const p = f.page;
  await p.goto(origin + '/admin/schedule/new');
  if (category === 'X') {
    await p.getByRole('button', {
      name: '유튜브',
      exact: true
    }).click();
    await p.getByRole('button', {
      name: 'X',
      exact: true
    }).last().click();
  }
  const endpoint = category === 'X' ? '/admin/x/post-info' : '/admin/youtube/video-info';
  f.state.respond = async ({
    p: path
  }) => path === endpoint ? {
    body: {
      videoId: 'abcdefghijk',
      postId: '123456',
      title: '원본 제목',
      text: '원본 본문',
      username: 'tester',
      date: '2026-09-26',
      time: '21:00',
      videoType: 'video',
      imageUrls: [],
      channelName: '검증 채널'
    }
  } : null;
  await p.locator('#create-video-url').fill(category === 'X' ? 'https://x.com/tester/status/123456' : 'abcdefghijk');
  await p.getByRole('button', {
    name: '조회',
    exact: true
  }).click();
  await p.getByRole('heading', {
    name: '원본 제목'
  }).waitFor();
  await p.getByRole('button', {
    name: '일정 등록',
    exact: true
  }).click();
  await check(async () => assert(p.url().endsWith('/admin/schedule')));
  const call = f.state.calls.find(x => x.path === (category === 'X' ? '/admin/x/schedule' : '/admin/youtube/schedule') && x.method === 'POST');
  assert(call);
  assert.equal(JSON.parse(call.body).time, '21:00');
}]), ['source failure then retry', async f => {
  const p = f.page;
  await p.goto(origin + '/admin/schedule/new');
  await p.locator('#create-video-url').fill('abcdefghijk');
  f.state.fail = '/admin/youtube/video-info';
  await p.getByRole('button', {
    name: '조회',
    exact: true
  }).click();
  await p.getByRole('alert').waitFor();
  assert.equal(await p.locator('#create-video-url').inputValue(), 'abcdefghijk');
  assert.equal(await p.getByRole('button', {
    name: '조회',
    exact: true
  }).isEnabled(), true);
}], ['queue partial failure locks saved fields and can finish', async f => {
  const p = f.page;
  await p.goto(origin + '/admin/schedule/queue');
  await p.getByRole('button', {
    name: '검토 후 등록'
  }).click();
  let attempts = 0;
  f.state.respond = async ({
    p: path
  }) => {
    if (!path.endsWith('/register')) return null;
    if (++attempts === 1) return {
      status: 503,
      body: {
        error: '포스터 처리 실패',
        createdScheduleId: 999
      }
    };
    f.state.queue = [];
    return {
      body: {
        success: true
      }
    };
  };
  await p.getByRole('button', {
    name: '일정 등록',
    exact: true
  }).click();
  await p.getByRole('button', {
    name: '등록 마무리',
    exact: true
  }).waitFor();
  assert(await p.getByLabel('일정 제목 *', {
    exact: true
  }).isDisabled());
  await p.getByRole('button', {
    name: '등록 마무리',
    exact: true
  }).click();
  await p.getByText('검토할 일정이 없습니다.').waitFor();
  assert.equal(attempts, 2);
}], ['poster selection switches action and submits attachment', async f => {
  await create(f);
  const p = f.page;
  await p.getByLabel('포스터 추가', {
    exact: true
  }).click();
  await p.getByRole('button', {
    name: '인스타그램 링크',
    exact: true
  }).click();
  await p.locator('#poster-instagram-url').fill('https://www.instagram.com/p/test/');
  f.state.respond = async ({
    p: path
  }) => path === '/admin/instagram/posters' ? {
    body: {
      images: [{
        name: 'poster.jpg',
        dataUrl: png
      }]
    }
  } : null;
  await p.getByRole('button', {
    name: '불러오기',
    exact: true
  }).click();
  await p.getByLabel('이미지 1', {
    exact: true
  }).waitFor();
  assert.equal(await p.getByRole('button', {
    name: '불러오기',
    exact: true
  }).count(), 1);
  await p.getByLabel('이미지 1', {
    exact: true
  }).click();
  await p.getByRole('button', {
    name: '추가하기 · 1장',
    exact: true
  }).click();
  await check(async () => assert.equal(await p.locator('dialog[open]').count(), 1));
  await p.getByRole('button', {
    name: '일정 등록',
    exact: true
  }).click();
  await check(async () => assert(f.state.calls.some(x => x.path === '/admin/etc' && x.method === 'POST')));
  assert(f.state.calls.find(x => x.path === '/admin/etc' && x.method === 'POST').body.includes('filename="poster.jpg"'));
}], ['poster file validation and attachment', async f => {
  await create(f);
  const p = f.page;
  await p.getByLabel('포스터 추가', {
    exact: true
  }).click();
  const input = p.locator('dialog[aria-labelledby=poster-dialog-title] input[type=file]');
  await input.setInputFiles({
    name: 'bad.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('test')
  });
  await p.getByRole('alert').waitFor();
  await input.setInputFiles({
    name: 'valid.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png.split(',')[1], 'base64')
  });
  await p.getByRole('button', {
    name: '추가하기 · 1장',
    exact: true
  }).click();
  await check(async () => assert.equal(await p.locator('dialog[open]').count(), 1));
}], ['reduced motion dialog and sidebar exit', async f => {
  const p = f.page;
  await p.emulateMedia({
    reducedMotion: 'reduce'
  });
  await create(f);
  await p.getByLabel('추가 닫기').click();
  await check(async () => assert(p.url().endsWith('/admin/schedule')));
  await p.getByLabel('관리 메뉴 열기').click();
  await p.getByLabel('관리 메뉴 닫기').click();
  await check(async () => assert.equal(await p.locator('dialog[open]').count(), 0));
}], ['scroll restoration after detail', async f => {
  const p = f.page;
  f.state.rows = Array.from({
    length: 30
  }, (_, i) => ({
    ...f.state.rows[0],
    id: 1000 + i,
    title: '일정 ' + i
  }));
  await p.goto(origin + '/admin/schedule');
  await p.getByRole('link', {
    name: '일정 0 상세 보기'
  }).waitFor();
  await p.locator('[data-schedule-content]').evaluate(el => el.scrollTop = 650);
  await wait(100);
  await p.getByRole('link', {
    name: '일정 4 상세 보기'
  }).click();
  await wait(350);
  await p.goBack();
  await p.getByRole('link', {
    name: '일정 0 상세 보기'
  }).waitFor();
  await wait(200);
  const top = await p.locator('[data-schedule-content]').evaluate(el => el.scrollTop);
  assert(top > 400, 'scroll restored: ' + top);
}], ['edit month-only preserves unknown date', async f => {
  const p = f.page;
  f.state.rows = [{
    ...f.state.rows[0],
    date: '2026-09-01',
    datePrecision: 'month'
  }];
  await p.goto(origin + '/admin/schedule');
  await p.getByRole('button', {
    name: '수정',
    exact: true
  }).click();
  await p.getByRole('button', {
    name: '2026년 9월 중',
    exact: true
  }).waitFor();
  assert.equal(await p.getByRole('button', {
    name: '시간 미정',
    exact: true
  }).count(), 0);
  await p.getByRole('button', {
    name: '저장하기',
    exact: true
  }).click();
  await check(async () => assert.equal(await p.locator('dialog[open]').count(), 0));
}]].filter(([name]) => !process.env.AUDIT_FILTER || name.includes(process.env.AUDIT_FILTER))).catch(() => process.exitCode = 1);
