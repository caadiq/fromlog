import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useMembers, useAlbums, useUpcomingSchedules, useDocumentTitle } from '@/hooks';
import { OutlineTitle, CategoryLabel, fadeUp, stagger, Reveal } from '@/components/editorial';
import { FEATURED_CATEGORY_IDS, WEEKDAYS } from '@/constants';
import { isUpcoming, calcDday } from '@/utils';

const MotionLink = motion(Link);

/** 히어로/스트립용 최신 앨범 데이터 (PC와 공용 API) */
function useHeroAlbum() {
  return useQuery({
    queryKey: ['albumHero'],
    queryFn: async () => {
      const res = await fetch('/api/albums/hero');
      if (!res.ok) throw new Error('hero fetch failed');
      return res.json();
    },
    staleTime: 1000 * 60 * 30,
  });
}

/** 섹션 헤더: 라벨 + 전체보기 */
function SecHeader({ label, to }) {
  return (
    <Reveal className="flex items-baseline justify-between px-[22px] pb-3.5 pt-[26px]">
      <b className="text-[13.5px] font-extrabold tracking-k25 text-ink">{label}</b>
      <Link to={to} className="text-[13px] font-bold tracking-[0.5px] text-primary">
        전체보기 →
      </Link>
    </Reveal>
  );
}

/**
 * 모바일 홈 — 에디토리얼 리뉴얼 (design-drafts/C_final_mobile 시안)
 */
