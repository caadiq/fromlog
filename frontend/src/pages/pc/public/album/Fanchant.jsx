/**
 * PC 응원법 페이지
 *
 * 왼쪽에 가사 전문(자체 스크롤), 오른쪽에 영상. 영상을 재생하면 재생 시간에 맞춰
 * 현재 줄과 응원법 구간이 강조된다(FanchantLyrics).
 *
 * 응원법 목록·재생바는 뒀다가 뺐다 — 가사에 이미 다 드러나 볼 일이 없었다.
 * 영상은 sticky 대신 가사만 스크롤하는 구조로 뒀다 — sticky는 헤더 높이에 기대야 해서 깨지기 쉽다.
 */
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { getFanchant } from '@/api';
import { useDocumentTitle, useYouTubePlayer } from '@/hooks/common';
import FanchantLyrics from '@/components/common/FanchantLyrics';

function PCFanchant() {
  const { trackId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['fanchant', trackId],
    queryFn: () => getFanchant(trackId),
    placeholderData: keepPreviousData,
    retry: false,
  });

  useDocumentTitle(data ? `${data.trackTitle} 응원법` : '응원법');
  const player = useYouTubePlayer(data?.videoId || '');

  if (isLoading) return <div className="min-h-0 flex-1 bg-paper" />;

  if (error || !data) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-paper text-ink">
        <div className="px-6 text-center">
          <div className="text-[120px] font-black leading-none tracking-[-6px] text-faint-light">404</div>
          <h2 className="mt-6 text-[28px] font-extrabold tracking-[-0.6px]">응원법이 없습니다</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-mute">
            이 곡은 공식 응원법 영상이 없거나 아직 등록되지 않았습니다.
          </p>
          <div className="mt-9 flex justify-center gap-3">
            <button onClick={() => navigate(-1)} className="border border-ink px-7 py-3 text-[13.5px] font-extrabold tracking-k15 text-ink transition-colors hover:bg-ink hover:text-white">← 이전 페이지</button>
            <Link to="/album" className="bg-ink px-7 py-3 text-[13.5px] font-extrabold tracking-k15 text-white transition-colors hover:bg-ebody">앨범 목록</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    // 페이지는 화면을 넘지 않고 가사만 자체 스크롤한다 — 영상이 확실히 제자리에 남는다
    // 높이를 화면에 맞춰 고정해야 가사만 내부 스크롤된다.
    // 부모(main)가 min-h-dvh라 그냥 flex-1로는 콘텐츠만큼 늘어나 페이지가 스크롤된다.
    // 74px = 헤더 높이 (일정 페이지도 같은 값을 쓴다)
    <div className="flex flex-col overflow-hidden bg-paper text-ink" style={{ height: 'calc(100dvh - 74px)' }}>
      <div className="mx-auto flex w-full min-h-0 max-w-[1280px] flex-1 flex-col px-10 pb-8 pt-[38px]">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <div className="text-[11.5px] font-extrabold tracking-k2 text-faint">
            {data.albumTitle} / {data.trackTitle} / 응원법
          </div>
          <h1 className="mt-2.5 text-[40px] font-black leading-none tracking-[-1.5px]">{data.trackTitle} 응원법</h1>
        </motion.div>

        <div className="mt-7 grid min-h-0 flex-1 grid-cols-[1fr_620px] gap-[52px]">
          {/* 가사 — 여기만 스크롤된다 */}
          <div className="flex min-h-0 flex-col border-t-2 border-ink pt-3.5">
            <div className="shrink-0 text-[11.5px] font-black tracking-k2">FANCHANT</div>
            <div className="mt-[18px] min-h-0 flex-1 overflow-y-auto pb-10 pr-3">
              <FanchantLyrics
                lines={data.lines}
                colors={data.colors}
                time={player.time}
                onSeek={(t) => { player.seek(t); player.play(); }}
              />
            </div>
          </div>

          {/* 영상 */}
          <div className="self-start">
            <div className="aspect-video w-full border border-hairline bg-black">
              <div ref={player.containerRef} className="h-full w-full" />
            </div>
            <div className="mt-[9px] text-[11px] font-black tracking-k18 text-faint">FANCHANT — YOUTUBE</div>
            <p className="mt-4 text-[12.5px] leading-relaxed text-faint">
              가사를 누르면 그 지점부터 다시 들을 수 있어요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PCFanchant;
