const assert=require('node:assert/strict');
const {launch,artifact,origin}=require('../pc-public-media/base.cjs');
(async()=>{const browser=await launch();try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(req.method()!=='GET'||url.hostname==='caadiq.co.kr')return route.abort();return route.continue();});
 const page=await context.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const path of ['/video','/video/variety','/video/shorts','/schedule','/schedule?search=워크돌']){
  await page.goto(origin+path);await page.waitForTimeout(3000);
  assert.ok(!(await page.locator('body').innerText()).includes('불러오지 못했습니다'),path);
  const sizes=await page.evaluate(()=>({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight,contents:[...document.querySelectorAll('.mobile-content')].map(e=>({x:e.scrollWidth-e.clientWidth,y:e.scrollHeight-e.clientHeight}))}));
  assert.equal(sizes.x,0);assert.equal(sizes.y,0);assert.ok(sizes.contents.every(e=>e.x===0));
  await page.screenshot({path:artifact('live-mobile-'+path.replace(/[^a-z0-9]/gi,'-')+'.png')});console.log('LIVE',path,sizes);
 }
 await page.getByRole('button').filter({hasText:'워크돌'}).filter({hasText:'2026'}).first().tap();await page.waitForTimeout(2000);assert.match(page.url(),/\/schedule\/\d+/);
 await page.screenshot({path:artifact('live-mobile-detail.png')});await page.goBack();await page.waitForTimeout(500);assert.match(page.url(),/search=/);
 await page.goto(origin+'/schedule');await page.setViewportSize({width:844,height:390});await page.waitForTimeout(600);await page.getByRole('button',{name:'달력',exact:true}).tap();await page.getByRole('button',{name:'다음 달',exact:true}).tap();await page.waitForTimeout(1000);await page.screenshot({path:artifact('live-mobile-landscape-calendar.png')});
 assert.deepEqual(errors,[]);console.log('PASS LIVE search/detail/back/landscape/errors');await context.close();
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
