/**
 * PC 응원법 페이지
 *
 * 왼쪽에 가사 전문, 오른쪽에 영상과 응원법 목록. 영상을 재생하면 재생 시간에 맞춰
 * 현재 줄과 응원법 구간이 강조된다(FanchantLyrics).
 */
import { useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { getFanchant } from '@/api';
import { useDocumentTitle, useYouTubePlayer } from '@/hooks/common';
import FanchantLyrics from '@/components/common/FanchantLyrics';
import { fmtTime } from '@/utils/fanchant';

/** 목록에 세울 응원법 구간만 추린다 */
function useCueList(lines) {
  return useMemo(() => {
    const out = [];
    lines?.forEach((line) => {
      if (line.gap) return;
      line.parts?.forEach((p) => {
        if (p.type && p.t != null) out.push({ t: p.t, text: p.text, type: p.type });
      });
    });
    return out.sort((a, b) => a.t - b.t);
  }, [lines]);
}

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
  const cues = useCueList(data?.lines);

  const current = useMemo(() => {
    let idx = -1;
    cues.forEach((c, i) => { if (player.time >= c.t) idx = i; });
    return idx;
  }, [cues, player.time]);

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

  const pct = player.duration ? Math.min(100, (player.time / player.duration) * 100) : 0;

  return (
    <div className="min-h-0 flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1160px] px-10 pb-[90px] pt-[44px]">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <div className="text-[11.5px] font-extrabold tracking-k2 text-faint">
            {data.albumTitle} / {data.trackTitle} / 응원법
          </div>
          <h1 className="mt-2.5 text-[44px] font-black leading-none tracking-[-1.6px]">{data.trackTitle} 응원법</h1>
          <p className="mt-3 text-[13.5px] font-semibold text-mute">공식 응원법 영상 · fromis_9</p>
        </motion.div>

        <div className="mt-[34px] grid grid-cols-[1fr_400px] items-start gap-[52px]">
          {/* 가사 */}
          <div className="border-t-2 border-ink pt-3.5">
            <div className="text-[11.5px] font-black tracking-k2">FANCHANT</div>
            <div className="mt-[22px]">
              <FanchantLyrics lines={data.lines} colors={data.colors} time={player.time} />
            </div>
          </div>

          {/* 영상 + 목록 */}
          <div className="sticky top-6">
            <div className="aspect-video w-full border border-hairline bg-black">
              <div ref={player.containerRef} className="h-full w-full" />
            </div>
            <div className="h-[3px] bg-canvas">
              <div className="h-full transition-[width] duration-150" style={{ width: `${pct}%`, background: data.colors.call }} />
            </div>
            <div className="mt-[7px] flex justify-between text-[11.5px] font-extrabold tabular-nums text-faint">
              <span>{fmtTime(player.time)}</span>
              <span>{fmtTime(player.duration)}</span>
            </div>

            {cues.length > 0 && (
              <div className="mt-5 border-t border-hairline">
                <div className="pt-3.5 text-[10.5px] font-black tracking-k18 text-faint">응원법 목록</div>
                <div className="mt-3 max-h-[520px] overflow-auto">
                  {cues.map((c, i) => (
                    <button
                      key={`${c.t}-${i}`}
                      onClick={() => { player.seek(c.t); player.play(); }}
                      className={`flex w-full items-baseline gap-3 border-b border-hairline py-2 text-left transition-opacity ${
                        i < current ? 'opacity-35' : ''
                      } ${i === current ? '-mx-2.5 bg-black/[0.04] px-2.5 py-3' : ''}`}
                    >
                      <span className="w-[42px] shrink-0 text-[11.5px] font-bold tabular-nums text-faint">
                        {fmtTime(c.t).replace(/\.\d$/, '')}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate font-extrabold ${i === current ? 'text-[20px]' : 'text-[14.5px]'}`}
                        style={{ color: data.colors[c.type] }}
                      >
                        {c.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PCFanchant;
