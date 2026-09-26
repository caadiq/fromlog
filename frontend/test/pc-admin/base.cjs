const {
  chromium
} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const path = require('path');
const output = process.env.AUDIT_OUTPUT || '/tmp/fromlog-pc-admin-audit';
fs.mkdirSync(output, {
  recursive: true
});
const artifact = name => path.join(output, name);
const origin = process.env.AUDIT_BASE_URL || 'https://dev.fromlog.caadiq.co.kr';
const members = [{
  id: 1,
  name: '송하영',
  name_en: 'Test member',
  birth_date: '1997-09-29',
  instagram: 'test',
  is_former: 0,
  nicknames: [],
  image_url: null
}];
const albums = [{
  id: 118,
  title: '검증 앨범',
  folder_name: 'audit',
  album_type: '미니 1집',
  album_type_short: '미니',
  release_date: '2026-09-01',
  description: '테스트',
  tracks: [{
    id: 196,
    title: '검증 곡',
    track_number: 1,
    is_title: 1,
    duration: '3:20'
  }]
}];
const schedules = {
  schedules: [{
    id: 999,
    title: '테스트 일정',
    date: '2026-09-26',
    time: '19:00',
    category: {
      id: 11,
      name: '행사',
      color: '#ffdd00'
    }
  }]
};
const theme = {
  mode: 'auto',
  primary: '#34AC34',
  soft: '#E8F2E8',
  deep: '#256A25'
};
const categories = [{
  id: 2,
  name: '유튜브',
  color: '#ff0033'
}, {
  id: 3,
  name: 'X',
  color: '#111111'
}, {
  id: 10,
  name: '예능',
  color: '#00aaaa'
}, {
  id: 11,
  name: '행사',
  color: '#ffdd00'
}, {
  id: 1,
  name: '기타',
  color: '#888888'
}, {
  id: 6,
  name: '콘서트',
  color: '#ff8800'
}, {
  id: 5,
  name: '팬사인회',
  color: '#ffaaff'
}, {
  id: 7,
  name: '티켓팅',
  color: '#777777'
}];
const videos = Array.from({
  length: 31
}, (_, i) => ({
  videoId: 'testvideo' + String(i).padStart(2, '0'),
  title: i === 0 ? '긴 영상 제목 '.repeat(22) : `테스트 영상 ${i}`,
  channelName: '테스트 채널',
  publishedAt: '2026-09-24T10:00:00Z',
  category: 'variety',
  videoType: i % 3 ? 'video' : 'shorts'
}));
const bots = ['youtube', 'x', 'festival', 'meilisearch'].map((type, i) => ({
  id: type + '-' + (i + 1),
  db_id: i + 1,
  check_interval: 5,
  type,
  name: '테스트 ' + type,
  channelName: '테스트 채널',
  displayName: '테스트 계정',
  enabled: true,
  status: 'running',
  cron: '*/5 * * * *',
  cronInterval: 5,
  lastAddedCount: 0,
  totalAdded: 3,
  videoCategory: 'variety'
}));
async function launch() {
  return chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox']
  });
}
async function fixture(browser, viewport = {
  width: 1440,
  height: 900
}) {
  const context = await browser.newContext({
    viewport
  });
  const state = {
    fail: null,
    delay: 0,
    requests: [],
    writes: [],
    videos: [...videos],
    override: null,
    empty: false
  };
  await context.addInitScript(() => { if (window !== window.top) return; localStorage.setItem('auth-storage', JSON.stringify({
    state: {
      token: 'test-only',
      user: {
        id: 7,
        username: 'test-admin'
      },
      isAuthenticated: true
    },
    version: 0
  })); });
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(origin).origin ? route.continue() : route.abort());
  await context.route('**/api/**', async route => {
    const req = route.request(),
      u = new URL(req.url());
    if (!u.pathname.startsWith('/api/')) return route.continue();
    const p = u.pathname.slice(4);
    state.requests.push(p + u.search);
    let body,
      status = 200;
    if (state.override) {
      const o = await state.override({
        req,
        p,
        u
      });
      if (o) {
        await route.fulfill({
          status: o.status || 200,
          contentType: 'application/json',
          body: JSON.stringify(o.body)
        });
        return;
      }
    }
    if (req.method() !== 'GET') {
      state.writes.push({
        p,
        method: req.method(),
        body: req.postData()
      });
      if (state.delay) await new Promise(r => setTimeout(r, state.delay));
      if (req.method() === 'DELETE' && p.startsWith('/admin/videos/')) state.videos = state.videos.filter(v => v.videoId !== p.split('/').pop());
      body = {
        id: 999,
        success: true,
        addedCount: 0,
        total: 0,
        updated: 0
      };
    } else if (p === '/auth/verify') body = {
      valid: true,
      user: {
        id: 7,
        username: 'test-admin'
      }
    };else if (p === '/theme') body = theme;else if (p === '/stats') body = {
      members: 5,
      albums: 17,
      photos: 603,
      schedules: 4000
    };else if (p === '/members') body = state.empty ? [] : members;else if (p.startsWith('/members/')) body = members.find(m => m.name === decodeURIComponent(p.split('/').pop())) || members[0];else if (p === '/albums') body = state.empty ? [] : albums;else if (/^\/albums\/\d+$/.test(p)) body = albums.find(a => a.id === +p.split('/').pop()) || albums[0];else if (p.startsWith('/albums/')) body = [];else if (p === '/schedules/categories') body = categories;else if (p === '/schedules/suggestions/dict') body = {
      content: '프로미스나인\tNNP\n워크돌\tNNP'
    };else if (p === '/schedules') body = state.empty ? {
      schedules: []
    } : schedules;else if (p === '/admin/pending/count') body = {
      count: 1
    };else if (p === '/admin/pending') body = {
      items: state.empty ? [] : [{
        id: 1,
        category: '예능',
        title: '테스트 예능',
        date: '2026-10-01',
        time: '21:00',
        members: ['하영'],
        description: '검토할 내용',
        status: 'pending'
      }]
    };else if (p === '/admin/videos/preview') body = {
      videoId: u.searchParams.get('url').split('/').pop(),
      title: '조회한 영상 A',
      channelName: '채널A',
      suggestedCategory: 'variety',
      publishedAt: '2026-09-24',
      videoType: 'video'
    };else if (p === '/admin/videos') body = {
      videos: state.empty ? [] : state.videos.slice(+(u.searchParams.get('offset') || 0), +(u.searchParams.get('offset') || 0) + 30),
      total: state.empty ? 0 : state.videos.length,
      channels: ['테스트 채널']
    };else if (p === '/admin/bots') body = state.empty ? [] : bots;else if (p.includes('quota')) body = {
      active: false
    };else if (p.includes('/youtube-bots/')) body = {
      id: 1,
      channel_id: 'test',
      channel_name: '테스트 채널',
      channel_handle: 'test',
      cron_interval: 5,
      titleFilters: [],
      descriptionFilters: [],
      filterMode: 'split'
    };else if (p.includes('/x-bots/')) body = {
      id: 2,
      username: 'test',
      displayName: '테스트 계정',
      cronInterval: 5,
      textFilters: []
    };else if (p.includes('/festival-bots/')) body = {
      id: 3,
      name: '테스트 수집',
      search_url: 'https://m.dcinside.com/board/fromis9',
      cron_interval: 360
    };else if (p === '/admin/theme') body = {
      mode: 'auto',
      manualColor: '#548360',
      resolved: theme,
      albums: [],
      latestAlbum: albums[0]
    };else if (p === '/admin/logs/categories') body = {
      categories: ['sync', 'schedule']
    };else if (p === '/admin/logs') body = {
      logs: state.empty ? [] : [{
        id: 1,
        created_at: '2026-09-26T12:00:00Z',
        actor: 'admin',
        category: 'schedule',
        action: 'create',
        summary: '테스트 일정 등록',
        details: {
          id: 999
        }
      }],
      total: state.empty ? 0 : 1,
      totalPages: 1,
      page: 1
    };else if (p === '/admin/schedule-links') body = state.empty ? [] : [{
      id: 1,
      title: '테스트 고정 링크',
      url: 'https://example.com',
      enabled: true,
      sort_order: 0
    }];else if (p.includes('/fanchant/')) body = {
      trackTitle: '테스트 곡',
      albumId: 118,
      lyrics: '테스트 가사\n두 번째 줄',
      lines: [],
      videoId: '',
      manualColors: {}
    };else if (p.includes('/admin/variety/broadcasters')) body = ['JTBC'];else if (/\/(events|etc|variety|schedules)\//.test(p)) body = {
      id: 999,
      title: '테스트 일정',
      date: '2026-10-01',
      time: '19:00',
      category: categories[3],
      subtype: 'university',
      schoolName: '테스트대학교',
      venue: {
        id: 1,
        name: '테스트 장소',
        lat: 37.1,
        lng: 127.1
      },
      posters: [],
      postUrls: [],
      broadcaster: 'JTBC'
    };else body = [];
    if (state.fail && state.fail === p) {
      status = 503;
      body = {
        error: '검증용 조회 실패'
      };
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.dismiss());
  return {
    context,
    page,
    state,
    errors
  };
}
module.exports = {
  launch,
  fixture,
  origin,
  artifact
};
