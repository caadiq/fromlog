const base=require('../pc-public-content/base.cjs');
async function fixture(browser,viewport={width:390,height:844},reducedMotion='no-preference') {
 const f=await base.fixture(browser,viewport,reducedMotion,{hasTouch:true}),{context,state:s}=f;
 s.members=[{id:1,name:'송하영',name_en:'Hayoung',birth_date:'1997-09-29',image_thumb:base.origin+'/media/member.svg',image_medium:base.origin+'/media/member.svg',instagram:'https://www.instagram.com/shy9_29/'},{id:2,name:'이채영',name_en:'Chaeyoung',birth_date:'2000-05-14'}];
 await context.route('**/api/members**',async r=>{
  const u=new URL(r.request().url());if(r.request().method()!=='GET')throw Error('Unexpected write');
  if(s.delay)await new Promise(resolve=>setTimeout(resolve,s.delay));
  if(s.failPath?.(u.pathname.slice(4)))return r.fulfill({status:s.status,contentType:'application/json',body:'{"error":"test"}'});
  const body=u.pathname==='/api/members'?(s.empty?[]:s.members):{photos:s.empty?[]:Object.values(s.album.conceptPhotos).flat().map(p=>({...p,photo_type:p.type,concept_name:p.concept,album_title:s.album.title})),total:8};
  return r.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 return f;
}
module.exports={...base,fixture};
