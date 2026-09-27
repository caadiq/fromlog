const assert=require('node:assert/strict');
const {launch,fixture}=require('../pc-public-media/base.cjs');
(async()=>{const b=await launch();try{const {page,state,go,context}=await fixture(b,{width:390,height:844});
 for(const path of ['/schedule','/schedule?search=검증']){
  await go(path);const scroll=page.locator('.mobile-content');await scroll.evaluate(e=>e.scrollTop=850);await page.waitForTimeout(500);
  const before=await scroll.evaluate(e=>e.scrollTop);assert.ok(before>=800);
  const row=page.getByRole('button').filter({hasText:'검증 일정'});let target;
  for(const r of await row.all()){const box=await r.boundingBox();if(box.y>180&&box.y+box.height<760){target=r;break;}}
  assert.ok(target,'visible row');await target.click();await page.getByRole('heading',{name:'검증 일정 상세'}).waitFor();await page.goBack();await scroll.waitFor();await page.waitForTimeout(700);
  const after=await scroll.evaluate(e=>e.scrollTop);assert.ok(Math.abs(after-before)<5,JSON.stringify({path,before,after}));console.log('PASS scroll Back',path,before,after);
 }
 const input=page.locator('input').first();await input.fill('새 검색');await input.press('Enter');await page.waitForTimeout(500);assert.equal(await page.locator('.mobile-content').evaluate(e=>e.scrollTop),0);
 assert.deepEqual(state.errors,[]);await context.close();
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
