import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getAlbums } from '@/api';
import { useDocumentTitle } from '@/hooks/common';
import { Loading } from '@/components/common';
import { motion } from 'framer-motion';
import { OutlineTitle, fadeUp, stagger, Reveal } from '@/components/editorial';

/** 발매 전 여부 */
/** 타이틀곡 */
function getTitleTrack(tracks) {
  if (!tracks || tracks.length === 0) return '';
  const t = tracks.find((x) => x.is_title_track);
  return t ? t.title : tracks[0].title;
}

/**
 * PC 앨범 목록 — 에디토리얼 리뉴얼 (design-drafts/A_final_list_pc 시안)
 * 연도 타임라인 + 4열 그리드
 */
const MotionLink = motion(Link);

function PCAlbum() {
  useDocumentTitle('앨범');

  const { data: albums = [], isLoading } = useQuery({
    queryKey: ['albums'],
    queryFn: getAlbums,
  });

  // 연도 그룹
  const { years } = useMemo(() => {
    const groups = new Map();
    albums.forEach((a) => {
      const y = a.release_date?.slice(0, 4) || '기타';
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y).push(a);
    });
    const ys = [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    return { years: ys };
  }, [albums]);

  if (isLoading) return <Loading />;

  return (
    <div className="flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1300px] px-[70px] pb-[90px]">
        {/* 페이지 헤더 */}
        <div className="flex items-end justify-between border-b border-hairline pb-10 pt-16">
          <OutlineTitle solid="DISCO" outline="GRAPHY" className="text-[88px] tracking-[-4px]" />
          <div className="text-right text-[14px] font-semibold leading-loose tracking-k2 text-mute">
            {albums.length} ALBUMS
          </div>
        </div>

        {/* 연도 타임라인 */}
        {years.map(([year, list]) => (
          <div key={year}>
            <Reveal className="flex items-baseline gap-[26px] pb-1.5 pt-10">
              <b className="text-[30px] font-black tracking-[-1px]">{year}</b>
              <div className="flex-1 -translate-y-1.5 border-t border-hairline" />
              <span className="text-[13px] font-bold tracking-k2 text-mute">
                {list.length} RELEASE{list.length > 1 ? 'S' : ''}
              </span>
            </Reveal>
            <Reveal className="grid grid-cols-3 gap-x-8 gap-y-12 pb-6 pt-4" variants={stagger}>
              {list.map((a) => (
                <MotionLink key={a.id} to={`/album/${a.folder_name}`} variants={fadeUp} className="group block">
                  <div className="relative overflow-hidden">
                    {a.cover_medium_url || a.cover_thumb_url || a.cover_original_url ? (
                      <img
                        src={a.cover_medium_url || a.cover_thumb_url || a.cover_original_url}
                        alt={a.title}
                        loading="lazy"
                        className="block aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        style={{ filter: 'saturate(1.02)' }}
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-canvas-deep text-[40px] text-faint">
                        ◉
                      </div>
                    )}
                  </div>
                  <div className="mt-3.5 flex items-baseline justify-between border-t-2 border-ink pt-3">
                    <b className="overflow-hidden text-ellipsis whitespace-nowrap pr-3 text-[22px] font-extrabold tracking-[-0.4px]">
                      {a.title}
                    </b>
                    <span className="whitespace-nowrap text-[14px] font-bold tracking-k1 text-mute">
                      {a.album_type}
                    </span>
                  </div>
                  {getTitleTrack(a.tracks) && (
                    <div className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-bold text-primary">
                      {getTitleTrack(a.tracks)}
                    </div>
                  )}
                  <div className="mt-1 text-[15px] text-mute">
                    {a.release_date?.slice(0, 10).replaceAll('-', '. ')}
                    {a.tracks?.length ? ` · ${a.tracks.length}곡` : ''}
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

export default PCAlbum;
