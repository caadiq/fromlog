const assert = require('node:assert/strict');
const {launch,fixture,artifact,origin}=require('../pc-public-media/base.cjs');
async function stable(check) {let error;for(let i=0;i<70;i++){try{await check();return;}catch(e){error=e;await new Promise(r=>setTimeout(r,100));}}throw error;}
async function bounds(page){return page.evaluate(()=>({bodyX:document.documentElement.scrollWidth-innerWidth,bodyY:document.documentElement.scrollHeight-innerHeight,contents:[...document.querySelectorAll('.mobile-content')].map(e=>({x:e.scrollWidth-e.clientWidth,y:e.scrollHeight-e.clientHeight,h:e.clientHeight})),nav:document.querySelector('.mobile-bottom-nav')?.getBoundingClientRect().bottom}));}
(async()=>{const b=await launch();try{
 for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:800,height:1100}]){
  const {context,page,state,go}=await fixture(b,size);
  await go('/schedule');await page.getByRole('button',{name:'9월 26일',exact:true}).click();
  let box=await bounds(page);assert.equal(box.bodyX,0);assert.equal(box.bodyY,0);assert.ok(box.contents[0].h>50);assert.ok(box.contents[0].y>0);assert.ok(box.nav<=size.height);
  await page.getByRole('button',{name:'달력',exact:true}).click();await page.locator('[data-calendar-month="2026-9"]').waitFor();
  await page.getByRole('button',{name:'다음 달',exact:true}).click();await page.locator('[data-calendar-month="2026-10"]').waitFor();
  await page.getByRole('button',{name:'다음 달',exact:true}).click();await page.getByRole('button',{name:'다음 달',exact:true}).click();await page.locator('[data-calendar-month="2026-12"]').waitFor();
  await page.getByRole('button',{name:'이전 달',exact:true}).click();await page.locator('[data-calendar-month="2026-11"]').waitFor();
  await page.getByRole('button',{name:'11월 30일',exact:true}).click();await page.locator('[data-calendar-month]').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'다음 달',exact:true}).click();assert.equal(await page.getByRole('button',{name:/2026\. 12/}).count(),1);
  await page.getByRole('button',{name:'달력',exact:true}).click();await page.getByRole('button',{name:/2026\. 12/}).click();await page.getByText('YEAR',{exact:true}).waitFor();
  await page.getByRole('button',{name:'2',exact:true}).click();await page.locator('[data-calendar-month="2026-2"]').waitFor();
  await page.getByRole('button',{name:'2월 28일',exact:true}).click();
  await stable(async()=>assert.equal(await page.locator('[data-calendar-month]').count(),0));
  for(let i=0;i<3;i++){await page.getByRole('button',{name:'달력',exact:true}).click();await page.getByRole('button',{name:'달력',exact:true}).click();}
  await stable(async()=>assert.equal(await page.locator('[data-calendar-month]').count(),0));
  box=await bounds(page);assert.equal(box.bodyX,0);assert.equal(box.bodyY,0);assert.ok(box.nav<=size.height);
  await page.waitForTimeout(700);await page.screenshot({path:artifact(`mobile-schedule-${size.width}x${size.height}.png`)});
  await page.getByRole('button',{name:'달력',exact:true}).click();
  await page.getByRole('button',{name:/2026\. 2/}).click();await page.getByText('YEAR',{exact:true}).waitFor();
  await page.getByRole('button',{name:'1',exact:true}).click();await page.locator('[data-calendar-month="2026-1"]').waitFor();
  await page.getByRole('button',{name:'1월 31일',exact:true}).click();await page.locator('[data-calendar-month]').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'다음 달',exact:true}).click();await page.getByRole('button',{name:/2026\. 2/}).waitFor();
  assert.deepEqual(state.errors,[]);await context.close();console.log('PASS calendar/layout/month-end',size);
 }
 let f=await fixture(b,{width:390,height:844}),{page,state,go}=f;
 await go('/schedule');await page.getByRole('button',{name:'9월 26일',exact:true}).click();
 await page.getByRole('button',{name:/^유튜브 /}).click();await page.getByRole('button',{name:/검증 일정 0/}).click();await page.getByRole('heading',{name:'검증 일정 상세'}).waitFor();
 assert.match(await page.locator('iframe').getAttribute('src'),/testvid0000/);
 await page.getByRole('button',{name:'뒤로 가기',exact:true}).click();await page.getByRole('button',{name:/^유튜브 /}).waitFor();
 assert.match(await page.getByRole('button',{name:/^유튜브 /}).getAttribute('class'),/bg-ink/);
 assert.equal(await page.getByRole('button',{name:/검증 일정 1 /}).count(),0);
 await page.setViewportSize({width:1280,height:700});await page.waitForTimeout(700);
 assert.equal(await page.getByRole('button',{name:/9월 26일/}).getAttribute('aria-pressed'),'true');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(700);assert.equal(await page.getByRole('button',{name:'9월 26일',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:/^전체 /}).click();await page.getByRole('button',{name:'검색',exact:true}).click();const input=page.locator('input').first();await input.fill('검증');await input.press('Enter');
 await page.getByRole('button',{name:/검증 일정 0/}).click();await page.getByRole('heading',{name:'검증 일정 상세'}).waitFor();await page.goBack();await input.waitFor();assert.equal(await input.inputValue(),'검증');await page.goBack();await stable(async()=>assert.equal(await input.inputValue(),''));
 await page.setViewportSize({width:390,height:340});await input.fill('검증');await input.focus();await page.waitForTimeout(250);const ib=await input.boundingBox();assert.ok(ib.y>=0&&ib.y+ib.height<340);assert.equal((await bounds(page)).bodyX,0);
 assert.deepEqual(state.errors,[]);await f.context.close();console.log('PASS state/filter/search/back/rotation/keyboard-sized viewport');

 f=await fixture(b,{width:390,height:844});({page,state,go}=f);
 state.fail=p=>p==='/videos/home';await go('/video');await page.getByText('영상을 불러오지 못했습니다.').waitFor();state.fail=null;await page.getByRole('button',{name:'다시 시도'}).click();await page.getByRole('img',{name:/썸네일 없음/}).first().waitFor();assert.equal((await bounds(page)).bodyX,0);
 state.empty=true;await go('/video');await page.getByText('등록된 영상이 없습니다.').waitFor();state.empty=false;
 state.fail=p=>p==='/videos';await go('/video/variety');await page.getByText('영상을 불러오지 못했습니다.').waitFor();state.fail=null;await page.getByRole('button',{name:'다시 시도'}).click();await page.waitForTimeout(700);
 await page.getByRole('button',{name:'전체 채널',exact:true}).click();await page.waitForTimeout(200);await page.getByRole('option',{name:/VeryLong/}).click();assert.match(page.url(),/channel=/);await page.reload();await page.waitForTimeout(1500);await page.getByRole('button',{name:/VeryLong/}).waitFor();assert.equal((await bounds(page)).bodyX,0);
 await page.screenshot({path:artifact('mobile-video-list.png')});await f.context.close();console.log('PASS video errors/empty/thumbnail/filter/reload');
 f=await fixture(b,{width:390,height:844});({page,state,go}=f);state.fail=(p,u)=>p==='/videos'&&Number(u.searchParams.get('offset'))>0;await go('/video/variety');await page.locator('.mobile-content').evaluate(e=>e.scrollTop=e.scrollHeight);await page.getByText('다음 영상을 불러오지 못했습니다.').waitFor();let calls=state.requests.length;await page.waitForTimeout(1700);assert.equal(state.requests.length,calls);state.fail=null;await page.getByRole('button',{name:'다시 시도'}).click();await stable(async()=>assert.equal(await page.locator('a[href*="watch?v="]').count(),48));
 state.fail=p=>p==='/schedules';await go('/schedule');await page.getByText('일정을 불러오지 못했습니다.').waitFor();state.fail=null;await page.getByRole('button',{name:'다시 시도'}).click();await page.getByRole('button',{name:/검증 일정 0/}).waitFor();state.fail=p=>p==='/schedules/9000';await go('/schedule/9000');await page.getByText('일정을 불러오지 못했습니다.').waitFor();assert.equal(await page.getByText('404',{exact:true}).count(),0);state.fail=null;await page.getByRole('button',{name:'다시 시도'}).click();await page.getByRole('heading',{name:'검증 일정 상세'}).waitFor();state.fail=p=>p==='/schedules/9000'?404:false;await go('/schedule/9000');await page.getByText('404',{exact:true}).waitFor();assert.deepEqual(state.errors,[]);await f.context.close();console.log('PASS pagination recovery/schedule errors/404');
 f=await fixture(b,{width:390,height:844},'reduce');({page,state,go}=f);await go('/schedule');await page.getByRole('button',{name:'달력',exact:true}).click();await page.getByRole('button',{name:'다음 달',exact:true}).click();await page.locator('[data-calendar-month="2026-10"]').waitFor();assert.equal(await page.locator('[data-calendar-month]').evaluate(e=>getComputedStyle(e).transform),'none');await page.getByRole('button',{name:'달력',exact:true}).click();await stable(async()=>assert.equal(await page.locator('[data-calendar-month]').count(),0));assert.deepEqual(state.errors,[]);await f.context.close();console.log('PASS reduced motion');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
