const {launch,fixture,origin,artifact,assert}=require('./base.cjs');
const fs=require('node:fs');
(async()=>{const browser=await launch();const report=[];try{
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:800,height:1100},{width:1099,height:650}]){
  const f=await fixture(browser,viewport),{page:p,state:s}=f;
  s.videos[0].title='매우긴제목'.repeat(35);s.videos[0].channelName='긴채널'.repeat(35);s.bots[0].name='긴봇이름'.repeat(30);s.links[0].title='긴링크제목'.repeat(30);s.logs[0].summary='긴활동내용'.repeat(55);
  const check=async(name)=>{
   await p.waitForTimeout(420);
   const result=await p.evaluate(()=>{
    const root=document.documentElement,dialog=document.querySelector('[role="dialog"][aria-modal="true"],dialog[open].mobile-queue-review');
    const r=dialog?.getBoundingClientRect();const bad=[...document.querySelectorAll('main,[data-review-scroll],form,nav,dialog[open]')].filter(el=>el.getClientRects().length&&el.scrollWidth>el.clientWidth+2).map(el=>({tag:el.tagName,label:el.getAttribute('aria-label'),overflow:el.scrollWidth-el.clientWidth}));
    return {width:innerWidth,height:innerHeight,overflowX:root.scrollWidth-root.clientWidth,overflowY:root.scrollHeight-root.clientHeight,dialog:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,bad};
   });report.push({name,...result});if(viewport.width===390)await p.screenshot({path:artifact(name.replaceAll('/','-')+'.png')});
  };
  for(const [path,open]of [
   ['/admin/videos',()=>p.getByRole('button',{name:'영상 추가',exact:true}).click()],
   ['/admin/logs',()=>p.getByRole('button',{name:'상세 필터',exact:true}).click()],
   ['/admin/schedule/links',()=>p.getByRole('button',{name:'링크 추가',exact:true}).click()],
   ['/admin/theme',()=>p.getByRole('button',{name:'수동 직접 지정'}).click()],
   ['/admin/schedule/bots',async()=>{await p.getByRole('button',{name:'봇 추가',exact:true}).click();await p.getByRole('button',{name:'YouTube 봇 추가',exact:true}).click();}]
  ]){await p.goto(origin+path);await p.getByRole('heading',{level:1}).waitFor();await check(`${viewport.width}-${path}`);await open();await check(`${viewport.width}-${path}-editor`);}
  assert.deepEqual(f.errors,[]);await f.context.close();console.log('SIZE',viewport.width,'complete');
 }
}finally{await browser.close();fs.writeFileSync(artifact('layout.json'),JSON.stringify(report,null,2));}
 const failed=report.filter(x=>x.overflowX>1||x.overflowY>1||x.bad.length||x.dialog&&(x.dialog.x< -1||x.dialog.y< -1||x.dialog.x+x.dialog.width>x.width+1||x.dialog.y+x.dialog.height>x.height+1));console.log('CHECKS',report.length,'FAILURES',JSON.stringify(failed));if(failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
