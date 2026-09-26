const {
  run,
  origin,
  assert,
  artifact
} = require('./base.cjs');
run([['mobile password login failure recovery and logout', async f => {
  const p = f.page;
  await f.context.addInitScript(() => {
    if (window === window.top) localStorage.removeItem('auth-storage');
  });
  await p.goto(origin + '/admin');
  await p.getByLabel('아이디', {
    exact: true
  }).fill('tester');
  await p.getByLabel('비밀번호', {
    exact: true
  }).fill('fake-password');
  await p.getByLabel('비밀번호 표시', {
    exact: true
  }).click();
  assert.equal(await p.getByLabel('비밀번호', {
    exact: true
  }).getAttribute('type'), 'text');
  f.state.respond = async ({
    p: path
  }) => path === '/auth/login' ? {
    status: 401,
    body: {
      error: '로그인 실패'
    }
  } : null;
  await p.getByRole('button', {
    name: '로그인',
    exact: true
  }).click();
  await p.getByText('로그인 실패', {
    exact: true
  }).waitFor();
  await p.screenshot({
    path: artifact('mobile-login-error.png')
  });
  f.state.respond = async ({
    p: path
  }) => path === '/auth/login' ? {
    body: {
      token: 'test-only',
      user: {
        id: 7,
        username: 'tester'
      }
    }
  } : null;
  await p.getByRole('button', {
    name: '로그인',
    exact: true
  }).click();
  await p.getByRole('heading', {
    name: '오늘의 관리'
  }).waitFor();
  await p.getByLabel('관리 메뉴 열기').click();
  await p.getByRole('button', {
    name: '로그아웃',
    exact: true
  }).click();
  await p.getByLabel('아이디', {
    exact: true
  }).waitFor();
}], ['queue failure retry and empty state', async f => {
  f.state.fail = '/admin/pending';
  const p = f.page;
  await p.goto(origin + '/admin/schedule/queue');
  await p.getByRole('button', {
    name: '다시 시도',
    exact: true
  }).waitFor({
    timeout: 15000
  });
  f.state.fail = null;
  f.state.queue = [];
  await p.getByRole('button', {
    name: '다시 시도',
    exact: true
  }).click();
  await p.getByText('검토할 일정이 없습니다.').waitFor();
}], ['edit fetch failure retry', async f => {
  const p = f.page;
  await p.goto(origin + '/admin/schedule');
  f.state.fail = '/admin/events/999';
  await p.getByRole('listitem').filter({
    has: p.getByRole('link', {
      name: '테스트대학교 별빛 상세 보기'
    })
  }).getByRole('button', {
    name: '수정',
    exact: true
  }).click();
  await p.getByRole('button', {
    name: '다시 시도',
    exact: true
  }).waitFor();
  f.state.fail = null;
  await p.getByRole('button', {
    name: '다시 시도',
    exact: true
  }).click();
  await p.getByLabel('일정 제목 *', {
    exact: true
  }).waitFor();
  await p.goBack();
  await p.getByLabel('관리 메뉴 열기').click();
  await p.getByLabel('관리 메뉴 닫기').click();
}]]).catch(() => process.exitCode = 1);
