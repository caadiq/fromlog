const assert = require('node:assert/strict');
const { launch, fixture, artifact, origin } = require('../pc-public-media/base.cjs');
async function noOverflow(page) {
  const sizes = await page.evaluate(() => ({ x: document.documentElement.scrollWidth-innerWidth, y:document.documentElement.scrollHeight-innerHeight, contents:[...document.querySelectorAll('.mobile-content')].map(e=>e.scrollWidth-e.clientWidth) }));
  assert.equal(sizes.x,0); assert.equal(sizes.y,0); assert.ok(sizes.contents.every(x=>x===0),JSON.stringify(sizes));
}
(async()=>{
 const browser=await launch();
 try {
  const {context,page,state,go}=await fixture(browser,{width:320,height:568},'no-preference',{isMobile:true,hasTouch:true});
  for(const name of ['유튜브','X','행사','예능','기타','팬사인회','티켓팅','콘서트','사용자 분류']) {
   state.detail={category:{name,color:'#141613'},title:'긴 일정 제목 '.repeat(15),description:'긴 상세 설명 '.repeat(30),content:'긴 X 본문 https://example.com/'+'a'.repeat(180),videoType:name==='유튜브'?'shorts':'video',broadcaster:'검증 방송사',stage:'general',postUrls:['https://example.com/post'],posters:[1,2].map(id=>({id,originalUrl:origin+'/test-poster.svg',mediumUrl:origin+'/test-poster.svg'}))};
   await go('/schedule/9000'); await noOverflow(page); assert.deepEqual(state.errors,[]);
   if(name==='행사') {
    await page.locator('button').filter({has:page.locator('img')}).first().tap();
    const gallery=page.getByRole('dialog',{name:'이미지 뷰어',exact:true});await gallery.waitFor();
    await page.waitForTimeout(400);
    const session=await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:280,y:290}]});
    for(const x of [240,190,140,80,30]){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:290}]});await page.waitForTimeout(40);}
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await gallery.getByText('2 / 2',{exact:true}).waitFor();
    await page.screenshot({path:artifact('mobile-poster-swipe.png')});
    await page.goBack();await gallery.waitFor({state:'hidden'});assert.match(page.url(),/\/schedule\/9000$/);
    await page.locator('button').filter({has:page.locator('img')}).first().tap();await gallery.waitFor();
    await page.getByRole('button',{name:'이미지 뷰어 닫기',exact:true}).tap();await gallery.waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
   }
   console.log('PASS mobile detail',name);
  }
  state.detail={date:null,category:{name:'사용자 분류'}};await go('/schedule/9000');await page.getByText('날짜 미정',{exact:true}).waitFor();
  state.detail={date:'2026-10-01',time:'19:00',datePrecision:'month',category:{name:'기타'}};await go('/schedule/9000');await page.getByText('2026. 10. (날짜 미정)',{exact:true}).waitFor();assert.equal(await page.getByText('19:00',{exact:true}).count(),0);
  await page.setViewportSize({width:844,height:390});await go('/video/shorts');
  assert.ok(await page.locator('a[href*="youtube.com/shorts/"]').count()>=24);
  await page.getByRole('button',{name:'전체 채널',exact:true}).tap();await page.waitForTimeout(500);
  let box=await page.getByRole('listbox').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=340,JSON.stringify(box));
  await page.keyboard.press('End');await page.keyboard.press('Enter');assert.match(page.url(),/channel=/);
  await page.getByRole('button',{name:/VeryLong/}).tap();await page.keyboard.press('Escape');await page.getByRole('listbox').waitFor({state:'hidden'});await noOverflow(page);
  await page.setViewportSize({width:390,height:844});await go('/video/variety');await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('a[href*="watch?v="]')).opacity)===1);
  await page.screenshot({path:artifact('mobile-video-list-settled.png')});
  await go('/schedule');await page.getByRole('button',{name:'달력',exact:true}).tap();
  state.fail=(p,u)=>p==='/schedules'&&u.searchParams.get('month')==='10';
  await page.getByRole('button',{name:'다음 달',exact:true}).tap();await page.getByText('일정을 불러오지 못했습니다.').waitFor();state.fail=null;await page.getByRole('button',{name:'다시 시도'}).tap();await page.locator('[data-calendar-month="2026-10"]').waitFor();
  await page.getByRole('button',{name:'10월 31일',exact:true}).tap();await page.locator('[data-calendar-month]').waitFor({state:'hidden'});await page.waitForTimeout(1000);
  box=await page.getByRole('button',{name:'10월 31일',exact:true}).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390,JSON.stringify(box));
  await page.setViewportSize({width:1100,height:750});await page.getByRole('button',{name:/10월 31일/}).waitFor();await page.setViewportSize({width:1099,height:750});await page.getByRole('button',{name:'10월 31일',exact:true}).waitFor();await noOverflow(page);
  assert.deepEqual(state.errors,[]);await context.close();console.log('PASS touch gallery/dates/shorts/dropdown/failed calendar/boundary');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
