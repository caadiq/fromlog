import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useMembers, useAlbums, useUpcomingSchedules, useDocumentTitle } from '@/hooks';
import { OutlineTitle, SectionHeader, CategoryLabel, fadeUp, stagger, Reveal } from '@/components/editorial';
import { FEATURED_CATEGORY_IDS, WEEKDAYS } from '@/constants';
import { isUpcoming, calcDday } from '@/utils';

const MotionLink = motion(Link);

/** 히어로 슬라이드 데이터 */
function useHeroSlides() {
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

/** 랜덤 최대 10장 뽑아 셔플 */
function pickRandom(photos, count = 10) {
  const arr = [...photos];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length));
}

/** 히어로 우측 — 컨셉 포토 크로스페이드 슬라이드 */
function HeroSlides({ hero, members }) {
  const slides = useMemo(() => (hero?.photos?.length ? pickRandom(hero.photos) : []), [hero]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 5500);
    return () => clearInterval(t);
  }, [slides]);


  // 폴백: 사진이 하나도 없으면 멤버 사진
  const fallback = members?.find((m) => !m.is_former)?.image_medium;

  return (
    <motion.div
      className="relative aspect-[4/5] h-full overflow-hidden bg-canvas-deep"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
    >
      {slides.length > 0 ? (
        slides.map((url, i) => (
          <img
            key={url}
            src={url}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              i === idx ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ filter: 'saturate(1.02)' }}
          />
        ))
      ) : (
        fallback && (
          <img src={fallback} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )
      )}
      {slides.length > 1 && (
        <span
          className="absolute bottom-4 right-4 bg-ink px-3 py-[7px] text-[13px] font-bold tracking-k2 text-white"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {String(idx + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
        </span>
      )}
    </motion.div>
  );
}

/* ── 로딩 스켈레톤 ──
 * 데이터가 도착하기 전 각 섹션의 높이를 실제와 비슷하게 미리 차지해,
 * 로드 시 콘텐츠가 갑자기 삽입되며 푸터가 밀리는 레이아웃 시프트(깜빡임)와
 * 리플로우 렉을 방지한다. 실제 카드와 같은 컨테이너 규격을 그대로 쓴다. */
const SkelBlock = ({ className = '' }) => (
  <div className={`animate-pulse rounded-[2px] bg-canvas ${className}`} />
);

