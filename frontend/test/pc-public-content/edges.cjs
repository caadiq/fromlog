const assert=require('node:assert/strict');const fs=require('fs');const {fixture,artifact,origin}=require('./base.cjs');const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn){let error;for(let i=0;i<60;i++){try{return await fn();}catch(e){error=e;await sleep(100);}}throw error;}
(async()=>{const report=[];try{
 for(const engine of ['chromium','firefox','webkit']){
  const b=await pw[engine].launch({args:engine==='chromium'?['--no-sandbox']:[]});try{
   const {page:p,state:s,context,go}=await fixture(b,{width:1440,height:900},'reduce');
   await go('/album/audit');await p.getByRole('button',{name:'앨범 소개',exact:true}).click();await p.getByRole('dialog',{name:'앨범 소개',exact:true}).waitFor();await p.keyboard.press('Escape');await p.getByRole('dialog').waitFor({state:'hidden'});
   await p.getByRole('button',{name:'컨셉 포토 1 크게 보기'}).click();const d=p.getByRole('dialog',{name:'이미지 뷰어',exact:true});await d.waitFor();await until(async()=>assert.equal(await d.evaluate(e=>+getComputedStyle(e).opacity),1));
   await p.getByRole('button',{name:'이미지 3/4',exact:true}).click({force:true});await p.getByText('3 / 4',{exact:true}).waitFor();assert.equal(await d.count(),1);
   await p.keyboard.press('Escape');await d.waitFor({state:'hidden'});assert.ok(await p.getByRole('button',{name:'컨셉 포토 1 크게 보기'}).evaluate(e=>e===document.activeElement));
   await go('/album/audit/gallery');await p.evaluate(()=>document.querySelector('.pc-public').style.zoom='1.5');await p.waitForTimeout(450);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
   await p.getByRole('button',{name:'GREEN 1 크게 보기',exact:true}).click();await d.waitFor();await p.getByRole('button',{name:'사진 정보',exact:true}).click();const info=p.getByRole('dialog',{name:'사진 정보',exact:true});await info.waitFor();await p.keyboard.press('Escape');await info.waitFor({state:'hidden'});await p.keyboard.press('Escape');await d.waitFor({state:'hidden'});
   await p.screenshot({path:artifact(`zoom-${engine}.png`)});assert.deepEqual(s.errors,[]);report.push({engine,reducedMotion:true,zoom:true,dialogs:true});await context.close();
  }finally{await b.close();}
 }
 const b=await pw.chromium.launch({args:['--no-sandbox']});try{
  const {page:p,state:s,context,go}=await fixture(b);s.album.conceptPhotos={Green:Array.from({length:600},(_,i)=>({...s.album.conceptPhotos.Green[0],id:i+1,medium_url:origin+`/media/photo-${i}.svg`}))};
  await go('/album/audit/gallery');const scroll=p.locator('.pc-public [data-overlayscrollbars-viewport]').first();await scroll.evaluate(e=>e.scrollTop=e.scrollHeight);await p.getByRole('button',{name:'GREEN 600 크게 보기',exact:true}).waitFor();assert.ok(await p.getByRole('button',{name:/크게 보기/}).count()<80);
  await p.getByRole('button',{name:'GREEN 600 크게 보기',exact:true}).click();const d=p.getByRole('dialog',{name:'이미지 뷰어',exact:true});await d.waitFor();await p.waitForTimeout(500);assert.equal(await d.evaluate(e=>+getComputedStyle(e).opacity),1);
  for(let i=0;i<12;i++)await p.keyboard.press('ArrowRight');await p.getByText('12 / 600',{exact:true}).waitFor();await p.keyboard.press('Escape');await d.waitFor({state:'hidden'});await scroll.evaluate(e=>e.scrollTop=0);
  await p.getByRole('button',{name:'GREEN',exact:true}).click();await p.getByRole('link',{name:'검증 앨범',exact:true}).click();await p.getByRole('heading',{name:'검증 앨범',exact:true}).waitFor();await p.goBack();await p.getByRole('button',{name:'ALL 600',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'ALL 600',exact:true}).getAttribute('aria-pressed'),'true');
  assert.deepEqual(s.errors,[]);report.push({largeGallery:600,rapidNavigation:true,reentry:'reset filters'});await context.close();
 }finally{await b.close();}
 console.log('PASS',JSON.stringify(report,null,2));
}finally{fs.writeFileSync(artifact('edges.json'),JSON.stringify(report,null,2));}})().catch(e=>{console.error(e);process.exitCode=1;});
