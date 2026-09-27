const assert = require('node:assert/strict');
const fs = require('node:fs');
const { launch, fixture, origin, artifact } = require('../pc-public-media/base.cjs');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) {
  let error;
  for (let i = 0; i < 60; i++) { try { return await check(); } catch (e) { error = e; await pause(100); } }
  throw error;
}
(async () => {
  const browser = await launch(), results = [];
  try {
    for (const mobile of [false, true]) {
      const f = await fixture(browser, mobile ? { width: 390, height: 844 } : undefined);
      const { page, context, state, go } = f;
      await context.route('**/api/schedules?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        schedules: Array.from({length:2000}, (_,i) => ({id:9000+i,title:`성능 검증 ${i}`,date:'2026-09-26',time:'19:00',category:{id:2,name:'유튜브',color:'#ff0033'}, source:{name:'검증 채널'}})), total:2000, hasMore:false, offset:0, limit:2000,
      }) }));
      await go('/schedule?search=검증');
      await until(async () => assert.ok(await page.locator('[data-index]').count() > 0));
      const start = await page.locator('[data-index]').count();
      assert.ok(start < 40, 'search must virtualize 2000 results');
      await page.locator('[data-index]').first().evaluate(e => {
        let parent=e.parentElement;
        while(parent && !(parent.scrollHeight>parent.clientHeight && ['auto','scroll'].includes(getComputedStyle(parent).overflowY))) parent=parent.parentElement;
        if (!parent) throw Error('missing search scroll container');
        parent.scrollTop=50000;
      });
      await page.waitForTimeout(500);
      const end = await page.locator('[data-index]').count();
      assert.ok(end > 0 && end < 40);
      results.push({mobile,search:{loaded:2000,mountedBefore:start,mountedAfter:end}});
      await page.screenshot({path:artifact(`search-${mobile?'mobile':'pc'}.png`)});
      await context.close();
    }
    for (const mobile of [false,true]) {
      const {page,context,state,go}=await fixture(browser,mobile?{width:390,height:844}:undefined);
      const cdp=await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      await go('/schedule');
      const snapshots=[];
      for(let i=0;i<20;i++) {
        await page.locator('a[href="/video"]').first().click();
        await page.locator('a[href*="watch?v="]').first().waitFor();
        await page.locator('a[href="/schedule"]').first().click();
        await page.getByRole('button',{name:'9월 26일',exact:mobile}).first().waitFor();
        await page.waitForTimeout(100);
        if([4,9,19].includes(i)) {
          await cdp.send('HeapProfiler.collectGarbage');
          const {metrics}=await cdp.send('Performance.getMetrics');
          snapshots.push({cycles:i+1, ...Object.fromEntries(metrics.filter(m=>['JSHeapUsedSize','Nodes','JSEventListeners','Documents'].includes(m.name)).map(m=>[m.name,m.value]))});
        }
      }
      assert.equal(await page.locator('iframe').count(),0);
      assert.deepEqual(state.errors,[]);
      assert.ok(snapshots.at(-1).JSHeapUsedSize < snapshots[0].JSHeapUsedSize * 1.5, 'retained heap growth');
      assert.ok(snapshots.at(-1).Nodes < snapshots[0].Nodes + 300, 'retained DOM growth');
      results.push({mobile,navigation:snapshots});
      await context.close();
    }
    // A route chunk interrupted by a connection failure must offer recovery.
    {
      const {page,context,go}=await fixture(browser);
      await context.route('**/assets/VideoList-*.js',r=>r.abort('internetdisconnected'));
      await go('/video/variety');
      await page.getByRole('alert').waitFor();
      await context.unroute('**/assets/VideoList-*.js');
      await page.getByRole('button',{name:'다시 시도',exact:true}).click();
      await page.locator('a[href*="watch?v="]').first().waitFor();
      await page.setViewportSize({width:390,height:844});
      await page.locator('.mobile-content').waitFor();
      await page.locator('a[href*="watch?v="]').first().waitFor();
      await context.setOffline(true);
      await page.locator('a[href="/video"]').first().click();
      await page.waitForTimeout(500);
      await context.setOffline(false);
      await page.waitForTimeout(1300);
      if(await page.getByRole('alert').count()) await page.getByRole('button',{name:'다시 시도',exact:true}).click();
      await page.locator('a[href*="watch?v="]').first().waitFor();
      results.push({chunkFailureRecovery:true,viewportSwitch:true,reconnect:true});
      await context.close();
    }
    for(const reducedMotion of ['no-preference','reduce']) {
      const {page,context,state,go}=await fixture(browser,undefined,reducedMotion);
      const requested = new Set();
      await context.route('**/api/albums**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(new URL(r.request().url()).pathname==='/api/albums' ? [] : {photos:Array.from({length:10},(_,i)=>`${origin}/hero-${i}.svg`)})}));
      await context.route('**/hero-*.svg',r=>{requested.add(r.request().url());return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#76926f"/></svg>'});});
      await page.clock.install();
      await go('/');
      assert.equal(requested.size,reducedMotion==='reduce'?1:2,'only current and next slide requested initially');
      if(reducedMotion==='no-preference') {
        for(let i=0;i<11;i++) {
          await page.clock.fastForward(5500);await page.waitForTimeout(100);
          const imgs=page.locator('img[src*="/hero-"]');
          assert.ok(await imgs.count()<=3);
          await until(async()=>assert.equal(await imgs.evaluateAll(els=>els.filter(e=>e.classList.contains('opacity-100')&&e.complete).length),1));
        }
        assert.equal(requested.size,10);
      }
      assert.deepEqual(state.errors,[]);
      results.push({hero:reducedMotion,requested:requested.size});
      await context.close();
    }
    console.log('PASS',JSON.stringify(results,null,2));
  } finally { await browser.close(); fs.writeFileSync(artifact('verification.json'),JSON.stringify(results,null,2)); }
})().catch(e=>{console.error(e);process.exitCode=1;});
