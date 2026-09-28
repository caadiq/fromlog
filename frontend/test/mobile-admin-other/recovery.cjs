// Synthetic API responses only: never stop or execute a real bot.
const {launch,fixture,origin,artifact,assert}=require('./base.cjs');
(async()=>{
  const browser=await launch();
  try {
    for(const width of [320,390,1440]) {
      const f=await fixture(browser,{width,height:900}),{page:p,state:s}=f;
      s.bots[0]={...s.bots[0],enabled:true,status:'recovering',next_retry_at:'2026-09-27T03:10:00Z'};
      await p.goto(origin+'/admin/schedule/bots');
      const row=width<1100?p.getByRole('listitem').filter({has:p.getByRole('heading',{name:'검증 youtube'})}):p.getByRole('row').filter({hasText:'검증 youtube'});
      await row.getByText('복구 대기',{exact:false}).waitFor();
      await row.getByText(/재시도.*12:10|재시도.*오후 12:10/).waitFor();
      await p.waitForTimeout(800);
      await p.screenshot({path:artifact(`recovery-${width}.png`),fullPage:true});
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await row.getByRole('button',{name:width<1100?'검증 youtube 정지':'정지',exact:true}).click();
      await row.getByText('정지됨',{exact:false}).waitFor();
      assert.ok(s.calls.some(x=>x.method==='POST'&&x.p==='/admin/bots/youtube-1/stop'));
      assert.deepEqual(f.errors,[]);
      await f.context.close();console.log('PASS recovery display and manual stop',width);
    }
  } finally {await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
