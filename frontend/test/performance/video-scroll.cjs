const assert=require('node:assert/strict');
const fs=require('node:fs');
const {launch,fixture,origin,artifact}=require('../pc-public-media/base.cjs');
(async()=>{const browser=await launch(),results=[];try{
 for(const mobile of [false,true]){
  const {page,context,state,go}=await fixture(browser,mobile?{width:390,height:844}:undefined);
  const offsets=[];
  await context.route('**/api/videos?**',r=>{
   const u=new URL(r.request().url()),offset=Number(u.searchParams.get('offset')||0);offsets.push(offset);
   return r.fulfill({contentType:'application/json',body:JSON.stringify({videos:Array.from({length:24},(_,i)=>({videoId:`testvid${String(offset+i).padStart(4,'0')}`,title:`검증 영상 ${offset+i}`,channelName:'검증 채널',publishedAt:'2026-09-26',category:'variety',videoType:'video'})),total:600,offset,limit:24,hasMore:offset+24<600,facets:{channels:[]},months:[{ym:'2026-09',count:600}]})});
  });
  await go('/video/variety');
  const scroller=page.locator(mobile?'.mobile-content':'.pc-public [data-overlayscrollbars-viewport]').first();
  for(let count=48;count<=600;count+=24){
   await scroller.evaluate(e=>e.scrollTop=e.scrollHeight);
   await page.waitForFunction(n=>document.querySelectorAll('a[href*="watch?v="]').length>=n,count);
   await page.waitForTimeout(40);
  }
  assert.equal(new Set(offsets).size,25);
  assert.equal(offsets.length,25,'each page fetched once');
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('HeapProfiler.collectGarbage');
  const {metrics}=await cdp.send('Performance.getMetrics');
  await scroller.evaluate(e=>e.scrollTop=0);await page.waitForTimeout(500);
  await page.getByRole('button',{name:'전체 채널',exact:true}).click();await page.getByRole('listbox').waitFor();
  await page.keyboard.press('Escape');
  assert.deepEqual(state.errors,[]);
  results.push({mobile,loaded:600,pages:offsets.length,dom:await page.locator('*').count(),...Object.fromEntries(metrics.filter(m=>['JSHeapUsedSize','Nodes'].includes(m.name)).map(m=>[m.name,m.value]))});
  await context.close();
 }
 console.log('PASS',JSON.stringify(results,null,2));
}finally{await browser.close();fs.writeFileSync(artifact('video-scroll.json'),JSON.stringify(results,null,2));}})().catch(e=>{console.error(e);process.exitCode=1;});
