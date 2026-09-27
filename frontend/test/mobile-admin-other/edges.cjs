const {run,origin,assert,writes}=require('./base.cjs');
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
test('FAB selection consumes only menu history',async({page:p})=>{
 await p.goto(origin+'/admin/theme');await p.goto(origin+'/admin/schedule/bots');await p.getByRole('button',{name:'봇 추가',exact:true}).click();await p.getByRole('button',{name:'YouTube 봇 추가',exact:true}).click();await p.getByRole('dialog').waitFor();await p.goBack();await p.getByRole('dialog').waitFor({state:'hidden'});assert.ok(p.url().endsWith('/admin/schedule/bots'));await p.goBack();await p.waitForURL('**/admin/theme');
});
test('stored search and filters restore; explicit log links override',async({page:p,state:s})=>{
 for(const [path,key,value,input] of [
  ['/admin/videos','videos',{category:'variety',channel:'검증 채널',type:'shorts',q:'검증',page:2},'제목 검색'],
  ['/admin/logs','logs',{from:'2026-09-21',to:'2026-09-27',actor:'admin',action:'',category:'schedule',search:'검증',page:2},'활동 내용 검색']
 ]){
  await p.goto(origin+path);await p.evaluate(({key,value})=>sessionStorage.setItem('admin-list:'+key,JSON.stringify({day:'2026-09-27',value})),{key,value});await p.reload();await p.getByRole('button',{name:/현재 2페이지/}).waitFor();assert.equal(await p.getByRole('searchbox',{name:input}).inputValue(),'검증');await p.waitForTimeout(400);const q=s.calls.filter(x=>x.p===path).at(-1).query;assert.equal(q.category,value.category);assert.equal(q[key==='videos'?'type':'actor'],value[key==='videos'?'type':'actor']);
 }
 for(const [query,actor,action] of [['actor=bot','bot',''],['action=error','','error']]){
  await p.goto(origin+'/admin/logs?'+query);await p.getByRole('button',{name:/현재 1페이지/}).waitFor();const q=s.calls.filter(x=>x.p==='/admin/logs').at(-1).query;assert.equal(q.actor||'',actor);assert.equal(q.action||'',action);
 }
});
test('stale invalid and blocked list storage remain usable',async({page:p})=>{
 await p.goto(origin+'/admin/videos');
 for(const saved of [{day:'2026-09-26',value:{page:2,q:'이전 검색'}},{day:'2026-09-27',value:{page:-2,q:9}}]){
  await p.evaluate(saved=>sessionStorage.setItem('admin-list:videos',JSON.stringify(saved)),saved);await p.reload();await p.getByRole('button',{name:/현재 1페이지/}).waitFor();assert.equal(await p.getByRole('searchbox',{name:'제목 검색'}).inputValue(),'');
 }
 await p.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key.startsWith('admin-list:'))throw new DOMException('Blocked','SecurityError');return get.call(this,key);};Storage.prototype.setItem=function(key,value){if(key.startsWith('admin-list:'))throw new DOMException('Blocked','SecurityError');return set.call(this,key,value);};});
 await p.reload();await p.getByRole('button',{name:'다음 페이지',exact:true}).click();await p.getByRole('button',{name:/현재 2페이지/}).waitFor();
});
test('long log details and empty results fit narrow view',async({page:p,state:s})=>{
 await p.setViewportSize({width:320,height:568});s.logs[0].action='error';s.logs[0].summary='긴내용'.repeat(80);s.logs[0].details={error:{message:'긴오류'.repeat(200)},raw:'long'.repeat(400)};
 await p.goto(origin+'/admin/logs');await p.getByRole('button').filter({hasText:'긴내용'}).first().click();await p.getByText('원본 기록 보기').click();assert.ok(await p.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await p.goBack();await p.getByRole('dialog').waitFor({state:'hidden'});await p.getByRole('searchbox',{name:'활동 내용 검색'}).fill('없는 검색어');await p.getByText('선택한 조건에 맞는 활동이 없습니다.').waitFor();assert.equal(writes(s).length,0);
});
test('bot draft survives short viewport and rotation',async({page:p})=>{
 await p.goto(origin+'/admin/schedule/bots');await p.getByRole('button',{name:'검증 festival 수정',exact:true}).click();await p.getByPlaceholder('DC 일정 수집 봇').fill('회전해도 유지');
 for(const viewport of [{width:390,height:400},{width:844,height:390},{width:390,height:844}]){
  await p.setViewportSize(viewport);await p.waitForTimeout(300);assert.equal(await p.getByPlaceholder('DC 일정 수집 봇').inputValue(),'회전해도 유지');const box=await p.getByRole('dialog').boundingBox();assert.ok(box.y>=-1&&box.y+box.height<=viewport.height+1);
 }
 await p.keyboard.press('Escape');await p.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await p.evaluate(()=>document.activeElement.getAttribute('aria-label')),'검증 festival 수정');
});
test('unavailable video thumbnail has fallback in list and editor',async({page:p})=>{
 await p.goto(origin+'/admin/videos');await p.getByRole('img',{name:'검증 영상 0 — 썸네일 없음',exact:true}).waitFor();await p.getByRole('button',{name:'수정',exact:true}).first().click();await p.getByRole('dialog').getByRole('img',{name:'검증 영상 0 — 썸네일 없음',exact:true}).waitFor();
});
test('YouTube advanced filters survive rotation and submit separately',async({page:p,state:s})=>{
 await p.goto(origin+'/admin/schedule/bots');await p.getByRole('button',{name:'검증 youtube 수정',exact:true}).click();await p.getByRole('button',{name:'고급 설정',exact:true}).click();await p.getByPlaceholder('키워드 입력 후 Enter').fill('방판소녀들 시즌2');await p.getByPlaceholder('키워드 입력 후 Enter').press('Enter');await p.getByPlaceholder('키워드를 쉼표로 구분').fill('설명 조건');await p.getByRole('spinbutton',{name:'최소 길이 분'}).fill('3');await p.getByRole('spinbutton',{name:'최소 길이 초'}).fill('20');await p.setViewportSize({width:844,height:390});await p.waitForTimeout(300);assert.equal(await p.getByPlaceholder('키워드를 쉼표로 구분').inputValue(),'설명 조건');await p.getByRole('dialog').getByRole('button',{name:'수정',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});const b=writes(s).at(-1).body;assert.deepEqual(b.title_filters,['방판소녀들 시즌2']);assert.deepEqual(b.description_filters,['설명 조건']);assert.equal(b.min_duration_seconds,200);
});
run(tests).catch(e=>{console.error(e);process.exitCode=1;});
