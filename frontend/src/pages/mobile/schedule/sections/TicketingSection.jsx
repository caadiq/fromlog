import { Link } from 'react-router-dom';
import { ChevronRight, ExternalLink, Ticket } from 'lucide-react';
import { WEEKDAYS } from '@/constants';
import { decodeHtmlEntities } from './utils';

// ── 티켓팅 타임라인 헬퍼 ──
const TICKETING_STAGE_LABEL = { presale: '팬클럽 선예매', general: '일반예매' };
const ticketingToDate = (date, time) => (date ? new Date(`${date}T${time ? time.slice(0, 5) : '00:00'}:00`) : null);
const ticketingFmt = (date, time) => {
  const d = ticketingToDate(date, time);
  if (!d) return '';
  const base = `${d.getMonth() + 1}. ${d.getDate()}. (${WEEKDAYS[d.getDay()]})`;
  return time ? `${base} ${time.slice(0, 5)}` : base;
};
const ticketingStageStatus = (date, time) => {
  const d = ticketingToDate(date, time);
  if (!d) return null;
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return { label: 'D-DAY', kind: 'now' };
  if (d < now) return { label: '종료', kind: 'done' };
  const days = Math.ceil((ticketingToDate(date, null) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  return { label: `D-${days}`, kind: 'todo' };
};
const ticketingAuthStatus = (start, end) => {
  const now = new Date();
  const s = start ? new Date(start.replace(' ', 'T')) : null;
  const e = end ? new Date(end.replace(' ', 'T')) : null;
  if (e && now > e) return { label: '종료', kind: 'done' };
  if (s && now < s) return { label: '예정', kind: 'todo' };
  return { label: '진행 중', kind: 'now' };
};
const TICKETING_ST_CLASS = {
  done: 'bg-canvas text-mute',
  now: 'bg-primary text-white',
  todo: 'border border-hairline text-esub',
};

/**
 * Mobile 티켓팅 섹션 — 에디토리얼 (단계 타임라인형, PC와 동일 구성)
 */
function MobileTicketingSection({ schedule }) {
  const postUrls = schedule.postUrls || [];
  const pair = schedule.pair || null;
  const concert = schedule.concert || null;
  const linkLabel = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  };
  const fmtAuth = (dt) => (dt ? ticketingFmt(dt.slice(0, 10), dt.slice(11, 16)) : '');

  const steps = [];
  if (schedule.authStart || schedule.authEnd) {
    steps.push({
      key: 'auth',
      name: '팬클럽 인증',
      sub: schedule.authNote || '선예매 참여 조건',
      when: `${fmtAuth(schedule.authStart)} – ${fmtAuth(schedule.authEnd)}`,
      status: ticketingAuthStatus(schedule.authStart, schedule.authEnd),
      current: false,
    });
  }
  // 선예매는 종료 시각이 있으면 기간으로 (PC와 동일)
  const presaleWhen = (date, time) =>
    schedule.presaleEnd
      ? `${ticketingFmt(date, time)} – ${fmtAuth(schedule.presaleEnd)}`
      : ticketingFmt(date, time);

  const own = {
    key: schedule.stage,
    name: TICKETING_STAGE_LABEL[schedule.stage] || '예매',
    sub: '이 일정',
    when: schedule.stage === 'presale'
      ? presaleWhen(schedule.date, schedule.time)
      : ticketingFmt(schedule.date, schedule.time),
    status: ticketingStageStatus(schedule.date, schedule.time),
    current: true,
  };
  const pairStep = pair && {
    key: pair.stage,
    name: TICKETING_STAGE_LABEL[pair.stage] || '예매',
    sub: null,
    when: pair.stage === 'presale'
      ? presaleWhen(pair.date, pair.time)
      : ticketingFmt(pair.date, pair.time),
    status: ticketingStageStatus(pair.date, pair.time),
    current: false,
    link: `/schedule/${pair.scheduleId}`,
  };
  const ordered = [own, pairStep].filter(Boolean).sort((a) => (a.key === 'presale' ? -1 : 1));
  steps.push(...ordered);

  return (
    <div className="px-[22px] pb-16 pt-[26px]">
      {/* 뱃지 */}
      <span className="inline-flex items-center gap-1.5 border border-ink px-3 py-[7px] text-[12px] font-extrabold tracking-k15 text-ink">
        <Ticket size={12} />
        티켓팅{schedule.vendor ? ` · ${schedule.vendor}` : ''}
      </span>

      {/* 제목 */}
      <h1
        className="mt-[18px] text-[24px] font-extrabold leading-[1.35] tracking-[-0.6px] text-ink"
        style={{ textWrap: 'balance' }}
      >
        {decodeHtmlEntities(schedule.title)}
      </h1>

      {/* 단계 타임라인 */}
      <div className="mt-[22px] border-t-2 border-ink">
        {steps.map((st, i) => {
          const row = (
            <div className={`flex items-center gap-3.5 border-b border-hairline px-1 py-4 ${st.current ? 'bg-canvas' : ''}`}>
              <span
                className={`text-[13.5px] font-extrabold ${st.current ? 'text-primary' : 'text-faint'}`}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-extrabold tracking-[-0.3px] text-ink">
                  {st.name}
                  {st.sub && <span className="ml-1.5 text-[11.5px] font-semibold tracking-[0.5px] text-mute">{st.sub}</span>}
                </b>
                <span className="mt-[3px] block text-[13.5px] font-bold text-ebody" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {st.when}
                </span>
              </span>
              {st.status && (
                <span className={`shrink-0 px-2.5 py-1 text-[11px] font-extrabold tracking-k1 ${TICKETING_ST_CLASS[st.status.kind]}`}>
                  {st.status.label}
                </span>
              )}
            </div>
          );
          return st.link ? (
            <Link key={st.key} to={st.link}>{row}</Link>
          ) : (
            <div key={st.key}>{row}</div>
          );
        })}
      </div>

      {/* 예매 버튼 */}
      {schedule.ticketUrl && (
        <a
          href={schedule.ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex w-full items-center justify-center gap-2 bg-ink py-3.5 text-[13.5px] font-extrabold tracking-k15 text-white"
        >
          {schedule.vendor ? `${schedule.vendor}에서 예매` : '예매 페이지'}
          <ExternalLink size={13} />
        </a>
      )}

      {/* 매수 제한 + 공지 */}
      {(schedule.purchaseLimit || postUrls.length > 0) && (
        <p className="mt-4 text-[13.5px] font-semibold leading-[1.8] text-esub">
          {schedule.purchaseLimit && (
            <>매수 제한 <b className="font-extrabold text-ebody">{schedule.purchaseLimit}</b></>
          )}
          {schedule.purchaseLimit && postUrls.length > 0 && <span className="mx-2 text-faint">·</span>}
          {postUrls.map((url, idx) => (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mr-1.5 inline-flex items-center gap-1 border-b border-faint pb-0.5 font-bold text-ebody"
            >
              {linkLabel(url)}
              <ExternalLink size={10} />
            </a>
          ))}
        </p>
      )}

      {/* 연결 콘서트 카드 */}
      {concert && (
        <div className="mt-9">
          <div className="border-t-2 border-ink pt-3 text-[12px] font-extrabold tracking-k25 text-ink">CONCERT</div>
          <Link
            to={concert.firstScheduleId ? `/schedule/${concert.firstScheduleId}` : '#'}
            className="mt-3.5 flex items-center gap-4 border border-hairline bg-white p-3.5"
          >
            {concert.posterThumbUrl ? (
              <img src={concert.posterThumbUrl} alt={concert.title} className="w-[64px] flex-none object-cover" style={{ aspectRatio: '3/4' }} />
            ) : (
              <span className="flex w-[64px] flex-none items-center justify-center bg-canvas-deep text-[20px] text-faint" style={{ aspectRatio: '3/4' }}>◉</span>
            )}
            <span className="min-w-0 flex-1">
              <b className="block text-[14.5px] font-extrabold leading-[1.4] tracking-[-0.3px] text-ink">{concert.title}</b>
              <span className="mt-1 block text-[12.5px] text-esub">
                {concert.startDate && concert.startDate.replaceAll('-', '. ')}
                {concert.endDate && concert.endDate !== concert.startDate && ` – ${concert.endDate.replaceAll('-', '. ')}`}
                {concert.venueName && ` · ${concert.venueName}`}
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-mute" />
          </Link>
        </div>
      )}
    </div>
  );
}

export default MobileTicketingSection;
