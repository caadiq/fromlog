const base = require('../pc-admin/base.cjs');
const assert = require('node:assert/strict');
async function fixture(browser, viewport = {width:390,height:844}) {
  const f = await base.fixture(browser, viewport), {state:s,page:p}=f;
  p.setDefaultTimeout(6500);
  await p.clock.setFixedTime(new Date('2026-09-27T12:00:00+09:00'));
  s.calls=[];s.respond=null;s.failWrite=false;s.delayWrite=0;
  s.videos=Array.from({length:41},(_,i)=>({videoId:`testvideo${String(i).padStart(2,'0')}`,title:`검증 영상 ${i}`,channelName:'검증 채널',publishedAt:'2026-09-27T03:00:00Z',category:'variety',videoType:'video'}));
  s.bots=['youtube','x','festival','meilisearch'].map((type,i)=>({id:`${type}-${i+1}`,db_id:i+1,type,name:`검증 ${type}`,status:'running',check_interval:5,schedules_added:3,last_added_count:1,last_check_at:'2026-09-27T03:00:00Z'}));
  s.links=[{id:1,title:'첫째 링크',url:'https://example.com/1',enabled:true,startsAt:null,endsAt:null},{id:2,title:'둘째 링크',url:'https://example.com/2',enabled:false,startsAt:null,endsAt:null}];
  s.logs=Array.from({length:41},(_,i)=>({id:i+1,created_at:'2026-09-27T12:00:00',actor:'admin',action:'update',category:'schedule',summary:`검증 활동 ${i}`,target_type:'schedule',target_id:999,details:{text:'기록 내용',value:i}}));
  s.theme={mode:'auto',manualColor:'#548360',resolved:{primary:'#548360',soft:'#E8F2E8',deep:'#256A25',source:'auto'},autoAlbum:null};
  s.override=async info=>{
    const {req,p,u}=info, method=req.method(), body=req.postDataJSON?.();
    s.calls.push({p,method,body,query:Object.fromEntries(u.searchParams)});
    if(s.respond){const custom=await s.respond(info);if(custom)return custom;}
    if(s.fail===p)return {status:503,body:{error:'검증용 조회 실패'}};
    if(method!=='GET'){
      if(s.delayWrite)await new Promise(r=>setTimeout(r,s.delayWrite));
      if(s.failWrite)return {status:503,body:{error:'검증용 저장 실패'}};
      if(p==='/admin/schedule-links/order'){s.links=body.ids.map(id=>s.links.find(x=>x.id===id));return {body:{success:true}};}
      if(p.endsWith('/visibility')){s.links=s.links.map(x=>x.id===+p.split('/')[3]?{...x,enabled:body.enabled}:x);return {body:{success:true}};}
      if(p.startsWith('/admin/schedule-links')){
        const id=+p.split('/')[3];
        if(method==='DELETE')s.links=s.links.filter(x=>x.id!==id);
        else if(method==='PUT')s.links=s.links.map(x=>x.id===id?{...x,...body}:x);
        else if(method==='POST')s.links.push({id:50,...body});
        return {body:{success:true}};
      }
      if(p==='/admin/theme'){s.theme={...s.theme,...body,resolved:{...s.theme.resolved,primary:body.manualColor,source:body.mode}};return {body:s.theme.resolved};}
      if(p.includes('reextract'))return {body:{updated:2,failed:[]}};
      if(p.endsWith('/lookup'))return {body:{channelId:'channel-test',title:'조회한 채널',username:'test_account',displayName:'조회한 계정',bannerUrl:null}};
      if(/\/admin\/bots\/.+\/(stop|start)$/.test(p)){s.bots=s.bots.map(x=>x.id===p.split('/')[3]?{...x,status:p.endsWith('/stop')?'stopped':'running'}:x);return {body:{success:true}};}
      if(method==='DELETE'&&/\/admin\/(youtube|x|festival)-bots\//.test(p)){s.bots=s.bots.filter(x=>x.db_id!==+p.split('/')[3]);return {body:{success:true}};}
      if(method==='DELETE'&&p.startsWith('/admin/videos/')){s.videos=s.videos.filter(x=>x.videoId!==p.split('/').pop());return {body:{success:true}};}
    }
    if(method==='GET'){
      if(p==='/admin/videos'){const rows=s.videos.filter(x=>(!u.searchParams.get('q')||x.title.includes(u.searchParams.get('q')))&&(!u.searchParams.get('category')||x.category===u.searchParams.get('category')));const offset=+u.searchParams.get('offset')||0,limit=+u.searchParams.get('limit')||20;return {body:{videos:rows.slice(offset,offset+limit),total:rows.length,channels:['검증 채널','다른 채널']}};}
      if(p==='/admin/bots')return {body:s.bots};
      if(p==='/admin/bots/quota-warning')return {body:{active:false}};
      if(p==='/admin/schedule-links')return {body:s.links};
      if(p==='/admin/theme')return {body:s.theme};
      if(p==='/admin/logs'){const rows=s.logs.filter(x=>!u.searchParams.get('search')||x.summary.includes(u.searchParams.get('search'))),page=+u.searchParams.get('page')||1,limit=+u.searchParams.get('limit')||20;return {body:{logs:rows.slice((page-1)*limit,page*limit),total:rows.length,totalPages:Math.ceil(rows.length/limit),page}};}
      if(p.endsWith('/scheduled'))return {body:{scheduled:null}};
      if(/^\/schedules\/\d+$/.test(p))return {body:{id:999,title:'관련 일정',date:'2026-09-27',category:{id:1,name:'기타'},description:'상세 내용'}};
    }
    return null;
  };
  return f;
}
async function run(suites){
 const browser=await base.launch();let passed=0;const failures=[];
 try{for(const [name,fn] of suites){if(process.env.AUDIT_FILTER&&!name.includes(process.env.AUDIT_FILTER))continue;const f=await fixture(browser);try{await fn(f);assert.deepEqual(f.errors,[]);console.log('PASS',++passed,name);}catch(e){failures.push(name);console.error('FAIL',name,e.stack);await f.page.screenshot({path:base.artifact(`failure-${failures.length}.png`)});}finally{await f.context.close();}}
 }finally{await browser.close();}
 console.log(JSON.stringify({passed,failures}));if(failures.length)process.exitCode=1;
}
const writes=s=>s.calls.filter(x=>x.method!=='GET'&&!x.p.endsWith('/lookup'));
module.exports={...base,fixture,run,assert,writes};
