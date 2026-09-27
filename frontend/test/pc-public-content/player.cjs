const assert=require('node:assert/strict');const {launch,fixture}=require('./base.cjs');
(async()=>{const b=await launch();try{
 const {page:p,state:s,go,context}=await fixture(b);await go('/fanchant/196');await p.getByText('YouTube 영상을 불러오지 못했습니다.').waitFor();
 await p.evaluate(()=>{
  window.calls={created:0,destroyed:0,seek:[],played:0};
  window.YT={PlayerState:{PLAYING:1},Player:class{
   constructor(node,options){this.time=0;this.options=options;window.calls.created++;this.node=node;node.textContent='MOCK PLAYER';setTimeout(()=>options.events.onReady({target:this}),0);}
   getDuration(){return 180;}getCurrentTime(){return this.time;}
   seekTo(t){this.time=t;window.calls.seek.push(t);}
   playVideo(){window.calls.played++;this.options.events.onStateChange({target:this,data:1});}
   pauseVideo(){this.options.events.onStateChange({target:this,data:2});}
   destroy(){window.calls.destroyed++;this.node.remove();}
  }};
 });
 await p.getByRole('button',{name:'다시 시도'}).click();await p.getByText('MOCK PLAYER',{exact:true}).waitFor();
 await p.getByText('검증 응원 2',{exact:true}).click();assert.deepEqual(await p.evaluate(()=>window.calls.seek),[4]);assert.equal(await p.evaluate(()=>window.calls.played),1);
 await p.locator('h1').click();await p.keyboard.press('ArrowRight');assert.deepEqual(await p.evaluate(()=>window.calls.seek),[4,9]);
 await p.getByRole('link',{name:'DISCOGRAPHY',exact:true}).focus();await p.keyboard.press('Space');assert.equal(await p.evaluate(()=>window.calls.played),1);
 await p.getByRole('link',{name:'DISCOGRAPHY',exact:true}).click();await p.getByText('1 ALBUMS',{exact:true}).waitFor();assert.equal(await p.evaluate(()=>window.calls.destroyed),await p.evaluate(()=>window.calls.created));assert.deepEqual(s.errors,[]);
 s.track.video_url=null;await go('/album/audit/track/검증 곡');await p.getByRole('link',{name:'응원법 보기'}).waitFor();await context.close();console.log('PASS player retry/seek/keyboard/destroy/no-MV fanchant link');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
