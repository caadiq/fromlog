const base=require('../pc-public-media/base.cjs');
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750"><rect width="600" height="750" fill="#75927e"/><text x="60" y="120" font-size="40">PHOTO</text></svg>';
async function fixture(browser,viewport={width:1440,height:900},reducedMotion='no-preference') {
 const f=await base.fixture(browser,viewport,reducedMotion),{context,state:s}=f;
 s.album={id:118,folder_name:'audit',title:'검증 앨범',album_type:'미니 1집',release_date:'2026-09-01',description:'앨범 소개입니다.\n'.repeat(80),cover_medium_url:base.origin+'/media/cover.svg',cover_original_url:base.origin+'/media/cover.svg',tracks:[{id:196,title:'검증 곡',track_number:1,is_title_track:1,duration:'3:20',video_url:'https://www.youtube.com/watch?v=testvid0000',lyrics:'가사'},{id:197,title:'두 번째 곡',track_number:2,duration:'2:30'}],conceptPhotos:{Green:Array.from({length:8},(_,i)=>({id:i+1,medium_url:i===7?null:base.origin+`/media/photo-${i}.svg`,thumb_url:base.origin+`/media/photo-${i}.svg`,original_url:base.origin+`/media/photo-${i}.svg`,width:600,height:750,type:i%2?'solo':'group',members:'송하영, 이채영',concept:'Green'}))},teasers:[{media_type:'image',thumb_url:base.origin+'/media/teaser.svg',original_url:base.origin+'/media/teaser.svg'},{media_type:'video',thumb_url:base.origin+'/media/teaser.svg',video_url:base.origin+'/media/teaser.mp4'}]};
 s.track={...s.album.tracks[0],album:s.album,otherTracks:s.album.tracks,lyrics:Array.from({length:40},(_,i)=>`검증 가사 ${i}`).join('\n'),lyricist:'작사가',composer:'작곡가'};
 s.fanchant={trackId:196,trackTitle:'검증 곡',albumTitle:'검증 앨범',videoId:'testvid0000',colors:{},lines:Array.from({length:80},(_,i)=>({t:i*2,parts:[{text:`검증 응원 ${i}`,t:i*2}]})),video:{title:'검증 응원 영상',channelName:'검증 채널',publishedAt:'2026-09-01'}};
 s.failPath=null;s.status=503;s.mediaFailure=false;s.delay=0;
 await context.route('**/media/**',r=>r.fulfill(s.mediaFailure||r.request().url().endsWith('.mp4')?{status:404,body:'missing'}:{contentType:'image/svg+xml',body:svg}));
 await context.route('**/api/**',async r=>{
  const u=new URL(r.request().url()),p=u.pathname.slice(4);
  if(!/^\/(albums|fanchant)/.test(p)) return r.fallback();
  if(r.request().method()!=='GET')throw Error('Unexpected write');
  s.requests.push(p);
  if(s.delay)await new Promise(resolve=>setTimeout(resolve,s.delay));
  if(s.failPath?.(p))return r.fulfill({status:s.status,contentType:'application/json',body:JSON.stringify({error:'검증 오류'})});
  let body=p==='/albums'?[s.album]:p.includes('/track/')?s.track:p.startsWith('/albums/by-name/')?s.album:p==='/fanchant'?{items:[{trackId:196}]}:p.startsWith('/fanchant/')?s.fanchant:{};
  if(s.empty)body=p==='/albums'?[]:null;
  return r.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 return f;
}
module.exports={...base,fixture};
