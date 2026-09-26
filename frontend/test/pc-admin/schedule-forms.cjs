const { launch, fixture, origin } = require('./base.cjs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await launch();
  let passed = 0;
  try {
    for (const [route, endpoint, category] of [
      ['schedule/999/edit', '/schedules/999', {id:1,name:'기타'}],
      ['schedule/999/edit/youtube', '/schedules/999', {id:2,name:'유튜브'}],
      ['schedule/999/edit/fansign', '/schedules/999', {id:5,name:'팬사인회'}],
      ['schedule/999/edit/ticketing', '/schedules/999', {id:7,name:'티켓팅'}],
      ['schedule/concert/999/edit', '/admin/concert/schedule/999', {id:6,name:'콘서트'}],
    ]) {
      const {page,context,state,errors} = await fixture(browser);
      page.setDefaultTimeout(7000);
      try {
        state.override=async ({req,p}) => req.method()==='GET' && p===endpoint ? {body:{id:999,title:'저장 검증 일정',date:'2026-10-01',time:'19:00',category,videoType:'video',rounds:[{id:1,date:'2026-10-01',time:'19:00',venue:null}],setlists:{},merchandise:[]}} : null;
        await page.goto(origin+'/admin/'+route);
        await page.waitForTimeout(500);
        state.delay=300;
        await page.locator('button[type=submit]').click();
        await page.waitForTimeout(600);
        assert.equal(state.writes.length,1,route);
        assert.equal(state.writes[0].method,'PUT');
        assert.deepEqual(errors,[]);
        console.log('PASS',++passed,route,'save');
      } finally { await context.close(); }
    }
    const {page,context,state,errors} = await fixture(browser);
    try {
      await page.goto(origin+'/admin/schedule/new');
      for(const category of ['유튜브','X','예능','행사','기타','콘서트','팬사인회','티켓팅']) {
        await page.getByRole('button',{name:category,exact:true}).click();
        await page.waitForTimeout(400);
        assert.ok(await page.locator('input').count()>0,category);
        assert.deepEqual(errors,[]);
      }
      assert.equal(state.writes.length,0);
      console.log('PASS',++passed,'all eight new schedule category forms render');
    } finally {await context.close();}
    console.log('TOTAL',passed);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
