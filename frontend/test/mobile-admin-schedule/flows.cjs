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
const schedule = async f => {
  await f.page.goto(origin + '/admin/schedule');
  await f.page.getByRole('link', {
    name: '테스트대학교 별빛 상세 보기'
  }).waitFor();
};
const queue = async f => {
  await f.page.goto(origin + '/admin/schedule/queue');
  await f.page.getByRole('button', {
    name: '검토 후 등록'
  }).first().waitFor();
};
const card = (p, title) => p.getByRole('listitem').filter({
  has: p.getByRole('link', {
    name: title + ' 상세 보기'
  })
});
async function keyboard(p, height = 380) {
  await p.evaluate(h => {
    Object.defineProperty(visualViewport, 'height', {
      configurable: true,
      value: h
    });
    visualViewport.dispatchEvent(new Event('resize'));
  }, height);
  await wait(300);
}
async function contained(p, selector, height = 380) {
  const b = await p.locator(selector).boundingBox();
  assert(b && b.y >= -1 && b.y + b.height <= height + 1, JSON.stringify(b));
}
const suites = [['home and repeated sidebar transitions', async ({
  page: p
}) => {
  await p.goto(origin + '/admin');
  await p.getByRole('heading', {
    name: '오늘의 관리'
  }).waitFor();
  for (let i = 0; i < 4; i++) {
    await p.getByLabel('관리 메뉴 열기').click();
    await p.getByLabel('관리 메뉴 닫기').click();
    await check(async () => assert.equal(await p.locator('dialog[open]').count(), 0));
  }
  await p.getByLabel('관리 메뉴 열기').click();
  await p.goBack();
  await check(async () => assert.equal(await p.locator('dialog[open]').count(), 0));
}], ['date survives detail and refresh', async f => {
  await schedule(f);
  const p = f.page;
  await p.getByRole('button', {
    name: /9월 25일/
  }).click();
  await p.getByRole('link', {
    name: '전날 일정 상세 보기'
  }).click();
  await wait(350);
  await p.goBack();
  await check(async () => assert.equal(await p.getByRole('button', {
    name: /9월 25일/
  }).getAttribute('aria-pressed'), 'true'));
  await p.reload();
  await p.getByRole('link', {
    name: '전날 일정 상세 보기'
  }).waitFor();
}], ['month search and category persist on return', async f => {
  await schedule(f);
  const p = f.page;
  await p.getByLabel('일정 검색', {
    exact: true
  }).click();
  await p.getByLabel('선택한 월 일정 검색').fill('전날');
  await p.getByRole('link', {
    name: '전날 일정 상세 보기'
  }).click();
  await wait(300);
  await p.goBack();
  await p.getByLabel('선택한 월 일정 검색').waitFor();
  assert.equal(await p.getByLabel('선택한 월 일정 검색').inputValue(), '전날');
  await p.getByLabel('검색어 지우기').click();
  await p.getByRole('button', {
    name: '행사 1',
    exact: true
  }).click();
  assert.equal(await p.getByRole('listitem').count(), 1);
}], ['calendar month and empty day', async f => {
  await schedule(f);
  const p = f.page;
  await p.getByLabel('달력', {
    exact: true
  }).click();
  await p.getByLabel('달력', {
    exact: true
  }).click();
  await p.getByRole('button', {
    name: /9월 24일/
  }).click();
  await p.getByText('선택한 날짜에 등록된 일정이 없습니다.').waitFor();
  await p.getByLabel('다음 달').click();
  await p.getByLabel('2026년 10월 선택').waitFor();
  await p.getByLabel('이전 달').click();
  await p.getByLabel('2026년 9월 선택').waitFor();
}], ['list fetch error recovery', async f => {
  f.state.fail = '/schedules';
  await f.page.goto(origin + '/admin/schedule');
  await f.page.getByRole('button', {
    name: '다시 시도'
  }).waitFor({
    timeout: 15000
  });
  f.state.fail = null;
  await f.page.getByRole('button', {
    name: '다시 시도'
  }).click();
  await f.page.getByRole('link', {
    name: '테스트대학교 별빛 상세 보기'
  }).waitFor();
}], ['create blocks back and duplicate submit during save', async f => {
  await schedule(f);
  const p = f.page;
  await p.getByRole('link', {
    name: '일정 추가',
    exact: true
  }).click();
  await p.getByRole('button', {
    name: '유튜브',
    exact: true
  }).click();
  await p.getByRole('button', {
    name: '기타',
    exact: true
  }).last().click();
  await p.getByLabel('일정 제목 *', {
    exact: true
  }).fill('검증 일정');
  f.state.delay = 1300;
  await p.getByRole('button', {
    name: '일정 등록',
    exact: true
  }).click();
  await p.goBack();
  await wait(200);
  assert(p.url().endsWith('/new'));
  assert.equal(await p.locator('dialog[open]').count(), 1);
  await check(async () => assert(p.url().endsWith('/admin/schedule')));
  assert.equal(f.state.calls.filter(x => x.method === 'POST' && x.path === '/admin/etc').length, 1);
}], ['create back cancels without saving', async f => {
  await create(f);
  await f.page.goBack();
  await check(async () => assert(f.page.url().endsWith('/admin/schedule')));
  assert.equal(f.state.writes.length, 0);
}], ...['행사', '예능', '기타'].map(category => ['create ' + category, async f => {
  await create(f, category);
  if (category === '행사') await f.page.getByLabel('학교 *', {
    exact: true
  }).fill('검증대학교');
  if (category === '예능') await f.page.getByLabel('방송사 / 플랫폼 *').fill('JTBC');
  await f.page.getByRole('button', {
    name: '일정 등록',
    exact: true
  }).click();
  await check(async () => assert(f.page.url().endsWith('/admin/schedule')));
  assert(f.state.writes.some(x => x.method === 'POST'));
}]), ['create failure keeps draft and retries', async f => {
  await create(f);
  f.state.fail = '/admin/etc';
  await f.page.getByRole('button', {
    name: '일정 등록',
    exact: true
  }).click();
  await f.page.getByRole('alert').waitFor();
  assert.equal(await f.page.getByLabel('일정 제목 *', {
    exact: true
  }).inputValue(), '검증 일정');
  f.state.fail = null;
  await f.page.getByRole('button', {
    name: '일정 등록',
    exact: true
  }).click();
  await check(async () => assert(f.page.url().endsWith('/admin/schedule')));
}], ...['테스트대학교 별빛', '테스트 예능', '테스트 영상'].map(title => ['edit ' + title, async f => {
  await schedule(f);
  await card(f.page, title).getByRole('button', {
    name: '수정',
    exact: true
  }).click();
  if (title === '테스트 영상') {
    await f.page.getByRole('button', {
      name: '일반 영상',
      exact: true
    }).click();
    await f.page.getByRole('button', {
      name: '쇼츠',
      exact: true
    }).last().click();
  } else await f.page.getByLabel('일정 제목 *', {
    exact: true
  }).fill('수정된 제목');
  await f.page.getByRole('button', {
    name: '저장하기',
    exact: true
  }).click();
  await check(async () => assert.equal(await f.page.locator('dialog[open]').count(), 0));
  assert(f.state.writes.some(x => x.method === 'PUT'));
}]), ['unsupported complex schedule has no edit', async f => {
  await schedule(f);
  assert.equal(await card(f.page, '복잡한 콘서트').getByRole('button', {
    name: '수정',
    exact: true
  }).count(), 0);
}], ['delete error preserves item then retry', async f => {
  await schedule(f);
  const p = f.page;
  await card(p, '테스트대학교 별빛').getByRole('button', {
    name: '삭제',
    exact: true
  }).click();
  f.state.respond = async ({
    req
  }) => req.method() === 'DELETE' ? {
    status: 503,
    body: {
      error: '삭제 실패'
    }
  } : null;
  await p.getByRole('button', {
    name: '삭제하기',
    exact: true
  }).click();
  await p.getByRole('alert').waitFor();
  assert.equal(await card(p, '테스트대학교 별빛').count(), 1);
  f.state.respond = async ({
    req
  }) => {
    if (req.method() === 'DELETE') {
      f.state.rows = f.state.rows.filter(x => x.id !== 999);
      return {
        body: {
          success: true
        }
      };
    }
    return null;
  };
  await p.getByRole('button', {
    name: '삭제하기',
    exact: true
  }).click();
  await check(async () => assert.equal(await card(p, '테스트대학교 별빛').count(), 0));
}], ['queue search sort ignore', async f => {
  f.state.queue.push({
    ...f.state.queue[0],
    id: 2,
    title: '가나다대학교',
    date: '2026-09-01'
  });
  await queue(f);
  const p = f.page;
  await p.getByLabel('큐 정렬').click();
  await p.getByRole('button', {
    name: '날짜순',
    exact: true
  }).last().click();
  assert((await p.getByRole('listitem').first().textContent()).includes('가나다대학교'));
  await p.getByLabel('수집 큐 검색').fill('별빛');
  assert.equal(await p.getByRole('listitem').count(), 1);
  await p.getByRole('button', {
    name: '무시',
    exact: true
  }).click();
  f.state.respond = async ({
    p: path,
    req
  }) => {
    if (path.endsWith('/dismiss') && req.method() === 'POST') {
      f.state.queue = f.state.queue.filter(x => x.id !== 1);
      return {
        body: {
          success: true
        }
      };
    }
    return null;
  };
  await p.getByRole('button', {
    name: '무시하기',
    exact: true
  }).click();
  await p.getByText('일정을 무시했습니다.', {
    exact: true
  }).waitFor();
}], ['queue review submits and removes item', async f => {
  await queue(f);
  const p = f.page;
  await p.getByRole('button', {
    name: '검토 후 등록'
  }).click();
  f.state.respond = async ({
    p: path,
    req
  }) => {
    if (path.endsWith('/register') && req.method() === 'POST') {
      f.state.queue = [];
      return {
        body: {
          success: true
        }
      };
    }
    return null;
  };
  await p.getByRole('button', {
    name: '일정 등록',
    exact: true
  }).click();
  await p.getByText('검토할 일정이 없습니다.').waitFor();
}], ['queue save back veto', async f => {
  await queue(f);
  const p = f.page;
  await p.getByRole('button', {
    name: '검토 후 등록'
  }).click();
  f.state.delay = 1300;
  await p.getByRole('button', {
    name: '일정 등록',
    exact: true
  }).click();
  await p.goBack();
  await wait(150);
  assert.equal(await p.locator('dialog[open]').count(), 1);
  await check(async () => assert.equal(await p.locator('dialog[open]').count(), 0));
}], ['location failure empty retry and selection', async f => {
  await create(f);
  const p = f.page;
  await p.getByRole('button', {
    name: '장소 검색',
    exact: true
  }).click();
  await p.getByPlaceholder('장소명을 입력하세요').fill('학교');
  f.state.fail = '/admin/kakao/places';
  await p.getByLabel('장소 검색 실행').click();
  await p.getByRole('alert').waitFor();
  f.state.fail = null;
  f.state.respond = async ({
    p: path
  }) => path === '/admin/kakao/places' ? {
    body: {
      documents: []
    }
  } : null;
  await p.getByLabel('장소 검색 실행').click();
  await p.getByText('검색 결과가 없습니다. 다른 장소명으로 검색해주세요.').waitFor();
  f.state.respond = async ({
    p: path
  }) => path === '/admin/kakao/places' ? {
    body: {
      documents: [{
        place_name: '검증 학교',
        road_address_name: '서울',
        x: '127',
        y: '37'
      }]
    }
  } : null;
  await p.getByLabel('장소 검색 실행').click();
  await p.getByRole('button', {
    name: /검증 학교/
  }).click();
  await p.getByText('검증 학교', {
    exact: true
  }).waitFor();
}], ['location delayed response cannot leak after reopen', async f => {
  await create(f);
  const p = f.page;
  await p.getByRole('button', {
    name: '장소 검색',
    exact: true
  }).click();
  f.state.respond = async ({
    p: path
  }) => {
    if (path !== '/admin/kakao/places') return null;
    await wait(800);
    return {
      body: {
        documents: [{
          place_name: '오래된 응답',
          x: '127',
          y: '37'
        }]
      }
    };
  };
  await p.getByPlaceholder('장소명을 입력하세요').fill('옛 검색');
  await p.getByLabel('장소 검색 실행').click();
  await p.getByLabel('장소 검색 닫기').click();
  await wait(250);
  await p.getByRole('button', {
    name: '장소 검색',
    exact: true
  }).click();
  await wait(900);
  assert.equal(await p.getByText('오래된 응답').count(), 0);
  assert.equal(await p.getByPlaceholder('장소명을 입력하세요').inputValue(), '');
  await keyboard(p);
  await contained(p, '[role=dialog][aria-label="장소 검색"]');
}], ['instagram caption applies to title only', async f => {
  await create(f, '행사');
  const p = f.page;
  await p.getByLabel('인스타에서 가져오기').click();
  await p.getByLabel('인스타그램 게시글 링크').fill('https://www.instagram.com/p/test/');
  f.state.respond = async ({
    p: path
  }) => path === '/admin/instagram/caption' ? {
    body: {
      caption: '별빛 축제 안내'
    }
  } : null;
  await p.getByRole('button', {
    name: '가져오기',
    exact: true
  }).click();
  await check(async () => assert.equal(await p.locator('#instagram-title-draft').inputValue(), '별빛 축제 안내'));
  await p.locator('#instagram-title-draft').fill('검증대학교 별빛');
  await keyboard(p);
  await contained(p, 'dialog[aria-labelledby=instagram-title-heading]');
  await p.getByRole('button', {
    name: '입력하기',
    exact: true
  }).click();
  assert.equal(await p.getByLabel('일정 제목 *', {
    exact: true
  }).inputValue(), '검증대학교 별빛');
}], ['poster dialog stays above keyboard and nested back', async f => {
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
  await keyboard(p);
  await contained(p, 'dialog[aria-labelledby=poster-dialog-title]');
  await p.screenshot({
    path: artifact('mobile-poster-keyboard.png')
  });
  await p.goBack();
  await check(async () => assert.equal(await p.locator('dialog[open]').count(), 1));
  assert(p.url().endsWith('/new'));
}], ['date time picker and keyboard focus', async f => {
  await create(f);
  const p = f.page;
  await p.getByRole('button', {
    name: '2026년 9월 26일',
    exact: true
  }).click();
  await p.locator('[data-picker-panel]').waitFor();
  await wait(400);
  let b = await p.locator('[data-picker-panel]').boundingBox();
  assert(b.y >= 0 && b.y + b.height < 844);
  await p.getByRole('button', {
    name: '2026년 9월 26일',
    exact: true
  }).click();
  await p.getByRole('button', {
    name: '시간 미정',
    exact: true
  }).click();
  await wait(400);
  b = await p.locator('[data-picker-panel]').boundingBox();
  assert(b.y >= 0 && b.y + b.height < 844);
  await p.getByLabel('내용 (선택)', {
    exact: true
  }).fill('키보드 검사');
  await keyboard(p);
  await contained(p, 'dialog.mobile-queue-review');
  await p.screenshot({
    path: artifact('mobile-form-keyboard.png')
  });
}]];
run(suites.slice(Number(process.env.AUDIT_START || 0)).filter(([name]) => !process.env.AUDIT_FILTER || name.includes(process.env.AUDIT_FILTER))).catch(() => process.exitCode = 1);
