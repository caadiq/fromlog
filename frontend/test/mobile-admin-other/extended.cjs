const {run,origin,assert,writes}=require('./base.cjs');
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
const bot=async(p,name='검증 youtube')=>{await p.goto(origin+'/admin/schedule/bots');await p.getByRole('button',{name:`${name} 수정`,exact:true}).click();await p.getByRole('dialog').getByRole('button',{name:'수정',exact:true}).waitFor();};
test('mobile bot traps keyboard focus',async({page:p})=>{
 await bot(p);const d=p.getByRole('dialog');await d.getByRole('button',{name:'수정',exact:true}).focus();await p.keyboard.press('Tab');assert.ok(await d.evaluate(el=>el.contains(document.activeElement)),'Tab must stay inside editor');await p.keyboard.press('Shift+Tab');assert.ok(await d.evaluate(el=>el.contains(document.activeElement)));
});
test('scheduled mutation locks editor closure and bot save',async({page:p,state:s})=>{
 s.respond=async({p:path})=>path.endsWith('/scheduled')?{body:{scheduled:{id:99,title:'예정 일정',date:'2026-10-01',time:'18:00'}}}:null;await bot(p);s.delayWrite=1000;
 // Only GET is customized; mutation must pass through the delayed adapter.
 s.respond=async({p:path,req})=>req.method()==='GET'&&path.endsWith('/scheduled')?{body:{scheduled:{id:99,title:'예정 일정',date:'2026-10-01',time:'18:00'}}}:null;
 await p.getByPlaceholder('예정 일정 제목').fill('수정한 예정');await p.getByRole('button',{name:'예정 일정 저장',exact:true}).click();assert.ok(await p.getByRole('dialog').getByRole('button',{name:'수정',exact:true}).isDisabled(),'Bot save must wait for schedule save');await p.goBack();assert.ok(await p.getByRole('dialog').isVisible());await p.getByText('저장했습니다',{exact:true}).waitFor();
});
test('bot failure preserves draft and Escape save lock',async({page:p,state:s})=>{
 await bot(p,'검증 festival');await p.getByPlaceholder('DC 일정 수집 봇').fill('수정중인 봇');s.failWrite=true;await p.getByRole('dialog').getByRole('button',{name:'수정',exact:true}).click();await p.getByText('검증용 저장 실패').waitFor();assert.equal(await p.getByPlaceholder('DC 일정 수집 봇').inputValue(),'수정중인 봇');s.failWrite=false;s.delayWrite=600;await p.getByRole('dialog').getByRole('button',{name:'수정',exact:true}).click();await p.keyboard.press('Escape');assert.ok(await p.getByRole('dialog').isVisible());await p.getByRole('dialog').waitFor({state:'hidden'});assert.equal(writes(s).length,2);
});
test('bot detail failure retry is not editable',async({page:p,state:s})=>{
 s.fail='/admin/youtube-bots/1';await p.goto(origin+'/admin/schedule/bots');await p.getByRole('button',{name:'검증 youtube 수정'}).click();await p.getByRole('button',{name:'다시 시도',exact:true}).waitFor();assert.ok(await p.getByRole('dialog').getByRole('button',{name:'수정',exact:true}).isDisabled());s.fail=null;await p.getByRole('button',{name:'다시 시도',exact:true}).click();await p.getByRole('dialog').getByRole('button',{name:'수정',exact:true}).waitFor();
});
test('bot filters quota and error log link',async({page:p,state:s})=>{
 s.bots[0].status='error';s.respond=async({p:path})=>path==='/admin/bots/quota-warning'?{body:{active:true,message:'할당량 확인 테스트'}}:null;await p.goto(origin+'/admin/schedule/bots');await p.getByText('할당량 확인 테스트').waitFor();await p.getByRole('button',{name:'상세 필터',exact:true}).click();const d=p.getByRole('dialog');await d.getByRole('button',{name:'YouTube',exact:true}).click();await d.getByRole('button',{name:'오류',exact:true}).click();await d.getByRole('button',{name:'적용하기'}).click();await d.waitFor({state:'hidden'});assert.equal(await p.getByRole('list',{name:'봇 목록'}).getByRole('listitem').count(),1);await p.getByRole('link',{name:'활동 로그에서 오류 확인 ›'}).click();await p.getByRole('heading',{name:'활동 로그',exact:true}).waitFor();await p.waitForTimeout(300);const q=s.calls.filter(x=>x.p==='/admin/logs').at(-1).query;assert.equal(q.actor,'bot');assert.equal(q.action,'error');
});
test('link period labels and invalid period',async({page:p,state:s})=>{
 s.links=[{id:1,title:'예정 링크',url:'https://example.com',enabled:true,startsAt:'2026-10-01T00:00',endsAt:null},{id:2,title:'만료 링크',url:'https://example.com',enabled:true,startsAt:null,endsAt:'2026-09-01T00:00'}];await p.goto(origin+'/admin/schedule/links');await p.getByText('예정',{exact:true}).waitFor();await p.getByText('기간 지남',{exact:true}).waitFor();await p.getByRole('button',{name:'수정',exact:true}).first().click();await p.getByRole('button',{name:'설정',exact:true}).click();await p.getByRole('dialog').getByRole('button',{name:'저장',exact:true}).click();await p.getByText('종료일이 시작일보다 빠릅니다.').waitFor();assert.equal(writes(s).length,0);
});
test('video and log reload preserve filters and page',async({page:p})=>{
 for(const path of ['/admin/videos','/admin/logs']){await p.goto(origin+path);await p.getByRole('button',{name:'다음 페이지',exact:true}).click();await p.getByRole('button',{name:/현재 2페이지/}).waitFor();await p.reload();await p.getByRole('button',{name:/현재 2페이지/}).waitFor();}
});
test('dialog motion exit and repeated reopen',async({page:p})=>{
 await p.goto(origin+'/admin/videos');for(let i=0;i<3;i++){await p.getByRole('button',{name:'영상 추가',exact:true}).click();await p.waitForTimeout(280);await p.getByRole('button',{name:'영상 등록 닫기',exact:true}).click();await p.waitForTimeout(50);const d=p.locator('dialog[data-admin-dialog-state="closing"]');assert.equal(await d.count(),1);const y=await d.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m42);assert.ok(y>0&&y<844);assert.equal(await d.getAttribute('inert'),'');await d.waitFor({state:'hidden'});}assert.equal(await p.locator('dialog[open]').count(),0);
});
test('reduced motion and large text dialogs',async({page:p})=>{
 await p.emulateMedia({reducedMotion:'reduce'});await p.setViewportSize({width:320,height:568});await p.goto(origin+'/admin/logs');await p.addStyleTag({content:'html{font-size:20px}'});await p.getByRole('button',{name:'상세 필터',exact:true}).click();await p.waitForTimeout(80);const y=await p.getByRole('dialog').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m42);assert.equal(y,0);const bad=await p.getByRole('dialog').evaluate(el=>el.scrollWidth-el.clientWidth);assert.ok(bad<=1);await p.getByRole('button',{name:'로그 필터 닫기'}).click();await p.waitForTimeout(80);assert.equal(await p.locator('dialog[open]').count(),0);
});
run(tests).catch(e=>{console.error(e);process.exitCode=1;});
