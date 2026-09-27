const assert=require('node:assert/strict');const fs=require('fs');const {launch,fixture,artifact}=require('./base.cjs');
(async()=>{const b=await launch(),report=[];try{
 for(const size of [{width:1100,height:450},{width:1280,height:720},{width:1920,height:1080}]){
  const {page:p,state:s,go,context}=await fixture(b,size);
  s.album.title='LongAlbumTitle'.repeat(9);s.album.album_type='긴앨범유형'.repeat(5);s.track.title='LongTrackTitle'.repeat(9);s.track.lyricist='LongCredit'.repeat(20);s.track.lyrics='LongLyrics'.repeat(100);s.fanchant.trackTitle='긴곡제목'.repeat(12);s.album.teasers=Array.from({length:18},()=>s.album.teasers[0]);
  for(const path of ['/album','/album/audit','/album/audit/gallery','/album/audit/track/검증 곡','/fanchant/196']){
   await go(path);await p.waitForTimeout(500);
   const measure=await p.evaluate(()=>({body:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight,scrolls:[...document.querySelectorAll('[data-overlayscrollbars-viewport]')].map(e=>({x:e.scrollWidth-e.clientWidth,h:e.clientHeight,sh:e.scrollHeight})),bad:[...document.querySelectorAll('h1')].map(e=>({w:e.clientWidth,sw:e.scrollWidth}))}));
   report.push({size,path,...measure,errors:[...s.errors]});
   await p.screenshot({path:artifact(`layout-${size.width}-${path.replaceAll('/','-')}.png`)});
  }
  await context.close();
 }
 console.log(JSON.stringify(report,null,2));assert.ok(report.every(r=>r.body<=1&&r.y<=1&&r.scrolls.every(s=>s.x<=1)&&r.bad.every(h=>h.sw<=h.w+1)&&!r.errors.length));
}finally{await b.close();fs.writeFileSync(artifact('layout.json'),JSON.stringify(report,null,2));}})().catch(e=>{console.error(e);process.exitCode=1;});
