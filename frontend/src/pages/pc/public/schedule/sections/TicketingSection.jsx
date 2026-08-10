/**
 * PC 티켓팅 상세 — 에디토리얼 (단계 타임라인형)
 * 팬클럽 인증 → 선예매 → 일반예매 타임라인, 현재 일정 단계 하이라이트.
 * 예매처 버튼·매수 제한·공지 링크 + 연결 콘서트 카드(시리즈 연결 시).
 */
import { Link } from 'react-router-dom';
import { ExternalLink, Ticket } from 'lucide-react';
import { WEEKDAYS } from '@/constants';
import { decodeHtmlEntities } from './utils';
import Crumb from './Crumb';

const STAGE_LABEL = { presale: '팬클럽 선예매', general: '일반예매' };

/** 'YYYY-MM-DD' + 'HH:mm' → Date */
function toDate(date, time) {
  if (!date) return null;
  return new Date(`${date}T${time ? time.slice(0, 5) : '00:00'}:00`);
}

/** 'M. D. (요일) HH:mm' 표기 */
function fmtDT(date, time) {
  const d = toDate(date, time);
  if (!d) return '';
  const base = `${d.getMonth() + 1}. ${d.getDate()}. (${WEEKDAYS[d.getDay()]})`;
  return time ? `${base} ${time.slice(0, 5)}` : base;
}

