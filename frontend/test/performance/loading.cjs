const {launch,fixture,origin}=require('../pc-public-media/base.cjs');
const fs=require('node:fs');
(async()=>{const browser=await launch(),report=[];try{
 for(const mobile of [false,true])for(const route of ['/','/video/variety','/schedule'])for(let repeat=0;repeat<3;repeat++){
  const {page,context,state}=await fixture(browser,mobile?{width:390,height:844}:{width:1440,height:900});
  await context.route('**/api/albums**',route=>route.fulfill({contentType:'application/json',body:new URL(route.request().url()).pathname==='/api/albums'?'[]':'{}'}));
  await context.addInitScript(()=>{window.measure={lcp:0,longTasks:[]};new PerformanceObserver(list=>{for(const e of list.getEntries())window.measure.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(list=>{window.measure.longTasks.push(...list.getEntries().map(e=>e.duration));}).observe({type:'longtask',buffered:true});});
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Emulation.setCPUThrottlingRate',{rate:mobile?4:1});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:mobile?100:20,downloadThroughput:mobile?200000:2000000,uploadThroughput:1000000});
  await page.goto(origin+route);await page.waitForTimeout(3000);
  const result=await page.evaluate(()=>({lcp:window.measure.lcp,tbt:window.measure.longTasks.reduce((n,x)=>n+Math.max(0,x-50),0),scripts:performance.getEntriesByType('resource').filter(r=>r.initiatorType==='script').map(r=>({name:r.name.split('/').pop(),bytes:r.encodedBodySize})),dom:document.getElementsByTagName('*').length}));
  if(state.errors.length)throw Error(state.errors.join('\n'));report.push({mobile,route,repeat,...result});console.log(mobile?'mobile':'pc',route,repeat,'LCP',Math.round(result.lcp),'JS',result.scripts.reduce((s,r)=>s+r.bytes,0));await context.close();
 }
}finally{await browser.close();fs.writeFileSync(process.env.RESULT_FILE,JSON.stringify(report,null,2));}})().catch(e=>{console.error(e);process.exitCode=1;});
