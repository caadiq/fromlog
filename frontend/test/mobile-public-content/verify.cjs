const assert=require('node:assert/strict');const {launch,fixture,artifact}=require('./base.cjs');
(async()=>{const b=await launch();try{
 for(const [path,failed,text] of [
  ['/members',p=>p==='/members','멤버 정보를 불러오지 못했습니다.'],
  ['/members/hayoung',p=>p==='/members','멤버 정보를 불러오지 못했습니다.'],
  ['/members/hayoung/photos',p=>p.includes('/photos'),'사진을 불러오지 못했습니다.'],
  ['/album',p=>p==='/albums','앨범을 불러오지 못했습니다.'],
  ['/album/audit',p=>p.startsWith('/albums/by-name'),'앨범을 불러오지 못했습니다.'],
  ['/album/audit/gallery',p=>p.startsWith('/albums/by-name'),'앨범을 불러오지 못했습니다.'],
  ['/album/audit/track/검증 곡',p=>p.includes('/track/'),'곡을 불러오지 못했습니다.'],
  ['/album/audit/track/검증 곡/fanchant',p=>p.includes('/track/'),'곡을 불러오지 못했습니다.'],
  ['/fanchant/196',p=>p==='/fanchant/196','응원법을 불러오지 못했습니다.']]){
  const f=await fixture(b);f.state.failPath=failed;await f.go(path);await f.page.getByText(text,{exact:true}).waitFor();f.state.failPath=null;await f.page.getByRole('button',{name:'다시 시도',exact:true}).click();await f.page.getByText(text,{exact:true}).waitFor({state:'hidden'});assert.deepEqual(f.state.errors,[]);await f.context.close();console.log('PASS retry',path);
 }
 const f=await fixture(b),{page:p,state:s,go,context}=f;
 await go('/members/missing/photos');await p.getByText('멤버를 찾을 수 없습니다.').waitFor();
 s.empty=true;await go('/members');await p.getByText('등록된 멤버가 없습니다.').waitFor();await go('/album');await p.getByText('등록된 앨범이 없습니다.').waitFor();s.empty=false;
 await go('/');await p.locator('a[href="/members/hayoung"]').click();await p.getByRole('heading',{name:'송하영',exact:true}).waitFor();await p.goBack();assert.equal(new URL(p.url()).pathname,'/');
 await go('/album/audit');await p.getByRole('button',{name:'앨범 소개',exact:true}).click();await p.getByRole('dialog',{name:'앨범 소개',exact:true}).waitFor();await p.goBack();await p.getByRole('dialog').waitFor({state:'hidden'});assert.equal(new URL(p.url()).pathname,'/album/audit');
 await p.getByRole('button',{name:'앨범 소개',exact:true}).click();await p.waitForTimeout(250);await p.keyboard.press('Escape');await p.getByRole('dialog').waitFor({state:'hidden'});
 s.track.video_url=null;await go('/album/audit/track/검증 곡');await p.getByRole('link',{name:'응원법',exact:true}).waitFor();await p.getByRole('button',{name:'전체 가사 펼치기 ↓'}).click();await p.getByText(/검증 가사 39/).waitFor();await p.getByRole('button',{name:'가사 접기 ↑'}).click();
 await go('/album/audit/gallery');await p.getByRole('button',{name:'사진 1 보기',exact:true}).click();await p.getByRole('dialog',{name:'이미지 뷰어',exact:true}).waitFor();await p.getByRole('button',{name:'사진 정보',exact:true}).click();await p.getByRole('dialog',{name:'사진 정보',exact:true}).waitFor();await p.goBack();await p.getByRole('dialog',{name:'사진 정보',exact:true}).waitFor({state:'hidden'});await p.getByRole('dialog',{name:'이미지 뷰어',exact:true}).waitFor();await p.goBack();await p.getByRole('dialog').waitFor({state:'hidden'});
 await p.getByRole('button',{name:'사진 8 보기',exact:true}).click();assert.ok(await p.locator('.swiper-slide-active img').evaluate(e=>e.complete&&e.naturalWidth>0));const dl= p.waitForEvent('download');await p.getByRole('button',{name:'이미지 다운로드'}).click();assert.equal((await dl).suggestedFilename(),'photo-7.svg');await p.getByRole('button',{name:'이미지 뷰어 닫기'}).click();
 s.mediaFailure=true;await go('/album/audit/gallery');await p.getByRole('button',{name:'사진 1 보기',exact:true}).click();await p.getByText('미디어를 불러오지 못했습니다.').first().waitFor();s.mediaFailure=false;await p.locator('.swiper-slide-active').getByRole('button',{name:'다시 시도'}).click();await p.waitForFunction(()=>document.querySelector('.swiper-slide-active img')?.naturalWidth>0);s.mediaFailure=true;await p.getByRole('button',{name:'이미지 다운로드'}).click();await p.getByText('다운로드하지 못했습니다. 다시 시도해주세요.').waitFor();await p.screenshot({path:artifact('mobile-download-error.png')});
 assert.deepEqual(s.errors,[]);await context.close();console.log('PASS empty/missing/home/intro/lyrics/viewer/history/fallback/download errors');
 // Track lookup must finish before deciding the fanchant is missing.
 const slow=await fixture(b);slow.state.delay=1200;await slow.page.goto(require('./base.cjs').origin+'/album/audit/track/검증 곡/fanchant');await slow.page.waitForTimeout(350);assert.equal(await slow.page.getByText('응원법이 없습니다').count(),0);await slow.page.getByRole('heading',{name:'검증 곡 응원법'}).waitFor();assert.deepEqual(slow.state.errors,[]);await slow.context.close();console.log('PASS slow track lookup');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