function MembersSkeleton() {
  return (
    <div className="flex border-t-2 border-ink">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 px-[22px] pb-[30px] pt-[26px] ${i < 4 ? 'border-r border-hairline' : ''}`}
        >
          <SkelBlock className="h-[14px] w-6" />
          <SkelBlock className="mt-4 aspect-[0.85] w-full" />
          <SkelBlock className="mt-4 h-[19px] w-2/3" />
          <SkelBlock className="mt-2 h-[13px] w-1/2" />
        </div>
      ))}
    </div>
  );
}

function AlbumsSkeleton() {
  return (
    <div className="grid grid-cols-[1.25fr_1fr_1fr] gap-[26px]">
      <SkelBlock className="aspect-square w-full" />
      {[0, 1].map((i) => (
        <div key={i}>
          <SkelBlock className="aspect-square w-full" />
          <SkelBlock className="mt-3 h-[16.5px] w-2/3" />
          <SkelBlock className="mt-2 h-[13px] w-1/2" />
        </div>
      ))}
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="border-t-2 border-ink">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[130px_1fr_150px_110px] items-center border-b border-hairline px-1 py-5"
        >
          <SkelBlock className="h-[20px] w-24" />
          <SkelBlock className="h-[17px] w-3/4" />
          <SkelBlock className="h-[15px] w-16" />
          <SkelBlock className="ml-auto h-[15px] w-14" />
        </div>
      ))}
    </div>
  );
}

/**
 * PC 홈 — 에디토리얼 리뉴얼 (design-drafts/C_final_pc 시안)
 */
function Home() {
  useDocumentTitle();

  const { data: members = [], isLoading: membersLoading } = useMembers();
  const { data: allAlbums = [], isLoading: albumsLoading } = useAlbums();
  const { data: upcomingSchedules = [], isLoading: schedulesLoading } = useUpcomingSchedules(3);
  const { data: hero } = useHeroSlides();

  const activeMembers = useMemo(() => members.filter((m) => !m.is_former), [members]);
  const albums = allAlbums.slice(0, 3);
  const datedSchedules = upcomingSchedules.filter((s) => s.datePrecision !== 'month');
  const undatedSchedules = upcomingSchedules.filter((s) => s.datePrecision === 'month');

  // 통계 스트립의 최신 앨범 셀 — 발매 전 D-N → 당일 D-DAY → 발매 후 OUT NOW
  const stripAlbum = useMemo(() => {
    const diff = calcDday(hero?.album?.releaseDate);
    if (diff === null) return null;
    const title = (hero.album.title || '').toUpperCase();
    const type = hero.album.albumType || '앨범';
    if (diff > 0) return { num: `D-${diff}`, label: `${type} · ${title}` };
    if (diff === 0) return { num: 'D-DAY', label: `${type} · ${title}` };
    return { num: 'OUT NOW', label: `${type} · ${title}` };
  }, [hero]);

  return (
    <div className="flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1300px] px-[70px]">
      {/* 히어로 — 잡지 스프레드 (본문과 동일 폭) */}
      <section className="grid grid-cols-[1fr_auto] border-b border-hairline">
        <motion.div
          className="relative border-r border-hairline py-[80px] pr-[60px]"
          initial="hidden"
          animate="show"
          variants={stagger}
        >
          <motion.span variants={fadeUp} className="block text-[13.5px] font-bold tracking-k4 text-primary">
            SINCE 2018. 01. 24
          </motion.span>
          <motion.div variants={fadeUp}>
            <OutlineTitle solid="fromis" outline="_9" className="mt-[26px] text-[118px] tracking-[-5px]" />
          </motion.div>
          <motion.p variants={fadeUp} className="mt-7 max-w-[400px] text-[16px] leading-[1.8] text-esub">
            "인사드리겠습니다. 둘, 셋!
            <br />
            안녕하세요, 프로미스나인입니다!"
          </motion.p>
        </motion.div>
        <HeroSlides hero={hero} members={members} />
      </section>

      {/* 통계 스트립 */}
      <motion.section
        className="flex border-b border-hairline"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        {[
          { num: String(activeMembers.length || 5), label: 'MEMBERS' },
          { num: String(allAlbums.length || '—'), label: 'ALBUMS' },
          { num: '2018. 01. 24', label: 'DEBUT' },
          ...(stripAlbum ? [{ num: stripAlbum.num, label: stripAlbum.label }] : []),
        ].map((s, i, arr) => (
          <motion.div
            key={s.label}
            variants={fadeUp}
            className={`flex-1 py-6 text-center ${i < arr.length - 1 ? 'border-r border-hairline' : ''}`}
          >
            <b className="block text-[30px] font-extrabold tracking-[-1px]">{s.num}</b>
            <span className="text-[13px] font-bold tracking-k25 text-mute">{s.label}</span>
          </motion.div>
        ))}
      </motion.section>

      <div className="pb-[100px]">
        {/* 멤버 */}
        <Reveal className="flex items-baseline justify-between pb-[26px] pt-[60px]">
          <SectionHeader label="MEMBERS" />
          <Link to="/members" className="text-[13.5px] font-bold tracking-[0.5px] text-primary">
            전체보기 →
          </Link>
        </Reveal>
        {membersLoading && activeMembers.length === 0 ? (
          <MembersSkeleton />
        ) : (
        <Reveal className="flex border-t-2 border-ink" variants={stagger}>
          {activeMembers.map((m, i) => (
            <MotionLink
              key={m.id}
              to="/members"
              variants={fadeUp}
              className={`flex-1 px-[22px] pb-[30px] pt-[26px] transition-colors hover:bg-canvas ${
                i < activeMembers.length - 1 ? 'border-r border-hairline' : ''
              }`}
            >
              <span className="text-[13.5px] font-bold text-faint">{String(i + 1).padStart(2, '0')}</span>
              <img
                src={m.image_thumb || m.image_medium}
                alt={m.name}
                className="mt-4 block aspect-[0.85] w-full object-cover"
                style={{ filter: 'saturate(1.02)' }}
              />
              <b className="mt-4 block text-[19px] font-extrabold tracking-[-0.4px]">{m.name}</b>
              <span className="text-[12.5px] font-semibold tracking-k2 text-mute">
                {(m.name_en || '').toUpperCase()}
              </span>
            </MotionLink>
          ))}
        </Reveal>
        )}

        {/* 앨범 */}
        <Reveal className="flex items-baseline justify-between pb-[26px] pt-[60px]">
          <SectionHeader label="DISCOGRAPHY" />
          <Link to="/album" className="text-[13.5px] font-bold tracking-[0.5px] text-primary">
            전체보기 →
          </Link>
        </Reveal>
        {albumsLoading && albums.length === 0 ? (
          <AlbumsSkeleton />
        ) : (
        <Reveal className="grid grid-cols-[1.25fr_1fr_1fr] gap-[26px]" variants={stagger}>
          {albums.map((a, i) =>
            i === 0 ? (
              <MotionLink key={a.id} to={`/album/${a.folder_name}`} variants={fadeUp} className="relative block">
                {a.cover_medium_url || a.cover_original_url ? (
                  <img
                    src={a.cover_medium_url || a.cover_original_url}
                    alt={a.title}
                    className="block aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-canvas-deep text-[44px] text-faint">
                    ◉
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6 text-white">
                  <b className="block text-[28px] font-extrabold tracking-[-0.6px]">{a.title}</b>
                  <span className="text-[13.5px] tracking-k15 opacity-75">
                    {a.album_type} · {a.release_date?.slice(0, 10).replaceAll('-', '. ')}
                    {isUpcoming(a.release_date) ? ' 발매 예정' : ''}
                  </span>
                </div>
              </MotionLink>
            ) : (
              <MotionLink key={a.id} to={`/album/${a.folder_name}`} variants={fadeUp} className="block">
                {a.cover_medium_url || a.cover_original_url ? (
                  <img
                    src={a.cover_medium_url || a.cover_original_url}
                    alt={a.title}
                    className="block aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-canvas-deep text-[36px] text-faint">
                    ◉
                  </div>
                )}
                <b className="mt-3 block text-[16.5px] font-extrabold tracking-[-0.3px]">{a.title}</b>
                <span className="text-[13px] font-semibold tracking-k1 text-mute">
                  {a.album_type_short || a.album_type} · {a.release_date?.slice(0, 4)}
                  {isUpcoming(a.release_date) ? ' · 발매 예정' : ''}
                </span>
              </MotionLink>
            )
          )}
        </Reveal>
        )}

        {/* 일정 */}
        <Reveal className="flex items-baseline justify-between pb-[26px] pt-[60px]">
          <SectionHeader label="SCHEDULE" />
          <Link to="/schedule" className="text-[13.5px] font-bold tracking-[0.5px] text-primary">
            전체보기 →
          </Link>
        </Reveal>
        {schedulesLoading && upcomingSchedules.length === 0 ? (
          <ScheduleSkeleton />
        ) : (
        <Reveal className="border-t-2 border-ink">
          {datedSchedules.map((s) => {
            const d = new Date(s.date);
            // 컴백(4)·앨범(17) — 우선순위 일정 강조 (백엔드 상단 고정과 동일 기준)
            const featured = FEATURED_CATEGORY_IDS.includes(s.category?.id);
            const dday = featured ? calcDday(s.date) : null;
            return (
              <Link
                key={s.id}
                to={s.albumFolder ? `/album/${s.albumFolder}` : `/schedule/${s.id}`}
                className={`grid grid-cols-[130px_1fr_150px_110px] items-center border-b border-hairline px-1 py-5 transition-colors ${
                  featured ? 'bg-green-soft/40 hover:bg-green-soft/70' : 'hover:bg-canvas'
                }`}
              >
                <span>
                  {d.getFullYear() !== new Date().getFullYear() && (
                    <span className="block text-[13px] font-bold text-mute">{d.getFullYear()}</span>
                  )}
                  <b className="block text-[20px] font-extrabold leading-tight tracking-[-0.5px]">
                    {d.getMonth() + 1}. {d.getDate()}. {WEEKDAYS[d.getDay()]}
                  </b>
                  {s.time && (
                    <span
                      className="text-[14px] font-bold text-mute"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {s.time.slice(0, 5)}
                    </span>
                  )}
                </span>
                <span className="flex min-w-0 items-center gap-2.5 pr-[30px]">
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[17px] font-semibold tracking-[-0.2px]">
                    {s.title}
                  </span>
                  {dday !== null && dday >= 0 && (
                    <b className="shrink-0 bg-primary px-2 py-[3px] text-[12px] font-extrabold tracking-k1 text-white">
                      {dday === 0 ? 'D-DAY' : `D-${dday}`}
                    </b>
                  )}
                </span>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] text-mute">
                  {s.source?.name || ''}
                </span>
                <span className="text-right">
                  <CategoryLabel name={s.category?.name} color={s.category?.color} />
                </span>
              </Link>
            );
          })}
          {undatedSchedules.length > 0 && (
            <>
              <div className="flex items-center gap-3 pt-6">
                <b className="text-[13px] font-extrabold tracking-k25 text-mute">
                  날짜 미정 — {new Date(undatedSchedules[0].date).getMonth() + 1}월 중
                </b>
                <div className="flex-1 border-t border-dashed border-faint-light" />
              </div>
              {undatedSchedules.map((s) => (
                <Link
                  key={s.id}
                  to={s.albumFolder ? `/album/${s.albumFolder}` : `/schedule/${s.id}`}
                  className="grid grid-cols-[130px_1fr_150px_110px] items-baseline border-b border-dashed border-faint-light px-1 py-5 transition-colors hover:bg-canvas"
                >
                  <span className="text-[16px] font-extrabold text-faint">--. --.</span>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap pr-[30px] text-[16px] font-semibold">
                    {s.title}
                  </span>
                  <span className="text-[14.5px] text-mute">{new Date(s.date).getMonth() + 1}월 중</span>
                  <span className="text-right">
                    <CategoryLabel name={s.category?.name} color={s.category?.color} />
                  </span>
                </Link>
              ))}
            </>
          )}
        </Reveal>
        )}
      </div>
      </div>
    </div>
  );
}

export default Home;
