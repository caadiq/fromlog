import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { getAlbums } from '@/api';
import { useDocumentTitle } from '@/hooks/common';
import { Loading } from '@/components/common';
import { OutlineTitle, fadeUp, stagger, Reveal } from '@/components/editorial';

const MotionLink = motion(Link);

/** 발매 전 여부 */

/** 발매일 전체 표기: 2026. 7. 21. */
function fmtReleaseDate(s) {
  if (!s) return '';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${+y}. ${+m}. ${+d}.`;
}

/** 타이틀곡 */
function getTitleTrack(tracks) {
  if (!tracks || tracks.length === 0) return '';
  const t = tracks.find((x) => x.is_title_track);
  return t ? t.title : tracks[0].title;
}

/**
 * 모바일 앨범 목록 — 에디토리얼 리뉴얼 (A_final_list_mobile 시안)
 * 연도 타임라인 + 2열 그리드
 */
function MobileAlbum() {
  useDocumentTitle('앨범');

  const { data: albums = [], isLoading } = useQuery({
    queryKey: ['albums'],
    queryFn: getAlbums,
  });

  const years = useMemo(() => {
    const groups = new Map();
    albums.forEach((a) => {
      const y = a.release_date?.slice(0, 4) || '기타';
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y).push(a);
    });
    return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [albums]);

  if (isLoading) return <Loading />;

  return (
    <div className="bg-paper text-ink">
      {/* 페이지 헤더 */}
      <motion.div
        className="border-b border-hairline px-[22px] pb-[22px] pt-[30px]"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        <motion.div variants={fadeUp}>
          <OutlineTitle solid="DISCO" outline="GRAPHY" className="text-[42px] tracking-[-2px]" />
        </motion.div>
        <motion.p variants={fadeUp} className="mt-2.5 text-[13px] font-semibold tracking-k15 text-mute">
          {albums.length} ALBUMS
        </motion.p>
      </motion.div>

      {/* 연도 타임라인 */}
      <div className="pb-8">
        {years.map(([year, list]) => (
          <div key={year}>
            <Reveal className="flex items-baseline gap-4 px-[22px] pb-1 pt-[26px]">
              <b className="text-[20px] font-black tracking-[-0.5px]">{year}</b>
              <span className="flex-1 -translate-y-[5px] border-t border-hairline" />
              <span className="text-[12px] font-bold tracking-k15 text-mute">
                {list.length} RELEASE{list.length > 1 ? 'S' : ''}
              </span>
            </Reveal>
            <Reveal className="grid grid-cols-2 gap-x-3.5 gap-y-6 px-[22px] pb-4 pt-3" variants={stagger}>
              {list.map((a) => (
                <MotionLink key={a.id} to={`/album/${a.folder_name}`} variants={fadeUp} className="block">
                  {a.cover_medium_url || a.cover_thumb_url || a.cover_original_url ? (
                    <img
                      src={a.cover_medium_url || a.cover_thumb_url || a.cover_original_url}
                      alt={a.title}
                      loading="lazy"
                      className="block aspect-square w-full object-cover"
                      style={{ filter: 'saturate(1.02)' }}
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-canvas-deep text-[34px] text-faint">
                      ◉
                    </div>
                  )}
                  <div className="mt-2 border-t-2 border-ink pt-2">
                    <b className="block truncate text-[15px] font-extrabold tracking-[-0.3px]">{a.title}</b>
                    {getTitleTrack(a.tracks) && (
                      <span className="block truncate text-[13px] font-bold text-primary">
                        {getTitleTrack(a.tracks)}
                      </span>
                    )}
                    <span className="text-[12px] font-bold tracking-k1 text-mute">
                      {(a.album_type_short || a.album_type || '').toUpperCase()} ·{' '}
                      {fmtReleaseDate(a.release_date)}
                    </span>
                  </div>
                </MotionLink>
              ))}
            </Reveal>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MobileAlbum;
