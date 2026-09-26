const { launch, fixture, origin } = require('./base.cjs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await launch();
  let passed = 0;
  try {
    for (const [index, type] of ['youtube', 'x', 'festival'].entries()) {
      const {page,context,state,errors}=await fixture(browser,{width:1440,height:450});
      page.setDefaultTimeout(7000);
      try {
        state.override=async({p})=>p.endsWith('/lookup')?{body:{channelId:'test-channel',title:'검증 채널',username:'test_account',displayName:'검증 계정'}}:null;
        await page.goto(origin+'/admin/schedule/bots');
        await page.getByRole('button',{name:/봇 추가/}).nth(index).click();
        const dialog=page.getByRole('dialog');
        if(type==='festival') {
          await page.getByPlaceholder('DC 일정 수집 봇').fill('검증 수집 봇');
          await page.getByPlaceholder('https://m.dcinside.com/board/fromis9?...').fill('https://m.dcinside.com/board/fromis9');
        } else {
          await page.getByPlaceholder(type==='youtube'?'studiofromis_9':'realfromis_9').fill('test_account');
          await dialog.getByRole('button',{name:'조회',exact:true}).click();
        }
        state.delay=300;
        await dialog.getByRole('button',{name:'추가',exact:true}).click();
        await page.keyboard.press('Escape');
        assert.ok(await dialog.isVisible());
        await dialog.waitFor({state:'hidden'});
        assert.equal(state.writes.length,1);
        assert.equal(state.writes[0].p,`/admin/${type}-bots`);
        assert.equal(state.writes[0].method,'POST');
        await page.getByRole('row').filter({hasText:'테스트 '+type}).getByRole('button',{name:'수정',exact:true}).click();
        await dialog.getByRole('button',{name:'수정',exact:true}).click();
        await dialog.waitFor({state:'hidden'});
        assert.equal(state.writes.length,2);
        assert.equal(state.writes[1].method,'PUT');
        assert.deepEqual(errors,[]);
        console.log('PASS',++passed,type,'create and edit with save lock');
      } finally {await context.close();}
    }
    console.log('TOTAL',passed);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
