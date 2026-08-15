/**
 * PC 응원법 페이지
 *
 * 왼쪽에 가사 전문, 오른쪽에 영상. 영상을 재생하면 재생 시간에 맞춰
 * 현재 줄과 응원법 구간이 강조된다(FanchantLyrics).
 *
 * 응원법 목록·재생바는 뒀다가 뺐다 — 가사에 이미 다 드러나 볼 일이 없었다.
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
    <div className="min-h-0 flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1280px] px-10 pb-[90px] pt-[44px]">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <div className="text-[11.5px] font-extrabold tracking-k2 text-faint">
            {data.albumTitle} / {data.trackTitle} / 응원법
          </div>
          <h1 className="mt-2.5 text-[44px] font-black leading-none tracking-[-1.6px]">{data.trackTitle} 응원법</h1>
          <p className="mt-3 text-[13.5px] font-semibold text-mute">공식 응원법 영상 · fromis_9</p>
        </motion.div>

        <div className="mt-[34px] grid grid-cols-[1fr_560px] items-start gap-[52px]">
          {/* 가사 */}
          <div className="border-t-2 border-ink pt-3.5">
            <div className="text-[11.5px] font-black tracking-k2">FANCHANT</div>
            <div className="mt-[22px]">
              <FanchantLyrics lines={data.lines} colors={data.colors} time={player.time} />
            </div>
          </div>

          {/* 영상 */}
          {/* 헤더가 sticky top-0으로 74px을 차지한다 — 그만큼 내려야 영상 윗부분이 안 잘린다 */}
          <div className="sticky top-[98px]">
            <div className="aspect-video w-full border border-hairline bg-black">
              <div ref={player.containerRef} className="h-full w-full" />
            </div>
            <div className="mt-[9px] text-[11px] font-black tracking-k18 text-faint">FANCHANT — YOUTUBE</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PCFanchant;
