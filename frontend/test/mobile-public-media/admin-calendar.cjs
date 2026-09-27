const {launch,fixture,origin,assert}=require('../mobile-admin-schedule/base.cjs');
(async()=>{const b=await launch();try{const f=await fixture(b),p=f.page;
 await p.goto(origin+'/admin/schedule');await p.getByRole('link',{name:'테스트대학교 별빛 상세 보기'}).waitFor();
 await p.getByLabel('달력',{exact:true}).click();await p.locator('[data-calendar-month="2026-9"]').waitFor();
 await p.getByRole('button',{name:'9월 25일',exact:true}).click();await p.locator('[data-calendar-month]').waitFor({state:'hidden'});await p.getByRole('link',{name:'전날 일정 상세 보기'}).waitFor();
 await p.getByLabel('다음 달').click();await p.getByLabel('2026년 10월 선택').waitFor();await p.getByLabel('달력',{exact:true}).click();await p.locator('[data-calendar-month="2026-10"]').waitFor();
 await p.getByRole('button',{name:'10월 31일',exact:true}).click();await p.locator('[data-calendar-month]').waitFor({state:'hidden'});assert.deepEqual(f.errors,[]);await f.context.close();console.log('PASS shared calendar in mobile admin');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