/** 오픈 시각 대비 상태 뱃지 값 */
function stageStatus(date, time) {
  const d = toDate(date, time);
  if (!d) return null;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return { label: 'D-DAY', kind: 'now' };
  if (d < now) return { label: '종료', kind: 'done' };
  const days = Math.ceil((toDate(date, null) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  return { label: `D-${days}`, kind: 'todo' };
}

/** 인증 기간('YYYY-MM-DD HH:mm') 상태 */
function authStatus(start, end) {
  const now = new Date();
  const s = start ? new Date(start.replace(' ', 'T')) : null;
  const e = end ? new Date(end.replace(' ', 'T')) : null;
  if (e && now > e) return { label: '종료', kind: 'done' };
  if (s && now < s) return { label: '예정', kind: 'todo' };
  return { label: '진행 중', kind: 'now' };
}

const ST_CLASS = {
  done: 'bg-canvas text-mute',
  now: 'bg-primary text-white',
  todo: 'border border-hairline text-esub',
};

/** 'YYYY-MM-DD HH:mm' → 'M. D. (요일) HH:mm' */
function fmtAuth(dt) {
  if (!dt) return '';
  return fmtDT(dt.slice(0, 10), dt.slice(11, 16));
}

function TicketingSection({ schedule }) {
  const postUrls = schedule.postUrls || [];
  const pair = schedule.pair || null;
  const concert = schedule.concert || null;

  const linkLabel = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  };

  // 타임라인 단계 구성 — 인증(있으면) → 선예매 → 일반예매 순
  const steps = [];
  if (schedule.authStart || schedule.authEnd) {
    steps.push({
      key: 'auth',
      name: '팬클럽 인증',
      sub: schedule.authNote || '선예매 참여 조건',
      when: `${fmtAuth(schedule.authStart)} – ${fmtAuth(schedule.authEnd)}`,
      status: authStatus(schedule.authStart, schedule.authEnd),
      current: false,
    });
  }
  // 선예매는 종료 시각이 있으면 기간으로 보여준다 (인증 단계와 같은 표기)
  const presaleWhen = (date, time) =>
    schedule.presaleEnd
      ? `${fmtDT(date, time)} – ${fmtAuth(schedule.presaleEnd)}`
      : fmtDT(date, time);

  const own = {
    key: schedule.stage,
    name: STAGE_LABEL[schedule.stage] || '예매',
    sub: '이 일정',
    when: schedule.stage === 'presale'
      ? presaleWhen(schedule.date, schedule.time)
      : fmtDT(schedule.date, schedule.time),
    status: stageStatus(schedule.date, schedule.time),
    current: true,
    limit: schedule.purchaseLimit,
  };
  const pairStep = pair && {
    key: pair.stage,
    name: STAGE_LABEL[pair.stage] || '예매',
    sub: null,
    when: pair.stage === 'presale'
      ? presaleWhen(pair.date, pair.time)
      : fmtDT(pair.date, pair.time),
    status: stageStatus(pair.date, pair.time),
    current: false,
    link: `/schedule/${pair.scheduleId}`,
  };
  // 선예매가 항상 일반예매보다 앞
  const ordered = [own, pairStep].filter(Boolean).sort((a) => (a.key === 'presale' ? -1 : 1));
  steps.push(...ordered);

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col px-[70px] pb-14 pt-[52px]">
      <Crumb schedule={schedule} />

      {/* 뱃지 */}
      <span className="mt-[22px] inline-flex items-center gap-2 self-start border border-ink px-[15px] py-[9px] text-[12.5px] font-extrabold tracking-k15 text-ink">
        <Ticket size={13} />
        티켓팅{schedule.vendor ? ` · ${schedule.vendor}` : ''}
      </span>

      {/* 제목 */}
      <h1
        className="mt-[24px] text-[34px] font-extrabold leading-[1.35] tracking-[-0.9px] text-ink"
        style={{ textWrap: 'balance' }}
      >
        {decodeHtmlEntities(schedule.title)}
      </h1>

      {/* 단계 타임라인 */}
      <div className="mt-10 border-t-2 border-ink">
        {steps.map((st, i) => {
          const row = (
            <div
              className={`grid grid-cols-[44px_190px_1fr_auto] items-center gap-x-5 border-b border-hairline px-1 py-6 ${
                st.current ? 'bg-canvas' : ''
              } ${st.link ? 'transition-colors hover:bg-canvas-deep' : ''}`}
            >
              <span
                className={`text-[15px] font-extrabold ${st.current ? 'text-primary' : 'text-faint'}`}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>
                <b className="block text-[17px] font-extrabold tracking-[-0.3px] text-ink">{st.name}</b>
                {st.sub && (
                  <span className="mt-[3px] block text-[12.5px] font-semibold tracking-[0.5px] text-mute">{st.sub}</span>
                )}
              </span>
              <span
                className="text-[16.5px] font-bold text-ebody"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {st.when}
              </span>
              {st.status && (
                <span className={`px-3 py-1.5 text-[12px] font-extrabold tracking-k15 ${ST_CLASS[st.status.kind]}`}>
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

      {/* 예매 버튼 + 매수 제한 + 공지 */}
      <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
        {schedule.ticketUrl && (
          <a
            href={schedule.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-ink px-7 py-3.5 text-[13.5px] font-extrabold tracking-k15 text-white transition-colors hover:bg-ebody"
          >
            {schedule.vendor ? `${schedule.vendor}에서 예매` : '예매 페이지'}
            <ExternalLink size={13} />
          </a>
        )}
        <span className="text-[14.5px] font-semibold text-esub">
          {schedule.purchaseLimit && (
            <>매수 제한 <b className="font-extrabold text-ebody">{schedule.purchaseLimit}</b></>
          )}
          {schedule.purchaseLimit && postUrls.length > 0 && <span className="mx-2.5 text-faint">·</span>}
          {postUrls.map((url, idx) => (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mr-1.5 inline-flex items-center gap-1 border-b border-faint pb-0.5 font-bold text-ebody transition-colors hover:border-ink hover:text-ink"
            >
              {linkLabel(url)}
              <ExternalLink size={11} />
            </a>
          ))}
        </span>
      </div>

      {/* 연결 콘서트 카드 */}
      {concert && (
        <div className="mt-14">
          <div className="border-t-2 border-ink pt-3.5 text-[13px] font-extrabold tracking-k3 text-ink">CONCERT</div>
          <Link
            to={concert.firstScheduleId ? `/schedule/${concert.firstScheduleId}` : '#'}
            className="mt-[18px] flex items-center gap-[22px] border border-hairline bg-white p-[18px] transition-colors hover:border-ink"
          >
            {concert.posterThumbUrl ? (
              <img src={concert.posterThumbUrl} alt={concert.title} className="w-[92px] flex-none object-cover" style={{ aspectRatio: '3/4' }} />
            ) : (
              <span className="flex w-[92px] flex-none items-center justify-center bg-canvas-deep text-[26px] text-faint" style={{ aspectRatio: '3/4' }}>◉</span>
            )}
            <span className="min-w-0 flex-1">
              <b className="block text-[18px] font-extrabold tracking-[-0.4px] text-ink">{concert.title}</b>
              <span className="mt-1.5 block text-[13.5px] text-esub">
                {concert.startDate && concert.startDate.replaceAll('-', '. ')}
                {concert.endDate && concert.endDate !== concert.startDate && ` – ${concert.endDate.replaceAll('-', '. ')}`}
                {concert.venueName && ` · ${concert.venueName}`}
              </span>
            </span>
            <span className="text-[20px] text-mute">→</span>
          </Link>
        </div>
      )}
    </div>
  );
}

export default TicketingSection;
