/**
 * 모바일 응원법 페이지
 *
 * 세로 화면이라 PC의 오른쪽 칼럼을 그대로 못 옮긴다. 영상만 상단에 고정하고
 * 아래는 가사만 흐르게 한다 — '지금' 영역을 같이 고정하면 정작 볼 가사가 좁아진다.
 */
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { getFanchant, getTrack } from '@/api';
import { useDocumentTitle, useYouTubePlayer } from '@/hooks/common';
import FanchantLyrics from '@/components/common/FanchantLyrics';

function MobileFanchant() {
  // 주소는 곡 상세와 같은 결로 둔다: /album/:name/track/:trackTitle/fanchant
  // 예전 /fanchant/:trackId 도 그대로 받는다(관리자 미리보기 등)
  const { trackId: trackIdParam, name: albumName, trackTitle } = useParams();
  const { data: track } = useQuery({
    queryKey: ['track', albumName, trackTitle],
    queryFn: () => getTrack(albumName, trackTitle),
    enabled: !!albumName && !!trackTitle,
    retry: false,
  });
  const trackId = trackIdParam ?? track?.id;
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['fanchant', trackId],
    queryFn: () => getFanchant(trackId),
    enabled: !!trackId,
    placeholderData: keepPreviousData,
    retry: false,
  });

  useDocumentTitle(data ? `${data.trackTitle} 응원법` : '응원법');
  const player = useYouTubePlayer(data?.videoId || '');

  if (isLoading) return <div className="h-full bg-paper" />;

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-ink">
          <div className="w-full text-center">
            <div className="text-[64px] font-black leading-none tracking-[-3px] text-faint-light">404</div>
            <h2 className="mt-5 text-[19px] font-extrabold tracking-[-0.4px]">응원법이 없습니다</h2>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-mute">
              이 곡은 공식 응원법 영상이 없거나
              <br />
              아직 등록되지 않았습니다.
            </p>
            <div className="mt-7 flex justify-center gap-2.5">
              <button onClick={() => navigate(-1)} className="border border-ink px-5 py-2.5 text-[13px] font-extrabold text-ink">← 이전</button>
              <Link to="/album" className="bg-ink px-5 py-2.5 text-[13px] font-extrabold text-white">앨범 목록</Link>
            </div>
          </div>
      </div>
    );
  }

  return (
    // Layout의 mobile-content가 스크롤 컨테이너다 — 여기서 또 컨테이너를 만들면 sticky가 깨진다
    <div className="text-ink">
      {/* 영상 고정 — mobile-content 기준 sticky */}
      <div data-sticky-top className="sticky top-0 z-[5] border-b border-hairline bg-white">
        <div className="aspect-video w-full bg-black">
          <div ref={player.containerRef} className="h-full w-full" />
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
        <div className="px-5 pt-5">
          <div className="text-[10.5px] font-extrabold tracking-k16 text-faint">
            {data.albumTitle} / {data.trackTitle}
          </div>
          <h1 className="mt-1.5 text-[25px] font-black leading-[1.12] tracking-[-1px]">{data.trackTitle} 응원법</h1>
        </div>

        <div className="mx-5 mt-5 border-t-2 border-ink pb-14 pt-3">
          <div className="text-[10.5px] font-black tracking-k16">FANCHANT</div>
          <div className="mt-4">
            <FanchantLyrics
              lines={data.lines}
              colors={data.colors}
              time={player.time}
              mobile
              onSeek={(t) => { player.seek(t); player.play(); }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default MobileFanchant;
