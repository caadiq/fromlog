const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.AUDIT_BASE_URL || 'https://dev.fromlog.caadiq.co.kr';
const output = process.env.AUDIT_OUTPUT || '/tmp/fromlog-pc-public-media';
fs.mkdirSync(output, { recursive: true });
const artifact = name => path.join(output, name);
const categories = [{ id: 2, name: '유튜브', color: '#ff0033' }, { id: 3, name: 'X', color: '#111111' }, { id: 11, name: '행사', color: '#ffdd00' }];
const videos = Array.from({ length: 48 }, (_, i) => ({ videoId: `testvid${String(i).padStart(4, '0')}`, title: i === 0 ? '긴 영상 제목 '.repeat(35) : `검증 영상 ${i}`, channelName: i === 0 ? 'VeryLongChannelName'.repeat(12) : '검증 채널', publishedAt: '2026-09-24T10:00:00Z', videoType: 'video', category: 'variety', duration: 125 }));
async function launch() {
  return chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
}
async function fixture(browser, viewport = { width: 1440, height: 900 }, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, reducedMotion });
  const state = { fail: null, empty: false, delay: 0, detail: {}, requests: [], errors: [] };
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(origin).origin ? route.continue() : route.abort());
  await context.route('**/test-poster.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#E8F2E8"/><text x="40" y="90" font-size="36">TEST POSTER</text></svg>' }));
  await context.route('**/api/**', async route => {
    const u = new URL(route.request().url());
    if (!u.pathname.startsWith('/api/')) return route.continue();
    const p = u.pathname.slice(4);
    state.requests.push(p + u.search);
    if (route.request().method() !== 'GET') throw new Error('Unexpected write: ' + p);
    if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
    let body = {}, status = 200;
    const videoPage = { videos: state.empty ? [] : videos.slice(Number(u.searchParams.get('offset') || 0), Number(u.searchParams.get('offset') || 0) + 24), total: state.empty ? 0 : 48, limit: 24, offset: Number(u.searchParams.get('offset') || 0), hasMore: !state.empty && !Number(u.searchParams.get('offset')), facets: { channels: [{ name: '검증 채널', count: 24 }, { name: 'VeryLongChannelName'.repeat(12), count: 24 }] }, months: [{ ym: '2026-09', count: 48 }] };
    if (p === '/theme') body = { mode: 'auto', primary: '#34AC34', soft: '#E8F2E8', deep: '#256A25' };
    else if (p === '/members') body = [];
    else if (p === '/schedules/categories') body = categories;
    else if (p === '/schedule-links') body = [];
    else if (p === '/videos/home') body = state.empty ? {} : { featured: videos[0], sections: { variety: videos.slice(0, 4) }, counts: { variety: 48 }, shorts: [{ ...videos[1], videoType: 'shorts' }] };
    else if (p === '/videos') body = { ...videoPage, videos: videoPage.videos.map(v => ({ ...v, videoType: u.searchParams.get('shorts') === 'only' ? 'shorts' : 'video' })) };
    else if (p === '/schedules/suggestions') body = { suggestions: ['검증'] };
    else if (p === '/schedules') {
      const y = u.searchParams.get('year') || 2026, m = String(u.searchParams.get('month') || 9).padStart(2, '0');
      body = { schedules: state.empty ? [] : Array.from({ length: 35 }, (_, i) => ({ id: 9000 + i, title: `검증 일정 ${i} ` + '긴 제목 '.repeat(10), date: `${y}-${m}-26`, time: '19:00', category: categories[i % 3], source: { name: '긴 채널 '.repeat(12) } })), total: 35, hasMore: false, offset: 0, limit: 20 };
    } else if (/^\/schedules\/\d+$/.test(p)) body = { id: Number(p.split('/').pop()), title: '검증 일정 상세', date: '2026-09-26', time: '19:00', category: categories[0], videoId: 'testvid0000', videoType: 'video', channelName: '검증 채널', channelUrl: 'https://www.youtube.com/@test', ...state.detail };
    if (state.fail?.(p, u)) { status = typeof state.fail(p, u) === 'number' ? state.fail(p, u) : 500; body = { error: '검증용 오류' }; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.clock.install({ time: new Date("2026-09-26T03:00:00Z") });
  page.on('pageerror', e => state.errors.push(e.message));
  const go = async route => { await page.goto(origin + route); await page.waitForTimeout(1600); };
  return { context, page, state, go };
}
async function overflow(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-overlayscrollbars-viewport]')].map(e => ({ width: e.clientWidth, height: e.clientHeight, x: e.scrollWidth - e.clientWidth, y: e.scrollHeight - e.clientHeight })));
}
module.exports = { launch, fixture, artifact, overflow, origin };