function MobileHome() {
  useDocumentTitle();

  const { data: allMembers = [] } = useMembers();
  const members = allMembers.filter((m) => !m.is_former);

  const { data: allAlbums = [] } = useAlbums();
  const albums = allAlbums.slice(0, 3);

  const { data: schedules = [] } = useUpcomingSchedules(3);
  const datedSchedules = schedules.filter((s) => s.datePrecision !== 'month');
  const undatedSchedules = schedules.filter((s) => s.datePrecision === 'month');

  const { data: hero } = useHeroAlbum();

  // 스트립 최신 앨범 셀 — 발매 전 D-N → 당일 D-DAY → 발매 후 OUT NOW
  // 모바일은 칸이 좁아 앨범명 대신 타입(정규 2집 등)으로 표기
  const stripAlbum = useMemo(() => {
    const diff = calcDday(hero?.album?.releaseDate);
    if (diff === null) return null;
    const label = hero.album.albumType || '앨범';
    if (diff > 0) return { num: `D-${diff}`, label };
    if (diff === 0) return { num: 'D-DAY', label };
    return { num: 'OUT NOW', label };
  }, [hero]);

  return (
    <div className="bg-paper text-ink">
      {/* 히어로 */}
      <motion.section
        className="relative border-b border-hairline px-[22px] pb-[30px] pt-[34px]"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        <motion.span variants={fadeUp} className="block text-[13px] font-bold tracking-k3 text-primary">
          SINCE 2018. 01. 24
        </motion.span>
        <motion.div variants={fadeUp}>
          <OutlineTitle solid="fromis" outline="_9" className="mt-3.5 text-[62px] tracking-[-3px]" />
        </motion.div>
        <motion.p variants={fadeUp} className="mt-4 max-w-[280px] text-[14.5px] leading-[1.7] text-esub">
          "인사드리겠습니다. 둘, 셋!
          <br />
          안녕하세요, 프로미스나인입니다!"
        </motion.p>
      </motion.section>

      {/* 통계 스트립 */}
      <motion.section
        className="flex border-b border-hairline"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        {[
          { num: String(members.length || 5), label: 'MEMBERS' },
          { num: String(allAlbums.length || '—'), label: 'ALBUMS' },
          ...(stripAlbum ? [stripAlbum] : []),
        ].map((s, i, arr) => (
          <motion.div
            key={s.label}
            variants={fadeUp}
            className={`flex-1 py-3.5 text-center ${i < arr.length - 1 ? 'border-r border-hairline' : ''}`}
          >
            <b className="block text-[19px] font-extrabold">{s.num}</b>
            <span className="text-[12px] font-semibold tracking-k15 text-mute">{s.label}</span>
          </motion.div>
        ))}
      </motion.section>

      {/* MEMBERS */}
      <SecHeader label="MEMBERS" to="/members" />
      <Reveal className="mx-[22px] border-t border-hairline" variants={stagger}>
        {members.map((m, i) => (
          <MotionLink
            key={m.id}
            to="/members"
            variants={fadeUp}
            className="flex items-center gap-4 border-b border-hairline py-[13px]"
          >
            <span className="w-[22px] text-[13px] font-bold text-faint">
              {String(i + 1).padStart(2, '0')}
            </span>
            <img
              src={m.image_thumb || m.image_medium}
              alt={m.name}
              className="h-[46px] w-[46px] rounded-full object-cover"
            />
            <span className="min-w-0">
              <b className="block text-[16px] font-extrabold tracking-[-0.3px]">{m.name}</b>
              <span className="text-[12.5px] font-semibold tracking-k15 text-mute">
                {(m.name_en || '').toUpperCase()}
              </span>
            </span>
            <span className="ml-auto text-faint">→</span>
          </MotionLink>
        ))}
      </Reveal>

      {/* DISCOGRAPHY */}
      <SecHeader label="DISCOGRAPHY" to="/album" />
      <div className="px-[22px]">
        {albums[0] && (
          <Reveal>
            <Link to={`/album/${albums[0].folder_name}`} className="relative block overflow-hidden">
              {albums[0].cover_medium_url || albums[0].cover_original_url ? (
                <img
                  src={albums[0].cover_medium_url || albums[0].cover_original_url}
                  alt={albums[0].title}
                  className="block aspect-square w-full object-cover"
                  style={{ filter: 'saturate(1.05)' }}
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-canvas-deep text-[40px] text-faint">
                  ◉
                </div>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-[18px] text-white">
                <b className="block text-[22px] font-extrabold tracking-[-0.5px]">{albums[0].title}</b>
                <span className="text-[13px] tracking-k1 opacity-75">
                  {albums[0].album_type} · {albums[0].release_date?.slice(0, 10).replaceAll('-', '. ')}
                  {isUpcoming(albums[0].release_date) ? ' 발매 예정' : ''}
                </span>
              </span>
            </Link>
          </Reveal>
        )}
        {albums.length > 1 && (
          <Reveal className="mt-3.5 flex gap-3.5" variants={stagger}>
            {albums.slice(1, 3).map((a) => (
              <MotionLink key={a.id} to={`/album/${a.folder_name}`} variants={fadeUp} className="min-w-0 flex-1">
                {a.cover_medium_url || a.cover_original_url ? (
                  <img
                    src={a.cover_medium_url || a.cover_original_url}
                    alt={a.title}
                    className="block aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-canvas-deep text-[28px] text-faint">
                    ◉
                  </div>
                )}
                <b className="mt-2 block truncate text-[14.5px] font-bold tracking-[-0.2px]">{a.title}</b>
                <span className="text-[12.5px] tracking-[0.5px] text-mute">
                  {(a.album_type_short || a.album_type || '').toUpperCase()} · {a.release_date?.slice(0, 4)}
                  {isUpcoming(a.release_date) ? ' · 발매 예정' : ''}
                </span>
              </MotionLink>
            ))}
          </Reveal>
        )}
      </div>

      {/* SCHEDULE */}
      <SecHeader label="SCHEDULE" to="/schedule" />
      <Reveal className="mx-[22px] mb-[30px] border-t-2 border-ink">
        {datedSchedules.map((s) => {
          const d = new Date(s.date);
          // 컴백(4)·앨범(17) — 우선순위 일정 강조 (PC 홈과 동일 기준)
          const featured = FEATURED_CATEGORY_IDS.includes(s.category?.id);
          const dday = featured ? calcDday(s.date) : null;
          return (
            <Link
              key={s.id}
              to={s.albumFolder ? `/album/${s.albumFolder}` : `/schedule/${s.id}`}
              className={`flex items-center gap-4 border-b border-hairline px-0.5 py-[15px] ${
                featured ? 'bg-green-soft/40' : ''
              }`}
            >
              <span className="w-[66px] shrink-0">
                {d.getFullYear() !== new Date().getFullYear() && (
                  <span className="block text-[11.5px] font-bold text-mute">{d.getFullYear()}</span>
                )}
                <b className="block whitespace-nowrap text-[16px] font-extrabold tracking-[-0.5px]">
                  {d.getMonth() + 1}.{d.getDate()} {WEEKDAYS[d.getDay()]}
                </b>
                {s.time && (
                  <span className="mt-0.5 block text-[13px] font-bold text-mute">{s.time.slice(0, 5)}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <b className="truncate text-[14.5px] font-semibold tracking-[-0.2px]">{s.title}</b>
                  {dday !== null && dday >= 0 && (
                    <b className="shrink-0 bg-primary px-1.5 py-[2px] text-[12px] font-extrabold tracking-k1 text-white">
                      {dday === 0 ? 'D-DAY' : `D-${dday}`}
                    </b>
                  )}
                </span>
                {s.source?.name && <span className="block text-[13px] text-mute">{s.source.name}</span>}
              </span>
              <CategoryLabel name={s.category?.name} color={s.category?.color} mobile />
            </Link>
          );
        })}
        {undatedSchedules.map((s) => (
          <Link
            key={s.id}
            to={s.albumFolder ? `/album/${s.albumFolder}` : `/schedule/${s.id}`}
            className="flex items-baseline gap-4 border-b border-dashed border-faint-light px-0.5 py-[15px]"
          >
            <span className="w-[52px] shrink-0 text-[14.5px] font-extrabold text-faint">--.--</span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[14.5px] font-semibold tracking-[-0.2px]">{s.title}</b>
              <span className="text-[13px] text-mute">{new Date(s.date).getMonth() + 1}월 중</span>
            </span>
            <CategoryLabel name={s.category?.name} color={s.category?.color} mobile />
          </Link>
        ))}
      </Reveal>
    </div>
  );
}

export default MobileHome;
