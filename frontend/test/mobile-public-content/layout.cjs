const assert=require('node:assert/strict');const {launch,fixture,artifact}=require('./base.cjs');
const routes=['/','/members','/members/hayoung','/members/hayoung/photos','/album','/album/audit','/album/audit/gallery','/album/audit/track/검증 곡','/fanchant/196'];
(async()=>{const b=await launch();try{
 const {page:p,state:s,go,context}=await fixture(b);s.album.title='VeryLongAlbumTitle'.repeat(12);s.album.tracks[0].title='VeryLongTrackTitle'.repeat(12);s.album.album_type='ALBUM'.repeat(10);s.track.title='VeryLongTrackTitle'.repeat(12);s.track.lyricist='Songwriter'.repeat(25);s.track.lyrics='LongLyrics'.repeat(40);s.members[0].name='아주긴이름'.repeat(15);s.members[0].instagram='https://www.instagram.com/'+ 'longname'.repeat(15)+'/';
 const results=[];
 for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:800,height:1100},{width:1099,height:768}]){
  await p.setViewportSize(size);
  for(const path of routes){await go(path);const d=await p.evaluate(()=>({rootX:document.documentElement.scrollWidth-innerWidth,rootY:document.documentElement.scrollHeight-innerHeight,scrollers:[...document.querySelectorAll('.mobile-content')].map(e=>({x:e.scrollWidth-e.clientWidth,h:e.clientHeight,y:e.scrollHeight-e.clientHeight})),nav:document.querySelector('nav')?.getBoundingClientRect().toJSON()}));results.push({size,path,...d});if(d.rootX>1||d.scrollers.some(e=>e.x>1)||d.nav?.bottom>size.height+1)console.log('OVERFLOW',JSON.stringify(results.at(-1)));}
 }
 require('node:fs').writeFileSync(artifact('mobile-layout.json'),JSON.stringify(results,null,2));assert.ok(results.every(d=>d.rootX<=1&&d.scrollers.every(e=>e.x<=1)&&d.nav?.bottom<=d.size.height+1),'layout overflow');assert.deepEqual(s.errors,[]);
 await p.setViewportSize({width:390,height:844});await go('/album/audit');await p.getByRole('button',{name:'앨범 소개',exact:true}).click();await p.waitForTimeout(350);await p.screenshot({path:artifact('mobile-intro-long.png')});const box=await p.getByRole('dialog',{name:'앨범 소개',exact:true}).boundingBox();assert.ok(box.y>=0&&box.y+box.height<=844);await p.getByRole('button',{name:'앨범 소개 닫기'}).click();
 await p.setViewportSize({width:1100,height:768});await p.waitForTimeout(600);assert.equal(await p.locator('.mobile-layout-container').count(),0);await p.setViewportSize({width:390,height:844});await p.waitForTimeout(600);assert.equal(await p.locator('.mobile-layout-container').count(),1);await context.close();console.log('PASS 45 layouts/long content/intro/breakpoint');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
