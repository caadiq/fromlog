const assert=require('node:assert/strict');const fs=require('fs');
const {launch,fixture,artifact,origin}=require('./base.cjs');
async function until(check){let error;for(let i=0;i<65;i++){try{return await check();}catch(e){error=e;await new Promise(r=>setTimeout(r,100));}}throw error;}
const dialog=p=>p.getByRole('dialog',{name:'이미지 뷰어',exact:true});
(async()=>{const b=await launch(),results=[];try{
 for(const [path,label]of [['/album','앨범 목록'],['/album/audit','앨범'],['/album/audit/gallery','앨범'],['/album/audit/track/검증 곡','곡'],['/album/audit/track/검증 곡/fanchant','곡'],['/fanchant/196','응원법']]){
  const {page:p,state:s,go,context}=await fixture(b);s.failPath=()=>true;await go(path);await p.getByText(`${label}을 불러오지 못했습니다.`).waitFor();s.failPath=null;await p.getByRole('button',{name:'다시 시도'}).click();if(path==='/album') await p.getByText('1 ALBUMS',{exact:true}).waitFor(); else await p.getByRole('heading',{level:1}).first().waitFor();assert.deepEqual(s.errors,[]);results.push('error/retry '+path);console.log('PASS error/retry',path);await context.close();
 }
 {
  const {page:p,state:s,go,context}=await fixture(b);s.empty=true;await go('/album');await p.getByText('등록된 앨범이 없습니다.').waitFor();s.empty=false;s.album.conceptPhotos={};await go('/album/audit/gallery');await p.getByText('등록된 사진이 없습니다.').waitFor();s.failPath=()=>true;s.status=404;
  for(const [path,text] of [['/album/missing','앨범을 찾을 수 없습니다'],['/album/audit/track/missing','곡을 찾을 수 없습니다'],['/fanchant/404','응원법이 없습니다']]){await go(path);await p.getByText(text,{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'다시 시도'}).count(),0);}
  results.push('empty/404');await context.close();
 }
 {
  const {page:p,state:s,go,context}=await fixture(b);await go('/album');await p.locator('a[href="/album/audit"]').click();await p.getByRole('heading',{name:'검증 앨범',exact:true}).waitFor();
  const about=p.getByRole('button',{name:'앨범 소개',exact:true});await about.click();const d=p.getByRole('dialog',{name:'앨범 소개',exact:true});await d.waitFor();await p.keyboard.press('Tab');assert.ok(await d.evaluate(el=>el.contains(document.activeElement)));await p.keyboard.press('Escape');await d.waitFor({state:'hidden'});assert.ok(await about.evaluate(el=>el===document.activeElement));
  await about.click();await d.waitFor();await p.goBack();await d.waitFor({state:'hidden'});assert.ok(p.url().endsWith('/album/audit'));
  await p.getByRole('link',{name:/01.*검증 곡/}).click();await p.getByRole('heading',{name:'검증 곡',exact:true}).waitFor();await p.getByRole('button',{name:'전체 가사 펼치기 ↓'}).click();await p.getByRole('button',{name:'가사 접기 ↑'}).waitFor();await p.getByRole('button',{name:'가사 접기 ↑'}).click();
  await p.getByRole('link',{name:'응원법 보기'}).click();await p.getByRole('heading',{name:'검증 곡 응원법'}).waitFor();await p.getByText('YouTube 영상을 불러오지 못했습니다.').waitFor();assert.deepEqual(s.errors,[]);results.push('album/track/lyrics/fanchant/about keyboard/back');await context.close();
 }
 {
  const {page:p,state:s,go,context}=await fixture(b);await go('/album/audit/gallery');await p.getByRole('button',{name:'GREEN 1 크게 보기',exact:true}).click();await dialog(p).waitFor();await until(async()=>assert.ok(await dialog(p).evaluate(el=>el.contains(document.activeElement))));await p.keyboard.press('Tab');assert.ok(await dialog(p).evaluate(el=>el.contains(document.activeElement)));
  await p.getByRole('button',{name:'사진 정보',exact:true}).click();const info=p.getByRole('dialog',{name:'사진 정보',exact:true});await info.waitFor();await p.keyboard.press('Escape');await info.waitFor({state:'hidden'});assert.equal(await dialog(p).count(),1);
  await p.getByRole('button',{name:'사진 정보',exact:true}).click();await info.waitFor();await p.goBack();await info.waitFor({state:'hidden'});assert.equal(await dialog(p).count(),1);
  await p.keyboard.press('ArrowLeft');await p.getByText('8 / 8',{exact:true}).waitFor();const img=dialog(p).getByRole('img',{name:'이미지 8',exact:true});await until(async()=>assert.ok(await img.evaluate(e=>e.complete&&e.naturalWidth>0)));await img.click();await until(async()=>assert.match(await img.getAttribute('style'),/scale\(2\)/));await img.click();
  const download=p.waitForEvent('download');await p.getByRole('button',{name:'다운로드',exact:true}).click();assert.equal((await download).suggestedFilename(),'photo-7.svg');
  await p.keyboard.press('Escape');await dialog(p).waitFor({state:'hidden'});assert.ok(await p.getByRole('button',{name:'GREEN 1 크게 보기',exact:true}).evaluate(e=>e===document.activeElement));
  await p.getByRole('button',{name:'개인 4',exact:true}).click();assert.equal(await p.getByRole('button',{name:'개인 4',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await p.getByRole('button',{name:/크게 보기/}).count(),4);
  assert.deepEqual(s.errors,[]);results.push('gallery filter/thumbnail fallback/zoom/download/focus/Escape/Back');await context.close();
 }
 {
  const {page:p,state:s,go,context}=await fixture(b);s.mediaFailure=true;await go('/album/audit');await p.getByRole('button',{name:'앨범 커버 크게 보기'}).click();await p.getByText('미디어를 불러오지 못했습니다.').waitFor();assert.equal(await p.getByRole('status',{name:'미디어 불러오는 중'}).count(),0);
  let downloaded=false;p.on('download',()=>downloaded=true);await p.getByRole('button',{name:'다운로드',exact:true}).click();await p.getByText('다운로드하지 못했습니다. 다시 시도해주세요.').waitFor();assert.equal(downloaded,false);
  s.mediaFailure=false;await p.getByRole('button',{name:'다시 시도',exact:true}).click();await until(async()=>assert.equal(await dialog(p).getByRole('img').evaluate(e=>e.naturalWidth>0),true));await p.keyboard.press('Escape');await dialog(p).waitFor({state:'hidden'});
  await p.getByRole('button',{name:'티저 2 보기'}).click();await p.getByText('미디어를 불러오지 못했습니다.').waitFor();await p.getByRole('button',{name:'이전 이미지'}).click();await until(async()=>assert.equal(await dialog(p).getByRole('img').evaluate(e=>e.naturalWidth>0),true));await p.keyboard.press('Escape');assert.deepEqual(s.errors,[]);results.push('image/video failure/retry/download HTTP error');await context.close();
 }
 {
  const {page:p,state:s,go,context}=await fixture(b);s.delay=1200;await p.goto(origin+'/album/audit/track/검증 곡/fanchant');await p.waitForTimeout(350);assert.equal(await p.getByText('응원법이 없습니다',{exact:true}).count(),0);await p.getByRole('heading',{name:'검증 곡 응원법'}).waitFor();results.push('slow track does not show premature 404');await context.close();
 }
 console.log('PASS',JSON.stringify(results,null,2));
}finally{await b.close();fs.writeFileSync(artifact('verify.json'),JSON.stringify(results,null,2));}})().catch(e=>{console.error(e);process.exitCode=1;});
