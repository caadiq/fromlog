const {run,origin,assert,writes}=require('./base.cjs');
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
const goto=async(p,path)=>{await p.goto(origin+path);await p.getByRole('heading',{level:1}).waitFor();};
const dialog=p=>p.getByRole('dialog');
test('video paging, validation, search and filter',async({page:p,state:s})=>{
 await goto(p,'/admin/videos');await p.getByRole('button',{name:'다음 페이지',exact:true}).click();await p.getByText('검증 영상 20',{exact:true}).waitFor();
 await p.getByRole('button',{name:/페이지 직접 입력/}).click();await p.getByLabel('이동할 페이지').fill('0');await p.getByRole('button',{name:'이동',exact:true}).click();await p.getByRole('alert').waitFor();
 await p.getByLabel('이동할 페이지').fill('3');await p.getByRole('button',{name:'이동',exact:true}).click();await p.getByText('검증 영상 40',{exact:true}).waitFor();
 await p.getByLabel('제목 검색',{exact:true}).fill('영상 1');await p.getByText('검증 영상 1',{exact:true}).waitFor();assert.equal(s.calls.filter(x=>x.p==='/admin/videos').at(-1).query.offset,'0');
 await p.getByRole('button',{name:'상세 필터',exact:true}).click();await dialog(p).getByRole('button',{name:'SHORTS',exact:true}).click();await dialog(p).getByRole('button',{name:'적용하기'}).click();await dialog(p).waitFor({state:'hidden'});assert.equal(s.calls.filter(x=>x.p==='/admin/videos').at(-1).query.type,'shorts');
});
test('video create lookup, cutoff, failed save, save lock and edit',async({page:p,state:s})=>{
 await goto(p,'/admin/videos');await p.getByRole('button',{name:'영상 추가',exact:true}).click();await p.getByLabel('YouTube URL').fill('https://youtu.be/abcdefghijk');await dialog(p).getByRole('button',{name:'조회',exact:true}).click();await p.getByText('조회한 영상 A').waitFor();
 s.failWrite=true;await dialog(p).getByRole('button',{name:'등록',exact:true}).click();await p.getByText('검증용 저장 실패').waitFor();
 s.failWrite=false;s.delayWrite=700;await dialog(p).getByRole('button',{name:'등록',exact:true}).click();await p.goBack();assert.ok(await dialog(p).isVisible());await dialog(p).waitFor({state:'hidden'});
 assert.equal(writes(s).filter(x=>x.p==='/admin/videos').length,2);
 await p.getByRole('list',{name:'영상 목록'}).getByRole('button',{name:'수정',exact:true}).first().click();await dialog(p).getByRole('button',{name:'본채널',exact:true}).click();await dialog(p).getByRole('button',{name:'저장',exact:true}).click();await dialog(p).waitFor({state:'hidden'});assert.equal(writes(s).at(-1).body.category,'official');
});
test('video URL change invalidates preview and blocked imports',async({page:p,state:s})=>{
 await goto(p,'/admin/videos');await p.getByRole('button',{name:'영상 추가',exact:true}).click();await p.getByLabel('YouTube URL').fill('https://youtu.be/abcdefghijk');await dialog(p).getByRole('button',{name:'조회',exact:true}).click();await p.getByText('조회한 영상 A').waitFor();await p.getByLabel('YouTube URL').fill('https://youtu.be/lmnopqrstuv');assert.ok(await dialog(p).getByRole('button',{name:'등록',exact:true}).isDisabled());
 for(const flag of ['alreadyExists','beforeCutoff']){s.respond=async({p:path})=>path==='/admin/videos/preview'?{body:{videoId:'lmnopqrstuv',title:'차단 영상',[flag]:true,existingCategory:'variety'}}:null;await dialog(p).getByRole('button',{name:'조회',exact:true}).click();await p.getByText('차단 영상').waitFor();assert.ok(await dialog(p).getByRole('button',{name:'등록',exact:true}).isDisabled());}
});
test('last video page deletion clamps to preceding page',async({page:p,state:s})=>{
 await goto(p,'/admin/videos');await p.getByRole('button',{name:/페이지 직접 입력/}).click();await p.getByLabel('이동할 페이지').fill('3');await p.getByRole('button',{name:'이동',exact:true}).click();await p.getByText('검증 영상 40',{exact:true}).waitFor();await p.getByRole('button',{name:'삭제',exact:true}).click();s.failWrite=true;await p.getByRole('alertdialog').getByRole('button',{name:'삭제하기'}).click();await p.getByText('검증용 저장 실패').waitFor();s.failWrite=false;await p.getByRole('alertdialog').getByRole('button',{name:'삭제하기'}).click();await p.getByRole('button',{name:/현재 2페이지/}).waitFor();assert.equal(s.videos.length,40);
});
test('bot stop start sync delete lock and error',async({page:p,state:s})=>{
 await goto(p,'/admin/schedule/bots');await p.getByRole('button',{name:'검증 youtube 정지',exact:true}).click();await p.getByRole('button',{name:'검증 youtube 시작',exact:true}).click();await p.getByRole('button',{name:'검증 youtube 정지',exact:true}).waitFor();s.delayWrite=700;await p.getByRole('button',{name:'검증 youtube 동기화'}).click();assert.ok(await p.getByRole('button',{name:'검증 x 정지'}).isDisabled());await p.waitForTimeout(900);await p.getByRole('button',{name:'검증 x 삭제'}).click();s.failWrite=true;await p.getByRole('button',{name:'삭제하기'}).click();await p.getByText('검증용 저장 실패').waitFor();s.failWrite=false;s.delayWrite=0;await p.getByRole('button',{name:'삭제하기'}).click();await p.getByRole('button',{name:'검증 x 삭제'}).waitFor({state:'hidden'});
});
for(const [type,label]of [['youtube','YouTube'],['x','X'],['festival','일정 수집']])test(`bot ${type} create edit`,async({page:p,state:s})=>{
 await goto(p,'/admin/schedule/bots');await p.getByRole('button',{name:'봇 추가',exact:true}).click();await p.getByRole('button',{name:`${label} 봇 추가`,exact:true}).click();
 if(type==='festival'){await p.getByPlaceholder('DC 일정 수집 봇').fill('검증 수집');await p.getByPlaceholder('https://m.dcinside.com/board/fromis9?...').fill('https://m.dcinside.com/board/fromis9');}
 else{await p.getByPlaceholder(type==='youtube'?'studiofromis_9':'realfromis_9').fill('test_account');await dialog(p).getByRole('button',{name:'조회',exact:true}).click();}
 await dialog(p).getByRole('button',{name:'추가',exact:true}).click();await dialog(p).waitFor({state:'hidden'});assert.ok(writes(s).some(x=>x.p===`/admin/${type}-bots`));
 await p.getByRole('button',{name:`검증 ${type} 수정`,exact:true}).click();await dialog(p).getByRole('button',{name:'수정',exact:true}).click();await dialog(p).waitFor({state:'hidden'});assert.ok(writes(s).some(x=>x.p.startsWith(`/admin/${type}-bots/`)&&x.method==='PUT'));
});
test('bot FAB Back closes menu on same page',async({page:p})=>{
 await goto(p,'/admin/theme');await goto(p,'/admin/schedule/bots');await p.getByRole('button',{name:'봇 추가',exact:true}).click();await p.getByRole('button',{name:'YouTube 봇 추가'}).waitFor();await p.goBack();await p.waitForTimeout(350);assert.equal(new URL(p.url()).pathname,'/admin/schedule/bots');assert.equal(await p.getByRole('button',{name:'YouTube 봇 추가'}).count(),0);
});
test('links CRUD validation and date visibility',async({page:p,state:s})=>{
 await goto(p,'/admin/schedule/links');await p.getByRole('button',{name:'링크 추가',exact:true}).click();await dialog(p).getByRole('button',{name:'저장',exact:true}).click();await p.getByText('제목을 입력해주세요.').waitFor();await p.getByLabel('제목',{exact:true}).fill('새 링크');await p.getByLabel('URL',{exact:true}).fill('javascript:alert(1)');await dialog(p).getByRole('button',{name:'저장',exact:true}).click();await p.getByText('올바른 http 또는 https URL을 입력해주세요.').waitFor();await p.getByLabel('URL',{exact:true}).fill('https://example.com/new');s.failWrite=true;await dialog(p).getByRole('button',{name:'저장',exact:true}).click();await p.getByText('검증용 저장 실패').waitFor();s.failWrite=false;s.delayWrite=500;await dialog(p).getByRole('button',{name:'저장',exact:true}).click();await p.goBack();assert.ok(await dialog(p).isVisible());await dialog(p).waitFor({state:'hidden'});await p.getByRole('heading',{name:'새 링크',exact:true}).waitFor();
 const row=p.getByRole('listitem').filter({has:p.getByRole('heading',{name:'새 링크',exact:true})});await row.getByRole('switch').click();await p.waitForTimeout(700);assert.equal(s.links.at(-1).enabled,false);await row.getByRole('button',{name:'삭제',exact:true}).click();await p.getByRole('button',{name:'삭제하기'}).click();await row.waitFor({state:'hidden'});
});
test('link order failure rollback then success',async({page:p,state:s})=>{
 await goto(p,'/admin/schedule/links');s.failWrite=true;await p.getByRole('button',{name:'첫째 링크 아래로'}).click();await p.getByText('검증용 저장 실패').waitFor();assert.equal(await p.getByRole('list',{name:'고정 링크 목록'}).getByRole('heading').first().innerText(),'첫째 링크');s.failWrite=false;await p.getByRole('button',{name:'첫째 링크 아래로'}).click();await p.waitForTimeout(600);assert.deepEqual(s.links.map(x=>x.id),[2,1]);assert.equal(await p.getByRole('list',{name:'고정 링크 목록'}).getByRole('heading').first().innerText(),'둘째 링크');
});
test('theme hex validation, error retry and partial extraction',async({page:p,state:s})=>{
 await goto(p,'/admin/theme');await p.getByRole('button',{name:'수동 직접 지정'}).click();await p.getByLabel('색상 코드').fill('#GGGGGG');await p.getByRole('button',{name:'저장',exact:true}).click();await p.getByRole('alert').waitFor();await p.getByLabel('색상 코드').fill('#123456');s.failWrite=true;await p.getByRole('button',{name:'저장',exact:true}).click();await p.getByText('검증용 저장 실패').waitFor();s.failWrite=false;await p.getByRole('button',{name:'저장',exact:true}).click();await p.getByText('테마가 저장되었습니다.').waitFor();assert.equal(s.theme.manualColor,'#123456');
 s.respond=async({p:path})=>path.includes('reextract')?{body:{updated:2,failed:['앨범']}}:null;await p.getByRole('button',{name:'앨범 색 재추출',exact:true}).click();await p.getByText('2개 앨범 색을 다시 추출했습니다. 1개는 실패했습니다.').waitFor();
});
test('logs filters paging and detail Back',async({page:p,state:s})=>{
 await goto(p,'/admin/logs');await p.getByRole('button',{name:'다음 페이지',exact:true}).click();await p.getByText('검증 활동 20',{exact:true}).waitFor();await p.getByRole('button',{name:/페이지 직접 입력/}).click();await p.getByLabel('이동할 페이지').fill('3');await p.getByRole('button',{name:'이동',exact:true}).click();await p.getByText('검증 활동 40',{exact:true}).click();await p.getByRole('heading',{name:'활동 상세'}).waitFor();await p.goBack();await dialog(p).waitFor({state:'hidden'});await p.getByRole('button',{name:/현재 3페이지/}).waitFor();await p.getByRole('button',{name:'상세 필터',exact:true}).click();await dialog(p).getByRole('button',{name:'최근 7일',exact:true}).click();await dialog(p).getByRole('button',{name:'봇',exact:true}).click();await dialog(p).getByRole('button',{name:'오류만',exact:true}).click();await dialog(p).getByRole('button',{name:'적용하기'}).click();await dialog(p).waitFor({state:'hidden'});const q=s.calls.filter(x=>x.p==='/admin/logs').at(-1).query;assert.equal(q.from,'2026-09-21');assert.equal(q.actor,'bot');assert.equal(q.action,'error');assert.equal(q.page,'1');
});
test('logs related schedule Back keeps page',async({page:p})=>{
 await goto(p,'/admin/logs');await p.getByRole('button',{name:'다음 페이지',exact:true}).click();await p.getByText('검증 활동 20',{exact:true}).click();await p.getByRole('link',{name:/관련 일정 보기/}).click();await p.waitForURL('**/schedule/999');await p.goBack();await p.getByRole('button',{name:/현재 2페이지/}).waitFor();
});
for(const [path,apiPath]of [['/admin/videos','/admin/videos'],['/admin/logs','/admin/logs'],['/admin/schedule/bots','/admin/bots'],['/admin/schedule/links','/admin/schedule-links'],['/admin/theme','/admin/theme']])test(`load failure retry ${path}`,async({page:p,state:s})=>{s.fail=apiPath;await goto(p,path);await p.getByRole('button',{name:'다시 시도',exact:true}).waitFor();s.fail=null;await p.getByRole('button',{name:'다시 시도',exact:true}).click();await p.getByRole('button',{name:'다시 시도',exact:true}).waitFor({state:'hidden'});});
run(tests).catch(e=>{console.error(e);process.exitCode=1;});
